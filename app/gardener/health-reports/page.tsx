"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Row = Record<string, any>;

const ACTIVE_STATUSES = ["ASSIGNED", "IN_PROGRESS", "STARTED", "SUBMITTED"];

export default function GardenerHealthReportsPage() {
  const [profile, setProfile] = useState<Row | null>(null);
  const [caretaker, setCaretaker] = useState<Row | null>(null);
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [reports, setReports] = useState<Row[]>([]);
  const [trees, setTrees] = useState<Row[]>([]);
  const [operations, setOperations] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);

  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [scannedCode, setScannedCode] = useState("");
  const [treeVerified, setTreeVerified] = useState(false);

  const [healthStatus, setHealthStatus] = useState("HEALTHY");
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const selectedAssignment = useMemo(
    () => assignments.find((item) => item.id === selectedAssignmentId) || null,
    [assignments, selectedAssignmentId]
  );

  const selectedTree = useMemo(
    () => trees.find((item) => item.id === selectedAssignment?.tree_id) || null,
    [trees, selectedAssignment]
  );

  const selectedOperation = useMemo(
    () =>
      operations.find(
        (item) => item.id === selectedAssignment?.operation_request_id
      ) || null,
    [operations, selectedAssignment]
  );

  const selectedCustomer = useMemo(
    () =>
      customers.find(
        (item) => item.id === selectedAssignment?.customer_profile_id
      ) || null,
    [customers, selectedAssignment]
  );

  async function resolveProfile() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      window.location.href = "/login";
      return null;
    }

    const email = user.email?.trim().toLowerCase() || "";

    const { data: byId } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    const { data: byEmail } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    return byId || byEmail || null;
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

    let { data: caretakerRow, error: caretakerError } = await supabase
      .from("caretakers")
      .select("*")
      .eq("caretaker_profile_id", profileRow.id)
      .maybeSingle();

    if (!caretakerRow && profileRow.email) {
      const fallback = await supabase
        .from("caretakers")
        .select("*")
        .eq("email", String(profileRow.email).toLowerCase())
        .maybeSingle();

      caretakerRow = fallback.data;
      caretakerError = fallback.error;
    }

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
      .in("status", ACTIVE_STATUSES)
      .order("created_at", { ascending: false });

    if (assignmentError) {
      setMessage(assignmentError.message);
      setLoading(false);
      return;
    }

    const rows = assignmentRows || [];
    const treeIds = [...new Set(rows.map((item) => item.tree_id).filter(Boolean))];
    const operationIds = [
      ...new Set(rows.map((item) => item.operation_request_id).filter(Boolean)),
    ];
    const customerIds = [
      ...new Set(rows.map((item) => item.customer_profile_id).filter(Boolean)),
    ];

    const [{ data: treeRows }, { data: operationRows }, { data: customerRows }] =
      await Promise.all([
        treeIds.length
          ? supabase.from("trees").select("*").in("id", treeIds)
          : Promise.resolve({ data: [] }),
        operationIds.length
          ? supabase.from("tree_operation_requests").select("*").in("id", operationIds)
          : Promise.resolve({ data: [] }),
        customerIds.length
          ? supabase.from("profiles").select("id, full_name, email").in("id", customerIds)
          : Promise.resolve({ data: [] }),
      ]);

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

    setAssignments(rows);
    setTrees(treeRows || []);
    setOperations(operationRows || []);
    setCustomers(customerRows || []);
    setReports(reportRows || []);
    setSelectedAssignmentId((current) => current || rows[0]?.id || "");
    setTreeVerified(false);
    setScannedCode("");
    setLoading(false);
  }

  function verifyTreeCode() {
    setMessage("");
    setTreeVerified(false);

    if (!selectedAssignment || !selectedTree) {
      setMessage("Select a valid assignment first.");
      return;
    }

    const input = scannedCode.trim().toLowerCase();
    const treeId = String(selectedAssignment.tree_id || "").toLowerCase();
    const treeCode = String(selectedTree.tree_code || "").toLowerCase();

    if (!input) {
      setMessage("Scan or enter the assigned tree QR code first.");
      return;
    }

    if (input === treeId || input === treeCode) {
      setTreeVerified(true);
      setMessage("Tree Verified. You may submit health evidence.");
      return;
    }

    setMessage("Tree mismatch. Evidence blocked for this assignment.");
  }

  async function uploadEvidencePhoto(file: File, assignmentId: string) {
    if (!caretaker) throw new Error("Caretaker profile not found.");
    if (!profile) throw new Error("Profile not found.");

    const ext = file.name.split(".").pop() || "jpg";
    const ownerProfileId =
      caretaker.caretaker_profile_id || profile.id || caretaker.id;

    if (!ownerProfileId) {
      throw new Error("Storage owner profile id not found.");
    }

    const filePath = `${ownerProfileId}/health/${assignmentId}/${Date.now()}.${ext}`;

    const upload = await supabase.storage
      .from("tree-evidence")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (upload.error) throw upload.error;

    const { data } = supabase.storage
      .from("tree-evidence")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function syncSubmitted(now: string) {
    if (!selectedAssignment) throw new Error("Missing assignment.");

    const { error: logError } = await supabase
      .from("caretaker_task_logs")
      .update({
        status: "SUBMITTED",
        evidence_status: "SUBMITTED",
        updated_at: now,
      })
      .eq("assignment_id", selectedAssignment.id);

    if (logError) throw logError;

    const { error: assignmentError } = await supabase
      .from("caretaker_assignments")
      .update({ status: "SUBMITTED" })
      .eq("id", selectedAssignment.id);

    if (assignmentError) throw assignmentError;

    const { error: operationError } = await supabase
      .from("tree_operation_requests")
      .update({
        status: "SUBMITTED",
        assignment_status: "SUBMITTED",
        updated_at: now,
      })
      .eq("id", selectedAssignment.operation_request_id);

    if (operationError) throw operationError;
  }

  async function submitHealthEvidence() {
    setMessage("");

    if (!profile || !caretaker || !selectedAssignment) {
      setMessage("Missing gardener assignment context.");
      return;
    }

    if (!selectedAssignment.id) return setMessage("Missing assignment_id.");
    if (!selectedAssignment.operation_request_id)
      return setMessage("Missing operation_request_id.");
    if (!selectedAssignment.tree_id) return setMessage("Missing tree_id.");
    if (!selectedAssignment.customer_profile_id)
      return setMessage("Missing customer_profile_id.");
    if (!selectedAssignment.caretaker_id) return setMessage("Missing caretaker_id.");
    if (!treeVerified) return setMessage("Verify the assigned tree QR before submitting.");
    if (!healthStatus.trim()) return setMessage("Health status is required.");
    if (!notes.trim()) return setMessage("Notes are required for health check.");

    setSaving(true);

    try {
      const now = new Date().toISOString();
      let photoUrl: string | null = null;

      if (photoFile) {
        photoUrl = await uploadEvidencePhoto(photoFile, selectedAssignment.id);
      }

      const { error: healthError } = await supabase
        .from("tree_health_reports")
        .insert({
          assignment_id: selectedAssignment.id,
          operation_request_id: selectedAssignment.operation_request_id,
          tree_id: selectedAssignment.tree_id,
          customer_profile_id: selectedAssignment.customer_profile_id,
          caretaker_id: selectedAssignment.caretaker_id,
          health_status: healthStatus,
          notes: notes.trim(),
          status: "SUBMITTED",
          created_at: now,
          updated_at: now,
        });

      if (healthError) throw healthError;

      if (photoUrl) {
        const { error: photoError } = await supabase.from("tree_photo_updates").insert({
          assignment_id: selectedAssignment.id,
          operation_request_id: selectedAssignment.operation_request_id,
          tree_id: selectedAssignment.tree_id,
          customer_profile_id: selectedAssignment.customer_profile_id,
          caretaker_id: selectedAssignment.caretaker_id,
          photo_url: photoUrl,
          before_photo_url: null,
          after_photo_url: null,
          notes: `Health check photo: ${notes.trim()}`,
          status: "SUBMITTED",
          created_at: now,
          updated_at: now,
        });

        if (photoError) throw photoError;
      }

      await syncSubmitted(now);

      setHealthStatus("HEALTHY");
      setNotes("");
      setPhotoFile(null);
      setTreeVerified(false);
      setScannedCode("");
      setMessage("Health evidence submitted for admin review.");
      await loadData();
    } catch (error: any) {
      setMessage(error.message || "Health evidence submission failed.");
    } finally {
      setSaving(false);
    }
  }

  function formatDate(value?: string) {
    if (!value) return "—";
    return new Date(value).toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function displayTree(item: Row | null) {
    return item?.tree_name || item?.name || item?.tree_code || "Assigned Tree";
  }

  return (
    <main className="min-h-screen bg-[#06150f] p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-[#071f16]/90 p-8 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
            Gardener Field Workflow
          </p>
          <h1 className="mt-2 text-4xl font-black text-[#d9b45f]">
            Health Reports
          </h1>
          <p className="mt-2 text-white/70">
            Verify the assigned tree first, then submit health evidence for admin review.
          </p>
        </header>

        {message && (
          <div className="rounded-2xl border border-[#d9b45f]/20 bg-[#d9b45f]/10 p-4 font-semibold text-[#ffe8a3]">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/10 p-8 text-white/70">
            Loading health workflow...
          </div>
        ) : assignments.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/10 p-8 text-white/70">
            No active health assignments yet.
          </div>
        ) : (
          <section className="grid gap-6 lg:grid-cols-5">
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
              <h2 className="text-xl font-black text-[#ffe49a]">Work Queue</h2>
              {["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "COMPLETED"].map((status) => (
                <div key={status} className="mt-4 rounded-2xl bg-black/20 p-4">
                  <p className="text-sm text-white/60">{status.replace("_", " ")}</p>
                  <p className="text-3xl font-black text-white">
                    {
                      assignments.filter(
                        (item) => String(item.status || "").toUpperCase() === status
                      ).length
                    }
                  </p>
                </div>
              ))}
            </div>

            <div className="space-y-6 lg:col-span-4">
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
                <h2 className="text-2xl font-black text-[#ffe49a]">Work Order</h2>

                <select
                  value={selectedAssignmentId}
                  onChange={(e) => {
                    setSelectedAssignmentId(e.target.value);
                    setTreeVerified(false);
                    setScannedCode("");
                  }}
                  className="mt-4 w-full rounded-xl border border-white/10 bg-[#071f16] px-4 py-3 text-white"
                >
                  {assignments.map((item) => {
                    const tree = trees.find((treeItem) => treeItem.id === item.tree_id);
                    const operation = operations.find(
                      (op) => op.id === item.operation_request_id
                    );

                    return (
                      <option key={item.id} value={item.id}>
                        {tree?.tree_name || tree?.name || tree?.tree_code || "Tree"} —{" "}
                        {operation?.service_name ||
                          operation?.operation_type ||
                          "Health Check"}
                      </option>
                    );
                  })}
                </select>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Info label="Tree" value={displayTree(selectedTree)} />
                  <Info label="Tree Code" value={selectedTree?.tree_code || "—"} />
                  <Info
                    label="Forest / Group"
                    value={
                      selectedTree?.forest_name ||
                      selectedTree?.group_name ||
                      selectedOperation?.group_id ||
                      "—"
                    }
                  />
                  <Info
                    label="Customer"
                    value={
                      selectedCustomer
                        ? `${selectedCustomer.full_name || "Customer"} • ${
                            selectedCustomer.email || "No email"
                          }`
                        : "—"
                    }
                  />
                  <Info
                    label="Requested Service"
                    value={
                      selectedOperation?.service_name ||
                      selectedOperation?.operation_type ||
                      "HEALTH_CHECK"
                    }
                  />
                  <Info
                    label="Admin Notes"
                    value={selectedOperation?.admin_notes || selectedAssignment?.admin_notes || "—"}
                  />
                  <Info label="Assignment Status" value={selectedAssignment?.status || "—"} />
                  <Info
                    label="Evidence Status"
                    value={selectedAssignment?.evidence_status || selectedOperation?.status || "—"}
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
                <h2 className="text-2xl font-black text-[#ffe49a]">Scan Tree QR</h2>
                <p className="mt-2 text-sm text-white/60">
                  Scan or manually enter the assigned tree_code or tree_id.
                </p>

                <div className="mt-4 flex flex-col gap-3 md:flex-row">
                  <input
                    value={scannedCode}
                    onChange={(e) => setScannedCode(e.target.value)}
                    placeholder="Enter scanned tree_code or tree_id"
                    className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none"
                  />
                  <button
                    onClick={verifyTreeCode}
                    className="rounded-xl bg-[#d9b45f] px-6 py-3 font-black text-[#071f16]"
                  >
                    Verify Tree
                  </button>
                </div>

                <div
                  className={`mt-4 rounded-2xl p-4 font-bold ${
                    treeVerified
                      ? "border border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                      : "border border-red-400/20 bg-red-400/10 text-red-200"
                  }`}
                >
                  {treeVerified ? "Tree Verified" : "Tree not verified — evidence blocked"}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
                <h2 className="text-2xl font-black text-[#ffe49a]">Evidence Center</h2>
                <p className="mt-2 text-sm text-white/60">
                  Health status required. Notes required. Photo optional.
                </p>

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

                <label className="mt-4 block text-sm font-bold text-white/70">
                  Optional Photo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white"
                />

                <label className="mt-4 block text-sm font-bold text-white/70">
                  Notes Required
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-2 min-h-[140px] w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none"
                  placeholder="Tree condition, pests, disease signs, treatment recommendation..."
                />
              </div>

              <button
                onClick={submitHealthEvidence}
                disabled={saving || !treeVerified}
                className="w-full rounded-2xl bg-[#d9b45f] px-6 py-4 text-lg font-black text-[#071f16] disabled:opacity-40"
              >
                {saving ? "Submitting..." : "Submit Work For Admin Review"}
              </button>

              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
                <h2 className="text-2xl font-black text-[#ffe49a]">
                  Recent Health Reports
                </h2>

                <div className="mt-4 space-y-3">
                  {reports.slice(0, 10).map((item) => (
                    <div key={item.id} className="rounded-2xl bg-black/20 p-4">
                      <p className="font-bold text-white">
                        {item.health_status || "Health Report"}
                      </p>
                      <p className="text-sm text-white/60">
                        Status: {item.status || "SUBMITTED"} • {formatDate(item.created_at)}
                      </p>
                      {(item.notes || item.issue_notes) && (
                        <p className="mt-2 text-sm text-white/70">
                          {item.notes || item.issue_notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-white/40">{label}</p>
      <p className="mt-1 font-bold text-white">{value || "—"}</p>
    </div>
  );
}