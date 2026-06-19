"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  name: string;
  price: number;
  note: string;
  stock: string;
  icon: string;
  category: string;
  unit: string;
  low_stock_level: number;
};

const products: Product[] = [
  {
    name: "Organic Fertilizer",
    price: 350,
    note: "Supports soil nutrition and steady agarwood growth.",
    stock: "Available",
    icon: "🌱",
    category: "Fertilizer",
    unit: "Bag",
    low_stock_level: 5,
  },
  {
    name: "Growth Booster",
    price: 480,
    note: "For stronger young tree development.",
    stock: "Available",
    icon: "🪴",
    category: "Booster",
    unit: "Bottle",
    low_stock_level: 5,
  },
  {
    name: "Insecticide",
    price: 420,
    note: "Helps protect trees from harmful insects.",
    stock: "Available",
    icon: "🛡️",
    category: "Insecticide",
    unit: "Bottle",
    low_stock_level: 3,
  },
  {
    name: "Fungicide",
    price: 450,
    note: "For fungal prevention and treatment support.",
    stock: "Available",
    icon: "🍃",
    category: "Fungicide",
    unit: "Bottle",
    low_stock_level: 3,
  },
  {
    name: "Soil Conditioner",
    price: 390,
    note: "Improves soil quality around planted trees.",
    stock: "Available",
    icon: "🌾",
    category: "Soil Conditioner",
    unit: "Bag",
    low_stock_level: 5,
  },
  {
    name: "Tree Nutrients",
    price: 520,
    note: "General nutrient support for agarwood care.",
    stock: "Available",
    icon: "💧",
    category: "Nutrients",
    unit: "Bottle",
    low_stock_level: 5,
  },
  {
    name: "Disease Prevention Kit",
    price: 850,
    note: "Preventive package for common tree issues.",
    stock: "Limited",
    icon: "🧪",
    category: "Disease Prevention",
    unit: "Kit",
    low_stock_level: 2,
  },
];

function peso(value: number) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function MarketplacePage() {
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
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
      let activeProfile: Profile | null = null;

      const { data: profileById } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", user.id)
        .limit(1)
        .maybeSingle();

      if (profileById) {
        activeProfile = profileById as Profile;
      } else if (email) {
        const { data: profileByEmail } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("email", email)
          .limit(1)
          .maybeSingle();

        activeProfile = (profileByEmail as Profile) || null;
      }

      if (!activeProfile) {
        setErrorMessage("Profile not found. Please contact support.");
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

      setWallet((walletRows?.[0] as Wallet) || null);
    } catch (error: any) {
      console.error("Marketplace load error:", error);
      setErrorMessage(error?.message || "Unable to load marketplace.");
    } finally {
      setLoading(false);
    }
  }

  function getQty(productName: string) {
    return quantities[productName] || 1;
  }

  function updateQty(productName: string, value: number) {
    const safeValue = Math.max(1, Number(value || 1));
    setQuantities((prev) => ({
      ...prev,
      [productName]: safeValue,
    }));
  }

  async function buyProduct(product: Product) {
    try {
      setBuying(product.name);
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

      const qty = getQty(product.name);
      const total = product.price * qty;
      const currentBalance = Number(wallet.balance || 0);

      if (currentBalance < total) {
        setErrorMessage(
          `Insufficient wallet balance. Needed ${peso(total)}, available ${peso(
            currentBalance
          )}.`
        );
        return;
      }

      const newBalance = currentBalance - total;

      const { error: walletUpdateError } = await supabase
        .from("wallets")
        .update({ balance: newBalance })
        .eq("id", wallet.id);

      if (walletUpdateError) throw walletUpdateError;

      const { error: transactionError } = await supabase
        .from("wallet_transactions")
        .insert({
          profile_id: profile.id,
          transaction_type: "MARKETPLACE_PURCHASE",
          amount: total,
          status: "COMPLETED",
          description: `Purchased ${qty} ${product.unit}(s) of ${product.name}`,
        });

      if (transactionError) throw transactionError;

      const { data: existingRows, error: inventoryFindError } = await supabase
        .from("inventory")
        .select("*")
        .eq("profile_id", profile.id)
        .eq("item_name", product.name)
        .eq("category", product.category)
        .is("tree_id", null)
        .limit(1);

      if (inventoryFindError) throw inventoryFindError;

      const existingItem = existingRows?.[0];

      if (existingItem) {
        const currentStarting = Number(existingItem.starting_qty || 0);
        const currentRemaining = Number(existingItem.remaining_qty || 0);

        const { error: inventoryUpdateError } = await supabase
          .from("inventory")
          .update({
            starting_qty: currentStarting + qty,
            remaining_qty: currentRemaining + qty,
            status: "AVAILABLE",
          })
          .eq("id", existingItem.id);

        if (inventoryUpdateError) throw inventoryUpdateError;
      } else {
        const { error: inventoryInsertError } = await supabase
          .from("inventory")
          .insert({
            profile_id: profile.id,
            tree_id: null,
            item_name: product.name,
            category: product.category,
            unit: product.unit,
            starting_qty: qty,
            remaining_qty: qty,
            low_stock_level: product.low_stock_level,
            status: "AVAILABLE",
          });

        if (inventoryInsertError) throw inventoryInsertError;
      }

      setWallet((prev) => (prev ? { ...prev, balance: newBalance } : prev));
      setMessage(
        `${product.name} added to inventory. Wallet deducted ${peso(total)}.`
      );
    } catch (error: any) {
      console.error("Purchase error:", error);
      setErrorMessage(error?.message || "Purchase failed.");
    } finally {
      setBuying(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#061b12] p-8 text-[#f8e7b5]">
      <section className="rounded-[32px] border border-[#d6b76c]/30 bg-[radial-gradient(circle_at_top,#123f2b,#061b12_60%)] p-8 shadow-2xl">
        <div className="mb-8 flex items-start justify-between gap-6">
          <div>
            <Link
              href="/dashboard"
              className="mb-5 inline-block text-sm font-semibold text-[#d6b76c] hover:text-white"
            >
              ← Back to Dashboard
            </Link>

            <h1 className="text-5xl font-bold text-[#f8e7b5]">
              Marketplace
            </h1>
            <p className="mt-2 text-lg italic text-[#d6b76c]">
              Premium Products for Healthy Agarwood Growth
            </p>
          </div>

          <div className="rounded-3xl border border-[#d6b76c]/40 bg-[#0b2b1c]/90 px-8 py-6 shadow-xl">
            <p className="text-xs font-bold tracking-widest text-[#d6b76c]">
              WALLET BALANCE
            </p>
            <h2 className="mt-2 text-3xl font-bold text-[#f8e7b5]">
              {loading ? "Loading..." : peso(Number(wallet?.balance || 0))}
            </h2>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-green-400/40 bg-green-900/30 px-5 py-4 text-sm font-bold text-green-200">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-400/40 bg-red-900/30 px-5 py-4 text-sm font-bold text-red-200">
            {errorMessage}
          </div>
        )}

        <div className="mb-10 rounded-3xl border border-[#d6b76c]/30 bg-[#0b2b1c]/80 p-6">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#d6b76c] text-4xl">
              🛒
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#f8e7b5]">
                Marketplace purchase adds stock to Inventory.
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-[#cabf9a]">
                Buying supplies deducts your wallet, creates a wallet transaction,
                then inserts or updates your inventory remaining quantity.
              </p>
            </div>
          </div>
        </div>

        <h2 className="mb-6 text-2xl font-bold text-[#d6b76c]">
          Available Products
        </h2>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {products.map((item) => {
            const qty = getQty(item.name);
            const total = item.price * qty;
            const isBuying = buying === item.name;

            return (
              <div
                key={item.name}
                className="group overflow-hidden rounded-3xl border border-[#d6b76c]/30 bg-[#082417]/90 p-5 shadow-xl transition hover:-translate-y-1 hover:border-[#f4d47d]"
              >
                <div className="mb-5 flex h-40 items-center justify-center rounded-2xl bg-gradient-to-br from-[#143d28] to-[#03150d] text-7xl shadow-inner">
                  {item.icon}
                </div>

                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="text-2xl font-bold text-[#f8e7b5]">
                    {item.name}
                  </h3>

                  <span className="rounded-full bg-[#1b5133] px-3 py-1 text-xs font-bold text-[#d6b76c]">
                    {item.stock}
                  </span>
                </div>

                <p className="min-h-[48px] text-sm text-[#cabf9a]">
                  {item.note}
                </p>

                <div className="mt-5 rounded-2xl border border-[#d6b76c]/20 bg-[#061b12]/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#d6b76c]">
                        Unit Price
                      </p>
                      <p className="mt-1 text-2xl font-bold text-[#f4d47d]">
                        {peso(item.price)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-bold uppercase tracking-widest text-[#d6b76c]">
                        Unit
                      </p>
                      <p className="mt-1 font-bold text-[#f8e7b5]">
                        {item.unit}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-4">
                    <label className="text-sm font-bold text-[#cabf9a]">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={qty}
                      onChange={(e) => updateQty(item.name, Number(e.target.value))}
                      className="w-24 rounded-xl border border-[#d6b76c]/30 bg-[#0b2b1c] px-3 py-2 text-center font-bold text-[#f8e7b5] outline-none"
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-[#d6b76c]/20 pt-4">
                    <span className="text-sm font-bold text-[#cabf9a]">
                      Total
                    </span>
                    <strong className="text-xl text-[#f4d47d]">
                      {peso(total)}
                    </strong>
                  </div>
                </div>

                <button
                  onClick={() => buyProduct(item)}
                  disabled={loading || isBuying}
                  className="mt-5 w-full rounded-xl bg-gradient-to-r from-[#315f33] to-[#1f7a43] px-4 py-3 text-sm font-bold text-[#f8e7b5] shadow-lg transition hover:from-[#3f7a42] hover:to-[#24a85b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isBuying ? "Processing..." : "🛒 Add to Inventory"}
                </button>
              </div>
            );
          })}
        </section>
      </section>
    </main>
  );
}