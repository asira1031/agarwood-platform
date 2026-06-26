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
  | "REWORK"
  | "REJECTED"
  | "ALL";

type EvidenceBundle = {
  photos: Row[];
  gps: Row[];
  health: Row[];
};

type OperationItem = {
  request: Row;
  assignment: Row | null;
  task: Row | null;
  tree: Row | null;
  group: Row | null;
  customer: Row | null;
  caretaker: Row | null;
  evidence: EvidenceBundle;
  status: string;
  evidenceStatus: string;
  sourceType: string;
  assignmentMode: "FOREST" | "TREE";
  operationType: string;
};

const TERMINAL_STATUSES = ["COMPLETED", "CANCELLED", "REJECTED", "FAILED"];
const ACTIVE_PENDING_STATUSES = ["PENDING", "REQUESTED", "PAID", "PROCESSING"];
const REWORK_STATUSES = ["REWORK", "REWORK_REQUESTED", "NEEDS_REWORK"];

export default function AdminOperationsPage() {
  const [requests, setRequests] = useState<Row[]>([]);
  const [caretakers, setCaretakers] = useState<Row[]>([]);
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [tasks, setTasks] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [trees, setTrees] = useState<Row[]>([]);
  const [groups, setGroups] = useState<Row[]>([]);
  const [photoRows, setPhotoRows] = useState<Row[]>([]);
  const [gpsRows, setGpsRows] = useState<Row[]>([]);
  const [healthRows, setHealthRows] = useState<Row[]>([]);
  const [selectedCaretaker, setSelectedCaretaker] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<TabKey>("PENDING");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [processingId, setProcessingId] = useState("");
  const [adminProfileId, setAdminProfileId] = useState<string | null>(null);

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

    if (userError) return fail(userError.message);

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const email = user.email?.trim().toLowerCase() || "";

    const { data: profileById, error: profileByIdError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    if (profileByIdError) return fail(profileByIdError.message);

    const { data: profileByEmail, error: profileByEmailError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", email)
      .maybeSingle();

    if (profileByEmailError) return fail(profileByEmailError.message);

    const profile = profileById || profileByEmail;

    if (!profile) return fail("Admin profile not found.");

    const { data: adminRow, error: adminError } = await supabase
      .from("admins")
      .select("id, admin_profile_id, email, status")
      .eq("admin_profile_id", profile.id)
      .maybeSingle();

    if (adminError) return fail(adminError.message);

    const fallbackAdmin = String(profile.email || "").toLowerCase() === "admin@test.com";

    if (!adminRow && !fallbackAdmin) return fail("Admin access not found.");

    setAdminProfileId(profile.id);

    const [
      requestResult,
      caretakerResult,
      assignmentResult,
      taskResult,
      profileResult,
      treeResult,
      groupResult,
      photoResult,
      gpsResult,
      healthResult,
    ] = await Promise.all([
      supabase
        .from("tree_operation_requests")
        .select(
          "id, profile_id, customer_profile_id, tree_id, group_id, operation_type, request_type, service_name, care_program_name, care_program_status, status, assignment_status, caretaker_id, operation_fee, platform_fee, total_amount, amount, notes, admin_notes, created_at, requested_at, assigned_at, completed_at, updated_at"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("caretakers")
        .select("id, caretaker_profile_id, full_name, email, phone, status, assigned_area")
        .order("full_name", { ascending: true }),
      supabase
        .from("caretaker_assignments")
        .select(
          "id, caretaker_id, caretaker_profile_id, admin_profile_id, customer_profile_id, tree_id, group_id, operation_request_id, assignment_type, source_type, status, assigned_at, started_at, submitted_at, completed_at, notes, created_at, updated_at"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("caretaker_task_logs")
        .select(
          "id, caretaker_id, caretaker_profile_id, customer_profile_id, tree_id, group_id, operation_request_id, assignment_id, task_type, source_type, evidence_status, status, notes, created_at, started_at, submitted_at, completed_at, updated_at"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, email, phone, membership_status, kyc_status"),
      supabase
        .from("trees")
        .select(
          "id, profile_id, customer_profile_id, group_id, display_name, custom_name, tree_code, tree_qr_url, tree_group_name, stage, health_status, care_status, care_expires_at, valuation_status, status, created_at, updated_at"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("tree_groups")
        .select("id, profile_id, customer_profile_id, group_name, forest_name, farm_location, block_name, total_trees, status")
        .order("created_at", { ascending: false }),
      supabase
        .from("tree_photo_updates")
        .select(
          "id, assignment_id, operation_request_id, tree_id, group_id, customer_profile_id, caretaker_id, caretaker_profile_id, photo_url, image_url, before_photo_url, after_photo_url, caption, notes, status, created_at, updated_at"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("tree_gps_logs")
        .select(
          "id, assignment_id, operation_request_id, tree_id, group_id, customer_profile_id, caretaker_id, caretaker_profile_id, latitude, longitude, map_url, gps_url, location_note, notes, status, created_at, updated_at"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("tree_health_reports")
        .select(
          "id, assignment_id, operation_request_id, tree_id, group_id, customer_profile_id, caretaker_id, caretaker_profile_id, health_status, issue_severity, issue_summary, report_notes, notes, status, created_at, updated_at"
        )
        .order("created_at", { ascending: false }),
    ]);

    if (requestResult.error) return fail(requestResult.error.message);
    if (caretakerResult.error) return fail(caretakerResult.error.message);
    if (assignmentResult.error) return fail(assignmentResult.error.message);
    if (taskResult.error) return fail(taskResult.error.message);
    if (profileResult.error) return fail(profileResult.error.message);
    if (treeResult.error) return fail(treeResult.error.message);
    if (groupResult.error) return fail(groupResult.error.message);
    if (photoResult.error) return fail(photoResult.error.message);
    if (gpsResult.error) return fail(gpsResult.error.message);
    if (healthResult.error) return fail(healthResult.error.message);

    setRequests(requestResult.data || []);
    setCaretakers(caretakerResult.data || []);
    setAssignments(assignmentResult.data || []);
    setTasks(taskResult.data || []);
    setProfiles(profileResult.data || []);
    setTrees(treeResult.data || []);
    setGroups(groupResult.data || []);
    setPhotoRows(photoResult.data || []);
    setGpsRows(gpsResult.data || []);
    setHealthRows(healthResult.data || []);
    setLoading(false);
  }

  function fail(text: string) {
    setMessage(text);
    setLoading(false);
    setProcessingId("");
  }

  const profileMap = useMemo(() => makeMap(profiles), [profiles]);
  const treeMap = useMemo(() => makeMap(trees), [trees]);
  const groupMap = useMemo(() => makeMap(groups), [groups]);
  const caretakerMap = useMemo(() => makeMap(caretakers), [caretakers]);

  const operationItems = useMemo<OperationItem[]>(() => {
    return requests.map((request) => {
      const assignment =
        assignments.find((item) => String(item.operation_request_id) === String(request.id)) || null;

      const task =
        tasks.find((item) => String(item.assignment_id || "") === String(assignment?.id || "")) ||
        tasks.find((item) => String(item.operation_request_id || "") === String(request.id)) ||
        null;

      const tree = request.tree_id ? treeMap.get(String(request.tree_id)) || null : null;
      const group = request.group_id
        ? groupMap.get(String(request.group_id)) || null
        : tree?.group_id
        ? groupMap.get(String(tree.group_id)) || null
        : null;

      const customerProfileId =
        request.customer_profile_id ||
        request.profile_id ||
        assignment?.customer_profile_id ||
        task?.customer_profile_id ||
        tree?.customer_profile_id ||
        tree?.profile_id ||
        group?.customer_profile_id ||
        group?.profile_id ||
        null;

      const customer = customerProfileId ? profileMap.get(String(customerProfileId)) || null : null;
      const caretakerId = assignment?.caretaker_id || task?.caretaker_id || request.caretaker_id || null;
      const caretaker = caretakerId ? caretakerMap.get(String(caretakerId)) || null : null;
      const evidence = collectEvidence(request, assignment, task, photoRows, gpsRows, healthRows);
      const sourceType = getSourceType(request);
      const status = normalizeStatus(task?.status || assignment?.status || request.assignment_status || request.status);
      const evidenceStatus = normalizeStatus(task?.evidence_status || getEvidenceStatus(evidence) || status);
      const assignmentMode = request.tree_id || tree?.id ? "TREE" : "FOREST";

      return {
        request,
        assignment,
        task,
        tree,
        group,
        customer,
        caretaker,
        evidence,
        status,
        evidenceStatus,
        sourceType,
        assignmentMode,
        operationType: getOperationTitle(request),
      };
    });
  }, [requests, assignments, tasks, treeMap, groupMap, profileMap, caretakerMap, photoRows, gpsRows, healthRows]);

  const filteredItems = useMemo(() => {
    if (tab === "ALL") return operationItems;
    if (tab === "PENDING") return operationItems.filter((item) => ACTIVE_PENDING_STATUSES.includes(item.status));
    if (tab === "REWORK") return operationItems.filter((item) => REWORK_STATUSES.includes(item.status));
    return operationItems.filter((item) => item.status === tab);
  }, [operationItems, tab]);

  const stats = useMemo(() => {
    return {
      pending: operationItems.filter((item) => ACTIVE_PENDING_STATUSES.includes(item.status)).length,
      assigned: operationItems.filter((item) => item.status === "ASSIGNED").length,
      inProgress: operationItems.filter((item) => item.status === "IN_PROGRESS").length,
      submitted: operationItems.filter((item) => item.status === "SUBMITTED").length,
      completed: operationItems.filter((item) => item.status === "COMPLETED").length,
      rework: operationItems.filter((item) => REWORK_STATUSES.includes(item.status)).length,
      rejected: operationItems.filter((item) => item.status === "REJECTED").length,
    };
  }, [operationItems]);

  async function rollbackAssignment(assignmentId: string) {
    await supabase.from("caretaker_task_logs").delete().eq("assignment_id", assignmentId);
    await supabase.from("caretaker_assignments").delete().eq("id", assignmentId);
  }

  async function assignGardener(item: OperationItem) {
    setMessage("");

    const caretakerId = selectedCaretaker[item.request.id];

    if (!caretakerId) return setMessage("Please select a gardener first.");
    if (item.assignment) return setMessage("This request already has an assigned gardener.");

    const caretaker = caretakers.find((row) => String(row.id) === String(caretakerId));
    if (!caretaker) return setMessage("Selected gardener not found.");

    setProcessingId(item.request.id);

    const now = new Date().toISOString();
    const customerProfileId = resolveCustomerProfileId(item);
    const groupId = item.request.group_id || item.group?.id || item.tree?.group_id || null;
    const treeId = item.assignmentMode === "TREE" ? item.request.tree_id || item.tree?.id || null : item.request.tree_id || null;
    const sourceType = item.sourceType;

    if (!customerProfileId) return fail("Customer profile is required before assignment.");
    if (item.assignmentMode === "TREE" && !treeId) return fail("Tree ID is required before tree assignment.");
    if (item.assignmentMode === "FOREST" && !groupId) return fail("Forest group is required before forest assignment.");

    const assignmentPayload = {
      caretaker_id: caretaker.id,
      caretaker_profile_id: caretaker.caretaker_profile_id || null,
      admin_profile_id: adminProfileId,
      customer_profile_id: customerProfileId,
      tree_id: treeId,
      group_id: groupId,
      operation_request_id: item.request.id,
      assignment_type: sourceType,
      source_type: sourceType,
      status: "ASSIGNED",
      assigned_at: now,
      notes: item.request.notes || item.request.admin_notes || null,
      created_at: now,
      updated_at: now,
    };

    const { data: createdAssignment, error: assignmentError } = await supabase
      .from("caretaker_assignments")
      .insert(assignmentPayload)
      .select("id")
      .single();

    if (assignmentError || !createdAssignment) return fail(assignmentError?.message || "Assignment creation failed.");

    const taskPayload = {
      assignment_id: createdAssignment.id,
      caretaker_id: caretaker.id,
      caretaker_profile_id: caretaker.caretaker_profile_id || null,
      customer_profile_id: customerProfileId,
      tree_id: treeId,
      group_id: groupId,
      operation_request_id: item.request.id,
      task_type: sourceType,
      source_type: sourceType,
      evidence_status: "PENDING",
      notes: `${item.assignmentMode} assignment created from Admin Forest Operations Center.`,
      status: "ASSIGNED",
      created_at: now,
      updated_at: now,
    };

    const { data: createdTask, error: taskError } = await supabase
      .from("caretaker_task_logs")
      .insert(taskPayload)
      .select("id")
      .single();

    if (taskError || !createdTask) {
      await rollbackAssignment(createdAssignment.id);
      return fail(taskError?.message || "Task creation failed. Assignment was rolled back.");
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
      return fail(`Request sync failed. Assignment was rolled back: ${requestError.message}`);
    }

    setMessage(`${item.assignmentMode === "FOREST" ? "Forest" : "Tree"} assigned to gardener successfully.`);
    setProcessingId("");
    setTab("ASSIGNED");
    await loadData();
  }

  async function reviewSubmittedWork(item: OperationItem, action: "APPROVE" | "REJECT" | "REWORK") {
    setMessage("");

    if (!item.assignment?.id) return setMessage("Assignment is required before review.");
    if (!item.task?.id) return setMessage("Task log is required before review.");
    if (!hasAnyEvidence(item.evidence)) return setMessage("Gardener evidence is required before Admin review.");

    if (action === "APPROVE" && !hasCompleteEvidence(item.evidence)) {
      return setMessage("Photo, GPS, and Health evidence are required before approving completion.");
    }

    const submittedEnough = item.status === "SUBMITTED" || item.evidenceStatus === "SUBMITTED";
    if (!submittedEnough && action === "APPROVE") {
      return setMessage("Only SUBMITTED evidence can be approved for completion.");
    }

    const note = reviewNotes[item.request.id]?.trim() || null;
    if ((action === "REJECT" || action === "REWORK") && !note) {
      return setMessage("Please add review notes before rejecting or requesting rework.");
    }

    const confirmedText =
      action === "APPROVE"
        ? "Approve completion? Customer will now see this operation as completed."
        : action === "REJECT"
        ? "Reject this submitted evidence? Customer will not see this as completed."
        : "Request gardener rework? Customer will not see this as completed.";

    if (!window.confirm(confirmedText)) return;

    setProcessingId(item.request.id);
    const now = new Date().toISOString();

    const nextStatus = action === "APPROVE" ? "COMPLETED" : action === "REJECT" ? "REJECTED" : "REWORK_REQUESTED";
    const nextEvidenceStatus = action === "APPROVE" ? "APPROVED" : action === "REJECT" ? "REJECTED" : "REWORK_REQUESTED";

    const { error: requestError } = await supabase
      .from("tree_operation_requests")
      .update({
        status: nextStatus,
        assignment_status: nextStatus,
        admin_notes: note || item.request.admin_notes || null,
        completed_at: action === "APPROVE" ? now : item.request.completed_at || null,
        updated_at: now,
      })
      .eq("id", item.request.id);

    if (requestError) return fail(requestError.message);

    const { error: assignmentError } = await supabase
      .from("caretaker_assignments")
      .update({
        status: nextStatus,
        completed_at: action === "APPROVE" ? now : item.assignment.completed_at || null,
        notes: note || item.assignment.notes || null,
        updated_at: now,
      })
      .eq("id", item.assignment.id);

    if (assignmentError) return fail(assignmentError.message);

    const { error: taskError } = await supabase
      .from("caretaker_task_logs")
      .update({
        status: nextStatus,
        evidence_status: nextEvidenceStatus,
        completed_at: action === "APPROVE" ? now : item.task.completed_at || null,
        notes: note || item.task.notes || null,
        updated_at: now,
      })
      .eq("id", item.task.id);

    if (taskError) return fail(taskError.message);

    await updateEvidenceRows(item, nextEvidenceStatus, now);

    if (action === "APPROVE") {
      await activateCareAfterApproval(item, now);
      setMessage("Completion approved. Customer timeline can now show this operation as COMPLETED.");
      setTab("COMPLETED");
    } else if (action === "REJECT") {
      setMessage("Evidence rejected and synced. Customer completion remains blocked.");
      setTab("REJECTED");
    } else {
      setMessage("Rework requested and synced back to Gardener. Customer completion remains blocked.");
      setTab("REWORK");
    }

    setProcessingId("");
    await loadData();
  }

  async function updateEvidenceRows(item: OperationItem, status: string, now: string) {
    const updates = [
      ...item.evidence.photos.map((row) => ({ table: "tree_photo_updates", id: row.id })),
      ...item.evidence.gps.map((row) => ({ table: "tree_gps_logs", id: row.id })),
      ...item.evidence.health.map((row) => ({ table: "tree_health_reports", id: row.id })),
    ];

    for (const update of updates) {
      await supabase.from(update.table).update({ status, updated_at: now }).eq("id", update.id);
    }
  }

  async function activateCareAfterApproval(item: OperationItem, now: string) {
    const serviceName = `${item.request.request_type || ""} ${item.request.operation_type || ""} ${item.request.service_name || ""} ${item.request.care_program_name || ""}`.toUpperCase();
    const shouldActivateProtection = serviceName.includes("CARE_PROGRAM") || Boolean(item.request.care_program_name);

    if (!shouldActivateProtection) return;

    if (item.assignmentMode === "FOREST" && item.request.group_id) {
      let query = supabase
        .from("trees")
        .update({
          care_status: "SUBSCRIBED",
          care_program_status: "ACTIVE",
          care_started_at: now,
          updated_at: now,
        })
        .eq("group_id", item.request.group_id);

      const customerProfileId = resolveCustomerProfileId(item);
      if (customerProfileId) query = query.eq("customer_profile_id", customerProfileId);

      await query;
      return;
    }

    const treeId = item.request.tree_id || item.tree?.id;
    if (!treeId) return;

    await supabase
      .from("trees")
      .update({
        care_status: "SUBSCRIBED",
        care_program_status: "ACTIVE",
        care_started_at: now,
        updated_at: now,
      })
      .eq("id", treeId);
  }

  async function cancelRequest(item: OperationItem) {
    const confirmed = window.confirm("Cancel this operation request and sync assignment/task if present?");
    if (!confirmed) return;

    setProcessingId(item.request.id);
    setMessage("");

    const now = new Date().toISOString();

    if (item.assignment?.id) {
      await supabase
        .from("caretaker_task_logs")
        .update({ status: "CANCELLED", evidence_status: "CANCELLED", completed_at: now, updated_at: now })
        .eq("assignment_id", item.assignment.id);

      await supabase
        .from("caretaker_assignments")
        .update({ status: "CANCELLED", completed_at: now, updated_at: now })
        .eq("id", item.assignment.id);
    }

    const { error } = await supabase
      .from("tree_operation_requests")
      .update({ status: "CANCELLED", assignment_status: "CANCELLED", updated_at: now })
      .eq("id", item.request.id);

    if (error) return fail(error.message);

    setMessage("Request cancelled and synced.");
    setProcessingId("");
    await loadData();
  }

  return (
    <main className="min-h-screen bg-[#03130d] p-6 text-white md:p-8">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(217,180,95,0.20),transparent_32%),radial-gradient(circle_at_top_right,rgba(52,120,77,0.28),transparent_30%),linear-gradient(180deg,#082015,#03130d_48%,#010805)]" />

      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-7 shadow-2xl backdrop-blur-xl md:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-[#d9b45f]">Admin Operations</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">Forest Operations Center</h1>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/65">
                Assign work to gardeners, review submitted evidence, and only mark customer operations completed after Admin approval.
              </p>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-6 py-4 font-black text-[#f7d774] transition hover:bg-[#d9b45f]/25 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh Operations"}
            </button>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl border border-[#d9b45f]/25 bg-[#d9b45f]/10 p-4 text-sm font-bold text-[#ffe49a]">
              {message}
            </div>
          )}

          <div className="mt-8 grid gap-4 md:grid-cols-4 xl:grid-cols-7">
            <HeroStat label="Pending" value={stats.pending} />
            <HeroStat label="Assigned" value={stats.assigned} tone="blue" />
            <HeroStat label="In Progress" value={stats.inProgress} tone="yellow" />
            <HeroStat label="Submitted" value={stats.submitted} tone="purple" />
            <HeroStat label="Completed" value={stats.completed} tone="green" />
            <HeroStat label="Rework" value={stats.rework} tone="orange" />
            <HeroStat label="Rejected" value={stats.rejected} tone="red" />
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-wrap gap-3">
            {[
              ["PENDING", "Pending Requests"],
              ["ASSIGNED", "Assigned"],
              ["IN_PROGRESS", "In Progress"],
              ["SUBMITTED", "Submitted by Gardener"],
              ["COMPLETED", "Completed"],
              ["REWORK", "Rework"],
              ["REJECTED", "Rejected"],
              ["ALL", "All"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key as TabKey)}
                className={`rounded-full px-5 py-3 text-sm font-black transition ${
                  tab === key
                    ? "bg-[#d9b45f] text-[#071f16]"
                    : "border border-white/10 bg-white/10 text-white/70 hover:bg-white/15"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          {loading ? (
            <EmptyCard text="Loading operation requests..." />
          ) : filteredItems.length === 0 ? (
            <EmptyCard text="No operation requests in this view." />
          ) : (
            filteredItems.map((item) => (
              <OperationCard
                key={item.request.id}
                item={item}
                caretakers={caretakers.filter((caretaker) => normalizeStatus(caretaker.status) === "ACTIVE")}
                selectedCaretaker={selectedCaretaker[item.request.id] || ""}
                setSelectedCaretaker={(caretakerId) =>
                  setSelectedCaretaker((current) => ({ ...current, [item.request.id]: caretakerId }))
                }
                reviewNote={reviewNotes[item.request.id] || ""}
                setReviewNote={(note) => setReviewNotes((current) => ({ ...current, [item.request.id]: note }))}
                assignGardener={() => assignGardener(item)}
                cancelRequest={() => cancelRequest(item)}
                approveCompletion={() => reviewSubmittedWork(item, "APPROVE")}
                rejectEvidence={() => reviewSubmittedWork(item, "REJECT")}
                requestRework={() => reviewSubmittedWork(item, "REWORK")}
                processing={processingId === item.request.id}
              />
            ))
          )}
        </section>
      </div>
    </main>
  );
}

function OperationCard({
  item,
  caretakers,
  selectedCaretaker,
  setSelectedCaretaker,
  reviewNote,
  setReviewNote,
  assignGardener,
  cancelRequest,
  approveCompletion,
  rejectEvidence,
  requestRework,
  processing,
}: {
  item: OperationItem;
  caretakers: Row[];
  selectedCaretaker: string;
  setSelectedCaretaker: (value: string) => void;
  reviewNote: string;
  setReviewNote: (value: string) => void;
  assignGardener: () => void;
  cancelRequest: () => void;
  approveCompletion: () => void;
  rejectEvidence: () => void;
  requestRework: () => void;
  processing: boolean;
}) {
  const closed = TERMINAL_STATUSES.includes(item.status);
  const canAssign = !item.assignment && !closed;
  const canReview = Boolean(item.assignment?.id && item.task?.id && hasAnyEvidence(item.evidence));
  const showReviewActions = canReview && ["SUBMITTED", "REWORK_REQUESTED", "REJECTED"].includes(item.status) === false;
  const needsReview = canReview && (item.status === "SUBMITTED" || item.evidenceStatus === "SUBMITTED");
  const assignedCaretaker = item.caretaker;

  return (
    <article className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[#d9b45f]/30 bg-[#d9b45f]/10 px-3 py-1 text-xs font-black text-[#ffe49a]">
              {item.assignmentMode} ASSIGNMENT
            </span>
            <StatusBadge status={item.status} />
            <StatusBadge status={`EVIDENCE_${item.evidenceStatus}`} compact />
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-black text-white/55">
              {item.sourceType.replaceAll("_", " ")}
            </span>
          </div>

          <h2 className="mt-4 text-3xl font-black text-white">{item.operationType}</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Info label="Customer" value={customerName(item.customer)} subValue={item.customer?.email || "No email"} />
            <Info label="Forest" value={`🌳 ${forestName(item.group, item.tree)}`} subValue={item.group ? "Forest group" : "Ungrouped forest"} />
            <Info label="Seedling" value={treeName(item.tree)} subValue={item.tree?.tree_code ? `Tree Code: ${item.tree.tree_code}` : item.assignmentMode === "FOREST" ? "Forest-level request" : "No tree code"} />
            <Info label="Requested Service" value={item.operationType} subValue={formatMoney(item.request.total_amount || item.request.amount || 0)} />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Info label="Request Status" value={item.request.status || "PENDING"} subValue={formatDate(item.request.created_at || item.request.requested_at)} />
            <Info label="Assignment Status" value={item.assignment?.status || "Not assigned"} subValue={item.assignment ? "caretaker_assignments synced" : "Waiting for admin"} />
            <Info label="Assigned Gardener" value={assignedCaretaker?.full_name || assignedCaretaker?.email || "Not assigned"} subValue={assignedCaretaker?.assigned_area || "Select gardener"} />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Info label="Photo Evidence" value={`${item.evidence.photos.length} submitted`} subValue={latestDate(item.evidence.photos)} />
            <Info label="GPS Evidence" value={`${item.evidence.gps.length} submitted`} subValue={latestDate(item.evidence.gps)} />
            <Info label="Health Evidence" value={`${item.evidence.health.length} submitted`} subValue={latestDate(item.evidence.health)} />
          </div>

          {item.request.notes && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/65">
              <span className="font-black text-[#ffe49a]">Customer Notes:</span> {item.request.notes}
            </div>
          )}

          {item.request.admin_notes && (
            <div className="mt-4 rounded-2xl border border-[#d9b45f]/20 bg-[#d9b45f]/10 p-4 text-sm text-[#ffe49a]">
              <span className="font-black">Admin Notes:</span> {item.request.admin_notes}
            </div>
          )}

          <EvidencePanel evidence={item.evidence} />
        </div>

        <aside className="w-full rounded-3xl border border-white/10 bg-black/20 p-5 xl:w-[360px]">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/45">Gardener Assignment</p>
          <p className="mt-3 text-lg font-black text-[#ffe49a]">
            {assignedCaretaker?.full_name || assignedCaretaker?.email || "No gardener assigned"}
          </p>

          {canAssign ? (
            <div className="mt-5 space-y-3">
              <select
                value={selectedCaretaker}
                onChange={(event) => setSelectedCaretaker(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#071f16] p-4 text-white outline-none"
              >
                <option value="">Select gardener</option>
                {caretakers.map((caretaker) => (
                  <option key={caretaker.id} value={caretaker.id}>
                    {caretaker.full_name || caretaker.email}
                  </option>
                ))}
              </select>

              <button
                onClick={assignGardener}
                disabled={processing || caretakers.length === 0}
                className="w-full rounded-2xl bg-[#d9b45f] px-5 py-4 font-black text-[#071f16] disabled:opacity-50"
              >
                {processing ? "Assigning..." : `Assign ${item.assignmentMode === "FOREST" ? "Forest" : "Tree"}`}
              </button>

              <button
                onClick={cancelRequest}
                disabled={processing}
                className="w-full rounded-2xl border border-red-300/25 bg-red-500/10 px-5 py-4 font-black text-red-100 disabled:opacity-50"
              >
                Cancel Request
              </button>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
              {item.assignment ? "Synced to Gardener Portal." : "This request is closed."}
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-white/10 bg-[#03130d]/70 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">Admin Review</p>
            <textarea
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              placeholder="Required for rejection or rework. Optional for approval."
              className="mt-3 min-h-[100px] w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none placeholder:text-white/35"
            />

            {needsReview ? (
              <div className="mt-3 grid gap-3">
                <button
                  onClick={approveCompletion}
                  disabled={processing}
                  className="rounded-2xl bg-emerald-500 px-5 py-4 font-black text-[#03130d] transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  {processing ? "Reviewing..." : "Approve Completion"}
                </button>
                <button
                  onClick={requestRework}
                  disabled={processing}
                  className="rounded-2xl border border-yellow-300/30 bg-yellow-500/10 px-5 py-4 font-black text-yellow-100 disabled:opacity-50"
                >
                  Request Rework
                </button>
                <button
                  onClick={rejectEvidence}
                  disabled={processing}
                  className="rounded-2xl border border-red-300/30 bg-red-500/10 px-5 py-4 font-black text-red-100 disabled:opacity-50"
                >
                  Reject Evidence
                </button>
              </div>
            ) : showReviewActions ? (
              <p className="mt-3 text-sm font-bold text-white/55">Waiting for submitted evidence before completion approval.</p>
            ) : (
              <p className="mt-3 text-sm font-bold text-white/55">Review actions are locked for this status.</p>
            )}
          </div>

          {item.assignment && !closed && (
            <button
              onClick={cancelRequest}
              disabled={processing}
              className="mt-3 w-full rounded-2xl border border-red-300/25 bg-red-500/10 px-5 py-4 font-black text-red-100 disabled:opacity-50"
            >
              Cancel & Sync
            </button>
          )}
        </aside>
      </div>
    </article>
  );
}

function EvidencePanel({ evidence }: { evidence: EvidenceBundle }) {
  const allEmpty = !hasAnyEvidence(evidence);

  if (allEmpty) {
    return (
      <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm font-bold text-white/55">
        No gardener evidence submitted yet.
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d9b45f]">Submitted Evidence</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <EvidenceColumn title="Photo Updates" rows={evidence.photos} type="PHOTO" />
        <EvidenceColumn title="GPS Logs" rows={evidence.gps} type="GPS" />
        <EvidenceColumn title="Health Reports" rows={evidence.health} type="HEALTH" />
      </div>
    </div>
  );
}

function EvidenceColumn({ title, rows, type }: { title: string; rows: Row[]; type: "PHOTO" | "GPS" | "HEALTH" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#03130d]/70 p-4">
      <p className="font-black text-white">{title}</p>
      <div className="mt-3 space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm font-bold text-white/45">No records.</p>
        ) : (
          rows.map((row) => <EvidenceItem key={`${type}-${row.id}`} row={row} type={type} />)
        )}
      </div>
    </div>
  );
}

function EvidenceItem({ row, type }: { row: Row; type: "PHOTO" | "GPS" | "HEALTH" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-sm text-white/65">
      <div className="flex items-center justify-between gap-3">
        <StatusBadge status={row.status || "SUBMITTED"} compact />
        <span className="text-xs font-bold text-white/40">{formatDate(row.created_at)}</span>
      </div>

      {type === "PHOTO" && (
        <div className="mt-3 grid gap-2">
          {row.photo_url && <ImageLink label="Current Photo" href={row.photo_url} />}
          {row.before_photo_url && <ImageLink label="Before Photo" href={row.before_photo_url} />}
          {row.after_photo_url && <ImageLink label="After Photo" href={row.after_photo_url} />}
        </div>
      )}

      {type === "GPS" && (
        <p className="mt-3 font-bold text-white/70">
          📍 {row.latitude || "—"}, {row.longitude || "—"}
        </p>
      )}

      {type === "HEALTH" && <p className="mt-3 font-bold text-white/70">Health: {row.health_status || "—"}</p>}

      {row.notes && <p className="mt-2 leading-relaxed">{row.notes}</p>}
    </div>
  );
}

function ImageLink({ label, href }: { label: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="rounded-xl border border-[#d9b45f]/20 bg-[#d9b45f]/10 px-3 py-2 text-xs font-black text-[#ffe49a] hover:bg-[#d9b45f]/20">
      Open {label}
    </a>
  );
}

function HeroStat({ label, value, tone }: { label: string; value: number; tone?: "green" | "yellow" | "blue" | "purple" | "gold" | "orange" | "red" }) {
  const color =
    tone === "green"
      ? "text-emerald-200"
      : tone === "yellow"
      ? "text-yellow-200"
      : tone === "blue"
      ? "text-blue-200"
      : tone === "purple"
      ? "text-purple-200"
      : tone === "orange"
      ? "text-orange-200"
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

function Info({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className="mt-2 break-words text-lg font-black text-white">{value || "—"}</p>
      {subValue ? <p className="mt-1 break-words text-xs font-semibold text-white/45">{subValue}</p> : null}
    </div>
  );
}

function StatusBadge({ status, compact }: { status: string; compact?: boolean }) {
  const normalized = normalizeStatus(status);
  const color =
    normalized.includes("COMPLETED") || normalized.includes("APPROVED")
      ? "border-emerald-300/30 bg-emerald-500/20 text-emerald-100"
      : normalized.includes("SUBMITTED")
      ? "border-purple-300/30 bg-purple-500/20 text-purple-100"
      : normalized.includes("IN_PROGRESS")
      ? "border-yellow-300/30 bg-yellow-500/20 text-yellow-100"
      : normalized.includes("ASSIGNED")
      ? "border-blue-300/30 bg-blue-500/20 text-blue-100"
      : normalized.includes("REWORK")
      ? "border-orange-300/30 bg-orange-500/20 text-orange-100"
      : ["CANCELLED", "REJECTED", "FAILED"].some((item) => normalized.includes(item))
      ? "border-red-300/30 bg-red-500/20 text-red-100"
      : "border-[#d9b45f]/30 bg-[#d9b45f]/10 text-[#ffe49a]";

  return (
    <span className={`rounded-full border ${compact ? "px-2 py-1 text-[10px]" : "px-3 py-1 text-xs"} font-black ${color}`}>
      {normalized.replaceAll("_", " ")}
    </span>
  );
}

function EmptyCard({ text }: { text: string }) {
  return <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-sm font-bold text-white/60 shadow-2xl backdrop-blur-xl">{text}</div>;
}

function makeMap(rows: Row[]) {
  const map = new Map<string, Row>();
  rows.forEach((row) => {
    if (row.id) map.set(String(row.id), row);
  });
  return map;
}

function normalizeStatus(value: any) {
  return String(value || "PENDING").trim().replace(/\s+/g, "_").toUpperCase();
}

function collectEvidence(request: Row, assignment: Row | null, task: Row | null, photos: Row[], gps: Row[], health: Row[]): EvidenceBundle {
  const matches = (row: Row) => {
    const byRequest = row.operation_request_id && String(row.operation_request_id) === String(request.id);
    const byAssignment = assignment?.id && row.assignment_id && String(row.assignment_id) === String(assignment.id);
    const byTaskAssignment = task?.assignment_id && row.assignment_id && String(row.assignment_id) === String(task.assignment_id);
    return Boolean(byRequest || byAssignment || byTaskAssignment);
  };

  return {
    photos: photos.filter(matches),
    gps: gps.filter(matches),
    health: health.filter(matches),
  };
}

function getEvidenceStatus(evidence: EvidenceBundle) {
  const rows = [...evidence.photos, ...evidence.gps, ...evidence.health];
  if (rows.length === 0) return "PENDING";
  if (rows.some((row) => normalizeStatus(row.status) === "SUBMITTED")) return "SUBMITTED";
  if (rows.every((row) => normalizeStatus(row.status) === "APPROVED")) return "APPROVED";
  if (rows.some((row) => normalizeStatus(row.status) === "REJECTED")) return "REJECTED";
  if (rows.some((row) => normalizeStatus(row.status).includes("REWORK"))) return "REWORK_REQUESTED";
  return normalizeStatus(rows[0]?.status || "SUBMITTED");
}

function hasAnyEvidence(evidence: EvidenceBundle) {
  return evidence.photos.length + evidence.gps.length + evidence.health.length > 0;
}

function hasCompleteEvidence(evidence: EvidenceBundle) {
  return evidence.photos.length > 0 && evidence.gps.length > 0 && evidence.health.length > 0;
}

function resolveCustomerProfileId(item: OperationItem) {
  return (
    item.request.customer_profile_id ||
    item.request.profile_id ||
    item.assignment?.customer_profile_id ||
    item.task?.customer_profile_id ||
    item.tree?.customer_profile_id ||
    item.tree?.profile_id ||
    item.group?.customer_profile_id ||
    item.group?.profile_id ||
    null
  );
}

function getOperationTitle(request: Row) {
  return request.service_name || request.care_program_name || request.operation_type || request.request_type || "Tree Operation";
}

function getSourceType(request: Row) {
  const text = `${request.request_type || ""} ${request.operation_type || ""} ${request.service_name || ""} ${request.care_program_name || ""}`.toUpperCase();
  if (text.includes("PHOTO")) return "PHOTO_UPDATE";
  if (text.includes("GPS")) return "GPS_VERIFICATION";
  if (text.includes("HEALTH")) return "HEALTH_CHECK";
  if (text.includes("WATER")) return "WATERING_SERVICE";
  if (text.includes("FERTILIZER")) return "FERTILIZER";
  if (text.includes("FUNGICIDE")) return "FUNGICIDE";
  if (text.includes("INSECTICIDE")) return "INSECTICIDE";
  if (text.includes("PRUN")) return "PRUNING";
  if (text.includes("PEST")) return "PEST_CONTROL";
  if (text.includes("VALUATION")) return "TREE_VALUATION_INSPECTION";
  if (text.includes("CARE_PROGRAM")) return "CARE_PROGRAM";
  return "TREE_OPERATION";
}

function customerName(customer: Row | null) {
  if (!customer) return "Customer";
  return customer.full_name || customer.email || "Customer";
}

function forestName(group: Row | null, tree: Row | null) {
  if (group) return group.forest_name || group.group_name || group.block_name || group.farm_location || "Customer Forest";
  return tree?.tree_group_name || "Ungrouped Forest";
}

function treeName(tree: Row | null) {
  if (!tree) return "Forest Level";
  return tree.custom_name || tree.display_name || tree.tree_code || "Seedling";
}

function latestDate(rows: Row[]) {
  if (rows.length === 0) return "No evidence";
  return formatDate(rows[0]?.created_at || rows[0]?.updated_at);
}

function formatMoney(value: any) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: any) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
