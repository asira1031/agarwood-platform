"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type WalletRow = {
  id: string;
  profile_id: string | null;
  balance: number | null;
  created_at: string | null;
};

type TransactionRow = {
  id: string;
  profile_id: string | null;
  transaction_type: string | null;
  amount: number | null;
  reference_no: string | null;
  description: string | null;
  status: string | null;
  created_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export default function AdminWalletPage() {
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadWalletData();
  }, []);

  async function loadWalletData() {
    setLoading(true);
    setErrorText("");

    const { data: walletRows, error: walletError } = await supabase
      .from("wallets")
      .select("id, profile_id, balance, created_at")
      .order("created_at", { ascending: false });

    if (walletError) {
      setErrorText(walletError.message);
      setLoading(false);
      return;
    }

    const { data: transactionRows, error: transactionError } = await supabase
      .from("wallet_transactions")
      .select(
        "id, profile_id, transaction_type, amount, reference_no, description, status, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (transactionError) {
      setErrorText(transactionError.message);
      setTransactions([]);
    } else {
      setTransactions((transactionRows || []) as TransactionRow[]);
    }

    const profileIds = Array.from(
      new Set(
        [
          ...(walletRows || []).map((item) => item.profile_id),
          ...(transactionRows || []).map((item) => item.profile_id),
        ].filter(Boolean)
      )
    ) as string[];

    let profileRows: ProfileRow[] = [];

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

    setWallets((walletRows || []) as WalletRow[]);
    setProfiles(profileRows);
    setLoading(false);
  }

  function getProfile(profileId: string | null) {
    return profiles.find((profile) => profile.id === profileId) || null;
  }

  const filteredWallets = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return wallets;

    return wallets.filter((wallet) => {
      const profile = getProfile(wallet.profile_id);
      const name = profile?.full_name?.toLowerCase() || "";
      const email = profile?.email?.toLowerCase() || "";
      const id = wallet.profile_id?.toLowerCase() || "";

      return (
        name.includes(keyword) ||
        email.includes(keyword) ||
        id.includes(keyword)
      );
    });
  }, [wallets, profiles, search]);

  const totalWalletBalance = wallets.reduce(
    (sum, wallet) => sum + Number(wallet.balance || 0),
    0
  );

  const totalCredits = transactions
    .filter((item) => Number(item.amount || 0) > 0)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const totalDebits = transactions
    .filter((item) => Number(item.amount || 0) < 0)
    .reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0);

  const platformFees = transactions
    .filter((item) =>
      String(item.transaction_type || "")
        .toUpperCase()
        .includes("PLATFORM_FEE")
    )
    .reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0);

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
    const status = (value || "UNKNOWN").toUpperCase();

    if (status === "APPROVED" || status === "COMPLETED" || status === "PAID") {
      return "bg-emerald-500/20 text-emerald-200 border-emerald-400/30";
    }

    if (status === "PENDING" || status === "PROCESSING") {
      return "bg-yellow-500/20 text-yellow-200 border-yellow-400/30";
    }

    if (status === "REJECTED" || status === "FAILED" || status === "CANCELLED") {
      return "bg-red-500/20 text-red-200 border-red-400/30";
    }

    return "bg-white/10 text-white/60 border-white/10";
  }

  function amountClass(amount: number) {
    if (amount < 0) return "text-red-200";
    if (amount > 0) return "text-emerald-200";
    return "text-white/70";
  }

  return (
    <main className="min-h-screen p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8 rounded-3xl border border-white/10 bg-[#071f16]/80 p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
              Admin Center
            </p>

            <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
              Wallet Overview
            </h1>

            <p className="mt-2 text-white/70">
              Monitor customer wallet balances, transaction history, debits,
              credits, and platform fee logs.
            </p>
          </div>

          <button
            onClick={loadWalletData}
            disabled={loading}
            className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-5 py-3 text-sm font-semibold text-[#f7d774] hover:bg-[#d9b45f]/25 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh Wallets"}
          </button>
        </div>

        {errorText && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
            {errorText}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-5">
          <StatCard label="Total Wallets" value={String(wallets.length)} />
          <StatCard
            label="Total Balance"
            value={formatMoney(totalWalletBalance)}
          />
          <StatCard label="Recent Credits" value={formatMoney(totalCredits)} />
          <StatCard label="Recent Debits" value={formatMoney(totalDebits)} />
          <StatCard label="Platform Fees" value={formatMoney(platformFees)} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/10 p-5">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search customer name, email, or profile ID"
            className="w-full rounded-xl border border-white/10 bg-[#071f16]/70 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40"
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/10">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-xl font-bold text-[#d9b45f]">
              Wallet Balances
            </h2>

            <p className="text-sm text-white/60">
              Showing {filteredWallets.length} of {wallets.length} wallets.
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-white/70">Loading wallets...</div>
          ) : filteredWallets.length === 0 ? (
            <div className="p-8 text-white/70">No wallets found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-[#071f16]/80 text-white/70">
                  <tr>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Profile ID</th>
                    <th className="px-5 py-4">Wallet ID</th>
                    <th className="px-5 py-4">Balance</th>
                    <th className="px-5 py-4">Created</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredWallets.map((wallet) => {
                    const profile = getProfile(wallet.profile_id);

                    return (
                      <tr
                        key={wallet.id}
                        className="border-t border-white/10 hover:bg-white/5"
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-white">
                            {profile?.full_name || "Unknown Customer"}
                          </div>
                          <div className="mt-1 text-xs text-white/50">
                            {profile?.email || "No email"}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-xs text-white/60">
                          {wallet.profile_id || "No profile"}
                        </td>

                        <td className="px-5 py-4 text-xs text-white/60">
                          {wallet.id}
                        </td>

                        <td className="px-5 py-4 font-bold text-[#f7d774]">
                          {formatMoney(wallet.balance)}
                        </td>

                        <td className="px-5 py-4 text-white/70">
                          {formatDate(wallet.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/10">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-xl font-bold text-[#d9b45f]">
              Latest Wallet Transactions
            </h2>

            <p className="text-sm text-white/60">
              Latest 100 records from wallet_transactions.
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-white/70">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-white/70">
              No wallet transactions found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="bg-[#071f16]/80 text-white/70">
                  <tr>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Transaction Type</th>
                    <th className="px-5 py-4">Amount</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Reference No.</th>
                    <th className="px-5 py-4">Description</th>
                    <th className="px-5 py-4">Date</th>
                  </tr>
                </thead>

                <tbody>
                  {transactions.map((tx) => {
                    const profile = getProfile(tx.profile_id);
                    const amount = Number(tx.amount || 0);

                    return (
                      <tr
                        key={tx.id}
                        className="border-t border-white/10 hover:bg-white/5"
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-white">
                            {profile?.full_name || "Unknown Customer"}
                          </div>
                          <div className="mt-1 text-xs text-white/50">
                            {profile?.email || tx.profile_id || "No profile"}
                          </div>
                        </td>

                        <td className="px-5 py-4 font-semibold text-white/80">
                          {tx.transaction_type || "—"}
                        </td>

                        <td
                          className={`px-5 py-4 font-bold ${amountClass(
                            amount
                          )}`}
                        >
                          {formatMoney(amount)}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                              tx.status
                            )}`}
                          >
                            {(tx.status || "UNKNOWN").toUpperCase()}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-white/70">
                          {tx.reference_no || "—"}
                        </td>

                        <td className="px-5 py-4 text-white/70">
                          {tx.description || "—"}
                        </td>

                        <td className="px-5 py-4 text-white/70">
                          {formatDate(tx.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[#d9b45f]/20 bg-[#d9b45f]/10 p-5">
          <h2 className="text-lg font-bold text-[#f7d774]">
            Wallet System Note
          </h2>

          <p className="mt-2 text-sm text-white/70">
            This page is now matched to your current database schema:
            wallet_transactions uses profile_id, transaction_type, amount,
            reference_no, description, status, and created_at. It does not use
            wallet_id or type.
          </p>
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