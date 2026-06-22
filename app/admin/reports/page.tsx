"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Row = Record<string, any>;

export default function AdminReportsPage() {
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [trees, setTrees] = useState<Row[]>([]);
  const [wallets, setWallets] = useState<Row[]>([]);
  const [kyc, setKyc] = useState<Row[]>([]);
  const [withdrawals, setWithdrawals] = useState<Row[]>([]);
  const [operations, setOperations] = useState<Row[]>([]);
  const [memberships, setMemberships] = useState<Row[]>([]);
  const [treasury, setTreasury] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadReports();
  }, []);

  async function safeLoad(table: string, setter: (rows: Row[]) => void) {
    const { data, error } = await supabase.from(table).select("*");

    if (error) {
      console.warn(`${table}:`, error.message);
      setter([]);
      return;
    }

    setter(data || []);
  }

  async function loadReports() {
    setLoading(true);
    setMessage("");

    await Promise.all([
      safeLoad("profiles", setProfiles),
      safeLoad("trees", setTrees),
      safeLoad("wallets", setWallets),
      safeLoad("kyc_records", setKyc),
      safeLoad("withdrawal_requests", setWithdrawals),
      safeLoad("tree_operation_requests", setOperations),
      safeLoad("membership_orders", setMemberships),
      safeLoad("platform_treasury", setTreasury),
    ]);

    setLoading(false);
  }

  function statusCount(rows: Row[], status: string) {
    return rows.filter(
      (item) => String(item.status || "").toUpperCase() === status
    ).length;
  }

  function sumAmount(rows: Row[], keys: string[]) {
    return rows.reduce((sum, item) => {
      const key = keys.find((candidate) => item[candidate] !== undefined);
      return sum + Number(key ? item[key] || 0 : 0);
    }, 0);
  }

  function peso(value: number) {
    return Number(value || 0).toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
    });
  }

  const stats = useMemo(() => {
    const walletBalance = sumAmount(wallets, ["balance"]);
    const pendingKyc = statusCount(kyc, "PENDING");
    const pendingWithdrawals = statusCount(withdrawals, "PENDING");
    const pendingOperations = operations.filter((item) =>
      ["PENDING", "REQUESTED", "PAID"].includes(
        String(item.status || "PENDING").toUpperCase()
      )
    ).length;
    const activeMemberships = profiles.filter(
      (item) => String(item.membership_status || "").toUpperCase() === "ACTIVE"
    ).length;

    const treasuryTotal = sumAmount(treasury, ["amount", "total_amount", "net_amount"]);

    return {
      customers: profiles.length,
      trees: trees.length,
      walletBalance,
      pendingKyc,
      pendingWithdrawals,
      pendingOperations,
      activeMemberships,
      treasuryTotal,
    };
  }, [profiles, trees, wallets, kyc, withdrawals, operations, treasury]);

  return (
    <main className="min-h-screen p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8 rounded-3xl border border-white/10 bg-[#071f16]/80 p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
              Admin Intelligence Center
            </p>

            <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
              Reports Dashboard
            </h1>

            <p className="mt-2 text-white/70">
              Platform overview for customers, trees, KYC, withdrawals, operations,
              memberships, wallet balances, and treasury.
            </p>
          </div>

          <button
            onClick={loadReports}
            disabled={loading}
            className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-5 py-3 text-sm font-semibold text-[#f7d774] hover:bg-[#d9b45f]/25 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh Reports"}
          </button>
        </div>

        {message && (
          <div className="rounded-2xl border border-[#d9b45f]/20 bg-[#d9b45f]/10 p-4 text-sm font-semibold text-[#ffe8a3]">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-white/70">
            Loading reports...
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <StatCard label="Customers" value={String(stats.customers)} />
              <StatCard label="Trees" value={String(stats.trees)} />
              <StatCard label="Wallet Balance" value={peso(stats.walletBalance)} />
              <StatCard label="Treasury" value={peso(stats.treasuryTotal)} />
              <StatCard label="Pending KYC" value={String(stats.pendingKyc)} />
              <StatCard
                label="Pending Withdrawals"
                value={String(stats.pendingWithdrawals)}
              />
              <StatCard
                label="Pending Operations"
                value={String(stats.pendingOperations)}
              />
              <StatCard
                label="Active Memberships"
                value={String(stats.activeMemberships)}
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <Panel title="KYC Status">
                <ReportRow label="Pending" value={statusCount(kyc, "PENDING")} />
                <ReportRow label="Approved" value={statusCount(kyc, "APPROVED")} />
                <ReportRow label="Rejected" value={statusCount(kyc, "REJECTED")} />
              </Panel>

              <Panel title="Withdrawal Status">
                <ReportRow label="Pending" value={statusCount(withdrawals, "PENDING")} />
                <ReportRow
                  label="Processing"
                  value={statusCount(withdrawals, "PROCESSING")}
                />
                <ReportRow label="Paid" value={statusCount(withdrawals, "PAID")} />
                <ReportRow label="Rejected" value={statusCount(withdrawals, "REJECTED")} />
              </Panel>

              <Panel title="Operations Status">
                <ReportRow label="Pending" value={statusCount(operations, "PENDING")} />
                <ReportRow label="Assigned" value={statusCount(operations, "ASSIGNED")} />
                <ReportRow
                  label="In Progress"
                  value={statusCount(operations, "IN_PROGRESS")}
                />
                <ReportRow label="Completed" value={statusCount(operations, "COMPLETED")} />
              </Panel>

              <Panel title="Membership Orders">
                <ReportRow label="Pending" value={statusCount(memberships, "PENDING")} />
                <ReportRow label="Approved" value={statusCount(memberships, "APPROVED")} />
                <ReportRow label="Rejected" value={statusCount(memberships, "REJECTED")} />
                <ReportRow
                  label="Total Amount"
                  value={peso(sumAmount(memberships, ["amount", "total_amount", "price"]))}
                />
              </Panel>
            </section>
          </>
        )}
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

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
      <h2 className="text-2xl font-bold text-[#ffe49a]">{title}</h2>
      <div className="mt-5 space-y-3">{children}</div>
    </div>
  );
}

function ReportRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4">
      <span className="text-white/70">{label}</span>
      <b className="text-[#f7d774]">{value}</b>
    </div>
  );
}