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
  | "VALUATION"
  | "ALL";

type OperationItem = {
  request: Row;
  assignment: Row | null;
  task: Row | null;
  tree: Row | null;
  group: Row | null;
  customer: Row | null;
  status: string;
  sourceType: string;
  assignmentMode: "FOREST" | "TREE";
  operationType: string;
};

export default function AdminOperationsPage() {
  const [requests, setRequests] = useState<Row[]>([]);
  const [caretakers, setCaretakers] = useState<Row[]>([]);
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [tasks, setTasks] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [trees, setTrees] = useState<Row[]>([]);
  const [groups, setGroups] = useState<Row[]>([]);
  const [selectedCaretaker, setSelectedCaretaker] = useState<Record<string, string>>({});
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
    } = await supabase.auth.getUser();

    if (!user) {
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

    const { data: adminRow } = await supabase
      .from("admins")
      .select("id, admin_profile_id, email, status")
      .eq("admin_profile_id", profile.id)
      .maybeSingle();

    const fallbackAdmin = String(profile.email || "").toLowerCase() === "admin@test.com";

    if (!adminRow && !fallbackAdmin) {
      setMessage("Admin access not found.");
      setLoading(false);
      return;
    }

    setAdminProfileId(profile.id);

    const [
      requestResult,
      caretakerResult,
      assignmentResult,
      taskResult,
      profileResult,
      treeResult,
      groupResult,
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
        .eq("status", "ACTIVE")
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
          "id, profile_id, customer_profile_id, group_id, display_name, custom_name, tree_group_name, stage, health_status, care_status, care_expires_at, valuation_status, status, created_at, updated_at"
        )
        .order("created_at", { ascending: false }),

      supabase
        .from("tree_groups")
        .select("id, profile_id, customer_profile_id, group_name, forest_name, farm_location, block_name, total_trees, status")
        .order("created_at", { ascending: false }),
    ]);

    if (requestResult.error) return fail(requestResult.error.message);
    if (caretakerResult.error) return fail(caretakerResult.error.message);
    if (assignmentResult.error) return fail(assignmentResult.error.message);
    if (taskResult.error) return fail(taskResult.error.message);
    if (profileResult.error) return fail(profileResult.error.message);
    if (treeResult.error) return fail(treeResult.error.message);
    if (groupResult.error) return fail(groupResult.error.message);

    setRequests(requestResult.data || []);
    setCaretakers(caretakerResult.data || []);
    setAssignments(assignmentResult.data || []);
    setTasks(taskResult.data || []);
    setProfiles(profileResult.data || []);
    setTrees(treeResult.data || []);
    setGroups(groupResult.data || []);
    setLoading(false);
  }

  function fail(text: string) {
    setMessage(text);
    setLoading(false);
  }

  const profileMap = useMemo(() => makeMap(profiles), [profiles]);
  const treeMap = useMemo(() => makeMap(trees), [trees]);
  const groupMap = useMemo(() => makeMap(groups), [groups]);

  const operationItems = useMemo<OperationItem[]>(() => {
    return requests.map((request) => {
      const assignment =
        assignments.find((item) => String(item.operation_request_id) === String(request.id)) || null;

      const task =
        tasks.find((item) => String(item.assignment_id || "") === String(assignment?.id || "")) ||
        tasks.find((item) => String(item.operation_request_id || "") === String(request.id)) ||
        null;

      const tree = request.tree_id ? treeMap.get(String(request.tree_id)) || null : null;
      const group =
        request.group_id
          ? groupMap.get(String(request.group_id)) || null
          : tree?.group_id
          ? groupMap.get(String(tree.group_id)) || null
          : null;

      const customerProfileId =
        request.customer_profile_id ||
        request.profile_id ||
        tree?.customer_profile_id ||
        tree?.profile_id ||
        group?.customer_profile_id ||
        group?.profile_id ||
        null;

      const customer = customerProfileId ? profileMap.get(String(customerProfileId)) || null : null;

      const sourceType = getSourceType(request);
      const status = normalizeStatus(task?.status || assignment?.status || request.assignment_status || request.status);
      const assignmentMode = request.group_id || group?.id ? "FOREST" : "TREE";

      return {
        request,
        assignment,
        task,
        tree,
        group,
        customer,
        status,
        sourceType,
        assignmentMode,
        operationType: getOperationTitle(request),
      };
    });
  }, [requests, assignments, tasks, treeMap, groupMap, profileMap]);

  const filteredItems = useMemo(() => {
    if (tab === "ALL") return operationItems;
    if (tab === "VALUATION") {
      return operationItems.filter((item) => item.sourceType === "TREE_VALUATION_INSPECTION");
    }

    if (tab === "PENDING") {
      return operationItems.filter((item) =>
        ["PENDING", "REQUESTED", "PAID"].includes(item.status)
      );
    }

    return operationItems.filter((item) => item.status === tab);
  }, [operationItems, tab]);

  const stats = useMemo(() => {
    return {
      pending: operationItems.filter((item) =>
        ["PENDING", "REQUESTED", "PAID"].includes(item.status)
      ).length,
      assigned: operationItems.filter((item) => item.status === "ASSIGNED").length,
      inProgress: operationItems.filter((item) => item.status === "IN_PROGRESS").length,
      submitted: operationItems.filter((item) => item.status === "SUBMITTED").length,
      completed: operationItems.filter((item) => item.status === "COMPLETED").length,
      valuation: operationItems.filter((item) => item.sourceType === "TREE_VALUATION_INSPECTION").length,
    };
  }, [operationItems]);

  async function rollbackAssignment(assignmentId: string) {
    await supabase.from("caretaker_task_logs").delete().eq("assignment_id", assignmentId);
    await supabase.from("caretaker_assignments").delete().eq("id", assignmentId);
  }

  async function assignGardener(item: OperationItem) {
    setMessage("");

    const caretakerId = selectedCaretaker[item.request.id];

    if (!caretakerId) {
      setMessage("Please select a gardener first.");
      return;
    }

    if (item.assignment) {
      setMessage("This request already has an assigned gardener.");
      return;
    }

    const caretaker = caretakers.find((row) => String(row.id) === String(caretakerId));

    if (!caretaker) {
      setMessage("Selected gardener not found.");
      return;
    }

    setProcessingId(item.request.id);

    const now = new Date().toISOString();
    const customerProfileId =
      item.request.customer_profile_id ||
      item.request.profile_id ||
      item.tree?.customer_profile_id ||
      item.tree?.profile_id ||
      item.group?.customer_profile_id ||
      item.group?.profile_id ||
      null;

    const groupId = item.request.group_id || item.group?.id || item.tree?.group_id || null;
    const treeId = item.assignmentMode === "TREE" ? item.request.tree_id || item.tree?.id || null : item.request.tree_id || null;
    const sourceType = item.sourceType;

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
      setMessage(assignmentError?.message || "Assignment creation failed.");
      setProcessingId("");
      return;
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
      setMessage(taskError?.message || "Task creation failed. Assignment was rolled back.");
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
      setMessage(`Request sync failed. Assignment was rolled back: ${requestError.message}`);
      setProcessingId("");
      return;
    }

    setMessage(`${item.assignmentMode === "FOREST" ? "Forest" : "Tree"} assigned to gardener successfully.`);
    setProcessingId("");
    await loadData();
    setTab("ASSIGNED");
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
        .update({ status: "CANCELLED", completed_at: now, updated_at: now })
        .eq("assignment_id", item.assignment.id);

      await supabase
        .from("caretaker_assignments")
        .update({ status: "CANCELLED", completed_at: now, updated_at: now })
        .eq("id", item.assignment.id);
    }

    const { error } = await supabase
      .from("tree_operation_requests")
      .update({
        status: "CANCELLED",
        assignment_status: "CANCELLED",
        updated_at: now,
      })
      .eq("id", item.request.id);

    if (error) {
      setMessage(error.message);
      setProcessingId("");
      return;
    }

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
              <p className="text-xs font-black uppercase tracking-[0.35em] text-[#d9b45f]">
                Admin Operations
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                Forest Operations Center
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/65">
                Assign tree or forest work to gardeners while preserving Customer → Admin →
                Gardener → Admin → Customer sync.
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

          <div className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <HeroStat label="Pending" value={stats.pending} />
            <HeroStat label="Assigned" value={stats.assigned} tone="blue" />
            <HeroStat label="In Progress" value={stats.inProgress} tone="yellow" />
            <HeroStat label="Submitted" value={stats.submitted} tone="purple" />
            <HeroStat label="Completed" value={stats.completed} tone="green" />
            <HeroStat label="Valuation" value={stats.valuation} tone="gold" />
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-wrap gap-3">
            {[
              ["PENDING", "Pending Requests"],
              ["ASSIGNED", "Assigned"],
              ["IN_PROGRESS", "In Progress"],
              ["SUBMITTED", "Submitted"],
              ["COMPLETED", "Completed"],
              ["VALUATION", "Valuation"],
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
                caretakers={caretakers}
                selectedCaretaker={selectedCaretaker[item.request.id] || ""}
                setSelectedCaretaker={(caretakerId) =>
                  setSelectedCaretaker((current) => ({
                    ...current,
                    [item.request.id]: caretakerId,
                  }))
                }
                assignGardener={() => assignGardener(item)}
                cancelRequest={() => cancelRequest(item)}
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
  assignGardener,
  cancelRequest,
  processing,
}: {
  item: OperationItem;
  caretakers: Row[];
  selectedCaretaker: string;
  setSelectedCaretaker: (value: string) => void;
  assignGardener: () => void;
  cancelRequest: () => void;
  processing: boolean;
}) {
  const closed = ["COMPLETED", "CANCELLED", "REJECTED", "FAILED"].includes(item.status);
  const canAssign = !item.assignment && !closed;
  const assignedCaretaker = item.assignment?.caretaker_id
    ? caretakers.find((caretaker) => String(caretaker.id) === String(item.assignment?.caretaker_id))
    : null;

  return (
    <article className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[#d9b45f]/30 bg-[#d9b45f]/10 px-3 py-1 text-xs font-black text-[#ffe49a]">
              {item.assignmentMode} ASSIGNMENT
            </span>
            <StatusBadge status={item.status} />
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-black text-white/55">
              {item.sourceType.replaceAll("_", " ")}
            </span>
          </div>

          <h2 className="mt-4 text-3xl font-black text-white">
            {item.operationType}
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Info label="Customer" value={customerName(item.customer)} subValue={item.customer?.email || "No email"} />
            <Info label="Forest" value={`🌳 ${forestName(item.group, item.tree)}`} subValue={item.group ? "Forest group" : "Ungrouped forest"} />
            <Info label="Seedling" value={treeName(item.tree)} subValue={item.assignmentMode === "FOREST" ? "Forest-level request" : "Tree-level request"} />
            <Info label="Care Status" value={careStatus(item.tree)} subValue={valuationStatus(item.tree, item.request)} />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Info label="Request Status" value={item.request.status || "PENDING"} subValue={formatDate(item.request.created_at || item.request.requested_at)} />
            <Info label="Assignment Status" value={item.assignment?.status || "Not assigned"} subValue={item.assignment ? "caretaker_assignments synced" : "Waiting for admin"} />
            <Info label="Assigned Gardener" value={assignedCaretaker?.full_name || assignedCaretaker?.email || "Not assigned"} subValue={assignedCaretaker?.assigned_area || "Select gardener"} />
          </div>

          {item.request.notes && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/65">
              <span className="font-black text-[#ffe49a]">Customer Notes:</span> {item.request.notes}
            </div>
          )}
        </div>

        <aside className="w-full rounded-3xl border border-white/10 bg-black/20 p-5 xl:w-[340px]">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/45">
            Gardener Assignment
          </p>

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
              {item.assignment
                ? "Synced to Gardener Portal. Gardener can start work and upload evidence."
                : "This request is closed."}
            </div>
          )}

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

function normalizeStatus(value: any) {
  return String(value || "PENDING").trim().toUpperCase();
}

function getOperationTitle(request: Row) {
  return (
    request.service_name ||
    request.care_program_name ||
    request.operation_type ||
    request.request_type ||
    "Tree Operation"
  );
}

function getSourceType(request: Row) {
  const text = `${request.request_type || ""} ${request.operation_type || ""} ${request.service_name || ""} ${request.care_program_name || ""}`.toUpperCase();

  if (text.includes("VALUATION")) return "TREE_VALUATION_INSPECTION";
  if (text.includes("PHOTO")) return "PHOTO_UPDATE";
  if (text.includes("GPS")) return "GPS_UPDATE";
  if (text.includes("HEALTH")) return "HEALTH_REPORT";

  return "TREE_OPERATION";
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

function careStatus(tree: Row | null) {
  if (!tree) return "Forest Care Review";
  return tree.care_status || "NOT_SUBSCRIBED";
}

function valuationStatus(tree: Row | null, request: Row) {
  const requestText = `${request.request_type || ""} ${request.operation_type || ""} ${request.service_name || ""}`.toUpperCase();

  if (requestText.includes("VALUATION")) return "Valuation request";
  return tree?.valuation_status || "Valuation not requested";
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