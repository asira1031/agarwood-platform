"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Row = Record<string, any>;

type WorkItem = {
  key: string;
  assignment: Row;
  task: Row | null;
  request: Row | null;
  tree: Row | null;
  group: Row | null;
  customer: Row | null;
  status: string;
  evidenceStatus: string;
};

const SERVICE_LABELS: Record<string, string> = {
  PHOTO_UPDATE: "Photo Update",
  GPS_VERIFICATION: "GPS Verification",
  HEALTH_CHECK: "Health Check",
  WATERING_SERVICE: "Watering Service",
  FERTILIZER: "Fertilizer",
  FUNGICIDE: "Fungicide",
  INSECTICIDE: "Insecticide",
  PRUNING: "Pruning",
  PEST_CONTROL: "Pest Control",
};

function normalize(value: any) {
  return String(value || "").trim().toUpperCase();
}

function statusOf(value: any) {
  return normalize(value || "ASSIGNED");
}

function unique(values: any[]) {
  return Array.from(new Set(values.filter(Boolean).map(String)));
}

function makeMap(rows: Row[]) {
  const map = new Map<string, Row>();
  rows.forEach((row) => map.set(String(row.id), row));
  return map;
}

function serviceOf(item: WorkItem | null) {
  const raw =
    item?.request?.operation_type ||
    item?.request?.request_type ||
    item?.request?.service_name ||
    item?.task?.task_type ||
    item?.assignment?.assignment_type ||
    "PHOTO_UPDATE";

  return normalize(raw).replaceAll(" ", "_");
}

function serviceLabel(value: string) {
  return SERVICE_LABELS[value] || value.replaceAll("_", " ");
}

function evidenceRules(service: string) {
  if (service === "PHOTO_UPDATE") {
    return {
      photo: true,
      gps: false,
      health: false,
      before: false,
      after: false,
      notes: false,
      notesLabel: "Notes optional",
    };
  }

  if (service === "GPS_VERIFICATION") {
    return {
      photo: false,
      gps: true,
      health: false,
      before: false,
      after: false,
      notes: false,
      notesLabel: "Notes optional",
    };
  }

  if (service === "HEALTH_CHECK") {
    return {
      photo: false,
      gps: false,
      health: true,
      before: false,
      after: false,
      notes: true,
      notesLabel: "Notes required",
    };
  }

  return {
    photo: false,
    gps: false,
    health: false,
    before: true,
    after: true,
    notes: true,
    notesLabel: "Notes required",
  };
}

export default function GardenerTasksPage() {
  const [caretaker, setCaretaker] = useState<Row | null>(null);
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [tasks, setTasks] = useState<Row[]>([]);
  const [requests, setRequests] = useState<Row[]>([]);
  const [trees, setTrees] = useState<Row[]>([]);
  const [groups, setGroups] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [scanValue, setScanValue] = useState("");
  const [verifiedKey, setVerifiedKey] = useState("");
  const [currentPhoto, setCurrentPhoto] = useState<File | null>(null);
  const [beforePhoto, setBeforePhoto] = useState<File | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<File | null>(null);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [healthStatus, setHealthStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState("ACTIVE");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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

    const { data: caretakerByProfile } = profile?.id
      ? await supabase
          .from("caretakers")
          .select("*")
          .eq("caretaker_profile_id", profile.id)
          .maybeSingle()
      : { data: null };

    const { data: caretakerByEmail } = await supabase
      .from("caretakers")
      .select("*")
      .ilike("email", email)
      .maybeSingle();

    const caretakerRow = caretakerByProfile || caretakerByEmail;

    if (!caretakerRow) return fail("Gardener profile not found.");
    if (statusOf(caretakerRow.status) !== "ACTIVE") return fail("Your gardener account is not ACTIVE.");

    setCaretaker(caretakerRow);

    const filters = [
      `caretaker_id.eq.${caretakerRow.id}`,
      caretakerRow.caretaker_profile_id
        ? `caretaker_profile_id.eq.${caretakerRow.caretaker_profile_id}`
        : "",
    ].filter(Boolean);

    const [assignmentResult, taskResult] = await Promise.all([
      supabase
        .from("caretaker_assignments")
        .select("*")
        .or(filters.join(","))
        .order("created_at", { ascending: false }),

      supabase
        .from("caretaker_task_logs")
        .select("*")
        .or(filters.join(","))
        .order("created_at", { ascending: false }),
    ]);

    if (assignmentResult.error) return fail(assignmentResult.error.message);
    if (taskResult.error) return fail(taskResult.error.message);

    const assignmentRows = assignmentResult.data || [];
    const taskRows = taskResult.data || [];

    const requestIds = unique([
      ...assignmentRows.map((x) => x.operation_request_id),
      ...taskRows.map((x) => x.operation_request_id),
    ]);

    let requestRows: Row[] = [];
    if (requestIds.length) {
      const { data } = await supabase.from("tree_operation_requests").select("*").in("id", requestIds);
      requestRows = data || [];
    }

    const treeIds = unique([
      ...assignmentRows.map((x) => x.tree_id),
      ...taskRows.map((x) => x.tree_id),
      ...requestRows.map((x) => x.tree_id),
    ]);

    let treeRows: Row[] = [];
    if (treeIds.length) {
      const { data } = await supabase.from("trees").select("*").in("id", treeIds);
      treeRows = data || [];
    }

    const groupIds = unique([
      ...assignmentRows.map((x) => x.group_id),
      ...taskRows.map((x) => x.group_id),
      ...requestRows.map((x) => x.group_id),
      ...treeRows.map((x) => x.group_id),
    ]);

    let groupRows: Row[] = [];
    if (groupIds.length) {
      const { data } = await supabase.from("tree_groups").select("*").in("id", groupIds);
      groupRows = data || [];
    }

    const customerIds = unique([
      ...assignmentRows.map((x) => x.customer_profile_id),
      ...taskRows.map((x) => x.customer_profile_id),
      ...requestRows.map((x) => x.customer_profile_id),
      ...requestRows.map((x) => x.profile_id),
      ...treeRows.map((x) => x.customer_profile_id),
      ...treeRows.map((x) => x.profile_id),
      ...groupRows.map((x) => x.customer_profile_id),
      ...groupRows.map((x) => x.profile_id),
    ]);

    let customerRows: Row[] = [];
    if (customerIds.length) {
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", customerIds);
      customerRows = data || [];
    }

    setAssignments(assignmentRows);
    setTasks(taskRows);
    setRequests(requestRows);
    setTrees(treeRows);
    setGroups(groupRows);
    setCustomers(customerRows);
    setLoading(false);
  }

  function fail(text: string) {
    setMessage(text);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const workItems = useMemo<WorkItem[]>(() => {
    const requestMap = makeMap(requests);
    const treeMap = makeMap(trees);
    const groupMap = makeMap(groups);
    const customerMap = makeMap(customers);

    return assignments.map((assignment) => {
      const task =
        tasks.find((x) => String(x.assignment_id || "") === String(assignment.id)) ||
        tasks.find((x) => String(x.operation_request_id || "") === String(assignment.operation_request_id || "")) ||
        null;

      const request = assignment.operation_request_id
        ? requestMap.get(String(assignment.operation_request_id)) || null
        : null;

      const treeId = assignment.tree_id || task?.tree_id || request?.tree_id;
      const tree = treeId ? treeMap.get(String(treeId)) || null : null;

      const groupId = assignment.group_id || task?.group_id || request?.group_id || tree?.group_id;
      const group = groupId ? groupMap.get(String(groupId)) || null : null;

      const customerId =
        assignment.customer_profile_id ||
        task?.customer_profile_id ||
        request?.customer_profile_id ||
        request?.profile_id ||
        tree?.customer_profile_id ||
        tree?.profile_id ||
        group?.customer_profile_id ||
        group?.profile_id;

      const customer = customerId ? customerMap.get(String(customerId)) || null : null;

      return {
        key: String(assignment.id),
        assignment,
        task,
        request,
        tree,
        group,
        customer,
        status: statusOf(task?.status || assignment.status || request?.assignment_status || request?.status),
        evidenceStatus: statusOf(task?.evidence_status || "PENDING"),
      };
    });
  }, [assignments, tasks, requests, trees, groups, customers]);

  const selected = useMemo(() => {
    return workItems.find((x) => x.key === selectedKey) || workItems[0] || null;
  }, [workItems, selectedKey]);

  useEffect(() => {
    if (!selectedKey && workItems[0]) setSelectedKey(workItems[0].key);
  }, [workItems, selectedKey]);

  const visibleItems = useMemo(() => {
    if (filter === "ALL") return workItems;
    if (filter === "ACTIVE") return workItems.filter((x) => !["COMPLETED", "CANCELLED"].includes(x.status));
    return workItems.filter((x) => x.status === filter);
  }, [workItems, filter]);

  const stats = useMemo(() => {
    return {
      assigned: workItems.filter((x) => x.status === "ASSIGNED").length,
      inProgress: workItems.filter((x) => x.status === "IN_PROGRESS").length,
      submitted: workItems.filter((x) => x.status === "SUBMITTED").length,
      completed: workItems.filter((x) => x.status === "COMPLETED").length,
    };
  }, [workItems]);

  const selectedService = serviceOf(selected);
  const rules = evidenceRules(selectedService);
  const isVerified = selected && verifiedKey === selected.key;

  function resetEvidenceForm() {
    setCurrentPhoto(null);
    setBeforePhoto(null);
    setAfterPhoto(null);
    setLatitude("");
    setLongitude("");
    setHealthStatus("");
    setNotes("");
  }

  function verifyTree() {
    if (!selected) return;

    const scanned = scanValue.trim().toLowerCase();
    const treeCode = String(selected.tree?.tree_code || "").trim().toLowerCase();
    const treeId = String(selected.tree?.id || selected.assignment.tree_id || "").trim().toLowerCase();

    if (!scanned) {
      setMessage("Scan or manually enter tree QR / tree code first.");
      return;
    }

    if (scanned === treeCode || scanned === treeId) {
      setVerifiedKey(selected.key);
      setMessage("Tree Verified. Evidence upload is now unlocked.");
      return;
    }

    setVerifiedKey("");
    setMessage("Tree mismatch. Evidence upload blocked.");
  }

  async function startWork() {
    if (!selected || !caretaker) return;
    setSaving(true);
    setMessage("");

    const now = new Date().toISOString();

    try {
      if (selected.task?.id) {
        const { error } = await supabase
          .from("caretaker_task_logs")
          .update({
            status: "IN_PROGRESS",
            evidence_status: "PENDING",
            started_at: selected.task.started_at || now,
            updated_at: now,
          })
          .eq("id", selected.task.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("caretaker_task_logs").insert({
          assignment_id: selected.assignment.id,
          operation_request_id: selected.assignment.operation_request_id || selected.request?.id,
          tree_id: selected.assignment.tree_id || selected.request?.tree_id,
          group_id: selected.assignment.group_id || selected.request?.group_id,
          customer_profile_id:
            selected.assignment.customer_profile_id ||
            selected.request?.customer_profile_id ||
            selected.request?.profile_id,
          caretaker_id: caretaker.id,
          caretaker_profile_id: caretaker.caretaker_profile_id || null,
          task_type: selectedService,
          source_type: "TREE_OPERATION",
          status: "IN_PROGRESS",
          evidence_status: "PENDING",
          notes: "Gardener started field work.",
          started_at: now,
          created_at: now,
          updated_at: now,
        });

        if (error) throw error;
      }

      const { error: assignmentError } = await supabase
        .from("caretaker_assignments")
        .update({
          status: "IN_PROGRESS",
          started_at: selected.assignment.started_at || now,
          updated_at: now,
        })
        .eq("id", selected.assignment.id);

      if (assignmentError) throw assignmentError;

      if (selected.assignment.operation_request_id || selected.request?.id) {
        const { error: requestError } = await supabase
          .from("tree_operation_requests")
          .update({
            status: "IN_PROGRESS",
            assignment_status: "IN_PROGRESS",
            updated_at: now,
          })
          .eq("id", selected.assignment.operation_request_id || selected.request?.id);

        if (requestError) throw requestError;
      }

      setMessage("Work started. Verify tree QR before submitting evidence.");
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || "Failed to start work.");
    }

    setSaving(false);
  }

  async function uploadEvidenceFile(file: File | null, folder: string) {
    if (!file || !selected) return null;

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${folder}/${selected.assignment.id}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    let bucket = "tree-evidence";
    let upload = await supabase.storage.from(bucket).upload(path, file, { upsert: true });

    if (upload.error) {
      bucket = "tree-photos";
      upload = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    }

    if (upload.error) throw upload.error;

    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  function validateSubmission() {
    if (!selected || !caretaker) return "Work order not loaded.";
    if (!selected.assignment.id) return "Missing assignment_id.";
    if (!(selected.assignment.operation_request_id || selected.request?.id)) return "Missing operation_request_id.";
    if (!(selected.assignment.tree_id || selected.request?.tree_id)) return "Missing tree_id.";
    if (
      !(
        selected.assignment.customer_profile_id ||
        selected.request?.customer_profile_id ||
        selected.request?.profile_id ||
        selected.tree?.customer_profile_id ||
        selected.tree?.profile_id
      )
    ) {
      return "Missing customer_profile_id.";
    }
    if (!caretaker.id) return "Missing caretaker_id.";
    if (!isVerified) return "Tree QR must be verified before evidence upload.";
    if (rules.photo && !currentPhoto) return "Current photo is required.";
    if (rules.before && !beforePhoto) return "Before photo is required.";
    if (rules.after && !afterPhoto) return "After photo is required.";
    if (rules.gps && (!latitude || !longitude)) return "GPS latitude and longitude are required.";
    if (rules.health && !healthStatus) return "Health status is required.";
    if (rules.notes && !notes.trim()) return "Notes are required.";
    return "";
  }

  async function submitWork() {
    const validationError = validateSubmission();
    if (validationError || !selected || !caretaker) {
      setMessage(validationError);
      return;
    }

    setSaving(true);
    setMessage("");

    const now = new Date().toISOString();
    const operationRequestId = selected.assignment.operation_request_id || selected.request?.id;
    const treeId = selected.assignment.tree_id || selected.request?.tree_id;
    const customerProfileId =
      selected.assignment.customer_profile_id ||
      selected.request?.customer_profile_id ||
      selected.request?.profile_id ||
      selected.tree?.customer_profile_id ||
      selected.tree?.profile_id;

    try {
      const currentPhotoUrl = await uploadEvidenceFile(currentPhoto, "current");
      const beforePhotoUrl = await uploadEvidenceFile(beforePhoto, "before");
      const afterPhotoUrl = await uploadEvidenceFile(afterPhoto, "after");

      if (currentPhotoUrl || beforePhotoUrl || afterPhotoUrl) {
        const { error } = await supabase.from("tree_photo_updates").insert({
          assignment_id: selected.assignment.id,
          operation_request_id: operationRequestId,
          tree_id: treeId,
          customer_profile_id: customerProfileId,
          caretaker_id: caretaker.id,
          photo_url: currentPhotoUrl,
          before_photo_url: beforePhotoUrl,
          after_photo_url: afterPhotoUrl,
          notes: notes || null,
          status: "SUBMITTED",
          created_at: now,
          updated_at: now,
        });

        if (error) throw error;
      }

      if (rules.gps || latitude || longitude) {
        const { error } = await supabase.from("tree_gps_logs").insert({
          assignment_id: selected.assignment.id,
          operation_request_id: operationRequestId,
          tree_id: treeId,
          customer_profile_id: customerProfileId,
          caretaker_id: caretaker.id,
          latitude: Number(latitude),
          longitude: Number(longitude),
          notes: notes || null,
          status: "SUBMITTED",
          created_at: now,
          updated_at: now,
        });

        if (error) throw error;
      }

      if (rules.health || healthStatus) {
        const { error } = await supabase.from("tree_health_reports").insert({
          assignment_id: selected.assignment.id,
          operation_request_id: operationRequestId,
          tree_id: treeId,
          customer_profile_id: customerProfileId,
          caretaker_id: caretaker.id,
          health_status: healthStatus,
          notes: notes || null,
          status: "SUBMITTED",
          created_at: now,
          updated_at: now,
        });

        if (error) throw error;
      }

      const taskId =
        selected.task?.id ||
        (
          await supabase
            .from("caretaker_task_logs")
            .insert({
              assignment_id: selected.assignment.id,
              operation_request_id: operationRequestId,
              tree_id: treeId,
              group_id: selected.assignment.group_id || selected.request?.group_id || null,
              customer_profile_id: customerProfileId,
              caretaker_id: caretaker.id,
              caretaker_profile_id: caretaker.caretaker_profile_id || null,
              task_type: selectedService,
              source_type: "TREE_OPERATION",
              status: "SUBMITTED",
              evidence_status: "SUBMITTED",
              notes: notes || "Evidence submitted.",
              submitted_at: now,
              created_at: now,
              updated_at: now,
            })
            .select("id")
            .single()
        ).data?.id;

      if (taskId) {
        const { error } = await supabase
          .from("caretaker_task_logs")
          .update({
            status: "SUBMITTED",
            evidence_status: "SUBMITTED",
            notes: notes || selected.task?.notes || "Evidence submitted.",
            submitted_at: now,
            updated_at: now,
          })
          .eq("id", taskId);

        if (error) throw error;
      }

      const { error: assignmentError } = await supabase
        .from("caretaker_assignments")
        .update({
          status: "SUBMITTED",
          submitted_at: now,
          updated_at: now,
        })
        .eq("id", selected.assignment.id);

      if (assignmentError) throw assignmentError;

      const { error: requestError } = await supabase
        .from("tree_operation_requests")
        .update({
          status: "SUBMITTED",
          assignment_status: "SUBMITTED",
          updated_at: now,
        })
        .eq("id", operationRequestId);

      if (requestError) throw requestError;

      setMessage("Evidence submitted. Waiting for Admin approval.");
      resetEvidenceForm();
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || "Submit work failed.");
    }

    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-[#03130d] p-6 text-white md:p-8">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(217,180,95,0.20),transparent_32%),radial-gradient(circle_at_top_right,rgba(52,120,77,0.28),transparent_30%),linear-gradient(180deg,#082015,#03130d_48%,#010805)]" />

      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-7 shadow-2xl backdrop-blur-xl">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-[#d9b45f]">
            Gardener Field Workflow
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">Forest Work Center</h1>
          <p className="mt-3 max-w-4xl text-sm font-semibold leading-relaxed text-white/65">
            Start assigned work, verify tree QR, submit required evidence, then wait for Admin
            completion approval.
          </p>

          {message && (
            <div className="mt-6 rounded-2xl border border-[#d9b45f]/25 bg-[#d9b45f]/10 p-4 text-sm font-bold text-[#ffe49a]">
              {message}
            </div>
          )}
        </section>

        <section className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <div className="space-y-6">
            <Card title="1. Work Queue">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Assigned" value={stats.assigned} />
                <MiniStat label="In Progress" value={stats.inProgress} />
                <MiniStat label="Submitted" value={stats.submitted} />
                <MiniStat label="Completed" value={stats.completed} />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {["ACTIVE", "ALL", "ASSIGNED", "IN_PROGRESS", "SUBMITTED", "COMPLETED"].map((x) => (
                  <button
                    key={x}
                    onClick={() => setFilter(x)}
                    className={`rounded-full px-4 py-2 text-xs font-black ${
                      filter === x
                        ? "bg-[#d9b45f] text-[#071f16]"
                        : "border border-white/10 bg-white/10 text-white/65"
                    }`}
                  >
                    {x.replaceAll("_", " ")}
                  </button>
                ))}
              </div>

              <div className="mt-5 space-y-3">
                {loading ? (
                  <p className="text-sm font-bold text-white/50">Loading work queue...</p>
                ) : visibleItems.length === 0 ? (
                  <p className="text-sm font-bold text-white/50">No work orders found.</p>
                ) : (
                  visibleItems.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => {
                        setSelectedKey(item.key);
                        setVerifiedKey("");
                        setScanValue("");
                        resetEvidenceForm();
                      }}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selected?.key === item.key
                          ? "border-[#d9b45f]/60 bg-[#d9b45f]/15"
                          : "border-white/10 bg-black/20 hover:bg-white/10"
                      }`}
                    >
                      <p className="text-sm font-black text-[#ffe49a]">
                        {serviceLabel(serviceOf(item))}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-white/55">
                        {item.tree?.display_name ||
                          item.tree?.custom_name ||
                          item.tree?.tree_code ||
                          "Assigned Tree"}
                      </p>
                      <p className="mt-2 text-xs font-black text-white/40">
                        {item.status.replaceAll("_", " ")}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="2. Work Order">
              {!selected ? (
                <p className="text-sm font-bold text-white/55">Select a work order.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <Info label="Tree Name" value={selected.tree?.display_name || selected.tree?.custom_name || "Friendly Tree"} />
                  <Info label="Tree Code" value={selected.tree?.tree_code || selected.tree?.id || "—"} />
                  <Info label="Forest / Group" value={selected.group?.forest_name || selected.group?.group_name || "Single Tree"} />
                  <Info label="Customer" value={selected.customer?.full_name || selected.customer?.email || "Unknown Customer"} />
                  <Info label="Requested Service" value={serviceLabel(selectedService)} />
                  <Info label="Admin Notes" value={selected.assignment.admin_notes || selected.request?.admin_notes || selected.request?.notes || "—"} />
                  <Info label="Assignment Status" value={selected.status.replaceAll("_", " ")} />
                  <Info label="Evidence Status" value={selected.evidenceStatus.replaceAll("_", " ")} />
                </div>
              )}

              {selected && selected.status === "ASSIGNED" && (
                <button
                  onClick={startWork}
                  disabled={saving}
                  className="mt-5 w-full rounded-2xl bg-[#d9b45f] px-5 py-4 text-sm font-black text-[#071f16] hover:bg-[#f7d774] disabled:opacity-50"
                >
                  Start Work
                </button>
              )}
            </Card>

            <Card title="3. Scan Tree QR">
              <p className="text-sm font-semibold text-white/60">
                Scan or manually enter the assigned tree_code or tree_id. Evidence upload stays blocked
                until this matches.
              </p>

              <div className="mt-4 flex flex-col gap-3 md:flex-row">
                <input
                  value={scanValue}
                  onChange={(e) => setScanValue(e.target.value)}
                  placeholder="Enter scanned tree_code or tree_id"
                  className="min-h-[50px] flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none placeholder:text-white/30"
                />
                <button
                  onClick={verifyTree}
                  className="rounded-2xl bg-[#d9b45f] px-6 py-4 text-sm font-black text-[#071f16]"
                >
                  Verify Tree
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm font-black">
                {isVerified ? (
                  <span className="text-emerald-300">Tree Verified</span>
                ) : (
                  <span className="text-red-200">Not verified — evidence blocked</span>
                )}
              </div>
            </Card>

            <Card title="4. Evidence Center">
              <p className="text-sm font-bold text-[#ffe49a]">{serviceLabel(selectedService)}</p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {(rules.photo || selectedService === "GPS_VERIFICATION" || selectedService === "HEALTH_CHECK") && (
                  <FileInput
                    label={rules.photo ? "Current Photo Required" : "Photo Optional"}
                    file={currentPhoto}
                    setFile={setCurrentPhoto}
                  />
                )}

                {rules.before && (
                  <FileInput label="Before Photo Required" file={beforePhoto} setFile={setBeforePhoto} />
                )}

                {rules.after && (
                  <FileInput label="After Photo Required" file={afterPhoto} setFile={setAfterPhoto} />
                )}

                {rules.gps && (
                  <>
                    <TextInput label="Latitude Required" value={latitude} setValue={setLatitude} />
                    <TextInput label="Longitude Required" value={longitude} setValue={setLongitude} />
                  </>
                )}

                {rules.health && (
                  <div>
                    <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-white/40">
                      Health Status Required
                    </p>
                    <select
                      value={healthStatus}
                      onChange={(e) => setHealthStatus(e.target.value)}
                      className="min-h-[50px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none"
                    >
                      <option value="">Select status</option>
                      <option value="HEALTHY">Healthy</option>
                      <option value="NEEDS_ATTENTION">Needs Attention</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                )}

                <div className="md:col-span-2">
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-white/40">
                    {rules.notesLabel}
                  </p>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-sm font-bold text-white outline-none placeholder:text-white/30"
                    placeholder="Field notes / observations"
                  />
                </div>
              </div>
            </Card>

            <Card title="5. Submit Work">
              <p className="text-sm font-semibold leading-relaxed text-white/60">
                Submit changes task, assignment, and customer operation request to SUBMITTED only.
                Admin must approve before this becomes COMPLETED.
              </p>

              <button
                onClick={submitWork}
                disabled={saving || !selected || !isVerified}
                className="mt-5 w-full rounded-2xl bg-emerald-500 px-6 py-4 text-sm font-black text-[#03130d] hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Submit Work for Admin Review
              </button>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
      <h2 className="mb-5 text-xl font-black text-[#ffe49a]">{title}</h2>
      {children}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#ffe49a]">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className="mt-2 break-words text-sm font-bold text-white/80">{value || "—"}</p>
    </div>
  );
}

function TextInput({
  label,
  value,
  setValue,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-white/40">{label}</p>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-h-[50px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none placeholder:text-white/30"
      />
    </div>
  );
}

function FileInput({
  label,
  file,
  setFile,
}: {
  label: string;
  file: File | null;
  setFile: (file: File | null) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-white/40">{label}</p>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm font-bold text-white file:mr-4 file:rounded-xl file:border-0 file:bg-[#d9b45f] file:px-4 file:py-2 file:font-black file:text-[#071f16]"
      />
      {file && <p className="mt-2 text-xs font-bold text-emerald-200">{file.name}</p>}
    </div>
  );
}