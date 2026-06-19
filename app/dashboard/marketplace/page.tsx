"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProductType = "TREE" | "PACKAGE" | "SUPPLY";

type MarketplaceProduct = {
  id: string;
  product_key: string | null;
  name: string | null;
  price: number | null;
  note: string | null;
  stock_status: string | null;
  icon: string | null;
  category: string | null;
  unit: string | null;
  low_stock_level: number | null;
  product_type: string | null;
  status: string | null;
  created_at: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type Wallet = {
  id: string;
  profile_id: string;
  balance: number | null;
};

function peso(value: number) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function makeTreeCode() {
  return `AGW-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
}

function packageTreeCount(product: MarketplaceProduct) {
  const name = String(product.name || "").toLowerCase();
  const note = String(product.note || "").toLowerCase();

  if (name.includes("investor") || note.includes("20 trees")) return 20;
  if (name.includes("plantation") || note.includes("100 trees")) return 100;
  return 5;
}

function packageSupplyBundle(product: MarketplaceProduct) {
  const count = packageTreeCount(product);

  if (count >= 100) {
    return [
      { name: "Organic Fertilizer", category: "Fertilizer", unit: "Bag", qty: 240, low_stock_level: 30 },
      { name: "Fungicide", category: "Fungicide", unit: "Bottle", qty: 100, low_stock_level: 20 },
      { name: "Tree Nutrients", category: "Nutrients", unit: "Bottle", qty: 100, low_stock_level: 25 },
      { name: "Insecticide", category: "Insecticide", unit: "Bottle", qty: 60, low_stock_level: 15 },
      { name: "Soil Conditioner", category: "Soil Conditioner", unit: "Bag", qty: 100, low_stock_level: 20 },
    ];
  }

  if (count >= 20) {
    return [
      { name: "Organic Fertilizer", category: "Fertilizer", unit: "Bag", qty: 45, low_stock_level: 10 },
      { name: "Fungicide", category: "Fungicide", unit: "Bottle", qty: 20, low_stock_level: 6 },
      { name: "Tree Nutrients", category: "Nutrients", unit: "Bottle", qty: 20, low_stock_level: 8 },
      { name: "Insecticide", category: "Insecticide", unit: "Bottle", qty: 10, low_stock_level: 5 },
    ];
  }

  return [
    { name: "Organic Fertilizer", category: "Fertilizer", unit: "Bag", qty: 10, low_stock_level: 5 },
    { name: "Fungicide", category: "Fungicide", unit: "Bottle", qty: 5, low_stock_level: 3 },
    { name: "Tree Nutrients", category: "Nutrients", unit: "Bottle", qty: 5, low_stock_level: 5 },
  ];
}

export default function MarketplacePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [inventoryQty, setInventoryQty] = useState(0);
  const [activeTab, setActiveTab] = useState<ProductType>("TREE");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState("");
  const [message, setMessage] = useState("");

  async function loadMarketplace() {
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
      .select("id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", email)
      .maybeSingle();

    const currentProfile = profileById || profileByEmail;

    if (!currentProfile) {
      setMessage("Profile not found.");
      setLoading(false);
      return;
    }

    setProfile(currentProfile);

    const { data: walletRows } = await supabase
      .from("wallets")
      .select("id, profile_id, balance")
      .eq("profile_id", currentProfile.id)
      .limit(1);

    const { data: productRows, error: productError } = await supabase
      .from("marketplace_products")
      .select("id, product_key, name, price, note, stock_status, icon, category, unit, low_stock_level, product_type, status, created_at")
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: true });

    if (productError) {
      setMessage(productError.message);
      setLoading(false);
      return;
    }

    const { data: inventoryRows } = await supabase
      .from("inventory")
      .select("remaining_qty")
      .eq("profile_id", currentProfile.id);

    const totalInventory = (inventoryRows || []).reduce(
      (sum, item: any) => sum + Number(item.remaining_qty || 0),
      0
    );

    setWallet((walletRows?.[0] as Wallet) || null);
    setProducts((productRows || []) as MarketplaceProduct[]);
    setInventoryQty(totalInventory);
    setLoading(false);
  }

  useEffect(() => {
    loadMarketplace();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const type = String(product.product_type || "").toUpperCase();
      return type === activeTab;
    });
  }, [products, activeTab]);

  const stats = useMemo(() => {
    return {
      trees: products.filter((p) => String(p.product_type || "").toUpperCase() === "TREE").length,
      packages: products.filter((p) => String(p.product_type || "").toUpperCase() === "PACKAGE").length,
      supplies: products.filter((p) => String(p.product_type || "").toUpperCase() === "SUPPLY").length,
    };
  }, [products]);

  function getQty(id: string) {
    return quantities[id] || 1;
  }

  function updateQty(id: string, value: number) {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(1, Number(value || 1)),
    }));
  }

  async function deductWallet(amount: number, transactionType: string, description: string) {
    if (!profile) throw new Error("Profile not found.");
    if (!wallet) throw new Error("Wallet not found. Please cash in first.");

    const currentBalance = Number(wallet.balance || 0);

    if (currentBalance < amount) {
      throw new Error(`Insufficient wallet balance. Needed ${peso(amount)}, available ${peso(currentBalance)}.`);
    }

    const newBalance = currentBalance - amount;

    const { error: walletError } = await supabase
      .from("wallets")
      .update({ balance: newBalance })
      .eq("id", wallet.id);

    if (walletError) throw walletError;

    const { error: txError } = await supabase.from("wallet_transactions").insert({
      profile_id: profile.id,
      transaction_type: transactionType,
      amount,
      status: "COMPLETED",
      description,
    });

    if (txError) throw txError;

    setWallet((prev) => (prev ? { ...prev, balance: newBalance } : prev));
  }

  async function addInventoryStock(input: {
    name: string;
    category: string;
    unit: string;
    qty: number;
    low_stock_level: number;
  }) {
    if (!profile) throw new Error("Profile not found.");

    const { data: existingRows, error: findError } = await supabase
      .from("inventory")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("item_name", input.name)
      .eq("category", input.category)
      .is("tree_id", null)
      .limit(1);

    if (findError) throw findError;

    const existing = existingRows?.[0];

    if (existing) {
      const { error } = await supabase
        .from("inventory")
        .update({
          starting_qty: Number(existing.starting_qty || 0) + input.qty,
          remaining_qty: Number(existing.remaining_qty || 0) + input.qty,
          status: "AVAILABLE",
        })
        .eq("id", existing.id);

      if (error) throw error;
    } else {
      const { error } = await supabase.from("inventory").insert({
        profile_id: profile.id,
        tree_id: null,
        item_name: input.name,
        category: input.category,
        unit: input.unit,
        starting_qty: input.qty,
        remaining_qty: input.qty,
        low_stock_level: input.low_stock_level,
        status: "AVAILABLE",
      });

      if (error) throw error;
    }
  }

  async function buySupply(product: MarketplaceProduct) {
    if (!profile) return;

    const qty = getQty(product.id);
    const total = Number(product.price || 0) * qty;

    await deductWallet(
      total,
      "MARKETPLACE_PURCHASE",
      `Purchased ${qty} ${product.unit || "unit"} of ${product.name || "Supply"}`
    );

    await addInventoryStock({
      name: product.name || "Supply",
      category: product.category || "Supply",
      unit: product.unit || "Unit",
      qty,
      low_stock_level: Number(product.low_stock_level || 0),
    });
  }

  async function buyTree(product: MarketplaceProduct) {
    if (!profile) return;

    const price = Number(product.price || 0);

    await deductWallet(
      price,
      "TREE_PURCHASE",
      `Purchased ${product.name || "Agarwood Tree"}`
    );

    const { error } = await supabase.from("trees").insert({
      profile_id: profile.id,
      tree_code: makeTreeCode(),
      display_name: product.name || "Agarwood Tree",
      current_stage: "Seedling",
      estimated_value: Math.round(price * 1.2),
      purchase_price: price,
      care_cost: 0,
      verification_cost: 0,
      ownership_status: "OWNED",
      availability_status: "OWNED",
      tree_group_name: "Ungrouped Trees",
      package_name: null,
    });

    if (error) throw error;
  }

  async function buyPackage(product: MarketplaceProduct) {
    if (!profile) return;

    const price = Number(product.price || 0);
    const treeCount = packageTreeCount(product);
    const perTreePrice = treeCount > 0 ? price / treeCount : price;

    await deductWallet(
      price,
      "PACKAGE_PURCHASE",
      `Purchased ${product.name || "Agarwood Package"}`
    );

    const treeRows = Array.from({ length: treeCount }).map((_, index) => ({
      profile_id: profile.id,
      tree_code: makeTreeCode(),
      display_name: `${product.name || "Package"} Tree ${index + 1}`,
      current_stage: "Seedling",
      estimated_value: Math.round(perTreePrice * 1.2),
      purchase_price: perTreePrice,
      care_cost: 0,
      verification_cost: 0,
      ownership_status: "OWNED",
      availability_status: "OWNED",
      tree_group_name: product.name || "Package",
      package_name: product.name || "Package",
    }));

    const { error: treeError } = await supabase.from("trees").insert(treeRows);
    if (treeError) throw treeError;

    for (const supply of packageSupplyBundle(product)) {
      await addInventoryStock(supply);
    }
  }

  async function handleBuy(product: MarketplaceProduct) {
    setBuying(product.id);
    setMessage("");

    try {
      const type = String(product.product_type || "").toUpperCase();

      if (type === "TREE") await buyTree(product);
      if (type === "PACKAGE") await buyPackage(product);
      if (type === "SUPPLY") await buySupply(product);

      setMessage(`${product.name || "Product"} purchased successfully.`);
      await loadMarketplace();
    } catch (error: any) {
      setMessage(error?.message || "Purchase failed.");
    } finally {
      setBuying("");
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <Link href="/dashboard" className="back">
            ← Back to Dashboard
          </Link>
          <p className="eyebrow">Agarwood Marketplace</p>
          <h1>Marketplace</h1>
          <span>
            Buy trees, packages, and supplies. Purchases update your wallet,
            inventory, My Trees, and investment records.
          </span>
        </div>

        <div className="walletCard">
          <p>Wallet Balance</p>
          <strong>{peso(Number(wallet?.balance || 0))}</strong>
          <small>Inventory Qty: {inventoryQty.toLocaleString("en-PH")}</small>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      <section className="tabs">
        <button className={activeTab === "TREE" ? "active" : ""} onClick={() => setActiveTab("TREE")}>
          🌳 Buy Trees <span>{stats.trees}</span>
        </button>
        <button className={activeTab === "PACKAGE" ? "active" : ""} onClick={() => setActiveTab("PACKAGE")}>
          📦 Buy Packages <span>{stats.packages}</span>
        </button>
        <button className={activeTab === "SUPPLY" ? "active" : ""} onClick={() => setActiveTab("SUPPLY")}>
          🌱 Buy Supplies <span>{stats.supplies}</span>
        </button>
      </section>

      {loading ? (
        <div className="empty">Loading marketplace...</div>
      ) : filteredProducts.length === 0 ? (
        <div className="empty">No {activeTab.toLowerCase()} products found.</div>
      ) : (
        <section className="grid">
          {filteredProducts.map((product) => {
            const type = String(product.product_type || "").toUpperCase();
            const qty = getQty(product.id);
            const total = type === "SUPPLY" ? Number(product.price || 0) * qty : Number(product.price || 0);
            const isBuying = buying === product.id;

            return (
              <article className="card" key={product.id}>
                <div className="icon">{product.icon || (type === "TREE" ? "🌳" : type === "PACKAGE" ? "📦" : "🌱")}</div>

                <div className="cardHead">
                  <span>{type}</span>
                  <small>{product.stock_status || "AVAILABLE"}</small>
                </div>

                <h3>{product.name || "Product"}</h3>
                <p>{product.note || "Marketplace product"}</p>
                <b>{peso(Number(product.price || 0))}</b>

                <div className="meta">
                  <small>{product.category || type}</small>
                  <small>{product.unit || "Unit"}</small>
                </div>

                {type === "SUPPLY" && (
                  <div className="qty">
                    <button onClick={() => updateQty(product.id, qty - 1)}>-</button>
                    <input
                      type="number"
                      value={qty}
                      onChange={(event) => updateQty(product.id, Number(event.target.value))}
                    />
                    <button onClick={() => updateQty(product.id, qty + 1)}>+</button>
                  </div>
                )}

                {type === "PACKAGE" && (
                  <div className="packageInfo">
                    <strong>{packageTreeCount(product)} Trees Included</strong>
                    <span>Starter supplies will be added to Inventory.</span>
                  </div>
                )}

                <button className="buy" disabled={isBuying} onClick={() => handleBuy(product)}>
                  {isBuying ? "Processing..." : `Buy ${peso(total)}`}
                </button>
              </article>
            );
          })}
        </section>
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
          text-transform: uppercase;
          letter-spacing: .12em;
          font-size: 12px;
        }

        h1 {
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
        .empty,
        .tabs,
        .card {
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

        .tabs {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          padding: 12px;
          margin-bottom: 18px;
        }

        .tabs button {
          border: 0;
          border-radius: 20px;
          padding: 16px;
          background: #f3ead8;
          color: #244536;
          font-weight: 900;
          cursor: pointer;
          display: flex;
          justify-content: center;
          gap: 10px;
          align-items: center;
        }

        .tabs button.active {
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
        }

        .tabs span {
          border-radius: 999px;
          padding: 4px 8px;
          background: rgba(255,255,255,.22);
          font-size: 12px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .card {
          padding: 22px;
        }

        .icon {
          height: 120px;
          border-radius: 24px;
          display: grid;
          place-items: center;
          font-size: 58px;
          background: #f3ead8;
          margin-bottom: 16px;
        }

        .cardHead {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          margin-bottom: 12px;
        }

        .cardHead span,
        .cardHead small,
        .meta small {
          border-radius: 999px;
          padding: 7px 10px;
          background: rgba(49,85,61,.10);
          color: #244536;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .card h3 {
          margin: 0;
          font-size: 22px;
          color: #101a14;
        }

        .card p {
          color: #6b6b62;
          line-height: 1.5;
          font-weight: 800;
        }

        .card b {
          display: block;
          color: #244536;
          font-size: 24px;
          margin: 12px 0;
        }

        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 14px;
        }

        .qty {
          display: grid;
          grid-template-columns: 44px 1fr 44px;
          gap: 8px;
          margin: 16px 0;
        }

        .qty button,
        .buy {
          border: 0;
          border-radius: 14px;
          background: #244536;
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .qty input {
          width: 100%;
          border: 1px solid rgba(92,70,35,.12);
          border-radius: 14px;
          padding: 12px;
          text-align: center;
          font-weight: 900;
        }

        .packageInfo {
          border-radius: 18px;
          padding: 14px;
          background: #f3ead8;
          margin: 14px 0;
        }

        .packageInfo strong {
          display: block;
          color: #101a14;
        }

        .packageInfo span {
          display: block;
          margin-top: 6px;
          color: #6b6b62;
          font-size: 13px;
          font-weight: 800;
        }

        .buy {
          width: 100%;
          padding: 14px;
          margin-top: 10px;
        }

        .buy:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        @media (max-width: 980px) {
          .hero,
          .tabs,
          .grid {
            display: grid;
            grid-template-columns: 1fr;
          }

          .walletCard {
            min-width: 0;
          }
        }
      `}</style>
    </main>
  );
}
