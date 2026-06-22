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
  | "CANCELLED";

type DisplayTask = {
  key: string;
  source: "TASK_LOG" | "ASSIGNMENT";
  task: Row | null;
  assignment: Row | null;
  request: Row | null;
  tree: Row | null;
  customer: Row | null;
  status: string;
  title: string;
  treeId: string | null;
  customerProfileId: string | null;
  operationRequestId: string | null;
  assignmentId: string | null;
  createdAt: string | null;
  notes: string | null;
};

export default function GardenerTasksPage() {
  const [caretaker, setCaretaker] = useState<Row | null>(null);
  const [taskLogs, setTaskLogs] = useState<Row[]>([]);
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [requests, setRequests] = useState<Row[]>([]);
  const [trees, setTrees] = useState<Row[]>([]);
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
      caretakerByLowerEmail || caretakerByExactEmail || caretakerByEmailFallback;

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

    const { data: assignmentRows, error: assignmentError } = await supabase
      .from("caretaker_assignments")
      .select("*")
      .eq("caretaker_id", caretakerRow.id)
      .order("started_at", { ascending: false });

    if (assignmentError) {
      setMessage(assignmentError.message);
      setLoading(false);
      return;
    }

    const { data: taskRows, error: taskError } = await supabase
      .from("caretaker_task_logs")
      .select("*")
      .eq("caretaker_id", caretakerRow.id)
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

    const treeIds = uniqueStrings([
      ...safeAssignments.map((item) => item.tree_id),
      ...safeTasks.map((item) => item.tree_id),
    ]);

    const customerIds = uniqueStrings([
      ...safeAssignments.map((item) => item.customer_profile_id),
      ...safeTasks.map((item) => item.customer_profile_id),
    ]);

    let requestRows: Row[] = [];

    if (operationRequestIds.length > 0) {
      const { data: requestData, error: requestError } = await supabase
        .from("tree_operation_requests")
        .select("*")
        .in("id", operationRequestIds)
        .order("created_at", { ascending: false });

      if (requestError) {
        console.warn("Gardener task request load warning:", requestError.message);
      } else {
        requestRows = requestData || [];
      }
    }

    const requestTreeIds = uniqueStrings(requestRows.map((item) => item.tree_id));
    const requestCustomerIds = uniqueStrings(requestRows.map((item) => item.profile_id));

    let treeRows: Row[] = [];
    const allTreeIds = uniqueStrings([...treeIds, ...requestTreeIds]);

    if (allTreeIds.length > 0) {
      const { data: treeData, error: treeError } = await supabase
        .from("trees")
        .select("*")
        .in("id", allTreeIds);

      if (treeError) {
        console.warn("Gardener task tree load warning:", treeError.message);
      } else {
        treeRows = treeData || [];
      }
    }

    let customerRows: Row[] = [];
    const allCustomerIds = uniqueStrings([...customerIds, ...requestCustomerIds]);

    if (allCustomerIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, membership_status, kyc_status")
        .in("id", allCustomerIds);

      if (profileError) {
        console.warn("Gardener task customer load warning:", profileError.message);
      } else {
        customerRows = profileData || [];
      }
    }

    setAssignments(safeAssignments);
    setTaskLogs(safeTasks);
    setRequests(requestRows);
    setTrees(treeRows);
    setCustomers(customerRows);
    setLoading(false);
  }

  function normalizeStatus(value: any) {
    return String(value || "ASSIGNED").trim().toUpperCase();
  }

  function getLatestTaskForAssignment(assignmentId?: string | null) {
    if (!assignmentId) return null;

    return (
      taskLogs.find((item) => String(item.assignment_id || "") === String(assignmentId)) ||
      null
    );
  }

  function getLatestTaskForRequest(operationRequestId?: string | null) {
    if (!operationRequestId) return null;

    return (
      taskLogs.find(
        (item) => String(item.operation_request_id || "") === String(operationRequestId)
      ) || null
    );
  }

  function getRequest(operationRequestId?: string | null) {
    if (!operationRequestId) return null;

    return (
      requests.find((item) => String(item.id || "") === String(operationRequestId)) ||
      null
    );
  }

  function getAssignment(assignmentId?: string | null) {
    if (!assignmentId) return null;

    return (
      assignments.find((item) => String(item.id || "") === String(assignmentId)) ||
      null
    );
  }

  function getTree(treeId?: string | null) {
    if (!treeId) return null;

    return (
      trees.find((item) => String(item.id || "") === String(treeId)) ||
      trees.find((item) => String(item.tree_code || "") === String(treeId)) ||
      null
    );
  }

  function getCustomer(customerId?: string | null) {
    if (!customerId) return null;

    return (
      customers.find((item) => String(item.id || "") === String(customerId)) ||
      null
    );
  }

  function getTitle(task: Row | null, assignment: Row | null, request: Row | null) {
    return (
      task?.task_type ||
      assignment?.assignment_type ||
      request?.care_program_name ||
      request?.operation_type ||
      request?.request_type ||
      "Tree Task"
    );
  }

  function buildTaskQuery(item: DisplayTask) {
    const params = new URLSearchParams();

    if (item.task?.id) params.set("task_id", String(item.task.id));
    if (item.assignmentId) params.set("assignment_id", item.assignmentId);
    if (item.operationRequestId) params.set("operation_request_id", item.operationRequestId);
    if (item.treeId) params.set("tree_id", item.treeId);

    const query = params.toString();

    return query ? `?${query}` : "";
  }

  const displayTasks = useMemo<DisplayTask[]>(() => {
    const items: DisplayTask[] = [];
    const coveredTaskIds = new Set<string>();

    assignments.forEach((assignment) => {
      const task =
        getLatestTaskForAssignment(assignment.id) ||
        getLatestTaskForRequest(assignment.operation_request_id);

      if (task?.id) coveredTaskIds.add(String(task.id));

      const request = getRequest(assignment.operation_request_id);
      const treeId = task?.tree_id || assignment.tree_id || request?.tree_id || null;
      const customerProfileId =
        task?.customer_profile_id ||
        assignment.customer_profile_id ||
        request?.profile_id ||
        null;

      const tree = getTree(treeId);
      const customer = getCustomer(customerProfileId);
      const status = normalizeStatus(task?.status || assignment.status || request?.status);
      const title = getTitle(task, assignment, request);

      items.push({
        key: `assignment-${assignment.id}`,
        source: "ASSIGNMENT",
        task,
        assignment,
        request,
        tree,
        customer,
        status,
        title,
        treeId,
        customerProfileId,
        operationRequestId:
          task?.operation_request_id || assignment.operation_request_id || request?.id || null,
        assignmentId: assignment.id || task?.assignment_id || null,
        createdAt: task?.created_at || assignment.started_at || request?.created_at || null,
        notes: task?.notes || assignment.notes || request?.notes || null,
      });
    });

    taskLogs.forEach((task) => {
      if (coveredTaskIds.has(String(task.id))) return;

      const assignment = getAssignment(task.assignment_id);
      const request = getRequest(task.operation_request_id || assignment?.operation_request_id);
      const treeId = task.tree_id || assignment?.tree_id || request?.tree_id || null;
      const customerProfileId =
        task.customer_profile_id ||
        assignment?.customer_profile_id ||
        request?.profile_id ||
        null;
      const tree = getTree(treeId);
      const customer = getCustomer(customerProfileId);
      const status = normalizeStatus(task.status || assignment?.status || request?.status);
      const title = getTitle(task, assignment, request);

      items.push({
        key: `task-${task.id}`,
        source: "TASK_LOG",
        task,
        assignment,
        request,
        tree,
        customer,
        status,
        title,
        treeId,
        customerProfileId,
        operationRequestId:
          task.operation_request_id || assignment?.operation_request_id || request?.id || null,
        assignmentId: task.assignment_id || assignment?.id || null,
        createdAt: task.created_at || assignment?.started_at || request?.created_at || null,
        notes: task.notes || assignment?.notes || request?.notes || null,
      });
    });

    return items.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [assignments, taskLogs, requests, trees, customers]);

  const stats = useMemo(() => {
    return {
      total: displayTasks.length,
      assigned: displayTasks.filter((task) => task.status === "ASSIGNED").length,
      inProgress: displayTasks.filter((task) => task.status === "IN_PROGRESS").length,
      submitted: displayTasks.filter((task) => task.status === "SUBMITTED").length,
      completed: displayTasks.filter((task) => task.status === "COMPLETED").length,
      cancelled: displayTasks.filter((task) =>
        ["CANCELLED", "REJECTED", "FAILED"].includes(task.status)
      ).length,
    };
  }, [displayTasks]);

  const filteredTasks = useMemo(() => {
    if (filter === "ALL") return displayTasks;

    if (filter === "CANCELLED") {
      return displayTasks.filter((task) =>
        ["CANCELLED", "REJECTED", "FAILED"].includes(task.status)
      );
    }

    return displayTasks.filter((task) => task.status === filter);
  }, [displayTasks, filter]);

  async function insertTaskStatusLog(item: DisplayTask, cleanStatus: string) {
    if (!caretaker) throw new Error("Caretaker not loaded.");

    const payload = {
      assignment_id: item.assignmentId || null,
      caretaker_id: caretaker.id,
      customer_profile_id: item.customerProfileId || null,
      tree_id: item.treeId || null,
      operation_request_id: item.operationRequestId || null,
      task_type: item.title || "Tree Task",
      notes: `Gardener updated task status to ${cleanStatus.replace("_", " ")}.`,
      status: cleanStatus,
    };

    const { data, error } = await supabase
      .from("caretaker_task_logs")
      .insert(payload)
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Failed to create task status log.");
    }

    return data.id as string;
  }

  async function updateTaskStatus(item: DisplayTask, nextStatus: string) {
    setMessage("");
    setSavingKey(item.key);

    const cleanStatus = normalizeStatus(nextStatus);

    try {
      if (item.task?.id) {
        const { error: taskError } = await supabase
          .from("caretaker_task_logs")
          .update({ status: cleanStatus })
          .eq("id", item.task.id)
          .eq("caretaker_id", caretaker?.id);

        if (taskError) throw taskError;
      }

      await insertTaskStatusLog(item, cleanStatus);

      if (item.assignmentId) {
        const { error: assignmentError } = await supabase
          .from("caretaker_assignments")
          .update({ status: cleanStatus })
          .eq("id", item.assignmentId)
          .eq("caretaker_id", caretaker?.id);

        if (assignmentError) throw assignmentError;
      }

      if (item.operationRequestId) {
        const { error: requestError } = await supabase
          .from("tree_operation_requests")
          .update({ status: cleanStatus })
          .eq("id", item.operationRequestId);

        if (requestError) throw requestError;
      }

      setMessage(`Task synced as ${cleanStatus.replace("_", " ")}.`);
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || "Task status update failed.");
    }

    setSavingKey("");
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

  function badgeClass(status: string) {
    if (status === "COMPLETED") {
      return "border-emerald-400/30 bg-emerald-500/20 text-emerald-200";
    }

    if (status === "SUBMITTED") {
      return "border-purple-400/30 bg-purple-500/20 text-purple-200";
    }

    if (status === "IN_PROGRESS") {
      return "border-yellow-400/30 bg-yellow-500/20 text-yellow-200";
    }

    if (["CANCELLED", "REJECTED", "FAILED"].includes(status)) {
      return "border-red-400/30 bg-red-500/20 text-red-200";
    }

    return "border-blue-400/30 bg-blue-500/20 text-blue-200";
  }

  function getTreeLabel(item: DisplayTask) {
    return (
      item.tree?.tree_code ||
      item.tree?.custom_name ||
      item.tree?.display_name ||
      shortId(item.treeId) ||
      "Tree"
    );
  }

  function getTreeSubLabel(item: DisplayTask) {
    const treeType = item.tree?.tree_type || item.tree?.custom_name || "Arganwood Tree";
    const stage =
      item.tree?.stage ||
      item.tree?.growth_stage ||
      item.tree?.current_stage ||
      item.tree?.status ||
      "Stage Pending";

    return item.tree ? `${treeType} • ${stage}` : shortId(item.treeId) || "—";
  }

  function getCustomerLabel(item: DisplayTask) {
    return (
      item.customer?.full_name ||
      item.customer?.email ||
      shortId(item.customerProfileId) ||
      "Customer"
    );
  }

  function getCustomerSubLabel(item: DisplayTask) {
    if (!item.customer) return shortId(item.customerProfileId) || "—";

    return `${item.customer.email || "No email"}${
      item.customer.membership_status ? ` • ${item.customer.membership_status}` : ""
    }`;
  }

  return (
    <main className="min-h-screen p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8 rounded-3xl border border-white/10 bg-[#071f16]/80 p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
              Arganwood Gardener Portal
            </p>

            <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
              Gardener Tasks
            </h1>

            <p className="mt-2 text-white/70">
              Jobs assigned by Admin Operations appear here. Start work, submit updates, and finish tasks to sync Admin, Customer, and Gardener status.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">
              Logged Gardener
            </p>
            <h3 className="mt-2 font-bold text-[#f7d774]">
              {caretaker?.full_name || caretaker?.name || caretaker?.email || "—"}
            </h3>
            <p className="mt-1 text-xs font-semibold text-white/45">
              {caretaker?.email || "No email"} • {caretaker?.status || "—"}
            </p>
          </div>
        </div>

        {message && (
          <div className="rounded-2xl border border-[#d9b45f]/20 bg-[#d9b45f]/10 p-4 text-sm font-semibold text-[#ffe8a3]">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total Jobs" value={String(stats.total)} />
          <StatCard label="Assigned" value={String(stats.assigned)} />
          <StatCard label="In Progress" value={String(stats.inProgress)} />
          <StatCard label="Submitted" value={String(stats.submitted)} />
          <StatCard label="Completed" value={String(stats.completed)} />
          <StatCard label="Cancelled" value={String(stats.cancelled)} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/10 p-5">
          <div className="flex flex-wrap gap-3">
            {(["ALL", "ASSIGNED", "IN_PROGRESS", "SUBMITTED", "COMPLETED", "CANCELLED"] as Filter[]).map(
              (item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`rounded-full px-5 py-3 text-sm font-bold transition ${
                    filter === item
                      ? "bg-[#f7d774] text-[#071f16]"
                      : "bg-white/10 text-white hover:bg-white/15"
                  }`}
                >
                  {item.replace("_", " ")}
                </button>
              )
            )}
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-white/70">
            Loading tasks...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-white/70">
            <h2 className="text-xl font-black text-[#ffe49a]">No tasks found.</h2>
            <p className="mt-2 leading-relaxed">
              This page shows jobs where caretaker_assignments.caretaker_id or caretaker_task_logs.caretaker_id equals the logged-in caretaker id.
            </p>
            <p className="mt-3 text-sm text-white/50">
              Logged caretaker id: {caretaker?.id || "—"}
            </p>
          </div>
        ) : (
          <section className="space-y-5">
            {filteredTasks.map((item) => {
              const completed = item.status === "COMPLETED";
              const closed = ["COMPLETED", "CANCELLED", "REJECTED", "FAILED"].includes(
                item.status
              );
              const query = buildTaskQuery(item);

              return (
                <div
                  key={item.key}
                  className="rounded-3xl border border-white/10 bg-white/[0.06] p-6"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-black text-[#ffe49a]">
                          {item.title}
                        </h2>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(
                            item.status
                          )}`}
                        >
                          {item.status.replace("_", " ")}
                        </span>

                        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-white/60">
                          {item.source === "ASSIGNMENT" ? "Assignment Synced" : "Task Log"}
                        </span>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-4">
                        <Info label="Tree" value={getTreeLabel(item)} subValue={getTreeSubLabel(item)} />
                        <Info label="Customer" value={getCustomerLabel(item)} subValue={getCustomerSubLabel(item)} />
                        <Info
                          label="Operation Request"
                          value={shortId(item.operationRequestId) || "—"}
                          subValue={item.request?.status ? `Request: ${item.request.status}` : "tree_operation_requests"}
                        />
                        <Info label="Created" value={formatDate(item.createdAt)} />
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <Info
                          label="Assignment"
                          value={shortId(item.assignmentId) || "—"}
                          subValue={item.assignment?.status ? `Assignment: ${item.assignment.status}` : "caretaker_assignments"}
                        />
                        <Info
                          label="Latest Task"
                          value={shortId(item.task?.id) || "No task log yet"}
                          subValue={item.task?.status ? `Task: ${item.task.status}` : "Will create when updated"}
                        />
                        <Info
                          label="Logged Caretaker"
                          value={caretaker?.full_name || caretaker?.name || caretaker?.email || "—"}
                          subValue={shortId(caretaker?.id) || "caretakers.id"}
                        />
                      </div>

                      {item.notes && (
                        <div className="mt-4 rounded-2xl bg-black/20 p-4 text-sm text-white/70">
                          Notes: {item.notes}
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link
                          href={`/gardener/photo-updates${query}`}
                          className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15"
                        >
                          Photo Update
                        </Link>

                        <Link
                          href={`/gardener/gps-updates${query}`}
                          className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15"
                        >
                          GPS Update
                        </Link>

                        <Link
                          href={`/gardener/health-reports${query}`}
                          className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15"
                        >
                          Health Report
                        </Link>
                      </div>
                    </div>

                    <div className="w-full rounded-2xl bg-black/20 p-4 lg:w-[330px]">
                      <label className="text-sm font-bold text-white/70">
                        Update Task Status
                      </label>

                      <select
                        value={item.status}
                        disabled={savingKey === item.key || closed}
                        onChange={(event) =>
                          updateTaskStatus(item, event.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-white/10 bg-[#071f16] px-4 py-3 text-white outline-none disabled:opacity-50"
                      >
                        <option value="ASSIGNED">ASSIGNED</option>
                        <option value="IN_PROGRESS">IN PROGRESS</option>
                        <option value="SUBMITTED">SUBMITTED</option>
                        <option value="COMPLETED">COMPLETED</option>
                      </select>

                      <div className="mt-4 grid gap-3">
                        {item.status === "ASSIGNED" && (
                          <button
                            onClick={() => updateTaskStatus(item, "IN_PROGRESS")}
                            disabled={savingKey === item.key}
                            className="rounded-xl bg-blue-500/20 px-4 py-3 font-bold text-blue-100 hover:bg-blue-500/30 disabled:opacity-50"
                          >
                            {savingKey === item.key ? "Saving..." : "Start Work"}
                          </button>
                        )}

                        {!closed && item.status !== "SUBMITTED" && (
                          <button
                            onClick={() => updateTaskStatus(item, "SUBMITTED")}
                            disabled={savingKey === item.key}
                            className="rounded-xl bg-purple-500/20 px-4 py-3 font-bold text-purple-100 hover:bg-purple-500/30 disabled:opacity-50"
                          >
                            {savingKey === item.key ? "Saving..." : "Submit Updates"}
                          </button>
                        )}

                        {!closed && (
                          <button
                            onClick={() => updateTaskStatus(item, "COMPLETED")}
                            disabled={savingKey === item.key}
                            className="rounded-xl bg-emerald-500/20 px-4 py-3 font-bold text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50"
                          >
                            {savingKey === item.key ? "Saving..." : "Finish Task"}
                          </button>
                        )}

                        {completed && (
                          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-center text-sm font-bold text-emerald-100">
                            Completed and synced to Admin + Customer operation status.
                          </div>
                        )}

                        {closed && !completed && (
                          <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-center text-sm font-bold text-red-100">
                            This task is closed.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
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
    <div className="rounded-xl bg-white/10 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-white/40">
        {label}
      </p>
      <p className="mt-1 break-words font-bold text-white/85">{value || "—"}</p>
      {subValue ? (
        <p className="mt-1 break-words text-xs font-semibold text-white/45">
          {subValue}
        </p>
      ) : null}
    </div>
  );
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

function shortId(value: string | null | undefined) {
  if (!value) return "";

  const text = String(value);

  if (text.length <= 12) return text;

  return `${text.slice(0, 8)}…${text.slice(-4)}`;
}
