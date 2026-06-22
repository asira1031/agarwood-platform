"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function GardenerGpsUpdatesPage() {
  const [caretaker, setCaretaker] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [gpsLogs, setGpsLogs] = useState<any[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [accuracyMeters, setAccuracyMeters] = useState("");
  const [gpsNote, setGpsNote] = useState("");
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

    const { data: gpsRows } = await supabase
      .from("tree_gps_logs")
      .select("*")
      .eq("caretaker_id", caretakerRow.id)
      .order("created_at", { ascending: false });

    const rows = assignmentRows || [];

    setAssignments(rows);
    setGpsLogs(gpsRows || []);
    setSelectedAssignmentId((current) => current || rows[0]?.id || "");
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedAssignment = useMemo(() => {
    return assignments.find((item) => item.id === selectedAssignmentId) || null;
  }, [assignments, selectedAssignmentId]);

  function useCurrentLocation() {
    setMessage("");

    if (!navigator.geolocation) {
      setMessage("GPS is not supported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(String(position.coords.latitude));
        setLongitude(String(position.coords.longitude));
        setAccuracyMeters(String(Math.round(position.coords.accuracy)));
        setMessage("Current GPS location captured.");
      },
      () => {
        setMessage("Unable to capture GPS location. You may enter it manually.");
      }
    );
  }

  async function saveGpsUpdate() {
    setMessage("");

    if (!caretaker) return setMessage("Caretaker profile not found.");
    if (!selectedAssignment) return setMessage("Please select an assignment.");
    if (!latitude.trim() || !longitude.trim()) {
      return setMessage("Latitude and longitude are required.");
    }

    setSaving(true);

    const payload = {
      assignment_id: selectedAssignment.id,
      caretaker_id: caretaker.id,
      customer_profile_id: selectedAssignment.customer_profile_id || null,
      tree_id: selectedAssignment.tree_id || null,
      operation_request_id: selectedAssignment.operation_request_id || null,
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy_meters: accuracyMeters ? Number(accuracyMeters) : null,
      gps_note: gpsNote.trim() || null,
      status: "SUBMITTED",
    };

    const { error } = await supabase.from("tree_gps_logs").insert(payload);

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
      task_type: "GPS Verification",
      notes: gpsNote.trim() || "GPS verification submitted by gardener.",
      status: "SUBMITTED",
    });

    setLatitude("");
    setLongitude("");
    setAccuracyMeters("");
    setGpsNote("");
    setSaving(false);
    setMessage("GPS update submitted successfully.");
    await loadData();
  }

  return (
    <main style={{ padding: 30 }}>
      <p style={eyebrowStyle}>Arganwood Gardener Portal</p>
      <h1 style={{ margin: 0, fontSize: 42 }}>GPS Updates</h1>
      <p style={{ maxWidth: 850, color: "#5f665e" }}>
        Submit verified GPS coordinates for assigned tree operations.
      </p>

      {message && <div style={messageStyle}>{message}</div>}

      {loading ? (
        <div style={cardStyle}>Loading GPS updates...</div>
      ) : assignments.length === 0 ? (
        <div style={cardStyle}>No assigned jobs yet.</div>
      ) : (
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 24 }}>
          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Submit GPS Verification</h2>

            <label style={labelStyle}>Assignment</label>
            <select value={selectedAssignmentId} onChange={(e) => setSelectedAssignmentId(e.target.value)} style={inputStyle}>
              {assignments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.assignment_type || "Tree Assignment"} — {item.tree_id || "No tree"}
                </option>
              ))}
            </select>

            <button onClick={useCurrentLocation} style={buttonStyle}>
              Use Current GPS Location
            </button>

            <label style={labelStyle}>Latitude</label>
            <input value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="Example: 14.5995" style={inputStyle} />

            <label style={labelStyle}>Longitude</label>
            <input value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="Example: 120.9842" style={inputStyle} />

            <label style={labelStyle}>Accuracy Meters</label>
            <input value={accuracyMeters} onChange={(e) => setAccuracyMeters(e.target.value)} placeholder="Example: 15" style={inputStyle} />

            <label style={labelStyle}>GPS Note</label>
            <textarea value={gpsNote} onChange={(e) => setGpsNote(e.target.value)} placeholder="Field GPS notes..." style={{ ...inputStyle, minHeight: 100 }} />

            <button onClick={saveGpsUpdate} disabled={saving} style={buttonStyle}>
              {saving ? "Submitting..." : "Submit GPS Update"}
            </button>
          </div>

          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Recent GPS Logs</h2>

            {gpsLogs.length === 0 ? (
              <p style={{ color: "#5f665e" }}>No GPS logs submitted yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {gpsLogs.slice(0, 8).map((item) => (
                  <div key={item.id} style={rowStyle}>
                    <strong>GPS Verification</strong>
                    <p style={{ margin: "6px 0 0", color: "#5f665e" }}>Tree: {item.tree_id || "—"}</p>
                    <p style={{ margin: "4px 0 0", color: "#5f665e" }}>
                      {item.latitude}, {item.longitude}
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