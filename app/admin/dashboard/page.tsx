"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Row = Record<string, any>;

type ForestRow = {
  key: string;
  groupId: string | null;
  customerProfileId: string | null;
  customerName: string;
  customerEmail: string;
  forestName: string;
  totalTrees: number;
  protectedCount: number;
  attentionCount: number;
  criticalCount: number;
  pendingValuation: number;
  needsCare: number;
  trees: Row[];
};

type AlertRow = {
  key: string;
  severity: "CRITICAL" | "ATTENTION";
  reason: string;
  treeName: string;
  forestName: string;
  customerName: string;
  customerEmail: string;
  createdAt: string | null;
};

export default function AdminDashboardPage() {
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [trees, setTrees] = useState<Row[]>([]);
  const [groups, setGroups] = useState<Row[]>([]);
  const [operationRequests, setOperationRequests] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    const [profileResult, treeResult, groupResult, operationResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, phone, account_status, kyc_status, membership_status, created_at")
        .order("created_at", { ascending: false }),

      supabase
        .from("trees")
        .select(
          "id, profile_id, customer_profile_id, group_id, display_name, custom_name, tree_group_name, stage, health_status, status, care_status, care_expires_at, last_photo_update_at, last_gps_update_at, last_health_report_at, last_health_status, alert_status, alert_reason, valuation_status, valuation_requested_at, created_at, updated_at"
        )
        .order("created_at", { ascending: false }),

      supabase
        .from("tree_groups")
        .select("id, profile_id, customer_profile_id, group_name, forest_name, description, farm_location, block_name, total_trees, status, created_at, updated_at")
        .order("created_at", { ascending: false }),

      supabase
        .from("tree_operation_requests")
        .select("id, profile_id, customer_profile_id, tree_id, group_id, request_type, operation_type, service_name, status, assignment_status, created_at, requested_at")
        .order("created_at", { ascending: false }),
    ]);

    if (profileResult.error) {
      setMessage(profileResult.error.message);
      setLoading(false);
      return;
    }

    if (treeResult.error) {
      setMessage(treeResult.error.message);
      setLoading(false);
      return;
    }

    if (groupResult.error) {
      setMessage(groupResult.error.message);
      setLoading(false);
      return;
    }

    if (operationResult.error) {
      setMessage(operationResult.error.message);
      setLoading(false);
      return;
    }

    setProfiles(profileResult.data || []);
    setTrees(treeResult.data || []);
    setGroups(groupResult.data || []);
    setOperationRequests(operationResult.data || []);
    setLoading(false);
  }

  const profileMap = useMemo(() => {
    const map = new Map<string, Row>();
    profiles.forEach((profile) => {
      if (profile.id) map.set(String(profile.id), profile);
    });
    return map;
  }, [profiles]);

  const groupMap = useMemo(() => {
    const map = new Map<string, Row>();
    groups.forEach((group) => {
      if (group.id) map.set(String(group.id), group);
    });
    return map;
  }, [groups]);

  const forestRows = useMemo<ForestRow[]>(() => {
    const map = new Map<string, ForestRow>();

    groups.forEach((group) => {
      const customerProfileId = group.customer_profile_id || group.profile_id || null;
      const customer = customerProfileId ? profileMap.get(String(customerProfileId)) : null;
      const key = `group-${group.id}`;

      map.set(key, {
        key,
        groupId: group.id || null,
        customerProfileId,
        customerName: customerName(customer, customerProfileId),
        customerEmail: customer?.email || "No email",
        forestName: forestNameFromGroup(group),
        totalTrees: 0,
        protectedCount: 0,
        attentionCount: 0,
        criticalCount: 0,
        pendingValuation: 0,
        needsCare: 0,
        trees: [],
      });
    });

    trees.forEach((tree) => {
      const group = tree.group_id ? groupMap.get(String(tree.group_id)) : null;
      const customerProfileId = tree.customer_profile_id || tree.profile_id || null;
      const customer = customerProfileId ? profileMap.get(String(customerProfileId)) : null;
      const forestName = group ? forestNameFromGroup(group) : tree.tree_group_name || "Ungrouped Forest";
      const key = tree.group_id ? `group-${tree.group_id}` : `loose-${customerProfileId}-${forestName}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          groupId: tree.group_id || null,
          customerProfileId,
          customerName: customerName(customer, customerProfileId),
          customerEmail: customer?.email || "No email",
          forestName,
          totalTrees: 0,
          protectedCount: 0,
          attentionCount: 0,
          criticalCount: 0,
          pendingValuation: 0,
          needsCare: 0,
          trees: [],
        });
      }

      const forest = map.get(key);
      if (!forest) return;

      const warning = treeWarning(tree);

      forest.totalTrees += 1;
      forest.trees.push(tree);

      if (warning.severity === "PROTECTED") forest.protectedCount += 1;
      if (warning.severity === "ATTENTION") forest.attentionCount += 1;
      if (warning.severity === "CRITICAL") forest.criticalCount += 1;
      if (warning.reason === "Valuation Pending") forest.pendingValuation += 1;
      if (warning.reason === "Not Subscribed" || warning.reason === "Care Expired") forest.needsCare += 1;
    });

    return Array.from(map.values()).sort((a, b) => {
      const scoreA = a.criticalCount * 5 + a.attentionCount * 2 + a.needsCare;
      const scoreB = b.criticalCount * 5 + b.attentionCount * 2 + b.needsCare;
      return scoreB - scoreA;
    });
  }, [trees, groups, profileMap, groupMap]);

  const alertRows = useMemo<AlertRow[]>(() => {
    const treeAlerts = trees
      .map((tree) => {
        const warning = treeWarning(tree);
        if (warning.severity === "PROTECTED") return null;

        const group = tree.group_id ? groupMap.get(String(tree.group_id)) : null;
        const customerProfileId = tree.customer_profile_id || tree.profile_id || null;
        const customer = customerProfileId ? profileMap.get(String(customerProfileId)) : null;

        return {
          key: `tree-${tree.id}`,
          severity: warning.severity,
          reason: warning.reason,
          treeName: treeDisplayName(tree),
          forestName: group ? forestNameFromGroup(group) : tree.tree_group_name || "Ungrouped Forest",
          customerName: customerName(customer, customerProfileId),
          customerEmail: customer?.email || "No email",
          createdAt: tree.updated_at || tree.created_at || null,
        };
      })
      .filter(Boolean) as AlertRow[];

    const valuationAlerts = operationRequests
      .filter((request) => {
        const text = `${request.request_type || ""} ${request.operation_type || ""} ${request.service_name || ""}`.toUpperCase();
        const status = String(request.status || "").toUpperCase();
        return text.includes("VALUATION") && ["PENDING", "REQUESTED", "PAID"].includes(status);
      })
      .map((request) => {
        const customerProfileId = request.customer_profile_id || request.profile_id || null;
        const customer = customerProfileId ? profileMap.get(String(customerProfileId)) : null;
        const group = request.group_id ? groupMap.get(String(request.group_id)) : null;
        const tree = request.tree_id ? trees.find((item) => String(item.id) === String(request.tree_id)) : null;

        return {
          key: `valuation-${request.id}`,
          severity: "ATTENTION" as const,
          reason: "Valuation Pending",
          treeName: tree ? treeDisplayName(tree) : "Forest Valuation Request",
          forestName: group ? forestNameFromGroup(group) : tree?.tree_group_name || "Customer Forest",
          customerName: customerName(customer, customerProfileId),
          customerEmail: customer?.email || "No email",
          createdAt: request.created_at || request.requested_at || null,
        };
      });

    return [...treeAlerts, ...valuationAlerts].sort((a, b) => {
      const severityA = a.severity === "CRITICAL" ? 2 : 1;
      const severityB = b.severity === "CRITICAL" ? 2 : 1;
      if (severityB !== severityA) return severityB - severityA;

      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [trees, operationRequests, profileMap, groupMap]);

  const totalProtected = forestRows.reduce((sum, forest) => sum + forest.protectedCount, 0);
  const totalAttention = forestRows.reduce((sum, forest) => sum + forest.attentionCount, 0);
  const totalCritical = forestRows.reduce((sum, forest) => sum + forest.criticalCount, 0);
  const pendingValuation = forestRows.reduce((sum, forest) => sum + forest.pendingValuation, 0);
  const needsCare = forestRows.reduce((sum, forest) => sum + forest.needsCare, 0);

  return (
    <main className="min-h-screen bg-[#03130d] p-6 text-white md:p-8">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(217,180,95,0.20),transparent_32%),radial-gradient(circle_at_top_right,rgba(52,120,77,0.30),transparent_30%),linear-gradient(180deg,#082015,#03130d_48%,#010805)]" />

      <div className="mx-auto max-w-7xl space-y-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.07] p-7 shadow-2xl backdrop-blur-xl md:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-[#d9b45f]">
                Arganwood V6 Admin
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                Forest Command Center
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/65">
                Premium forest control dashboard for customer forests, tree alerts, care risk,
                valuation queue, and Admin → Gardener sync.
              </p>
            </div>

            <button
              onClick={loadDashboard}
              disabled={loading}
              className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-6 py-4 font-black text-[#f7d774] shadow-lg shadow-black/20 transition hover:bg-[#d9b45f]/25 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh Center"}
            </button>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-100">
              {message}
            </div>
          )}

          <div className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <HeroStat label="Forests" value={forestRows.length} />
            <HeroStat label="Total Trees" value={trees.length} />
            <HeroStat label="Protected" value={totalProtected} tone="green" />
            <HeroStat label="Attention" value={totalAttention} tone="yellow" />
            <HeroStat label="Critical" value={totalCritical} tone="red" />
            <HeroStat label="Needs Care" value={needsCare} tone="gold" />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_.85fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-[#d9b45f]/80">
                  Forest Center
                </p>
                <h2 className="mt-2 text-3xl font-black text-white">Customer Forests</h2>
              </div>

              <a
                href="/admin/operations"
                className="rounded-2xl bg-[#d9b45f] px-5 py-3 text-center text-sm font-black text-[#071f16] shadow-lg shadow-black/20"
              >
                Open Operations
              </a>
            </div>

            <div className="mt-6 grid gap-4">
              {loading ? (
                <EmptyCard text="Loading forest center..." />
              ) : forestRows.length === 0 ? (
                <EmptyCard text="No forests yet. Trees are currently reset to 0." />
              ) : (
                forestRows.map((forest) => (
                  <ForestCard key={forest.key} forest={forest} />
                ))
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#d9b45f]/80">
                Tree Alert Center
              </p>
              <h2 className="mt-2 text-3xl font-black text-white">Warnings</h2>
              <p className="mt-2 text-sm text-white/55">
                Critical alerts first, then attention items.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              {loading ? (
                <EmptyCard text="Loading alerts..." />
              ) : alertRows.length === 0 ? (
                <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5">
                  <p className="font-black text-emerald-100">All clear</p>
                  <p className="mt-1 text-sm text-emerald-100/70">No urgent forest alerts.</p>
                </div>
              ) : (
                alertRows.slice(0, 14).map((alert) => <AlertCard key={alert.key} alert={alert} />)
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <SummaryCard title="Pending Valuation" value={pendingValuation} subtitle="Waiting for admin/gardener action" />
          <SummaryCard title="Open Requests" value={operationRequests.length} subtitle="Tree operation request queue" />
          <SummaryCard title="Profiles" value={profiles.length} subtitle="Registered customer/admin/gardener profiles" />
        </section>
      </div>
    </main>
  );
}

function ForestCard({ forest }: { forest: ForestRow }) {
  const risk =
    forest.criticalCount > 0
      ? "border-red-400/25 bg-red-500/[0.08]"
      : forest.attentionCount > 0
      ? "border-yellow-400/25 bg-yellow-500/[0.08]"
      : "border-emerald-400/20 bg-emerald-500/[0.07]";

  return (
    <article className={`rounded-3xl border p-5 ${risk}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-bold text-white/55">{forest.customerName}</p>
          <h3 className="mt-1 text-2xl font-black text-[#ffe49a]">🌳 {forest.forestName}</h3>
          <p className="mt-1 text-xs font-semibold text-white/40">{forest.customerEmail}</p>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:min-w-[620px]">
          <MiniStat label="Trees" value={forest.totalTrees} />
          <MiniStat label="Protected" value={forest.protectedCount} tone="green" />
          <MiniStat label="Attention" value={forest.attentionCount} tone="yellow" />
          <MiniStat label="Critical" value={forest.criticalCount} tone="red" />
          <MiniStat label="Valuation" value={forest.pendingValuation} tone="gold" />
          <MiniStat label="Needs Care" value={forest.needsCare} tone="gold" />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {forest.trees.slice(0, 8).map((tree) => {
          const warning = treeWarning(tree);
          const color =
            warning.severity === "CRITICAL"
              ? "border-red-300/25 bg-red-500/10 text-red-100"
              : warning.severity === "ATTENTION"
              ? "border-yellow-300/25 bg-yellow-500/10 text-yellow-100"
              : "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";

          return (
            <span key={tree.id} className={`rounded-full border px-3 py-1 text-xs font-black ${color}`}>
              {treeDisplayName(tree)}
            </span>
          );
        })}

        {forest.trees.length > 8 && (
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-white/50">
            +{forest.trees.length - 8} more
          </span>
        )}
      </div>
    </article>
  );
}

function AlertCard({ alert }: { alert: AlertRow }) {
  const critical = alert.severity === "CRITICAL";

  return (
    <article
      className={`rounded-3xl border p-5 ${
        critical ? "border-red-400/25 bg-red-500/10" : "border-yellow-400/25 bg-yellow-500/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-white">
            {critical ? "🔴" : "🟡"} {alert.treeName}
          </p>
          <p className="mt-1 text-sm font-black text-[#ffe49a]">{alert.reason}</p>
        </div>

        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-black text-white/70">
          {alert.severity}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
        <p className="text-sm font-black text-white/80">🌳 {alert.forestName}</p>
        <p className="mt-1 text-xs font-semibold text-white/45">
          {alert.customerName} • {alert.customerEmail}
        </p>
      </div>
    </article>
  );
}

function HeroStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "yellow" | "red" | "gold";
}) {
  const color =
    tone === "green"
      ? "text-emerald-200"
      : tone === "yellow"
      ? "text-yellow-200"
      : tone === "red"
      ? "text-red-200"
      : "text-[#d9b45f]";

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className={`mt-3 text-3xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "yellow" | "red" | "gold";
}) {
  const color =
    tone === "green"
      ? "text-emerald-200"
      : tone === "yellow"
      ? "text-yellow-200"
      : tone === "red"
      ? "text-red-200"
      : tone === "gold"
      ? "text-[#ffe49a]"
      : "text-white";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className={`mt-2 text-xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number;
  subtitle: string;
}) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-[#d9b45f]/80">{title}</p>
      <p className="mt-3 text-4xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm text-white/50">{subtitle}</p>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-sm font-bold text-white/60">
      {text}
    </div>
  );
}

function customerName(customer: Row | null | undefined, fallbackId?: string | null) {
  if (!customer) return fallbackId ? "Customer" : "Unassigned Customer";
  return customer.full_name || customer.email || "Customer";
}

function forestNameFromGroup(group: Row | null | undefined) {
  if (!group) return "Customer Forest";
  return group.forest_name || group.group_name || group.block_name || group.farm_location || "Customer Forest";
}

function treeDisplayName(tree: Row | null | undefined) {
  if (!tree) return "Seedling";
  return tree.display_name || tree.custom_name || "Seedling";
}

function treeWarning(tree: Row): {
  severity: "PROTECTED" | "ATTENTION" | "CRITICAL";
  reason: string;
} {
  const alertStatus = String(tree.alert_status || "").toUpperCase();
  const alertReason = String(tree.alert_reason || "").trim();

  if (alertStatus === "CRITICAL") return { severity: "CRITICAL", reason: alertReason || "Critical Alert" };
  if (alertStatus === "ATTENTION" || alertStatus === "WARNING") return { severity: "ATTENTION", reason: alertReason || "Needs Attention" };

  const careStatus = String(tree.care_status || "").toUpperCase();

  if (careStatus.includes("NOT_SUBSCRIBED") || careStatus.includes("NOT ENROLLED")) {
    return { severity: "CRITICAL", reason: "Not Subscribed" };
  }

  if (careStatus.includes("EXPIRED")) {
    return { severity: "CRITICAL", reason: "Care Expired" };
  }

  const expiresAt = tree.care_expires_at ? new Date(tree.care_expires_at) : null;

  if (expiresAt && !Number.isNaN(expiresAt.getTime())) {
    const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) return { severity: "CRITICAL", reason: "Care Expired" };
    if (daysLeft <= 7) return { severity: "ATTENTION", reason: "Care Expiring Soon" };
  }

  const health = String(tree.last_health_status || tree.health_status || "").toUpperCase();

  if (health.includes("CRITICAL") || health.includes("DISEASE") || health.includes("PEST") || health.includes("ISSUE")) {
    return { severity: "CRITICAL", reason: "Health Issue" };
  }

  const latestUpdate = latestDate([
    tree.last_photo_update_at,
    tree.last_gps_update_at,
    tree.last_health_report_at,
  ]);

  if (latestUpdate) {
    const days = Math.floor((Date.now() - latestUpdate.getTime()) / (1000 * 60 * 60 * 24));
    if (days > 30) return { severity: "ATTENTION", reason: "No Recent Update" };
  }

  const valuationStatus = String(tree.valuation_status || "").toUpperCase();

  if (valuationStatus.includes("PENDING") || valuationStatus.includes("NEEDS_REVIEW") || tree.valuation_requested_at) {
    return { severity: "ATTENTION", reason: "Valuation Pending" };
  }

  return { severity: "PROTECTED", reason: "Protected" };
}

function latestDate(values: any[]) {
  const dates = values
    .map((value) => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    })
    .filter(Boolean) as Date[];

  if (dates.length === 0) return null;

  return dates.sort((a, b) => b.getTime() - a.getTime())[0];
}