"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const ACTIVE_ASSIGNMENT_STATUSES = ["ASSIGNED", "IN_PROGRESS", "ACTIVE"];
const ACTIVE_TASK_STATUSES = ["ASSIGNED", "IN_PROGRESS", "ACTIVE"];

export default function GardenerPhotoUpdatesPage() {
  const [caretaker, setCaretaker] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [photoUpdates, setPhotoUpdates] = useState<any[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [beforePhotoUrl, setBeforePhotoUrl] = useState("");
  const [afterPhotoUrl, setAfterPhotoUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    const profile = profileById || profileByEmail;

    const { data: caretakerRow, error: caretakerError } = await supabase
      .from("caretakers")
      .select("*")
      .or(`email.eq.${email},caretaker_profile_id.eq.${profile?.id || user.id}`)
      .maybeSingle();

    if (caretakerError) {
      setMessage(caretakerError.message);
      setLoading(false);
      return;
    }

    if (!caretakerRow) {
      setMessage("Caretaker profile not found.");
      setLoading(false);
      return;
    }

    if (String(caretakerRow.status || "").toUpperCase() !== "ACTIVE") {
      setMessage("Your gardener account is not ACTIVE.");
      setLoading(false);
      return;
    }

    setCaretaker(caretakerRow);

    const { data: assignmentRows, error: assignmentError } = await supabase
      .from("caretaker_assignments")
      .select("*")
      .eq("caretaker_id", caretakerRow.id)
      .in("status", ACTIVE_ASSIGNMENT_STATUSES);

    if (assignmentError) {
      setMessage(assignmentError.message);
      setLoading(false);
      return;
    }

    const assignmentIds = (assignmentRows || []).map((item) => item.id);

    const { data: taskRows, error: taskError } = assignmentIds.length
      ? await supabase
          .from("caretaker_task_logs")
          .select("*")
          .in("assignment_id", assignmentIds)
          .in("status", ACTIVE_TASK_STATUSES)
      : { data: [], error: null };

    if (taskError) {
      setMessage(taskError.message);
      setLoading(false);
      return;
    }

    const taskMap = new Map(
      (taskRows || []).map((task) => [task.assignment_id, task])
    );

    const activeAssignments = (assignmentRows || [])
      .filter((assignment) => taskMap.has(assignment.id))
      .map((assignment) => ({
        ...assignment,
        active_task: taskMap.get(assignment.id),
      }));

    const { data: photoRows, error: photoError } = await supabase
      .from("tree_photo_updates")
      .select("*")
      .eq("caretaker_id", caretakerRow.id)
      .order("created_at", { ascending: false });

    if (photoError) {
      setMessage(photoError.message);
      setLoading(false);
      return;
    }

    setAssignments(activeAssignments);
    setPhotoUpdates(photoRows || []);
    setSelectedAssignmentId((current) => current || activeAssignments[0]?.id || "");
    setLoading(false);
  }

  const selectedAssignment = useMemo(() => {
    return assignments.find((item) => item.id === selectedAssignmentId) || null;
  }, [assignments, selectedAssignmentId]);

  async function savePhotoUpdate() {
    setMessage("");

    if (!caretaker) {
      setMessage("Caretaker profile not found.");
      return;
    }

    if (!selectedAssignment) {
      setMessage("Please select an active assignment.");
      return;
    }

    if (!photoUrl.trim() && !beforePhotoUrl.trim() && !afterPhotoUrl.trim()) {
      setMessage("Please enter at least one photo URL.");
      return;
    }

    setSaving(true);

    const { data: freshAssignment, error: freshAssignmentError } = await supabase
      .from("caretaker_assignments")
      .select("*")
      .eq("id", selectedAssignment.id)
      .eq("caretaker_id", caretaker.id)
      .in("status", ACTIVE_ASSIGNMENT_STATUSES)
      .maybeSingle();

    if (freshAssignmentError || !freshAssignment) {
      setMessage("Active assignment not found or no longer available.");
      setSaving(false);
      return;
    }

    const { data: activeTask, error: taskError } = await supabase
      .from("caretaker_task_logs")
      .select("*")
      .eq("assignment_id", freshAssignment.id)
      .eq("caretaker_id", caretaker.id)
      .in("status", ACTIVE_TASK_STATUSES)
      .limit(1)
      .maybeSingle();

    if (taskError || !activeTask) {
      setMessage("Active task not found for this assignment.");
      setSaving(false);
      return;
    }

    const operationRequestId =
      freshAssignment.operation_request_id || activeTask.operation_request_id;

    const treeId = freshAssignment.tree_id || activeTask.tree_id;
    const customerProfileId =
      freshAssignment.customer_profile_id || activeTask.customer_profile_id;

    if (!operationRequestId || !treeId || !customerProfileId) {
      setMessage("Assignment is missing required sync data.");
      setSaving(false);
      return;
    }

    if (
      activeTask.operation_request_id &&
      activeTask.operation_request_id !== operationRequestId
    ) {
      setMessage("Task operation request does not match assignment.");
      setSaving(false);
      return;
    }

    if (activeTask.tree_id && activeTask.tree_id !== treeId) {
      setMessage("Task tree does not match assignment.");
      setSaving(false);
      return;
    }

    if (
      activeTask.customer_profile_id &&
      activeTask.customer_profile_id !== customerProfileId
    ) {
      setMessage("Task customer does not match assignment.");
      setSaving(false);
      return;
    }

    const finalPhotoUrl =
      photoUrl.trim() || afterPhotoUrl.trim() || beforePhotoUrl.trim();

    const payload = {
      assignment_id: freshAssignment.id,
      operation_request_id: operationRequestId,
      tree_id: treeId,
      customer_profile_id: customerProfileId,
      caretaker_id: caretaker.id,
      photo_url: finalPhotoUrl,
      before_photo_url: beforePhotoUrl.trim() || null,
      after_photo_url: afterPhotoUrl.trim() || null,
      caption: caption.trim() || "Tree photo update",
      notes: notes.trim() || null,
      status: "SUBMITTED",
    };

    const { error: photoError } = await supabase
      .from("tree_photo_updates")
      .insert(payload);

    if (photoError) {
      setMessage(photoError.message);
      setSaving(false);
      return;
    }

    const { error: treeError } = await supabase
      .from("trees")
      .update({ last_photo_update_at: new Date().toISOString() })
      .eq("id", treeId);

    if (treeError) {
      setMessage(treeError.message);
      setSaving(false);
      return;
    }

    setPhotoUrl("");
    setBeforePhotoUrl("");
    setAfterPhotoUrl("");
    setCaption("");
    setNotes("");
    setSaving(false);
    setMessage("Photo evidence submitted successfully.");
    await loadData();
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

  return (
    <main className="min-h-screen bg-[#04140f] p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8 rounded-3xl border border-white/10 bg-[#071f16]/80 p-8 shadow-2xl backdrop-blur-md">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
            Arganwood Gardener Portal
          </p>

          <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
            Photo Evidence
          </h1>

          <p className="mt-2 text-white/70">
            Submit photo evidence only for active assigned tree tasks.
          </p>
        </div>

        {message && (
          <div className="rounded-2xl border border-[#d9b45f]/20 bg-[#d9b45f]/10 p-4 text-sm font-semibold text-[#ffe8a3]">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-white/70">
            Loading photo evidence...
          </div>
        ) : assignments.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-white/70">
            No active photo evidence tasks yet.
          </div>
        ) : (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-2xl font-bold text-[#ffe49a]">
                Submit Photo Evidence
              </h2>

              <label className="mt-5 block text-sm font-bold text-white/70">
                Active Assignment
              </label>
              <select
                value={selectedAssignmentId}
                onChange={(e) => setSelectedAssignmentId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#071f16] px-4 py-3 text-white outline-none"
              >
                {assignments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.assignment_type || "Tree Assignment"} — Tree{" "}
                    {item.tree_id || "linked"}
                  </option>
                ))}
              </select>

              <label className="mt-4 block text-sm font-bold text-white/70">
                Main Photo URL
              </label>
              <input
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://..."
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
              />

              <label className="mt-4 block text-sm font-bold text-white/70">
                Before Photo URL
              </label>
              <input
                value={beforePhotoUrl}
                onChange={(e) => setBeforePhotoUrl(e.target.value)}
                placeholder="https://..."
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
              />

              <label className="mt-4 block text-sm font-bold text-white/70">
                After Photo URL
              </label>
              <input
                value={afterPhotoUrl}
                onChange={(e) => setAfterPhotoUrl(e.target.value)}
                placeholder="https://..."
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
              />

              <label className="mt-4 block text-sm font-bold text-white/70">
                Caption
              </label>
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Example: Weekly growth photo"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
              />

              <label className="mt-4 block text-sm font-bold text-white/70">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Field notes..."
                className="mt-2 min-h-[120px] w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
              />

              <button
                onClick={savePhotoUpdate}
                disabled={saving}
                className="mt-5 w-full rounded-xl bg-[#d9b45f] px-5 py-3 font-black text-[#071f16] disabled:opacity-50"
              >
                {saving ? "Submitting..." : "Submit Photo Evidence"}
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-2xl font-bold text-[#ffe49a]">
                Recent Photo Evidence
              </h2>

              {photoUpdates.length === 0 ? (
                <p className="mt-5 text-white/70">
                  No photo evidence submitted yet.
                </p>
              ) : (
                <div className="mt-5 space-y-4">
                  {photoUpdates.slice(0, 10).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-white">
                            {item.caption || "Tree Photo Evidence"}
                          </h3>
                          <p className="mt-1 text-sm text-white/60">
                            Status: {item.status || "SUBMITTED"}
                          </p>
                          <p className="mt-1 text-sm text-white/60">
                            Date: {formatDate(item.created_at)}
                          </p>
                        </div>

                        {item.photo_url && (
                          <a
                            href={item.photo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl bg-[#d9b45f] px-4 py-2 text-sm font-black text-[#071f16]"
                          >
                            Open
                          </a>
                        )}
                      </div>

                      {item.notes && (
                        <p className="mt-3 rounded-xl bg-white/10 p-3 text-sm text-white/70">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}