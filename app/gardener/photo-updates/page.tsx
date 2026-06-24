"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type AssignedTask = {
  assignment_id: string;
  operation_request_id: string;
  task_log_id?: string | null;
  caretaker_id: string;
  tree_id: string;
  tree_code?: string | null;
  tree_name?: string | null;
  customer_profile_id: string;
  customer_name?: string | null;
  customer_email?: string | null;
  request_type?: string | null;
  operation_type?: string | null;
  service_name?: string | null;
  assignment_status?: string | null;
  task_status?: string | null;
  evidence_status?: string | null;
};

const verifiedKey = (id: string) => `verified_tree_assignment_${id}`;

export default function GardenerPhotoUpdatesPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [lockedTask, setLockedTask] = useState<AssignedTask | null>(null);

  const [qrValue, setQrValue] = useState("");
  const [qrError, setQrError] = useState("");
  const [success, setSuccess] = useState("");

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

  function parseQr(raw: string) {
    const value = raw.trim();
    if (!value) return null;

    try {
      const url = new URL(value);
      return {
        tree_id: url.searchParams.get("tree_id"),
        tree_code: url.searchParams.get("tree_code"),
      };
    } catch {
      return {
        tree_id: value.length > 20 && value.includes("-") ? value : null,
        tree_code: value,
      };
    }
  }

  function matchesTask(task: AssignedTask, parsed: { tree_id: string | null; tree_code: string | null }) {
    const byId = parsed.tree_id && parsed.tree_id === task.tree_id;
    const byCode = parsed.tree_code && task.tree_code && parsed.tree_code.toLowerCase() === task.tree_code.toLowerCase();
    return Boolean(byId || byCode);
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

    const { data: profileById } = await supabase.from("profiles").select("id,email,full_name").eq("id", user.id).maybeSingle();
    const { data: profileByEmail } = await supabase.from("profiles").select("id,email,full_name").ilike("email", user.email || "").maybeSingle();
    const profile = profileById || profileByEmail;

    if (!profile) {
      setLoading(false);
      return;
    }

    const { data: caretaker } = await supabase.from("caretakers").select("id,caretaker_profile_id").eq("caretaker_profile_id", profile.id).maybeSingle();

    if (!caretaker) {
      setLoading(false);
      return;
    }

    const { data: assignments } = await supabase
      .from("caretaker_assignments")
      .select(`
        id,status,tree_id,customer_profile_id,operation_request_id,
        trees:tree_id(id,tree_code,name),
        profiles:customer_profile_id(id,full_name,email),
        tree_operation_requests:operation_request_id(id,request_type,service_name,operation_type,status,assignment_status)
      `)
      .eq("caretaker_id", caretaker.id)
      .in("status", ["ASSIGNED", "IN_PROGRESS", "SUBMITTED"])
      .order("assigned_at", { ascending: false });

    const assignmentIds = (assignments || []).map((a: any) => a.id);

    const { data: logs } = assignmentIds.length
      ? await supabase
          .from("caretaker_task_logs")
          .select("id,assignment_id,operation_request_id,status,evidence_status")
          .in("assignment_id", assignmentIds)
      : { data: [] };

    const mapped: AssignedTask[] = (assignments || []).map((a: any) => {
      const log = (logs || []).find((l: any) => l.assignment_id === a.id);

      return {
        assignment_id: a.id,
        operation_request_id: a.operation_request_id,
        task_log_id: log?.id || null,
        caretaker_id: caretaker.id,
        tree_id: a.tree_id,
        tree_code: a.trees?.tree_code || null,
        tree_name: a.trees?.name || null,
        customer_profile_id: a.customer_profile_id,
        customer_name: a.profiles?.full_name || "Customer",
        customer_email: a.profiles?.email || "",
        request_type: a.tree_operation_requests?.request_type || "",
        operation_type: a.tree_operation_requests?.operation_type || "",
        service_name: a.tree_operation_requests?.service_name || "",
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
      if (found && localStorage.getItem(verifiedKey(found.assignment_id)) === "true") {
        setLockedTask(found);
        setSuccess("✓ Tree Verified");
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

  function scanQr() {
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
      setQrError("Scanned tree does not match this assigned task.");
      return;
    }

    localStorage.setItem(verifiedKey(selectedTask.assignment_id), "true");
    setLockedTask(selectedTask);
    setSuccess("✓ Tree Verified");
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

      if (!photoUrl && !beforeUrl && !afterUrl) {
        throw new Error("At least one photo is required.");
      }

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
        notes: notes || null,
        status: "SUBMITTED",
        created_at: now,
        updated_at: now,
      });

      if (insertError) throw insertError;

      if (lockedTask.task_log_id) {
        await supabase
          .from("caretaker_task_logs")
          .update({
            status: "SUBMITTED",
            evidence_status: "SUBMITTED",
            submitted_at: now,
            updated_at: now,
          })
          .eq("id", lockedTask.task_log_id);
      } else {
        await supabase
          .from("caretaker_task_logs")
          .update({
            status: "SUBMITTED",
            evidence_status: "SUBMITTED",
            submitted_at: now,
            updated_at: now,
          })
          .eq("assignment_id", lockedTask.assignment_id);
      }

      await supabase
        .from("caretaker_assignments")
        .update({
          status: "SUBMITTED",
          submitted_at: now,
          updated_at: now,
        })
        .eq("id", lockedTask.assignment_id);

      await supabase
        .from("tree_operation_requests")
        .update({
          status: "SUBMITTED",
          assignment_status: "SUBMITTED",
          updated_at: now,
        })
        .eq("id", lockedTask.operation_request_id);

      await supabase
        .from("trees")
        .update({
          last_photo_update_at: now,
          updated_at: now,
        })
        .eq("id", lockedTask.tree_id);

      setSuccess("Photo evidence submitted for admin review.");
      setPhotoFile(null);
      setBeforeFile(null);
      setAfterFile(null);
      setFallbackPhotoUrl("");
      setFallbackBeforeUrl("");
      setFallbackAfterUrl("");
      setNotes("");
      await loadTasks();
    } catch (err: any) {
      setQrError(err.message || "Failed to submit photo evidence.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  return (
    <main className="min-h-screen bg-[#06140f] p-6 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-amber-300">Tree Field Verification</p>
          <h1 className="text-3xl font-bold">Scan Tree QR & Photo Evidence</h1>
          <p className="text-white/60">Verify the physical tree before submitting any evidence.</p>
        </div>

        {qrError && <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{qrError}</div>}
        {success && <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-200">{success}</div>}

        <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl">
          <h2 className="text-xl font-semibold">🌳 Scan Tree QR</h2>

          <label className="mt-4 block text-sm text-white/70">Assigned Task</label>
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

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
            <input
              value={qrValue}
              onChange={(e) => setQrValue(e.target.value)}
              placeholder="Scan or enter tree QR code"
              className="rounded-xl border border-white/10 bg-black/30 p-3 text-white placeholder:text-white/40"
            />
            <button onClick={scanQr} className="rounded-xl bg-amber-400 px-5 py-3 font-semibold text-black hover:bg-amber-300">
              Verify Tree
            </button>
          </div>
        </section>

        {lockedTask && (
          <section className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-5">
            <h2 className="text-xl font-semibold text-emerald-200">✓ Tree Verified</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Info label="Tree Name" value={lockedTask.tree_name || "Agarwood Tree"} />
              <Info label="Tree Code" value={lockedTask.tree_code || "—"} />
              <Info label="Customer Name" value={lockedTask.customer_name || "Customer"} />
              <Info label="Customer Email" value={lockedTask.customer_email || "—"} />
              <Info label="Service Requested" value={lockedTask.service_name || lockedTask.request_type || lockedTask.operation_type || "—"} />
              <Info label="Assignment ID" value={lockedTask.assignment_id} small />
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
          <h2 className="text-xl font-semibold">Upload Photo Evidence</h2>
          <p className="mt-1 text-sm text-white/50">Enabled only after Tree Verified.</p>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <FileBox label="Main Photo" file={photoFile} setFile={setPhotoFile} disabled={!lockedTask} />
            <FileBox label="Before Photo" file={beforeFile} setFile={setBeforeFile} disabled={!lockedTask} />
            <FileBox label="After Photo" file={afterFile} setFile={setAfterFile} disabled={!lockedTask} />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <input disabled={!lockedTask} value={fallbackPhotoUrl} onChange={(e) => setFallbackPhotoUrl(e.target.value)} placeholder="Fallback main photo URL" className="rounded-xl border border-white/10 bg-black/30 p-3 text-white disabled:opacity-40" />
            <input disabled={!lockedTask} value={fallbackBeforeUrl} onChange={(e) => setFallbackBeforeUrl(e.target.value)} placeholder="Fallback before photo URL" className="rounded-xl border border-white/10 bg-black/30 p-3 text-white disabled:opacity-40" />
            <input disabled={!lockedTask} value={fallbackAfterUrl} onChange={(e) => setFallbackAfterUrl(e.target.value)} placeholder="Fallback after photo URL" className="rounded-xl border border-white/10 bg-black/30 p-3 text-white disabled:opacity-40" />
          </div>

          <textarea
            disabled={!lockedTask}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Field notes"
            className="mt-4 min-h-[110px] w-full rounded-xl border border-white/10 bg-black/30 p-3 text-white disabled:opacity-40"
          />

          <button
            onClick={submitPhotoEvidence}
            disabled={submitting || !lockedTask}
            className="mt-5 rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-black disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Photo Evidence"}
          </button>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="mb-4 text-xl font-semibold">Assigned Tasks</h2>
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
                      <h3 className="text-lg font-semibold">{task.tree_name || "Agarwood Tree"}</h3>
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

function Info({ label, value, small = false }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-widest text-white/40">{label}</p>
      <p className={small ? "break-all text-xs text-white/70" : "text-white"}>{value}</p>
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
      <p className="font-medium">{label}</p>
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