"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  getMissionInventoryItems,
  getMissionKeyFromText,
  getMissionRule,
  hasRequiredEvidenceForMission,
  missionNeedsInventory,
} from "@/lib/tree-mission-engine";

type Row = Record<string, any>;

type TabKey = "NEEDS_ASSIGNMENT" | "IN_FIELD" | "WAITING_REVIEW" | "COMPLETED" | "ALL";

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
const ACTIVE_PENDING_STATUSES = ["PENDING", "REQUESTED", "PAID", "PROCESSING", "NOT_ASSIGNED", ""];

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
  const [tab, setTab] = useState<TabKey>("NEEDS_ASSIGNMENT");
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
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

      supabase.from("profiles").select("id, full_name, email, phone, membership_status, kyc_status"),

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
      const rawStatus = task?.status || assignment?.status || request.assignment_status || request.status;
      const status = normalizeStatus(rawStatus);
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

  const stats = useMemo(() => {
    return {
      total: operationItems.length,
      pending: operationItems.filter((item) => isPendingItem(item)).length,
      assigned: operationItems.filter((item) => item.status === "ASSIGNED").length,
      inProgress: operationItems.filter((item) => item.status === "IN_PROGRESS").length,
      inField: operationItems.filter((item) => isInFieldItem(item)).length,
      submitted: operationItems.filter((item) => isWaitingReviewItem(item)).length,
      completed: operationItems.filter((item) => item.status === "COMPLETED").length,
    };
  }, [operationItems]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    return operationItems.filter((item) => {
      const matchesTab =
        tab === "ALL" ||
        (tab === "NEEDS_ASSIGNMENT" && isPendingItem(item)) ||
        (tab === "IN_FIELD" && isInFieldItem(item)) ||
        (tab === "WAITING_REVIEW" && isWaitingReviewItem(item)) ||
        (tab === "COMPLETED" && item.status === "COMPLETED");

      if (!matchesTab) return false;
      if (!q) return true;

      const text = [
        item.operationType,
        item.sourceType,
        item.status,
        item.tree?.tree_code,
        treeName(item.tree),
        forestName(item.group, item.tree),
        customerName(item.customer),
        item.customer?.email,
        item.caretaker?.full_name,
        item.caretaker?.email,
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(q);
    });
  }, [operationItems, tab, search]);

  const selectedItem = useMemo(() => {
    return (
      filteredItems.find((item) => String(item.request.id) === String(selectedId)) ||
      filteredItems[0] ||
      operationItems[0] ||
      null
    );
  }, [filteredItems, operationItems, selectedId]);

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
    const treeId =
      item.assignmentMode === "TREE"
        ? item.request.tree_id || item.tree?.id || null
        : item.request.tree_id || null;
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

    if (assignmentError || !createdAssignment) {
      return fail(assignmentError?.message || "Assignment creation failed.");
    }

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
      notes: `${item.assignmentMode} assignment created from Admin Operations Queue.`,
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

    setMessage("Request assigned to gardener successfully.");
    setProcessingId("");
    setTab("IN_FIELD");
    await loadData();
  }

  async function reviewSubmittedWork(item: OperationItem, action: "APPROVE" | "REJECT" | "REWORK") {
    setMessage("");

    if (!item.assignment?.id) return setMessage("Assignment is required before review.");
    if (!item.task?.id) return setMessage("Task log is required before review.");
    if (!hasAnyEvidence(item.evidence)) return setMessage("Gardener evidence is required before Admin review.");

    if (action === "APPROVE" && !hasRequiredEvidence(item)) {
      setMessage("Required mission evidence is missing.");
      return;
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
        ? "Reject this submitted evidence?"
        : "Request gardener rework?";

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
      setMessage("Completion approved. Customer can now see this operation as completed.");
      setTab("COMPLETED");
    } else if (action === "REJECT") {
      setMessage("Evidence rejected and synced.");
    } else {
      setMessage("Rework requested and synced back to Gardener.");
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
    const missionKey = getMissionKey(
      `${item.sourceType || ""} ${item.operationType || ""} ${item.request.request_type || ""} ${item.request.operation_type || ""} ${item.request.service_name || ""} ${item.request.care_program_name || ""}`,
    );
    const shouldActivateProtection =
      missionKey === "CARE_PROGRAM" || Boolean(item.request.care_program_name);

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

  const activeCaretakers = caretakers.filter((caretaker) => normalizeStatus(caretaker.status) === "ACTIVE");

  return (
    <main className="operationsPage">
      <div className="topBar">
        <div>
          <p>ARGANWOOD ADMIN</p>
          <h1>Mission Queue</h1>
          <span>Map every tree or forest request into clear gardener missions and evidence review.</span>
        </div>

        <button onClick={loadData} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {message && <div className="message">{message}</div>}

      <section className="layout">
        <aside className="filtersPanel">
          <div className="filterHead">
            <h2>Mission Buckets</h2>
            <button onClick={() => setTab("ALL")}>Clear</button>
          </div>

          <FilterButton active={tab === "NEEDS_ASSIGNMENT"} label="Needs Assignment" count={stats.pending} onClick={() => setTab("NEEDS_ASSIGNMENT")} />
          <FilterButton active={tab === "IN_FIELD"} label="In Field" count={stats.inField} onClick={() => setTab("IN_FIELD")} />
          <FilterButton active={tab === "WAITING_REVIEW"} label="Waiting Review" count={stats.submitted} onClick={() => setTab("WAITING_REVIEW")} />
          <FilterButton active={tab === "COMPLETED"} label="Completed" count={stats.completed} onClick={() => setTab("COMPLETED")} />
          <FilterButton active={tab === "ALL"} label="All Missions" count={stats.total} onClick={() => setTab("ALL")} />

          <div className="filterDivider" />

          <p className="filterTitle">Request Types</p>
          <Legend label="Watering" type="WATERING" />
          <Legend label="Fertilizer" type="FERTILIZER" />
          <Legend label="Photo Update" type="PHOTO_UPDATE" />
          <Legend label="Health Check" type="HEALTH_CHECK" />
          <Legend label="GPS Verification" type="GPS_VERIFICATION" />
          <Legend label="QR Tagging" type="QR_TAGGING" />
          <Legend label="Care Subscription" type="CARE_PROGRAM" />
        </aside>

        <section className="queuePanel">
          <div className="toolbar">
            <div className="searchBox">
              <SearchIcon />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by customer, tree code, service..."
              />
            </div>

            <button>Sort: Newest</button>
          </div>

          <div className="statsGrid">
            <StatCard label="Total Missions" value={stats.total} tone="gold" />
            <StatCard label="Needs Assignment" value={stats.pending} tone="yellow" />
            <StatCard label="In Field" value={stats.inField} tone="blue" />
            <StatCard label="Waiting Review" value={stats.submitted} tone="cyan" />
            <StatCard label="Completed" value={stats.completed} tone="green" />
            <StatCard label="Active Load" value={stats.inField + stats.submitted} tone="purple" />
          </div>

          <div className="requestList">
            {loading ? (
              <EmptyCard text="Loading operation requests..." />
            ) : filteredItems.length === 0 ? (
              <EmptyCard text="No operation requests in this view." />
            ) : (
              filteredItems.map((item) => (
                <button
                  type="button"
                  key={item.request.id}
                  onClick={() => setSelectedId(item.request.id)}
                  className={`operationCard ${selectedItem?.request.id === item.request.id ? "selected" : ""}`}
                >
                  <OperationIcon type={item.sourceType || item.operationType} />

                  <div className="cardMain">
                    <div className="cardTitle">
                      <h3>{item.operationType}</h3>
                      <StatusBadge status={item.status} />
                    </div>

                    <p>
                      <b>{getMissionMeta(item).requirement}</b>
                      <span>•</span>
                      {item.assignmentMode === "TREE" ? `${treeName(item.tree)} • ${item.tree?.tree_code || "No code"}` : forestName(item.group, item.tree)}
                    </p>

                    <div className="cardMeta">
                      <span>{customerName(item.customer)}</span>
                      <span>{forestName(item.group, item.tree)}</span>
                      <span>{formatDate(item.request.created_at || item.request.requested_at)}</span>
                    </div>
                  </div>

                  <div className="cardAction">
                    {item.caretaker ? (
                      <>
                        <strong>{item.caretaker.full_name || item.caretaker.email}</strong>
                        <small>Gardener</small>
                      </>
                    ) : (
                      <>
                        <strong className="priority">{priorityLabel(item)}</strong>
                        <small>Needs assignment</small>
                      </>
                    )}
                  </div>

                  <ChevronIcon />
                </button>
              ))
            )}
          </div>
        </section>

        <aside className="detailPanel">
          {selectedItem ? (
            <OperationDetails
              item={selectedItem}
              caretakers={activeCaretakers}
              selectedCaretaker={selectedCaretaker[selectedItem.request.id] || ""}
              setSelectedCaretaker={(caretakerId) =>
                setSelectedCaretaker((current) => ({ ...current, [selectedItem.request.id]: caretakerId }))
              }
              reviewNote={reviewNotes[selectedItem.request.id] || ""}
              setReviewNote={(note) => setReviewNotes((current) => ({ ...current, [selectedItem.request.id]: note }))}
              assignGardener={() => assignGardener(selectedItem)}
              cancelRequest={() => cancelRequest(selectedItem)}
              approveCompletion={() => reviewSubmittedWork(selectedItem, "APPROVE")}
              rejectEvidence={() => reviewSubmittedWork(selectedItem, "REJECT")}
              requestRework={() => reviewSubmittedWork(selectedItem, "REWORK")}
              processing={processingId === selectedItem.request.id}
            />
          ) : (
            <EmptyCard text="Select an operation request." />
          )}
        </aside>
      </section>

      <style>{styles}</style>
    </main>
  );
}

function OperationDetails({
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
  const needsReview = Boolean(
    item.assignment?.id &&
      item.task?.id &&
      hasAnyEvidence(item.evidence) &&
      (item.status === "SUBMITTED" || item.evidenceStatus === "SUBMITTED")
  );

  return (
    <>
      <div className="detailHeader">
        <h2>Operation Request Details</h2>
        <StatusBadge status={item.status} />
      </div>

      <div className="detailService">
        <OperationIcon type={item.sourceType || item.operationType} />
        <div>
          <h3>{item.operationType}</h3>
          <p>{getMissionMeta(item).requirement}</p>
        </div>
      </div>

      <DetailBox title="Mission Requirement">
        <div className="requirementBox">
          <strong>{getMissionMeta(item).label}</strong>
          <p>{getMissionMeta(item).reviewRule}</p>
          <small>Evidence table: {getMissionMeta(item).evidenceTable}</small>
          {missionNeedsInventory(item.sourceType || item.operationType) && (
            <small>Inventory Required: {getMissionInventoryItems(item.sourceType || item.operationType).join(" / ")}</small>
          )}
        </div>
      </DetailBox>

      <DetailBox title="Tree Information">
        <InfoRow label="Tree Code" value={item.tree?.tree_code || "Forest Level"} />
        <InfoRow label="Seedling Name" value={treeName(item.tree)} />
        <InfoRow label="Forest" value={forestName(item.group, item.tree)} />
        <InfoRow label="Assignment Mode" value={item.assignmentMode} />
      </DetailBox>

      <DetailBox title="Request Information">
        <InfoRow label="Customer" value={customerName(item.customer)} />
        <InfoRow label="Requested Date" value={formatDate(item.request.created_at || item.request.requested_at)} />
        <InfoRow label="Priority" value={priorityLabel(item)} />
        <InfoRow label="Notes" value={item.request.notes || "No customer notes"} />
      </DetailBox>

      <DetailBox title="Assignment">
        <InfoRow label="Status" value={item.assignment?.status || "Not Assigned"} />
        <InfoRow label="Gardener" value={item.caretaker?.full_name || item.caretaker?.email || "Not Assigned"} />

        {canAssign ? (
          <div className="assignBox">
            <select value={selectedCaretaker} onChange={(event) => setSelectedCaretaker(event.target.value)}>
              <option value="">Select gardener...</option>
              {caretakers.map((caretaker) => (
                <option key={caretaker.id} value={caretaker.id}>
                  {caretaker.full_name || caretaker.email}
                </option>
              ))}
            </select>

            <button onClick={assignGardener} disabled={processing || caretakers.length === 0}>
              {processing ? "Assigning..." : "Assign Gardener"}
            </button>
          </div>
        ) : (
          <div className="syncedBox">{item.assignment ? "Synced to Gardener Portal." : "Request is closed."}</div>
        )}
      </DetailBox>

      <DetailBox title="Submitted Evidence">
        <EvidenceMeter item={item} />
        <InfoRow label="Photos" value={`${item.evidence.photos.length} record(s)`} />
        <InfoRow label="GPS Logs" value={`${item.evidence.gps.length} record(s)`} />
        <InfoRow label="Health Reports" value={`${item.evidence.health.length} record(s)`} />
      </DetailBox>

      <DetailBox title="Admin Review">
        <textarea
          value={reviewNote}
          onChange={(event) => setReviewNote(event.target.value)}
          placeholder="Required for rejection or rework. Optional for approval."
        />

        {needsReview ? (
          <div className="reviewActions">
            <button onClick={approveCompletion} disabled={processing}>
              Approve Completion
            </button>
            <button onClick={requestRework} disabled={processing}>
              Request Rework
            </button>
            <button onClick={rejectEvidence} disabled={processing}>
              Reject Evidence
            </button>
          </div>
        ) : (
          <p className="reviewLocked">Waiting for submitted evidence before review.</p>
        )}

        {!closed && (
          <button className="cancelButton" onClick={cancelRequest} disabled={processing}>
            Cancel Request
          </button>
        )}
      </DetailBox>

      <DetailBox title="Activity Timeline">
        <Timeline label="Request Created" value={formatDate(item.request.created_at || item.request.requested_at)} />
        <Timeline label="Assigned" value={formatDate(item.assignment?.assigned_at || item.request.assigned_at)} />
        <Timeline label="Submitted" value={formatDate(item.task?.submitted_at || item.assignment?.submitted_at)} />
        <Timeline label="Completed" value={formatDate(item.request.completed_at || item.assignment?.completed_at)} />
      </DetailBox>
    </>
  );
}


function EvidenceMeter({ item }: { item: OperationItem }) {
  const ready = hasRequiredEvidence(item);
  const meta = getMissionMeta(item);

  return (
    <div className={`evidenceMeter ${ready ? "ready" : "missing"}`}>
      <div>
        <strong>{ready ? "Ready for approval" : "Evidence incomplete"}</strong>
        <span>{meta.requirement}</span>
      </div>
      <b>{ready ? "100%" : "Pending"}</b>
    </div>
  );
}

function FilterButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button className={`filterButton ${active ? "active" : ""}`} onClick={onClick}>
      <span>{label}</span>
      <b>{count}</b>
    </button>
  );
}

function Legend({ label, type }: { label: string; type: string }) {
  return (
    <div className="legend">
      <OperationIcon type={type} />
      <span>{label}</span>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <article className={`statCard ${tone}`}>
      <p>{label}</p>
      <h3>{value}</h3>
    </article>
  );
}

function DetailBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="detailBox">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="infoRow">
      <span>{label}</span>
      <b>{value || "—"}</b>
    </div>
  );
}

function Timeline({ label, value }: { label: string; value: string }) {
  return (
    <div className="timelineRow">
      <span />
      <div>
        <strong>{label}</strong>
        <p>{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeStatus(status);
  return <span className={`statusBadge ${normalized.toLowerCase()}`}>{normalized.replaceAll("_", " ")}</span>;
}

function EmptyCard({ text }: { text: string }) {
  return <div className="emptyCard">{text}</div>;
}

function OperationIcon({ type }: { type: string }) {
  const key = normalizeStatus(type);

  if (key.includes("WATER")) return <IconWrap tone="blue"><WaterSvg /></IconWrap>;
  if (key.includes("FERTILIZER")) return <IconWrap tone="green"><LeafSvg /></IconWrap>;
  if (key.includes("PHOTO")) return <IconWrap tone="orange"><CameraSvg /></IconWrap>;
  if (key.includes("HEALTH")) return <IconWrap tone="purple"><HeartSvg /></IconWrap>;
  if (key.includes("GPS")) return <IconWrap tone="purple"><PinSvg /></IconWrap>;
  if (key.includes("QR")) return <IconWrap tone="cyan"><QrSvg /></IconWrap>;
  if (key.includes("CARE")) return <IconWrap tone="green"><RefreshSvg /></IconWrap>;

  return <IconWrap tone="gold"><TaskSvg /></IconWrap>;
}

function IconWrap({ children, tone }: { children: ReactNode; tone: string }) {
  return <span className={`opIcon ${tone}`}>{children}</span>;
}

function WaterSvg() {
  return <svg viewBox="0 0 24 24"><path d="M12 2S5.5 9.2 5.5 15a6.5 6.5 0 0 0 13 0C18.5 9.2 12 2 12 2Z" /><path d="M9 16.2c.7 1.4 1.8 2.1 3.3 2.1" /></svg>;
}

function LeafSvg() {
  return <svg viewBox="0 0 24 24"><path d="M21 4s-8.2-.8-13 4c-3.9 3.9-3 9-3 9s5.1.9 9-3c4.8-4.8 7-10 7-10Z" /><path d="M5 19c4-5 8-7 14-10" /></svg>;
}

function CameraSvg() {
  return <svg viewBox="0 0 24 24"><path d="M4 7h4l1.5-2h5L16 7h4v12H4V7Z" /><circle cx="12" cy="13" r="3.5" /></svg>;
}

function HeartSvg() {
  return <svg viewBox="0 0 24 24"><path d="M20.5 5.8c-2-2-5.2-1.7-6.9.6L12 8.2l-1.6-1.8C8.7 4.1 5.5 3.8 3.5 5.8c-2.1 2.1-2 5.5.2 7.6L12 21l8.3-7.6c2.2-2.1 2.3-5.5.2-7.6Z" /><path d="M7 13h3l1.2-2.6L13.5 16l1.4-3H17" /></svg>;
}

function PinSvg() {
  return <svg viewBox="0 0 24 24"><path d="M12 21s7-6.1 7-12A7 7 0 0 0 5 9c0 5.9 7 12 7 12Z" /><circle cx="12" cy="9" r="2.4" /></svg>;
}

function QrSvg() {
  return <svg viewBox="0 0 24 24"><path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Z" /><path d="M14 14h2v2h-2v-2Zm4 0h2v6h-2v-6Zm-4 4h2v2h-2v-2Z" /></svg>;
}

function RefreshSvg() {
  return <svg viewBox="0 0 24 24"><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M18.2 9A7 7 0 0 0 6.7 6.7L4 9.4" /><path d="M5.8 15A7 7 0 0 0 17.3 17.3L20 14.6" /></svg>;
}

function TaskSvg() {
  return <svg viewBox="0 0 24 24"><path d="M7 3h10l3 3v15H4V3h3Z" /><path d="M8 12h8M8 16h6" /></svg>;
}

function SearchIcon() {
  return <svg className="searchIcon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
}

function ChevronIcon() {
  return <svg className="chevron" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg>;
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

function isPendingItem(item: OperationItem) {
  return ACTIVE_PENDING_STATUSES.includes(item.status) || ACTIVE_PENDING_STATUSES.includes(normalizeStatus(item.request.assignment_status));
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
  return (
    evidence.photos.length > 0 ||
    evidence.gps.length > 0 ||
    evidence.health.length > 0
  );
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
  if (text.includes("PEST") || text.includes("FUNGICIDE") || text.includes("INSECT")) return "PEST_CONTROL";
  if (text.includes("PRUN")) return "PRUNING";
  if (text.includes("QR")) return "QR_TAGGING";
  if (text.includes("CARE_PROGRAM")) return "CARE_PROGRAM";
  return "TREE_OPERATION";
}


function isInFieldItem(item: OperationItem) {
  return item.status === "ASSIGNED" || item.status === "IN_PROGRESS";
}

function isWaitingReviewItem(item: OperationItem) {
  return item.status === "SUBMITTED" || item.evidenceStatus === "SUBMITTED";
}

type MissionMeta = {
  key: string;
  label: string;
  requirement: string;
  reviewRule: string;
  evidenceTable: string;
};

function getMissionMeta(item: OperationItem): MissionMeta {
  const key = getMissionKey(item.sourceType || item.operationType);
  const rule = getMissionRule(key);

  return {
    key,
    label: rule.label,
    requirement: rule.evidenceLabel,
    reviewRule: rule.adminReviewRule,
    evidenceTable: rule.evidenceTable,
  };
}

function getMissionKey(value: string) {
  return getMissionKeyFromText(value);
}

function hasRequiredEvidence(item: OperationItem) {
  return hasRequiredEvidenceForMission(
    getMissionKey(`${item.sourceType || ""} ${item.operationType || ""}`),
    item.evidence,
  );
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

function priorityLabel(item: OperationItem) {
  const text = `${item.request.notes || ""} ${item.operationType || ""}`.toUpperCase();
  if (text.includes("URGENT") || text.includes("HIGH")) return "High Priority";
  return "Normal Priority";
}

function formatDate(value: any) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const styles = `
  * { box-sizing: border-box; }

  .operationsPage {
    min-height: 100vh;
    background:
      radial-gradient(circle at top left, rgba(217,180,95,.18), transparent 30%),
      radial-gradient(circle at top right, rgba(49,120,78,.22), transparent 32%),
      linear-gradient(180deg, #02140f, #03130d 45%, #010806);
    color: #fff;
    padding: 18px;
    font-family: Arial, Helvetica, sans-serif;
    overflow-x: hidden;
  }

  .topBar {
    max-width: 1600px;
    margin: 0 auto 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
  }

  .topBar p {
    margin: 0 0 6px;
    color: #d9b45f;
    font-size: 12px;
    font-weight: 950;
    letter-spacing: .22em;
  }

  .topBar h1 {
    margin: 0;
    font-size: 32px;
    font-weight: 950;
  }

  .topBar span {
    display: block;
    margin-top: 5px;
    color: rgba(255,255,255,.68);
  }

  .topBar button,
  .toolbar button,
  .assignBox button,
  .reviewActions button,
  .cancelButton {
    border: 0;
    border-radius: 14px;
    background: linear-gradient(135deg, #d9b45f, #9d7428);
    color: #071a12;
    padding: 12px 16px;
    font-weight: 950;
    cursor: pointer;
  }

  .layout {
    max-width: 1600px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr) 390px;
    gap: 18px;
    align-items: start;
  }

  .filtersPanel,
  .queuePanel,
  .detailPanel,
  .message,
  .emptyCard {
    border: 1px solid rgba(255,255,255,.10);
    background: rgba(255,255,255,.055);
    backdrop-filter: blur(18px);
    box-shadow: 0 25px 70px rgba(0,0,0,.25);
  }

  .filtersPanel,
  .detailPanel {
    border-radius: 22px;
    padding: 18px;
    position: sticky;
    top: 18px;
  }

  .queuePanel {
    border-radius: 22px;
    padding: 0;
    background: transparent;
    border: 0;
    box-shadow: none;
  }

  .message {
    max-width: 1600px;
    margin: 0 auto 14px;
    border-radius: 16px;
    padding: 14px 16px;
    color: #ffe49a;
    font-weight: 900;
  }

  .filterHead {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 18px;
  }

  .filterHead h2 {
    margin: 0;
    font-size: 18px;
    text-transform: uppercase;
  }

  .filterHead button {
    border: 0;
    background: transparent;
    color: #92dc63;
    cursor: pointer;
    font-weight: 800;
  }

  .filterButton {
    width: 100%;
    margin-bottom: 8px;
    border: 0;
    border-radius: 13px;
    background: transparent;
    color: rgba(255,255,255,.82);
    display: flex;
    justify-content: space-between;
    padding: 10px 12px;
    cursor: pointer;
    font-weight: 800;
  }

  .filterButton.active,
  .filterButton:hover {
    background: rgba(255,255,255,.08);
  }

  .filterButton b {
    background: rgba(255,255,255,.10);
    border-radius: 999px;
    padding: 2px 10px;
    color: #fff;
  }

  .filterDivider {
    height: 1px;
    background: rgba(255,255,255,.10);
    margin: 16px -18px;
  }

  .filterTitle {
    color: rgba(255,255,255,.7);
    font-weight: 950;
    margin: 0 0 10px;
  }

  .legend {
    display: flex;
    align-items: center;
    gap: 10px;
    color: rgba(255,255,255,.78);
    padding: 8px 0;
    font-weight: 800;
  }

  .legend .opIcon {
    width: 30px;
    height: 30px;
  }

  .legend .opIcon svg {
    width: 17px;
    height: 17px;
  }

  .toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    margin-bottom: 14px;
  }

  .searchBox {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,.10);
    background: rgba(255,255,255,.055);
    padding: 0 14px;
  }

  .searchBox input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: #fff;
    padding: 15px 0;
  }

  .searchIcon,
  .chevron {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
  }

  .statsGrid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 14px;
  }

  .statCard {
    border: 1px solid rgba(255,255,255,.10);
    background: rgba(255,255,255,.055);
    border-radius: 16px;
    padding: 16px;
  }

  .statCard p {
    margin: 0;
    font-size: 11px;
    color: rgba(255,255,255,.65);
    font-weight: 900;
  }

  .statCard h3 {
    margin: 8px 0 0;
    font-size: 28px;
  }

  .statCard.gold h3 { color: #d9b45f; }
  .statCard.yellow h3 { color: #ffc849; }
  .statCard.blue h3 { color: #5da8ff; }
  .statCard.purple h3 { color: #b18cff; }
  .statCard.cyan h3 { color: #22d6d1; }
  .statCard.green h3 { color: #84db61; }

  .requestList {
    display: grid;
    gap: 10px;
  }

  .operationCard {
    width: 100%;
    border: 1px solid rgba(255,255,255,.10);
    background: rgba(0,60,42,.42);
    border-radius: 16px;
    padding: 16px;
    display: grid;
    grid-template-columns: 70px minmax(0, 1fr) auto 24px;
    gap: 14px;
    align-items: center;
    color: #fff;
    text-align: left;
    cursor: pointer;
    transition: .18s ease;
  }

  .operationCard:hover,
  .operationCard.selected {
    border-color: rgba(217,180,95,.95);
    background: rgba(0,76,51,.56);
  }

  .cardTitle {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .cardTitle h3 {
    margin: 0;
    font-size: 20px;
  }

  .cardMain p {
    margin: 7px 0;
    color: rgba(255,255,255,.68);
  }

  .cardMain b {
    color: #8fe55e;
  }

  .cardMain p span {
    margin: 0 8px;
    color: rgba(255,255,255,.35);
  }

  .cardMeta {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    color: rgba(255,255,255,.62);
    font-size: 13px;
  }

  .cardAction {
    min-width: 145px;
    text-align: right;
  }

  .cardAction strong {
    display: block;
    color: #fff;
  }

  .cardAction .priority {
    color: #8fe55e;
  }

  .cardAction small {
    color: rgba(255,255,255,.55);
  }

  .detailHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 18px;
  }

  .detailHeader h2 {
    margin: 0;
    font-size: 20px;
  }

  .detailService {
    display: flex;
    gap: 14px;
    align-items: center;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,.10);
    background: rgba(0,0,0,.18);
    padding: 14px;
    margin-bottom: 14px;
  }

  .detailService h3 {
    margin: 0;
    font-size: 20px;
  }

  .detailService p {
    margin: 4px 0 0;
    color: rgba(255,255,255,.62);
  }

  .detailBox {
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,.10);
    background: rgba(0,0,0,.18);
    padding: 14px;
    margin-bottom: 12px;
  }

  .detailBox h3 {
    margin: 0 0 12px;
    font-size: 15px;
  }

  .infoRow {
    display: grid;
    grid-template-columns: 125px 1fr;
    gap: 12px;
    margin: 9px 0;
  }

  .infoRow span {
    color: rgba(255,255,255,.52);
    font-size: 13px;
  }

  .infoRow b {
    color: #fff;
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  .assignBox {
    display: grid;
    gap: 10px;
    margin-top: 12px;
  }

  .assignBox select,
  .detailBox textarea {
    width: 100%;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 12px;
    background: rgba(0,0,0,.30);
    color: #fff;
    padding: 12px;
    outline: none;
  }

  .detailBox textarea {
    min-height: 90px;
    resize: vertical;
  }


  .requirementBox {
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(217,180,95,.16), rgba(25,130,80,.12));
    border: 1px solid rgba(217,180,95,.20);
    padding: 13px;
  }

  .requirementBox strong {
    display: block;
    color: #ffe49a;
    font-size: 14px;
    margin-bottom: 6px;
  }

  .requirementBox p {
    margin: 0 0 7px;
    color: rgba(255,255,255,.82);
    font-size: 13px;
    line-height: 1.35;
  }

  .requirementBox small {
    color: rgba(255,255,255,.52);
    font-weight: 800;
  }

  .evidenceMeter {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-radius: 14px;
    padding: 12px;
    margin-bottom: 12px;
    border: 1px solid rgba(255,255,255,.10);
    background: rgba(255,255,255,.06);
  }

  .evidenceMeter strong,
  .evidenceMeter span {
    display: block;
  }

  .evidenceMeter strong {
    color: #fff;
    font-size: 13px;
  }

  .evidenceMeter span {
    color: rgba(255,255,255,.58);
    font-size: 12px;
    margin-top: 3px;
  }

  .evidenceMeter b {
    border-radius: 999px;
    padding: 6px 10px;
    font-size: 11px;
  }

  .evidenceMeter.ready b {
    color: #071a12;
    background: #84db61;
  }

  .evidenceMeter.missing b {
    color: #ffe49a;
    background: rgba(217,180,95,.14);
  }

  .syncedBox,
  .reviewLocked {
    border-radius: 12px;
    background: rgba(132,219,97,.10);
    border: 1px solid rgba(132,219,97,.18);
    color: #caffe0;
    padding: 12px;
    font-weight: 800;
    font-size: 13px;
  }

  .reviewActions {
    display: grid;
    gap: 8px;
    margin-top: 10px;
  }

  .reviewActions button:nth-child(1) {
    background: #65d66d;
  }

  .reviewActions button:nth-child(2) {
    background: #d9b45f;
  }

  .reviewActions button:nth-child(3),
  .cancelButton {
    background: rgba(220,70,70,.18);
    color: #ffd7d7;
    border: 1px solid rgba(255,120,120,.24);
  }

  .cancelButton {
    width: 100%;
    margin-top: 10px;
  }

  .timelineRow {
    display: grid;
    grid-template-columns: 18px 1fr;
    gap: 10px;
    margin: 10px 0;
  }

  .timelineRow > span {
    width: 10px;
    height: 10px;
    margin-top: 5px;
    border-radius: 50%;
    background: #d9b45f;
    box-shadow: 0 0 0 4px rgba(217,180,95,.14);
  }

  .timelineRow strong {
    color: #fff;
    font-size: 13px;
  }

  .timelineRow p {
    margin: 3px 0 0;
    color: rgba(255,255,255,.55);
    font-size: 12px;
  }

  .statusBadge {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 5px 9px;
    font-size: 11px;
    font-weight: 950;
    color: #ffe49a;
    background: rgba(217,180,95,.14);
    border: 1px solid rgba(217,180,95,.22);
  }

  .statusBadge.assigned { color: #bcdcff; background: rgba(70,130,220,.16); border-color: rgba(70,130,220,.24); }
  .statusBadge.in_progress { color: #d8c1ff; background: rgba(140,90,220,.16); border-color: rgba(140,90,220,.24); }
  .statusBadge.submitted { color: #b8ffff; background: rgba(20,190,190,.15); border-color: rgba(20,190,190,.22); }
  .statusBadge.completed { color: #caffe0; background: rgba(90,210,100,.15); border-color: rgba(90,210,100,.22); }
  .statusBadge.rejected,
  .statusBadge.cancelled { color: #ffd0d0; background: rgba(220,70,70,.15); border-color: rgba(220,70,70,.22); }

  .opIcon {
    width: 58px;
    height: 58px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(255,255,255,.10);
    flex: 0 0 auto;
  }

  .opIcon svg {
    width: 29px;
    height: 29px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .opIcon.blue { color: #5cc8ff; background: rgba(56,150,220,.16); }
  .opIcon.green { color: #83d65d; background: rgba(82,170,67,.16); }
  .opIcon.orange { color: #ffb14a; background: rgba(220,130,30,.16); }
  .opIcon.purple { color: #b28cff; background: rgba(130,90,220,.16); }
  .opIcon.cyan { color: #29d7d4; background: rgba(20,180,175,.16); }
  .opIcon.gold { color: #d6b25e; background: rgba(214,178,94,.14); }

  .emptyCard {
    border-radius: 18px;
    padding: 24px;
    color: rgba(255,255,255,.62);
    font-weight: 800;
  }

  @media (max-width: 1250px) {
    .layout {
      grid-template-columns: 240px minmax(0, 1fr);
    }

    .detailPanel {
      grid-column: 1 / -1;
      position: static;
    }

    .statsGrid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 850px) {
    .operationsPage {
      padding: 12px;
    }

    .topBar,
    .toolbar {
      grid-template-columns: 1fr;
      display: grid;
    }

    .layout {
      grid-template-columns: 1fr;
    }

    .filtersPanel {
      position: static;
    }

    .operationCard {
      grid-template-columns: 58px minmax(0, 1fr);
    }

    .cardAction,
    .chevron {
      display: none;
    }

    .statsGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .infoRow {
      grid-template-columns: 1fr;
      gap: 4px;
    }
  }
`;