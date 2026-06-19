"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type Wallet = {
  id: string;
  profile_id: string;
  balance: number | null;
  created_at: string | null;
};

type Product = {
  id: string;
  product_key: string | null;
  name: string;
  price: number | null;
  note: string | null;
  stock_status: string | null;
  icon: string | null;
  category: string | null;
  unit: string | null;
  low_stock_level: number | null;
  product_type: string | null;
  status: string | null;
};

type InventoryItem = {
  id: string;
  item_name: string | null;
  category: string | null;
  unit: string | null;
  starting_qty: number | null;
  remaining_qty: number | null;
  status: string | null;
};

export default function MarketplacePage() {
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadMarketplace();
  }, []);

  async function loadMarketplace() {
    try {
      setLoading(true);
      setMessage("");
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const email = user.email?.trim().toLowerCase() || "";

      const { data: profileById } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", user.id)
        .maybeSingle();

      const { data: profileByEmail } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("email", email)
        .maybeSingle();

      const activeProfile = profileById || profileByEmail;

      if (!activeProfile) {
        setErrorMessage("Profile not found. Please contact support.");
        setLoading(false);
        return;
      }

      setProfile(activeProfile);

      const { data: walletRows, error: walletError } = await supabase
        .from("wallets")
        .select("id, profile_id, balance, created_at")
        .eq("profile_id", activeProfile.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (walletError) throw walletError;

      const { data: productData, error: productError } = await supabase
        .from("marketplace_products")
        .select(
          "id, product_key, name, price, note, stock_status, icon, category, unit, low_stock_level, product_type, status"
        )
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: true });

      if (productError) throw productError;

      const { data: inventoryData, error: inventoryError } = await supabase
        .from("inventory")
        .select("id, item_name, category, unit, starting_qty, remaining_qty, status")
        .eq("profile_id", activeProfile.id)
        .is("tree_id", null)
        .order("created_at", { ascending: false });

      if (inventoryError) throw inventoryError;

      setWallet((walletRows?.[0] as Wallet) || null);
      setProducts((productData || []) as Product[]);
      setInventory((inventoryData || []) as InventoryItem[]);
    } catch (error: any) {
      setErrorMessage(error?.message || "Unable to load marketplace.");
    } finally {
      setLoading(false);
    }
  }

  function getQty(productId: string) {
    return quantities[productId] || 1;
  }

  function updateQty(productId: string, value: number) {
    setQuantities((prev) => ({
      ...prev,
      [productId]: Math.max(1, Number(value || 1)),
    }));
  }

  async function buyProduct(product: Product) {
    try {
      setBuying(product.id);
      setMessage("");
      setErrorMessage("");

      if (!profile) {
        setErrorMessage("Profile not loaded.");
        return;
      }

      if (!wallet) {
        setErrorMessage("Wallet not found. Please cash in first.");
        return;
      }

      const qty = getQty(product.id);
      const unitPrice = Number(product.price || 0);
      const total = unitPrice * qty;
      const currentBalance = Number(wallet.balance || 0);

      if (unitPrice <= 0) {
        setErrorMessage("Invalid product price.");
        return;
      }

      if (currentBalance < total) {
        setErrorMessage(`Insufficient wallet balance. Needed ${peso(total)}, available ${peso(currentBalance)}.`);
        return;
      }

      const newBalance = currentBalance - total;

      const { error: walletUpdateError } = await supabase
        .from("wallets")
        .update({ balance: newBalance })
        .eq("id", wallet.id);

      if (walletUpdateError) throw walletUpdateError;

      const { error: transactionError } = await supabase.from("wallet_transactions").insert({
        profile_id: profile.id,
        transaction_type: "MARKETPLACE_PURCHASE",
        amount: total,
        status: "COMPLETED",
        reference_no: product.id,
        description: `Purchased ${qty} ${product.unit || "Unit"}(s) of ${product.name}`,
      });

      if (transactionError) {
        await supabase.from("wallets").update({ balance: currentBalance }).eq("id", wallet.id);
        throw transactionError;
      }

      const { data: existingRows, error: inventoryFindError } = await supabase
        .from("inventory")
        .select("id, starting_qty, remaining_qty")
        .eq("profile_id", profile.id)
        .eq("item_name", product.name)
        .eq("category", product.category || "Supply")
        .is("tree_id", null)
        .limit(1);

      if (inventoryFindError) {
        await supabase.from("wallets").update({ balance: currentBalance }).eq("id", wallet.id);
        throw inventoryFindError;
      }

      const existingItem = existingRows?.[0];

      if (existingItem) {
        const { error: inventoryUpdateError } = await supabase
          .from("inventory")
          .update({
            starting_qty: Number(existingItem.starting_qty || 0) + qty,
            remaining_qty: Number(existingItem.remaining_qty || 0) + qty,
            status: "AVAILABLE",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingItem.id);

        if (inventoryUpdateError) {
          await supabase.from("wallets").update({ balance: currentBalance }).eq("id", wallet.id);
          throw inventoryUpdateError;
        }
      } else {
        const { error: inventoryInsertError } = await supabase.from("inventory").insert({
          profile_id: profile.id,
          tree_id: null,
          item_name: product.name,
          category: product.category || "Supply",
          unit: product.unit || "Unit",
          starting_qty: qty,
          remaining_qty: qty,
          low_stock_level: Number(product.low_stock_level || 0),
          status: "AVAILABLE",
        });

        if (inventoryInsertError) {
          await supabase.from("wallets").update({ balance: currentBalance }).eq("id", wallet.id);
          throw inventoryInsertError;
        }
      }

      setWallet((prev) => (prev ? { ...prev, balance: newBalance } : prev));
      setQuantities((prev) => ({ ...prev, [product.id]: 1 }));
      setMessage(`${product.name} added to inventory. Wallet deducted ${peso(total)}.`);

      await loadMarketplace();
    } catch (error: any) {
      setErrorMessage(error?.message || "Purchase failed.");
    } finally {
      setBuying(null);
    }
  }

  const totalInventoryItems = useMemo(() => {
    return inventory.reduce((sum, item) => sum + Number(item.remaining_qty || 0), 0);
  }, [inventory]);

  return (
    <main className="page">
      <section className="hero">
        <div>
          <Link href="/dashboard" className="back">← Back to Dashboard</Link>
          <p className="eyebrow">Agarwood Marketplace</p>
          <h1>Supply Store</h1>
          <span>
            Buy real care supplies for your agarwood operation. Purchases deduct your wallet,
            create wallet ledger records, and add stock to your inventory.
          </span>
        </div>

        <div className="walletCard">
          <p>Wallet Balance</p>
          <strong>{loading ? "Loading..." : peso(Number(wallet?.balance || 0))}</strong>
          <small>Inventory Items: {totalInventoryItems}</small>
        </div>
      </section>

      {message && <div className="message">{message}</div>}
      {errorMessage && <div className="error">{errorMessage}</div>}

      {loading ? (
        <div className="empty">Loading marketplace...</div>
      ) : (
        <>
          <section className="infoPanel">
            <div className="infoIcon">🛒</div>
            <div>
              <h2>Marketplace purchase adds stock to Inventory.</h2>
              <p>
                Caretaker/gardener usage will later deduct from this inventory when they
                apply fertilizer, fungicide, insecticide, nutrients, or other care supplies.
              </p>
            </div>
          </section>

          <section className="stats">
            <Stat label="Products" value={String(products.length)} />
            <Stat label="Inventory Qty" value={String(totalInventoryItems)} />
            <Stat label="Wallet" value={peso(Number(wallet?.balance || 0))} />
          </section>

          <section className="grid">
            {products.length === 0 ? (
              <div className="empty">No marketplace products found. Add rows in marketplace_products.</div>
            ) : (
              products.map((item) => {
                const qty = getQty(item.id);
                const price = Number(item.price || 0);
                const total = price * qty;
                const isBuying = buying === item.id;

                return (
                  <div key={item.id} className="card">
                    <div className="iconBox">{item.icon || "🌿"}</div>

                    <div className="cardTop">
                      <div>
                        <h3>{item.name}</h3>
                        <p>{item.note || "No description added."}</p>
                      </div>
                      <span>{item.stock_status || "AVAILABLE"}</span>
                    </div>

                    <div className="priceBox">
                      <div>
                        <small>Unit Price</small>
                        <strong>{peso(price)}</strong>
                      </div>
                      <div>
                        <small>Unit</small>
                        <strong>{item.unit || "Unit"}</strong>
                      </div>
                    </div>

                    <div className="qtyRow">
                      <label>Quantity</label>
                      <input
                        type="number"
                        min={1}
                        value={qty}
                        onChange={(e) => updateQty(item.id, Number(e.target.value))}
                      />
                    </div>

                    <div className="totalRow">
                      <span>Total</span>
                      <strong>{peso(total)}</strong>
                    </div>

                    <button onClick={() => buyProduct(item)} disabled={isBuying}>
                      {isBuying ? "Processing..." : "Add to Inventory"}
                    </button>
                  </div>
                );
              })
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
          display: flex;
          justify-content: space-between;
          align-items: stretch;
          gap: 18px;
          margin-bottom: 22px;
        }

        .back {
          display: inline-block;
          margin-bottom: 12px;
          color: #8c6a3c;
          font-weight: 900;
          text-decoration: none;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #8c6a3c;
          font-weight: 900;
          letter-spacing: .5px;
          text-transform: uppercase;
          font-size: 12px;
        }

        .hero h1 {
          margin: 0;
          font-size: 44px;
          letter-spacing: -1.6px;
          color: #101a14;
        }

        .hero span {
          display: block;
          margin-top: 8px;
          color: #5f665e;
          font-size: 15px;
          max-width: 850px;
          line-height: 1.6;
        }

        .walletCard {
          min-width: 290px;
          border-radius: 28px;
          padding: 22px;
          color: white;
          background:
            radial-gradient(circle at 80% 18%, rgba(214,178,94,.44), transparent 34%),
            linear-gradient(135deg, #244536, #10281f);
          box-shadow: 0 24px 56px rgba(36,69,54,.24);
        }

        .walletCard p {
          margin: 0;
          color: rgba(255,255,255,.72);
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .14em;
          font-size: 12px;
        }

        .walletCard strong {
          display: block;
          margin-top: 10px;
          font-size: 30px;
        }

        .walletCard small {
          color: rgba(255,255,255,.72);
          font-weight: 900;
        }

        .message,
        .error,
        .empty,
        .infoPanel,
        .stat,
        .card {
          border-radius: 26px;
          background: rgba(255,253,246,.88);
          border: 1px solid rgba(92,70,35,.08);
          box-shadow: 0 18px 42px rgba(82,60,27,.09);
        }

        .message,
        .error,
        .empty {
          padding: 20px;
          margin-bottom: 18px;
          font-weight: 900;
        }

        .message { color: #31553d; }
        .error { color: #a33c2a; }

        .infoPanel {
          display: flex;
          gap: 18px;
          align-items: center;
          padding: 22px;
          margin-bottom: 18px;
        }

        .infoIcon {
          width: 76px;
          height: 76px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 34px;
          background: #f3ead8;
        }

        .infoPanel h2 {
          margin: 0;
          color: #101a14;
        }

        .infoPanel p {
          margin: 8px 0 0;
          color: #6b6b62;
          line-height: 1.6;
          font-weight: 800;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 18px;
        }

        .stat {
          padding: 22px;
        }

        .stat p {
          margin: 0;
          color: #6b6b62;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .stat h3 {
          margin: 10px 0 0;
          color: #244536;
          font-size: 28px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
        }

        .card {
          padding: 20px;
        }

        .iconBox {
          height: 150px;
          border-radius: 22px;
          display: grid;
          place-items: center;
          font-size: 68px;
          background: linear-gradient(135deg, #244536, #10281f);
          margin-bottom: 16px;
        }

        .cardTop {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: start;
        }

        .card h3 {
          margin: 0;
          font-size: 22px;
          color: #101a14;
        }

        .card p {
          margin: 8px 0 0;
          color: #6b6b62;
          line-height: 1.5;
          font-weight: 800;
          min-height: 45px;
        }

        .cardTop span {
          border-radius: 999px;
          padding: 8px 10px;
          color: #8c6a3c;
          background: rgba(214,178,94,.20);
          font-size: 11px;
          font-weight: 900;
        }

        .priceBox {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 16px;
        }

        .priceBox div,
        .qtyRow,
        .totalRow {
          border-radius: 18px;
          padding: 14px;
          background: #f3ead8;
          border: 1px solid rgba(92,70,35,.08);
        }

        small,
        label,
        .totalRow span {
          display: block;
          color: #6b6b62;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .1em;
        }

        .priceBox strong,
        .totalRow strong {
          display: block;
          margin-top: 7px;
          color: #101a14;
          font-size: 18px;
        }

        .qtyRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-top: 12px;
        }

        input {
          width: 92px;
          border: 1px solid rgba(92,70,35,.14);
          border-radius: 12px;
          padding: 10px;
          text-align: center;
          background: rgba(255,253,246,.94);
          color: #101a14;
          outline: none;
          font-weight: 900;
        }

        .totalRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 12px;
        }

        button {
          width: 100%;
          margin-top: 14px;
          border: 0;
          border-radius: 16px;
          padding: 14px;
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        @media (max-width: 1100px) {
          .hero {
            flex-direction: column;
          }

          .walletCard {
            min-width: 100%;
          }

          .grid,
          .stats {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 760px) {
          .page {
            padding: 18px;
          }

          .hero h1 {
            font-size: 34px;
          }

          .grid,
          .stats {
            grid-template-columns: 1fr;
          }

          .infoPanel {
            flex-direction: column;
            align-items: start;
          }
        }
      `}</style>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <p>{label}</p>
      <h3>{value}</h3>
    </div>
  );
}

function peso(value: number) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}