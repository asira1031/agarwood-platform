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
  updated_at?: string | null;
};

type OperationRequest = {
  id: string;
  profile_id: string | null;
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
  tree_code?: string | null;
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
  "NUTRIENTS & BOOSTERS": 0.5,
  BOOSTER: 0.5,
  "SOIL PRODUCTS": 0.5,
  "SOIL CONDITIONER": 0.5,
  "TREE HEALTH": 0.25,
  "DISEASE PREVENTION": 0.25,
};

function normalize(value: any) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function pesoNumber(value: number) {
  return Number(value || 0).toLocaleString("en-PH", {
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getItemStatus(item: InventoryItem, activeTreeCount: number) {
  const remaining = Number(item.remaining_qty || 0);
  const low = Number(item.low_stock_level || 0);
  const status = normalize(item.status || "AVAILABLE");
  const weeklyNeed = weeklyNeedForItem(item, activeTreeCount);
  const weeks = weeklyNeed > 0 ? remaining / weeklyNeed : 999;

  if (status === "USED" || status === "CONSUMED") {
    return { label: "Used", level: "used" };
  }

  if (remaining <= 0) {
    return { label: "Out of Stock", level: "out" };
  }

  if (low > 0 && remaining <= low) {
    return { label: "Low Stock", level: "low" };
  }

  if (weeklyNeed > 0 && weeks < 1) {
    return { label: "Not Enough", level: "low" };
  }

  return { label: "Ready", level: "ready" };
}

function weeklyNeedForItem(item: InventoryItem, activeTreeCount: number) {
  const category = normalize(item.category || item.item_name || "");
  const matchedKey = Object.keys(CARE_REQUIREMENTS_PER_TREE_PER_WEEK).find((key) =>
    category.includes(key)
  );

  if (!matchedKey) return 0;

  return CARE_REQUIREMENTS_PER_TREE_PER_WEEK[matchedKey] * Math.max(activeTreeCount, 1);
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

    const email = user.email?.trim() || "";
    const lowerEmail = email.toLowerCase();

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("email", lowerEmail)
      .maybeSingle();

    const { data: profileByEmailFallback } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .ilike("email", email)
      .maybeSingle();

    const currentProfile = profileById || profileByEmail || profileByEmailFallback;

    if (!currentProfile) {
      setMessage(`Profile not found for ${email || user.id}.`);
      setLoading(false);
      return;
    }

    setProfile(currentProfile as Profile);

    const { data: inventoryRows, error: inventoryError } = await supabase
      .from("inventory")
      .select("*")
      .eq("profile_id", currentProfile.id)
      .order("created_at", { ascending: false });

    if (inventoryError) {
      setItems([]);
      setTrees([]);
      setOperations([]);
      setMessage(`Inventory load failed: ${inventoryError.message}`);
      setLoading(false);
      return;
    }

    const { data: treeRows } = await supabase
      .from("trees")
      .select("*")
      .eq("profile_id", currentProfile.id)
      .order("created_at", { ascending: false });

    const { data: operationRows } = await supabase
      .from("tree_operation_requests")
      .select("id, profile_id, tree_id, operation_type, total_amount, status, notes, created_at")
      .eq("profile_id", currentProfile.id)
      .order("created_at", { ascending: false })
      .limit(50);

    setItems((inventoryRows || []) as InventoryItem[]);
    setTrees((treeRows || []) as TreeRow[]);
    setOperations((operationRows || []) as OperationRequest[]);
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

  return (
    <main className="page">
      <section className="hero">
        <div>
          <Link className="back" href="/dashboard">← Back to Dashboard</Link>
          <p className="eyebrow">Arganwood Inventory Sync</p>
          <h1>Inventory</h1>
          <span>
            Supplies here are the source of truth for customer stock. Marketplace adds stock.
            Tree Operations deducts stock when inventory services are requested.
          </span>
        </div>

        <div className="heroCard">
          <p>Active Trees</p>
          <strong>{activeTreeCount}</strong>
          <small>{profile?.email || "Customer inventory"}</small>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      {loading ? (
        <div className="empty">Loading inventory...</div>
      ) : (
        <>
          <section className="stats">
            <Card label="Inventory Items" value={String(stats.totalItems)} />
            <Card label="Total Remaining Qty" value={pesoNumber(stats.totalQty)} />
            <Card label="Ready" value={String(stats.ready)} good />
            <Card label="Low / Out" value={String(stats.low + stats.out)} danger={stats.low + stats.out > 0} />
          </section>

          <section className="filters">
            <button className={viewMode === "ALL" ? "active" : ""} onClick={() => setViewMode("ALL")}>All</button>
            <button className={viewMode === "READY" ? "active" : ""} onClick={() => setViewMode("READY")}>Ready</button>
            <button className={viewMode === "LOW" ? "active" : ""} onClick={() => setViewMode("LOW")}>Low</button>
            <button className={viewMode === "OUT" ? "active" : ""} onClick={() => setViewMode("OUT")}>Out</button>
            <button className={viewMode === "USED" ? "active" : ""} onClick={() => setViewMode("USED")}>Used</button>
          </section>

          <section className="panel">
            <div className="panelHead">
              <div>
                <h2>Stock Records</h2>
                <p>Current inventory after Marketplace additions and Tree Operations deductions.</p>
              </div>
              <button onClick={loadInventory}>Refresh</button>
            </div>

            {filteredItems.length === 0 ? (
              <div className="empty small">No inventory records found for this filter.</div>
            ) : (
              <div className="list">
                {filteredItems.map((item) => {
                  const remaining = Number(item.remaining_qty || 0);
                  const starting = Number(item.starting_qty || 0);
                  const low = Number(item.low_stock_level || 0);
                  const weeklyNeed = weeklyNeedForItem(item, activeTreeCount);
                  const weeks = weeklyNeed > 0 ? remaining / weeklyNeed : 999;
                  const progress = starting > 0 ? Math.max(0, Math.min(100, (remaining / starting) * 100)) : 0;
                  const info = getItemStatus(item, activeTreeCount);
                  const relatedOperations = inventoryOperationRows.filter((request) =>
                    matchesInventoryOperation(request, item)
                  );

                  return (
                    <article className={`item ${info.level}`} key={item.id}>
                      <div className="itemTop">
                        <div>
                          <strong>{item.item_name || "Inventory Item"}</strong>
                          <p>{item.category || "Uncategorized"} • {item.unit || "Unit"}</p>
                        </div>
                        <span>{info.label}</span>
                      </div>

                      <div className="progress"><i style={{ width: `${progress}%` }} /></div>

                      <div className="qtyGrid">
                        <Mini label="Starting" value={`${pesoNumber(starting)} ${item.unit || "unit"}`} />
                        <Mini label="Remaining" value={`${pesoNumber(remaining)} ${item.unit || "unit"}`} strong />
                        <Mini label="Low Level" value={`${pesoNumber(low)} ${item.unit || "unit"}`} />
                        <Mini label="Weeks Left" value={weeks >= 999 ? "No formula" : weeks.toFixed(1)} />
                      </div>

                      <div className="movementBox">
                        <b>Connected Operation Usage</b>
                        {relatedOperations.length === 0 ? (
                          <p>No recent operation deduction matched this item yet.</p>
                        ) : (
                          relatedOperations.slice(0, 3).map((request) => (
                            <p key={request.id}>
                              {request.operation_type || "Operation"} • {request.status || "PENDING"} • {formatDate(request.created_at)}
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
                <h2>Recent Inventory-Deducting Requests</h2>
                <p>These requests came from Tree Operations and should reduce remaining_qty when submitted.</p>
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
          color: #17251b;
          font-family: Arial, Helvetica, sans-serif;
          background:
            radial-gradient(circle at 18% 5%, rgba(255, 226, 154, .55), transparent 24%),
            radial-gradient(circle at 92% 8%, rgba(255,255,255,.72), transparent 28%),
            linear-gradient(180deg, #f8f4eb 0%, #f3eadb 52%, #eadcc3 100%);
        }
        .back {
          display: inline-flex;
          margin-bottom: 12px;
          color: #244536;
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
          color: #8c6a3c;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .14em;
        }
        h1 { margin: 0; font-size: 44px; letter-spacing: -1.4px; color: #102018; }
        .hero span { display: block; max-width: 850px; margin-top: 8px; color: #5f665e; line-height: 1.6; font-weight: 700; }
        .heroCard {
          min-width: 250px;
          border-radius: 28px;
          padding: 22px;
          color: white;
          background: linear-gradient(135deg, #244536, #10281f);
          box-shadow: 0 24px 56px rgba(36,69,54,.24);
        }
        .heroCard p { margin: 0; color: rgba(255,255,255,.7); font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .14em; }
        .heroCard strong { display: block; margin-top: 8px; font-size: 40px; }
        .heroCard small { color: rgba(255,255,255,.74); font-weight: 900; }
        .message, .empty, .panel, .filters, .card {
          border-radius: 26px;
          background: rgba(255,253,246,.88);
          border: 1px solid rgba(92,70,35,.08);
          box-shadow: 0 18px 42px rgba(82,60,27,.09);
        }
        .message, .empty { padding: 18px; margin-bottom: 18px; color: #31553d; font-weight: 900; }
        .small { box-shadow: none; border-radius: 18px; background: #f3ead8; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 16px; }
        .card { padding: 22px; }
        .card p { margin: 0; color: #6b6b62; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .12em; }
        .card h3 { margin: 9px 0 0; color: #244536; font-size: 30px; }
        .card.good h3 { color: #276941; }
        .card.danger h3 { color: #9a3c2a; }
        .filters { padding: 12px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px; }
        .filters button, .panelHead button {
          border: 0;
          border-radius: 999px;
          padding: 12px 14px;
          background: #f3ead8;
          color: #244536;
          font-weight: 900;
          cursor: pointer;
        }
        .filters button.active, .panelHead button { background: linear-gradient(135deg, #244536, #10281f); color: white; }
        .panel { padding: 24px; margin-bottom: 18px; }
        .panelHead { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 18px; }
        .panelHead h2 { margin: 0; color: #244536; font-size: 24px; }
        .panelHead p { margin: 5px 0 0; color: #6b6b62; font-weight: 700; }
        .list { display: grid; gap: 14px; }
        .item {
          border-radius: 24px;
          padding: 18px;
          background: #fffaf0;
          border: 1px solid rgba(92,70,35,.10);
        }
        .item.ready { border-left: 8px solid #276941; }
        .item.low { border-left: 8px solid #b78326; }
        .item.out, .item.used { border-left: 8px solid #9a3c2a; }
        .itemTop { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
        .itemTop strong { color: #102018; font-size: 18px; }
        .itemTop p { margin: 6px 0 0; color: #6b6b62; font-weight: 800; }
        .itemTop span { padding: 8px 12px; border-radius: 999px; background: #244536; color: white; font-size: 12px; font-weight: 900; }
        .progress { height: 10px; margin: 16px 0; overflow: hidden; border-radius: 999px; background: #eadcc3; }
        .progress i { display: block; height: 100%; border-radius: inherit; background: #244536; }
        .qtyGrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .mini { border-radius: 18px; padding: 12px; background: #f3ead8; }
        .mini small { display: block; color: #6b6b62; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
        .mini b { display: block; margin-top: 5px; color: #244536; }
        .movementBox { margin-top: 14px; border-radius: 18px; background: rgba(36,69,54,.07); padding: 14px; }
        .movementBox b { color: #244536; }
        .movementBox p { margin: 6px 0 0; color: #5f665e; font-weight: 700; }
        .history { display: grid; gap: 10px; }
        .historyRow { display: flex; justify-content: space-between; gap: 14px; padding: 15px; border-radius: 18px; background: #fffaf0; }
        .historyRow strong { color: #244536; }
        .historyRow p { margin: 5px 0 0; color: #6b6b62; }
        .historyRow div:last-child { text-align: right; }
        .historyRow span { display: inline-block; margin-bottom: 6px; padding: 6px 10px; border-radius: 999px; background: #244536; color: white; font-size: 11px; font-weight: 900; }
        .historyRow b { display: block; color: #6b6b62; font-size: 12px; }
        @media (max-width: 980px) {
          .hero, .panelHead { flex-direction: column; }
          .stats, .filters, .qtyGrid { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}

function Card({ label, value, good, danger }: { label: string; value: string; good?: boolean; danger?: boolean }) {
  return (
    <div className={`card ${good ? "good" : ""} ${danger ? "danger" : ""}`}>
      <p>{label}</p>
      <h3>{value}</h3>
    </div>
  );
}

function Mini({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="mini">
      <small>{label}</small>
      <b style={{ fontSize: strong ? 17 : 14 }}>{value}</b>
    </div>
  );
}
