"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Row = Record<string, any>;

type Filter = "ALL" | "PROTECTED" | "ATTENTION" | "CRITICAL";

type PortfolioTree = {
  key: string;
  assignment: Row | null;
  task: Row | null;
  tree: Row | null;
  group: Row | null;
  customer: Row | null;
  status: string;
  taskStatus: string;
  careStatus: string;
  warning: {
    severity: "PROTECTED" | "ATTENTION" | "CRITICAL";
    reason: string;
  };
  treeId: string | null;
  groupId: string | null;
  customerProfileId: string | null;
  assignmentId: string | null;
  operationRequestId: string | null;
  lastUpdate: string | null;
};

type ForestPortfolio = {
  key: string;
  groupId: string | null;
  forestName: string;
  customerName: string;
  customerEmail: string;
  totalTrees: number;
  protectedCount: number;
  attentionCount: number;
  criticalCount: number;
  assignedCount: number;
  inProgressCount: number;
  submittedCount: number;
  completedCount: number;
  lastUpdate: string | null;
  trees: PortfolioTree[];
};

export default function GardenerAssignedTreesPage() {
  const [caretaker, setCaretaker] = useState<Row | null>(null);
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [taskLogs, setTaskLogs] = useState<Row[]>([]);
  const [requests, setRequests] = useState<Row[]>([]);
  const [trees, setTrees] = useState<Row[]>([]);
  const [groups, setGroups] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/login";
      return;
    }

    const email = user.email?.trim() || "";
    const lowerEmail = email.toLowerCase();

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", lowerEmail)
      .maybeSingle();

    const profile = profileById || profileByEmail;

    const { data: caretakerByProfile, error: caretakerProfileError } = profile?.id
      ? await supabase
          .from("caretakers")
          .select("*")
          .eq("caretaker_profile_id", profile.id)
          .maybeSingle()
      : { data: null, error: null };

    if (caretakerProfileError) {
      setMessage(caretakerProfileError.message);
      setLoading(false);
      return;
    }

    const { data: caretakerByLowerEmail, error: lowerError } = await supabase
      .from("caretakers")
      .select("*")
      .eq("email", lowerEmail)
      .maybeSingle();

    if (lowerError) {
      setMessage(lowerError.message);
      setLoading(false);
      return;
    }

    const { data: caretakerByExactEmail, error: exactError } = await supabase
      .from("caretakers")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (exactError) {
      setMessage(exactError.message);
      setLoading(false);
      return;
    }

    const { data: caretakerByEmailFallback, error: fallbackError } = await supabase
      .from("caretakers")
      .select("*")
      .ilike("email", email)
      .maybeSingle();

    if (fallbackError) {
      setMessage(fallbackError.message);
      setLoading(false);
      return;
    }

    const caretakerRow =
      caretakerByProfile ||
      caretakerByLowerEmail ||
      caretakerByExactEmail ||
      caretakerByEmailFallback;

    if (!caretakerRow) {
      setMessage("Caretaker profile not found. Ask admin to create your gardener account.");
      setLoading(false);
      return;
    }

    if (String(caretakerRow.status || "").toUpperCase() !== "ACTIVE") {
      setMessage("Your gardener account is not ACTIVE. Please contact admin.");
      setLoading(false);
      return;
    }

    setCaretaker(caretakerRow);

    const assignmentFilters = [
      `caretaker_id.eq.${caretakerRow.id}`,
      caretakerRow.caretaker_profile_id
        ? `caretaker_profile_id.eq.${caretakerRow.caretaker_profile_id}`
        : "",
    ].filter(Boolean);

    const taskFilters = [
      `caretaker_id.eq.${caretakerRow.id}`,
      caretakerRow.caretaker_profile_id
        ? `caretaker_profile_id.eq.${caretakerRow.caretaker_profile_id}`
        : "",
    ].filter(Boolean);

    const { data: assignmentRows, error: assignmentError } = await supabase
      .from("caretaker_assignments")
      .select("*")
      .or(assignmentFilters.join(","))
      .order("created_at", { ascending: false });

    if (assignmentError) {
      setMessage(assignmentError.message);
      setLoading(false);
      return;
    }

    const { data: taskRows, error: taskError } = await supabase
      .from("caretaker_task_logs")
      .select("*")
      .or(taskFilters.join(","))
      .order("created_at", { ascending: false });

    if (taskError) {
      setMessage(taskError.message);
      setLoading(false);
      return;
    }

    const safeAssignments = assignmentRows || [];
    const safeTasks = taskRows || [];

    const operationRequestIds = uniqueStrings([
      ...safeAssignments.map((item) => item.operation_request_id),
      ...safeTasks.map((item) => item.operation_request_id),
    ]);

    let requestRows: Row[] = [];

    if (operationRequestIds.length > 0) {
      const { data, error } = await supabase
        .from("tree_operation_requests")
        .select("*")
        .in("id", operationRequestIds)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Assigned trees request load warning:", error.message);
      } else {
        requestRows = data || [];
      }
    }

    const directTreeIds = uniqueStrings([
      ...safeAssignments.map((item) => item.tree_id),
      ...safeTasks.map((item) => item.tree_id),
      ...requestRows.map((item) => item.tree_id),
    ]);

    const directGroupIds = uniqueStrings([
      ...safeAssignments.map((item) => item.group_id),
      ...safeTasks.map((item) => item.group_id),
      ...requestRows.map((item) => item.group_id),
    ]);

    let directTrees: Row[] = [];

    if (directTreeIds.length > 0) {
      const { data, error } = await supabase
        .from("trees")
        .select("*")
        .in("id", directTreeIds);

      if (error) {
        console.warn("Assigned trees direct tree load warning:", error.message);
      } else {
        directTrees = data || [];
      }
    }

    const derivedGroupIds = uniqueStrings([
      ...directGroupIds,
      ...directTrees.map((item) => item.group_id),
    ]);

    let groupRows: Row[] = [];

    if (derivedGroupIds.length > 0) {
      const { data, error } = await supabase
        .from("tree_groups")
        .select("*")
        .in("id", derivedGroupIds);

      if (error) {
        console.warn("Assigned trees group load warning:", error.message);
      } else {
        groupRows = data || [];
      }
    }

    let forestTrees: Row[] = [];

    if (derivedGroupIds.length > 0) {
      const { data, error } = await supabase
        .from("trees")
        .select("*")
        .in("group_id", derivedGroupIds)
        .order("display_name", { ascending: true });

      if (error) {
        console.warn("Assigned trees forest tree load warning:", error.message);
      } else {
        forestTrees = data || [];
      }
    }

    const allTrees = mergeById([...directTrees, ...forestTrees]);

    const customerIds = uniqueStrings([
      ...safeAssignments.map((item) => item.customer_profile_id),
      ...safeTasks.map((item) => item.customer_profile_id),
      ...requestRows.map((item) => item.customer_profile_id),
      ...requestRows.map((item) => item.profile_id),
      ...allTrees.map((item) => item.customer_profile_id),
      ...allTrees.map((item) => item.profile_id),
      ...groupRows.map((item) => item.customer_profile_id),
      ...groupRows.map((item) => item.profile_id),
    ]);

    let customerRows: Row[] = [];

    if (customerIds.length > 0) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, membership_status, kyc_status")
        .in("id", customerIds);

      if (error) {
        console.warn("Assigned trees customer load warning:", error.message);
      } else {
        customerRows = data || [];
      }
    }

    setAssignments(safeAssignments);
    setTaskLogs(safeTasks);
    setRequests(requestRows);
    setTrees(allTrees);
    setGroups(groupRows);
    setCustomers(customerRows);
    setLoading(false);
  }

  const requestMap = useMemo(() => makeMap(requests), [requests]);
  const treeMap = useMemo(() => makeMap(trees), [trees]);
  const groupMap = useMemo(() => makeMap(groups), [groups]);
  const customerMap = useMemo(() => makeMap(customers), [customers]);

  const portfolioTrees = useMemo<PortfolioTree[]>(() => {
    const items: PortfolioTree[] = [];
    const seen = new Set<string>();

    assignments.forEach((assignment) => {
      const request = assignment.operation_request_id
        ? requestMap.get(String(assignment.operation_request_id)) || null
        : null;

      const assignedGroupId = assignment.group_id || request?.group_id || null;
      const assignedTreeId = assignment.tree_id || request?.tree_id || null;

      const candidateTrees =
        assignedGroupId
          ? trees.filter((tree) => String(tree.group_id || "") === String(assignedGroupId))
          : assignedTreeId
          ? trees.filter((tree) => String(tree.id || "") === String(assignedTreeId))
          : [];

      if (candidateTrees.length === 0) {
        const task =
          taskLogs.find((item) => String(item.assignment_id || "") === String(assignment.id)) ||
          null;

        const group = assignedGroupId ? groupMap.get(String(assignedGroupId)) || null : null;

        const customerProfileId =
          assignment.customer_profile_id ||
          request?.customer_profile_id ||
          request?.profile_id ||
          group?.customer_profile_id ||
          group?.profile_id ||
          null;

        const customer = customerProfileId ? customerMap.get(String(customerProfileId)) || null : null;

        const key = `assignment-${assignment.id}`;

        if (!seen.has(key)) {
          seen.add(key);

          const status = normalizeStatus(assignment.status || task?.status || request?.status);

          items.push({
            key,
            assignment,
            task,
            tree: null,
            group,
            customer,
            status,
            taskStatus: normalizeStatus(task?.status || assignment.status || request?.status),
            careStatus: "Forest Care Review",
            warning: { severity: "ATTENTION", reason: "Forest Scope" },
            treeId: assignedTreeId,
            groupId: assignedGroupId,
            customerProfileId,
            assignmentId: assignment.id || null,
            operationRequestId: assignment.operation_request_id || request?.id || null,
            lastUpdate: task?.updated_at || assignment.updated_at || assignment.created_at || request?.updated_at || request?.created_at || null,
          });
        }

        return;
      }

      candidateTrees.forEach((tree) => {
        const task =
          taskLogs.find(
            (item) =>
              String(item.assignment_id || "") === String(assignment.id) &&
              String(item.tree_id || "") === String(tree.id)
          ) ||
          taskLogs.find((item) => String(item.assignment_id || "") === String(assignment.id)) ||
          taskLogs.find((item) => String(item.tree_id || "") === String(tree.id)) ||
          null;

        const groupId = assignment.group_id || request?.group_id || tree.group_id || null;
        const group = groupId ? groupMap.get(String(groupId)) || null : null;

        const customerProfileId =
          assignment.customer_profile_id ||
          request?.customer_profile_id ||
          request?.profile_id ||
          tree.customer_profile_id ||
          tree.profile_id ||
          group?.customer_profile_id ||
          group?.profile_id ||
          null;

        const customer = customerProfileId ? customerMap.get(String(customerProfileId)) || null : null;

        const key = `assignment-${assignment.id}-tree-${tree.id}`;

        if (seen.has(key)) return;
        seen.add(key);

        const status = normalizeStatus(assignment.status || task?.status || request?.status);
        const taskStatus = normalizeStatus(task?.status || assignment.status || request?.status);
        const warning = treeWarning(tree);

        items.push({
          key,
          assignment,
          task,
          tree,
          group,
          customer,
          status,
          taskStatus,
          careStatus: tree.care_status || "NOT_SUBSCRIBED",
          warning,
          treeId: tree.id || null,
          groupId,
          customerProfileId,
          assignmentId: assignment.id || null,
          operationRequestId: assignment.operation_request_id || request?.id || null,
          lastUpdate:
            latestValue([
              task?.updated_at,
              task?.created_at,
              assignment.updated_at,
              assignment.created_at,
              tree.last_photo_update_at,
              tree.last_gps_update_at,
              tree.last_health_report_at,
              tree.updated_at,
              tree.created_at,
            ]) || null,
        });
      });
    });

    return items.sort((a, b) => {
      const forestA = forestName(a.group, a.tree);
      const forestB = forestName(b.group, b.tree);

      if (forestA !== forestB) return forestA.localeCompare(forestB);

      return treeName(a.tree).localeCompare(treeName(b.tree));
    });
  }, [assignments, taskLogs, requests, trees, requestMap, groupMap, customerMap]);

  const forestPortfolios = useMemo<ForestPortfolio[]>(() => {
    const map = new Map<string, ForestPortfolio>();

    portfolioTrees.forEach((item) => {
      const key = item.groupId
        ? `group-${item.groupId}`
        : `loose-${item.customerProfileId || "customer"}-${forestName(item.group, item.tree)}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          groupId: item.groupId,
          forestName: forestName(item.group, item.tree),
          customerName: customerName(item.customer),
          customerEmail: item.customer?.email || "No email",
          totalTrees: 0,
          protectedCount: 0,
          attentionCount: 0,
          criticalCount: 0,
          assignedCount: 0,
          inProgressCount: 0,
          submittedCount: 0,
          completedCount: 0,
          lastUpdate: null,
          trees: [],
        });
      }

      const forest = map.get(key);
      if (!forest) return;

      forest.totalTrees += 1;
      forest.trees.push(item);

      if (item.warning.severity === "PROTECTED") forest.protectedCount += 1;
      if (item.warning.severity === "ATTENTION") forest.attentionCount += 1;
      if (item.warning.severity === "CRITICAL") forest.criticalCount += 1;

      if (item.taskStatus === "ASSIGNED") forest.assignedCount += 1;
      if (item.taskStatus === "IN_PROGRESS") forest.inProgressCount += 1;
      if (item.taskStatus === "SUBMITTED") forest.submittedCount += 1;
      if (item.taskStatus === "COMPLETED") forest.completedCount += 1;

      forest.lastUpdate = latestValue([forest.lastUpdate, item.lastUpdate]);
    });

    return Array.from(map.values()).sort((a, b) => {
      const riskA = a.criticalCount * 3 + a.attentionCount * 2;
      const riskB = b.criticalCount * 3 + b.attentionCount * 2;

      if (riskB !== riskA) return riskB - riskA;

      return a.forestName.localeCompare(b.forestName);
    });
  }, [portfolioTrees]);

  const filteredForests = useMemo(() => {
    if (filter === "ALL") return forestPortfolios;

    return forestPortfolios
      .map((forest) => ({
        ...forest,
        trees: forest.trees.filter((tree) => tree.warning.severity === filter),
      }))
      .filter((forest) => forest.trees.length > 0);
  }, [forestPortfolios, filter]);

  const stats = useMemo(() => {
    return {
      forests: forestPortfolios.length,
      seedlings: portfolioTrees.filter((item) => item.tree).length,
      protected: portfolioTrees.filter((item) => item.warning.severity === "PROTECTED").length,
      attention: portfolioTrees.filter((item) => item.warning.severity === "ATTENTION").length,
      critical: portfolioTrees.filter((item) => item.warning.severity === "CRITICAL").length,
      activeTasks: portfolioTrees.filter((item) =>
        ["ASSIGNED", "IN_PROGRESS", "SUBMITTED"].includes(item.taskStatus)
      ).length,
    };
  }, [forestPortfolios, portfolioTrees]);

  return (
    <main className="min-h-screen bg-[#03130d] p-6 text-white md:p-8">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(217,180,95,0.20),transparent_32%),radial-gradient(circle_at_top_right,rgba(52,120,77,0.28),transparent_30%),linear-gradient(180deg,#082015,#03130d_48%,#010805)]" />

      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-7 shadow-2xl backdrop-blur-xl md:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-[#d9b45f]">
                Gardener Scope View
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                Assigned Forest Portfolio
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/65">
                View the forests and seedlings assigned to you. This page is for scope and portfolio
                visibility. Use Tasks for work execution.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/45">
                Logged Gardener
              </p>
              <p className="mt-2 text-xl font-black text-[#ffe49a]">
                {caretaker?.full_name || caretaker?.email || "—"}
              </p>
              <p className="mt-1 text-xs font-semibold text-white/45">
                {caretaker?.email || "No email"} • {caretaker?.status || "—"}
              </p>
            </div>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl border border-[#d9b45f]/25 bg-[#d9b45f]/10 p-4 text-sm font-bold text-[#ffe49a]">
              {message}
            </div>
          )}

          <div className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <HeroStat label="Forests" value={stats.forests} />
            <HeroStat label="Seedlings" value={stats.seedlings} />
            <HeroStat label="Protected" value={stats.protected} tone="green" />
            <HeroStat label="Attention" value={stats.attention} tone="yellow" />
            <HeroStat label="Critical" value={stats.critical} tone="red" />
            <HeroStat label="Active Tasks" value={stats.activeTasks} tone="gold" />
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-wrap gap-3">
            {(["ALL", "PROTECTED", "ATTENTION", "CRITICAL"] as Filter[]).map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`rounded-full px-5 py-3 text-sm font-black transition ${
                  filter === item
                    ? "bg-[#d9b45f] text-[#071f16]"
                    : "border border-white/10 bg-white/10 text-white/70 hover:bg-white/15"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <EmptyCard text="Loading assigned forest portfolio..." />
        ) : filteredForests.length === 0 ? (
          <EmptyCard text="No assigned forests or seedlings found for this view." />
        ) : (
          <section className="space-y-6">
            {filteredForests.map((forest) => (
              <ForestCard key={forest.key} forest={forest} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function ForestCard({ forest }: { forest: ForestPortfolio }) {
  const firstTask = forest.trees[0];

  return (
    <article className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-bold text-white/55">{forest.customerName}</p>
          <h2 className="mt-2 text-3xl font-black text-[#ffe49a]">🌳 {forest.forestName}</h2>
          <p className="mt-1 text-xs font-semibold text-white/45">
            {forest.customerEmail}
          </p>

          <p className="mt-4 text-sm text-white/60">
            Last update: <span className="font-black text-white">{formatDate(forest.lastUpdate)}</span>
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 md:grid-cols-6 xl:min-w-[640px]">
          <MiniStat label="Trees" value={forest.totalTrees} />
          <MiniStat label="Protected" value={forest.protectedCount} tone="green" />
          <MiniStat label="Attention" value={forest.attentionCount} tone="yellow" />
          <MiniStat label="Critical" value={forest.criticalCount} tone="red" />
          <MiniStat label="Working" value={forest.inProgressCount + forest.submittedCount} tone="gold" />
          <MiniStat label="Done" value={forest.completedCount} tone="green" />
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {forest.trees.map((item) => (
          <SeedlingCard key={item.key} item={item} />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/gardener/tasks"
          className="rounded-2xl bg-[#d9b45f] px-5 py-3 text-sm font-black text-[#071f16]"
        >
          View Tasks
        </Link>

        <Link
          href={`/gardener/photo-updates${firstTask ? buildQuery(firstTask) : ""}`}
          className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15"
        >
          View / Upload Photos
        </Link>

        <Link
          href={`/gardener/gps-updates${firstTask ? buildQuery(firstTask) : ""}`}
          className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15"
        >
          View / Upload GPS
        </Link>

        <Link
          href={`/gardener/health-reports${firstTask ? buildQuery(firstTask) : ""}`}
          className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15"
        >
          View / Upload Health
        </Link>
      </div>
    </article>
  );
}

function SeedlingCard({ item }: { item: PortfolioTree }) {
  const warningColor =
    item.warning.severity === "CRITICAL"
      ? "border-red-400/25 bg-red-500/10 text-red-100"
      : item.warning.severity === "ATTENTION"
      ? "border-yellow-400/25 bg-yellow-500/10 text-yellow-100"
      : "border-emerald-400/20 bg-emerald-500/10 text-emerald-100";

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-2xl font-black text-white">{treeName(item.tree)}</h3>
            <span className={`rounded-full border px-3 py-1 text-xs font-black ${warningColor}`}>
              {item.warning.severity}
            </span>
            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-white/55">
              {item.taskStatus.replaceAll("_", " ")}
            </span>
          </div>

          <p className="mt-2 text-sm font-semibold text-white/50">
            {item.warning.reason} • Care: {item.careStatus}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3 lg:min-w-[520px]">
          <Info label="Customer" value={customerName(item.customer)} />
          <Info label="Task Status" value={item.taskStatus.replaceAll("_", " ")} />
          <Info label="Last Update" value={formatDate(item.lastUpdate)} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={`/gardener/tasks${buildQuery(item)}`}
          className="rounded-2xl bg-[#d9b45f] px-4 py-2 text-sm font-black text-[#071f16]"
        >
          View Task
        </Link>

        <Link
          href={`/gardener/photo-updates${buildQuery(item)}`}
          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/15"
        >
          Photos
        </Link>

        <Link
          href={`/gardener/gps-updates${buildQuery(item)}`}
          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/15"
        >
          GPS
        </Link>

        <Link
          href={`/gardener/health-reports${buildQuery(item)}`}
          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/15"
        >
          Health
        </Link>
      </div>
    </div>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-white">{value || "—"}</p>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-sm font-bold text-white/60 shadow-2xl backdrop-blur-xl">
      {text}
    </div>
  );
}

function makeMap(rows: Row[]) {
  const map = new Map<string, Row>();

  rows.forEach((row) => {
    if (row.id) map.set(String(row.id), row);
  });

  return map;
}

function mergeById(rows: Row[]) {
  const map = new Map<string, Row>();

  rows.forEach((row) => {
    if (row.id) map.set(String(row.id), row);
  });

  return Array.from(map.values());
}

function normalizeStatus(value: any) {
  return String(value || "ASSIGNED").trim().toUpperCase();
}

function uniqueStrings(values: any[]) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter((value) => value.length > 0)
    )
  );
}

function customerName(customer: Row | null) {
  if (!customer) return "Customer";
  return customer.full_name || customer.email || "Customer";
}

function forestName(group: Row | null, tree: Row | null) {
  if (group) {
    return group.forest_name || group.group_name || group.block_name || group.farm_location || "Customer Forest";
  }

  return tree?.tree_group_name || "Ungrouped Forest";
}

function treeName(tree: Row | null) {
  if (!tree) return "Forest Scope";
  return tree.display_name || tree.custom_name || "Seedling";
}

function treeWarning(tree: Row | null): {
  severity: "PROTECTED" | "ATTENTION" | "CRITICAL";
  reason: string;
} {
  if (!tree) {
    return { severity: "ATTENTION", reason: "Forest Scope" };
  }

  const alertStatus = String(tree.alert_status || "").toUpperCase();
  const alertReason = String(tree.alert_reason || "").trim();

  if (alertStatus === "CRITICAL") {
    return { severity: "CRITICAL", reason: alertReason || "Critical Alert" };
  }

  if (alertStatus === "ATTENTION" || alertStatus === "WARNING") {
    return { severity: "ATTENTION", reason: alertReason || "Needs Attention" };
  }

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

  if (
    health.includes("CRITICAL") ||
    health.includes("DISEASE") ||
    health.includes("PEST") ||
    health.includes("ISSUE")
  ) {
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

  const valuation = String(tree.valuation_status || "").toUpperCase();

  if (valuation.includes("PENDING") || valuation.includes("NEEDS_REVIEW") || tree.valuation_requested_at) {
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

function latestValue(values: any[]) {
  const date = latestDate(values);
  return date ? date.toISOString() : null;
}

function buildQuery(item: PortfolioTree) {
  const params = new URLSearchParams();

  if (item.assignmentId) params.set("assignment_id", item.assignmentId);
  if (item.operationRequestId) params.set("operation_request_id", item.operationRequestId);
  if (item.treeId) params.set("tree_id", item.treeId);
  if (item.groupId) params.set("group_id", item.groupId);

  const query = params.toString();
  return query ? `?${query}` : "";
}

function formatDate(value: any) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}