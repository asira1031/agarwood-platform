"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TreasuryRow = {
  id: string;
  source: string | null;
  amount: number | null;
  reference_id: string | null;
  created_at: string | null;
  source_type: string | null;
  source_id: string | null;
  customer_profile_id: string | null;
  reference_no: string | null;
  description: string | null;
  status: string | null;
  profile_id: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type TabKey =
  | "ALL"
  | "CASH_IN"
  | "WITHDRAWAL"
  | "TREE_PURCHASE_FEE"
  | "CARE_SERVICE"
  | "MEMBERSHIP";

function peso(value: number | null | undefined) {
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

function normalize(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

function getType(row: TreasuryRow) {
  return normalize(row.source_type || row.source || "OTHER");
}

function getAmount(row: TreasuryRow) {
  return Number(row.amount || 0);
}

function friendlyType(type: string) {
  const normalized = normalize(type);

  if (normalized === "CASH_IN") return "Cash-In Received";
  if (normalized === "WITHDRAWAL") return "Withdrawal Paid";
  if (normalized === "TREE_PURCHASE_FEE") return "Tree Purchase Fee";
  if (normalized === "CARE_SERVICE") return "Care Service / Tree Operation";
  if (normalized === "TREE_OPERATION") return "Care Service / Tree Operation";
  if (normalized === "MEMBERSHIP") return "Membership Payment";
  if (normalized === "MEMBERSHIP_PAYMENT") return "Membership Payment";

  return normalized.replaceAll("_", " ") || "Other Treasury Entry";
}

function badgeClass(statusValue: string | null | undefined) {
  const status = normalize(statusValue || "POSTED");

  if (["POSTED", "RECEIVED", "PAID", "COMPLETED", "APPROVED"].includes(status)) {
    return "border-emerald-400/30 bg-emerald-500/20 text-emerald-200";
  }

  if (["PENDING", "PROCESSING"].includes(status)) {
    return "border-yellow-400/30 bg-yellow-500/20 text-yellow-200";
  }

  if (["FAILED", "REJECTED", "VOID"].includes(status)) {
    return "border-red-400/30 bg-red-500/20 text-red-200";
  }

  return "border-white/10 bg-white/10 text-white/70";
}

export default function AdminTreasuryPage() {
  const [rows, setRows] = useState<TreasuryRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<TabKey>("ALL");

  useEffect(() => {
    loadTreasury();
  }, []);

  async function loadTreasury() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("platform_treasury")
      .select(
        "id, source, amount, reference_id, created_at, source_type, source_id, customer_profile_id, reference_no, description, status, profile_id"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setRows([]);
      setProfiles({});
      setLoading(false);
      return;
    }

    const treasuryRows = (data || []) as TreasuryRow[];
    setRows(treasuryRows);

    const profileIds = Array.from(
      new Set(
        treasuryRows
          .map((row) => row.customer_profile_id || row.profile_id)
          .filter(Boolean)
      )
    ) as string[];

    if (profileIds.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", profileIds);

      const profileMap: Record<string, ProfileRow> = {};
      ((profileRows || []) as ProfileRow[]).forEach((profile) => {
        profileMap[profile.id] = profile;
      });

      setProfiles(profileMap);
    } else {
      setProfiles({});
    }

    setLoading(false);
  }

  const filteredRows = useMemo(() => {
    if (tab === "ALL") return rows;
    if (tab === "CARE_SERVICE") {
      return rows.filter((row) => ["CARE_SERVICE", "TREE_OPERATION"].includes(getType(row)));
    }
    if (tab === "MEMBERSHIP") {
      return rows.filter((row) => ["MEMBERSHIP", "MEMBERSHIP_PAYMENT"].includes(getType(row)));
    }
    return rows.filter((row) => getType(row) === tab);
  }, [rows, tab]);

  function totalByType(types: string[]) {
    return rows
      .filter((row) => types.includes(getType(row)))
      .reduce((sum, row) => sum + getAmount(row), 0);
  }

  const totalPlatformTreasury = useMemo(
    () => rows.reduce((sum, row) => sum + getAmount(row), 0),
    [rows]
  );

  const cashInReceived = useMemo(() => totalByType(["CASH_IN"]), [rows]);
  const withdrawalsPaid = useMemo(() => totalByType(["WITHDRAWAL"]), [rows]);
  const treePurchaseFees = useMemo(() => totalByType(["TREE_PURCHASE_FEE"]), [rows]);
  const careServiceFees = useMemo(
    () => totalByType(["CARE_SERVICE", "TREE_OPERATION"]),
    [rows]
  );
  const membershipRevenue = useMemo(
    () => totalByType(["MEMBERSHIP", "MEMBERSHIP_PAYMENT"]),
    [rows]
  );
  const netTreasuryMovement = totalPlatformTreasury;

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "ALL", label: "All" },
    { key: "CASH_IN", label: "Cash-In" },
    { key: "WITHDRAWAL", label: "Withdrawals" },
    { key: "TREE_PURCHASE_FEE", label: "Tree Fees" },
    { key: "CARE_SERVICE", label: "Care Services" },
    { key: "MEMBERSHIP", label: "Membership" },
  ];

  return (
    <main className="min-h-screen p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8 rounded-3xl border border-white/10 bg-[#071f16]/80 p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
              Admin Finance Center
            </p>

            <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
              Platform Treasury
            </h1>

            <p className="mt-2 text-white/70">
              Clear treasury ledger for cash-in received, withdrawals paid, platform fees,
              care service fees, and membership revenue.
            </p>
          </div>

          <button
            onClick={loadTreasury}
            disabled={loading}
            className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-5 py-3 text-sm font-semibold text-[#f7d774] hover:bg-[#d9b45f]/25 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh Treasury"}
          </button>
        </div>

        {message && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Platform Treasury" value={peso(totalPlatformTreasury)} tone="gold" />
          <StatCard label="Cash-In Received" value={peso(cashInReceived)} tone="in" />
          <StatCard label="Withdrawals Paid" value={peso(withdrawalsPaid)} tone="out" />
          <StatCard label="Tree Purchase Fees" value={peso(treePurchaseFees)} tone="gold" />
          <StatCard label="Care Service / Tree Operation" value={peso(careServiceFees)} tone="gold" />
          <StatCard label="Membership Revenue" value={peso(membershipRevenue)} tone="gold" />
          <StatCard label="Net Treasury Movement" value={peso(netTreasuryMovement)} tone={netTreasuryMovement >= 0 ? "in" : "out"} />
          <StatCard label="Treasury Records" value={String(rows.length)} tone="neutral" />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/10 p-5">
          <div className="flex flex-wrap gap-3">
            {tabs.map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`rounded-full px-5 py-3 text-sm font-bold transition ${
                  tab === item.key
                    ? "bg-[#f7d774] text-[#071f16]"
                    : "bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/10">
          {loading ? (
            <div className="p-8 text-white/70">Loading treasury records...</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-8 text-white/70">No treasury records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-[#071f16]/80 text-white/70">
                  <tr>
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Type</th>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Amount</th>
                    <th className="px-5 py-4">Reference</th>
                    <th className="px-5 py-4">Description</th>
                    <th className="px-5 py-4">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRows.map((row) => {
                    const amount = getAmount(row);
                    const type = getType(row);
                    const profileId = row.customer_profile_id || row.profile_id || "";
                    const profile = profileId ? profiles[profileId] : null;

                    return (
                      <tr
                        key={row.id}
                        className="border-t border-white/10 hover:bg-white/5"
                      >
                        <td className="px-5 py-4 text-white/70">
                          {formatDate(row.created_at)}
                        </td>

                        <td className="px-5 py-4">
                          <strong className="block text-white">{friendlyType(type)}</strong>
                          <small className="text-xs text-white/40">{type}</small>
                        </td>

                        <td className="px-5 py-4">
                          <strong className="block text-white">
                            {profile?.full_name || profile?.email || "Customer"}
                          </strong>
                          <small className="break-all text-xs text-white/40">
                            {profile?.email || "No customer email"}
                          </small>
                        </td>

                        <td className="px-5 py-4">
                          <strong
                            className={`block ${
                              amount >= 0 ? "text-emerald-300" : "text-red-300"
                            }`}
                          >
                            {peso(amount)}
                          </strong>
                          <small className="text-xs text-white/40">
                            {amount >= 0 ? "Incoming" : "Outgoing"}
                          </small>
                        </td>

                        <td className="px-5 py-4">
                          <strong className="block text-white/80">
                            {row.reference_no || "Reference"}
                          </strong>
                          <small className="break-all text-xs text-white/40">
                            {row.source_id || row.reference_id || row.id}
                          </small>
                        </td>

                        <td className="px-5 py-4 text-white/70">
                          {row.description || friendlyType(type)}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(
                              row.status
                            )}`}
                          >
                            {normalize(row.status || "POSTED")}
                          </span>
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

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "gold" | "in" | "out" | "neutral";
}) {
  const valueClass =
    tone === "in"
      ? "text-emerald-300"
      : tone === "out"
      ? "text-red-300"
      : tone === "gold"
      ? "text-[#d9b45f]"
      : "text-white";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
      <p className="text-sm text-white/70">{label}</p>
      <p className={`mt-3 text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}
