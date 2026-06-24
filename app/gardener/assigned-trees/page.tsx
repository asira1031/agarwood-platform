"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Row = Record<string, any>;

type Filter = "ALL" | "ASSIGNED" | "IN_PROGRESS" | "SUBMITTED" | "COMPLETED";

type AssignedTree = {
  key: string;
  assignment: Row;
  task: Row | null;
  request: Row | null;
  tree: Row | null;
  group: Row | null;
  customer: Row | null;
  status: string;
  sourceType: string;
  title: string;
  treeId: string | null;
  groupId: string | null;
  customerProfileId: string | null;
  operationRequestId: string | null;
  assignmentId: string;
  createdAt: string | null;
};

function normalizeStatus(value: any) {
  return String(value || "ASSIGNED").toUpperCase();
}

function makeMap(rows: Row[]) {
  const map = new Map<string, Row>();
  rows.forEach((row) => map.set(String(row.id), row));
  return map;
}

function uniqueStrings(values: any[]) {
  return Array.from(new Set(values.filter(Boolean).map((value) => String(value))));
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

function getSourceType(assignment?: Row | null, task?: Row | null, request?: Row | null) {
  return (
    assignment?.source_type ||
    task?.source_type ||
    request?.source_type ||
    request?.request_type ||
    request?.operation_type ||
    "TREE_OPERATION"
  );
}

function getTitle(assignment?: Row | null, task?: Row | null, request?: Row | null) {
  const sourceType = getSourceType(assignment, task, request);

  if (sourceType === "TREE_VALUATION_INSPECTION") return "Tree Valuation Inspection";
  if (sourceType === "SELL_TREE_INSPECTION") return "Sell Tree Inspection";

  return request?.service_name || request?.operation_type || task?.task_type || "Tree Operation";
}

export default function GardenerAssignedTreesPage() {
  const [caretaker, setCaretaker] = useState<Row | null>(null);
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [taskLogs, setTaskLogs] = useState<Row[]>([]);
  const [requests, setRequests] = useState<Row[]>([]);
  const [trees, setTrees] = useState<Row[]>([]);
  const [groups, setGroups] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [verifiedMap, setVerifiedMap] = useState<Record<string, boolean>>({});
  const [verifyInputMap, setVerifyInputMap] = useState<Record<string, string>>({});
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
      .ilike("email", lowerEmail)
      .maybeSingle();

    const profile = profileById || profileByEmail;

    const { data: caretakerByProfile, error: caretakerProfileError } = profile?.id
      ? await supabase
          .from("caretakers")
          .select("*")
          .eq("caretaker_profile_id", profile.id)
          .maybeSingle()
      : { data: null, error: null };

    if (caretakerProfileError) return fail(caretakerProfileError.message);

    const { data: caretakerByEmail, error: caretakerEmailError } = await supabase
      .from("caretakers")
      .select("*")
      .ilike("email", email)
      .maybeSingle();

    if (caretakerEmailError) return fail(caretakerEmailError.message);

    const caretakerRow = caretakerByProfile || caretakerByEmail;

    if (!caretakerRow) return fail("Caretaker profile not found.");
    if (normalizeStatus(caretakerRow.status) !== "ACTIVE") {
      return fail("Your gardener account is not ACTIVE.");
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

    const [assignmentResult, taskResult] = await Promise.all([
      supabase
        .from("caretaker_assignments")
        .select("*")
        .or(assignmentFilters.join(","))
        .order("created_at", { ascending: false }),
      supabase
        .from("caretaker_task_logs")
        .select("*")
        .or(taskFilters.join(","))
        .order("created_at", { ascending: false }),
    ]);

    if (assignmentResult.error) return fail(assignmentResult.error.message);
    if (taskResult.error) return fail(taskResult.error.message);

    const safeAssignments = assignmentResult.data || [];
    const safeTasks = taskResult.data || [];

    const operationRequestIds = uniqueStrings([
      ...safeAssignments.map((item) => item.operation_request_id),
      ...safeTasks.map((item) => item.operation_request_id),
    ]);

    let requestRows: Row[] = [];

    if (operationRequestIds.length > 0) {
      const { data, error } = await supabase
        .from("tree_operation_requests")
        .select("*")
        .in("id", operationRequestIds);

      if (!error) requestRows = data || [];
    }

    const treeIds = uniqueStrings([
      ...safeAssignments.map((item) => item.tree_id),
      ...safeTasks.map((item) => item.tree_id),
      ...requestRows.map((item) => item.tree_id),
    ]);

    let treeRows: Row[] = [];

    if (treeIds.length > 0) {
      const { data, error } = await supabase.from("trees").select("*").in("id", treeIds);
      if (!error) treeRows = data || [];
    }

    const groupIds = uniqueStrings([
      ...safeAssignments.map((item) => item.group_id),
      ...safeTasks.map((item) => item.group_id),
      ...requestRows.map((item) => item.group_id),
      ...treeRows.map((item) => item.group_id),
    ]);

    let groupRows: Row[] = [];

    if (groupIds.length > 0) {
      const { data, error } = await supabase.from("tree_groups").select("*").in("id", groupIds);
      if (!error) groupRows = data || [];
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
        .select("id, full_name, email, phone")
        .in("id", customerIds);

      if (!error) customerRows = data || [];
    }

    const nextVerifiedMap: Record<string, boolean> = {};
    safeAssignments.forEach((assignment) => {
      const assignmentId = String(assignment.id);
      const oldKey = `arganwood_tree_verified_assignment_${assignmentId}`;
      const sharedKey = `verified_tree_assignment_${assignmentId}`;
      nextVerifiedMap[assignmentId] =
        typeof window !== "undefined" &&
        (localStorage.getItem(oldKey) === "VERIFIED" ||
          localStorage.getItem(sharedKey) === "true");
    });

    setAssignments(safeAssignments);
    setTaskLogs(safeTasks);
    setRequests(requestRows);
    setTrees(treeRows);
    setGroups(groupRows);
    setCustomers(customerRows);
    setVerifiedMap(nextVerifiedMap);
    setLoading(false);
  }

  function fail(text: string) {
    setMessage(text);
    setLoading(false);
  }

  function getVerificationKey(assignmentId: string) {
    return `arganwood_tree_verified_assignment_${assignmentId}`;
  }

  function getSharedVerificationKey(assignmentId: string) {
    return `verified_tree_assignment_${assignmentId}`;
  }

  const requestMap = useMemo(() => makeMap(requests), [requests]);
  const treeMap = useMemo(() => makeMap(trees), [trees]);
  const groupMap = useMemo(() => makeMap(groups), [groups]);
  const customerMap = useMemo(() => makeMap(customers), [customers]);

  const assignedTrees = useMemo<AssignedTree[]>(() => {
    return assignments
      .map((assignment) => {
        const task =
          taskLogs.find((item) => String(item.assignment_id || "") === String(assignment.id)) ||
          taskLogs.find(
            (item) =>
              String(item.operation_request_id || "") ===
              String(assignment.operation_request_id || "")
          ) ||
          null;

        const request = assignment.operation_request_id
          ? requestMap.get(String(assignment.operation_request_id)) || null
          : null;

        const treeId = task?.tree_id || assignment.tree_id || request?.tree_id || null;
        const tree = treeId ? treeMap.get(String(treeId)) || null : null;

        const groupId =
          task?.group_id || assignment.group_id || request?.group_id || tree?.group_id || null;
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
        const sourceType = getSourceType(assignment, task, request);

        return {
          key: `assignment-${assignment.id}`,
          assignment,
          task,
          request,
          tree,
          group,
          customer,
          status: normalizeStatus(task?.status || assignment.status || request?.assignment_status || request?.status),
          sourceType,
          title: getTitle(assignment, task, request),
          treeId,
          groupId,
          customerProfileId,
          operationRequestId:
            task?.operation_request_id || assignment.operation_request_id || request?.id || null,
          assignmentId: assignment.id,
          createdAt: task?.created_at || assignment.created_at || request?.created_at || null,
        };
      })
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
  }, [assignments, taskLogs, requestMap, treeMap, groupMap, customerMap]);

  const filteredTrees = useMemo(() => {
    if (filter === "ALL") return assignedTrees;
    return assignedTrees.filter((item) => item.status === filter);
  }, [assignedTrees, filter]);

  const stats = useMemo(() => {
    return {
      total: assignedTrees.length,
      assigned: assignedTrees.filter((item) => item.status === "ASSIGNED").length,
      inProgress: assignedTrees.filter((item) => item.status === "IN_PROGRESS").length,
      submitted: assignedTrees.filter((item) => item.status === "SUBMITTED").length,
      completed: assignedTrees.filter((item) => item.status === "COMPLETED").length,
    };
  }, [assignedTrees]);

  function getTreeCode(item: AssignedTree) {
    return (
      item.tree?.tree_code ||
      item.assignment?.tree_code ||
      item.request?.tree_code ||
      item.tree?.id ||
      item.treeId ||
      ""
    );
  }

  function verifyTree(item: AssignedTree) {
    const expectedCode = String(getTreeCode(item) || "").trim().toLowerCase();
    const enteredCode = String(verifyInputMap[item.assignmentId] || "").trim().toLowerCase();

    if (!expectedCode) {
      setMessage("Tree code not found for this assignment.");
      return;
    }

    if (!enteredCode) {
      setMessage("Scan or enter the assigned tree code first.");
      return;
    }

    if (enteredCode !== expectedCode) {
      setMessage("Tree QR/code verification failed. Evidence upload is blocked for this task.");
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(getVerificationKey(item.assignmentId), "VERIFIED");
      localStorage.setItem(getSharedVerificationKey(item.assignmentId), "true");
    }

    setVerifiedMap((prev) => ({
      ...prev,
      [item.assignmentId]: true,
    }));

    setMessage("Tree Verified. Evidence Center is now enabled for this assignment.");
  }

  async function ensureTaskLog(item: AssignedTree, status: string) {
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
      evidence_status: "PENDING",
      notes: `Gardener started work for ${item.title}.`,
      status,
      created_at: now,
      updated_at: now,
      started_at: status === "IN_PROGRESS" ? now : null,
    };

    const { data, error } = await supabase
      .from("caretaker_task_logs")
      .insert(payload)
      .select("id")
      .single();

    if (error || !data) throw new Error(error?.message || "Failed to create task log.");
    return data.id;
  }

  async function updateAssignmentStatus(item: AssignedTree, nextStatus: string) {
    setMessage("");
    setSavingKey(item.key);

    const status = normalizeStatus(nextStatus);
    const now = new Date().toISOString();

    try {
      if (status === "COMPLETED") {
        throw new Error("Gardener cannot mark work as COMPLETED. Admin approval is required.");
      }

      if (status === "SUBMITTED") {
        throw new Error("Submit Work is done inside Photo Updates / Evidence Center after uploading required evidence.");
      }

      const assignmentUpdate: Row = {
        status,
        updated_at: now,
      };

      if (status === "IN_PROGRESS") assignmentUpdate.started_at = item.assignment.started_at || now;

      const { error: assignmentError } = await supabase
        .from("caretaker_assignments")
        .update(assignmentUpdate)
        .eq("id", item.assignmentId);

      if (assignmentError) throw assignmentError;

      if (item.task?.id) {
        const taskUpdate: Row = {
          status,
          evidence_status: item.task.evidence_status || "PENDING",
          updated_at: now,
        };

        if (status === "IN_PROGRESS") taskUpdate.started_at = item.task.started_at || now;

        const { error: taskError } = await supabase
          .from("caretaker_task_logs")
          .update(taskUpdate)
          .eq("id", item.task.id);

        if (taskError) throw taskError;
      } else {
        await ensureTaskLog(item, status);
      }

      if (item.operationRequestId && item.sourceType === "TREE_OPERATION") {
        const requestUpdate: Row = {
          assignment_status: status,
          updated_at: now,
        };

        if (status === "IN_PROGRESS") requestUpdate.status = "IN_PROGRESS";

        const { error: requestError } = await supabase
          .from("tree_operation_requests")
          .update(requestUpdate)
          .eq("id", item.operationRequestId);

        if (requestError) throw requestError;
      }

      setMessage(`Assignment synced as ${status.replace("_", " ")}.`);
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || "Assignment update failed.");
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
                Arganwood Gardener Portal
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                Assigned Forest Portfolio
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/65">
                Field workflow: Start Work → Verify Tree QR → Submit Required Evidence → Admin Review → Customer Timeline.
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
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-[#d9b45f]">
            1. Work Queue
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-5">
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Assigned" value={stats.assigned} />
            <StatCard label="In Progress" value={stats.inProgress} />
            <StatCard label="Submitted" value={stats.submitted} />
            <StatCard label="Completed" value={stats.completed} />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {(["ALL", "ASSIGNED", "IN_PROGRESS", "SUBMITTED", "COMPLETED"] as Filter[]).map(
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
                  {item.replaceAll("_", " ")}
                </button>
              )
            )}
          </div>
        </section>

        {loading ? (
          <EmptyCard text="Loading assigned trees..." />
        ) : filteredTrees.length === 0 ? (
          <EmptyCard text="No assigned trees found for this gardener." />
        ) : (
          <section className="space-y-5">
            {filteredTrees.map((item) => (
              <AssignedTreeCard
                key={item.key}
                item={item}
                saving={savingKey === item.key}
                isVerified={Boolean(verifiedMap[item.assignmentId])}
                verifyValue={verifyInputMap[item.assignmentId] || ""}
                setVerifyValue={(value) =>
                  setVerifyInputMap((prev) => ({
                    ...prev,
                    [item.assignmentId]: value,
                  }))
                }
                verifyTree={() => verifyTree(item)}
                updateAssignmentStatus={(status) => updateAssignmentStatus(item, status)}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function AssignedTreeCard({
  item,
  saving,
  isVerified,
  verifyValue,
  setVerifyValue,
  verifyTree,
  updateAssignmentStatus,
}: {
  item: AssignedTree;
  saving: boolean;
  isVerified: boolean;
  verifyValue: string;
  setVerifyValue: (value: string) => void;
  verifyTree: () => void;
  updateAssignmentStatus: (status: string) => void;
}) {
  const closed = ["COMPLETED", "CANCELLED", "REJECTED", "FAILED"].includes(item.status);

  const treeCode =
    item.tree?.tree_code ||
    item.assignment?.tree_code ||
    item.request?.tree_code ||
    item.tree?.id ||
    item.treeId ||
    "—";

  const treeName =
    item.tree?.display_name ||
    item.tree?.custom_name ||
    item.tree?.name ||
    item.assignment?.tree_name ||
    item.request?.tree_name ||
    "Assigned Tree";

  const forestName =
    item.group?.forest_name ||
    item.group?.group_name ||
    item.tree?.tree_group_name ||
    "Single Tree";

  const evidenceStatus = item.task?.evidence_status || item.request?.evidence_status || "PENDING";
  const adminNotes = item.assignment?.admin_notes || item.request?.admin_notes || item.task?.admin_notes || "—";

  return (
    <article className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={item.status} />
            <span className="rounded-full border border-[#d9b45f]/30 bg-[#d9b45f]/10 px-3 py-1 text-xs font-black text-[#ffe49a]">
              {item.sourceType.replaceAll("_", " ")}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-black ${
                isVerified
                  ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
                  : "border-red-400/30 bg-red-500/15 text-red-200"
              }`}
            >
              {isVerified ? "TREE VERIFIED" : "QR REQUIRED"}
            </span>
          </div>

          <section className="rounded-3xl border border-white/10 bg-black/20 p-5">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#d9b45f]">
              2. Work Order
            </p>
            <h2 className="mt-3 text-3xl font-black text-[#ffe49a]">{treeName}</h2>
            <p className="mt-2 text-sm text-white/65">
              Tree Code: <b className="text-white">{treeCode}</b>
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <Info label="Forest / Group" value={forestName} />
              <Info label="Customer Name" value={item.customer?.full_name || "Unknown Customer"} />
              <Info label="Customer Email" value={item.customer?.email || "—"} />
              <Info label="Requested Service" value={item.title} />
              <Info label="Assignment Status" value={item.status.replaceAll("_", " ")} />
              <Info label="Evidence Status" value={String(evidenceStatus).replaceAll("_", " ")} />
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
                Admin Notes / Instructions
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-white/75">
                {adminNotes}
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-[#d9b45f]/20 bg-[#d9b45f]/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#ffe49a]">
              3. Scan Tree QR
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/65">
              Scan the physical tree QR or enter the exact Tree Code before uploading evidence.
              Mismatched tree codes are blocked.
            </p>

            <div className="mt-4 flex flex-col gap-3 md:flex-row">
              <input
                value={verifyValue}
                onChange={(event) => setVerifyValue(event.target.value)}
                placeholder="Scan or enter assigned Tree Code"
                className="min-h-[48px] flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none placeholder:text-white/30 focus:border-[#d9b45f]/60"
              />
              <button
                onClick={verifyTree}
                className="rounded-2xl bg-[#d9b45f] px-5 py-3 text-sm font-black text-[#071f16] hover:bg-[#f7d774]"
              >
                Verify Tree
              </button>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-3xl border border-white/10 bg-black/20 p-5">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#d9b45f]">
              4. Evidence Center
            </p>
            <p className="mt-2 text-sm text-white/60">
              Evidence upload is enabled only after Tree Verified.
            </p>

            <div className="mt-4 space-y-3">
              <EvidenceLink
                enabled={isVerified}
                href={`/gardener/photo-updates?assignment_id=${item.assignment.id}`}
                label="Open Evidence Center"
              />

              <EvidenceLink
                enabled={isVerified}
                href={`/gardener/gps-updates?assignment_id=${item.assignment.id}`}
                label="Submit GPS"
              />

              <EvidenceLink
                enabled={isVerified}
                href={`/gardener/health-reports?assignment_id=${item.assignment.id}`}
                label="Submit Health"
              />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-black/20 p-5">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#d9b45f]">
              5. Submit Work
            </p>
            <p className="mt-2 text-sm text-white/60">
              Gardener submits evidence for Admin Review. Customer will not see COMPLETED until Admin approves.
            </p>

            <div className="mt-4 space-y-3">
              {!closed && item.status === "ASSIGNED" && (
                <button
                  onClick={() => updateAssignmentStatus("IN_PROGRESS")}
                  disabled={saving}
                  className="w-full rounded-2xl bg-[#d9b45f] px-5 py-4 text-sm font-black text-[#071f16] hover:bg-[#f7d774] disabled:opacity-50"
                >
                  Start Work
                </button>
              )}

              {!closed && item.status === "IN_PROGRESS" && (
                <Link
                  href={`/gardener/photo-updates?assignment_id=${item.assignment.id}`}
                  className={`block w-full rounded-2xl px-5 py-4 text-center text-sm font-black ${
                    isVerified
                      ? "bg-emerald-500 text-[#03130d] hover:bg-emerald-400"
                      : "border border-white/10 bg-white/5 text-white/30"
                  }`}
                >
                  {isVerified ? "Submit Required Evidence" : "Verify Tree First"}
                </Link>
              )}

              {item.status === "SUBMITTED" && (
                <div className="rounded-2xl border border-purple-400/25 bg-purple-500/10 p-4 text-sm font-bold text-purple-100">
                  Submitted to Admin. Waiting for approval, rejection, or rework request.
                </div>
              )}

              {item.status === "COMPLETED" && (
                <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
                  Completed by Admin approval.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </article>
  );
}

function EvidenceLink({
  enabled,
  href,
  label,
}: {
  enabled: boolean;
  href: string;
  label: string;
}) {
  if (!enabled) {
    return (
      <button
        disabled
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-black text-white/30"
      >
        {label} — Verify Tree First
      </button>
    );
  }

  return (
    <Link
      href={href}
      className="block w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-black text-white/75 hover:bg-white/15"
    >
      {label}
    </Link>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-white/45">{label}</p>
      <p className="mt-3 text-3xl font-black text-[#ffe49a]">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className="mt-2 text-sm font-bold text-white/80">{value || "—"}</p>
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

  if (value === "IN_PROGRESS") classes = "border-blue-400/30 bg-blue-500/15 text-blue-200";
  if (value === "SUBMITTED") classes = "border-purple-400/30 bg-purple-500/15 text-purple-200";
  if (value === "COMPLETED") classes = "border-emerald-400/30 bg-emerald-500/15 text-emerald-200";

  if (["REJECTED", "CANCELLED", "FAILED"].includes(value)) {
    classes = "border-red-400/30 bg-red-500/15 text-red-200";
  }

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-black ${classes}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}