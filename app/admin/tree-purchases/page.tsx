"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TreePurchaseRequest = {
  id: string;
  profile_id: string | null;
  tree_type: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_amount: number | null;
  status: string | null;
  created_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type WalletRow = {
  id: string;
  profile_id: string | null;
  balance: number | null;
  created_at: string | null;
};

type TabKey = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

export default function AdminTreePurchasesPage() {
  const [requests, setRequests] = useState<TreePurchaseRequest[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<TabKey>("PENDING");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const { data: requestRows, error: requestError } = await supabase
      .from("tree_purchase_requests")
      .select(
        "id, profile_id, tree_type, quantity, unit_price, total_amount, status, created_at"
      )
      .order("created_at", { ascending: false });

    if (requestError) {
      setMessage(requestError.message);
      setRequests([]);
      setLoading(false);
      return;
    }

    const profileIds = Array.from(
      new Set((requestRows || []).map((item) => item.profile_id).filter(Boolean))
    ) as string[];

    let profileRows: ProfileRow[] = [];
    let walletRows: WalletRow[] = [];

    if (profileIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", profileIds);

      if (profileError) {
        setMessage(profileError.message);
      } else {
        profileRows = (profileData || []) as ProfileRow[];
      }

      const { data: walletData, error: walletError } = await supabase
        .from("wallets")
        .select("id, profile_id, balance, created_at")
        .in("profile_id", profileIds)
        .order("created_at", { ascending: false });

      if (walletError) {
        setMessage(walletError.message);
      } else {
        walletRows = (walletData || []) as WalletRow[];
      }
    }

    setRequests((requestRows || []) as TreePurchaseRequest[]);
    setProfiles(profileRows);
    setWallets(walletRows);
    setLoading(false);
  }

  const pendingRequests = useMemo(() => {
    return requests.filter(
      (request) => String(request.status || "PENDING").toUpperCase() === "PENDING"
    );
  }, [requests]);

  const approvedRequests = useMemo(() => {
    return requests.filter(
      (request) => String(request.status || "").toUpperCase() === "APPROVED"
    );
  }, [requests]);

  const rejectedRequests = useMemo(() => {
    return requests.filter(
      (request) => String(request.status || "").toUpperCase() === "REJECTED"
    );
  }, [requests]);

  const activeRequests = useMemo(() => {
    if (tab === "PENDING") return pendingRequests;
    if (tab === "APPROVED") return approvedRequests;
    if (tab === "REJECTED") return rejectedRequests;
    return requests;
  }, [tab, requests, pendingRequests, approvedRequests, rejectedRequests]);

  const pendingAmount = pendingRequests.reduce(
    (sum, request) => sum + Number(request.total_amount || 0),
    0
  );

  const approvedAmount = approvedRequests.reduce(
    (sum, request) => sum + Number(request.total_amount || 0),
    0
  );

  function getProfile(profileId: string | null) {
    return profiles.find((profile) => profile.id === profileId) || null;
  }

  function getLatestWallet(profileId: string | null) {
    return wallets.find((wallet) => wallet.profile_id === profileId) || null;
  }

  function formatMoney(value: number | null) {
    return Number(value || 0).toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
    });
  }

  function formatDate(dateValue: string | null) {
    if (!dateValue) return "—";

    return new Date(dateValue).toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function badgeClass(value: string | null) {
    const status = String(value || "PENDING").toUpperCase();

    if (status === "APPROVED" || status === "COMPLETED") {
      return "border-emerald-400/30 bg-emerald-500/20 text-emerald-200";
    }

    if (status === "REJECTED" || status === "FAILED") {
      return "border-red-400/30 bg-red-500/20 text-red-200";
    }

    return "border-yellow-400/30 bg-yellow-500/20 text-yellow-200";
  }

  function buildTreeCode(index: number) {
    const timestamp = Date.now().toString().slice(-8);
    const suffix = String(index + 1).padStart(3, "0");
    return `ARG-${timestamp}-${suffix}`;
  }

  async function approveRequest(request: TreePurchaseRequest) {
    if (!request.id || !request.profile_id) {
      setMessage("Missing request ID or profile ID.");
      return;
    }

    const quantity = Math.max(1, Number(request.quantity || 1));
    const totalAmount = Number(request.total_amount || 0);

    if (totalAmount <= 0) {
      setMessage("Invalid tree purchase amount.");
      return;
    }

    const confirmed = window.confirm(
      `Approve this tree purchase and assign ${quantity} tree record(s)?`
    );

    if (!confirmed) return;

    setActionLoading(request.id);
    setMessage("");

    const wallet = getLatestWallet(request.profile_id);

    const treesToInsert = Array.from({ length: quantity }).map((_, index) => {
      const treeCode = buildTreeCode(index);

      return {
        profile_id: request.profile_id,
        tree_code: treeCode,
        custom_name: treeCode,
        display_name: request.tree_type || "Arganwood Tree",
        tree_type: request.tree_type || "Arganwood Tree",
        stage: "NEW",
        growth_stage: "NEW",
        current_stage: "NEW",
        status: "ACTIVE",
      };
    });

    const { error: treeError } = await supabase.from("trees").insert(treesToInsert);

    if (treeError) {
      setMessage(treeError.message);
      setActionLoading("");
      return;
    }

    const { error: requestError } = await supabase
      .from("tree_purchase_requests")
      .update({
        status: "APPROVED",
      })
      .eq("id", request.id);

    if (requestError) {
      setMessage(requestError.message);
      setActionLoading("");
      return;
    }

    const { error: txError } = await supabase.from("wallet_transactions").insert({
      profile_id: request.profile_id,
      transaction_type: "TREE_PURCHASE_APPROVED",
      amount: -Math.abs(totalAmount),
      reference_no: request.id,
      status: "APPROVED",
      description: `Tree purchase approved: ${quantity} ${
        request.tree_type || "Arganwood Tree"
      }. Platform/Admin received ${formatMoney(totalAmount)}.`,
    });

    if (txError) {
      setMessage(`Approved, but wallet transaction log failed: ${txError.message}`);
      setActionLoading("");
      await loadData();
      return;
    }

    setMessage(
      `Tree purchase approved. ${quantity} tree(s) created and platform/admin received ${formatMoney(
        totalAmount
      )}.`
    );

    setActionLoading("");
    await loadData();
    setTab("PENDING");
  }

  async function rejectRequest(request: TreePurchaseRequest) {
    if (!request.id) {
      setMessage("Missing request ID.");
      return;
    }

    const confirmed = window.confirm("Reject this tree purchase request?");
    if (!confirmed) return;

    setActionLoading(request.id);
    setMessage("");

    const { error: requestError } = await supabase
      .from("tree_purchase_requests")
      .update({
        status: "REJECTED",
      })
      .eq("id", request.id);

    if (requestError) {
      setMessage(requestError.message);
      setActionLoading("");
      return;
    }

    const { error: txError } = await supabase.from("wallet_transactions").insert({
      profile_id: request.profile_id,
      transaction_type: "TREE_PURCHASE_REJECTED",
      amount: 0,
      reference_no: request.id,
      status: "REJECTED",
      description: `Tree purchase rejected: ${
        request.tree_type || "Arganwood Tree"
      }. No tree assigned.`,
    });

    if (txError) {
      setMessage(`Rejected, but transaction log failed: ${txError.message}`);
      setActionLoading("");
      await loadData();
      return;
    }

    setMessage("Tree purchase rejected and moved to rejected history.");
    setActionLoading("");
    await loadData();
    setTab("PENDING");
  }

  return (
    <main className="min-h-screen p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8 rounded-3xl border border-white/10 bg-[#071f16]/80 p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
              Admin Tree Center
            </p>

            <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
              Tree Purchase Approval
            </h1>

            <p className="mt-2 text-white/70">
              Review pending tree purchases. Approved and rejected requests move
              to history logs.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-5 py-3 text-sm font-semibold text-[#f7d774] hover:bg-[#d9b45f]/25 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh Requests"}
          </button>
        </div>

        {message && (
          <div className="rounded-2xl border border-[#d9b45f]/20 bg-[#d9b45f]/10 p-4 text-sm font-semibold text-[#ffe8a3]">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-5">
          <StatCard label="Pending" value={String(pendingRequests.length)} />
          <StatCard label="Approved" value={String(approvedRequests.length)} />
          <StatCard label="Rejected" value={String(rejectedRequests.length)} />
          <StatCard label="Pending Value" value={formatMoney(pendingAmount)} />
          <StatCard label="Admin Received" value={formatMoney(approvedAmount)} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/10 p-5">
          <div className="flex flex-wrap gap-3">
            {["PENDING", "APPROVED", "REJECTED", "ALL"].map((item) => (
              <button
                key={item}
                onClick={() => setTab(item as TabKey)}
                className={`rounded-full px-5 py-3 text-sm font-bold transition ${
                  tab === item
                    ? "bg-[#f7d774] text-[#071f16]"
                    : "bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                {item === "PENDING"
                  ? "Pending Queue"
                  : item === "APPROVED"
                  ? "Approved History"
                  : item === "REJECTED"
                  ? "Rejected History"
                  : "All Records"}
              </button>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/10">
          {loading ? (
            <div className="p-8 text-white/70">
              Loading tree purchase requests...
            </div>
          ) : activeRequests.length === 0 ? (
            <div className="p-8 text-white/70">
              No tree purchase requests found in this tab.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="bg-[#071f16]/80 text-white/70">
                  <tr>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Tree Type</th>
                    <th className="px-5 py-4">Quantity</th>
                    <th className="px-5 py-4">Unit Price</th>
                    <th className="px-5 py-4">Total</th>
                    <th className="px-5 py-4">Wallet Balance</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Created</th>
                    <th className="px-5 py-4">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {activeRequests.map((request) => {
                    const profile = getProfile(request.profile_id);
                    const wallet = getLatestWallet(request.profile_id);
                    const status = String(request.status || "PENDING").toUpperCase();
                    const isPending = status === "PENDING";

                    return (
                      <tr
                        key={request.id}
                        className="border-t border-white/10 hover:bg-white/5"
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-white">
                            {profile?.full_name || "Unknown Customer"}
                          </div>
                          <div className="mt-1 text-xs text-white/50">
                            {profile?.email || request.profile_id || "No profile"}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {request.tree_type || "Arganwood Tree"}
                        </td>

                        <td className="px-5 py-4">
                          {Number(request.quantity || 1)}
                        </td>

                        <td className="px-5 py-4">
                          {formatMoney(request.unit_price)}
                        </td>

                        <td className="px-5 py-4 font-bold text-[#f7d774]">
                          {formatMoney(request.total_amount)}
                        </td>

                        <td className="px-5 py-4 text-white/80">
                          {formatMoney(wallet?.balance || 0)}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                              status
                            )}`}
                          >
                            {status}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-white/70">
                          {formatDate(request.created_at)}
                        </td>

                        <td className="px-5 py-4">
                          {isPending ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => approveRequest(request)}
                                disabled={actionLoading === request.id}
                                className="rounded-xl bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
                              >
                                {actionLoading === request.id
                                  ? "Working..."
                                  : "Approve"}
                              </button>

                              <button
                                onClick={() => rejectRequest(request)}
                                disabled={actionLoading === request.id}
                                className="rounded-xl bg-red-500/20 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/30 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-white/50">
                              Completed
                            </span>
                          )}
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
      <p className="mt-3 text-2xl font-bold text-[#d9b45f]">{value}</p>
    </div>
  );
}