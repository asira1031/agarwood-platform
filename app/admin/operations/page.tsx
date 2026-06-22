"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type OperationRequest = Record<string, any>;
type Caretaker = Record<string, any>;
type Assignment = Record<string, any>;
type TaskLog = Record<string, any>;
type ProfileRow = Record<string, any>;
type TreeRow = Record<string, any>;

type TabKey =
  | "ALL"
  | "SUBSCRIPTION"
  | "MANUAL"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "COMPLETED"
  | "CANCELLED";

type EnrichedOperation = {
  request: OperationRequest;
  assignment: Assignment | null;
  task: TaskLog | null;
  status: string;
  isSubscription: boolean;
};

export default function AdminOperationsPage() {
  const [requests, setRequests] = useState<OperationRequest[]>([]);
  const [caretakers, setCaretakers] = useState<Caretaker[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tasks, setTasks] = useState<TaskLog[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [selectedCaretaker, setSelectedCaretaker] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<TabKey>("ALL");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [processingId, setProcessingId] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const { data: requestRows, error: requestError } = await supabase
      .from("tree_operation_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (requestError) {
      setMessage(requestError.message);
      setLoading(false);
      return;
    }

    const { data: caretakerRows, error: caretakerError } = await supabase
      .from("caretakers")
      .select("*")
      .eq("status", "ACTIVE")
      .order("full_name", { ascending: true });

    if (caretakerError) {
      setMessage(caretakerError.message);
      setLoading(false);
      return;
    }

    const { data: assignmentRows, error: assignmentError } = await supabase
      .from("caretaker_assignments")
      .select("*")
      .order("started_at", { ascending: false });

    if (assignmentError) {
      setMessage(assignmentError.message);
      setLoading(false);
      return;
    }

    const { data: taskRows, error: taskError } = await supabase
      .from("caretaker_task_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (taskError) {
      setMessage(taskError.message);
      setLoading(false);
      return;
    }

    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, membership_status, kyc_status")
      .order("created_at", { ascending: false });

    if (profileError) {
      console.warn("Admin Operations profile load warning:", profileError.message);
    }

    const { data: treeRows, error: treeError } = await supabase
      .from("trees")
      .select("id, profile_id, tree_code, custom_name, display_name, tree_type, stage, growth_stage, current_stage, status, created_at")
      .order("created_at", { ascending: false });

    if (treeError) {
      console.warn("Admin Operations tree load warning:", treeError.message);
    }

    setRequests(requestRows || []);
    setCaretakers(caretakerRows || []);
    setAssignments(assignmentRows || []);
    setTasks(taskRows || []);
    setProfiles(profileError ? [] : profileRows || []);
    setTrees(treeError ? [] : treeRows || []);
    setLoading(false);
  }

  function normalizeStatus(value: any) {
    return String(value || "PENDING").trim().toUpperCase();
  }

  function getAssignmentForRequest(requestId: string) {
    return (
      assignments.find((item) => String(item.operation_request_id || "") === String(requestId)) ||
      null
    );
  }

  function getLatestTaskForRequest(requestId: string, assignmentId?: string | null) {
    const byAssignment = assignmentId
      ? tasks.find((item) => String(item.assignment_id || "") === String(assignmentId))
      : null;

    if (byAssignment) return byAssignment;

    return (
      tasks.find((item) => String(item.operation_request_id || "") === String(requestId)) ||
      null
    );
  }

  function getCaretakerName(caretakerId?: string | null) {
    if (!caretakerId) return "Gardener";

    const caretaker = caretakers.find((item) => String(item.id) === String(caretakerId));
    return caretaker?.full_name || caretaker?.name || caretaker?.email || "Gardener";
  }

  function getCustomerProfile(profileId?: string | null) {
    if (!profileId) return null;

    return (
      profiles.find((item) => String(item.id || "") === String(profileId)) ||
      null
    );
  }

  function getCustomerName(profileId?: string | null) {
    const profile = getCustomerProfile(profileId);

    if (!profile) return shortId(profileId) || "Customer";

    return profile.full_name || profile.email || shortId(profileId) || "Customer";
  }

  function getCustomerSubtitle(profileId?: string | null) {
    const profile = getCustomerProfile(profileId);

    if (!profile) return shortId(profileId) || "—";

    const email = profile.email || "No email";
    const member = profile.membership_status ? ` • ${profile.membership_status}` : "";

    return `${email}${member}`;
  }

  function getTreeRow(treeId?: string | null) {
    if (!treeId) return null;

    return (
      trees.find((item) => String(item.id || "") === String(treeId)) ||
      trees.find((item) => String(item.tree_code || "") === String(treeId)) ||
      null
    );
  }

  function getTreeName(treeId?: string | null) {
    const tree = getTreeRow(treeId);

    if (!tree) return shortId(treeId) || "Tree";

    return (
      tree.tree_code ||
      tree.custom_name ||
      tree.display_name ||
      tree.tree_type ||
      shortId(treeId) ||
      "Tree"
    );
  }

  function getTreeSubtitle(treeId?: string | null) {
    const tree = getTreeRow(treeId);

    if (!tree) return shortId(treeId) || "—";

    const stage =
      tree.stage ||
      tree.growth_stage ||
      tree.current_stage ||
      tree.status ||
      "Stage Pending";

    const type = tree.tree_type || tree.custom_name || tree.display_name || "Arganwood Tree";

    return `${type} • ${stage}`;
  }

  function isSubscriptionRequest(request: OperationRequest) {
    const text = `${request.care_program_name || ""} ${request.operation_type || ""} ${request.request_type || ""}`.toLowerCase();

    return (
      request.auto_renew_enabled === true ||
      Boolean(request.subscription_id) ||
      text.includes("subscription") ||
      text.includes("subscribe")
    );
  }

  function getRequestTitle(request: OperationRequest) {
    return (
      request.care_program_name ||
      request.operation_type ||
      request.request_type ||
      request.assignment_type ||
      "Tree Operation"
    );
  }

  function getRequestAmount(request: OperationRequest) {
    const raw =
      request.total_amount ??
      request.care_program_price ??
      request.operation_fee ??
      request.amount ??
      request.price ??
      null;

    const amount = Number(raw || 0);

    if (!raw && amount === 0) return 0;

    return amount;
  }

  function getRequestAmountLabel(request: OperationRequest) {
    const amount = getRequestAmount(request);

    if (!Number.isFinite(amount) || amount <= 0) return "—";

    return peso(amount);
  }

  const enrichedRequests = useMemo<EnrichedOperation[]>(() => {
    return requests.map((request) => {
      const assignment = getAssignmentForRequest(request.id);
      const task = getLatestTaskForRequest(request.id, assignment?.id);
      const status = normalizeStatus(
        task?.status || assignment?.status || request.status || "PENDING"
      );

      return {
        request,
        assignment,
        task,
        status,
        isSubscription: isSubscriptionRequest(request),
      };
    });
  }, [requests, assignments, tasks, profiles, trees]);

  const subscriptionQueue = enrichedRequests.filter(
    (item) =>
      item.isSubscription &&
      ["PENDING", "REQUESTED", "PAID"].includes(item.status)
  );

  const manualQueue = enrichedRequests.filter(
    (item) =>
      !item.isSubscription &&
      ["PENDING", "REQUESTED", "PAID"].includes(item.status)
  );

  const assignedQueue = enrichedRequests.filter((item) => item.status === "ASSIGNED");
  const inProgressQueue = enrichedRequests.filter((item) => item.status === "IN_PROGRESS");
  const submittedQueue = enrichedRequests.filter((item) => item.status === "SUBMITTED");
  const completedQueue = enrichedRequests.filter((item) => item.status === "COMPLETED");
  const cancelledQueue = enrichedRequests.filter((item) =>
    ["CANCELLED", "REJECTED", "FAILED"].includes(item.status)
  );

  const activeQueue = useMemo(() => {
    if (tab === "SUBSCRIPTION") return subscriptionQueue;
    if (tab === "MANUAL") return manualQueue;
    if (tab === "ASSIGNED") return assignedQueue;
    if (tab === "IN_PROGRESS") return inProgressQueue;
    if (tab === "SUBMITTED") return submittedQueue;
    if (tab === "COMPLETED") return completedQueue;
    if (tab === "CANCELLED") return cancelledQueue;
    return enrichedRequests;
  }, [
    tab,
    enrichedRequests,
    subscriptionQueue,
    manualQueue,
    assignedQueue,
    inProgressQueue,
    submittedQueue,
    completedQueue,
    cancelledQueue,
  ]);

  async function rollbackCreatedAssignment(assignmentId: string) {
    await supabase.from("caretaker_task_logs").delete().eq("assignment_id", assignmentId);
    await supabase.from("caretaker_assignments").delete().eq("id", assignmentId);
  }

  async function assignCaretaker(request: OperationRequest) {
    setMessage("");

    const caretakerId = selectedCaretaker[request.id];

    if (!caretakerId) {
      setMessage("Please select a gardener first.");
      return;
    }

    const existing = getAssignmentForRequest(request.id);

    if (existing) {
      setMessage("This operation request already has a gardener assignment.");
      return;
    }

    setProcessingId(request.id);

    const taskType = getRequestTitle(request);

    const assignmentPayload = {
      caretaker_id: caretakerId,
      customer_profile_id: request.profile_id || null,
      tree_id: request.tree_id || null,
      operation_request_id: request.id,
      assignment_type: taskType,
      status: "ASSIGNED",
      started_at: new Date().toISOString(),
      notes: request.notes || null,
    };

    const { data: createdAssignment, error: assignmentError } = await supabase
      .from("caretaker_assignments")
      .insert(assignmentPayload)
      .select("id")
      .single();

    if (assignmentError || !createdAssignment) {
      setMessage(assignmentError?.message || "Assignment creation failed.");
      setProcessingId("");
      return;
    }

    const { data: createdTask, error: taskLogError } = await supabase
      .from("caretaker_task_logs")
      .insert({
        assignment_id: createdAssignment.id,
        caretaker_id: caretakerId,
        customer_profile_id: request.profile_id || null,
        tree_id: request.tree_id || null,
        operation_request_id: request.id,
        task_type: taskType,
        notes: "Assigned from Admin Operations Center.",
        status: "ASSIGNED",
      })
      .select("id")
      .single();

    if (taskLogError || !createdTask) {
      await rollbackCreatedAssignment(createdAssignment.id);
      setMessage(
        taskLogError?.message ||
          "Task creation failed. Assignment was rolled back so the gardener queue stays clean."
      );
      setProcessingId("");
      return;
    }

    const { error: requestUpdateError } = await supabase
      .from("tree_operation_requests")
      .update({ status: "ASSIGNED" })
      .eq("id", request.id);

    if (requestUpdateError) {
      await rollbackCreatedAssignment(createdAssignment.id);
      setMessage(
        `Request status sync failed. Assignment and task were rolled back: ${requestUpdateError.message}`
      );
      setProcessingId("");
      return;
    }

    setProcessingId("");
    setMessage("Gardener assigned successfully. This job will now appear in the Gardener Portal Tasks page.");
    await loadData();
    setTab("ASSIGNED");
  }

  async function cancelRequest(request: OperationRequest) {
    const confirmed = window.confirm("Cancel this operation request?");
    if (!confirmed) return;

    setProcessingId(request.id);
    setMessage("");

    const assignment = getAssignmentForRequest(request.id);

    if (assignment) {
      await supabase
        .from("caretaker_task_logs")
        .update({ status: "CANCELLED" })
        .eq("assignment_id", assignment.id);

      await supabase
        .from("caretaker_assignments")
        .update({ status: "CANCELLED" })
        .eq("id", assignment.id);
    }

    const { error } = await supabase
      .from("tree_operation_requests")
      .update({ status: "CANCELLED" })
      .eq("id", request.id);

    if (error) {
      setMessage(error.message);
      setProcessingId("");
      return;
    }

    setMessage("Operation request cancelled and synced when assignment/task existed.");
    setProcessingId("");
    await loadData();
    setTab("CANCELLED");
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

  return (
    <main className="min-h-screen p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8 rounded-3xl border border-white/10 bg-[#071f16]/80 p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
              Arganwood Admin Operations
            </p>

            <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
              Operations Queue
            </h1>

            <p className="mt-2 text-white/70">
              Customer requests from Tree Operations appear here first. Assign an active gardener to create caretaker_assignments and caretaker_task_logs for the Gardener Portal.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-5 py-3 text-sm font-semibold text-[#f7d774] hover:bg-[#d9b45f]/25 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh Operations"}
          </button>
        </div>

        {message && (
          <div className="rounded-2xl border border-[#d9b45f]/30 bg-[#d9b45f]/10 p-4 text-[#f7e3a1]">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4 xl:grid-cols-8">
          <Stat label="All" value={enrichedRequests.length} />
          <Stat label="Subscription" value={subscriptionQueue.length} />
          <Stat label="Manual" value={manualQueue.length} />
          <Stat label="Assigned" value={assignedQueue.length} />
          <Stat label="In Progress" value={inProgressQueue.length} />
          <Stat label="Submitted" value={submittedQueue.length} />
          <Stat label="Completed" value={completedQueue.length} />
          <Stat label="Gardeners" value={caretakers.length} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/10 p-5">
          <div className="flex flex-wrap gap-3">
            {[
              ["ALL", "All Records"],
              ["SUBSCRIPTION", "Subscription Queue"],
              ["MANUAL", "Manual Queue"],
              ["ASSIGNED", "Assigned"],
              ["IN_PROGRESS", "In Progress"],
              ["SUBMITTED", "Submitted"],
              ["COMPLETED", "Completed"],
              ["CANCELLED", "Cancelled"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key as TabKey)}
                className={`rounded-full px-5 py-3 text-sm font-bold transition ${
                  tab === key
                    ? "bg-[#f7d774] text-[#071f16]"
                    : "bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/10 p-8">
          {loading ? (
            <p className="text-white/70">Loading operations...</p>
          ) : activeQueue.length === 0 ? (
            <p className="text-white/70">No operation requests in this tab.</p>
          ) : (
            <div className="space-y-4">
              {activeQueue.map(({ request, assignment, task, status, isSubscription }) => {
                const assignmentStatus = normalizeStatus(assignment?.status || "");
                const taskStatus = normalizeStatus(task?.status || assignment?.status || request.status);
                const isClosed = ["CANCELLED", "REJECTED", "FAILED", "COMPLETED"].includes(status);
                const canAssign = !assignment && !isClosed;

                return (
                  <div
                    key={request.id}
                    className="rounded-2xl border border-white/10 bg-[#03140f]/70 p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                          {formatDate(request.created_at)}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <h3 className="text-xl font-bold text-white">
                            {getRequestTitle(request)}
                          </h3>

                          <StatusBadge status={status} />
                          <TypeBadge label={isSubscription ? "Subscription" : "Manual"} />
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-4">
                          <Info
                            label="Tree"
                            value={getTreeName(request.tree_id)}
                            subValue={getTreeSubtitle(request.tree_id)}
                          />
                          <Info
                            label="Customer"
                            value={getCustomerName(request.profile_id)}
                            subValue={getCustomerSubtitle(request.profile_id)}
                          />
                          <Info label="Request Status" value={request.status || "PENDING"} />
                          <Info label="Amount" value={getRequestAmountLabel(request)} />
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-4">
                          <Info
                            label="Operation Request"
                            value={shortId(request.id) || "—"}
                            subValue="tree_operation_requests"
                          />
                          <Info
                            label="Assignment"
                            value={assignment ? shortId(assignment.id) || "ASSIGNED" : "Not assigned"}
                            subValue={assignment ? assignmentStatus : "Waiting for admin"}
                          />
                          <Info
                            label="Gardener"
                            value={assignment ? getCaretakerName(assignment.caretaker_id) : "Not assigned"}
                            subValue={assignment?.caretaker_id ? shortId(assignment.caretaker_id) || "" : "Select below"}
                          />
                          <Info
                            label="Task Status"
                            value={task ? taskStatus : "No task yet"}
                            subValue={task ? "caretaker_task_logs" : "Created after assign"}
                          />
                        </div>

                        {request.notes && (
                          <p className="mt-4 rounded-xl bg-white/10 p-3 text-sm text-white/70">
                            Notes: {request.notes}
                          </p>
                        )}
                      </div>

                      <div className="min-w-[280px] space-y-3">
                        <div className="rounded-xl bg-white/10 p-3">
                          <p className="text-xs text-white/50">Gardener Assignment</p>
                          <p className="font-bold text-[#d9b45f]">
                            {assignment
                              ? `ASSIGNED to ${getCaretakerName(assignment.caretaker_id)}`
                              : "Not assigned"}
                          </p>
                        </div>

                        {canAssign ? (
                          <>
                            <select
                              className="w-full rounded-xl border border-white/10 bg-[#071f16] p-3 text-white outline-none"
                              value={selectedCaretaker[request.id] || ""}
                              onChange={(e) =>
                                setSelectedCaretaker((current) => ({
                                  ...current,
                                  [request.id]: e.target.value,
                                }))
                              }
                            >
                              <option value="">Select gardener</option>
                              {caretakers.map((caretaker) => (
                                <option key={caretaker.id} value={caretaker.id}>
                                  {caretaker.full_name || caretaker.name || caretaker.email}
                                </option>
                              ))}
                            </select>

                            <button
                              onClick={() => assignCaretaker(request)}
                              disabled={processingId === request.id || caretakers.length === 0}
                              className="w-full rounded-xl bg-[#d9b45f] px-4 py-3 font-bold text-[#071f16] disabled:opacity-50"
                            >
                              {processingId === request.id ? "Assigning..." : "Assign Gardener"}
                            </button>

                            <button
                              onClick={() => cancelRequest(request)}
                              disabled={processingId === request.id}
                              className="w-full rounded-xl border border-red-300/30 bg-red-500/10 px-4 py-3 font-bold text-red-100 disabled:opacity-50"
                            >
                              Cancel Request
                            </button>
                          </>
                        ) : (
                          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">
                            {assignment
                              ? "Connected to Gardener Portal. Gardener can update this job from their task list."
                              : "This request is closed and cannot be assigned."}
                          </div>
                        )}

                        {assignment && !["COMPLETED", "CANCELLED", "REJECTED", "FAILED"].includes(status) && (
                          <button
                            onClick={() => cancelRequest(request)}
                            disabled={processingId === request.id}
                            className="w-full rounded-xl border border-red-300/30 bg-red-500/10 px-4 py-3 font-bold text-red-100 disabled:opacity-50"
                          >
                            Cancel & Sync
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
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
  value: string | number | null | undefined;
  subValue?: string | number | null | undefined;
}) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-white/40">{label}</p>
      <p className="mt-1 break-words font-bold text-white/85">{value || "—"}</p>
      {subValue ? (
        <p className="mt-1 break-words text-xs font-semibold text-white/45">{subValue}</p>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = String(status || "PENDING").toUpperCase();

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
      : "border-white/10 bg-white/10 text-white/70";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-black ${color}`}>
      {normalized.replace("_", " ")}
    </span>
  );
}

function TypeBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[#d9b45f]/30 bg-[#d9b45f]/10 px-3 py-1 text-xs font-black text-[#f7d774]">
      {label}
    </span>
  );
}

function shortId(value: string | null | undefined) {
  if (!value) return "";

  const text = String(value);

  if (text.length <= 12) return text;

  return `${text.slice(0, 8)}…${text.slice(-4)}`;
}

function peso(value: number) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
