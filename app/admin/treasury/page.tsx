"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TreasuryRow = Record<string, any>;

type TabKey =
  | "ALL"
  | "MEMBERSHIP"
  | "TREE_PURCHASE"
  | "MARKETPLACE"
  | "CARE_PROGRAM"
  | "SELL_TREE"
  | "OPERATION";

export default function AdminTreasuryPage() {
  const [rows, setRows] = useState<TreasuryRow[]>([]);
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
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows(data || []);
    setLoading(false);
  }

  function getSource(row: TreasuryRow) {
    return String(row.source || row.transaction_type || row.type || "OTHER").toUpperCase();
  }

  function getAmount(row: TreasuryRow) {
    return Number(row.amount || row.total_amount || row.net_amount || 0);
  }

  function matchesTab(row: TreasuryRow) {
    if (tab === "ALL") return true;
    return getSource(row).includes(tab);
  }

  const filteredRows = useMemo(() => rows.filter(matchesTab), [rows, tab]);

  const totalTreasury = useMemo(
    () => rows.reduce((sum, row) => sum + getAmount(row), 0),
    [rows]
  );

  const filteredTotal = useMemo(
    () => filteredRows.reduce((sum, row) => sum + getAmount(row), 0),
    [filteredRows]
  );

  function sourceTotal(keyword: string) {
    return rows
      .filter((row) => getSource(row).includes(keyword))
      .reduce((sum, row) => sum + getAmount(row), 0);
  }

  function peso(value: number) {
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

  function badgeClass(statusValue: any) {
    const status = String(statusValue || "RECEIVED").toUpperCase();

    if (status === "RECEIVED" || status === "PAID" || status === "COMPLETED") {
      return "border-emerald-400/30 bg-emerald-500/20 text-emerald-200";
    }

    if (status === "PENDING" || status === "PROCESSING") {
      return "border-yellow-400/30 bg-yellow-500/20 text-yellow-200";
    }

    if (status === "FAILED" || status === "REJECTED") {
      return "border-red-400/30 bg-red-500/20 text-red-200";
    }

    return "border-white/10 bg-white/10 text-white/60";
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
              Platform Treasury
            </h1>

            <p className="mt-2 text-white/70">
              Track platform revenue, fees, purchase income, care program income, and operation income.
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

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard label="Total Treasury" value={peso(totalTreasury)} />
          <StatCard label="Filtered Total" value={peso(filteredTotal)} />
          <StatCard label="Records" value={String(rows.length)} />
          <StatCard label="Visible Records" value={String(filteredRows.length)} />
          <StatCard label="Membership" value={peso(sourceTotal("MEMBERSHIP"))} />
          <StatCard label="Tree Purchase" value={peso(sourceTotal("TREE_PURCHASE"))} />
          <StatCard label="Care Program" value={peso(sourceTotal("CARE_PROGRAM"))} />
          <StatCard label="Operations" value={peso(sourceTotal("OPERATION"))} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/10 p-5">
          <div className="flex flex-wrap gap-3">
            {[
              "ALL",
              "MEMBERSHIP",
              "TREE_PURCHASE",
              "MARKETPLACE",
              "CARE_PROGRAM",
              "SELL_TREE",
              "OPERATION",
            ].map((item) => (
              <button
                key={item}
                onClick={() => setTab(item as TabKey)}
                className={`rounded-full px-5 py-3 text-sm font-bold transition ${
                  tab === item
                    ? "bg-[#f7d774] text-[#071f16]"
                    : "bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                {item.replace("_", " ")}
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
                    <th className="px-5 py-4">Source</th>
                    <th className="px-5 py-4">Amount</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Profile</th>
                    <th className="px-5 py-4">Reference</th>
                    <th className="px-5 py-4">Description</th>
                    <th className="px-5 py-4">Created</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-white/10 hover:bg-white/5"
                    >
                      <td className="px-5 py-4 font-bold text-white">
                        {getSource(row)}
                      </td>

                      <td className="px-5 py-4 font-bold text-[#f7d774]">
                        {peso(getAmount(row))}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(
                            row.status
                          )}`}
                        >
                          {String(row.status || "RECEIVED").toUpperCase()}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-white/70">
                        {row.profile_id || "—"}
                      </td>

                      <td className="px-5 py-4 text-white/70">
                        {row.reference_id || row.reference_no || row.request_id || "—"}
                      </td>

                      <td className="px-5 py-4 text-white/70">
                        {row.description || row.notes || "—"}
                      </td>

                      <td className="px-5 py-4 text-white/70">
                        {formatDate(row.created_at)}
                      </td>
                    </tr>
                  ))}
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