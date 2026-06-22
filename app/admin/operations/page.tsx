"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type OperationRequest = Record<string, any>;
type Caretaker = Record<string, any>;
type Assignment = Record<string, any>;
type TaskLog = Record<string, any>;

export default function AdminOperationsPage() {
  const [requests, setRequests] = useState<OperationRequest[]>([]);
  const [caretakers, setCaretakers] = useState<Caretaker[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tasks, setTasks] = useState<TaskLog[]>([]);
  const [selectedCaretaker, setSelectedCaretaker] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [processingId, setProcessingId] = useState("");

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

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const pending = requests.filter(
      (item) => String(item.status || "PENDING").toUpperCase() === "PENDING"
    ).length;

    const assigned = assignments.filter(
      (item) => String(item.status || "").toUpperCase() === "ASSIGNED"
    ).length;

    const inProgress = assignments.filter(
      (item) => String(item.status || "").toUpperCase() === "IN_PROGRESS"
    ).length;

    const completed = assignments.filter(
      (item) => String(item.status || "").toUpperCase() === "COMPLETED"
    ).length;

    return {
      pending,
      assigned,
      inProgress,
      completed,
      activeCaretakers: caretakers.length,
    };
  }, [requests, assignments, caretakers]);

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
  }

  return (
    <main className="min-h-screen text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8 rounded-3xl bg-[#071f16]/75 p-8 backdrop-blur-md border border-white/10 shadow-2xl">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
            Arganwood Admin Operations
          </p>

          <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
            Operations Assignment Queue
          </h1>

          <p className="mt-2 text-white/70">
            Assign customer operation requests and monitor gardener progress.
          </p>
        </div>

        {message && (
          <div className="rounded-2xl border border-[#d9b45f]/30 bg-[#d9b45f]/10 p-4 text-[#f7e3a1]">
            {message}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-5">
          <Stat label="Pending Requests" value={stats.pending} />
          <Stat label="Assigned" value={stats.assigned} />
          <Stat label="In Progress" value={stats.inProgress} />
          <Stat label="Completed" value={stats.completed} />
          <Stat label="Active Gardeners" value={stats.activeCaretakers} />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/10 p-8">
          <h2 className="text-2xl font-bold text-[#d9b45f]">
            Customer Operation Requests
          </h2>

          {loading ? (
            <p className="mt-4 text-white/70">Loading operations...</p>
          ) : requests.length === 0 ? (
            <p className="mt-4 text-white/70">No operation requests found.</p>
          ) : (
            <div className="mt-6 space-y-4">
              {requests.map((request) => {
                const assignment = getAssignmentForRequest(request.id);
                const task = getTaskForAssignment(assignment?.id);
                const status = String(
                  assignment?.status || request.status || "PENDING"
                ).toUpperCase();

                return (
                  <div
                    key={request.id}
                    className="rounded-2xl border border-white/10 bg-[#03140f]/70 p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                          {request.created_at
                            ? new Date(request.created_at).toLocaleString()
                            : "No date"}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <h3 className="text-xl font-bold text-white">
                            {request.care_program_name ||
                              request.operation_type ||
                              "Tree Operation"}
                          </h3>

                          <StatusBadge status={status} />
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <Info label="Tree" value={request.tree_id || "—"} />
                          <Info label="Customer" value={request.profile_id || "—"} />
                          <Info label="Request Status" value={request.status || "PENDING"} />
                        </div>

                        {assignment && (
                          <div className="mt-4 grid gap-3 md:grid-cols-3">
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

                        {!assignment ? (
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
                              {processingId === request.id
                                ? "Assigning..."
                                : "Assign Gardener"}
                            </button>
                          </>
                        ) : (
                          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">
                            Connected to Gardener Portal. Gardener can update status from Assigned Trees or Tasks.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
      <p className="text-sm text-white/70">{label}</p>
      <p className="mt-3 text-3xl font-bold text-[#d9b45f]">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-white/40">{label}</p>
      <p className="mt-1 break-all font-bold text-white/85">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "COMPLETED"
      ? "bg-emerald-500/20 text-emerald-100 border-emerald-300/30"
      : status === "IN_PROGRESS"
      ? "bg-yellow-500/20 text-yellow-100 border-yellow-300/30"
      : status === "ASSIGNED"
      ? "bg-blue-500/20 text-blue-100 border-blue-300/30"
      : "bg-white/10 text-white/70 border-white/10";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-black ${color}`}>
      {status.replace("_", " ")}
    </span>
  );
}