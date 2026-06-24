"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Row = Record<string, any>;

type Filter =
  | "ALL"
  | "TREE_OPERATION"
  | "TREE_VALUATION_INSPECTION"
  | "SELL_TREE_INSPECTION"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "COMPLETED";

type DisplayTask = {
  key: string;
  assignment: Row | null;
  task: Row | null;
  request: Row | null;
  tree: Row | null;
  group: Row | null;
  customer: Row | null;
  status: string;
  sourceType: string;
  assignmentType: string;
  title: string;
  treeId: string | null;
  groupId: string | null;
  customerProfileId: string | null;
  operationRequestId: string | null;
  assignmentId: string | null;
  createdAt: string | null;
};

function normalizeStatus(value: any) {
  return String(value || "ASSIGNED").toUpperCase();
}

function makeMap(rows: Row[]) {
  const map = new Map<string, Row>();
  rows.forEach((row) => map.set(String(row.id), row));
  return map;
}

function uniqueStrings(values: any[]) {
  return Array.from(new Set(values.filter(Boolean).map((value) => String(value))));
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

function getSourceType(task?: Row | null, assignment?: Row | null, request?: Row | null) {
  return (
    task?.source_type ||
    assignment?.source_type ||
    request?.source_type ||
    request?.request_type ||
    request?.operation_type ||
    "TREE_OPERATION"
  );
}

function getTitle(task?: Row | null, assignment?: Row | null, request?: Row | null) {
  const sourceType = getSourceType(task, assignment, request);

  if (sourceType === "TREE_VALUATION_INSPECTION") return "Tree Valuation Inspection";
  if (sourceType === "SELL_TREE_INSPECTION") return "Sell Tree Inspection";

  return request?.service_name || request?.operation_type || task?.task_type || "Tree Operation";
}

export default function GardenerTasksPage() {
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
  const [savingKey, setSavingKey] = useState("");

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

    if (caretakerProfileError) return fail(caretakerProfileError.message);

    const { data: caretakerByEmail, error: caretakerEmailError } = await supabase
      .from("caretakers")
      .select("*")
      .ilike("email", email)
      .maybeSingle();

    if (caretakerEmailError) return fail(caretakerEmailError.message);

    const caretakerRow = caretakerByProfile || caretakerByEmail;

    if (!caretakerRow) return fail("Caretaker profile not found.");
    if (normalizeStatus(caretakerRow.status) !== "ACTIVE") {
      return fail("Your gardener account is not ACTIVE.");
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

    const [assignmentResult, taskResult] = await Promise.all([
      supabase
        .from("caretaker_assignments")
        .select("*")
        .or(assignmentFilters.join(","))
        .order("created_at", { ascending: false }),

      supabase
        .from("caretaker_task_logs")
        .select("*")
        .or(taskFilters.join(","))
        .order("created_at", { ascending: false }),
    ]);

    if (assignmentResult.error) return fail(assignmentResult.error.message);
    if (taskResult.error) return fail(taskResult.error.message);

    const safeAssignments = assignmentResult.data || [];
    const safeTasks = taskResult.data || [];

    const operationRequestIds = uniqueStrings([
      ...safeAssignments.map((item) => item.operation_request_id),
      ...safeTasks.map((item) => item.operation_request_id),
    ]);

    let requestRows: Row[] = [];

    if (operationRequestIds.length > 0) {
      const { data, error } = await supabase
        .from("tree_operation_requests")
        .select("*")
        .in("id", operationRequestIds);

      if (!error) requestRows = data || [];
    }

    const treeIds = uniqueStrings([
      ...safeAssignments.map((item) => item.tree_id),
      ...safeTasks.map((item) => item.tree_id),
      ...requestRows.map((item) => item.tree_id),
    ]);

    let treeRows: Row[] = [];

    if (treeIds.length > 0) {
      const { data, error } = await supabase.from("trees").select("*").in("id", treeIds);
      if (!error) treeRows = data || [];
    }

    const groupIds = uniqueStrings([
      ...safeAssignments.map((item) => item.group_id),
      ...safeTasks.map((item) => item.group_id),
      ...requestRows.map((item) => item.group_id),
      ...treeRows.map((item) => item.group_id),
    ]);

    let groupRows: Row[] = [];

    if (groupIds.length > 0) {
      const { data, error } = await supabase.from("tree_groups").select("*").in("id", groupIds);
      if (!error) groupRows = data || [];
    }

    const customerIds = uniqueStrings([
      ...safeAssignments.map((item) => item.customer_profile_id),
      ...safeTasks.map((item) => item.customer_profile_id),
      ...requestRows.map((item) => item.customer_profile_id),
      ...requestRows.map((item) => item.profile_id),
      ...treeRows.map((item) => item.customer_profile_id),
      ...treeRows.map((item) => item.profile_id),
      ...groupRows.map((item) => item.customer_profile_id),
      ...groupRows.map((item) => item.profile_id),
    ]);

    let customerRows: Row[] = [];

    if (customerIds.length > 0) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", customerIds);

      if (!error) customerRows = data || [];
    }

    setAssignments(safeAssignments);
    setTaskLogs(safeTasks);
    setRequests(requestRows);
    setTrees(treeRows);
    setGroups(groupRows);
    setCustomers(customerRows);
    setLoading(false);
  }

  function fail(text: string) {
    setMessage(text);
    setLoading(false);
  }

  const requestMap = useMemo(() => makeMap(requests), [requests]);
  const treeMap = useMemo(() => makeMap(trees), [trees]);
  const groupMap = useMemo(() => makeMap(groups), [groups]);
  const customerMap = useMemo(() => makeMap(customers), [customers]);

  const displayTasks = useMemo<DisplayTask[]>(() => {
    const rows: DisplayTask[] = [];
    const coveredTaskIds = new Set<string>();

    assignments.forEach((assignment) => {
      const task =
        taskLogs.find((item) => String(item.assignment_id || "") === String(assignment.id)) ||
        taskLogs.find(
          (item) =>
            String(item.operation_request_id || "") ===
            String(assignment.operation_request_id || "")
        ) ||
        null;

      if (task?.id) coveredTaskIds.add(String(task.id));

      const request = assignment.operation_request_id
        ? requestMap.get(String(assignment.operation_request_id)) || null
        : null;

      const treeId = task?.tree_id || assignment.tree_id || request?.tree_id || null;
      const tree = treeId ? treeMap.get(String(treeId)) || null : null;

      const groupId =
        task?.group_id || assignment.group_id || request?.group_id || tree?.group_id || null;
      const group = groupId ? groupMap.get(String(groupId)) || null : null;

      const customerProfileId =
        task?.customer_profile_id ||
        assignment.customer_profile_id ||
        request?.customer_profile_id ||
        request?.profile_id ||
        tree?.customer_profile_id ||
        tree?.profile_id ||
        group?.customer_profile_id ||
        group?.profile_id ||
        null;

      const customer = customerProfileId ? customerMap.get(String(customerProfileId)) || null : null;
      const sourceType = getSourceType(task, assignment, request);

      rows.push({
        key: `assignment-${assignment.id}`,
        assignment,
        task,
        request,
        tree,
        group,
        customer,
        status: normalizeStatus(task?.status || assignment.status || request?.status),
        sourceType,
        assignmentType: groupId ? "FOREST ASSIGNMENT" : "TREE ASSIGNMENT",
        title: getTitle(task, assignment, request),
        treeId,
        groupId,
        customerProfileId,
        operationRequestId:
          task?.operation_request_id || assignment.operation_request_id || request?.id || null,
        assignmentId: assignment.id || task?.assignment_id || null,
        createdAt: task?.created_at || assignment.created_at || request?.created_at || null,
      });
    });

    taskLogs.forEach((task) => {
      if (coveredTaskIds.has(String(task.id))) return;

      const assignment = task.assignment_id
        ? assignments.find((item) => String(item.id) === String(task.assignment_id)) || null
        : null;

      const request = task.operation_request_id
        ? requestMap.get(String(task.operation_request_id)) || null
        : null;

      const treeId = task.tree_id || assignment?.tree_id || request?.tree_id || null;
      const tree = treeId ? treeMap.get(String(treeId)) || null : null;

      const groupId = task.group_id || assignment?.group_id || request?.group_id || tree?.group_id || null;
      const group = groupId ? groupMap.get(String(groupId)) || null : null;

      const customerProfileId =
        task.customer_profile_id ||
        assignment?.customer_profile_id ||
        request?.customer_profile_id ||
        request?.profile_id ||
        tree?.customer_profile_id ||
        tree?.profile_id ||
        group?.customer_profile_id ||
        group?.profile_id ||
        null;

      const customer = customerProfileId ? customerMap.get(String(customerProfileId)) || null : null;
      const sourceType = getSourceType(task, assignment, request);

      rows.push({
        key: `task-${task.id}`,
        assignment,
        task,
        request,
        tree,
        group,
        customer,
        status: normalizeStatus(task.status || assignment?.status || request?.status),
        sourceType,
        assignmentType: groupId ? "FOREST ASSIGNMENT" : "TREE ASSIGNMENT",
        title: getTitle(task, assignment, request),
        treeId,
        groupId,
        customerProfileId,
        operationRequestId: task.operation_request_id || assignment?.operation_request_id || request?.id || null,
        assignmentId: task.assignment_id || assignment?.id || null,
        createdAt: task.created_at || assignment?.created_at || request?.created_at || null,
      });
    });

    return rows.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [assignments, taskLogs, requestMap, treeMap, groupMap, customerMap]);

  const filteredTasks = useMemo(() => {
    if (filter === "ALL") return displayTasks;

    if (["TREE_OPERATION", "TREE_VALUATION_INSPECTION", "SELL_TREE_INSPECTION"].includes(filter)) {
      return displayTasks.filter((item) => item.sourceType === filter);
    }

    return displayTasks.filter((item) => item.status === filter);
  }, [displayTasks, filter]);

  const stats = useMemo(() => {
    return {
      total: displayTasks.length,
      treeOps: displayTasks.filter((item) => item.sourceType === "TREE_OPERATION").length,
      valuation: displayTasks.filter((item) => item.sourceType === "TREE_VALUATION_INSPECTION").length,
      sellTree: displayTasks.filter((item) => item.sourceType === "SELL_TREE_INSPECTION").length,
      assigned: displayTasks.filter((item) => item.status === "ASSIGNED").length,
      inProgress: displayTasks.filter((item) => item.status === "IN_PROGRESS").length,
      submitted: displayTasks.filter((item) => item.status === "SUBMITTED").length,
      completed: displayTasks.filter((item) => item.status === "COMPLETED").length,
    };
  }, [displayTasks]);

  async function ensureTaskLog(item: DisplayTask, status: string) {
    if (!caretaker) throw new Error("Caretaker not loaded.");

    const now = new Date().toISOString();

    const payload = {
      assignment_id: item.assignmentId || null,
      caretaker_id: caretaker.id,
      caretaker_profile_id: caretaker.caretaker_profile_id || null,
      customer_profile_id: item.customerProfileId || null,
      tree_id: item.treeId || null,
      group_id: item.groupId || null,
      operation_request_id: item.operationRequestId || null,
      task_type: item.sourceType || "TREE_OPERATION",
      source_type: item.sourceType || "TREE_OPERATION",
      evidence_status: status === "SUBMITTED" || status === "COMPLETED" ? "SUBMITTED" : "PENDING",
      notes: `Gardener updated task to ${status.replace("_", " ")}.`,
      status,
      created_at: now,
      updated_at: now,
      started_at: status === "IN_PROGRESS" ? now : null,
      submitted_at: status === "SUBMITTED" ? now : null,
      completed_at: status === "COMPLETED" ? now : null,
    };

    const { data, error } = await supabase
      .from("caretaker_task_logs")
      .insert(payload)
      .select("id")
      .single();

    if (error || !data) throw new Error(error?.message || "Failed to create task log.");
    return data.id;
  }

  async function updateTaskStatus(item: DisplayTask, nextStatus: string) {
    setMessage("");
    setSavingKey(item.key);

    const status = normalizeStatus(nextStatus);
    const now = new Date().toISOString();

    try {
      if (item.task?.id) {
        const taskUpdate: Row = {
          status,
          evidence_status: status === "SUBMITTED" || status === "COMPLETED" ? "SUBMITTED" : "PENDING",
          updated_at: now,
        };

        if (status === "IN_PROGRESS") taskUpdate.started_at = item.task.started_at || now;
        if (status === "SUBMITTED") taskUpdate.submitted_at = now;
        if (status === "COMPLETED") taskUpdate.completed_at = now;

        const { error } = await supabase
          .from("caretaker_task_logs")
          .update(taskUpdate)
          .eq("id", item.task.id);

        if (error) throw error;
      } else {
        await ensureTaskLog(item, status);
      }

      if (item.assignmentId) {
        const assignmentUpdate: Row = {
          status,
          updated_at: now,
        };

        if (status === "IN_PROGRESS") assignmentUpdate.started_at = item.assignment?.started_at || now;
        if (status === "SUBMITTED") assignmentUpdate.submitted_at = now;
        if (status === "COMPLETED") assignmentUpdate.completed_at = now;

        const { error } = await supabase
          .from("caretaker_assignments")
          .update(assignmentUpdate)
          .eq("id", item.assignmentId);

        if (error) throw error;
      }

      if (item.operationRequestId && item.sourceType === "TREE_OPERATION") {
        const requestUpdate: Row = {
          status,
          assignment_status: status,
          updated_at: now,
        };

        if (status === "COMPLETED") requestUpdate.completed_at = now;

        const { error } = await supabase
          .from("tree_operation_requests")
          .update(requestUpdate)
          .eq("id", item.operationRequestId);

        if (error) throw error;
      }

      setMessage(`Task synced as ${status.replace("_", " ")}.`);
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || "Task update failed.");
    }

    setSavingKey("");
  }

  return (
    <main className="min-h-screen bg-[#03130d] p-6 text-white md:p-8">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(217,180,95,0.20),transparent_32%),radial-gradient(circle_at_top_right,rgba(52,120,77,0.28),transparent_30%),linear-gradient(180deg,#082015,#03130d_48%,#010805)]" />

      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-7 shadow-2xl backdrop-blur-xl md:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-[#d9b45f]">
                Arganwood Field Work
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                Forest Work Center
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/65">
                Supports tree operations, valuation inspections, and sell tree inspections through
                caretaker_assignments and caretaker_task_logs.
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

          <div className="mt-8 grid gap-4 md:grid-cols-4 xl:grid-cols-8">
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Tree Ops" value={stats.treeOps} />
            <StatCard label="Valuation" value={stats.valuation} />
            <StatCard label="Sell Tree" value={stats.sellTree} />
            <StatCard label="Assigned" value={stats.assigned} />
            <StatCard label="In Progress" value={stats.inProgress} />
            <StatCard label="Submitted" value={stats.submitted} />
            <StatCard label="Completed" value={stats.completed} />
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-wrap gap-3">
            {([
              "ALL",
              "TREE_OPERATION",
              "TREE_VALUATION_INSPECTION",
              "SELL_TREE_INSPECTION",
              "ASSIGNED",
              "IN_PROGRESS",
              "SUBMITTED",
              "COMPLETED",
            ] as Filter[]).map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`rounded-full px-5 py-3 text-sm font-black transition ${
                  filter === item
                    ? "bg-[#d9b45f] text-[#071f16]"
                    : "border border-white/10 bg-white/10 text-white/70 hover:bg-white/15"
                }`}
              >
                {item.replaceAll("_", " ")}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <EmptyCard text="Loading forest work center..." />
        ) : filteredTasks.length === 0 ? (
          <EmptyCard text="No tasks found for this gardener." />
        ) : (
          <section className="space-y-5">
            {filteredTasks.map((item) => (
              <TaskCard
                key={item.key}
                item={item}
                saving={savingKey === item.key}
                updateTaskStatus={(status) => updateTaskStatus(item, status)}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function TaskCard({
  item,
  saving,
  updateTaskStatus,
}: {
  item: DisplayTask;
  saving: boolean;
  updateTaskStatus: (status: string) => void;
}) {
  const closed = ["COMPLETED", "CANCELLED", "REJECTED", "FAILED"].includes(item.status);
  const assignmentQuery = item.assignmentId ? `?assignment_id=${item.assignmentId}` : "";

  return (
    <article className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={item.status} />
            <span className="rounded-full border border-[#d9b45f]/30 bg-[#d9b45f]/10 px-3 py-1 text-xs font-black text-[#ffe49a]">
              {item.sourceType.replaceAll("_", " ")}
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-black text-white/60">
              {item.assignmentType}
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-black text-[#ffe49a]">{item.title}</h2>

            <p className="mt-2 text-sm text-white/65">
              Forest:{" "}
              <b className="text-white">
                {item.group?.forest_name ||
                  item.group?.group_name ||
                  item.tree?.tree_group_name ||
                  "Single Tree"}
              </b>
            </p>

            <p className="mt-1 text-sm text-white/65">
              Tree:{" "}
              <b className="text-white">
                {item.tree?.display_name || item.tree?.custom_name || "Friendly Tree"}
              </b>
            </p>

            <p className="mt-1 text-sm text-white/65">
              Customer:{" "}
              <b className="text-white">
                {item.customer?.full_name || item.customer?.email || "Unknown Customer"}
              </b>
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Info label="Created" value={formatDate(item.createdAt)} />
            <Info
              label="Care Status"
              value={item.tree?.care_status || item.request?.care_program_status || "—"}
            />
            <Info label="Evidence" value={item.task?.evidence_status || "PENDING"} />
          </div>
        </div>

        <div className="w-full space-y-3 xl:w-80">
          {!closed && item.status === "ASSIGNED" && (
            <button
              onClick={() => updateTaskStatus("IN_PROGRESS")}
              disabled={saving}
              className="w-full rounded-2xl bg-[#d9b45f] px-5 py-4 text-sm font-black text-[#071f16] hover:bg-[#f7d774] disabled:opacity-50"
            >
              Start Work
            </button>
          )}

          {!closed && item.status === "IN_PROGRESS" && (
            <button
              onClick={() => updateTaskStatus("SUBMITTED")}
              disabled={saving}
              className="w-full rounded-2xl bg-blue-400 px-5 py-4 text-sm font-black text-[#03130d] hover:bg-blue-300 disabled:opacity-50"
            >
              Submit Evidence
            </button>
          )}

          {!closed && item.status === "SUBMITTED" && (
            <button
              onClick={() => updateTaskStatus("COMPLETED")}
              disabled={saving}
              className="w-full rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-[#03130d] hover:bg-emerald-400 disabled:opacity-50"
            >
              Complete Task
            </button>
          )}

          <div className="grid gap-2">
            <Link
              href={`/gardener/photo-updates${assignmentQuery}`}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-black text-white/75 hover:bg-white/15"
            >
              Upload Photo Evidence
            </Link>

            <Link
              href={`/gardener/gps-updates${assignmentQuery}`}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-black text-white/75 hover:bg-white/15"
            >
              Upload GPS Evidence
            </Link>

            <Link
              href={`/gardener/health-reports${assignmentQuery}`}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-black text-white/75 hover:bg-white/15"
            >
              Submit Health Report
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-white/45">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black text-[#ffe49a]">{value}</p>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-white/80">{value || "—"}</p>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-white/65 shadow-2xl backdrop-blur-xl">
      {text}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const value = normalizeStatus(status);
  let classes = "border-yellow-400/30 bg-yellow-500/15 text-yellow-200";

  if (value === "IN_PROGRESS") classes = "border-blue-400/30 bg-blue-500/15 text-blue-200";
  if (value === "SUBMITTED") classes = "border-purple-400/30 bg-purple-500/15 text-purple-200";
  if (value === "COMPLETED") classes = "border-emerald-400/30 bg-emerald-500/15 text-emerald-200";

  if (["REJECTED", "CANCELLED", "FAILED"].includes(value)) {
    classes = "border-red-400/30 bg-red-500/15 text-red-200";
  }

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-black ${classes}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}