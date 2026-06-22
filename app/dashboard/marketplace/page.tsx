"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProductType = "TREE" | "PACKAGE" | "TREE_PACKAGE" | "CARE_PACKAGE" | "SUPPLY";

type SupplyCategory =
  | "All Supplies"
  | "Fertilizers"
  | "Nutrients & Boosters"
  | "Fungicides"
  | "Pest Control"
  | "Soil Products"
  | "Tree Health"
  | "Tree Care Programs";

type MarketplaceProduct = {
  id: string;
  product_key: string | null;
  name: string | null;
  price: number | null;
  note: string | null;
  stock_status: string | null;
  icon: string | null;
  image_url?: string | null;
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

type InventoryItem = {
  id: string;
  profile_id: string | null;
  item_name: string | null;
  category: string | null;
  unit: string | null;
  remaining_qty: number | null;
  status: string | null;
};

const SUPPLY_CATEGORIES: SupplyCategory[] = [
  "All Supplies",
  "Fertilizers",
  "Nutrients & Boosters",
  "Fungicides",
  "Pest Control",
  "Soil Products",
  "Tree Health",
  "Tree Care Programs",
];

const TREE_ALLOWED_NAMES = ["agarwood seed", "agarwood seedling", "young seedling"];

const PACKAGE_ALLOWED_NAMES = [
  "10 seeds",
  "50 seeds",
  "100 seeds",
  "10 seedlings",
  "50 seedlings",
  "100 seedlings",
  "10 young seedlings",
  "50 young seedlings",
  "100 young seedlings",
];


function peso(value: number) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalize(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isTreeAllowed(product: MarketplaceProduct) {
  const type = String(product.product_type || "").trim().toUpperCase();
  const name = normalize(product.name);

  if (type !== "TREE") return false;

  return TREE_ALLOWED_NAMES.includes(name);
}

function isPackageAllowed(product: MarketplaceProduct) {
  const type = String(product.product_type || "").trim().toUpperCase();
  const name = normalize(product.name);

  if (type !== "PACKAGE") return false;

  return PACKAGE_ALLOWED_NAMES.includes(name);
}

function normalizeSupplyCategory(category: string | null | undefined): SupplyCategory {
  const raw = normalize(category);

  if (raw === "tree care programs" || raw.includes("care program") || raw.includes("program")) {
    return "Tree Care Programs";
  }

  if (raw === "fertilizers" || raw === "fertilizer" || raw.includes("fertilizer")) {
    return "Fertilizers";
  }

  if (
    raw === "nutrients & boosters" ||
    raw === "nutrients" ||
    raw === "boosters" ||
    raw.includes("nutrient") ||
    raw.includes("booster")
  ) {
    return "Nutrients & Boosters";
  }

  if (
    raw === "fungicides" ||
    raw === "fungicide" ||
    raw.includes("fungicide") ||
    raw.includes("anti-fungal") ||
    raw.includes("antifungal") ||
    raw.includes("fungal")
  ) {
    return "Fungicides";
  }

  if (
    raw === "pest control" ||
    raw.includes("pest") ||
    raw.includes("insecticide") ||
    raw.includes("insect")
  ) {
    return "Pest Control";
  }

  if (
    raw === "soil products" ||
    raw.includes("soil") ||
    raw.includes("compost") ||
    raw.includes("coco peat") ||
    raw.includes("coco")
  ) {
    return "Soil Products";
  }

  if (
    raw === "tree health" ||
    raw.includes("tree health") ||
    raw.includes("health") ||
    raw.includes("disease") ||
    raw.includes("recovery") ||
    raw.includes("root protection") ||
    raw.includes("protection")
  ) {
    return "Tree Health";
  }

  return "All Supplies";
}

function getProductType(product: MarketplaceProduct): ProductType {
  const type = String(product.product_type || "").toUpperCase();

  if (type === "PACKAGE") return "PACKAGE";
  if (type === "SUPPLY") return "SUPPLY";
  return "TREE";
}

function getProductIcon(product: MarketplaceProduct) {
  const type = getProductType(product);

  if (product.icon) return product.icon;
  if (type === "TREE") return "🌳";
  if (type === "PACKAGE") return "📦";
  if (normalizeSupplyCategory(product.category) === "Tree Care Programs") return "🌿";
  return "🌱";
}

function getPrimaryActionLabel(product: MarketplaceProduct) {
  const category = normalizeSupplyCategory(product.category);
  const type = getProductType(product);

  if (category === "Tree Care Programs") return "View Program";
  if (type === "TREE") return "View Tree";
  if (type === "PACKAGE") return "View Package";
  return "View Supply";
}

function getProgramDuration(product: MarketplaceProduct) {
  const name = normalize(product.name);
  const unit = normalize(product.unit);

  if (name.includes("1 week") || unit.includes("week")) return "1 Week";
  if (name.includes("premium")) return "Monthly Premium Care";
  return "Monthly Standard Care";
}

function getProgramSubscribeLabel(product: MarketplaceProduct) {
  const duration = getProgramDuration(product);

  return duration === "1 Week" ? "Subscribe Weekly" : "Subscribe Monthly";
}

function getProgramBenefits(product: MarketplaceProduct) {
  const name = normalize(product.name);

  if (name.includes("premium")) {
    return [
      "Premium fertilizer support",
      "Premium nutrients",
      "Fungicide protection",
      "Advanced pest control",
      "Tree health booster",
      "Plantation monitoring",
      "Priority support",
    ];
  }

  if (name.includes("standard")) {
    return [
      "Organic fertilizer support",
      "Tree nutrients",
      "Fungicide protection",
      "Pest control treatment",
      "Growth monitoring",
      "Tree health assessment",
    ];
  }

  return [
    "Organic fertilizer support",
    "Tree nutrients",
    "Basic tree health check",
    "Growth monitoring",
  ];
}

function getProgramCoverage(product: MarketplaceProduct) {
  const name = normalize(product.name);

  if (name.includes("premium")) {
    return [
      "Advanced managed care coverage",
      "Priority monitoring and support",
      "Premium protection and booster routine",
    ];
  }

  if (name.includes("standard")) {
    return [
      "Monthly managed care coverage",
      "Protection routine for common tree risks",
      "Health and growth monitoring",
    ];
  }

  return [
    "Short-term weekly care coverage",
    "Basic support for active tree maintenance",
    "Recommended for quick care request testing",
  ];
}

function getProgramRequirements(product: MarketplaceProduct) {
  const name = normalize(product.name);

  if (name.includes("premium")) {
    return [
      "Premium Fertilizer",
      "Premium Nutrients",
      "Fungicide",
      "Advanced Pest Control",
      "Tree Health Booster",
    ];
  }

  if (name.includes("standard")) {
    return ["Fertilizer", "Nutrients", "Fungicide", "Pest Control"];
  }

  return ["Fertilizer", "Nutrients"];
}

function inventoryNameMatchesRequirement(item: InventoryItem, requirement: string) {
  const itemName = normalize(item.item_name);
  const category = normalize(item.category);
  const target = normalize(requirement);

  if (target === "fertilizer") {
    return itemName.includes("fertilizer") || category.includes("fertilizer");
  }

  if (target === "nutrients") {
    return (
      itemName.includes("nutrient") ||
      itemName.includes("booster") ||
      category.includes("nutrient") ||
      category.includes("booster")
    );
  }

  if (target === "fungicide") {
    return (
      itemName.includes("fungicide") ||
      itemName.includes("anti-fungal") ||
      itemName.includes("antifungal") ||
      category.includes("fungicide") ||
      category.includes("fungal")
    );
  }

  if (target === "pest control") {
    return (
      itemName.includes("pest") ||
      itemName.includes("insecticide") ||
      category.includes("pest") ||
      category.includes("insecticide")
    );
  }

  if (target === "premium fertilizer") {
    return itemName.includes("premium") && itemName.includes("fertilizer");
  }

  if (target === "premium nutrients") {
    return (
      itemName.includes("premium") &&
      (itemName.includes("nutrient") || itemName.includes("booster"))
    );
  }

  if (target === "advanced pest control") {
    return (
      itemName.includes("advanced pest") ||
      itemName.includes("tree shield") ||
      itemName.includes("pest control") ||
      itemName.includes("insecticide")
    );
  }

  if (target === "tree health booster") {
    return itemName.includes("tree health booster") || itemName.includes("health booster");
  }

  return itemName.includes(target) || category.includes(target);
}

function checkProgramInventory(product: MarketplaceProduct, inventoryItems: InventoryItem[]) {
  const requirements = getProgramRequirements(product);

  const missingSupplies = requirements.filter((requirement) => {
    const totalAvailable = inventoryItems.reduce((sum, item) => {
      const isAvailable = normalize(item.status || "AVAILABLE") !== "used";
      const matches = inventoryNameMatchesRequirement(item, requirement);

      if (!isAvailable || !matches) return sum;

      return sum + Number(item.remaining_qty || 0);
    }, 0);

    return totalAvailable <= 0;
  });

  return {
    allowed: missingSupplies.length === 0,
    missingSupplies,
    requirements,
  };
}


function getPurchaseQuantity(product: MarketplaceProduct) {
  const name = normalize(product.name);
  const found = name.match(/^(\d+)/);

  if (found) return Number(found[1] || 1);

  return 1;
}

function getTreeStageFromProduct(product: MarketplaceProduct) {
  const name = normalize(product.name);

  if (name.includes("young seedling")) return "Young Seedling";
  if (name.includes("seedling")) return "Seedling";
  return "Seed";
}

function getTreeLabelFromProduct(product: MarketplaceProduct) {
  const name = normalize(product.name);

  if (name.includes("young seedling")) return "Young Seedling";
  if (name.includes("seedling")) return "Agarwood Seedling";
  return "Agarwood Seed";
}

function getStarterStockQty(product: MarketplaceProduct) {
  const quantity = getPurchaseQuantity(product);

  if (quantity >= 100) return 10;
  if (quantity >= 50) return 5;
  if (quantity >= 10) return 2;

  return 1;
}

function makeTreeCode() {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();

  return `AGW-${stamp}-${random}`;
}

function buildTreeRows(profileId: string, product: MarketplaceProduct, count: number) {
  const stage = getTreeStageFromProduct(product);
  const label = getTreeLabelFromProduct(product);

  return Array.from({ length: count }).map(() => ({
    profile_id: profileId,
    tree_code: makeTreeCode(),
    tree_type: label,
    stage,
    growth_stage: stage,
    current_stage: stage,
    status: "ACTIVE",
    source: "MARKETPLACE",
    purchase_price: Number(product.price || 0) / Math.max(count, 1),
    marketplace_product_id: product.id,
  }));
}

function buildMinimalTreeRows(profileId: string, product: MarketplaceProduct, count: number) {
  const label = getTreeLabelFromProduct(product);

  return Array.from({ length: count }).map(() => ({
    profile_id: profileId,
    tree_code: makeTreeCode(),
  }));
}

function getInventoryUnit(product: MarketplaceProduct) {
  const unit = String(product.unit || "").trim();

  if (unit) return unit;

  const category = normalizeSupplyCategory(product.category);

  if (category === "Tree Care Programs") return "Program";
  if (category === "Soil Products") return "Bag";

  return "Unit";
}

function getStarterInventoryRows(profileId: string, product: MarketplaceProduct) {
  const qty = getStarterStockQty(product);

  return [
    {
      profile_id: profileId,
      tree_id: null,
      item_name: "Starter Organic Fertilizer",
      category: "Fertilizers",
      unit: "Pack",
      starting_qty: qty,
      remaining_qty: qty,
      low_stock_level: 1,
      status: "AVAILABLE",
    },
    {
      profile_id: profileId,
      tree_id: null,
      item_name: "Starter Tree Nutrients",
      category: "Nutrients & Boosters",
      unit: "Pack",
      starting_qty: qty,
      remaining_qty: qty,
      low_stock_level: 1,
      status: "AVAILABLE",
    },
  ];
}

export default function MarketplacePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<ProductType>("TREE");
  const [activeSupplyCategory, setActiveSupplyCategory] =
    useState<SupplyCategory>("All Supplies");
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);
  const [selectedProgramAction, setSelectedProgramAction] = useState<"BUY_ONCE" | "SUBSCRIBE" | null>(null);
  const [inventoryCheckResult, setInventoryCheckResult] = useState<{
    allowed: boolean;
    missingSupplies: string[];
    requirements: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [purchaseProcessing, setPurchaseProcessing] = useState(false);

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
      .select(
        "id, product_key, name, price, note, stock_status, icon, image_url, category, unit, low_stock_level, product_type, status, created_at"
      )
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: true });

    if (productError) {
      setMessage(productError.message);
      setLoading(false);
      return;
    }

    const { data: inventoryRows } = await supabase
      .from("inventory")
      .select("id, profile_id, item_name, category, unit, remaining_qty, status")
      .eq("profile_id", currentProfile.id);

    setWallet((walletRows?.[0] as Wallet) || null);
    setProducts((productRows || []) as MarketplaceProduct[]);
    setInventoryItems((inventoryRows || []) as InventoryItem[]);
    setLoading(false);
  }

  useEffect(() => {
    loadMarketplace();
  }, []);

  const preparedProducts = useMemo(() => {
    return products.filter((product) => {
      const type = getProductType(product);

      if (type === "TREE") return isTreeAllowed(product);
      if (type === "PACKAGE") return isPackageAllowed(product);
      return type === "SUPPLY";
    });
  }, [products]);

  const stats = useMemo(() => {
    return {
      trees: preparedProducts.filter((p) => getProductType(p) === "TREE").length,
      treePackages: preparedProducts.filter((p) => getProductType(p) === "PACKAGE").length,
      carePackages: preparedProducts.filter((p) => normalizeSupplyCategory(p.category) === "Tree Care Programs").length,
      supplies: preparedProducts.filter(
        (p) => getProductType(p) === "SUPPLY" && normalizeSupplyCategory(p.category) !== "Tree Care Programs"
      ).length,
    };
  }, [preparedProducts]);

  const filteredProducts = useMemo(() => {
    return preparedProducts.filter((product) => {
      const type = getProductType(product);
      const category = normalizeSupplyCategory(product.category);

      if (activeTab === "TREE") return type === "TREE";
      if (activeTab === "TREE_PACKAGE") return type === "PACKAGE";
      if (activeTab === "CARE_PACKAGE") return category === "Tree Care Programs";

      if (activeTab === "SUPPLY") {
        if (type !== "SUPPLY") return false;
        if (category === "Tree Care Programs") return false;
        if (activeSupplyCategory === "All Supplies") return true;
        return category === activeSupplyCategory;
      }

      return false;
    });
  }, [preparedProducts, activeTab, activeSupplyCategory]);

  function openProductDetails(product: MarketplaceProduct) {
    setSelectedProduct(product);
    setSelectedProgramAction(null);
    setInventoryCheckResult(null);
  }

  function handleProgramAction(
    product: MarketplaceProduct,
    action: "BUY_ONCE" | "SUBSCRIBE"
  ) {
    const result = checkProgramInventory(product, inventoryItems);

    setSelectedProduct(product);
    setSelectedProgramAction(action);
    setInventoryCheckResult(result);
  }

  function closeModal() {
    setSelectedProduct(null);
    setSelectedProgramAction(null);
    setInventoryCheckResult(null);
  }


  async function deductWallet(amount: number) {
    if (!wallet) throw new Error("Wallet not found.");

    const currentBalance = Number(wallet.balance || 0);
    const newBalance = currentBalance - amount;

    if (newBalance < 0) {
      throw new Error("Insufficient wallet balance.");
    }

    const { error } = await supabase
      .from("wallets")
      .update({ balance: newBalance })
      .eq("id", wallet.id);

    if (error) throw error;

    setWallet({ ...wallet, balance: newBalance });

    return currentBalance;
  }

  async function restoreWallet(previousBalance: number) {
    if (!wallet) return;

    await supabase.from("wallets").update({ balance: previousBalance }).eq("id", wallet.id);
    setWallet({ ...wallet, balance: previousBalance });
  }

  async function createMarketplaceWalletTransaction(product: MarketplaceProduct, amount: number, productType: ProductType) {
    if (!profile) throw new Error("Profile not found.");

    const description = `Marketplace purchase: ${product.name || "Product"}`;

    const basePayload = {
      profile_id: profile.id,
      wallet_id: wallet?.id ?? null,
      amount: -Math.abs(amount),
      type: "DEBIT",
      transaction_type: "DEBIT",
      description,
      status: "COMPLETED",
      reference_id: product.id,
    };

    const attempts: Array<typeof basePayload & { category?: string }> = [
      { ...basePayload, category: `MARKETPLACE_${productType}` },
      { ...basePayload },
      { ...basePayload, amount: Math.abs(amount) },
    ];

    let lastError = "Marketplace wallet transaction failed.";

    for (const payload of attempts) {
      const { error } = await supabase.from("wallet_transactions").insert(payload);
      if (!error) return;
      lastError = error.message;
    }

    throw new Error(lastError);
  }

  async function addInventoryStock(product: MarketplaceProduct, quantity: number) {
    if (!profile) throw new Error("Profile not found.");

    const itemName = product.name || "Marketplace Supply";
    const category = product.category || normalizeSupplyCategory(product.category);
    const unit = getInventoryUnit(product);

    const existingItem = inventoryItems.find((item) => {
      return (
        normalize(item.item_name) === normalize(itemName) &&
        normalize(item.category) === normalize(category) &&
        normalize(item.unit) === normalize(unit)
      );
    });

    if (existingItem) {
      const newRemainingQty = Number(existingItem.remaining_qty || 0) + quantity;

      const { error } = await supabase
        .from("inventory")
        .update({
          remaining_qty: newRemainingQty,
          status: "AVAILABLE",
        })
        .eq("id", existingItem.id);

      if (error) throw error;

      return;
    }

    const fullPayload = {
      profile_id: profile.id,
      tree_id: null,
      item_name: itemName,
      category,
      unit,
      starting_qty: quantity,
      remaining_qty: quantity,
      low_stock_level: Number(product.low_stock_level || 1),
      status: "AVAILABLE",
    };

    const { error } = await supabase.from("inventory").insert(fullPayload);

    if (error) {
      const fallbackPayload = {
        profile_id: profile.id,
        item_name: itemName,
        category,
        unit,
        remaining_qty: quantity,
        status: "AVAILABLE",
      };

      const { error: fallbackError } = await supabase.from("inventory").insert(fallbackPayload);

      if (fallbackError) throw fallbackError;
    }
  }

  async function addStarterStock(product: MarketplaceProduct) {
    if (!profile) throw new Error("Profile not found.");

    const starterRows = getStarterInventoryRows(profile.id, product);

    const { error } = await supabase.from("inventory").insert(starterRows);

    if (error) {
      const fallbackRows = starterRows.map((row) => ({
        profile_id: row.profile_id,
        item_name: row.item_name,
        category: row.category,
        unit: row.unit,
        remaining_qty: row.remaining_qty,
        status: row.status,
      }));

      const { error: fallbackError } = await supabase.from("inventory").insert(fallbackRows);

      if (fallbackError) throw fallbackError;
    }
  }

  async function addTreesFromProduct(product: MarketplaceProduct, quantity: number) {
    if (!profile) throw new Error("Profile not found.");

    const fullRows = buildTreeRows(profile.id, product, quantity);
    const { error } = await supabase.from("trees").insert(fullRows);

    if (error) {
      const minimalRows = buildMinimalTreeRows(profile.id, product, quantity);
      const { error: fallbackError } = await supabase.from("trees").insert(minimalRows);

      if (fallbackError) throw fallbackError;
    }
  }

  async function purchaseProduct(product: MarketplaceProduct) {
    setMessage("");

    if (!profile) return setMessage("Profile not found.");
    if (!wallet) return setMessage("Wallet not found.");
    if (purchaseProcessing) return;

    const productType = getProductType(product);

    const price = Number(product.price || 0);
    const currentBalance = Number(wallet.balance || 0);

    if (price <= 0) return setMessage("Invalid product price.");
    if (currentBalance < price) return setMessage("Insufficient wallet balance.");

    setPurchaseProcessing(true);

    let previousBalance: number | null = null;

    try {
      previousBalance = await deductWallet(price);

      if (productType === "SUPPLY") {
        await addInventoryStock(product, 1);
        await createMarketplaceWalletTransaction(product, price, "SUPPLY");
        setMessage(`${product.name || "Supply"} purchased. Wallet deducted, transaction recorded, and inventory stock added.`);
      }

      if (productType === "TREE") {
        await addTreesFromProduct(product, 1);
        await createMarketplaceWalletTransaction(product, price, "TREE");
        setMessage(`${product.name || "Tree"} purchased. Wallet deducted, transaction recorded, and tree added.`);
      }

      if (productType === "PACKAGE") {
        const quantity = getPurchaseQuantity(product);
        await addTreesFromProduct(product, quantity);
        await addStarterStock(product);
        await createMarketplaceWalletTransaction(product, price, "TREE_PACKAGE");
        setMessage(`${product.name || "Tree Package"} purchased. Wallet deducted, transaction recorded, ${quantity} trees added, and starter stock added to inventory.`);
      }

      closeModal();
      await loadMarketplace();
    } catch (error: any) {
      if (previousBalance !== null) {
        await restoreWallet(previousBalance);
      }

      setMessage(error?.message || "Purchase failed. No stable purchase was completed.");
    } finally {
      setPurchaseProcessing(false);
    }
  }

  const selectedCategory = selectedProduct
    ? normalizeSupplyCategory(selectedProduct.category)
    : "All Supplies";

  return (
    <main className="page">
      <section className="hero">
        <div>
          <Link href="/dashboard" className="back">
            ← Back to Dashboard
          </Link>

          <p className="eyebrow">Agarwood Marketplace V5</p>
          <h1>Buy Trees, Tree Packages, Care Packages & Supplies</h1>
          <span>
            Choose Arganwood planting products, tree bundles, care packages, and care supplies.
            Marketplace purchases now deduct wallet, record wallet_transactions, and sync inventory or trees.
          </span>
        </div>

        <div className="walletCard">
          <p>Wallet Balance</p>
          <strong>{peso(Number(wallet?.balance || 0))}</strong>
          <small>{profile?.full_name || profile?.email || "Customer Account"}</small>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      <section className="tabs">
        <button
          className={activeTab === "TREE" ? "active" : ""}
          onClick={() => setActiveTab("TREE")}
        >
          <span className="tabIcon">🌳</span>
          <span>
            Buy Trees
            <small>{stats.trees} items</small>
          </span>
        </button>

        <button
          className={activeTab === "TREE_PACKAGE" ? "active" : ""}
          onClick={() => setActiveTab("TREE_PACKAGE")}
        >
          <span className="tabIcon">📦</span>
          <span>
            Tree Package
            <small>{stats.treePackages} items</small>
          </span>
        </button>

        <button
          className={activeTab === "CARE_PACKAGE" ? "active" : ""}
          onClick={() => setActiveTab("CARE_PACKAGE")}
        >
          <span className="tabIcon">🌿</span>
          <span>
            Care Package
            <small>{stats.carePackages} items</small>
          </span>
        </button>

        <button
          className={activeTab === "SUPPLY" ? "active" : ""}
          onClick={() => setActiveTab("SUPPLY")}
        >
          <span className="tabIcon">🌱</span>
          <span>
            Buy Supplies
            <small>{stats.supplies} items</small>
          </span>
        </button>
      </section>

      {loading ? (
        <div className="empty">Loading marketplace...</div>
      ) : (
        <section className={activeTab === "SUPPLY" ? "content suppliesMode" : "content"}>
          {activeTab === "SUPPLY" && (
            <aside className="sidebar">
              <div className="sidebarTitle">
                <b>Supply Categories</b>
                <small>Filter by care type</small>
              </div>

              <div className="categoryList">
                {SUPPLY_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    className={activeSupplyCategory === category ? "active" : ""}
                    onClick={() => setActiveSupplyCategory(category)}
                  >
                    {category === "All Supplies" && "🌱"}
                    {category === "Fertilizers" && "🧪"}
                    {category === "Nutrients & Boosters" && "⚡"}
                    {category === "Fungicides" && "🛡️"}
                    {category === "Pest Control" && "🐞"}
                    {category === "Soil Products" && "🪴"}
                    {category === "Tree Health" && "💚"}
                    {category === "Tree Care Programs" && "🌿"}
                    <span>{category}</span>
                  </button>
                ))}
              </div>
            </aside>
          )}

          <div className="productArea">
            <div className="sectionHead">
              <div>
                <p className="eyebrow small">
                  {activeTab === "TREE" && "Single planting items"}
                  {activeTab === "TREE_PACKAGE" && "Bulk planting bundles"}
                  {activeTab === "CARE_PACKAGE" && "Care program packages"}
                  {activeTab === "SUPPLY" && activeSupplyCategory}
                </p>
                <h2>
                  {activeTab === "TREE" && "Available Trees"}
                  {activeTab === "TREE_PACKAGE" && "Available Tree Packages"}
                  {activeTab === "CARE_PACKAGE" && "Available Care Packages"}
                  {activeTab === "SUPPLY" && "Available Supplies"}
                </h2>
              </div>

              <div className="modeNote">
                {activeTab === "TREE" && "Only Seed, Seedling, and Young Seedling."}
                {activeTab === "TREE_PACKAGE" && "Bulk tree quantities are separated here."}
                {activeTab === "CARE_PACKAGE" && "Care packages are separated from tree packages."}
                {activeTab === "SUPPLY" && "Supplies are grouped by sidebar category."}
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="empty">No products found for this section.</div>
            ) : (
              <div className="grid">
                {filteredProducts.map((product) => {
                  const type = getProductType(product);
                  const category = normalizeSupplyCategory(product.category);
                  const isProgram = category === "Tree Care Programs";

                  return (
                    <article className={isProgram ? "card programCard" : "card"} key={product.id}>
                      <div className="imageBox">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name || "Marketplace product"}
                          />
                        ) : (
                          <div className="icon">{getProductIcon(product)}</div>
                        )}
                        <span>{product.stock_status || "AVAILABLE"}</span>
                      </div>

                      <div className="cardHead">
                        <small>{type}</small>
                        <small>{product.unit || (isProgram ? "Program" : "Unit")}</small>
                      </div>

                      <h3>{product.name || "Marketplace Product"}</h3>

                      <p>{product.note || "Premium agarwood marketplace item."}</p>

                      <div className="priceRow">
                        <b>{peso(Number(product.price || 0))}</b>
                        <small>{product.category || type}</small>
                      </div>

                      {isProgram && (
                        <div className="programActions">
                          <button
                            type="button"
                            onClick={() => handleProgramAction(product, "BUY_ONCE")}
                          >
                            Buy Once
                          </button>
                          <button
                            type="button"
                            onClick={() => handleProgramAction(product, "SUBSCRIBE")}
                          >
                            {getProgramSubscribeLabel(product)}
                          </button>
                        </div>
                      )}

                      {!isProgram && (
                        <button
                          className="buyBtn"
                          disabled={purchaseProcessing}
                          onClick={() => purchaseProduct(product)}
                        >
                          {purchaseProcessing ? "Processing..." : `Buy Now • ${peso(Number(product.price || 0))}`}
                        </button>
                      )}

                      <button
                        className="viewBtn"
                        onClick={() => openProductDetails(product)}
                      >
                        {getPrimaryActionLabel(product)}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {selectedProduct && (
        <div className="modalOverlay" onClick={closeModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <button className="closeBtn" onClick={closeModal}>
              ×
            </button>

            <div className="modalIcon">
              {selectedProduct.image_url ? (
                <img
                  src={selectedProduct.image_url}
                  alt={selectedProduct.name || "Marketplace product"}
                />
              ) : (
                getProductIcon(selectedProduct)
              )}
            </div>

            <p className="eyebrow">Product Details</p>
            <h2>{selectedProduct.name || "Marketplace Product"}</h2>

            <div className="modalPrice">{peso(Number(selectedProduct.price || 0))}</div>

            <p className="modalNote">
              {selectedProduct.note || "No additional product description available."}
            </p>

            <div className="detailGrid">
              <div>
                <small>Type</small>
                <b>{getProductType(selectedProduct)}</b>
              </div>
              <div>
                <small>Category</small>
                <b>{selectedProduct.category || selectedCategory}</b>
              </div>
              <div>
                <small>Unit</small>
                <b>{selectedProduct.unit || "Unit"}</b>
              </div>
              <div>
                <small>Status</small>
                <b>{selectedProduct.stock_status || "AVAILABLE"}</b>
              </div>
            </div>

            {selectedCategory === "Tree Care Programs" && (
              <>
                {selectedProgramAction && inventoryCheckResult && (
                  <div
                    className={
                      inventoryCheckResult.allowed
                        ? "selectedActionBox allowedBox"
                        : "selectedActionBox blockedBox"
                    }
                  >
                    <small>
                      {inventoryCheckResult.allowed
                        ? "Inventory Check Passed"
                        : "Inventory Check Blocked"}
                    </small>
                    <b>
                      {selectedProgramAction === "BUY_ONCE"
                        ? "Buy Once"
                        : getProgramSubscribeLabel(selectedProduct)}
                    </b>
                    <p>
                      {inventoryCheckResult.allowed
                        ? "Required supplies are available. This is validation display only. Activate care programs from Tree Operations."
                        : "This care program cannot continue yet because required inventory supplies are missing or out of stock."}
                    </p>

                    {!inventoryCheckResult.allowed && (
                      <div className="missingBox">
                        <strong>Missing Supplies</strong>
                        <ul>
                          {inventoryCheckResult.missingSupplies.map((supply) => (
                            <li key={supply}>{supply}</li>
                          ))}
                        </ul>

                        <Link
                          href="/dashboard/marketplace"
                          className="buyMissingBtn"
                          onClick={() => {
                            setActiveTab("SUPPLY");
                            setActiveSupplyCategory("All Supplies");
                            closeModal();
                          }}
                        >
                          Buy Missing Supplies
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                <div className="programModalGrid">
                  <section className="programInfoBox requirementsBox">
                    <b>Required Inventory</b>
                    <ul>
                      {getProgramRequirements(selectedProduct).map((requirement) => (
                        <li key={requirement}>{requirement}</li>
                      ))}
                    </ul>
                  </section>

                  <section className="programInfoBox">
                    <b>Program Benefits</b>
                    <ul>
                      {getProgramBenefits(selectedProduct).map((benefit) => (
                        <li key={benefit}>{benefit}</li>
                      ))}
                    </ul>
                  </section>

                  <section className="programInfoBox">
                    <b>Program Coverage</b>
                    <ul>
                      {getProgramCoverage(selectedProduct).map((coverage) => (
                        <li key={coverage}>{coverage}</li>
                      ))}
                    </ul>
                  </section>

                  <section className="programInfoBox durationBox">
                    <b>Program Duration</b>
                    <strong>{getProgramDuration(selectedProduct)}</strong>
                    <p>
                      Buy Once and Subscribe are validation previews here. Actual care program activation belongs to Tree Operations.
                    </p>
                  </section>
                </div>

                <div className="careBox">
                  <b>Care Program Actions</b>
                  <p>
                    These buttons are still for care program inventory validation only. Care program activation stays in Tree Operations Step 6B. No marketplace billing, subscription table, auto-renew processing, cron job, or background job runs here.
                  </p>

                  <div className="careButtons">
                    <button
                      type="button"
                      onClick={() => handleProgramAction(selectedProduct, "BUY_ONCE")}
                    >
                      Buy Once
                    </button>
                    <button
                      type="button"
                      onClick={() => handleProgramAction(selectedProduct, "SUBSCRIBE")}
                    >
                      {getProgramSubscribeLabel(selectedProduct)}
                    </button>
                  </div>
                </div>
              </>
            )}

            {selectedCategory === "Tree Care Programs" ? (
              <button className="disabledBuy" disabled>
                Care Program activation belongs to Tree Operations Step 6B
              </button>
            ) : (
              <button
                className="buyBtn modalBuy"
                disabled={purchaseProcessing}
                onClick={() => purchaseProduct(selectedProduct)}
              >
                {purchaseProcessing
                  ? "Processing Purchase..."
                  : `Buy Now • ${peso(Number(selectedProduct.price || 0))}`}
              </button>
            )}
          </div>
        </div>
      )}

      <style>{`
        * {
          box-sizing: border-box;
        }

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

        .eyebrow.small {
          margin-bottom: 4px;
          font-size: 11px;
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
          max-width: 860px;
          line-height: 1.6;
          font-weight: 700;
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
        .sidebar,
        .card,
        .sectionHead {
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
          grid-template-columns: repeat(4, 1fr);
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
          gap: 12px;
          align-items: center;
          text-align: left;
        }

        .tabs button.active {
          background:
            radial-gradient(circle at 80% 15%, rgba(255, 222, 139, .28), transparent 36%),
            linear-gradient(135deg, #244536, #10281f);
          color: white;
        }

        .tabIcon {
          font-size: 26px;
        }

        .tabs button span:last-child {
          display: grid;
          gap: 3px;
        }

        .tabs small {
          color: inherit;
          opacity: .68;
          font-size: 12px;
        }

        .content {
          display: block;
        }

        .content.suppliesMode {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 16px;
          align-items: start;
        }

        .sidebar {
          padding: 16px;
          position: sticky;
          top: 18px;
        }

        .sidebarTitle {
          padding: 8px 8px 14px;
        }

        .sidebarTitle b {
          display: block;
          font-size: 18px;
          color: #10281f;
        }

        .sidebarTitle small {
          display: block;
          margin-top: 4px;
          color: #7a7568;
          font-weight: 800;
        }

        .categoryList {
          display: grid;
          gap: 8px;
        }

        .categoryList button {
          border: 0;
          border-radius: 16px;
          padding: 13px 12px;
          background: #f3ead8;
          color: #244536;
          display: flex;
          gap: 10px;
          align-items: center;
          cursor: pointer;
          font-weight: 900;
          text-align: left;
        }

        .categoryList button.active {
          background: #244536;
          color: white;
          box-shadow: 0 16px 30px rgba(36,69,54,.18);
        }

        .productArea {
          min-width: 0;
        }

        .sectionHead {
          padding: 18px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
        }

        .sectionHead h2 {
          margin: 0;
          font-size: 28px;
          color: #101a14;
        }

        .modeNote {
          border-radius: 999px;
          padding: 10px 14px;
          background: #f3ead8;
          color: #6b5635;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .06em;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .card {
          padding: 18px;
          transition: transform .18s ease, box-shadow .18s ease;
        }

        .card:hover {
          transform: translateY(-3px);
          box-shadow: 0 24px 56px rgba(82,60,27,.13);
        }

        .programCard {
          border-color: rgba(179, 129, 35, .24);
          background:
            radial-gradient(circle at 92% 8%, rgba(255, 221, 143, .38), transparent 30%),
            rgba(255,253,246,.92);
        }

        .imageBox {
          position: relative;
          height: 128px;
          border-radius: 24px;
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at 50% 28%, rgba(255,255,255,.64), transparent 34%),
            linear-gradient(135deg, #eee2c9, #f8f1df);
          margin-bottom: 16px;
          overflow: hidden;
        }

        .imageBox img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .imageBox span {
          position: absolute;
          top: 12px;
          right: 12px;
          border-radius: 999px;
          padding: 7px 10px;
          background: rgba(36,69,54,.12);
          color: #244536;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .08em;
        }

        .icon {
          font-size: 58px;
          filter: drop-shadow(0 10px 16px rgba(58,42,18,.18));
        }

        .cardHead {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          margin-bottom: 12px;
        }

        .cardHead small,
        .priceRow small {
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
          font-size: 21px;
          color: #101a14;
          line-height: 1.2;
        }

        .card p {
          min-height: 72px;
          color: #6b6b62;
          line-height: 1.5;
          font-weight: 800;
        }

        .priceRow {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          margin: 12px 0 14px;
        }

        .priceRow b {
          color: #244536;
          font-size: 24px;
        }

        .programActions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 12px;
        }

        .programActions button {
          border: 0;
          border-radius: 14px;
          padding: 10px;
          background: #f3ead8;
          color: #244536;
          font-size: 12px;
          font-weight: 900;
          text-align: center;
          cursor: pointer;
        }

        .programActions button:hover {
          background: #244536;
          color: white;
        }

        .viewBtn,
        .buyBtn,
        .disabledBuy,
        .careButtons button {
          width: 100%;
          border: 0;
          border-radius: 16px;
          padding: 14px;
          background: #244536;
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .buyBtn {
          margin-bottom: 8px;
          background: linear-gradient(135deg, #244536, #10281f);
        }

        .buyBtn:disabled {
          opacity: .58;
          cursor: not-allowed;
        }

        .modalBuy {
          margin-top: 4px;
          margin-bottom: 0;
        }

        .modalOverlay {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(10, 18, 13, .54);
          backdrop-filter: blur(8px);
        }

        .modal {
          position: relative;
          width: min(680px, 100%);
          max-height: 92vh;
          overflow: auto;
          border-radius: 32px;
          padding: 26px;
          background:
            radial-gradient(circle at 92% 8%, rgba(255, 222, 139, .38), transparent 28%),
            #fffdf6;
          box-shadow: 0 28px 80px rgba(0,0,0,.28);
          border: 1px solid rgba(92,70,35,.10);
        }

        .closeBtn {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 42px;
          height: 42px;
          border-radius: 999px;
          border: 0;
          background: #f3ead8;
          color: #244536;
          font-size: 26px;
          cursor: pointer;
          font-weight: 900;
        }

        .modalIcon {
          width: 96px;
          height: 96px;
          border-radius: 28px;
          display: grid;
          place-items: center;
          background: #f3ead8;
          font-size: 48px;
          margin-bottom: 16px;
          overflow: hidden;
        }

        .modalIcon img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .modal h2 {
          margin: 0;
          font-size: 34px;
          color: #101a14;
        }

        .modalPrice {
          margin: 12px 0;
          color: #244536;
          font-size: 32px;
          font-weight: 900;
        }

        .modalNote {
          color: #666257;
          line-height: 1.6;
          font-weight: 800;
        }

        .detailGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin: 18px 0;
        }

        .detailGrid div {
          border-radius: 18px;
          padding: 14px;
          background: #f3ead8;
        }

        .detailGrid small {
          display: block;
          color: #8c6a3c;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .08em;
          margin-bottom: 5px;
        }

        .detailGrid b {
          color: #10281f;
        }

        .selectedActionBox {
          border-radius: 22px;
          padding: 16px;
          background:
            radial-gradient(circle at 88% 12%, rgba(255, 222, 139, .42), transparent 32%),
            linear-gradient(135deg, rgba(36,69,54,.12), rgba(36,69,54,.04));
          border: 1px solid rgba(36,69,54,.12);
          margin-bottom: 16px;
        }

        .selectedActionBox small {
          display: block;
          color: #8c6a3c;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .10em;
          margin-bottom: 6px;
        }

        .selectedActionBox b {
          display: block;
          color: #10281f;
          font-size: 22px;
        }

        .allowedBox {
          border-color: rgba(49, 125, 72, .24);
          background:
            radial-gradient(circle at 88% 12%, rgba(176, 229, 188, .42), transparent 32%),
            linear-gradient(135deg, rgba(49,125,72,.14), rgba(49,125,72,.05));
        }

        .blockedBox {
          border-color: rgba(160, 72, 48, .24);
          background:
            radial-gradient(circle at 88% 12%, rgba(255, 205, 172, .42), transparent 32%),
            linear-gradient(135deg, rgba(160,72,48,.14), rgba(160,72,48,.05));
        }

        .selectedActionBox p {
          margin: 8px 0 0;
          color: #5f665e;
          font-weight: 800;
          line-height: 1.5;
        }

        .programModalGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin: 18px 0;
        }

        .programInfoBox {
          border-radius: 22px;
          padding: 16px;
          background: #f3ead8;
        }

        .programInfoBox b {
          display: block;
          color: #10281f;
          margin-bottom: 10px;
        }

        .programInfoBox ul {
          margin: 0;
          padding-left: 18px;
          color: #5f665e;
          font-weight: 800;
          line-height: 1.7;
        }

        .programInfoBox li {
          margin-bottom: 4px;
        }

        .requirementsBox {
          border: 1px solid rgba(36,69,54,.12);
          background:
            radial-gradient(circle at 92% 8%, rgba(255,255,255,.64), transparent 26%),
            #eef2df;
        }

        .missingBox {
          margin-top: 14px;
          border-radius: 18px;
          padding: 14px;
          background: rgba(255,253,246,.76);
          border: 1px solid rgba(160,72,48,.18);
        }

        .missingBox strong {
          color: #6f2f1f;
        }

        .missingBox ul {
          margin: 10px 0 14px;
          padding-left: 18px;
          color: #6f2f1f;
          font-weight: 900;
          line-height: 1.6;
        }

        .buyMissingBtn {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          border-radius: 14px;
          padding: 12px;
          background: #244536;
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .durationBox {
          grid-column: 1 / -1;
          background:
            radial-gradient(circle at 92% 10%, rgba(255,255,255,.62), transparent 26%),
            linear-gradient(135deg, #244536, #10281f);
          color: white;
        }

        .durationBox b,
        .durationBox strong,
        .durationBox p {
          color: white;
        }

        .durationBox strong {
          display: block;
          font-size: 26px;
          margin-bottom: 8px;
        }

        .durationBox p {
          margin: 0;
          opacity: .82;
          font-weight: 800;
          line-height: 1.5;
        }

        .careBox {
          border-radius: 22px;
          padding: 16px;
          background: rgba(36,69,54,.08);
          margin-bottom: 16px;
        }

        .careBox b {
          color: #10281f;
        }

        .careBox p {
          color: #5f665e;
          font-weight: 800;
          line-height: 1.5;
        }

        .careButtons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .careButtons button,
        .disabledBuy:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        @media (max-width: 1120px) {
          .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 880px) {
          .page {
            padding: 18px;
          }

          .hero,
          .tabs,
          .content.suppliesMode,
          .sectionHead,
          .grid,
          .detailGrid,
          .programModalGrid,
          .careButtons,
          .programActions {
            display: grid;
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 34px;
          }

          .walletCard {
            min-width: 0;
          }

          .sidebar {
            position: static;
          }

          .sectionHead {
            align-items: start;
          }
        }
      `}</style>
    </main>
  );
}
