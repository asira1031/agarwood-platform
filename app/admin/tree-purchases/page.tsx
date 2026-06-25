"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TreePurchaseRequest = {
  id: string;
  profile_id: string | null;
  tree_id: string | null;
  tree_code: string | null;
  purchase_price: number | null;
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

type TreeRow = {
  id: string;
  profile_id: string | null;
  customer_profile_id: string | null;
  tree_code: string | null;
  display_name: string | null;
  custom_name: string | null;
  purchase_price: number | null;
  status: string | null;
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
      .select("id, profile_id, tree_id, tree_code, purchase_price, status, created_at")
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
    (sum, request) => sum + Number(request.purchase_price || 0),
    0
  );

  const approvedAmount = approvedRequests.reduce(
    (sum, request) => sum + Number(request.purchase_price || 0),
    0
  );

  function getProfile(profileId: string | null) {
    return profiles.find((profile) => profile.id === profileId) || null;
  }

  function getLatestWallet(profileId: string | null) {
    return wallets.find((wallet) => wallet.profile_id === profileId) || null;
  }

  function formatMoney(value: number | null | undefined) {
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

  function buildTreeCode() {
    const timestamp = Date.now().toString(16).toUpperCase();
    const random = Math.random().toString(16).slice(2, 8).toUpperCase();
    return `AGW-${timestamp}${random}`.slice(0, 18);
  }

  async function cleanupApprovalRollback(params: {
    requestId: string;
    createdTreeId?: string;
    linkedTreeId?: string | null;
  }) {
    if (params.createdTreeId) {
      await supabase.from("trees").delete().eq("id", params.createdTreeId);
    }

    if (params.linkedTreeId) {
      await supabase
        .from("trees")
        .update({ status: "PENDING" })
        .eq("id", params.linkedTreeId);
    }

    await supabase
      .from("tree_purchase_requests")
      .update({ status: "PENDING" })
      .eq("id", params.requestId);

    await supabase
      .from("wallet_transactions")
      .delete()
      .eq("reference_no", params.requestId);

    await supabase
      .from("platform_treasury")
      .delete()
      .eq("reference_no", params.requestId);
  }

  async function insertTreasury(request: TreePurchaseRequest, amount: number) {
    const basePayload: Record<string, any> = {
      source: "TREE_PURCHASE",
      source_type: "TREE_PURCHASE",
      source_id: request.id,
      reference_no: request.id,
      profile_id: request.profile_id,
      customer_profile_id: request.profile_id,
      amount,
      status: "POSTED",
      created_at: new Date().toISOString(),
    };

    const fullPayload = {
      ...basePayload,
      reference_id: request.id,
      description: `Tree purchase approved: ${request.tree_code || request.id}`,
    };

    const { error: fullError } = await supabase
      .from("platform_treasury")
      .insert(fullPayload);

    if (!fullError) return null;

    const { error: fallbackError } = await supabase
      .from("platform_treasury")
      .insert(basePayload);

    return fallbackError || fullError;
  }

  async function approveRequest(request: TreePurchaseRequest) {
    if (!request.id || !request.profile_id) {
      setMessage("Missing request ID or profile ID.");
      return;
    }

    const amount = Math.abs(Number(request.purchase_price || 0));

    if (amount <= 0) {
      setMessage("Invalid tree purchase amount.");
      return;
    }

    const confirmed = window.confirm("Approve this tree purchase request?");
    if (!confirmed) return;

    setActionLoading(request.id);
    setMessage("");

    let finalTree: TreeRow | null = null;
    let createdTreeId = "";

    try {
      const wallet = getLatestWallet(request.profile_id);

      if (!wallet) {
        throw new Error("Customer wallet not found.");
      }

      const finalTreeCode = request.tree_code || buildTreeCode();

      if (request.tree_id) {
        const { data: updatedTree, error: treeUpdateError } = await supabase
          .from("trees")
          .update({
            status: "ACTIVE",
            purchase_price: amount,
            tree_code: finalTreeCode,
          })
          .eq("id", request.tree_id)
          .select(
            "id, profile_id, customer_profile_id, tree_code, display_name, custom_name, purchase_price, status, created_at"
          )
          .single();

        if (treeUpdateError) throw treeUpdateError;
        finalTree = updatedTree as TreeRow;
      } else {
        const { data: insertedTree, error: treeInsertError } = await supabase
          .from("trees")
          .insert({
            profile_id: request.profile_id,
            customer_profile_id: request.profile_id,
            tree_code: finalTreeCode,
            display_name: "Arganwood Tree",
            custom_name: finalTreeCode,
            purchase_price: amount,
            status: "ACTIVE",
          })
          .select(
            "id, profile_id, customer_profile_id, tree_code, display_name, custom_name, purchase_price, status, created_at"
          )
          .single();

        if (treeInsertError) throw treeInsertError;

        finalTree = insertedTree as TreeRow;
        createdTreeId = finalTree.id;
      }

      if (!finalTree?.id) {
        throw new Error("Tree approval failed. No tree record returned.");
      }

      const { error: requestUpdateError } = await supabase
        .from("tree_purchase_requests")
        .update({
          status: "APPROVED",
          tree_id: finalTree.id,
          tree_code: finalTree.tree_code || finalTreeCode,
        })
        .eq("id", request.id);

      if (requestUpdateError) throw requestUpdateError;

      const { error: txError } = await supabase
        .from("wallet_transactions")
        .insert({
          profile_id: request.profile_id,
          transaction_type: "TREE_PURCHASE_APPROVED",
          amount: -Math.abs(amount),
          reference_no: request.id,
          description: `Tree purchase approved: ${
            finalTree.tree_code || finalTreeCode
          } for ${formatMoney(amount)}.`,
          status: "COMPLETED",
          created_at: new Date().toISOString(),
        });

      if (txError) throw txError;

      const treasuryError = await insertTreasury(request, amount);

      if (treasuryError) {
        throw new Error(`Treasury sync failed: ${treasuryError.message}`);
      }

      setMessage(
        `Tree purchase approved. Tree ${
          finalTree.tree_code || finalTreeCode
        } activated and treasury posted ${formatMoney(amount)}.`
      );

      setActionLoading("");
      await loadData();
      setTab("PENDING");
    } catch (error: any) {
      await cleanupApprovalRollback({
        requestId: request.id,
        createdTreeId,
        linkedTreeId: request.tree_id,
      });

      setMessage(error?.message || "Approval failed. Rollback completed.");
      setActionLoading("");
      await loadData();
    }
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

    if (request.profile_id) {
      const { error: txError } = await supabase.from("wallet_transactions").insert({
        profile_id: request.profile_id,
        transaction_type: "TREE_PURCHASE_REJECTED",
        amount: 0,
        reference_no: request.id,
        status: "REJECTED",
        description: `Tree purchase rejected: ${
          request.tree_code || request.id
        }. No tree activated.`,
        created_at: new Date().toISOString(),
      });

      if (txError) {
        setMessage(`Rejected, but transaction log failed: ${txError.message}`);
        setActionLoading("");
        await loadData();
        return;
      }
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
              One approved request activates one tree and posts wallet plus treasury records.
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
          <StatCard label="Treasury Posted" value={formatMoney(approvedAmount)} />
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
            <div className="p-8 text-white/70">Loading tree purchase requests...</div>
          ) : activeRequests.length === 0 ? (
            <div className="p-8 text-white/70">
              No tree purchase requests found in this tab.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-[#071f16]/80 text-white/70">
                  <tr>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Tree Identifier</th>
                    <th className="px-5 py-4">Linked Tree</th>
                    <th className="px-5 py-4">Amount</th>
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

                        <td className="px-5 py-4 font-semibold text-[#f7d774]">
                          {request.tree_code || "Will generate on approval"}
                        </td>

                        <td className="px-5 py-4 text-white/70">
                          {request.tree_id ? "Linked existing tree" : "Create new tree"}
                        </td>

                        <td className="px-5 py-4 font-bold text-[#f7d774]">
                          {formatMoney(request.purchase_price)}
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
                                {actionLoading === request.id ? "Working..." : "Approve"}
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
                            <span className="text-xs text-white/50">Completed</span>
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