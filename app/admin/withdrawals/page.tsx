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

export default function AdminWithdrawalsPage() {
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [errorText, setErrorText] = useState("");
  const [filter, setFilter] = useState("PENDING");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorText("");

    const { data: requestRows, error: requestError } = await supabase
      .from("withdrawal_requests")
      .select(
        "id, profile_id, amount, payout_method, account_name, account_number, status, notes, created_at"
      )
      .order("created_at", { ascending: false });

    if (requestError) {
      setErrorText(requestError.message);
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
        setErrorText(profileError.message);
      } else {
        profileRows = (profileData || []) as ProfileRow[];
      }

      const { data: walletData, error: walletError } = await supabase
        .from("wallets")
        .select("id, profile_id, balance, created_at")
        .in("profile_id", profileIds)
        .order("created_at", { ascending: false });

      if (walletError) {
        setErrorText(walletError.message);
      } else {
        walletRows = (walletData || []) as WalletRow[];
      }
    }

    setRequests((requestRows || []) as WithdrawalRequest[]);
    setProfiles(profileRows);
    setWallets(walletRows);
    setLoading(false);
  }

  const filteredRequests = useMemo(() => {
    if (filter === "ALL") return requests;

    return requests.filter(
      (request) => (request.status || "").toUpperCase() === filter
    );
  }, [requests, filter]);

  const pendingCount = requests.filter(
    (request) => (request.status || "").toUpperCase() === "PENDING"
  ).length;

  const approvedCount = requests.filter(
    (request) => (request.status || "").toUpperCase() === "APPROVED"
  ).length;

  const rejectedCount = requests.filter(
    (request) => (request.status || "").toUpperCase() === "REJECTED"
  ).length;

  const totalPendingAmount = requests
    .filter((request) => (request.status || "").toUpperCase() === "PENDING")
    .reduce((sum, request) => sum + Number(request.amount || 0), 0);

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

    return new Date(dateValue).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function badgeClass(value: string | null) {
    const status = (value || "UNKNOWN").toUpperCase();

    if (status === "APPROVED" || status === "COMPLETED" || status === "PAID") {
      return "bg-emerald-500/20 text-emerald-200 border-emerald-400/30";
    }

    if (status === "PENDING") {
      return "bg-yellow-500/20 text-yellow-200 border-yellow-400/30";
    }

    if (status === "REJECTED" || status === "FAILED") {
      return "bg-red-500/20 text-red-200 border-red-400/30";
    }

    return "bg-white/10 text-white/60 border-white/10";
  }

  async function approveWithdrawal(request: WithdrawalRequest) {
    if (!request.id || !request.profile_id) return;

    const amount = Number(request.amount || 0);

    if (amount <= 0) {
      setErrorText("Invalid withdrawal amount.");
      return;
    }

    const confirmed = window.confirm(
      `Approve withdrawal of ${formatMoney(amount)}? This will mark the payout as approved and record a wallet transaction.`
    );

    if (!confirmed) return;

    setActionLoading(request.id);
    setErrorText("");

    const wallet = getLatestWallet(request.profile_id);

    if (!wallet) {
      setErrorText("Wallet not found for this customer.");
      setActionLoading("");
      return;
    }

    const currentBalance = Number(wallet.balance || 0);

    if (currentBalance < amount) {
      setErrorText("Insufficient wallet balance for this withdrawal.");
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
      setErrorText(walletError.message);
      setActionLoading("");
      return;
    }

    const { error: requestError } = await supabase
      .from("withdrawal_requests")
      .update({
        status: "APPROVED",
      })
      .eq("id", request.id);

    if (requestError) {
      setErrorText(requestError.message);
      setActionLoading("");
      return;
    }

    const { error: transactionError } = await supabase
      .from("wallet_transactions")
      .insert({
        profile_id: request.profile_id,
        wallet_id: wallet.id,
        type: "WITHDRAWAL",
        amount: -amount,
        status: "APPROVED",
        description: `Withdrawal approved via ${request.payout_method || "payout method"}`,
      });

    if (transactionError) {
      setErrorText(transactionError.message);
      setActionLoading("");
      return;
    }

    await loadData();
    setActionLoading("");
  }

  async function rejectWithdrawal(request: WithdrawalRequest) {
    if (!request.id) return;

    const confirmed = window.confirm("Reject this withdrawal request?");
    if (!confirmed) return;

    setActionLoading(request.id);
    setErrorText("");

    const { error } = await supabase
      .from("withdrawal_requests")
      .update({
        status: "REJECTED",
      })
      .eq("id", request.id);

    if (error) {
      setErrorText(error.message);
      setActionLoading("");
      return;
    }

    await loadData();
    setActionLoading("");
  }

  return (
    <main className="min-h-screen text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8 rounded-3xl bg-[#071f16]/75 p-8 backdrop-blur-md border border-white/10 shadow-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
              Admin Finance Center
            </p>
            <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
              Withdrawal Approval
            </h1>
            <p className="mt-2 text-white/70">
              Review customer payout requests, verify destination accounts, and approve wallet deductions.
            </p>
          </div>

          <button
            onClick={loadData}
            className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-5 py-3 text-sm font-semibold text-[#f7d774] hover:bg-[#d9b45f]/25"
          >
            Refresh Withdrawals
          </button>
        </div>

        {errorText && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
            {errorText}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard label="Pending Requests" value={String(pendingCount)} />
          <StatCard label="Approved Requests" value={String(approvedCount)} />
          <StatCard label="Rejected Requests" value={String(rejectedCount)} />
          <StatCard label="Pending Amount" value={formatMoney(totalPendingAmount)} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/10 p-5">
          <div className="flex flex-wrap gap-3">
            {["PENDING", "APPROVED", "REJECTED", "ALL"].map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`rounded-full px-5 py-3 text-sm font-bold transition ${
                  filter === item
                    ? "bg-[#f7d774] text-[#071f16]"
                    : "bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/10">
          {loading ? (
            <div className="p-8 text-white/70">Loading withdrawal requests...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-8 text-white/70">No withdrawal requests found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="bg-[#071f16]/80 text-white/70">
                  <tr>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Amount</th>
                    <th className="px-5 py-4">Wallet Balance</th>
                    <th className="px-5 py-4">Payout Method</th>
                    <th className="px-5 py-4">Account Details</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Created</th>
                    <th className="px-5 py-4">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRequests.map((request) => {
                    const profile = getProfile(request.profile_id);
                    const wallet = getLatestWallet(request.profile_id);
                    const isPending =
                      (request.status || "").toUpperCase() === "PENDING";

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
                            {(request.status || "UNKNOWN").toUpperCase()}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-white/70">
                          {formatDate(request.created_at)}
                        </td>

                        <td className="px-5 py-4">
                          {isPending ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => approveWithdrawal(request)}
                                disabled={actionLoading === request.id}
                                className="rounded-xl bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
                              >
                                Approve
                              </button>

                              <button
                                onClick={() => rejectWithdrawal(request)}
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
      <p className="mt-3 text-3xl font-bold text-[#d9b45f]">{value}</p>
    </div>
  );
}