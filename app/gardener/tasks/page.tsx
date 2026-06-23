"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Row = Record<string, any>;

type Filter =
  | "ALL"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "COMPLETED"
  | "VALUATION";

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
  notes: string | null;
};

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
      setMessage("Caretaker profile not found. Make sure this email exists in caretakers.");
      setLoading(false);
      return;
    }

    if (String(caretakerRow.status || "").toUpperCase() !== "ACTIVE") {
      setMessage("Your gardener account is not ACTIVE.");
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
        console.warn("Gardener request load warning:", error.message);
      } else {
        requestRows = data || [];
      }
    }

    const treeIds = uniqueStrings([
      ...safeAssignments.map((item) => item.tree_id),
      ...safeTasks.map((item) => item.tree_id),
      ...requestRows.map((item) => item.tree_id),
    ]);

    const groupIds = uniqueStrings([
      ...safeAssignments.map((item) => item.group_id),
      ...safeTasks.map((item) => item.group_id),
      ...requestRows.map((item) => item.group_id),
    ]);

    let treeRows: Row[] = [];

    if (treeIds.length > 0) {
      const { data, error } = await supabase
        .from("trees")
        .select("*")
        .in("id", treeIds);

      if (error) {
        console.warn("Gardener tree load warning:", error.message);
      } else {
        treeRows = data || [];
      }
    }

    const derivedGroupIds = uniqueStrings(treeRows.map((item) => item.group_id));
    const allGroupIds = uniqueStrings([...groupIds, ...derivedGroupIds]);

    let groupRows: Row[] = [];

    if (allGroupIds.length > 0) {
      const { data, error } = await supabase
        .from("tree_groups")
        .select("*")
        .in("id", allGroupIds);

      if (error) {
        console.warn("Gardener group load warning:", error.message);
      } else {
        groupRows = data || [];
      }
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
        .select("id, full_name, email, phone, membership_status, kyc_status")
        .in("id", customerIds);

      if (error) {
        console.warn("Gardener customer load warning:", error.message);
      } else {
        customerRows = data || [];
      }
    }

    setAssignments(safeAssignments);
    setTaskLogs(safeTasks);
    setRequests(requestRows);
    setTrees(treeRows);
    setGroups(groupRows);
    setCustomers(customerRows);
    setLoading(false);
  }

  const requestMap = useMemo(() => makeMap(requests), [requests]);
  const treeMap = useMemo(() => makeMap(trees), [trees]);
  const groupMap = useMemo(() => makeMap(groups), [groups]);
  const customerMap = useMemo(() => makeMap(customers), [customers]);

  const displayTasks = useMemo<DisplayTask[]>(() => {
    const items: DisplayTask[] = [];
    const coveredTaskIds = new Set<string>();

    assignments.forEach((assignment) => {
      const task =
        taskLogs.find((item) => String(item.assignment_id || "") === String(assignment.id)) ||
        taskLogs.find(
          (item) => String(item.operation_request_id || "") === String(assignment.operation_request_id || "")
        ) ||
        null;

      if (task?.id) coveredTaskIds.add(String(task.id));

      const request = assignment.operation_request_id
        ? requestMap.get(String(assignment.operation_request_id)) || null
        : null;

      const treeId = task?.tree_id || assignment.tree_id || request?.tree_id || null;
      const tree = treeId ? treeMap.get(String(treeId)) || null : null;

      const groupId =
        task?.group_id ||
        assignment.group_id ||
        request?.group_id ||
        tree?.group_id ||
        null;

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
      const status = normalizeStatus(task?.status || assignment.status || request?.status);
      const assignmentType = groupId ? "FOREST ASSIGNMENT" : "TREE ASSIGNMENT";

      items.push({
        key: `assignment-${assignment.id}`,
        assignment,
        task,
        request,
        tree,
        group,
        customer,
        status,
        sourceType,
        assignmentType,
        title: getTitle(task, assignment, request),
        treeId,
        groupId,
        customerProfileId,
        operationRequestId: task?.operation_request_id || assignment.operation_request_id || request?.id || null,
        assignmentId: assignment.id || task?.assignment_id || null,
        createdAt: task?.created_at || assignment.created_at || assignment.assigned_at || request?.created_at || null,
        notes: task?.notes || assignment.notes || request?.notes || null,
      });
    });

    taskLogs.forEach((task) => {
      if (coveredTaskIds.has(String(task.id))) return;

      const assignment = task.assignment_id
        ? assignments.find((item) => String(item.id) === String(task.assignment_id)) || null
        : null;

      const request =
        task.operation_request_id
          ? requestMap.get(String(task.operation_request_id)) || null
          : assignment?.operation_request_id
          ? requestMap.get(String(assignment.operation_request_id)) || null
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
      const status = normalizeStatus(task.status || assignment?.status || request?.status);

      items.push({
        key: `task-${task.id}`,
        assignment,
        task,
        request,
        tree,
        group,
        customer,
        status,
        sourceType,
        assignmentType: groupId ? "FOREST ASSIGNMENT" : "TREE ASSIGNMENT",
        title: getTitle(task, assignment, request),
        treeId,
        groupId,
        customerProfileId,
        operationRequestId: task.operation_request_id || assignment?.operation_request_id || request?.id || null,
        assignmentId: task.assignment_id || assignment?.id || null,
        createdAt: task.created_at || assignment?.created_at || request?.created_at || null,
        notes: task.notes || assignment?.notes || request?.notes || null,
      });
    });

    return items.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [assignments, taskLogs, requestMap, treeMap, groupMap, customerMap]);

  const filteredTasks = useMemo(() => {
    if (filter === "ALL") return displayTasks;
    if (filter === "VALUATION") {
      return displayTasks.filter((item) => item.sourceType === "TREE_VALUATION_INSPECTION");
    }

    return displayTasks.filter((item) => item.status === filter);
  }, [displayTasks, filter]);

  const stats = useMemo(() => {
    return {
      total: displayTasks.length,
      assigned: displayTasks.filter((item) => item.status === "ASSIGNED").length,
      inProgress: displayTasks.filter((item) => item.status === "IN_PROGRESS").length,
      submitted: displayTasks.filter((item) => item.status === "SUBMITTED").length,
      completed: displayTasks.filter((item) => item.status === "COMPLETED").length,
      valuation: displayTasks.filter((item) => item.sourceType === "TREE_VALUATION_INSPECTION").length,
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

    if (error || !data) {
      throw new Error(error?.message || "Failed to create task log.");
    }

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
      }

      await ensureTaskLog(item, status);

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

      if (item.operationRequestId) {
        const requestUpdate: Row = {
          status,
          assignment_status: status,
          updated_at: now,
        };

        if (status === "ASSIGNED") requestUpdate.assigned_at = item.request?.assigned_at || now;
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
                See assigned forests and seedlings, start work, submit evidence, and complete tasks
                for Admin review and Customer visibility.
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
            <HeroStat label="Total Tasks" value={stats.total} />
            <HeroStat label="Assigned" value={stats.assigned} tone="blue" />
            <HeroStat label="In Progress" value={stats.inProgress} tone="yellow" />
            <HeroStat label="Submitted" value={stats.submitted} tone="purple" />
            <HeroStat label="Completed" value={stats.completed} tone="green" />
            <HeroStat label="Valuation" value={stats.valuation} tone="gold" />
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-wrap gap-3">
            {(["ALL", "ASSIGNED", "IN_PROGRESS", "SUBMITTED", "COMPLETED", "VALUATION"] as Filter[]).map(
              (item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`rounded-full px-5 py-3 text-sm font-black transition ${
                    filter === item
                      ? "bg-[#d9b45f] text-[#071f16]"
                      : "border border-white/10 bg-white/10 text-white/70 hover:bg-white/15"
                  }`}
                >
                  {item.replace("_", " ")}
                </button>
              )
            )}
          </div>
        </section>

        {loading ? (
          <EmptyCard text="Loading forest work center..." />
        ) : filteredTasks.length === 0 ? (
          <EmptyCard text="No tasks found for this gardener. Check caretaker_assignments and caretaker_task_logs sync." />
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
  const query = buildEvidenceQuery(item);

  return (
    <article className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[#d9b45f]/30 bg-[#d9b45f]/10 px-3 py-1 text-xs font-black text-[#ffe49a]">
              {item.assignmentType}
            </span>
            <StatusBadge status={item.status} />
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-black text-white/55">
              {item.sourceType.replaceAll("_", " ")}
            </span>
          </div>

          <h2 className="mt-4 text-3xl font-black text-white">{item.title}</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Info label="Customer" value={customerName(item.customer)} subValue={item.customer?.email || "No email"} />
            <Info label="Forest" value={`🌳 ${forestName(item.group, item.tree)}`} subValue={item.groupId ? "Forest assignment ready" : "Tree assignment"} />
            <Info label="Seedling" value={treeName(item.tree)} subValue={item.tree ? stageText(item.tree) : "Forest-level work"} />
            <Info label="Care Status" value={careStatus(item.tree)} subValue={valuationStatus(item.tree, item.request, item.sourceType)} />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Info label="Assignment Type" value={item.assignmentType} subValue={formatDate(item.createdAt)} />
            <Info label="Task Status" value={item.status.replaceAll("_", " ")} subValue={item.task?.evidence_status || "Evidence pending"} />
            <Info label="Admin Flow" value="Admin Review Next" subValue="After evidence submission" />
          </div>

          {item.notes && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/65">
              <span className="font-black text-[#ffe49a]">Notes:</span> {item.notes}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/gardener/photo-updates${query}`}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15"
            >
              Upload Photo
            </Link>

            <Link
              href={`/gardener/gps-updates${query}`}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15"
            >
              Upload GPS
            </Link>

            <Link
              href={`/gardener/health-reports${query}`}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15"
            >
              Upload Health
            </Link>
          </div>
        </div>

        <aside className="w-full rounded-3xl border border-white/10 bg-black/20 p-5 xl:w-[340px]">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/45">
            Field Actions
          </p>

          <div className="mt-5 space-y-3">
            {item.status === "ASSIGNED" && (
              <button
                onClick={() => updateTaskStatus("IN_PROGRESS")}
                disabled={saving}
                className="w-full rounded-2xl border border-blue-300/25 bg-blue-500/15 px-5 py-4 font-black text-blue-100 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Start Work"}
              </button>
            )}

            {!closed && item.status !== "SUBMITTED" && (
              <button
                onClick={() => updateTaskStatus("SUBMITTED")}
                disabled={saving}
                className="w-full rounded-2xl border border-purple-300/25 bg-purple-500/15 px-5 py-4 font-black text-purple-100 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Submit Evidence"}
              </button>
            )}

            {!closed && (
              <button
                onClick={() => updateTaskStatus("COMPLETED")}
                disabled={saving}
                className="w-full rounded-2xl border border-emerald-300/25 bg-emerald-500/15 px-5 py-4 font-black text-emerald-100 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Complete Task"}
              </button>
            )}

            {item.status === "COMPLETED" && (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-center text-sm font-bold text-emerald-100">
                Completed and synced to Admin Operations.
              </div>
            )}

            {closed && item.status !== "COMPLETED" && (
              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-center text-sm font-bold text-red-100">
                This task is closed.
              </div>
            )}
          </div>
        </aside>
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
  tone?: "green" | "yellow" | "blue" | "purple" | "gold";
}) {
  const color =
    tone === "green"
      ? "text-emerald-200"
      : tone === "yellow"
      ? "text-yellow-200"
      : tone === "blue"
      ? "text-blue-200"
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

function Info({
  label,
  value,
  subValue,
}: {
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className="mt-2 break-words text-lg font-black text-white">{value || "—"}</p>
      {subValue ? (
        <p className="mt-1 break-words text-xs font-semibold text-white/45">{subValue}</p>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeStatus(status);

  const color =
    normalized === "COMPLETED"
      ? "border-emerald-300/30 bg-emerald-500/20 text-emerald-100"
      : normalized === "SUBMITTED"
      ? "border-purple-300/30 bg-purple-500/20 text-purple-100"
      : normalized === "IN_PROGRESS"
      ? "border-yellow-300/30 bg-yellow-500/20 text-yellow-100"
      : normalized === "ASSIGNED"
      ? "border-blue-300/30 bg-blue-500/20 text-blue-100"
      : ["CANCELLED", "REJECTED", "FAILED"].includes(normalized)
      ? "border-red-300/30 bg-red-500/20 text-red-100"
      : "border-[#d9b45f]/30 bg-[#d9b45f]/10 text-[#ffe49a]";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-black ${color}`}>
      {normalized.replaceAll("_", " ")}
    </span>
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

function getTitle(task: Row | null, assignment: Row | null, request: Row | null) {
  return (
    task?.task_type ||
    assignment?.assignment_type ||
    request?.service_name ||
    request?.care_program_name ||
    request?.operation_type ||
    request?.request_type ||
    "Tree Operation"
  );
}

function getSourceType(task: Row | null, assignment: Row | null, request: Row | null) {
  const raw =
    task?.source_type ||
    task?.task_type ||
    assignment?.source_type ||
    assignment?.assignment_type ||
    request?.request_type ||
    request?.operation_type ||
    request?.service_name ||
    "TREE_OPERATION";

  const text = String(raw || "").toUpperCase();

  if (text.includes("VALUATION")) return "TREE_VALUATION_INSPECTION";
  if (text.includes("PHOTO")) return "PHOTO_UPDATE";
  if (text.includes("GPS")) return "GPS_UPDATE";
  if (text.includes("HEALTH")) return "HEALTH_REPORT";

  return "TREE_OPERATION";
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
  if (!tree) return "Forest Level";
  return tree.display_name || tree.custom_name || "Seedling";
}

function stageText(tree: Row | null) {
  if (!tree) return "Forest task";
  return tree.stage || tree.current_stage || tree.status || "Stage pending";
}

function careStatus(tree: Row | null) {
  if (!tree) return "Forest Care Review";
  return tree.care_status || "NOT_SUBSCRIBED";
}

function valuationStatus(tree: Row | null, request: Row | null, sourceType: string) {
  if (sourceType === "TREE_VALUATION_INSPECTION") return "Valuation inspection task";

  const requestText = `${request?.request_type || ""} ${request?.operation_type || ""} ${request?.service_name || ""}`.toUpperCase();

  if (requestText.includes("VALUATION")) return "Valuation request";

  return tree?.valuation_status || "Valuation not requested";
}

function buildEvidenceQuery(item: DisplayTask) {
  const params = new URLSearchParams();

  if (item.task?.id) params.set("task_id", String(item.task.id));
  if (item.assignmentId) params.set("assignment_id", item.assignmentId);
  if (item.operationRequestId) params.set("operation_request_id", item.operationRequestId);
  if (item.treeId) params.set("tree_id", item.treeId);
  if (item.groupId) params.set("group_id", item.groupId);

  const query = params.toString();
  return query ? `?${query}` : "";
}

function formatDate(value: any) {
  if (!value) return "No date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}