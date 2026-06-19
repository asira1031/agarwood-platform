"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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

type TreeRow = {
  id: string;
  profile_id: string | null;
  ownership_status?: string | null;
  availability_status?: string | null;
};

const CARE_REQUIREMENTS_PER_TREE_PER_WEEK: Record<string, number> = {
  FERTILIZER: 1,
  FUNGICIDE: 0.5,
  INSECTICIDE: 0.25,
  NUTRIENTS: 0.5,
  BOOSTER: 0.5,
  "SOIL CONDITIONER": 0.5,
  "DISEASE PREVENTION": 0.25,
};

function normalizeCategory(value: string | null) {
  return String(value || "UNCATEGORIZED").trim().toUpperCase();
}

function pesoNumber(value: number) {
  return Number(value || 0).toLocaleString("en-PH", {
    maximumFractionDigits: 2,
  });
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [viewMode, setViewMode] = useState<"ALL" | "LOW" | "READY" | "NOT_READY">("ALL");

  async function loadInventory() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const email = user.email?.trim().toLowerCase() || "";

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    const profile = profileById || profileByEmail;

    if (!profile) {
      setMessage("Profile not found.");
      setLoading(false);
      return;
    }

    const { data: inventoryData, error: inventoryError } = await supabase
      .from("inventory")
      .select(
        "id, profile_id, tree_id, item_name, category, unit, starting_qty, remaining_qty, low_stock_level, status, created_at"
      )
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false });

    if (inventoryError) {
      setMessage("Inventory table not found yet. Run the inventory SQL table first.");
      setItems([]);
      setTrees([]);
      setLoading(false);
      return;
    }

    const { data: treeData } = await supabase
      .from("trees")
      .select("id, profile_id, ownership_status, availability_status")
      .eq("profile_id", profile.id);

    setItems(inventoryData || []);
    setTrees(treeData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadInventory();
  }, []);

  const activeTreeCount = useMemo(() => {
    return trees.filter((tree) => {
      const ownership = String(tree.ownership_status || "OWNED").toUpperCase();
      const availability = String(tree.availability_status || "OWNED").toUpperCase();
      return ownership !== "SOLD" && availability !== "SOLD";
    }).length;
  }, [trees]);

  function weeklyNeedForItem(item: InventoryItem) {
    const category = normalizeCategory(item.category);
    const perTree = CARE_REQUIREMENTS_PER_TREE_PER_WEEK[category] || 0;
    return perTree * Math.max(activeTreeCount, 1);
  }

  function weeksRemaining(item: InventoryItem) {
    const remaining = Number(item.remaining_qty || 0);
    const weeklyNeed = weeklyNeedForItem(item);

    if (weeklyNeed <= 0) return 999;

    return remaining / weeklyNeed;
  }

  function statusInfo(item: InventoryItem) {
    const remaining = Number(item.remaining_qty || 0);
    const low = Number(item.low_stock_level || 0);
    const weeks = weeksRemaining(item);
    const isLow = low > 0 && remaining <= low;

    if (remaining <= 0) {
      return {
        label: "Out of Stock",
        level: "danger",
      };
    }

    if (weeks < 1) {
      return {
        label: "Not Enough for 1 Week",
        level: "danger",
      };
    }

    if (isLow || weeks < 4) {
      return {
        label: "Low Supply",
        level: "warning",
      };
    }

    return {
      label: "Ready for 1 Month+",
      level: "good",
    };
  }

  const stats = useMemo(() => {
    const totalItems = items.length;

    const active = items.filter(
      (item) => ["ACTIVE", "AVAILABLE"].includes(String(item.status || "AVAILABLE").toUpperCase())
    ).length;

    const lowStock = items.filter((item) => {
      const info = statusInfo(item);
      return info.level === "warning";
    }).length;

    const notReady = items.filter((item) => {
      const info = statusInfo(item);
      return info.level === "danger";
    }).length;

    const ready = items.filter((item) => {
      const info = statusInfo(item);
      return info.level === "good";
    }).length;

    return { totalItems, active, lowStock, notReady, ready };
  }, [items, activeTreeCount]);

  const filteredItems = useMemo(() => {
    if (viewMode === "ALL") return items;

    return items.filter((item) => {
      const info = statusInfo(item);

      if (viewMode === "LOW") return info.level === "warning";
      if (viewMode === "READY") return info.level === "good";
      if (viewMode === "NOT_READY") return info.level === "danger";

      return true;
    });
  }, [items, viewMode, activeTreeCount]);

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Agarwood Inventory Intelligence</p>
          <h1>Inventory</h1>
          <span>
            Track supplies bought from Marketplace, check if your care supplies
            are enough for your trees, and spot low stock before subscribing care.
          </span>
        </div>

        <div className="heroCard">
          <p>Active Trees</p>
          <strong>{activeTreeCount}</strong>
          <small>Used for care supply calculation</small>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      {loading ? (
        <div className="empty">Loading inventory...</div>
      ) : (
        <>
          <section className="stats">
            <Card label="Total Items" value={String(stats.totalItems)} />
            <Card label="Active Items" value={String(stats.active)} />
            <Card label="Low Supply" value={String(stats.lowStock)} warning={stats.lowStock > 0} />
            <Card label="Not Ready" value={String(stats.notReady)} danger={stats.notReady > 0} />
          </section>

          <section className="filters">
            <button className={viewMode === "ALL" ? "active" : ""} onClick={() => setViewMode("ALL")}>
              All Supplies
            </button>
            <button className={viewMode === "READY" ? "active" : ""} onClick={() => setViewMode("READY")}>
              Ready
            </button>
            <button className={viewMode === "LOW" ? "active" : ""} onClick={() => setViewMode("LOW")}>
              Low Supply
            </button>
            <button className={viewMode === "NOT_READY" ? "active" : ""} onClick={() => setViewMode("NOT_READY")}>
              Not Ready
            </button>
          </section>

          <section className="panel">
            <div className="panelHead">
              <div>
                <h2>Inventory Records</h2>
                <p>
                  Connected to Marketplace supply purchases and My Trees care
                  subscription checker.
                </p>
              </div>
              <button onClick={loadInventory}>Refresh</button>
            </div>

            {items.length === 0 ? (
              <div className="empty small">
                No inventory records yet. Buy supplies from Marketplace first.
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="empty small">No supplies found for this filter.</div>
            ) : (
              <div className="list">
                {filteredItems.map((item) => {
                  const remaining = Number(item.remaining_qty || 0);
                  const starting = Number(item.starting_qty || 0);
                  const low = Number(item.low_stock_level || 0);
                  const weeklyNeed = weeklyNeedForItem(item);
                  const oneMonthNeed = weeklyNeed * 4;
                  const weeks = weeksRemaining(item);
                  const info = statusInfo(item);
                  const progress =
                    starting > 0 ? Math.max(0, Math.min(100, (remaining / starting) * 100)) : 0;

                  return (
                    <div className={`row ${info.level}`} key={item.id}>
                      <div className="left">
                        <div className="titleLine">
                          <strong>{item.item_name || "Inventory Item"}</strong>
                          <span className={`pill ${info.level}`}>{info.label}</span>
                        </div>

                        <p>
                          {item.category || "Uncategorized"} • {item.status || "AVAILABLE"}
                        </p>

                        <div className="progressTrack">
                          <i style={{ width: `${progress}%` }} />
                        </div>

                        <div className="metaGrid">
                          <small>
                            Starting: {pesoNumber(starting)} {item.unit || "unit"}
                          </small>
                          <small>
                            Low Level: {pesoNumber(low)} {item.unit || "unit"}
                          </small>
                          <small>
                            1 Week Need: {pesoNumber(weeklyNeed)} {item.unit || "unit"}
                          </small>
                          <small>
                            1 Month Need: {pesoNumber(oneMonthNeed)} {item.unit || "unit"}
                          </small>
                        </div>
                      </div>

                      <div className="qty">
                        <b>
                          {pesoNumber(remaining)} {item.unit || "unit"}
                        </b>

                        <span>
                          {weeks >= 999
                            ? "No care formula"
                            : `${weeks.toFixed(1)} week${weeks >= 2 ? "s" : ""} left`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="guide">
            <h2>Care Supply Formula</h2>
            <p>
              This page estimates if your supplies can support your trees. My Trees
              will use this same inventory logic before allowing weekly or monthly
              care subscription.
            </p>

            <div className="formulaGrid">
              <Formula label="Fertilizer" value="1 unit / tree / week" />
              <Formula label="Fungicide" value="0.5 unit / tree / week" />
              <Formula label="Insecticide" value="0.25 unit / tree / week" />
              <Formula label="Nutrients" value="0.5 unit / tree / week" />
              <Formula label="Soil Conditioner" value="0.5 unit / tree / week" />
            </div>
          </section>
        </>
      )}

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          padding: 30px;
          color: #18261d;
          font-family: Arial, Helvetica, sans-serif;
          background:
            radial-gradient(circle at 18% 5%, rgba(255, 226, 154, .55), transparent 24%),
            radial-gradient(circle at 92% 8%, rgba(255,255,255,.72), transparent 28%),
            linear-gradient(180deg, #f8f4eb 0%, #f3eadb 52%, #eadcc3 100%);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: stretch;
          gap: 18px;
          margin-bottom: 22px;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #8c6a3c;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
          font-size: 12px;
        }

        .hero h1 {
          margin: 0;
          font-size: 44px;
          color: #101a14;
          letter-spacing: -1.6px;
        }

        .hero span {
          display: block;
          margin-top: 8px;
          color: #5f665e;
          max-width: 820px;
          line-height: 1.6;
        }

        .heroCard {
          min-width: 260px;
          border-radius: 28px;
          padding: 22px;
          color: white;
          background:
            radial-gradient(circle at 80% 18%, rgba(214,178,94,.44), transparent 34%),
            linear-gradient(135deg, #244536, #10281f);
          box-shadow: 0 24px 56px rgba(36,69,54,.24);
        }

        .heroCard p {
          margin: 0;
          color: rgba(255,255,255,.72);
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .14em;
          font-size: 12px;
        }

        .heroCard strong {
          display: block;
          margin-top: 10px;
          font-size: 36px;
        }

        .heroCard small {
          color: rgba(255,255,255,.72);
          font-weight: 900;
        }

        .message,
        .empty,
        .card,
        .panel,
        .guide,
        .filters {
          border-radius: 26px;
          background: rgba(255,253,246,.88);
          border: 1px solid rgba(92,70,35,.08);
          box-shadow: 0 18px 42px rgba(82,60,27,.09);
        }

        .message,
        .empty {
          padding: 20px;
          margin-bottom: 18px;
          color: #31553d;
          font-weight: 900;
        }

        .small {
          box-shadow: none;
          border-radius: 18px;
          background: #f3ead8;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 18px;
        }

        .card {
          padding: 24px;
        }

        .card p {
          margin: 0;
          color: #6b6b62;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .card h3 {
          margin: 10px 0 0;
          color: #244536;
          font-size: 32px;
        }

        .card.warning h3 {
          color: #8c6a3c;
        }

        .card.danger h3 {
          color: #a33c2a;
        }

        .filters {
          padding: 12px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 18px;
        }

        .filters button {
          border: 0;
          border-radius: 999px;
          padding: 13px 14px;
          background: #f3ead8;
          color: #244536;
          font-weight: 900;
          cursor: pointer;
        }

        .filters button.active {
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
        }

        .panel {
          padding: 24px;
          margin-bottom: 18px;
        }

        .panelHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 18px;
        }

        .panelHead h2 {
          margin: 0;
          color: #101a14;
        }

        .panelHead p {
          margin: 6px 0 0;
          color: #6b6b62;
        }

        .panelHead button {
          border: 0;
          border-radius: 999px;
          padding: 12px 18px;
          background: #244536;
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .list {
          display: grid;
          gap: 12px;
        }

        .row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 16px;
          align-items: center;
          border-radius: 22px;
          background: #f3ead8;
          border: 1px solid rgba(92,70,35,.08);
          padding: 18px;
        }

        .row.good {
          border-color: rgba(49,85,61,.14);
        }

        .row.warning {
          border-color: rgba(214,178,94,.42);
        }

        .row.danger {
          border-color: rgba(163,60,42,.28);
        }

        .titleLine {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .row strong {
          color: #101a14;
          font-size: 17px;
        }

        .row p {
          margin: 7px 0 0;
          color: #6b6b62;
          font-size: 13px;
          font-weight: 800;
        }

        .pill {
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 900;
        }

        .pill.good {
          background: rgba(49,85,61,.12);
          color: #31553d;
        }

        .pill.warning {
          background: rgba(214,178,94,.20);
          color: #8c6a3c;
        }

        .pill.danger {
          background: rgba(163,60,42,.12);
          color: #a33c2a;
        }

        .progressTrack {
          height: 10px;
          border-radius: 999px;
          background: rgba(92,70,35,.10);
          overflow: hidden;
          margin-top: 13px;
        }

        .progressTrack i {
          display: block;
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(135deg, #244536, #d6b25e);
        }

        .metaGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-top: 12px;
        }

        .metaGrid small {
          color: #8c6a3c;
          font-size: 12px;
          font-weight: 900;
        }

        .qty {
          display: grid;
          justify-items: end;
          gap: 8px;
          min-width: 190px;
        }

        .qty b {
          color: #244536;
          font-size: 20px;
          text-align: right;
        }

        .qty span {
          border-radius: 999px;
          padding: 8px 10px;
          background: rgba(49,85,61,.12);
          color: #31553d;
          font-size: 11px;
          font-weight: 900;
          text-align: right;
        }

        .guide {
          padding: 24px;
        }

        .guide h2 {
          margin: 0;
          color: #101a14;
        }

        .guide p {
          color: #6b6b62;
          line-height: 1.6;
          font-weight: 800;
        }

        .formulaGrid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
          margin-top: 16px;
        }

        .formula {
          border-radius: 18px;
          background: #f3ead8;
          padding: 15px;
        }

        .formula span {
          display: block;
          color: #6b6b62;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .1em;
        }

        .formula strong {
          display: block;
          margin-top: 8px;
          color: #101a14;
        }

        @media (max-width: 1000px) {
          .hero,
          .stats,
          .filters,
          .row,
          .metaGrid,
          .formulaGrid {
            grid-template-columns: 1fr;
          }

          .hero {
            display: grid;
          }

          .heroCard {
            min-width: 0;
          }

          .qty {
            justify-items: start;
          }

          .qty b,
          .qty span {
            text-align: left;
          }
        }

        @media (max-width: 760px) {
          .page {
            padding: 18px;
          }

          .hero h1 {
            font-size: 36px;
          }
        }
      `}</style>
    </main>
  );
}

function Card({
  label,
  value,
  warning,
  danger,
}: {
  label: string;
  value: string;
  warning?: boolean;
  danger?: boolean;
}) {
  return (
    <div className={`card ${warning ? "warning" : ""} ${danger ? "danger" : ""}`}>
      <p>{label}</p>
      <h3>{value}</h3>
    </div>
  );
}

function Formula({ label, value }: { label: string; value: string }) {
  return (
    <div className="formula">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
