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

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

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

    const { data, error } = await supabase
      .from("inventory")
      .select(
        "id, profile_id, tree_id, item_name, category, unit, starting_qty, remaining_qty, low_stock_level, status, created_at"
      )
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(
        "Inventory table not found yet. Run the inventory SQL table first."
      );
      setItems([]);
      setLoading(false);
      return;
    }

    setItems(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadInventory();
  }, []);

  const stats = useMemo(() => {
    const totalItems = items.length;
    const lowStock = items.filter((item) => {
      const remaining = Number(item.remaining_qty || 0);
      const low = Number(item.low_stock_level || 0);
      return low > 0 && remaining <= low;
    }).length;

    const active = items.filter(
      (item) => (item.status || "ACTIVE").toUpperCase() === "ACTIVE"
    ).length;

    return { totalItems, lowStock, active };
  }, [items]);

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Agarwood Inventory</p>
          <h1>Inventory</h1>
          <span>
            Track fertilizer, fungicide, insecticide, soil conditioner, and tree
            care supplies connected to your account.
          </span>
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
            <Card label="Low Stock" value={String(stats.lowStock)} />
          </section>

          <section className="panel">
            <div className="panelHead">
              <div>
                <h2>Inventory Records</h2>
                <p>Real inventory data from Supabase.</p>
              </div>
              <button onClick={loadInventory}>Refresh</button>
            </div>

            {items.length === 0 ? (
              <div className="empty small">
                No inventory records yet. Once admin adds supplies for this
                customer, they will appear here.
              </div>
            ) : (
              <div className="list">
                {items.map((item) => {
                  const remaining = Number(item.remaining_qty || 0);
                  const low = Number(item.low_stock_level || 0);
                  const isLow = low > 0 && remaining <= low;

                  return (
                    <div className={`row ${isLow ? "low" : ""}`} key={item.id}>
                      <div>
                        <strong>{item.item_name || "Inventory Item"}</strong>
                        <p>
                          {item.category || "Uncategorized"} •{" "}
                          {item.status || "ACTIVE"}
                        </p>
                      </div>

                      <div className="qty">
                        <b>
                          {remaining.toLocaleString("en-PH")}{" "}
                          {item.unit || "unit"}
                        </b>
                        <span>{isLow ? "Low Stock" : "Available"}</span>
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

        .message,
        .empty,
        .card,
        .panel {
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
          grid-template-columns: repeat(3, 1fr);
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

        .panel {
          padding: 24px;
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
          border-radius: 20px;
          background: #f3ead8;
          border: 1px solid rgba(92,70,35,.08);
          padding: 16px;
        }

        .row strong {
          color: #101a14;
          font-size: 16px;
        }

        .row p {
          margin: 6px 0 0;
          color: #6b6b62;
          font-size: 13px;
          font-weight: 800;
        }

        .qty {
          display: grid;
          justify-items: end;
          gap: 6px;
        }

        .qty b {
          color: #244536;
        }

        .qty span {
          border-radius: 999px;
          padding: 8px 10px;
          background: rgba(49,85,61,.12);
          color: #31553d;
          font-size: 11px;
          font-weight: 900;
        }

        .row.low .qty span {
          background: rgba(214,178,94,.20);
          color: #8c6a3c;
        }

        @media (max-width: 760px) {
          .page {
            padding: 18px;
          }

          .stats,
          .row {
            grid-template-columns: 1fr;
          }

          .qty {
            justify-items: start;
          }
        }
      `}</style>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p>{label}</p>
      <h3>{value}</h3>
    </div>
  );
}