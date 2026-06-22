"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Assignment = Record<string, any>;
type ConcernReport = Record<string, any>;

export default function GardenerConcernsPage() {
  const [caretaker, setCaretaker] = useState<any>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [concerns, setConcerns] = useState<ConcernReport[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [concernType, setConcernType] = useState("TREE_CONDITION");
  const [priority, setPriority] = useState("NORMAL");
  const [description, setDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
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

    const { data: concernRows, error: concernError } = await supabase
      .from("caretaker_concern_reports")
      .select("*")
      .eq("caretaker_id", caretakerRow.id)
      .order("created_at", { ascending: false });

    if (concernError) {
      setMessage(concernError.message);
      setLoading(false);
      return;
    }

    const rows = assignmentRows || [];

    setAssignments(rows);
    setConcerns(concernRows || []);
    setSelectedAssignmentId((current) => current || rows[0]?.id || "");
    setLoading(false);
  }

  const selectedAssignment = useMemo(() => {
    return assignments.find((item) => item.id === selectedAssignmentId) || null;
  }, [assignments, selectedAssignmentId]);

  async function saveConcernReport() {
    setMessage("");

    if (!caretaker) {
      setMessage("Caretaker profile not found.");
      return;
    }

    if (!selectedAssignment) {
      setMessage("Please select an assignment.");
      return;
    }

    if (!description.trim()) {
      setMessage("Concern description is required.");
      return;
    }

    setSaving(true);

    const payload = {
      assignment_id: selectedAssignment.id,
      caretaker_id: caretaker.id,
      customer_profile_id: selectedAssignment.customer_profile_id || null,
      tree_id: selectedAssignment.tree_id || null,
      operation_request_id: selectedAssignment.operation_request_id || null,
      concern_type: concernType,
      priority,
      description: description.trim(),
      photo_url: photoUrl.trim() || null,
      status: "OPEN",
    };

    const { error: concernError } = await supabase
      .from("caretaker_concern_reports")
      .insert(payload);

    if (concernError) {
      setMessage(concernError.message);
      setSaving(false);
      return;
    }

    const { error: taskError } = await supabase.from("caretaker_task_logs").insert({
      assignment_id: selectedAssignment.id,
      caretaker_id: caretaker.id,
      customer_profile_id: selectedAssignment.customer_profile_id || null,
      tree_id: selectedAssignment.tree_id || null,
      operation_request_id: selectedAssignment.operation_request_id || null,
      task_type: "Concern Report",
      notes: description.trim(),
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

    setConcernType("TREE_CONDITION");
    setPriority("NORMAL");
    setDescription("");
    setPhotoUrl("");
    setSaving(false);
    setMessage("Concern report submitted and synced to Admin Operations.");
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

  function badgeClass(status: string | null | undefined) {
    const value = String(status || "OPEN").toUpperCase();

    if (value === "RESOLVED" || value === "CLOSED") {
      return "border-emerald-400/30 bg-emerald-500/20 text-emerald-200";
    }

    if (value === "URGENT" || value === "HIGH") {
      return "border-red-400/30 bg-red-500/20 text-red-200";
    }

    return "border-yellow-400/30 bg-yellow-500/20 text-yellow-200";
  }

  return (
    <main className="min-h-screen p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8 rounded-3xl border border-white/10 bg-[#071f16]/80 p-8 shadow-2xl backdrop-blur-md">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
            Arganwood Gardener Portal
          </p>

          <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
            Concern Reports
          </h1>

          <p className="mt-2 text-white/70">
            Report field concerns, urgent tree issues, site access problems, pest alerts, and caretaker notes.
          </p>
        </div>

        {message && (
          <div className="rounded-2xl border border-[#d9b45f]/20 bg-[#d9b45f]/10 p-4 text-sm font-semibold text-[#ffe8a3]">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-white/70">
            Loading concern reports...
          </div>
        ) : assignments.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-white/70">
            No assigned jobs yet.
          </div>
        ) : (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-2xl font-bold text-[#ffe49a]">
                Submit Concern Report
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
                Concern Type
              </label>

              <select
                value={concernType}
                onChange={(e) => setConcernType(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#071f16] px-4 py-3 text-white outline-none"
              >
                <option value="TREE_CONDITION">TREE CONDITION</option>
                <option value="PEST_ALERT">PEST ALERT</option>
                <option value="DISEASE_ALERT">DISEASE ALERT</option>
                <option value="SITE_ACCESS">SITE ACCESS</option>
                <option value="SECURITY">SECURITY</option>
                <option value="CUSTOMER_REQUEST">CUSTOMER REQUEST</option>
                <option value="OTHER">OTHER</option>
              </select>

              <label className="mt-4 block text-sm font-bold text-white/70">
                Priority
              </label>

              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#071f16] px-4 py-3 text-white outline-none"
              >
                <option value="LOW">LOW</option>
                <option value="NORMAL">NORMAL</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>

              <label className="mt-4 block text-sm font-bold text-white/70">
                Description
              </label>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the concern..."
                className="mt-2 min-h-[150px] w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
              />

              <label className="mt-4 block text-sm font-bold text-white/70">
                Photo URL Optional
              </label>

              <input
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://..."
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
              />

              <button
                onClick={saveConcernReport}
                disabled={saving}
                className="mt-5 w-full rounded-xl bg-[#d9b45f] px-5 py-3 font-black text-[#071f16] disabled:opacity-50"
              >
                {saving ? "Submitting..." : "Submit Concern Report"}
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-2xl font-bold text-[#ffe49a]">
                Recent Concerns
              </h2>

              {concerns.length === 0 ? (
                <p className="mt-5 text-white/70">No concern reports submitted yet.</p>
              ) : (
                <div className="mt-5 space-y-4">
                  {concerns.slice(0, 10).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-white">
                          {item.concern_type || "Concern Report"}
                        </h3>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(
                            item.priority
                          )}`}
                        >
                          {item.priority || "NORMAL"}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(
                            item.status
                          )}`}
                        >
                          {item.status || "OPEN"}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-white/60">
                        Tree: {item.tree_id || "—"}
                      </p>

                      <p className="mt-1 text-sm text-white/60">
                        Date: {formatDate(item.created_at)}
                      </p>

                      <p className="mt-3 rounded-xl bg-white/10 p-3 text-sm text-white/70">
                        {item.description || "No description."}
                      </p>

                      {item.photo_url && (
                        <a
                          href={item.photo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-block rounded-xl bg-[#d9b45f] px-4 py-2 text-sm font-black text-[#071f16]"
                        >
                          Open Photo
                        </a>
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