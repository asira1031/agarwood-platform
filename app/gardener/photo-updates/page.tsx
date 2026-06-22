"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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

    const { data: caretakerRow, error: caretakerError } = await supabase
      .from("caretakers")
      .select("*")
      .eq("email", email)
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
      .order("started_at", { ascending: false });

    if (assignmentError) {
      setMessage(assignmentError.message);
      setLoading(false);
      return;
    }

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

    const rows = assignmentRows || [];

    setAssignments(rows);
    setPhotoUpdates(photoRows || []);
    setSelectedAssignmentId((current) => current || rows[0]?.id || "");
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
      setMessage("Please select an assignment.");
      return;
    }

    if (!photoUrl.trim() && !beforePhotoUrl.trim() && !afterPhotoUrl.trim()) {
      setMessage("Please enter at least one photo URL.");
      return;
    }

    setSaving(true);

    const finalPhotoUrl =
      photoUrl.trim() || afterPhotoUrl.trim() || beforePhotoUrl.trim();

    const payload = {
      assignment_id: selectedAssignment.id,
      caretaker_id: caretaker.id,
      customer_profile_id: selectedAssignment.customer_profile_id || null,
      tree_id: selectedAssignment.tree_id || null,
      operation_request_id: selectedAssignment.operation_request_id || null,
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

    const { error: taskError } = await supabase.from("caretaker_task_logs").insert({
      assignment_id: selectedAssignment.id,
      caretaker_id: caretaker.id,
      customer_profile_id: selectedAssignment.customer_profile_id || null,
      tree_id: selectedAssignment.tree_id || null,
      operation_request_id: selectedAssignment.operation_request_id || null,
      task_type: "Photo Update",
      notes: notes.trim() || "Photo update submitted by gardener.",
      status: "SUBMITTED",
    });

    if (taskError) {
      setMessage(taskError.message);
      setSaving(false);
      return;
    }

    await supabase
      .from("caretaker_assignments")
      .update({ status: "IN_PROGRESS" })
      .eq("id", selectedAssignment.id);

    if (selectedAssignment.operation_request_id) {
      await supabase
        .from("tree_operation_requests")
        .update({ status: "IN_PROGRESS" })
        .eq("id", selectedAssignment.operation_request_id);
    }

    setPhotoUrl("");
    setBeforePhotoUrl("");
    setAfterPhotoUrl("");
    setCaption("");
    setNotes("");
    setSaving(false);
    setMessage("Photo update submitted and synced to Admin Operations.");
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
    <main className="min-h-screen p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8 rounded-3xl border border-white/10 bg-[#071f16]/80 p-8 shadow-2xl backdrop-blur-md">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
            Arganwood Gardener Portal
          </p>

          <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
            Photo Updates
          </h1>

          <p className="mt-2 text-white/70">
            Submit tree photos for assigned jobs. Updates are saved to tree_photo_updates and synced to Admin Operations.
          </p>
        </div>

        {message && (
          <div className="rounded-2xl border border-[#d9b45f]/20 bg-[#d9b45f]/10 p-4 text-sm font-semibold text-[#ffe8a3]">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-white/70">
            Loading photo updates...
          </div>
        ) : assignments.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-white/70">
            No assigned jobs yet.
          </div>
        ) : (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-2xl font-bold text-[#ffe49a]">
                Submit Photo Update
              </h2>

              <label className="mt-5 block text-sm font-bold text-white/70">
                Assignment
              </label>
              <select
                value={selectedAssignmentId}
                onChange={(e) => setSelectedAssignmentId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#071f16] px-4 py-3 text-white outline-none"
              >
                {assignments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.assignment_type || "Tree Assignment"} —{" "}
                    {item.tree_id || "No tree"}
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
                {saving ? "Submitting..." : "Submit Photo Update"}
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-2xl font-bold text-[#ffe49a]">
                Recent Photo Updates
              </h2>

              {photoUpdates.length === 0 ? (
                <p className="mt-5 text-white/70">No photo updates submitted yet.</p>
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
                            {item.caption || "Tree Photo Update"}
                          </h3>
                          <p className="mt-1 text-sm text-white/60">
                            Tree: {item.tree_id || "—"}
                          </p>
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