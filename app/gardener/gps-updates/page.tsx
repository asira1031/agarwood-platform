"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Assignment = Record<string, any>;
type GpsLog = Record<string, any>;

export default function GardenerGpsUpdatesPage() {
  const [caretaker, setCaretaker] = useState<any>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [gpsLogs, setGpsLogs] = useState<GpsLog[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [accuracyMeters, setAccuracyMeters] = useState("");
  const [gpsNote, setGpsNote] = useState("");
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
      .in("status", ["ASSIGNED", "IN_PROGRESS", "SUBMITTED"])
      .order("started_at", { ascending: false });

    if (assignmentError) {
      setMessage(assignmentError.message);
      setLoading(false);
      return;
    }

    const { data: gpsRows, error: gpsError } = await supabase
      .from("tree_gps_logs")
      .select("*")
      .eq("caretaker_id", caretakerRow.id)
      .order("created_at", { ascending: false });

    if (gpsError) {
      setMessage(gpsError.message);
      setLoading(false);
      return;
    }

    const rows = assignmentRows || [];

    setAssignments(rows);
    setGpsLogs(gpsRows || []);
    setSelectedAssignmentId((current) => current || rows[0]?.id || "");
    setLoading(false);
  }

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

    if (!caretaker?.id) {
      setMessage("Caretaker profile not found.");
      return;
    }

    if (!selectedAssignment?.id) {
      setMessage("Please select a valid assignment.");
      return;
    }

    if (!selectedAssignment.operation_request_id) {
      setMessage("Missing operation request link.");
      return;
    }

    if (!selectedAssignment.tree_id) {
      setMessage("Missing tree link.");
      return;
    }

    if (!selectedAssignment.customer_profile_id) {
      setMessage("Missing customer profile link.");
      return;
    }

    if (!latitude.trim() || !longitude.trim()) {
      setMessage("Latitude and longitude are required.");
      return;
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    const accuracy = accuracyMeters ? Number(accuracyMeters) : null;

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setMessage("Latitude and longitude must be valid numbers.");
      return;
    }

    if (accuracyMeters && Number.isNaN(accuracy)) {
      setMessage("Accuracy must be a valid number.");
      return;
    }

    setSaving(true);

    const gpsPayload = {
      assignment_id: selectedAssignment.id,
      operation_request_id: selectedAssignment.operation_request_id,
      tree_id: selectedAssignment.tree_id,
      customer_profile_id: selectedAssignment.customer_profile_id,
      caretaker_id: caretaker.id,
      latitude: lat,
      longitude: lng,
      accuracy_meters: accuracy,
      gps_note: gpsNote.trim() || null,
      status: "SUBMITTED",
    };

    const { error: gpsError } = await supabase
      .from("tree_gps_logs")
      .insert(gpsPayload);

    if (gpsError) {
      setMessage(gpsError.message);
      setSaving(false);
      return;
    }

    const { error: treeError } = await supabase
      .from("trees")
      .update({
        last_gps_update_at: new Date().toISOString(),
      })
      .eq("id", selectedAssignment.tree_id);

    if (treeError) {
      setMessage(treeError.message);
      setSaving(false);
      return;
    }

    setLatitude("");
    setLongitude("");
    setAccuracyMeters("");
    setGpsNote("");
    setSaving(false);
    setMessage("GPS update submitted.");
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

  function mapUrl(item: GpsLog) {
    if (!item.latitude || !item.longitude) return "";
    return `https://www.google.com/maps?q=${item.latitude},${item.longitude}`;
  }

  return (
    <main className="min-h-screen p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8 rounded-3xl border border-white/10 bg-[#071f16]/80 p-8 shadow-2xl backdrop-blur-md">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
            Arganwood Gardener Portal
          </p>

          <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
            GPS Updates
          </h1>

          <p className="mt-2 text-white/70">
            Submit verified GPS coordinates for assigned tree operations.
          </p>
        </div>

        {message && (
          <div className="rounded-2xl border border-[#d9b45f]/20 bg-[#d9b45f]/10 p-4 text-sm font-semibold text-[#ffe8a3]">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-white/70">
            Loading GPS updates...
          </div>
        ) : assignments.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-white/70">
            No active assigned jobs yet.
          </div>
        ) : (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-2xl font-bold text-[#ffe49a]">
                Submit GPS Verification
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

              <button
                onClick={useCurrentLocation}
                className="mt-4 w-full rounded-xl border border-[#d9b45f]/30 bg-[#d9b45f]/10 px-5 py-3 font-bold text-[#f7d774]"
              >
                Use Current GPS Location
              </button>

              <label className="mt-4 block text-sm font-bold text-white/70">
                Latitude
              </label>
              <input
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="Example: 14.5995"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
              />

              <label className="mt-4 block text-sm font-bold text-white/70">
                Longitude
              </label>
              <input
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="Example: 120.9842"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
              />

              <label className="mt-4 block text-sm font-bold text-white/70">
                Accuracy Meters
              </label>
              <input
                value={accuracyMeters}
                onChange={(e) => setAccuracyMeters(e.target.value)}
                placeholder="Example: 15"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
              />

              <label className="mt-4 block text-sm font-bold text-white/70">
                GPS Note
              </label>
              <textarea
                value={gpsNote}
                onChange={(e) => setGpsNote(e.target.value)}
                placeholder="Field GPS notes..."
                className="mt-2 min-h-[120px] w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
              />

              <button
                onClick={saveGpsUpdate}
                disabled={saving}
                className="mt-5 w-full rounded-xl bg-[#d9b45f] px-5 py-3 font-black text-[#071f16] disabled:opacity-50"
              >
                {saving ? "Submitting..." : "Submit GPS Update"}
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-2xl font-bold text-[#ffe49a]">
                Recent GPS Logs
              </h2>

              {gpsLogs.length === 0 ? (
                <p className="mt-5 text-white/70">No GPS logs submitted yet.</p>
              ) : (
                <div className="mt-5 space-y-4">
                  {gpsLogs.slice(0, 10).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-white">
                            GPS Verification
                          </h3>

                          <p className="mt-1 text-sm text-white/60">
                            Tree: {item.tree_id || "—"}
                          </p>

                          <p className="mt-1 text-sm text-white/60">
                            Latitude: {item.latitude || "—"}
                          </p>

                          <p className="mt-1 text-sm text-white/60">
                            Longitude: {item.longitude || "—"}
                          </p>

                          <p className="mt-1 text-sm text-white/60">
                            Accuracy: {item.accuracy_meters || "—"} meters
                          </p>

                          <p className="mt-1 text-sm text-white/60">
                            Status: {item.status || "SUBMITTED"}
                          </p>

                          <p className="mt-1 text-sm text-white/60">
                            Date: {formatDate(item.created_at)}
                          </p>
                        </div>

                        {mapUrl(item) && (
                          <a
                            href={mapUrl(item)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl bg-[#d9b45f] px-4 py-2 text-sm font-black text-[#071f16]"
                          >
                            Map
                          </a>
                        )}
                      </div>

                      {(item.gps_note || item.notes) && (
                        <p className="mt-3 rounded-xl bg-white/10 p-3 text-sm text-white/70">
                          {item.gps_note || item.notes}
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