"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AssignedTask = {
  assignment_id: string;
  operation_request_id: string;
  task_log_id?: string | null;
  caretaker_id: string;
  caretaker_profile_id?: string | null;
  tree_id: string;
  group_id?: string | null;
  tree_code?: string | null;
  tree_name?: string | null;
  forest_name?: string | null;
  customer_profile_id: string;
  customer_name?: string | null;
  customer_email?: string | null;
  request_type?: string | null;
  operation_type?: string | null;
  service_name?: string | null;
  admin_notes?: string | null;
  assignment_status?: string | null;
  task_status?: string | null;
  evidence_status?: string | null;
};

type EvidenceRule = {
  title: string;
  mainRequired: boolean;
  beforeRequired: boolean;
  afterRequired: boolean;
  notesRequired: boolean;
  helper: string;
};

const verifiedKey = (id: string) => `verified_tree_assignment_${id}`;
const oldVerifiedKey = (id: string) => `arganwood_tree_verified_assignment_${id}`;

function normalizeService(task: AssignedTask | null) {
  return String(task?.service_name || task?.request_type || task?.operation_type || "PHOTO_UPDATE")
    .trim()
    .toUpperCase()
    .replaceAll(" ", "_");
}

function getEvidenceRule(task: AssignedTask | null): EvidenceRule {
  const service = normalizeService(task);

  if (service === "PHOTO_UPDATE" || service === "PHOTO" || service === "TREE_PHOTO_UPDATE") {
    return {
      title: "Photo Update",
      mainRequired: true,
      beforeRequired: false,
      afterRequired: false,
      notesRequired: false,
      helper: "Current tree photo is required. Notes are optional.",
    };
  }

  if (service === "WATERING_SERVICE" || service === "WATERING") {
    return {
      title: "Watering Service Evidence",
      mainRequired: false,
      beforeRequired: true,
      afterRequired: true,
      notesRequired: true,
      helper: "Before photo, after photo, and notes are required.",
    };
  }

  if (
    ["FERTILIZER", "FERTILIZER_SERVICE", "FUNGICIDE", "INSECTICIDE", "PRUNING", "PEST_CONTROL"].includes(
      service
    )
  ) {
    return {
      title: "Care Service Evidence",
      mainRequired: false,
      beforeRequired: true,
      afterRequired: true,
      notesRequired: true,
      helper: "Before photo, after photo, and notes are required for this care service.",
    };
  }

  return {
    title: "Photo Evidence",
    mainRequired: true,
    beforeRequired: false,
    afterRequired: false,
    notesRequired: false,
    helper: "Current photo is required. Notes are optional.",
  };
}

export default function GardenerPhotoUpdatesPage() {
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [lockedTask, setLockedTask] = useState<AssignedTask | null>(null);

  const [qrValue, setQrValue] = useState("");
  const [qrError, setQrError] = useState("");
  const [success, setSuccess] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerRunning, setScannerRunning] = useState(false);
  const scannerRef = useRef<any>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);

  const [fallbackPhotoUrl, setFallbackPhotoUrl] = useState("");
  const [fallbackBeforeUrl, setFallbackBeforeUrl] = useState("");
  const [fallbackAfterUrl, setFallbackAfterUrl] = useState("");
  const [notes, setNotes] = useState("");

  const selectedTask = useMemo(
    () => tasks.find((t) => t.assignment_id === selectedAssignmentId) || null,
    [tasks, selectedAssignmentId]
  );

  const evidenceRule = useMemo(() => getEvidenceRule(lockedTask || selectedTask), [lockedTask, selectedTask]);

  function parseQr(raw: string) {
    const value = raw.trim();
    if (!value) return null;

    try {
      const url = new URL(value);
      const treeId = url.searchParams.get("tree_id") || url.searchParams.get("treeId") || url.searchParams.get("id");
      const treeCode = url.searchParams.get("tree_code") || url.searchParams.get("treeCode") || url.searchParams.get("code");
      const fallback = treeCode || treeId || value;

      return {
        tree_id: treeId || (fallback.length > 20 && fallback.includes("-") ? fallback : null),
        tree_code: treeCode || fallback,
      };
    } catch {
      return {
        tree_id: value.length > 20 && value.includes("-") ? value : null,
        tree_code: value,
      };
    }
  }

  function matchesTask(task: AssignedTask, parsed: { tree_id: string | null; tree_code: string | null }) {
    const scannedId = String(parsed.tree_id || "").trim().toLowerCase();
    const scannedCode = String(parsed.tree_code || "").trim().toLowerCase();
    const assignedTreeId = String(task.tree_id || "").trim().toLowerCase();
    const assignedTreeCode = String(task.tree_code || "").trim().toLowerCase();

    const byId = Boolean(scannedId && assignedTreeId && scannedId === assignedTreeId);
    const byCode = Boolean(scannedCode && assignedTreeCode && scannedCode === assignedTreeCode);

    return Boolean(byId || byCode);
  }

  async function stopCameraScanner() {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      }
    } catch (error) {
      console.warn("QR scanner stop skipped", error);
    } finally {
      scannerRef.current = null;
      setScannerRunning(false);
      setScannerOpen(false);
    }
  }

  async function saveQrAuditLog(task: AssignedTask, parsed: { tree_id: string | null; tree_code: string | null }) {
    try {
      await supabase.from("tree_verifications").insert({
        assignment_id: task.assignment_id,
        operation_request_id: task.operation_request_id,
        tree_id: task.tree_id,
        customer_profile_id: task.customer_profile_id,
        caretaker_id: task.caretaker_id,
        verified_tree_code: parsed.tree_code || task.tree_code || task.tree_id,
        verification_method: "QR_CAMERA",
        status: "VERIFIED",
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("Optional tree_verifications audit skipped", error);
    }
  }

  async function startCameraScanner() {
    setQrError("");
    setSuccess("");

    if (!selectedTask) {
      setQrError("Please select an assigned task first.");
      return;
    }

    try {
      setScannerOpen(true);
      setScannerRunning(true);
      const { Html5Qrcode } = await import("html5-qrcode");
      const scannerId = `photo-qr-scanner-${selectedTask.assignment_id}`;
      const scanner = new Html5Qrcode(scannerId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        async (decodedText: string) => {
          setQrValue(decodedText);
          const parsed = parseQr(decodedText);

          if (parsed && matchesTask(selectedTask, parsed)) {
            localStorage.setItem(verifiedKey(selectedTask.assignment_id), "true");
            localStorage.setItem(oldVerifiedKey(selectedTask.assignment_id), "VERIFIED");
            setLockedTask(selectedTask);
            setSuccess("Tree Verified. Evidence Center enabled.");
            await saveQrAuditLog(selectedTask, parsed);
            await stopCameraScanner();
          } else {
            setLockedTask(null);
            localStorage.removeItem(verifiedKey(selectedTask.assignment_id));
            localStorage.removeItem(oldVerifiedKey(selectedTask.assignment_id));
            setQrError("Wrong Tree / Tree mismatch. Evidence upload is blocked.");
          }
        },
        () => undefined
      );
    } catch (error: any) {
      setScannerRunning(false);
      setQrError(error?.message || "Unable to open camera scanner. Use manual fallback.");
    }
  }

  async function loadTasks() {
    setLoading(true);
    setQrError("");

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id,email,full_name")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id,email,full_name")
      .ilike("email", user.email || "")
      .maybeSingle();

    const profile = profileById || profileByEmail;

    if (!profile) {
      setLoading(false);
      return;
    }

    const { data: caretakerByProfile } = await supabase
      .from("caretakers")
      .select("*")
      .eq("caretaker_profile_id", profile.id)
      .maybeSingle();

    const { data: caretakerByEmail } = await supabase
      .from("caretakers")
      .select("*")
      .ilike("email", user.email || "")
      .maybeSingle();

    const caretaker = caretakerByProfile || caretakerByEmail;

    if (!caretaker) {
      setLoading(false);
      return;
    }

    const assignmentFilters = [
      `caretaker_id.eq.${caretaker.id}`,
      caretaker.caretaker_profile_id ? `caretaker_profile_id.eq.${caretaker.caretaker_profile_id}` : "",
    ].filter(Boolean);

    const { data: assignments, error: assignmentError } = await supabase
      .from("caretaker_assignments")
      .select("*")
      .or(assignmentFilters.join(","))
      .in("status", ["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "REWORK_REQUESTED"])
      .order("assigned_at", { ascending: false });

    if (assignmentError) {
      setQrError(assignmentError.message);
      setLoading(false);
      return;
    }

    const assignmentRows = assignments || [];
    const assignmentIds = assignmentRows.map((a: any) => a.id);
    const operationRequestIds = assignmentRows.map((a: any) => a.operation_request_id).filter(Boolean);
    const treeIds = assignmentRows.map((a: any) => a.tree_id).filter(Boolean);
    const customerIds = assignmentRows.map((a: any) => a.customer_profile_id).filter(Boolean);

    const { data: logs } = assignmentIds.length
      ? await supabase
          .from("caretaker_task_logs")
          .select("*")
          .in("assignment_id", assignmentIds)
      : { data: [] };

    const { data: requests } = operationRequestIds.length
      ? await supabase
          .from("tree_operation_requests")
          .select("*")
          .in("id", operationRequestIds)
      : { data: [] };

    const requestRows = requests || [];

    const mergedTreeIds = Array.from(
      new Set([...treeIds, ...requestRows.map((request: any) => request.tree_id).filter(Boolean)])
    );

    const mergedCustomerIds = Array.from(
      new Set([
        ...customerIds,
        ...requestRows.map((request: any) => request.customer_profile_id).filter(Boolean),
        ...requestRows.map((request: any) => request.profile_id).filter(Boolean),
      ])
    );

    const groupIds = Array.from(
      new Set([
        ...assignmentRows.map((assignment: any) => assignment.group_id).filter(Boolean),
        ...requestRows.map((request: any) => request.group_id).filter(Boolean),
      ])
    );

    const { data: treeRows } = mergedTreeIds.length
      ? await supabase.from("trees").select("*").in("id", mergedTreeIds)
      : { data: [] };

    const { data: groupRows } = groupIds.length
      ? await supabase.from("tree_groups").select("*").in("id", groupIds)
      : { data: [] };

    const { data: customerRows } = mergedCustomerIds.length
      ? await supabase.from("profiles").select("id,full_name,email").in("id", mergedCustomerIds)
      : { data: [] };

    const mapped: AssignedTask[] = assignmentRows.map((a: any) => {
      const log = (logs || []).find((l: any) => l.assignment_id === a.id);
      const request = (requestRows || []).find((r: any) => r.id === a.operation_request_id);
      const treeId = a.tree_id || request?.tree_id;
      const tree = (treeRows || []).find((t: any) => t.id === treeId);
      const groupId = a.group_id || request?.group_id || tree?.group_id;
      const group = (groupRows || []).find((g: any) => g.id === groupId);
      const customerProfileId =
        a.customer_profile_id ||
        request?.customer_profile_id ||
        request?.profile_id ||
        tree?.customer_profile_id ||
        tree?.profile_id;
      const customer = (customerRows || []).find((p: any) => p.id === customerProfileId);

      return {
        assignment_id: a.id,
        operation_request_id: a.operation_request_id || request?.id || "",
        task_log_id: log?.id || null,
        caretaker_id: caretaker.id,
        caretaker_profile_id: caretaker.caretaker_profile_id || null,
        tree_id: treeId || "",
        group_id: groupId || null,
        tree_code: tree?.tree_code || a.tree_code || request?.tree_code || null,
        tree_name: tree?.display_name || tree?.custom_name || tree?.name || a.tree_name || request?.tree_name || null,
        forest_name: group?.forest_name || group?.group_name || tree?.tree_group_name || null,
        customer_profile_id: customerProfileId || "",
        customer_name: customer?.full_name || "Customer",
        customer_email: customer?.email || "",
        request_type: request?.request_type || "",
        operation_type: request?.operation_type || "",
        service_name: request?.service_name || "",
        admin_notes: a.admin_notes || request?.admin_notes || log?.admin_notes || "",
        assignment_status: a.status,
        task_status: log?.status || "",
        evidence_status: log?.evidence_status || "PENDING",
      };
    });

    setTasks(mapped);

    const assignmentFromUrl = searchParams.get("assignment_id");
    if (assignmentFromUrl) {
      setSelectedAssignmentId(assignmentFromUrl);

      const found = mapped.find((t) => t.assignment_id === assignmentFromUrl);
      if (
        found &&
        (localStorage.getItem(verifiedKey(found.assignment_id)) === "true" ||
          localStorage.getItem(oldVerifiedKey(found.assignment_id)) === "VERIFIED")
      ) {
        setLockedTask(found);
        setSuccess("Tree Verified. Evidence Center enabled.");
      }
    }

    setLoading(false);
  }

  async function uploadWithFallback(file: File, folder: string) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;

    let bucket = "tree-evidence";
    let upload = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (upload.error) {
      bucket = "tree-photos";
      upload = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
    }

    if (upload.error) throw upload.error;

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function scanQr() {
    setQrError("");
    setSuccess("");

    if (!selectedTask) {
      setQrError("Please select an assigned task first.");
      return;
    }

    const parsed = parseQr(qrValue);
    if (!parsed || !matchesTask(selectedTask, parsed)) {
      setLockedTask(null);
      localStorage.removeItem(verifiedKey(selectedTask.assignment_id));
      localStorage.removeItem(oldVerifiedKey(selectedTask.assignment_id));
      setQrError("Scanned tree does not match this assigned task. Evidence upload is blocked.");
      return;
    }

    localStorage.setItem(verifiedKey(selectedTask.assignment_id), "true");
    localStorage.setItem(oldVerifiedKey(selectedTask.assignment_id), "VERIFIED");
    setLockedTask(selectedTask);
    setSuccess("Tree Verified. Evidence Center enabled.");
    await saveQrAuditLog(selectedTask, parsed);
  }

  function validateRequiredEvidence(rule: EvidenceRule, photoUrl: string, beforeUrl: string, afterUrl: string) {
    if (rule.mainRequired && !photoUrl) {
      throw new Error("Current photo is required for this service.");
    }

    if (rule.beforeRequired && !beforeUrl) {
      throw new Error("Before photo is required for this service.");
    }

    if (rule.afterRequired && !afterUrl) {
      throw new Error("After photo is required for this service.");
    }

    if (rule.notesRequired && !notes.trim()) {
      throw new Error("Notes are required for this service.");
    }

    if (!photoUrl && !beforeUrl && !afterUrl) {
      throw new Error("At least one photo is required.");
    }
  }

  async function submitPhotoEvidence() {
    setSubmitting(true);
    setQrError("");
    setSuccess("");

    try {
      if (!lockedTask) throw new Error("Tree must be verified before submitting evidence.");
      if (!lockedTask.assignment_id) throw new Error("Missing assignment_id.");
      if (!lockedTask.operation_request_id) throw new Error("Missing operation_request_id.");
      if (!lockedTask.tree_id) throw new Error("Missing tree_id.");
      if (!lockedTask.customer_profile_id) throw new Error("Missing customer_profile_id.");
      if (!lockedTask.caretaker_id) throw new Error("Missing caretaker_id.");

      let photoUrl = fallbackPhotoUrl.trim();
      let beforeUrl = fallbackBeforeUrl.trim();
      let afterUrl = fallbackAfterUrl.trim();

      if (photoFile) photoUrl = await uploadWithFallback(photoFile, `main/${lockedTask.tree_id}`);
      if (beforeFile) beforeUrl = await uploadWithFallback(beforeFile, `before/${lockedTask.tree_id}`);
      if (afterFile) afterUrl = await uploadWithFallback(afterFile, `after/${lockedTask.tree_id}`);

      const rule = getEvidenceRule(lockedTask);
      validateRequiredEvidence(rule, photoUrl, beforeUrl, afterUrl);

      const now = new Date().toISOString();

      const { error: insertError } = await supabase.from("tree_photo_updates").insert({
        assignment_id: lockedTask.assignment_id,
        operation_request_id: lockedTask.operation_request_id,
        tree_id: lockedTask.tree_id,
        customer_profile_id: lockedTask.customer_profile_id,
        caretaker_id: lockedTask.caretaker_id,
        photo_url: photoUrl || beforeUrl || afterUrl,
        before_photo_url: beforeUrl || null,
        after_photo_url: afterUrl || null,
        notes: notes.trim() || null,
        status: "SUBMITTED",
        created_at: now,
        updated_at: now,
      });

      if (insertError) throw insertError;

      const taskUpdate = {
        status: "SUBMITTED",
        evidence_status: "SUBMITTED",
        submitted_at: now,
        updated_at: now,
      };

      if (lockedTask.task_log_id) {
        const { error } = await supabase
          .from("caretaker_task_logs")
          .update(taskUpdate)
          .eq("id", lockedTask.task_log_id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("caretaker_task_logs").insert({
          assignment_id: lockedTask.assignment_id,
          operation_request_id: lockedTask.operation_request_id,
          tree_id: lockedTask.tree_id,
          group_id: lockedTask.group_id || null,
          customer_profile_id: lockedTask.customer_profile_id,
          caretaker_id: lockedTask.caretaker_id,
          caretaker_profile_id: lockedTask.caretaker_profile_id || null,
          task_type: normalizeService(lockedTask),
          source_type: normalizeService(lockedTask),
          notes: "Evidence submitted by gardener.",
          status: "SUBMITTED",
          evidence_status: "SUBMITTED",
          created_at: now,
          updated_at: now,
          submitted_at: now,
        });

        if (error) throw error;
      }

      const { error: assignmentError } = await supabase
        .from("caretaker_assignments")
        .update({
          status: "SUBMITTED",
          submitted_at: now,
          updated_at: now,
        })
        .eq("id", lockedTask.assignment_id);

      if (assignmentError) throw assignmentError;

      const { error: requestError } = await supabase
        .from("tree_operation_requests")
        .update({
          status: "SUBMITTED",
          assignment_status: "SUBMITTED",
          updated_at: now,
        })
        .eq("id", lockedTask.operation_request_id);

      if (requestError) throw requestError;

      await supabase
        .from("trees")
        .update({
          last_photo_update_at: now,
          updated_at: now,
        })
        .eq("id", lockedTask.tree_id);

      setSuccess("Evidence submitted for Admin Review. This is not marked COMPLETED until Admin approves.");
      setPhotoFile(null);
      setBeforeFile(null);
      setAfterFile(null);
      setFallbackPhotoUrl("");
      setFallbackBeforeUrl("");
      setFallbackAfterUrl("");
      setNotes("");
      await loadTasks();
    } catch (err: any) {
      setQrError(err.message || "Failed to submit evidence.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    loadTasks();

    return () => {
      stopCameraScanner();
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#06140f] p-6 text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(217,180,95,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.14),transparent_30%),linear-gradient(180deg,#082015,#03130d_48%,#010805)]" />

      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-7 shadow-2xl backdrop-blur-xl">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-[#d9b45f]">
            Gardener Field Workflow
          </p>
          <h1 className="mt-3 text-4xl font-black">Photo Updates / Evidence Center</h1>
          <p className="mt-3 max-w-3xl text-white/60">
            Verify the assigned tree first. Required evidence changes based on the requested service.
            Gardener submit sends the work to Admin Review only.
          </p>
        </section>

        {qrError && <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{qrError}</div>}
        {success && <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-200">{success}</div>}

        <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#d9b45f]">
            1. Work Queue
          </p>

          <label className="mt-4 block text-sm font-bold text-white/70">Assigned Task</label>
          <select
            value={selectedAssignmentId}
            disabled={!!lockedTask}
            onChange={(e) => setSelectedAssignmentId(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b2118] p-3 text-white"
          >
            <option value="">Select assigned tree task</option>
            {tasks.map((task) => (
              <option key={task.assignment_id} value={task.assignment_id}>
                {(task.tree_name || "Agarwood Tree")} • {task.tree_code || "No tree code"} • {task.customer_name} •{" "}
                {task.service_name || task.request_type || task.operation_type}
              </option>
            ))}
          </select>
        </section>

        {(selectedTask || lockedTask) && (
          <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#d9b45f]">
              2. Work Order
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Info label="Tree Name" value={(lockedTask || selectedTask)?.tree_name || "Agarwood Tree"} />
              <Info label="Tree Code" value={(lockedTask || selectedTask)?.tree_code || "—"} />
              <Info label="Forest / Group" value={(lockedTask || selectedTask)?.forest_name || "Single Tree"} />
              <Info label="Customer Name" value={(lockedTask || selectedTask)?.customer_name || "Customer"} />
              <Info label="Customer Email" value={(lockedTask || selectedTask)?.customer_email || "—"} />
              <Info
                label="Requested Service"
                value={
                  (lockedTask || selectedTask)?.service_name ||
                  (lockedTask || selectedTask)?.request_type ||
                  (lockedTask || selectedTask)?.operation_type ||
                  "—"
                }
              />
              <Info label="Assignment Status" value={(lockedTask || selectedTask)?.assignment_status || "—"} />
              <Info label="Evidence Status" value={(lockedTask || selectedTask)?.evidence_status || "PENDING"} />
              <Info label="Admin Notes" value={(lockedTask || selectedTask)?.admin_notes || "—"} />
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-[#d9b45f]/25 bg-[#d9b45f]/10 p-5 shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#ffe49a]">
            3. Scan Tree QR
          </p>
          <p className="mt-2 text-sm text-white/65">
            Scan or enter tree_code / tree_id. If it does not match the assigned task, evidence upload stays blocked.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto_auto]">
            <button
              onClick={scannerOpen ? stopCameraScanner : startCameraScanner}
              disabled={scannerRunning && !scannerOpen}
              className="rounded-xl bg-emerald-500 px-5 py-3 font-black text-black hover:bg-emerald-400 disabled:opacity-50"
            >
              {scannerOpen ? "Close Camera Scanner" : "Open Camera Scanner"}
            </button>
            <input
              value={qrValue}
              onChange={(e) => setQrValue(e.target.value)}
              placeholder="Manual Tree Code Fallback"
              className="rounded-xl border border-white/10 bg-black/30 p-3 text-white placeholder:text-white/40"
            />
            <button onClick={scanQr} className="rounded-xl bg-[#d9b45f] px-5 py-3 font-black text-black hover:bg-[#f7d774]">
              Verify Tree
            </button>
          </div>

          {scannerOpen && selectedTask && (
            <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-black/30 p-4">
              <div id={`photo-qr-scanner-${selectedTask.assignment_id}`} className="min-h-[280px] overflow-hidden rounded-xl" />
              <p className="mt-3 text-xs font-bold text-white/50">Point the camera at the physical tree QR sticker.</p>
            </div>
          )}
        </section>

        {lockedTask && (
          <section className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-5">
            <h2 className="text-xl font-black text-emerald-200">Tree Verified</h2>
            <p className="mt-1 text-sm text-emerald-100/80">
              Evidence Center is unlocked for this assignment.
            </p>
          </section>
        )}

        <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#d9b45f]">
            4. Evidence Center
          </p>
          <h2 className="mt-2 text-2xl font-black">{evidenceRule.title}</h2>
          <p className="mt-1 text-sm text-white/50">{evidenceRule.helper}</p>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <FileBox
              label={`Current Photo${evidenceRule.mainRequired ? " *" : ""}`}
              file={photoFile}
              setFile={setPhotoFile}
              disabled={!lockedTask}
            />
            <FileBox
              label={`Before Photo${evidenceRule.beforeRequired ? " *" : ""}`}
              file={beforeFile}
              setFile={setBeforeFile}
              disabled={!lockedTask}
            />
            <FileBox
              label={`After Photo${evidenceRule.afterRequired ? " *" : ""}`}
              file={afterFile}
              setFile={setAfterFile}
              disabled={!lockedTask}
            />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <input disabled={!lockedTask} value={fallbackPhotoUrl} onChange={(e) => setFallbackPhotoUrl(e.target.value)} placeholder="Fallback current photo URL" className="rounded-xl border border-white/10 bg-black/30 p-3 text-white disabled:opacity-40" />
            <input disabled={!lockedTask} value={fallbackBeforeUrl} onChange={(e) => setFallbackBeforeUrl(e.target.value)} placeholder="Fallback before photo URL" className="rounded-xl border border-white/10 bg-black/30 p-3 text-white disabled:opacity-40" />
            <input disabled={!lockedTask} value={fallbackAfterUrl} onChange={(e) => setFallbackAfterUrl(e.target.value)} placeholder="Fallback after photo URL" className="rounded-xl border border-white/10 bg-black/30 p-3 text-white disabled:opacity-40" />
          </div>

          <textarea
            disabled={!lockedTask}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={evidenceRule.notesRequired ? "Field notes required" : "Field notes optional"}
            className="mt-4 min-h-[120px] w-full rounded-xl border border-white/10 bg-black/30 p-3 text-white disabled:opacity-40"
          />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#d9b45f]">
            5. Submit Work
          </p>
          <p className="mt-2 text-sm text-white/60">
            Submit changes status to SUBMITTED only. Admin must approve before customer sees COMPLETED.
          </p>

          <button
            onClick={submitPhotoEvidence}
            disabled={submitting || !lockedTask}
            className="mt-5 rounded-xl bg-emerald-500 px-6 py-3 font-black text-black disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Evidence for Admin Review"}
          </button>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="mb-4 text-xl font-black">Assigned Tasks</h2>
          {loading ? (
            <p className="text-white/60">Loading...</p>
          ) : tasks.length === 0 ? (
            <p className="text-white/60">No assigned tasks.</p>
          ) : (
            <div className="grid gap-4">
              {tasks.map((task) => (
                <div key={task.assignment_id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black">{task.tree_name || "Agarwood Tree"}</h3>
                      <p className="text-sm text-amber-200">{task.tree_code || "No tree code"}</p>
                      <p className="text-sm text-white/60">{task.customer_name} • {task.customer_email}</p>
                    </div>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-sm">{task.assignment_status}</span>
                  </div>
                  <p className="mt-3 text-white/70">{task.service_name || task.request_type || task.operation_type || "Operation request"}</p>
                  <p className="mt-2 text-xs text-white/40">Evidence: {task.evidence_status || "PENDING"}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-widest text-white/40">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value || "—"}</p>
    </div>
  );
}

function FileBox({
  label,
  file,
  setFile,
  disabled,
}: {
  label: string;
  file: File | null;
  setFile: (file: File | null) => void;
  disabled?: boolean;
}) {
  return (
    <label className="rounded-2xl border border-dashed border-white/20 bg-black/20 p-4">
      <p className="font-bold">{label}</p>
      <input
        disabled={disabled}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="mt-3 w-full text-sm text-white/70 disabled:opacity-40"
      />
      {file && <p className="mt-2 truncate text-xs text-emerald-300">{file.name}</p>}
    </label>
  );
}