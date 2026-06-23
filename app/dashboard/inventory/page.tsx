"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type InventoryItem = {
  id: string;
  profile_id: string | null;
  tree_id: string | null;
  item_name: string | null;
  category: string | null;
  unit: string | null;
  starting_qty: number | null;
  remaining_qty: number | null;
  low_stock_level: number | null;
  status: string | null;
  created_at: string | null;
};

type OperationRequest = {
  id: string;
  profile_id: string | null;
  customer_profile_id?: string | null;
  tree_id: string | null;
  operation_type: string | null;
  total_amount: number | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
};

type TreeRow = {
  id: string;
  profile_id: string | null;
  customer_profile_id?: string | null;
  tree_code: string | null;
  display_name?: string | null;
  custom_name?: string | null;
  ownership_status?: string | null;
  availability_status?: string | null;
  status?: string | null;
};

type ViewMode = "ALL" | "READY" | "LOW" | "OUT" | "USED";

const CARE_REQUIREMENTS_PER_TREE_PER_WEEK: Record<string, number> = {
  FERTILIZER: 1,
  FERTILIZERS: 1,
  FUNGICIDE: 0.5,
  FUNGICIDES: 0.5,
  INSECTICIDE: 0.25,
  "PEST CONTROL": 0.25,
  NUTRIENTS: 0.5,
  BOOSTER: 0.5,
  "SOIL CONDITIONER": 0.5,
  "TREE HEALTH": 0.25,
  "DISEASE PREVENTION": 0.25,
};

function normalize(value: any) {
  return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function qty(value: number) {
  return Number(value || 0).toLocaleString("en-PH", {
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function weeklyNeedForItem(item: InventoryItem, activeTreeCount: number) {
  const text = normalize(`${item.category || ""} ${item.item_name || ""}`);
  const matchedKey = Object.keys(CARE_REQUIREMENTS_PER_TREE_PER_WEEK).find((key) =>
    text.includes(key)
  );

  if (!matchedKey) return 0;

  return CARE_REQUIREMENTS_PER_TREE_PER_WEEK[matchedKey] * Math.max(activeTreeCount, 1);
}

function getItemStatus(item: InventoryItem, activeTreeCount: number) {
  const remaining = Number(item.remaining_qty || 0);
  const low = Number(item.low_stock_level || 0);
  const status = normalize(item.status || "AVAILABLE");
  const weeklyNeed = weeklyNeedForItem(item, activeTreeCount);
  const weeks = weeklyNeed > 0 ? remaining / weeklyNeed : 999;

  if (status === "USED" || status === "CONSUMED") return { label: "Used", level: "used" };
  if (remaining <= 0) return { label: "Out of Stock", level: "out" };
  if (low > 0 && remaining <= low) return { label: "Low Stock", level: "low" };
  if (weeklyNeed > 0 && weeks < 1) return { label: "Not Enough", level: "low" };

  return { label: "Ready", level: "ready" };
}

function matchesInventoryOperation(request: OperationRequest, item: InventoryItem) {
  const operation = normalize(request.operation_type);
  const itemName = normalize(item.item_name);
  const category = normalize(item.category);

  if (!operation) return false;

  if (operation.includes("FERTILIZER")) {
    return itemName.includes("FERTILIZER") || category.includes("FERTILIZER");
  }

  if (operation.includes("FUNGICIDE")) {
    return itemName.includes("FUNGICIDE") || category.includes("FUNGICIDE");
  }

  if (operation.includes("INSECTICIDE") || operation.includes("PEST")) {
    return itemName.includes("INSECTICIDE") || itemName.includes("PEST") || category.includes("PEST");
  }

  if (operation.includes("NUTRIENT") || operation.includes("BOOSTER")) {
    return itemName.includes("NUTRIENT") || itemName.includes("BOOSTER") || category.includes("NUTRIENT");
  }

  return false;
}

export default function InventoryPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [operations, setOperations] = useState<OperationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("ALL");

  async function findProfile(userId: string, email: string) {
    const cleanEmail = email.trim();
    const lowerEmail = cleanEmail.toLowerCase();

    const { data: profileById, error: byIdError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", userId)
      .maybeSingle();

    if (byIdError) throw byIdError;

    const { data: profileByEmail, error: byEmailError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("email", lowerEmail)
      .maybeSingle();

    if (byEmailError) throw byEmailError;

    const { data: profileByEmailFallback, error: fallbackError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (fallbackError) throw fallbackError;

    return (profileById || profileByEmail || profileByEmailFallback) as Profile | null;
  }

  async function loadInventory() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      setMessage(userError.message);
      setLoading(false);
      return;
    }

    if (!user) {
      window.location.href = "/login";
      return;
    }

    try {
      const currentProfile = await findProfile(user.id, user.email || "");

      if (!currentProfile) {
        setMessage(`Profile not found for ${user.email || user.id}.`);
        setLoading(false);
        return;
      }

      setProfile(currentProfile);

      const { data: inventoryRows, error: inventoryError } = await supabase
        .from("inventory")
        .select(
          "id, profile_id, tree_id, item_name, category, unit, starting_qty, remaining_qty, low_stock_level, status, created_at"
        )
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false });

      if (inventoryError) throw inventoryError;

      const { data: treeRows, error: treeError } = await supabase
        .from("trees")
        .select(
          "id, profile_id, customer_profile_id, tree_code, display_name, custom_name, ownership_status, availability_status, status"
        )
        .or(`profile_id.eq.${currentProfile.id},customer_profile_id.eq.${currentProfile.id}`)
        .order("created_at", { ascending: false });

      if (treeError) throw treeError;

      const { data: operationRows, error: operationError } = await supabase
        .from("tree_operation_requests")
        .select(
          "id, profile_id, customer_profile_id, tree_id, operation_type, total_amount, status, notes, created_at"
        )
        .or(`profile_id.eq.${currentProfile.id},customer_profile_id.eq.${currentProfile.id}`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (operationError) throw operationError;

      setItems((inventoryRows || []) as InventoryItem[]);
      setTrees((treeRows || []) as TreeRow[]);
      setOperations((operationRows || []) as OperationRequest[]);
    } catch (error: any) {
      setMessage(error?.message || "Forest supplies failed to load.");
      setItems([]);
      setTrees([]);
      setOperations([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadInventory();
  }, []);

  const activeTreeCount = useMemo(() => {
    return trees.filter((tree) => {
      const ownership = normalize(tree.ownership_status || "OWNED");
      const availability = normalize(tree.availability_status || "OWNED");
      const status = normalize(tree.status || "ACTIVE");

      return ownership !== "SOLD" && availability !== "SOLD" && status !== "SOLD";
    }).length;
  }, [trees]);

  const inventoryOperationRows = useMemo(() => {
    return operations.filter((request) => {
      const operation = normalize(request.operation_type);
      return (
        operation.includes("FERTILIZER") ||
        operation.includes("FUNGICIDE") ||
        operation.includes("INSECTICIDE") ||
        operation.includes("PEST") ||
        operation.includes("NUTRIENT") ||
        operation.includes("BOOSTER")
      );
    });
  }, [operations]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const info = getItemStatus(item, activeTreeCount);

      if (viewMode === "ALL") return true;
      if (viewMode === "READY") return info.level === "ready";
      if (viewMode === "LOW") return info.level === "low";
      if (viewMode === "OUT") return info.level === "out";
      if (viewMode === "USED") return info.level === "used";

      return true;
    });
  }, [items, viewMode, activeTreeCount]);

  const stats = useMemo(() => {
    const ready = items.filter((item) => getItemStatus(item, activeTreeCount).level === "ready").length;
    const low = items.filter((item) => getItemStatus(item, activeTreeCount).level === "low").length;
    const out = items.filter((item) => getItemStatus(item, activeTreeCount).level === "out").length;
    const totalQty = items.reduce((sum, item) => sum + Number(item.remaining_qty || 0), 0);

    return {
      totalItems: items.length,
      totalQty,
      ready,
      low,
      out,
    };
  }, [items, activeTreeCount]);

  return (
    <main className="page">
      <section className="hero">
        <div>
          <Link className="back" href="/dashboard">
            ← Back to Dashboard
          </Link>
          <p className="eyebrow">Customer Supplies</p>
          <h1>Forest Supplies</h1>
          <span>
            Track your supplies, treatments, and protection materials from real inventory records.
          </span>
        </div>

        <div className="heroCard">
          <p>Active Trees</p>
          <strong>{activeTreeCount}</strong>
          <small>{profile?.full_name || profile?.email || "Customer supplies"}</small>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      {loading ? (
        <div className="empty">Loading Forest Supplies...</div>
      ) : (
        <>
          <section className="stats">
            <Card label="Supply Records" value={String(stats.totalItems)} />
            <Card label="Remaining Qty" value={qty(stats.totalQty)} />
            <Card label="Ready" value={String(stats.ready)} />
            <Card label="Low / Out" value={String(stats.low + stats.out)} />
          </section>

          <section className="filters">
            {(["ALL", "READY", "LOW", "OUT", "USED"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                className={viewMode === mode ? "active" : ""}
                onClick={() => setViewMode(mode)}
              >
                {mode === "ALL"
                  ? "All"
                  : mode === "READY"
                  ? "Supplies"
                  : mode === "LOW"
                  ? "Low"
                  : mode === "OUT"
                  ? "Out"
                  : "Used"}
              </button>
            ))}
          </section>

          <section className="panel">
            <div className="panelHead">
              <div>
                <p className="eyebrow">Supplies</p>
                <h2>Supplies, Treatments & Protection Materials</h2>
                <span>Real current stock from the inventory table.</span>
              </div>
              <button onClick={loadInventory}>Refresh</button>
            </div>

            {filteredItems.length === 0 ? (
              <div className="empty small">No forest supplies found for this filter.</div>
            ) : (
              <div className="list">
                {filteredItems.map((item) => {
                  const remaining = Number(item.remaining_qty || 0);
                  const starting = Number(item.starting_qty || 0);
                  const low = Number(item.low_stock_level || 0);
                  const weeklyNeed = weeklyNeedForItem(item, activeTreeCount);
                  const weeks = weeklyNeed > 0 ? remaining / weeklyNeed : 999;
                  const progress =
                    starting > 0 ? Math.max(0, Math.min(100, (remaining / starting) * 100)) : 0;
                  const info = getItemStatus(item, activeTreeCount);
                  const relatedOperations = inventoryOperationRows.filter((request) =>
                    matchesInventoryOperation(request, item)
                  );

                  return (
                    <article className={`item ${info.level}`} key={item.id}>
                      <div className="itemTop">
                        <div>
                          <strong>{item.item_name || "Forest Supply"}</strong>
                          <p>{item.category || "Protection Material"} • {item.unit || "unit"}</p>
                        </div>
                        <span>{info.label}</span>
                      </div>

                      <div className="progress">
                        <i style={{ width: `${progress}%` }} />
                      </div>

                      <div className="qtyGrid">
                        <Mini label="Starting" value={`${qty(starting)} ${item.unit || "unit"}`} />
                        <Mini label="Remaining" value={`${qty(remaining)} ${item.unit || "unit"}`} />
                        <Mini label="Low Level" value={`${qty(low)} ${item.unit || "unit"}`} />
                        <Mini label="Weeks Left" value={weeks >= 999 ? "No formula" : weeks.toFixed(1)} />
                      </div>

                      <div className="movementBox">
                        <b>Connected Operation Usage</b>
                        {relatedOperations.length === 0 ? (
                          <p>No recent operation deduction matched this item yet.</p>
                        ) : (
                          relatedOperations.slice(0, 3).map((request) => (
                            <p key={request.id}>
                              {request.operation_type || "Operation"} • {request.status || "PENDING"} •{" "}
                              {formatDate(request.created_at)}
                            </p>
                          ))
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panelHead">
              <div>
                <p className="eyebrow">Treatments</p>
                <h2>Recent Inventory-Deducting Requests</h2>
                <span>Tree Operations that may use supplies from your inventory.</span>
              </div>
            </div>

            {inventoryOperationRows.length === 0 ? (
              <div className="empty small">No inventory-use operations yet.</div>
            ) : (
              <div className="history">
                {inventoryOperationRows.map((request) => (
                  <div className="historyRow" key={request.id}>
                    <div>
                      <strong>{request.operation_type || "Inventory Operation"}</strong>
                      <p>{request.notes || "No note"}</p>
                    </div>
                    <div>
                      <span>{request.status || "PENDING"}</span>
                      <b>{formatDate(request.created_at)}</b>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          padding: 30px;
          color: #f8f1d8;
          font-family: Arial, Helvetica, sans-serif;
          background:
            radial-gradient(circle at 15% 5%, rgba(214,178,94,.24), transparent 28%),
            radial-gradient(circle at 90% 10%, rgba(65,120,82,.22), transparent 30%),
            linear-gradient(180deg, #07140f 0%, #0d2118 48%, #07120d 100%);
        }

        .back {
          display: inline-flex;
          margin-bottom: 12px;
          color: #d6b25e;
          text-decoration: none;
          font-weight: 900;
        }

        .hero {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: stretch;
          margin-bottom: 20px;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #d6b25e;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .14em;
        }

        h1 {
          margin: 0;
          font-size: 46px;
          letter-spacing: -1.4px;
          color: #fff8dc;
        }

        h2 {
          margin: 0;
          color: #fff8dc;
          font-size: 26px;
        }

        .hero span,
        .panelHead span {
          display: block;
          max-width: 850px;
          margin-top: 8px;
          color: rgba(248,241,216,.68);
          line-height: 1.6;
        }

        .heroCard,
        .card,
        .panel,
        .message,
        .empty,
        .filters {
          border: 1px solid rgba(214,178,94,.22);
          background: rgba(255,255,255,.07);
          backdrop-filter: blur(18px);
          box-shadow: 0 24px 60px rgba(0,0,0,.28);
        }

        .heroCard {
          min-width: 260px;
          border-radius: 28px;
          padding: 22px;
        }

        .heroCard p,
        .heroCard small {
          margin: 0;
          color: rgba(248,241,216,.68);
          font-weight: 900;
        }

        .heroCard strong {
          display: block;
          margin: 10px 0;
          color: #d6b25e;
          font-size: 42px;
        }

        .message,
        .empty {
          padding: 18px;
          border-radius: 22px;
          margin-bottom: 18px;
          color: #fff8dc;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 18px;
        }

        .card {
          border-radius: 24px;
          padding: 20px;
        }

        .card p {
          margin: 0;
          color: rgba(248,241,216,.62);
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .card h3 {
          margin: 10px 0 0;
          color: #fff8dc;
          font-size: 28px;
        }

        .filters {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          border-radius: 24px;
          padding: 12px;
          margin-bottom: 18px;
        }

        button {
          border: 0;
          border-radius: 999px;
          padding: 12px 16px;
          background: rgba(255,255,255,.09);
          color: #f8f1d8;
          font-weight: 950;
          cursor: pointer;
        }

        button.active,
        .panelHead button {
          background: linear-gradient(135deg, #d6b25e, #8c6a3c);
          color: #07140f;
        }

        .panel {
          border-radius: 28px;
          padding: 22px;
          margin-bottom: 18px;
        }

        .panelHead {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: start;
          margin-bottom: 18px;
        }

        .list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .item {
          border-radius: 22px;
          padding: 18px;
          background: rgba(0,0,0,.22);
          border: 1px solid rgba(214,178,94,.14);
        }

        .item.ready { border-color: rgba(131,230,162,.26); }
        .item.low { border-color: rgba(214,178,94,.46); }
        .item.out { border-color: rgba(255,141,141,.34); }
        .item.used { opacity: .72; }

        .itemTop {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .itemTop strong {
          color: #fff8dc;
          font-size: 20px;
        }

        .itemTop p {
          margin: 5px 0 0;
          color: rgba(248,241,216,.58);
        }

        .itemTop span {
          color: #d6b25e;
          font-weight: 900;
          white-space: nowrap;
        }

        .progress {
          height: 10px;
          border-radius: 999px;
          background: rgba(255,255,255,.1);
          overflow: hidden;
          margin-bottom: 14px;
        }

        .progress i {
          display: block;
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(135deg, #d6b25e, #83e6a2);
        }

        .qtyGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .mini {
          border-radius: 16px;
          padding: 12px;
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(214,178,94,.1);
        }

        .mini p {
          margin: 0;
          color: rgba(248,241,216,.52);
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .1em;
        }

        .mini strong {
          display: block;
          margin-top: 6px;
          color: #fff8dc;
          font-size: 13px;
        }

        .movementBox {
          margin-top: 14px;
          border-radius: 16px;
          padding: 12px;
          background: rgba(0,0,0,.22);
          border: 1px solid rgba(214,178,94,.1);
        }

        .movementBox b {
          color: #d6b25e;
        }

        .movementBox p {
          margin: 7px 0 0;
          color: rgba(248,241,216,.62);
          line-height: 1.5;
        }

        .history {
          display: grid;
          gap: 12px;
        }

        .historyRow {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          padding: 14px;
          border-radius: 18px;
          background: rgba(0,0,0,.22);
          border: 1px solid rgba(214,178,94,.12);
        }

        .historyRow strong {
          color: #fff8dc;
        }

        .historyRow p {
          margin: 5px 0 0;
          color: rgba(248,241,216,.6);
        }

        .historyRow span {
          color: #d6b25e;
          font-weight: 900;
        }

        .historyRow b {
          display: block;
          margin-top: 5px;
          color: rgba(248,241,216,.62);
        }

        .small {
          box-shadow: none;
          margin: 0;
          background: rgba(0,0,0,.22);
        }

        @media (max-width: 1100px) {
          .list,
          .stats {
            grid-template-columns: 1fr;
          }

          .qtyGrid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 800px) {
          .hero,
          .panelHead,
          .historyRow {
            display: grid;
          }

          .heroCard {
            min-width: 0;
          }
        }
      `}</style>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <article className="card">
      <p>{label}</p>
      <h3>{value}</h3>
    </article>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}