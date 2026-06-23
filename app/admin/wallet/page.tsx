"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type WalletRow = {
  id: string;
  profile_id: string | null;
  balance: number | null;
  status: string | null;
  created_at: string | null;
  updated_at?: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  membership_status: string | null;
  kyc_status: string | null;
};

type WalletTransactionRow = {
  id: string;
  profile_id: string | null;
  transaction_type: string | null;
  amount: number | null;
  reference_no: string | null;
  description: string | null;
  status: string | null;
  created_at: string | null;
};

export default function AdminWalletPage() {
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [transactions, setTransactions] = useState<WalletTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorText("");

    const { data: walletRows, error: walletError } = await supabase
      .from("wallets")
      .select("id, profile_id, balance, status, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (walletError) {
      setErrorText(walletError.message);
      setWallets([]);
      setProfiles([]);
      setTransactions([]);
      setLoading(false);
      return;
    }

    const rows = (walletRows || []) as WalletRow[];

    const profileIds = Array.from(
      new Set(rows.map((item) => item.profile_id).filter(Boolean))
    ) as string[];

    let profileRows: ProfileRow[] = [];
    let transactionRows: WalletTransactionRow[] = [];

    if (profileIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, membership_status, kyc_status")
        .in("id", profileIds);

      if (profileError) {
        setErrorText(profileError.message);
      } else {
        profileRows = (profileData || []) as ProfileRow[];
      }

      const { data: txData, error: txError } = await supabase
        .from("wallet_transactions")
        .select(
          "id, profile_id, transaction_type, amount, reference_no, description, status, created_at"
        )
        .in("profile_id", profileIds)
        .order("created_at", { ascending: false })
        .limit(100);

      if (txError) {
        setErrorText(txError.message);
      } else {
        transactionRows = (txData || []) as WalletTransactionRow[];
      }
    }

    setWallets(rows);
    setProfiles(profileRows);
    setTransactions(transactionRows);
    setLoading(false);
  }

  function getProfile(profileId: string | null) {
    return profiles.find((profile) => profile.id === profileId) || null;
  }

  function peso(value: number | null) {
    return Number(value || 0).toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
    });
  }

  function formatDate(value: string | null | undefined) {
    if (!value) return "—";

    return new Date(value).toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function badgeClass(value: string | null) {
    const status = String(value || "UNKNOWN").toUpperCase();

    if (status === "ACTIVE" || status === "COMPLETED" || status === "PAID") {
      return "border-emerald-400/30 bg-emerald-500/20 text-emerald-200";
    }

    if (status === "PENDING" || status === "PROCESSING") {
      return "border-yellow-400/30 bg-yellow-500/20 text-yellow-200";
    }

    if (status === "INACTIVE" || status === "FAILED" || status === "REJECTED") {
      return "border-red-400/30 bg-red-500/20 text-red-200";
    }

    return "border-white/10 bg-white/10 text-white/60";
  }

  const filteredWallets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return wallets.filter((wallet) => {
      const profile = getProfile(wallet.profile_id);

      const matchesSearch =
        !query ||
        String(profile?.full_name || "").toLowerCase().includes(query) ||
        String(profile?.email || "").toLowerCase().includes(query) ||
        String(profile?.phone || "").toLowerCase().includes(query) ||
        String(wallet.profile_id || "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        String(wallet.status || "").toUpperCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [wallets, profiles, search, statusFilter]);

  const totalBalance = wallets.reduce(
    (sum, wallet) => sum + Number(wallet.balance || 0),
    0
  );

  const activeWallets = wallets.filter(
    (wallet) => String(wallet.status || "").toUpperCase() === "ACTIVE"
  ).length;

  const pendingTx = transactions.filter(
    (tx) => String(tx.status || "").toUpperCase() === "PENDING"
  ).length;

  const totalTxAmount = transactions.reduce(
    (sum, tx) => sum + Number(tx.amount || 0),
    0
  );

  return (
    <main className="min-h-screen p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8 rounded-3xl border border-white/10 bg-[#071f16]/80 p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
              Admin Money Control
            </p>

            <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
              Wallet Center
            </h1>

            <p className="mt-2 text-white/70">
              Monitor customer wallet balances and wallet transaction history.
            </p>
          </div>

          <button
            onClick={loadData}
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

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard label="Total Wallet Balance" value={peso(totalBalance)} />
          <StatCard label="Wallet Records" value={String(wallets.length)} />
          <StatCard label="Active Wallets" value={String(activeWallets)} />
          <StatCard label="Pending Transactions" value={String(pendingTx)} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/10 p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer, email, phone, profile..."
              className="rounded-xl border border-white/10 bg-[#071f16]/70 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#071f16]/70 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="ALL">All Wallet Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="PENDING">Pending</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>

          <p className="mt-3 text-sm text-white/55">
            Showing {filteredWallets.length} of {wallets.length} wallet records.
          </p>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/10">
          {loading ? (
            <div className="p-8 text-white/70">Loading wallets...</div>
          ) : filteredWallets.length === 0 ? (
            <div className="p-8 text-white/70">No wallet records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-[#071f16]/80 text-white/70">
                  <tr>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Balance</th>
                    <th className="px-5 py-4">Wallet Status</th>
                    <th className="px-5 py-4">KYC</th>
                    <th className="px-5 py-4">Membership</th>
                    <th className="px-5 py-4">Created</th>
                    <th className="px-5 py-4">Updated</th>
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
                          <div className="mt-1 text-xs text-white/35">
                            {profile?.phone || "No phone"}
                          </div>
                        </td>

                        <td className="px-5 py-4 font-bold text-[#f7d774]">
                          {peso(wallet.balance)}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(
                              wallet.status
                            )}`}
                          >
                            {String(wallet.status || "UNKNOWN").toUpperCase()}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(
                              profile?.kyc_status || null
                            )}`}
                          >
                            {String(profile?.kyc_status || "UNKNOWN").toUpperCase()}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(
                              profile?.membership_status || null
                            )}`}
                          >
                            {String(
                              profile?.membership_status || "INACTIVE"
                            ).toUpperCase()}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-white/70">
                          {formatDate(wallet.created_at)}
                        </td>

                        <td className="px-5 py-4 text-white/70">
                          {formatDate(wallet.updated_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/10 p-5">
          <div>
            <h2 className="text-xl font-bold text-[#d9b45f]">
              Recent Wallet Transactions
            </h2>
            <p className="mt-1 text-sm text-white/60">
              Uses only V6 wallet transaction fields: profile_id,
              transaction_type, amount, reference_no, description, status,
              created_at.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-sm text-white/60">
              Last 100 transactions total:{" "}
              <span className="font-bold text-[#f7d774]">
                {peso(totalTxAmount)}
              </span>
            </p>
          </div>

          {transactions.length === 0 ? (
            <div className="text-sm text-white/60">
              No wallet transactions found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="text-white/60">
                  <tr>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Reference</th>
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Created</th>
                  </tr>
                </thead>

                <tbody>
                  {transactions.map((tx) => {
                    const profile = getProfile(tx.profile_id);

                    return (
                      <tr
                        key={tx.id}
                        className="border-t border-white/10 hover:bg-white/5"
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-white">
                            {profile?.full_name || "Unknown Customer"}
                          </div>
                          <div className="mt-1 text-xs text-white/45">
                            {profile?.email || tx.profile_id || "No profile"}
                          </div>
                        </td>

                        <td className="px-5 py-4 font-semibold text-white">
                          {tx.transaction_type || "—"}
                        </td>

                        <td className="px-5 py-4 font-bold text-[#f7d774]">
                          {peso(tx.amount)}
                        </td>

                        <td className="px-5 py-4 text-white/70">
                          {tx.reference_no || "—"}
                        </td>

                        <td className="px-5 py-4 text-white/70">
                          {tx.description || "—"}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(
                              tx.status
                            )}`}
                          >
                            {String(tx.status || "UNKNOWN").toUpperCase()}
                          </span>
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