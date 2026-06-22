"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function GardenerHealthReportsPage() {
  const [caretaker, setCaretaker] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [healthStatus, setHealthStatus] = useState("HEALTHY");
  const [diseaseFound, setDiseaseFound] = useState(false);
  const [pestFound, setPestFound] = useState(false);
  const [issueNotes, setIssueNotes] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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

    setCaretaker(caretakerRow);

    const { data: assignmentRows, error: assignmentError } = await supabase
      .from("caretaker_assignments")
      .select("*")
      .eq("caretaker_id", caretakerRow.id)
      .order("created_at", { ascending: false });

    if (assignmentError) {
      setMessage(assignmentError.message);
      setLoading(false);
      return;
    }

    const { data: reportRows } = await supabase
      .from("tree_health_reports")
      .select("*")
      .eq("caretaker_id", caretakerRow.id)
      .order("created_at", { ascending: false });

    const rows = assignmentRows || [];

    setAssignments(rows);
    setReports(reportRows || []);
    setSelectedAssignmentId((current) => current || rows[0]?.id || "");
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedAssignment = useMemo(() => {
    return assignments.find((item) => item.id === selectedAssignmentId) || null;
  }, [assignments, selectedAssignmentId]);

  async function saveHealthReport() {
    setMessage("");

    if (!caretaker) return setMessage("Caretaker profile not found.");
    if (!selectedAssignment) return setMessage("Please select an assignment.");

    setSaving(true);

    const payload = {
      assignment_id: selectedAssignment.id,
      caretaker_id: caretaker.id,
      customer_profile_id: selectedAssignment.customer_profile_id || null,
      tree_id: selectedAssignment.tree_id || null,
      operation_request_id: selectedAssignment.operation_request_id || null,
      health_status: healthStatus,
      disease_found: diseaseFound,
      pest_found: pestFound,
      issue_notes: issueNotes.trim() || null,
      recommendation: recommendation.trim() || null,
      status: "SUBMITTED",
    };

    const { error } = await supabase.from("tree_health_reports").insert(payload);

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    await supabase.from("caretaker_task_logs").insert({
      assignment_id: selectedAssignment.id,
      caretaker_id: caretaker.id,
      customer_profile_id: selectedAssignment.customer_profile_id || null,
      tree_id: selectedAssignment.tree_id || null,
      operation_request_id: selectedAssignment.operation_request_id || null,
      task_type: "Health Report",
      notes: issueNotes.trim() || "Health report submitted by gardener.",
      status: "SUBMITTED",
    });

    setHealthStatus("HEALTHY");
    setDiseaseFound(false);
    setPestFound(false);
    setIssueNotes("");
    setRecommendation("");
    setSaving(false);
    setMessage("Health report submitted successfully.");
    await loadData();
  }

  return (
    <main style={{ padding: 30 }}>
      <p style={eyebrowStyle}>Arganwood Gardener Portal</p>
      <h1 style={{ margin: 0, fontSize: 42 }}>Health Reports</h1>
      <p style={{ maxWidth: 850, color: "#5f665e" }}>
        Submit tree condition reports, disease checks, pest checks, and recommendations.
      </p>

      {message && <div style={messageStyle}>{message}</div>}

      {loading ? (
        <div style={cardStyle}>Loading health reports...</div>
      ) : assignments.length === 0 ? (
        <div style={cardStyle}>No assigned jobs yet.</div>
      ) : (
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 24 }}>
          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Submit Health Report</h2>

            <label style={labelStyle}>Assignment</label>
            <select value={selectedAssignmentId} onChange={(e) => setSelectedAssignmentId(e.target.value)} style={inputStyle}>
              {assignments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.assignment_type || "Tree Assignment"} — {item.tree_id || "No tree"}
                </option>
              ))}
            </select>

            <label style={labelStyle}>Health Status</label>
            <select value={healthStatus} onChange={(e) => setHealthStatus(e.target.value)} style={inputStyle}>
              <option value="HEALTHY">HEALTHY</option>
              <option value="NEEDS_MONITORING">NEEDS MONITORING</option>
              <option value="TREATMENT_REQUIRED">TREATMENT REQUIRED</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>

            <label style={checkStyle}>
              <input type="checkbox" checked={diseaseFound} onChange={(e) => setDiseaseFound(e.target.checked)} />
              Disease found
            </label>

            <label style={checkStyle}>
              <input type="checkbox" checked={pestFound} onChange={(e) => setPestFound(e.target.checked)} />
              Pest found
            </label>

            <label style={labelStyle}>Issue Notes</label>
            <textarea value={issueNotes} onChange={(e) => setIssueNotes(e.target.value)} placeholder="Observed issues..." style={{ ...inputStyle, minHeight: 100 }} />

            <label style={labelStyle}>Recommendation</label>
            <textarea value={recommendation} onChange={(e) => setRecommendation(e.target.value)} placeholder="Recommended action..." style={{ ...inputStyle, minHeight: 100 }} />

            <button onClick={saveHealthReport} disabled={saving} style={buttonStyle}>
              {saving ? "Submitting..." : "Submit Health Report"}
            </button>
          </div>

          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Recent Health Reports</h2>

            {reports.length === 0 ? (
              <p style={{ color: "#5f665e" }}>No health reports submitted yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {reports.slice(0, 8).map((item) => (
                  <div key={item.id} style={rowStyle}>
                    <strong>{item.health_status || "Health Report"}</strong>
                    <p style={{ margin: "6px 0 0", color: "#5f665e" }}>Tree: {item.tree_id || "—"}</p>
                    <p style={{ margin: "4px 0 0", color: "#5f665e" }}>
                      Disease: {item.disease_found ? "YES" : "NO"} • Pest: {item.pest_found ? "YES" : "NO"}
                    </p>
                    <p style={{ margin: "4px 0 0", color: "#5f665e" }}>
                      Status: {item.status || "SUBMITTED"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

const cardStyle = {
  borderRadius: 24,
  background: "rgba(255,253,246,.9)",
  border: "1px solid rgba(92,70,35,.08)",
  boxShadow: "0 18px 42px rgba(82,60,27,.09)",
  padding: 22,
};

const messageStyle = {
  ...cardStyle,
  marginTop: 20,
  color: "#31553d",
  fontWeight: 900,
};

const eyebrowStyle = {
  margin: 0,
  color: "#8c6a3c",
  fontWeight: 900,
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: ".12em",
};

const labelStyle = {
  display: "block",
  marginTop: 14,
  marginBottom: 6,
  color: "#6b6b62",
  fontWeight: 900,
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: ".12em",
};

const checkStyle = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  marginTop: 14,
  color: "#10281f",
  fontWeight: 900,
};

const inputStyle = {
  width: "100%",
  border: "1px solid rgba(92,70,35,.14)",
  borderRadius: 14,
  padding: "13px 14px",
  background: "rgba(255,253,246,.94)",
  color: "#101a14",
  outline: "none",
  fontWeight: 800,
};

const buttonStyle = {
  width: "100%",
  marginTop: 18,
  border: 0,
  borderRadius: 16,
  padding: "14px",
  background: "#d9b45f",
  color: "#10281f",
  fontWeight: 900,
  cursor: "pointer",
};

const rowStyle = {
  borderRadius: 18,
  background: "#f3ead8",
  padding: 14,
};