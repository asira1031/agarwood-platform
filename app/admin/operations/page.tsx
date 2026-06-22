"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type OperationRequest = Record<string, any>;
type Caretaker = Record<string, any>;
type Assignment = Record<string, any>;

export default function AdminOperationsPage() {
  const [requests, setRequests] = useState<OperationRequest[]>([]);
  const [caretakers, setCaretakers] = useState<Caretaker[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
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

    setRequests(requestRows || []);
    setCaretakers(caretakerRows || []);
    setAssignments(assignmentRows || []);
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

    const completed = assignments.filter(
      (item) => String(item.status || "").toUpperCase() === "COMPLETED"
    ).length;

    const activeCaretakers = caretakers.length;

    return { pending, assigned, completed, activeCaretakers };
  }, [requests, assignments, caretakers]);

  function getAssignmentForRequest(requestId: string) {
    return assignments.find((item) => item.operation_request_id === requestId);
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
            Assign customer tree operation requests to active gardeners.
          </p>
        </div>

        {message && (
          <div className="rounded-2xl border border-[#d9b45f]/30 bg-[#d9b45f]/10 p-4 text-[#f7e3a1]">
            {message}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Stat label="Pending Requests" value={stats.pending} />
          <Stat label="Assigned Jobs" value={stats.assigned} />
          <Stat label="Completed Jobs" value={stats.completed} />
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
                const assignedCaretaker = caretakers.find(
                  (item) => item.id === assignment?.caretaker_id
                );

                return (
                  <div
                    key={request.id}
                    className="rounded-2xl border border-white/10 bg-[#03140f]/70 p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                          {request.created_at
                            ? new Date(request.created_at).toLocaleString()
                            : "No date"}
                        </p>

                        <h3 className="mt-2 text-xl font-bold text-white">
                          {request.care_program_name ||
                            request.operation_type ||
                            "Tree Operation"}
                        </h3>

                        <p className="mt-2 text-sm text-white/60">
                          Tree: {request.tree_id || "—"}
                        </p>

                        <p className="mt-1 text-sm text-white/60">
                          Customer: {request.profile_id || "—"}
                        </p>

                        <p className="mt-1 text-sm text-white/60">
                          Request Status: {request.status || "PENDING"}
                        </p>

                        {request.notes && (
                          <p className="mt-3 text-sm text-white/70">
                            Notes: {request.notes}
                          </p>
                        )}
                      </div>

                      <div className="min-w-[280px] space-y-3">
                        <div className="rounded-xl bg-white/10 p-3">
                          <p className="text-xs text-white/50">Gardener Assignment</p>
                          <p className="font-bold text-[#d9b45f]">
                            {assignment
                              ? `ASSIGNED to ${assignedCaretaker?.full_name || assignedCaretaker?.email || "Gardener"}`
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

                            {caretakers.length === 0 && (
                              <p className="text-xs text-red-200">
                                No active gardeners found. Add one in Admin Customers first.
                              </p>
                            )}
                          </>
                        ) : (
                          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">
                            Assignment connected to Gardener Portal.
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