"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Row = Record<string, any>;

type LoadResult = {
  profiles: Row[];
  trees: Row[];
  groups: Row[];
  operations: Row[];
  caretakers: Row[];
  assignments: Row[];
  tasks: Row[];
  memberships: Row[];
  cashins: Row[];
  cashouts: Row[];
  sellRequests: Row[];
  treasury: Row[];
  supportTickets: Row[];
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<LoadResult>({
    profiles: [],
    trees: [],
    groups: [],
    operations: [],
    caretakers: [],
    assignments: [],
    tasks: [],
    memberships: [],
    cashins: [],
    cashouts: [],
    sellRequests: [],
    treasury: [],
    supportTickets: [],
  });

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function safeRows(label: string, query: PromiseLike<any>) {
    const { data, error } = await query;

    if (error) {
      console.warn(`${label} dashboard load skipped:`, error.message);
      return [];
    }

    return data || [];
  }

  async function loadDashboard() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      setMessage(userError.message);
      setLoading(false);
      return;
    }

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const email = user.email?.trim().toLowerCase() || "";

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", email)
      .maybeSingle();

    const adminProfile = profileById || profileByEmail;

    if (!adminProfile) {
      setMessage("Admin profile not found.");
      setLoading(false);
      return;
    }

    const { data: adminRow } = await supabase
      .from("admins")
      .select("id, admin_profile_id, email, status")
      .eq("admin_profile_id", adminProfile.id)
      .maybeSingle();

    const fallbackAdmin = String(adminProfile.email || "").toLowerCase() === "admin@test.com";

    if (!adminRow && !fallbackAdmin) {
      setMessage("Admin access not found.");
      setLoading(false);
      return;
    }

    const [
      profiles,
      trees,
      groups,
      operations,
      caretakers,
      assignments,
      tasks,
      memberships,
      cashins,
      cashouts,
      sellRequests,
      treasury,
      supportTickets,
    ] = await Promise.all([
      safeRows(
        "profiles",
        supabase
          .from("profiles")
          .select("id, full_name, email, phone, account_status, kyc_status, membership_status, created_at")
          .order("created_at", { ascending: false })
      ),

      safeRows(
        "trees",
        supabase
          .from("trees")
          .select(
            "id, profile_id, customer_profile_id, group_id, display_name, custom_name, tree_code, tree_qr_code, tree_qr_url, qr_tag_status, tree_group_name, stage, health_status, status, care_status, care_expires_at, valuation_status, valuation_requested_at, created_at, updated_at"
          )
          .order("created_at", { ascending: false })
      ),

      safeRows(
        "tree_groups",
        supabase
          .from("tree_groups")
          .select("id, profile_id, customer_profile_id, group_name, forest_name, farm_location, block_name, total_trees, status, created_at, updated_at")
          .order("created_at", { ascending: false })
      ),

      safeRows(
        "tree_operation_requests",
        supabase
          .from("tree_operation_requests")
          .select("id, profile_id, customer_profile_id, tree_id, group_id, request_type, operation_type, service_name, status, assignment_status, caretaker_id, total_amount, amount, created_at, requested_at, assigned_at, completed_at")
          .order("created_at", { ascending: false })
      ),

      safeRows(
        "caretakers",
        supabase
          .from("caretakers")
          .select("id, caretaker_profile_id, full_name, email, phone, status, assigned_area, created_at")
          .order("created_at", { ascending: false })
      ),

      safeRows(
        "caretaker_assignments",
        supabase
          .from("caretaker_assignments")
          .select("id, caretaker_id, caretaker_profile_id, operation_request_id, customer_profile_id, tree_id, group_id, status, assigned_at, started_at, submitted_at, completed_at, created_at, updated_at")
          .order("created_at", { ascending: false })
      ),

      safeRows(
        "caretaker_task_logs",
        supabase
          .from("caretaker_task_logs")
          .select("id, caretaker_id, caretaker_profile_id, operation_request_id, assignment_id, task_type, source_type, evidence_status, status, created_at, started_at, submitted_at, completed_at, updated_at")
          .order("created_at", { ascending: false })
      ),

      safeRows(
        "membership_orders",
        supabase
          .from("membership_orders")
          .select("id, profile_id, plan_name, annual_fee, amount, status, payment_status, submitted_at, approved_at, created_at")
          .order("created_at", { ascending: false })
      ),

      safeRows(
        "cashin_requests",
        supabase
          .from("cashin_requests")
          .select("id, profile_id, amount, status, payment_method, reference_no, created_at, approved_at")
          .order("created_at", { ascending: false })
      ),

      safeRows(
        "withdrawal_requests",
        supabase
          .from("withdrawal_requests")
          .select("id, profile_id, amount, net_amount, fee_amount, status, created_at, approved_at, paid_at")
          .order("created_at", { ascending: false })
      ),

      safeRows(
        "sell_tree_requests",
        supabase
          .from("sell_tree_requests")
          .select("id, profile_id, customer_profile_id, tree_id, status, offer_status, asking_price, offer_amount, created_at, updated_at")
          .order("created_at", { ascending: false })
      ),

      safeRows(
        "platform_treasury",
        supabase
          .from("platform_treasury")
          .select("*")
          .order("created_at", { ascending: false })
      ),

      safeRows(
        "support_tickets",
        supabase
          .from("support_tickets")
          .select("id, profile_id, customer_profile_id, subject, status, priority, created_at, updated_at")
          .order("created_at", { ascending: false })
      ),
    ]);

    setData({
      profiles,
      trees,
      groups,
      operations,
      caretakers,
      assignments,
      tasks,
      memberships,
      cashins,
      cashouts,
      sellRequests,
      treasury,
      supportTickets,
    });

    setLoading(false);
  }

  const summary = useMemo(() => {
    const operations = data.operations;
    const tasks = data.tasks;
    const assignments = data.assignments;

    const pendingOperations = operations.filter((row) => {
      const status = normalize(row.status);
      const assignmentStatus = normalize(row.assignment_status);
      return (
        status === "PENDING" ||
        status === "REQUESTED" ||
        status === "PAID" ||
        assignmentStatus === "NOT_ASSIGNED" ||
        assignmentStatus === "PENDING" ||
        assignmentStatus === ""
      );
    }).length;

    const submittedTasks = tasks.filter((row) => {
      const status = normalize(row.status);
      const evidenceStatus = normalize(row.evidence_status);
      return status === "SUBMITTED" || evidenceStatus === "SUBMITTED";
    }).length;

    const pendingMemberships = data.memberships.filter((row) => normalize(row.status) === "PENDING").length;
    const pendingCashin = data.cashins.filter((row) => normalize(row.status) === "PENDING").length;
    const pendingCashout = data.cashouts.filter((row) => ["PENDING", "PROCESSING"].includes(normalize(row.status))).length;
    const pendingSellTree = data.sellRequests.filter((row) => ["PENDING", "REQUESTED", "UNDER_REVIEW", "OFFER_SENT"].includes(normalize(row.status))).length;

    const qrPending = data.trees.filter((tree) => {
      const qrStatus = normalize(tree.qr_tag_status);
      return !tree.tree_qr_url || !tree.tree_qr_code || qrStatus === "" || qrStatus === "PENDING" || qrStatus === "PENDING_TAG";
    }).length;

    const supportTickets = data.supportTickets.filter((ticket) => {
      const status = normalize(ticket.status);
      return status !== "CLOSED" && status !== "RESOLVED";
    }).length;

    const assigned = countStatus([...operations, ...assignments], "ASSIGNED");
    const inProgress = countStatus([...operations, ...assignments, ...tasks], "IN_PROGRESS");
    const submitted = submittedTasks;
    const completed = countStatus([...operations, ...assignments, ...tasks], "COMPLETED");

    const activeGardeners = data.caretakers.filter((row) => normalize(row.status) === "ACTIVE").length;
    const tasksAssigned = tasks.filter((row) => normalize(row.status) === "ASSIGNED").length;

    const totalTreasury = data.treasury.reduce((sum, row) => sum + moneyValue(row), 0);
    const todayRevenue = data.treasury
      .filter((row) => isToday(row.created_at))
      .reduce((sum, row) => sum + moneyValue(row), 0);

    const membershipRevenue = data.treasury
      .filter((row) => rowText(row).includes("MEMBERSHIP"))
      .reduce((sum, row) => sum + moneyValue(row), 0);

    const marketplaceFees = data.treasury
      .filter((row) => {
        const text = rowText(row);
        return text.includes("MARKETPLACE") || text.includes("TREE_PURCHASE") || text.includes("TECHNICAL_FEE") || text.includes("PLATFORM_FEE");
      })
      .reduce((sum, row) => sum + moneyValue(row), 0);

    return {
      pendingOperations,
      submittedTasks,
      pendingMemberships,
      pendingCashin,
      pendingCashout,
      pendingSellTree,
      qrPending,
      supportTickets,
      assigned,
      inProgress,
      submitted,
      completed,
      activeGardeners,
      tasksAssigned,
      totalTreasury,
      todayRevenue,
      membershipRevenue,
      marketplaceFees,
    };
  }, [data]);

  const latestOperations = data.operations.slice(0, 5);
  const latestTasks = data.tasks.slice(0, 5);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#03130d] p-4 text-white md:p-8">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(217,180,95,0.20),transparent_32%),radial-gradient(circle_at_top_right,rgba(52,120,77,0.30),transparent_30%),linear-gradient(180deg,#082015,#03130d_48%,#010805)]" />

      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 shadow-2xl backdrop-blur-xl md:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-[#d9b45f]">
                Arganwood Admin
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                Forest Command Center
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/65">
                Action-first control center for operations, QR tagging, memberships, treasury, gardeners, and customer support.
              </p>
            </div>

            <button
              onClick={loadDashboard}
              disabled={loading}
              className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-6 py-4 font-black text-[#f7d774] transition hover:bg-[#d9b45f]/25 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh Dashboard"}
            </button>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-100">
              {message}
            </div>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AttentionCard title="Pending Operations" value={summary.pendingOperations} href="/admin/operations" action="Assign gardener" />
          <AttentionCard title="Tasks for Review" value={summary.submittedTasks} href="/admin/operations" action="Review evidence" tone="purple" />
          <AttentionCard title="Pending Membership" value={summary.pendingMemberships} href="/admin/membership" action="Approve access" />
          <AttentionCard title="QR Tags Pending" value={summary.qrPending} href="/admin/qr-tags" action="Print / install QR" tone="green" />
          <AttentionCard title="Pending Cash-In" value={summary.pendingCashin} href="/admin/cash-in" action="Verify payment" />
          <AttentionCard title="Pending Cash-Out" value={summary.pendingCashout} href="/admin/withdrawals" action="Process payout" tone="red" />
          <AttentionCard title="Pending Sell Tree" value={summary.pendingSellTree} href="/admin/sell-tree" action="Review offer" />
          <AttentionCard title="Support Tickets" value={summary.supportTickets} href="/admin/support" action="Reply customer" tone="blue" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-[#d9b45f]/80">
                  Operations Snapshot
                </p>
                <h2 className="mt-2 text-3xl font-black text-white">Admin → Gardener Flow</h2>
              </div>

              <Link
                href="/admin/operations"
                className="rounded-2xl bg-[#d9b45f] px-5 py-3 text-center text-sm font-black text-[#071f16]"
              >
                Open Operations Queue
              </Link>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Assigned" value={summary.assigned} />
              <Metric label="In Progress" value={summary.inProgress} tone="yellow" />
              <Metric label="Submitted" value={summary.submitted} tone="purple" />
              <Metric label="Completed" value={summary.completed} tone="green" />
            </div>

            <div className="mt-6 space-y-3">
              {loading ? (
                <EmptyCard text="Loading operations..." />
              ) : latestOperations.length === 0 ? (
                <EmptyCard text="No operation requests yet." />
              ) : (
                latestOperations.map((row) => (
                  <QueueRow
                    key={row.id}
                    title={serviceName(row)}
                    subtitle={`${friendlyStatus(row.status || row.assignment_status)} • ${formatDate(row.created_at || row.requested_at)}`}
                    href="/admin/operations"
                  />
                ))
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#d9b45f]/80">
              Gardener Snapshot
            </p>
            <h2 className="mt-2 text-3xl font-black text-white">Field Team</h2>

            <div className="mt-6 grid gap-4">
              <Metric label="Active Gardeners" value={summary.activeGardeners} tone="green" />
              <Metric label="Tasks Assigned" value={summary.tasksAssigned} />
              <Metric label="Submitted Tasks" value={summary.submittedTasks} tone="purple" />
            </div>

            <div className="mt-6 space-y-3">
              {latestTasks.length === 0 ? (
                <EmptyCard text="No gardener task logs yet." />
              ) : (
                latestTasks.map((task) => (
                  <QueueRow
                    key={task.id}
                    title={task.task_type || task.source_type || "Gardener Task"}
                    subtitle={`${friendlyStatus(task.status)} • Evidence ${friendlyStatus(task.evidence_status)}`}
                    href="/admin/operations"
                  />
                ))
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-4">
          <TreasuryCard title="Platform Treasury" value={peso(summary.totalTreasury)} href="/admin/treasury" />
          <TreasuryCard title="Today Revenue" value={peso(summary.todayRevenue)} href="/admin/treasury" />
          <TreasuryCard title="Membership Revenue" value={peso(summary.membershipRevenue)} href="/admin/membership" />
          <TreasuryCard title="Marketplace / Fees" value={peso(summary.marketplaceFees)} href="/admin/treasury" />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <NavCard title="Customers" href="/admin/customers" description="Profiles, KYC, account status" />
          <NavCard title="Memberships" href="/admin/membership" description="Annual membership approvals" />
          <NavCard title="Caretakers" href="/admin/caretakers" description="Gardener records and status" />
          <NavCard title="Caretaker Hires" href="/admin/caretaker-hires" description="Customer hire requests" />
          <NavCard title="Forests / Trees" href="/admin/tree-purchases" description="Tree purchase records" />
          <NavCard title="Sell Requests" href="/admin/sell-tree" description="Tree sale review queue" />
          <NavCard title="Cash-In" href="/admin/cash-in" description="Customer funding approvals" />
          <NavCard title="Cash-Out" href="/admin/withdrawals" description="Withdrawal processing" />
          <NavCard title="Wallet" href="/admin/wallet" description="Wallet records and history" />
          <NavCard title="Reports" href="/admin/reports" description="Operational summaries" />
          <NavCard title="Analytics" href="/admin/analytics" description="Performance view" />
          <NavCard title="Treasury" href="/admin/treasury" description="Platform treasury records" />
        </section>
      </div>
    </main>
  );
}

function AttentionCard({
  title,
  value,
  href,
  action,
  tone,
}: {
  title: string;
  value: number;
  href: string;
  action: string;
  tone?: "green" | "purple" | "red" | "blue";
}) {
  const color =
    tone === "green"
      ? "text-emerald-200"
      : tone === "purple"
      ? "text-purple-200"
      : tone === "red"
      ? "text-red-200"
      : tone === "blue"
      ? "text-blue-200"
      : "text-[#d9b45f]";

  return (
    <Link
      href={href}
      className="rounded-[1.6rem] border border-white/10 bg-white/[0.07] p-5 text-white no-underline shadow-2xl backdrop-blur-xl transition hover:border-[#d9b45f]/40 hover:bg-white/[0.10]"
    >
      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">{title}</p>
      <p className={`mt-3 text-4xl font-black ${color}`}>{value}</p>
      <p className="mt-2 text-sm font-bold text-white/55">{action}</p>
    </Link>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "yellow" | "purple";
}) {
  const color =
    tone === "green"
      ? "text-emerald-200"
      : tone === "yellow"
      ? "text-yellow-200"
      : tone === "purple"
      ? "text-purple-200"
      : "text-[#d9b45f]";

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className={`mt-3 text-3xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function TreasuryCard({ title, value, href }: { title: string; value: string; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-[2rem] border border-[#d9b45f]/20 bg-[#d9b45f]/10 p-6 text-white no-underline shadow-2xl backdrop-blur-xl transition hover:bg-[#d9b45f]/15"
    >
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ffe49a]/70">{title}</p>
      <p className="mt-3 break-words text-3xl font-black text-[#ffe49a]">{value}</p>
    </Link>
  );
}

function NavCard({ title, href, description }: { title: string; href: string; description: string }) {
  return (
    <Link
      href={href}
      className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5 text-white no-underline transition hover:border-[#d9b45f]/35 hover:bg-white/[0.07]"
    >
      <p className="text-lg font-black text-white">{title}</p>
      <p className="mt-2 text-sm font-semibold leading-relaxed text-white/50">{description}</p>
    </Link>
  );
}

function QueueRow({ title, subtitle, href }: { title: string; subtitle: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-white no-underline transition hover:bg-white/[0.06]"
    >
      <div className="min-w-0">
        <p className="break-words font-black text-white">{title}</p>
        <p className="mt-1 break-words text-sm font-semibold text-white/45">{subtitle}</p>
      </div>
      <span className="shrink-0 rounded-full border border-[#d9b45f]/20 bg-[#d9b45f]/10 px-3 py-1 text-xs font-black text-[#ffe49a]">
        Open
      </span>
    </Link>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-sm font-bold text-white/60">
      {text}
    </div>
  );
}

function normalize(value: any) {
  return String(value || "").trim().replace(/\s+/g, "_").toUpperCase();
}

function friendlyStatus(value: any) {
  const status = normalize(value || "PENDING");
  return status.replaceAll("_", " ");
}

function countStatus(rows: Row[], target: string) {
  return rows.filter((row) => normalize(row.status || row.assignment_status) === target).length;
}

function serviceName(row: Row) {
  return row.service_name || row.operation_type || row.request_type || "Tree Operation";
}

function moneyValue(row: Row) {
  return Number(row.amount || row.total_amount || row.platform_fee || row.fee_amount || row.net_amount || 0);
}

function rowText(row: Row) {
  return Object.values(row)
    .join(" ")
    .toUpperCase();
}

function isToday(value: any) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function peso(value: number) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: any) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}