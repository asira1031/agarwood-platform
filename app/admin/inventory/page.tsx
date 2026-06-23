"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type InventoryRow = {
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

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type TreeRow = {
  id: string;
  display_name: string | null;
  custom_name: string | null;
  tree_group_name: string | null;
};

export default function AdminInventoryPage() {
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    loadInventory();
  }, []);

  async function loadInventory() {
    setLoading(true);
    setErrorText("");

    const { data: inventoryRows, error: inventoryError } = await supabase
      .from("inventory")
      .select(
        "id, profile_id, tree_id, item_name, category, unit, starting_qty, remaining_qty, low_stock_level, status, created_at"
      )
      .order("created_at", { ascending: false });

    if (inventoryError) {
      setErrorText(inventoryError.message);
      setItems([]);
      setProfiles([]);
      setTrees([]);
      setLoading(false);
      return;
    }

    const rows = (inventoryRows || []) as InventoryRow[];

    const profileIds = Array.from(
      new Set(rows.map((item) => item.profile_id).filter(Boolean))
    ) as string[];

    const treeIds = Array.from(
      new Set(rows.map((item) => item.tree_id).filter(Boolean))
    ) as string[];

    let profileRows: ProfileRow[] = [];
    let treeRows: TreeRow[] = [];

    if (profileIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", profileIds);

      if (profileError) {
        setErrorText(profileError.message);
      } else {
        profileRows = (profileData || []) as ProfileRow[];
      }
    }

    if (treeIds.length > 0) {
      const { data: treeData, error: treeError } = await supabase
        .from("trees")
        .select("id, display_name, custom_name, tree_group_name")
        .in("id", treeIds);

      if (treeError) {
        setErrorText(treeError.message);
      } else {
        treeRows = (treeData || []) as TreeRow[];
      }
    }

    setItems(rows);
    setProfiles(profileRows);
    setTrees(treeRows);
    setLoading(false);
  }

  function getProfile(profileId: string | null) {
    return profiles.find((profile) => profile.id === profileId) || null;
  }

  function getTree(treeId: string | null) {
    return trees.find((tree) => tree.id === treeId) || null;
  }

  function friendlyTreeName(treeId: string | null) {
    const tree = getTree(treeId);

    if (!tree) return "Unassigned Tree";

    return (
      tree.custom_name ||
      tree.display_name ||
      tree.tree_group_name ||
      "Customer Tree"
    );
  }

  function formatDate(dateValue: string | null) {
    if (!dateValue) return "—";

    return new Date(dateValue).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function badgeClass(value: string | null) {
    const status = (value || "UNKNOWN").toUpperCase();

    if (status === "ACTIVE" || status === "AVAILABLE" || status === "OK") {
      return "border-emerald-400/30 bg-emerald-500/20 text-emerald-200";
    }

    if (status === "LOW_STOCK" || status === "LOW") {
      return "border-yellow-400/30 bg-yellow-500/20 text-yellow-200";
    }

    if (
      status === "OUT_OF_STOCK" ||
      status === "INACTIVE" ||
      status === "USED"
    ) {
      return "border-red-400/30 bg-red-500/20 text-red-200";
    }

    return "border-white/10 bg-white/10 text-white/60";
  }

  function isLowStock(item: InventoryRow) {
    const remaining = Number(item.remaining_qty || 0);
    const lowLevel = Number(item.low_stock_level || 0);

    if (lowLevel <= 0) return false;

    return remaining <= lowLevel;
  }

  const categories = useMemo(() => {
    const values = Array.from(
      new Set(items.map((item) => item.category).filter(Boolean))
    ) as string[];

    return values.sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const profile = getProfile(item.profile_id);
      const treeName = friendlyTreeName(item.tree_id);

      const matchesSearch =
        !query ||
        String(item.item_name || "").toLowerCase().includes(query) ||
        String(item.category || "").toLowerCase().includes(query) ||
        String(item.unit || "").toLowerCase().includes(query) ||
        String(profile?.full_name || "").toLowerCase().includes(query) ||
        String(profile?.email || "").toLowerCase().includes(query) ||
        String(treeName || "").toLowerCase().includes(query);

      const matchesCategory =
        categoryFilter === "ALL" ||
        String(item.category || "").toUpperCase() === categoryFilter;

      const matchesStatus =
        statusFilter === "ALL" ||
        String(item.status || "").toUpperCase() === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, profiles, trees, search, categoryFilter, statusFilter]);

  const totalItems = items.length;

  const lowStockCount = items.filter(isLowStock).length;

  const totalStartingQty = items.reduce(
    (sum, item) => sum + Number(item.starting_qty || 0),
    0
  );

  const totalRemainingQty = items.reduce(
    (sum, item) => sum + Number(item.remaining_qty || 0),
    0
  );

  return (
    <main className="min-h-screen text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8 rounded-3xl bg-[#071f16]/75 p-8 backdrop-blur-md border border-white/10 shadow-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
              Admin Inventory Center
            </p>

            <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
              Inventory Management
            </h1>

            <p className="mt-2 text-white/70">
              Monitor customer inventory, supplies, stock levels, and linked
              tree usage.
            </p>
          </div>

          <button
            onClick={loadInventory}
            disabled={loading}
            className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-5 py-3 text-sm font-semibold text-[#f7d774] hover:bg-[#d9b45f]/25 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh Inventory"}
          </button>
        </div>

        {errorText && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
            {errorText}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard label="Inventory Items" value={String(totalItems)} />
          <StatCard label="Low Stock Items" value={String(lowStockCount)} />
          <StatCard label="Starting Qty" value={String(totalStartingQty)} />
          <StatCard label="Remaining Qty" value={String(totalRemainingQty)} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/10 p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search item, customer, tree, category..."
              className="rounded-xl border border-white/10 bg-[#071f16]/70 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
            />

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#071f16]/70 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="ALL">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category.toUpperCase()}>
                  {category}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#071f16]/70 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="AVAILABLE">Available</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
              <option value="INACTIVE">Inactive</option>
              <option value="USED">Used</option>
            </select>
          </div>

          <p className="mt-3 text-sm text-white/55">
            Showing {filteredItems.length} of {items.length} inventory records.
          </p>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/10">
          {loading ? (
            <div className="p-8 text-white/70">Loading inventory records...</div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-white/70">No inventory records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px] text-left text-sm">
                <thead className="bg-[#071f16]/80 text-white/70">
                  <tr>
                    <th className="px-5 py-4">Item</th>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Tree</th>
                    <th className="px-5 py-4">Category</th>
                    <th className="px-5 py-4">Unit</th>
                    <th className="px-5 py-4">Starting</th>
                    <th className="px-5 py-4">Remaining</th>
                    <th className="px-5 py-4">Low Level</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Created</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredItems.map((item) => {
                    const profile = getProfile(item.profile_id);
                    const lowStock = isLowStock(item);

                    return (
                      <tr
                        key={item.id}
                        className="border-t border-white/10 hover:bg-white/5"
                      >
                        <td className="px-5 py-4">
                          <div className="font-bold text-white">
                            {item.item_name || "Unnamed Item"}
                          </div>
                          {lowStock && (
                            <div className="mt-1 text-xs font-semibold text-yellow-200">
                              Low stock warning
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-semibold text-white">
                            {profile?.full_name || "Unknown Customer"}
                          </div>
                          <div className="mt-1 text-xs text-white/45">
                            {profile?.email || "No email"}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-white/70">
                          {friendlyTreeName(item.tree_id)}
                        </td>

                        <td className="px-5 py-4 text-white/70">
                          {item.category || "—"}
                        </td>

                        <td className="px-5 py-4 text-white/70">
                          {item.unit || "—"}
                        </td>

                        <td className="px-5 py-4 font-semibold text-white">
                          {Number(item.starting_qty || 0)}
                        </td>

                        <td
                          className={`px-5 py-4 font-semibold ${
                            lowStock ? "text-yellow-200" : "text-[#f7d774]"
                          }`}
                        >
                          {Number(item.remaining_qty || 0)}
                        </td>

                        <td className="px-5 py-4 text-white/70">
                          {Number(item.low_stock_level || 0)}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(
                              item.status
                            )}`}
                          >
                            {(item.status || "UNKNOWN").toUpperCase()}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-white/70">
                          {formatDate(item.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
      <p className="text-sm text-white/70">{label}</p>
      <p className="mt-3 text-3xl font-bold text-[#d9b45f]">{value}</p>
    </div>
  );
}