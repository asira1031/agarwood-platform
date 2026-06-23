"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Row = Record<string, any>;

type TabKey =
  | "PENDING"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "COMPLETED"
  | "REJECTED"
  | "ALL";

type ValuationItem = {
  request: Row;
  assignment: Row | null;
  task: Row | null;
  tree: Row | null;
  customer: Row | null;
  status: string;
};

function normalizeStatus(value: any) {
  return String(value || "PENDING").toUpperCase();
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

function peso(value: any) {
  return Number(value || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });
}

function makeMap(rows: Row[]) {
  const map = new Map<string, Row>();
  rows.forEach((row) => map.set(String(row.id), row));
  return map;
}

function getCustomerId(request: Row, tree?: Row | null) {
  return (
    request.customer_profile_id ||
    request.profile_id ||
    tree?.customer_profile_id ||
    tree?.profile_id ||
    null
  );
}

export default function AdminTreeValuationPage() {
  const [requests, setRequests] = useState<Row[]>([]);
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [tasks, setTasks] = useState<Row[]>([]);
  const [trees, setTrees] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [caretakers, setCaretakers] = useState<Row[]>([]);
  const [selectedCaretaker, setSelectedCaretaker] = useState<Record<string, string>>({});
  const [valuationAmount, setValuationAmount] = useState<Record<string, string>>({});
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [adminProfileId, setAdminProfileId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("PENDING");
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState("");
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

    const profile = profileById || profileByEmail;

    if (!profile) {
      setMessage("Admin profile not found.");
      setLoading(false);
      return;
    }

    const { data: adminRow, error: adminError } = await supabase
      .from("admins")
      .select("id, admin_profile_id, email, status")
      .eq("admin_profile_id", profile.id)
      .maybeSingle();

    if (adminError) {
      setMessage(adminError.message);
      setLoading(false);
      return;
    }

    const fallbackAdmin = String(profile.email || "").toLowerCase() === "admin@test.com";

    if (!adminRow && !fallbackAdmin) {
      setMessage("Admin access not found.");
      setLoading(false);
      return;
    }

    setAdminProfileId(profile.id);

    const [
      requestResult,
      assignmentResult,
      taskResult,
      treeResult,
      profileResult,
      caretakerResult,
    ] = await Promise.all([
      supabase
        .from("tree_operation_requests")
        .select("*")
        .or("request_type.eq.VALUATION,operation_type.eq.VALUATION,service_name.ilike.%valuation%")
        .order("created_at", { ascending: false }),

      supabase
        .from("caretaker_assignments")
        .select("*")
        .eq("source_type", "TREE_VALUATION_INSPECTION")
        .order("created_at", { ascending: false }),

      supabase
        .from("caretaker_task_logs")
        .select("*")
        .eq("source_type", "TREE_VALUATION_INSPECTION")
        .order("created_at", { ascending: false }),

      supabase.from("trees").select("*"),
      supabase.from("profiles").select("id, full_name, email, phone"),

      supabase
        .from("caretakers")
        .select("id, caretaker_profile_id, full_name, email, phone, status")
        .eq("status", "ACTIVE")
        .order("full_name", { ascending: true }),
    ]);

    if (requestResult.error) return fail(requestResult.error.message);
    if (assignmentResult.error) return fail(assignmentResult.error.message);
    if (taskResult.error) return fail(taskResult.error.message);
    if (treeResult.error) return fail(treeResult.error.message);
    if (profileResult.error) return fail(profileResult.error.message);
    if (caretakerResult.error) return fail(caretakerResult.error.message);

    const valuationMap: Record<string, string> = {};
    const notesMap: Record<string, string> = {};

    (requestResult.data || []).forEach((row) => {
      valuationMap[row.id] = "";
      notesMap[row.id] = row.admin_notes || "";
    });

    setRequests(requestResult.data || []);
    setAssignments(assignmentResult.data || []);
    setTasks(taskResult.data || []);
    setTrees(treeResult.data || []);
    setProfiles(profileResult.data || []);
    setCaretakers(caretakerResult.data || []);
    setValuationAmount(valuationMap);
    setAdminNotes(notesMap);
    setLoading(false);
  }

  function fail(text: string) {
    setMessage(text);
    setLoading(false);
  }

  const treeMap = useMemo(() => makeMap(trees), [trees]);
  const profileMap = useMemo(() => makeMap(profiles), [profiles]);

  const items = useMemo<ValuationItem[]>(() => {
    return requests.map((request) => {
      const assignment =
        assignments.find((row) => String(row.operation_request_id) === String(request.id)) ||
        null;

      const task =
        tasks.find((row) => String(row.assignment_id || "") === String(assignment?.id || "")) ||
        tasks.find((row) => String(row.operation_request_id || "") === String(request.id)) ||
        null;

      const tree = request.tree_id ? treeMap.get(String(request.tree_id)) || null : null;
      const customerId = getCustomerId(request, tree);
      const customer = customerId ? profileMap.get(String(customerId)) || null : null;

      const status = normalizeStatus(
        task?.status || assignment?.status || request.assignment_status || request.status
      );

      return { request, assignment, task, tree, customer, status };
    });
  }, [requests, assignments, tasks, treeMap, profileMap]);

  const filteredItems = useMemo(() => {
    if (tab === "ALL") return items;
    if (tab === "PENDING") {
      return items.filter((item) => ["PENDING", "REQUESTED", "PAID"].includes(item.status));
    }
    return items.filter((item) => item.status === tab);
  }, [items, tab]);

  const stats = useMemo(() => {
    return {
      pending: items.filter((item) => ["PENDING", "REQUESTED", "PAID"].includes(item.status)).length,
      assigned: items.filter((item) => item.status === "ASSIGNED").length,
      inProgress: items.filter((item) => item.status === "IN_PROGRESS").length,
      submitted: items.filter((item) => item.status === "SUBMITTED").length,
      completed: items.filter((item) => item.status === "COMPLETED").length,
      rejected: items.filter((item) => item.status === "REJECTED").length,
      total: items.length,
    };
  }, [items]);

  async function rollbackAssignment(assignmentId: string) {
    await supabase.from("caretaker_task_logs").delete().eq("assignment_id", assignmentId);
    await supabase.from("caretaker_assignments").delete().eq("id", assignmentId);
  }

  async function assignGardener(item: ValuationItem) {
    setMessage("");

    if (item.assignment) {
      setMessage("This valuation request already has a gardener assignment.");
      return;
    }

    const caretakerId = selectedCaretaker[item.request.id];

    if (!caretakerId) {
      setMessage("Select a gardener first.");
      return;
    }

    const caretaker = caretakers.find((row) => String(row.id) === String(caretakerId));

    if (!caretaker) {
      setMessage("Selected gardener not found.");
      return;
    }

    const now = new Date().toISOString();
    const customerProfileId = getCustomerId(item.request, item.tree);

    setProcessingId(item.request.id);

    const assignmentPayload = {
      caretaker_id: caretaker.id,
      caretaker_profile_id: caretaker.caretaker_profile_id || null,
      admin_profile_id: adminProfileId,
      customer_profile_id: customerProfileId,
      group_id: item.request.group_id || item.tree?.group_id || null,
      tree_id: item.request.tree_id || item.tree?.id || null,
      operation_request_id: item.request.id,
      assignment_type: "TREE_VALUATION_INSPECTION",
      source_type: "TREE_VALUATION_INSPECTION",
      status: "ASSIGNED",
      assigned_at: now,
      notes: item.request.notes || item.request.admin_notes || "Tree valuation inspection assigned.",
      created_at: now,
      updated_at: now,
    };

    const { data: createdAssignment, error: assignmentError } = await supabase
      .from("caretaker_assignments")
      .insert(assignmentPayload)
      .select("id")
      .single();

    if (assignmentError || !createdAssignment) {
      setMessage(assignmentError?.message || "Failed to create assignment.");
      setProcessingId("");
      return;
    }

    const taskPayload = {
      assignment_id: createdAssignment.id,
      caretaker_id: caretaker.id,
      caretaker_profile_id: caretaker.caretaker_profile_id || null,
      customer_profile_id: customerProfileId,
      group_id: item.request.group_id || item.tree?.group_id || null,
      tree_id: item.request.tree_id || item.tree?.id || null,
      operation_request_id: item.request.id,
      task_type: "TREE_VALUATION_INSPECTION",
      source_type: "TREE_VALUATION_INSPECTION",
      evidence_status: "PENDING",
      status: "ASSIGNED",
      notes: "Gardener valuation inspection task created by Admin.",
      created_at: now,
      updated_at: now,
    };

    const { error: taskError } = await supabase.from("caretaker_task_logs").insert(taskPayload);

    if (taskError) {
      await rollbackAssignment(createdAssignment.id);
      setMessage(taskError.message);
      setProcessingId("");
      return;
    }

    const { error: requestError } = await supabase
      .from("tree_operation_requests")
      .update({
        status: "ASSIGNED",
        assignment_status: "ASSIGNED",
        caretaker_id: caretaker.id,
        assigned_at: now,
        updated_at: now,
      })
      .eq("id", item.request.id);

    if (requestError) {
      await rollbackAssignment(createdAssignment.id);
      setMessage(requestError.message);
      setProcessingId("");
      return;
    }

    setMessage("Valuation inspection assigned to gardener.");
    setProcessingId("");
    await loadData();
    setTab("ASSIGNED");
  }

  async function approveValuation(item: ValuationItem) {
    setMessage("");

    const amount = Number(valuationAmount[item.request.id] || 0);

    if (!item.tree?.id && !item.request.tree_id) {
      setMessage("This valuation request has no linked tree.");
      return;
    }

    if (!["SUBMITTED", "COMPLETED"].includes(item.status)) {
      setMessage("Gardener evidence must be submitted before valuation approval.");
      return;
    }

    if (!amount || amount <= 0) {
      setMessage("Enter official valuation amount.");
      return;
    }

    const confirmed = window.confirm(`Approve official tree value of ${peso(amount)}?`);
    if (!confirmed) return;

    const now = new Date().toISOString();
    const treeId = item.tree?.id || item.request.tree_id;

    setProcessingId(item.request.id);

    const { error: requestError } = await supabase
      .from("tree_operation_requests")
      .update({
        status: "COMPLETED",
        assignment_status: "COMPLETED",
        admin_notes:
          adminNotes[item.request.id] ||
          `Official tree valuation approved at ${peso(amount)}.`,
        completed_at: now,
        updated_at: now,
      })
      .eq("id", item.request.id);

    if (requestError) {
      setMessage(requestError.message);
      setProcessingId("");
      return;
    }

    if (item.assignment?.id) {
      const { error } = await supabase
        .from("caretaker_assignments")
        .update({
          status: "COMPLETED",
          completed_at: now,
          updated_at: now,
        })
        .eq("id", item.assignment.id);

      if (error) {
        await supabase
          .from("tree_operation_requests")
          .update({
            status: item.request.status || "SUBMITTED",
            assignment_status: item.request.assignment_status || "SUBMITTED",
            completed_at: item.request.completed_at || null,
            updated_at: now,
          })
          .eq("id", item.request.id);

        setMessage(`Assignment sync failed. Request rollback applied: ${error.message}`);
        setProcessingId("");
        return;
      }
    }

    if (item.task?.id) {
      const { error } = await supabase
        .from("caretaker_task_logs")
        .update({
          status: "COMPLETED",
          evidence_status: "APPROVED",
          completed_at: now,
          updated_at: now,
        })
        .eq("id", item.task.id);

      if (error) {
        if (item.assignment?.id) {
          await supabase
            .from("caretaker_assignments")
            .update({
              status: item.assignment.status || "SUBMITTED",
              completed_at: item.assignment.completed_at || null,
              updated_at: now,
            })
            .eq("id", item.assignment.id);
        }

        await supabase
          .from("tree_operation_requests")
          .update({
            status: item.request.status || "SUBMITTED",
            assignment_status: item.request.assignment_status || "SUBMITTED",
            completed_at: item.request.completed_at || null,
            updated_at: now,
          })
          .eq("id", item.request.id);

        setMessage(`Task sync failed. Rollback applied: ${error.message}`);
        setProcessingId("");
        return;
      }
    }

    const { error: treeError } = await supabase
      .from("trees")
      .update({
        valuation_status: "APPROVED",
        valuation_amount: amount,
        updated_at: now,
      })
      .eq("id", treeId);

    if (treeError) {
      if (item.task?.id) {
        await supabase
          .from("caretaker_task_logs")
          .update({
            status: item.task.status || "SUBMITTED",
            evidence_status: item.task.evidence_status || "SUBMITTED",
            completed_at: item.task.completed_at || null,
            updated_at: now,
          })
          .eq("id", item.task.id);
      }

      if (item.assignment?.id) {
        await supabase
          .from("caretaker_assignments")
          .update({
            status: item.assignment.status || "SUBMITTED",
            completed_at: item.assignment.completed_at || null,
            updated_at: now,
          })
          .eq("id", item.assignment.id);
      }

      await supabase
        .from("tree_operation_requests")
        .update({
          status: item.request.status || "SUBMITTED",
          assignment_status: item.request.assignment_status || "SUBMITTED",
          completed_at: item.request.completed_at || null,
          updated_at: now,
        })
        .eq("id", item.request.id);

      setMessage(`Tree valuation sync failed. Rollback applied: ${treeError.message}`);
      setProcessingId("");
      return;
    }

    setMessage("Official valuation approved and fully synced.");
    setProcessingId("");
    await loadData();
    setTab("COMPLETED");
  }

  async function rejectValuation(item: ValuationItem) {
    const notes = adminNotes[item.request.id] || "";

    if (!notes.trim()) {
      setMessage("Admin notes are required before rejecting.");
      return;
    }

    const confirmed = window.confirm("Reject this valuation request?");
    if (!confirmed) return;

    const now = new Date().toISOString();
    const treeId = item.tree?.id || item.request.tree_id || null;

    setProcessingId(item.request.id);

    const { error: requestError } = await supabase
      .from("tree_operation_requests")
      .update({
        status: "REJECTED",
        assignment_status: "REJECTED",
        admin_notes: notes,
        completed_at: now,
        updated_at: now,
      })
      .eq("id", item.request.id);

    if (requestError) {
      setMessage(requestError.message);
      setProcessingId("");
      return;
    }

    if (item.assignment?.id) {
      const { error } = await supabase
        .from("caretaker_assignments")
        .update({
          status: "REJECTED",
          completed_at: now,
          updated_at: now,
        })
        .eq("id", item.assignment.id);

      if (error) {
        await supabase
          .from("tree_operation_requests")
          .update({
            status: item.request.status || "SUBMITTED",
            assignment_status: item.request.assignment_status || "SUBMITTED",
            completed_at: item.request.completed_at || null,
            updated_at: now,
          })
          .eq("id", item.request.id);

        setMessage(`Assignment rejection sync failed. Request rollback applied: ${error.message}`);
        setProcessingId("");
        return;
      }
    }

    if (item.task?.id) {
      const { error } = await supabase
        .from("caretaker_task_logs")
        .update({
          status: "REJECTED",
          evidence_status: "REJECTED",
          completed_at: now,
          updated_at: now,
        })
        .eq("id", item.task.id);

      if (error) {
        if (item.assignment?.id) {
          await supabase
            .from("caretaker_assignments")
            .update({
              status: item.assignment.status || "SUBMITTED",
              completed_at: item.assignment.completed_at || null,
              updated_at: now,
            })
            .eq("id", item.assignment.id);
        }

        await supabase
          .from("tree_operation_requests")
          .update({
            status: item.request.status || "SUBMITTED",
            assignment_status: item.request.assignment_status || "SUBMITTED",
            completed_at: item.request.completed_at || null,
            updated_at: now,
          })
          .eq("id", item.request.id);

        setMessage(`Task rejection sync failed. Rollback applied: ${error.message}`);
        setProcessingId("");
        return;
      }
    }

    if (treeId) {
      const { error: treeError } = await supabase
        .from("trees")
        .update({
          valuation_status: "REJECTED",
          updated_at: now,
        })
        .eq("id", treeId);

      if (treeError) {
        if (item.task?.id) {
          await supabase
            .from("caretaker_task_logs")
            .update({
              status: item.task.status || "SUBMITTED",
              evidence_status: item.task.evidence_status || "SUBMITTED",
              completed_at: item.task.completed_at || null,
              updated_at: now,
            })
            .eq("id", item.task.id);
        }

        if (item.assignment?.id) {
          await supabase
            .from("caretaker_assignments")
            .update({
              status: item.assignment.status || "SUBMITTED",
              completed_at: item.assignment.completed_at || null,
              updated_at: now,
            })
            .eq("id", item.assignment.id);
        }

        await supabase
          .from("tree_operation_requests")
          .update({
            status: item.request.status || "SUBMITTED",
            assignment_status: item.request.assignment_status || "SUBMITTED",
            completed_at: item.request.completed_at || null,
            updated_at: now,
          })
          .eq("id", item.request.id);

        setMessage(`Tree rejection sync failed. Rollback applied: ${treeError.message}`);
        setProcessingId("");
        return;
      }
    }

    setMessage("Valuation request rejected and fully synced.");
    setProcessingId("");
    await loadData();
    setTab("REJECTED");
  }

  return (
    <main className="min-h-screen bg-[#03130d] p-6 text-white md:p-8">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(217,180,95,0.20),transparent_32%),radial-gradient(circle_at_top_right,rgba(52,120,77,0.28),transparent_30%),linear-gradient(180deg,#082015,#03130d_48%,#010805)]" />

      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-7 shadow-2xl backdrop-blur-xl md:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-[#d9b45f]">
                Admin Tree Center
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                Tree Valuation Center
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/65">
                Uses tree_operation_requests for valuation history, gardener inspection through
                caretaker assignments, and trees as customer-facing valuation truth.
              </p>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-6 py-4 font-black text-[#f7d774] transition hover:bg-[#d9b45f]/25 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh Valuations"}
            </button>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl border border-[#d9b45f]/25 bg-[#d9b45f]/10 p-4 text-sm font-bold text-[#ffe49a]">
              {message}
            </div>
          )}

          <div className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-7">
            <StatCard label="Pending" value={stats.pending} />
            <StatCard label="Assigned" value={stats.assigned} />
            <StatCard label="In Progress" value={stats.inProgress} />
            <StatCard label="Submitted" value={stats.submitted} />
            <StatCard label="Completed" value={stats.completed} />
            <StatCard label="Rejected" value={stats.rejected} />
            <StatCard label="Total" value={stats.total} />
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-wrap gap-3">
            {(["PENDING", "ASSIGNED", "IN_PROGRESS", "SUBMITTED", "COMPLETED", "REJECTED", "ALL"] as TabKey[]).map(
              (item) => (
                <button
                  key={item}
                  onClick={() => setTab(item)}
                  className={`rounded-full px-5 py-3 text-sm font-black transition ${
                    tab === item
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

        <section className="space-y-5">
          {loading ? (
            <EmptyCard text="Loading valuation requests..." />
          ) : filteredItems.length === 0 ? (
            <EmptyCard text="No valuation requests in this view." />
          ) : (
            filteredItems.map((item) => (
              <article
                key={item.request.id}
                className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl"
              >
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full border border-[#d9b45f]/30 bg-[#d9b45f]/10 px-3 py-1 text-xs font-black text-[#ffe49a]">
                        TREE VALUATION INSPECTION
                      </span>
                      <StatusBadge status={item.status} />
                    </div>

                    <div>
                      <h2 className="text-2xl font-black text-[#ffe49a]">
                        {item.tree?.display_name ||
                          item.tree?.custom_name ||
                          item.request.service_name ||
                          "Tree Valuation Request"}
                      </h2>
                      <p className="mt-2 text-sm text-white/60">
                        Customer:{" "}
                        <b className="text-white">
                          {item.customer?.full_name || item.customer?.email || "Unknown Customer"}
                        </b>
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <Info label="Requested" value={formatDate(item.request.requested_at || item.request.created_at)} />
                      <Info label="Current Status" value={item.status.replace("_", " ")} />
                      <Info label="Evidence" value={item.task?.evidence_status || "PENDING"} />
                    </div>

                    <textarea
                      value={adminNotes[item.request.id] || ""}
                      onChange={(e) =>
                        setAdminNotes((current) => ({
                          ...current,
                          [item.request.id]: e.target.value,
                        }))
                      }
                      placeholder="Admin valuation notes..."
                      className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white outline-none placeholder:text-white/35"
                    />
                  </div>

                  <div className="w-full space-y-3 xl:w-96">
                    {!item.assignment ? (
                      <>
                        <select
                          value={selectedCaretaker[item.request.id] || ""}
                          onChange={(e) =>
                            setSelectedCaretaker((current) => ({
                              ...current,
                              [item.request.id]: e.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border border-white/10 bg-[#071f16] px-4 py-3 text-sm text-white outline-none"
                        >
                          <option value="">Select gardener</option>
                          {caretakers.map((caretaker) => (
                            <option key={caretaker.id} value={caretaker.id}>
                              {caretaker.full_name || caretaker.email}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() => assignGardener(item)}
                          disabled={processingId === item.request.id}
                          className="w-full rounded-2xl bg-[#d9b45f] px-5 py-4 text-sm font-black text-[#071f16] transition hover:bg-[#f7d774] disabled:opacity-50"
                        >
                          {processingId === item.request.id ? "Assigning..." : "Assign Gardener Inspection"}
                        </button>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                        Gardener assigned. Status: <b className="text-white">{item.assignment.status}</b>
                      </div>
                    )}

                    <input
                      value={valuationAmount[item.request.id] || ""}
                      onChange={(e) =>
                        setValuationAmount((current) => ({
                          ...current,
                          [item.request.id]: e.target.value,
                        }))
                      }
                      type="number"
                      min="0"
                      placeholder="Official valuation amount"
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
                    />

                    <button
                      onClick={() => approveValuation(item)}
                      disabled={processingId === item.request.id}
                      className="w-full rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-[#03130d] transition hover:bg-emerald-400 disabled:opacity-50"
                    >
                      Approve Official Valuation
                    </button>

                    <button
                      onClick={() => rejectValuation(item)}
                      disabled={processingId === item.request.id}
                      className="w-full rounded-2xl border border-red-400/30 bg-red-500/15 px-5 py-4 text-sm font-black text-red-200 transition hover:bg-red-500/25 disabled:opacity-50"
                    >
                      Reject Valuation
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-white/80">{value}</p>
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

  if (["COMPLETED", "APPROVED"].includes(value)) {
    classes = "border-emerald-400/30 bg-emerald-500/15 text-emerald-200";
  }

  if (["ASSIGNED", "IN_PROGRESS"].includes(value)) {
    classes = "border-blue-400/30 bg-blue-500/15 text-blue-200";
  }

  if (["REJECTED", "CANCELLED"].includes(value)) {
    classes = "border-red-400/30 bg-red-500/15 text-red-200";
  }

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-black ${classes}`}>
      {value.replace("_", " ")}
    </span>
  );
}