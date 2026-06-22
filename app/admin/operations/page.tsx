"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type OperationRequest = Record<string, any>;
type Caretaker = Record<string, any>;
type Assignment = Record<string, any>;
type TaskLog = Record<string, any>;

type TabKey =
  | "SUBSCRIPTION"
  | "MANUAL"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "ALL";

export default function AdminOperationsPage() {
  const [requests, setRequests] = useState<OperationRequest[]>([]);
  const [caretakers, setCaretakers] = useState<Caretaker[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tasks, setTasks] = useState<TaskLog[]>([]);
  const [selectedCaretaker, setSelectedCaretaker] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<TabKey>("SUBSCRIPTION");
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

    setRequests(requestRows || []);
    setCaretakers(caretakerRows || []);
    setAssignments(assignmentRows || []);
    setTasks(taskRows || []);
    setLoading(false);
  }

  function normalizeStatus(value: any) {
    return String(value || "PENDING").toUpperCase();
  }

  function getAssignmentForRequest(requestId: string) {
    return assignments.find((item) => item.operation_request_id === requestId);
  }

  function getTaskForAssignment(assignmentId?: string) {
    if (!assignmentId) return null;
    return tasks.find((item) => item.assignment_id === assignmentId);
  }

  function getCaretakerName(caretakerId?: string) {
    const caretaker = caretakers.find((item) => item.id === caretakerId);
    return caretaker?.full_name || caretaker?.email || "Gardener";
  }

  function isSubscriptionRequest(request: OperationRequest) {
    const text = `${request.care_program_name || ""} ${request.operation_type || ""} ${request.request_type || ""}`.toLowerCase();
    return (
      text.includes("subscription") ||
      text.includes("monthly") ||
      text.includes("premium") ||
      text.includes("standard") ||
      Boolean(request.subscription_id)
    );
  }

  const enrichedRequests = useMemo(() => {
    return requests.map((request) => {
      const assignment = getAssignmentForRequest(request.id);
      const task = getTaskForAssignment(assignment?.id);
      const status = normalizeStatus(assignment?.status || request.status || "PENDING");

      return {
        request,
        assignment,
        task,
        status,
        isSubscription: isSubscriptionRequest(request),
      };
    });
  }, [requests, assignments, tasks]);

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
  const completedQueue = enrichedRequests.filter((item) => item.status === "COMPLETED");
  const cancelledQueue = enrichedRequests.filter((item) =>
    ["CANCELLED", "REJECTED", "FAILED"].includes(item.status)
  );

  const activeQueue = useMemo(() => {
    if (tab === "SUBSCRIPTION") return subscriptionQueue;
    if (tab === "MANUAL") return manualQueue;
    if (tab === "ASSIGNED") return assignedQueue;
    if (tab === "IN_PROGRESS") return inProgressQueue;
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
    completedQueue,
    cancelledQueue,
  ]);

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

    const taskType =
      request.care_program_name ||
      request.operation_type ||
      request.request_type ||
      "Tree Operation";

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

    const { error: taskLogError } = await supabase
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
      });

    if (taskLogError) {
      setMessage(taskLogError.message);
      setProcessingId("");
      return;
    }

    await supabase
      .from("tree_operation_requests")
      .update({ status: "ASSIGNED" })
      .eq("id", request.id);

    setProcessingId("");
    setMessage("Gardener assigned successfully. This job will now appear in the Gardener Portal.");
    await loadData();
    setTab("ASSIGNED");
  }

  async function cancelRequest(request: OperationRequest) {
    const confirmed = window.confirm("Cancel this operation request?");
    if (!confirmed) return;

    setProcessingId(request.id);
    setMessage("");

    const { error } = await supabase
      .from("tree_operation_requests")
      .update({ status: "CANCELLED" })
      .eq("id", request.id);

    if (error) {
      setMessage(error.message);
      setProcessingId("");
      return;
    }

    setMessage("Operation request cancelled.");
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
              Separate subscription care jobs from manual operation requests and assign gardeners.
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

        <section className="grid gap-4 md:grid-cols-6">
          <Stat label="Subscription" value={subscriptionQueue.length} />
          <Stat label="Manual" value={manualQueue.length} />
          <Stat label="Assigned" value={assignedQueue.length} />
          <Stat label="In Progress" value={inProgressQueue.length} />
          <Stat label="Completed" value={completedQueue.length} />
          <Stat label="Gardeners" value={caretakers.length} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/10 p-5">
          <div className="flex flex-wrap gap-3">
            {[
              ["SUBSCRIPTION", "Subscription Queue"],
              ["MANUAL", "Manual Queue"],
              ["ASSIGNED", "Assigned"],
              ["IN_PROGRESS", "In Progress"],
              ["COMPLETED", "Completed"],
              ["CANCELLED", "Cancelled"],
              ["ALL", "All Records"],
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
              {activeQueue.map(({ request, assignment, task, status, isSubscription }) => (
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
                          {request.care_program_name ||
                            request.operation_type ||
                            request.request_type ||
                            "Tree Operation"}
                        </h3>

                        <StatusBadge status={status} />
                        <TypeBadge label={isSubscription ? "Subscription" : "Manual"} />
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <Info label="Tree" value={request.tree_id || "—"} />
                        <Info label="Customer" value={request.profile_id || "—"} />
                        <Info label="Request Status" value={request.status || "PENDING"} />
                        <Info label="Amount" value={request.amount || request.price || "—"} />
                      </div>

                      {assignment && (
                        <div className="mt-4 grid gap-3 md:grid-cols-4">
                          <Info
                            label="Assigned Gardener"
                            value={getCaretakerName(assignment.caretaker_id)}
                          />
                          <Info
                            label="Assignment Status"
                            value={assignment.status || "ASSIGNED"}
                          />
                          <Info
                            label="Task Status"
                            value={task?.status || "ASSIGNED"}
                          />
                          <Info
                            label="Assigned Date"
                            value={formatDate(assignment.started_at)}
                          />
                        </div>
                      )}

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

                      {!assignment && !["CANCELLED", "REJECTED", "FAILED"].includes(status) ? (
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
                                {caretaker.full_name || caretaker.email}
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
                          Connected to Gardener Portal. Gardener can update this job from their task list.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-white/40">{label}</p>
      <p className="mt-1 break-all font-bold text-white/85">{value || "—"}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "COMPLETED"
      ? "border-emerald-300/30 bg-emerald-500/20 text-emerald-100"
      : status === "IN_PROGRESS"
      ? "border-yellow-300/30 bg-yellow-500/20 text-yellow-100"
      : status === "ASSIGNED"
      ? "border-blue-300/30 bg-blue-500/20 text-blue-100"
      : ["CANCELLED", "REJECTED", "FAILED"].includes(status)
      ? "border-red-300/30 bg-red-500/20 text-red-100"
      : "border-white/10 bg-white/10 text-white/70";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-black ${color}`}>
      {status.replace("_", " ")}
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