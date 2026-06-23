"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = Record<string, any>;
type Caretaker = Record<string, any>;
type Assignment = Record<string, any>;
type HealthReport = Record<string, any>;

const ACTIVE_ASSIGNMENT_STATUSES = ["ASSIGNED", "IN_PROGRESS", "STARTED"];

export default function GardenerHealthReportsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [caretaker, setCaretaker] = useState<Caretaker | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [reports, setReports] = useState<HealthReport[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [healthStatus, setHealthStatus] = useState("HEALTHY");
  const [diseaseFound, setDiseaseFound] = useState(false);
  const [pestFound, setPestFound] = useState(false);
  const [issueNotes, setIssueNotes] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const selectedAssignment = useMemo(() => {
    return assignments.find((item) => item.id === selectedAssignmentId) || null;
  }, [assignments, selectedAssignmentId]);

  async function resolveProfile() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/login";
      return null;
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

    return profileById || profileByEmail || null;
  }

  async function loadData() {
    setLoading(true);
    setMessage("");

    const profileRow = await resolveProfile();

    if (!profileRow) {
      setMessage("Profile not found.");
      setLoading(false);
      return;
    }

    setProfile(profileRow);

    const { data: caretakerRow, error: caretakerError } = await supabase
      .from("caretakers")
      .select("*")
      .eq("caretaker_profile_id", profileRow.id)
      .maybeSingle();

    if (caretakerError) {
      setMessage(caretakerError.message);
      setLoading(false);
      return;
    }

    if (!caretakerRow) {
      setMessage("Gardener profile not found.");
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
      .in("status", ACTIVE_ASSIGNMENT_STATUSES)
      .order("created_at", { ascending: false });

    if (assignmentError) {
      setMessage(assignmentError.message);
      setLoading(false);
      return;
    }

    const { data: reportRows, error: reportError } = await supabase
      .from("tree_health_reports")
      .select("*")
      .eq("caretaker_id", caretakerRow.id)
      .order("created_at", { ascending: false });

    if (reportError) {
      setMessage(reportError.message);
      setLoading(false);
      return;
    }

    const rows = assignmentRows || [];

    setAssignments(rows);
    setReports(reportRows || []);
    setSelectedAssignmentId((current) => current || rows[0]?.id || "");
    setLoading(false);
  }

  async function saveHealthReport() {
    setMessage("");

    if (!profile) {
      setMessage("Profile not found.");
      return;
    }

    if (!caretaker) {
      setMessage("Gardener profile not found.");
      return;
    }

    if (!selectedAssignment) {
      setMessage("Please select an active assignment.");
      return;
    }

    if (!selectedAssignment.operation_request_id) {
      setMessage("Missing operation request ID from assignment.");
      return;
    }

    if (!selectedAssignment.tree_id) {
      setMessage("Missing tree ID from assignment.");
      return;
    }

    if (!selectedAssignment.customer_profile_id) {
      setMessage("Missing customer profile ID from assignment.");
      return;
    }

    if (!selectedAssignment.caretaker_id) {
      setMessage("Missing caretaker ID from assignment.");
      return;
    }

    setSaving(true);

    const now = new Date().toISOString();

    const payload = {
      assignment_id: selectedAssignment.id,
      operation_request_id: selectedAssignment.operation_request_id,
      tree_id: selectedAssignment.tree_id,
      customer_profile_id: selectedAssignment.customer_profile_id,
      caretaker_id: selectedAssignment.caretaker_id,
      health_status: healthStatus,
      disease_found: diseaseFound,
      pest_found: pestFound,
      issue_notes: issueNotes.trim() || null,
      recommendation: recommendation.trim() || null,
      status: "SUBMITTED",
      created_at: now,
    };

    const { error: reportError } = await supabase
      .from("tree_health_reports")
      .insert(payload);

    if (reportError) {
      setMessage(reportError.message);
      setSaving(false);
      return;
    }

    const { error: treeError } = await supabase
      .from("trees")
      .update({
        last_health_report_at: now,
        last_health_status: healthStatus,
      })
      .eq("id", selectedAssignment.tree_id);

    if (treeError) {
      setMessage(treeError.message);
      setSaving(false);
      return;
    }

    setHealthStatus("HEALTHY");
    setDiseaseFound(false);
    setPestFound(false);
    setIssueNotes("");
    setRecommendation("");
    setSaving(false);
    setMessage("Health report submitted and synced to customer tree health records.");
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
    <main className="min-h-screen bg-[#06150f] p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8 rounded-3xl border border-white/10 bg-[#071f16]/90 p-8 shadow-2xl backdrop-blur-md">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
            Arganwood Gardener Portal
          </p>

          <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
            Health Reports
          </h1>

          <p className="mt-2 text-white/70">
            Submit verified tree health evidence from active assigned tasks.
          </p>
        </div>

        {message && (
          <div className="rounded-2xl border border-[#d9b45f]/20 bg-[#d9b45f]/10 p-4 text-sm font-semibold text-[#ffe8a3]">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-white/70">
            Loading health reports...
          </div>
        ) : assignments.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-white/70">
            No active assigned health tasks yet.
          </div>
        ) : (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-2xl font-bold text-[#ffe49a]">
                Submit Health Report
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
                    {item.assignment_type || "Tree Assignment"} —{" "}
                    {item.tree_id || "Tree"}
                  </option>
                ))}
              </select>

              <label className="mt-4 block text-sm font-bold text-white/70">
                Health Status
              </label>

              <select
                value={healthStatus}
                onChange={(e) => setHealthStatus(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#071f16] px-4 py-3 text-white outline-none"
              >
                <option value="HEALTHY">HEALTHY</option>
                <option value="NEEDS_MONITORING">NEEDS MONITORING</option>
                <option value="TREATMENT_REQUIRED">TREATMENT REQUIRED</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>

              <label className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 p-4 font-bold text-white/80">
                <input
                  type="checkbox"
                  checked={diseaseFound}
                  onChange={(e) => setDiseaseFound(e.target.checked)}
                />
                Disease Found
              </label>

              <label className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 p-4 font-bold text-white/80">
                <input
                  type="checkbox"
                  checked={pestFound}
                  onChange={(e) => setPestFound(e.target.checked)}
                />
                Pest Found
              </label>

              <label className="mt-4 block text-sm font-bold text-white/70">
                Issue Notes
              </label>

              <textarea
                value={issueNotes}
                onChange={(e) => setIssueNotes(e.target.value)}
                placeholder="Observed issues..."
                className="mt-2 min-h-[120px] w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
              />

              <label className="mt-4 block text-sm font-bold text-white/70">
                Recommendation
              </label>

              <textarea
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                placeholder="Recommended action..."
                className="mt-2 min-h-[120px] w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
              />

              <button
                onClick={saveHealthReport}
                disabled={saving}
                className="mt-5 w-full rounded-xl bg-[#d9b45f] px-5 py-3 font-black text-[#071f16] disabled:opacity-50"
              >
                {saving ? "Submitting..." : "Submit Health Report"}
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-2xl font-bold text-[#ffe49a]">
                Recent Health Reports
              </h2>

              {reports.length === 0 ? (
                <p className="mt-5 text-white/70">
                  No health reports submitted yet.
                </p>
              ) : (
                <div className="mt-5 space-y-4">
                  {reports.slice(0, 10).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <h3 className="font-bold text-white">
                        {item.health_status || "Health Report"}
                      </h3>

                      <p className="mt-1 text-sm text-white/60">
                        Tree: {item.tree_id || "—"}
                      </p>

                      <p className="mt-1 text-sm text-white/60">
                        Disease: {item.disease_found ? "YES" : "NO"} • Pest:{" "}
                        {item.pest_found ? "YES" : "NO"}
                      </p>

                      <p className="mt-1 text-sm text-white/60">
                        Status: {item.status || "SUBMITTED"}
                      </p>

                      <p className="mt-1 text-sm text-white/60">
                        Date: {formatDate(item.created_at)}
                      </p>

                      {item.issue_notes && (
                        <p className="mt-3 rounded-xl bg-white/10 p-3 text-sm text-white/70">
                          Issue: {item.issue_notes}
                        </p>
                      )}

                      {item.recommendation && (
                        <p className="mt-3 rounded-xl bg-white/10 p-3 text-sm text-white/70">
                          Recommendation: {item.recommendation}
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