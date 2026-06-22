"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type WithdrawalRequest = {
  id: string;
  profile_id: string | null;
  amount: number | null;
  payout_method: string | null;
  account_name: string | null;
  account_number: string | null;
  status: string | null;
  notes: string | null;
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

type TabKey = "PENDING" | "PROCESSING" | "PAID" | "REJECTED" | "ALL";

export default function AdminWithdrawalsPage() {
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
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
      .from("withdrawal_requests")
      .select(
        "id, profile_id, amount, payout_method, account_name, account_number, status, notes, created_at"
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

    setRequests((requestRows || []) as WithdrawalRequest[]);
    setProfiles(profileRows);
    setWallets(walletRows);
    setLoading(false);
  }

  function normalizeStatus(value: string | null) {
    const status = String(value || "PENDING").toUpperCase();

    if (status === "APPROVED") return "PROCESSING";
    if (status === "COMPLETED") return "PAID";

    return status;
  }

  const pendingRequests = useMemo(
    () => requests.filter((item) => normalizeStatus(item.status) === "PENDING"),
    [requests]
  );

  const processingRequests = useMemo(
    () =>
      requests.filter(
        (item) => normalizeStatus(item.status) === "PROCESSING"
      ),
    [requests]
  );

  const paidRequests = useMemo(
    () => requests.filter((item) => normalizeStatus(item.status) === "PAID"),
    [requests]
  );

  const rejectedRequests = useMemo(
    () => requests.filter((item) => normalizeStatus(item.status) === "REJECTED"),
    [requests]
  );

  const activeRequests = useMemo(() => {
    if (tab === "PENDING") return pendingRequests;
    if (tab === "PROCESSING") return processingRequests;
    if (tab === "PAID") return paidRequests;
    if (tab === "REJECTED") return rejectedRequests;
    return requests;
  }, [tab, requests, pendingRequests, processingRequests, paidRequests, rejectedRequests]);

  const totalPendingAmount = pendingRequests.reduce(
    (sum, request) => sum + Number(request.amount || 0),
    0
  );

  const totalProcessingAmount = processingRequests.reduce(
    (sum, request) => sum + Number(request.amount || 0),
    0
  );

  const totalPaidAmount = paidRequests.reduce(
    (sum, request) => sum + Number(request.amount || 0),
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
    const status = normalizeStatus(value);

    if (status === "PAID") {
      return "border-emerald-400/30 bg-emerald-500/20 text-emerald-200";
    }

    if (status === "PROCESSING") {
      return "border-blue-400/30 bg-blue-500/20 text-blue-200";
    }

    if (status === "PENDING") {
      return "border-yellow-400/30 bg-yellow-500/20 text-yellow-200";
    }

    if (status === "REJECTED" || status === "FAILED") {
      return "border-red-400/30 bg-red-500/20 text-red-200";
    }

    return "border-white/10 bg-white/10 text-white/60";
  }

  async function markProcessing(request: WithdrawalRequest) {
    if (!request.id || !request.profile_id) return;

    const amount = Number(request.amount || 0);

    if (amount <= 0) {
      setMessage("Invalid withdrawal amount.");
      return;
    }

    if (!request.account_name || !request.account_number || !request.payout_method) {
      setMessage("Payout method, account name, and account number are required before processing.");
      return;
    }

    const confirmed = window.confirm(
      `Move withdrawal of ${formatMoney(amount)} to PROCESSING?`
    );

    if (!confirmed) return;

    setActionLoading(request.id);
    setMessage("");

    const { error: requestError } = await supabase
      .from("withdrawal_requests")
      .update({
        status: "PROCESSING",
        notes:
          request.notes ||
          "Withdrawal verified by admin and moved to processing.",
      })
      .eq("id", request.id);

    if (requestError) {
      setMessage(requestError.message);
      setActionLoading("");
      return;
    }

    const { error: txError } = await supabase.from("wallet_transactions").insert({
      profile_id: request.profile_id,
      transaction_type: "WITHDRAWAL_PROCESSING",
      amount: 0,
      reference_no: request.id,
      status: "PROCESSING",
      description: `Withdrawal processing via ${
        request.payout_method || "payout method"
      }. Account: ${request.account_name || "N/A"} - ${
        request.account_number || "N/A"
      }.`,
    });

    if (txError) {
      setMessage(`Moved to processing, but transaction log failed: ${txError.message}`);
      setActionLoading("");
      await loadData();
      return;
    }

    setMessage("Withdrawal moved to PROCESSING.");
    setActionLoading("");
    await loadData();
    setTab("PROCESSING");
  }

  async function markPaid(request: WithdrawalRequest) {
    if (!request.id || !request.profile_id) return;

    const amount = Number(request.amount || 0);

    if (amount <= 0) {
      setMessage("Invalid withdrawal amount.");
      return;
    }

    const confirmed = window.confirm(
      `Mark this payout as PAID? Confirm that money was already sent to the customer's account.`
    );

    if (!confirmed) return;

    setActionLoading(request.id);
    setMessage("");

    const wallet = getLatestWallet(request.profile_id);

    if (!wallet) {
      setMessage("Wallet not found for this customer.");
      setActionLoading("");
      return;
    }

    const currentBalance = Number(wallet.balance || 0);

    if (currentBalance < amount) {
      setMessage("Insufficient wallet balance for this withdrawal.");
      setActionLoading("");
      return;
    }

    const newBalance = currentBalance - amount;

    const { error: walletError } = await supabase
      .from("wallets")
      .update({
        balance: newBalance,
      })
      .eq("id", wallet.id);

    if (walletError) {
      setMessage(walletError.message);
      setActionLoading("");
      return;
    }

    const { error: requestError } = await supabase
      .from("withdrawal_requests")
      .update({
        status: "PAID",
        notes:
          request.notes ||
          "Payout completed by admin. Money was sent to destination account.",
      })
      .eq("id", request.id);

    if (requestError) {
      setMessage(requestError.message);
      setActionLoading("");
      return;
    }

    const { error: txError } = await supabase.from("wallet_transactions").insert({
      profile_id: request.profile_id,
      transaction_type: "WITHDRAWAL_PAID",
      amount: -Math.abs(amount),
      reference_no: request.id,
      status: "PAID",
      description: `Withdrawal paid via ${
        request.payout_method || "payout method"
      }. Account: ${request.account_name || "N/A"} - ${
        request.account_number || "N/A"
      }.`,
    });

    if (txError) {
      setMessage(`Wallet deducted, but transaction log failed: ${txError.message}`);
      setActionLoading("");
      await loadData();
      return;
    }

    setMessage("Withdrawal marked as PAID. Wallet deducted and transaction recorded.");
    setActionLoading("");
    await loadData();
    setTab("PAID");
  }

  async function rejectWithdrawal(request: WithdrawalRequest) {
    if (!request.id || !request.profile_id) return;

    const confirmed = window.confirm("Reject this withdrawal request?");
    if (!confirmed) return;

    setActionLoading(request.id);
    setMessage("");

    const { error: requestError } = await supabase
      .from("withdrawal_requests")
      .update({
        status: "REJECTED",
        notes: request.notes || "Withdrawal rejected by admin.",
      })
      .eq("id", request.id);

    if (requestError) {
      setMessage(requestError.message);
      setActionLoading("");
      return;
    }

    const { error: txError } = await supabase.from("wallet_transactions").insert({
      profile_id: request.profile_id,
      transaction_type: "WITHDRAWAL_REJECTED",
      amount: 0,
      reference_no: request.id,
      status: "REJECTED",
      description: `Withdrawal rejected. Amount: ${formatMoney(
        Number(request.amount || 0)
      )}.`,
    });

    if (txError) {
      setMessage(`Rejected, but transaction log failed: ${txError.message}`);
      setActionLoading("");
      await loadData();
      return;
    }

    setMessage("Withdrawal rejected and moved to rejected history.");
    setActionLoading("");
    await loadData();
    setTab("REJECTED");
  }

  return (
    <main className="min-h-screen p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8 rounded-3xl border border-white/10 bg-[#071f16]/80 p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
              Admin Finance Center
            </p>

            <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
              Payout Queue / Withdrawals
            </h1>

            <p className="mt-2 text-white/70">
              Review customer withdrawal requests, verify account details, move
              to processing, then mark as paid after sending money.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-5 py-3 text-sm font-semibold text-[#f7d774] hover:bg-[#d9b45f]/25 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh Withdrawals"}
          </button>
        </div>

        {message && (
          <div className="rounded-2xl border border-[#d9b45f]/20 bg-[#d9b45f]/10 p-4 text-sm font-semibold text-[#ffe8a3]">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-5">
          <StatCard label="Pending" value={String(pendingRequests.length)} />
          <StatCard label="Processing" value={String(processingRequests.length)} />
          <StatCard label="Paid" value={String(paidRequests.length)} />
          <StatCard label="Rejected" value={String(rejectedRequests.length)} />
          <StatCard label="Pending Amount" value={formatMoney(totalPendingAmount)} />
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <StatCard label="Processing Amount" value={formatMoney(totalProcessingAmount)} />
          <StatCard label="Total Paid" value={formatMoney(totalPaidAmount)} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/10 p-5">
          <div className="flex flex-wrap gap-3">
            {["PENDING", "PROCESSING", "PAID", "REJECTED", "ALL"].map((item) => (
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
                  : item === "PROCESSING"
                  ? "Processing"
                  : item === "PAID"
                  ? "Paid History"
                  : item === "REJECTED"
                  ? "Rejected History"
                  : "All Records"}
              </button>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/10">
          {loading ? (
            <div className="p-8 text-white/70">Loading withdrawal requests...</div>
          ) : activeRequests.length === 0 ? (
            <div className="p-8 text-white/70">No withdrawal requests in this tab.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px] text-left text-sm">
                <thead className="bg-[#071f16]/80 text-white/70">
                  <tr>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Amount</th>
                    <th className="px-5 py-4">Wallet Balance</th>
                    <th className="px-5 py-4">Payout Method</th>
                    <th className="px-5 py-4">Account Details</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Created</th>
                    <th className="px-5 py-4">Notes</th>
                    <th className="px-5 py-4">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {activeRequests.map((request) => {
                    const profile = getProfile(request.profile_id);
                    const wallet = getLatestWallet(request.profile_id);
                    const status = normalizeStatus(request.status);

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

                        <td className="px-5 py-4 font-bold text-[#f7d774]">
                          {formatMoney(request.amount)}
                        </td>

                        <td className="px-5 py-4 text-white/80">
                          {formatMoney(wallet?.balance || 0)}
                        </td>

                        <td className="px-5 py-4">
                          {request.payout_method || "—"}
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-semibold">
                            {request.account_name || "—"}
                          </div>
                          <div className="mt-1 text-xs text-white/50">
                            {request.account_number || "No account number"}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                              request.status
                            )}`}
                          >
                            {status}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-white/70">
                          {formatDate(request.created_at)}
                        </td>

                        <td className="px-5 py-4 text-white/60">
                          {request.notes || "—"}
                        </td>

                        <td className="px-5 py-4">
                          {status === "PENDING" && (
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => markProcessing(request)}
                                disabled={actionLoading === request.id}
                                className="rounded-xl bg-blue-500/20 px-4 py-2 text-xs font-semibold text-blue-200 hover:bg-blue-500/30 disabled:opacity-50"
                              >
                                Processing
                              </button>

                              <button
                                onClick={() => rejectWithdrawal(request)}
                                disabled={actionLoading === request.id}
                                className="rounded-xl bg-red-500/20 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/30 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          )}

                          {status === "PROCESSING" && (
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => markPaid(request)}
                                disabled={actionLoading === request.id}
                                className="rounded-xl bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
                              >
                                Mark Paid
                              </button>

                              <button
                                onClick={() => rejectWithdrawal(request)}
                                disabled={actionLoading === request.id}
                                className="rounded-xl bg-red-500/20 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/30 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          )}

                          {["PAID", "REJECTED"].includes(status) && (
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