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

const weeklyNeeds: Record<string, number> = {
  Fertilizer: 1,
  Fungicide: 0.5,
  Insecticide: 0.25,
  Nutrients: 0.5,
  "Soil Conditioner": 0.5,
  Booster: 0.5,
};

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [treeCount, setTreeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadInventory() {
    setLoading(true);
    setMessage("");

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const email = user.email?.trim().toLowerCase() || "";

    const { data: profileById } = await supabase.from("profiles").select("id, email").eq("id", user.id).maybeSingle();
    const { data: profileByEmail } = await supabase.from("profiles").select("id, email").eq("email", email).maybeSingle();

    const profile = profileById || profileByEmail;

    if (!profile) {
      setMessage("Profile not found.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("inventory")
      .select("id, profile_id, tree_id, item_name, category, unit, starting_qty, remaining_qty, low_stock_level, status, created_at")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false });

    const { data: trees } = await supabase
      .from("trees")
      .select("id")
      .eq("profile_id", profile.id);

    if (error) {
      setMessage("Inventory table not found yet. Run the inventory SQL table first.");
      setItems([]);
      setLoading(false);
      return;
    }

    setTreeCount((trees || []).length);
    setItems(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadInventory();
  }, []);

  function weeklyRequired(category: string | null) {
    return (weeklyNeeds[category || ""] || 0) * Math.max(treeCount, 1);
  }

  function getWeeksRemaining(item: InventoryItem) {
    const remaining = Number(item.remaining_qty || 0);
    const need = weeklyRequired(item.category);
    if (need <= 0) return 999;
    return remaining / need;
  }

  const stats = useMemo(() => {
    const totalItems = items.length;
    const lowStock = items.filter((item) => {
      const remaining = Number(item.remaining_qty || 0);
      const low = Number(item.low_stock_level || 0);
      return low > 0 && remaining <= low;
    }).length;

    const notEnoughForWeek = items.filter((item) => getWeeksRemaining(item) < 1).length;
    const enoughForMonth = items.filter((item) => getWeeksRemaining(item) >= 4).length;

    return { totalItems, lowStock, notEnoughForWeek, enoughForMonth };
  }, [items, treeCount]);

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Agarwood Inventory Intelligence</p>
          <h1>Inventory</h1>
          <span>Track supplies, low stock, and care readiness for your owned trees.</span>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      {loading ? (
        <div className="empty">Loading inventory...</div>
      ) : (
        <>
          <section className="stats">
            <Card label="Total Items" value={String(stats.totalItems)} />
            <Card label="Low Stock" value={String(stats.lowStock)} />
            <Card label="Not Enough 1 Week" value={String(stats.notEnoughForWeek)} danger={stats.notEnoughForWeek > 0} />
            <Card label="Enough 1 Month" value={String(stats.enoughForMonth)} />
          </section>

          <section className="panel">
            <div className="panelHead">
              <div>
                <h2>Supply Readiness</h2>
                <p>Based on {treeCount} owned tree{treeCount === 1 ? "" : "s"} and weekly care requirements.</p>
              </div>
              <button onClick={loadInventory}>Refresh</button>
            </div>

            {items.length === 0 ? (
              <div className="empty small">No inventory records yet. Buy supplies from Marketplace.</div>
            ) : (
              <div className="list">
                {items.map((item) => {
                  const remaining = Number(item.remaining_qty || 0);
                  const low = Number(item.low_stock_level || 0);
                  const isLow = low > 0 && remaining <= low;
                  const weeks = getWeeksRemaining(item);
                  const weekNeed = weeklyRequired(item.category);
                  const status = weeks < 1 ? "Not enough for 1 week" : weeks < 4 ? "Enough for week only" : "Enough for 1 month+";

                  return (
                    <div className={`row ${isLow || weeks < 1 ? "low" : ""}`} key={item.id}>
                      <div>
                        <strong>{item.item_name || "Inventory Item"}</strong>
                        <p>{item.category || "Uncategorized"} • {item.status || "AVAILABLE"}</p>
                        <small>Weekly need estimate: {weekNeed.toLocaleString("en-PH")} {item.unit || "unit"} for your trees</small>
                      </div>

                      <div className="qty">
                        <b>{remaining.toLocaleString("en-PH")} {item.unit || "unit"}</b>
                        <span>{status}</span>
                        {isLow && <em>Low Supply</em>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <style>{`
        * { box-sizing: border-box; }
        .page { min-height: 100vh; padding: 30px; color: #18261d; font-family: Arial, Helvetica, sans-serif; background: radial-gradient(circle at 18% 5%, rgba(255,226,154,.55), transparent 24%), radial-gradient(circle at 92% 8%, rgba(255,255,255,.72), transparent 28%), linear-gradient(180deg, #f8f4eb 0%, #f3eadb 52%, #eadcc3 100%); }
        .hero { margin-bottom: 22px; }
        .eyebrow { margin: 0 0 8px; color: #8c6a3c; font-weight: 900; text-transform: uppercase; letter-spacing: .12em; font-size: 12px; }
        h1 { margin: 0; font-size: 44px; color: #101a14; letter-spacing: -1.6px; }
        .hero span { display: block; margin-top: 8px; color: #5f665e; max-width: 820px; line-height: 1.6; }
        .message, .empty, .card, .panel { border-radius: 26px; background: rgba(255,253,246,.88); border: 1px solid rgba(92,70,35,.08); box-shadow: 0 18px 42px rgba(82,60,27,.09); }
        .message, .empty { padding: 20px; margin-bottom: 18px; color: #31553d; font-weight: 900; }
        .small { box-shadow: none; border-radius: 18px; background: #f3ead8; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 18px; }
        .card { padding: 24px; }
        .card p { margin: 0; color: #6b6b62; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .12em; }
        .card h3 { margin: 10px 0 0; color: #244536; font-size: 32px; }
        .card.danger h3 { color: #a33c2a; }
        .panel { padding: 24px; }
        .panelHead { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 18px; }
        .panelHead h2 { margin: 0; color: #101a14; }
        .panelHead p { margin: 6px 0 0; color: #6b6b62; }
        .panelHead button { border: 0; border-radius: 999px; padding: 12px 18px; background: #244536; color: white; font-weight: 900; cursor: pointer; }
        .list { display: grid; gap: 12px; }
        .row { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: center; border-radius: 20px; background: #f3ead8; border: 1px solid rgba(92,70,35,.08); padding: 16px; }
        .row strong { color: #101a14; font-size: 16px; }
        .row p { margin: 6px 0 0; color: #6b6b62; font-size: 13px; font-weight: 800; }
        .row small { display: block; margin-top: 6px; color: #8c6a3c; font-weight: 800; }
        .qty { display: grid; justify-items: end; gap: 6px; }
        .qty b { color: #244536; }
        .qty span { border-radius: 999px; padding: 8px 10px; background: rgba(49,85,61,.12); color: #31553d; font-size: 11px; font-weight: 900; }
        .qty em { color: #a33c2a; font-size: 12px; font-weight: 900; font-style: normal; }
        .row.low .qty span { background: rgba(214,178,94,.20); color: #8c6a3c; }
        @media (max-width: 760px) { .page { padding: 18px; } .stats, .row { grid-template-columns: 1fr; } .qty { justify-items: start; } }
      `}</style>
    </main>
  );
}

function Card({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`card ${danger ? "danger" : ""}`}>
      <p>{label}</p>
      <h3>{value}</h3>
    </div>
  );
}
