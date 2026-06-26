"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Row = Record<string, any>;

type QrTagRow = {
  tree_id: string;
  customer_profile_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  group_id: string | null;
  forest_name: string | null;
  seedling_name: string | null;
  tree_code: string | null;
  tree_qr_code: string | null;
  tree_qr_url: string | null;
  purchase_date: string | null;
  created_at: string | null;
  qr_tag_status: string | null;
  qr_tag_status_label: string | null;
  qr_tag_printed_at: string | null;
  qr_tag_installed_at: string | null;
  qr_tag_installed_by: string | null;
  qr_tag_installed_by_name: string | null;
  qr_tag_install_photo_url: string | null;
};

const ACTIVE_STATUSES = ["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "REWORK_REQUESTED"];

function normalize(value: any) {
  return String(value || "").trim().replace(/\s+/g, "_").toUpperCase();
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function qrTagLabel(status: string | null | undefined) {
  const value = normalize(status || "PENDING_TAG");

  if (value === "PENDING_TAG") return "QR tag pending installation";
  if (value === "PRINTED") return "QR tag printed, waiting installation";
  if (value === "INSTALLED") return "QR tag installed on tree";
  if (value === "VERIFIED") return "QR tag installed and verified";

  return "QR tag pending installation";
}

function qrUrl(row: QrTagRow) {
  return row.tree_qr_url || `/tree/verify/${row.tree_id}`;
}

export default function GardenerAssignedTreesPage() {
  const [profile, setProfile] = useState<Row | null>(null);
  const [caretaker, setCaretaker] = useState<Row | null>(null);
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [tasks, setTasks] = useState<Row[]>([]);
  const [requests, setRequests] = useState<Row[]>([]);
  const [trees, setTrees] = useState<Row[]>([]);
  const [groups, setGroups] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [qrTagQueue, setQrTagQueue] = useState<QrTagRow[]>([]);
  const [proofFiles, setProofFiles] = useState<Record<string, File | null>>({});
  const [loading, setLoading] = useState(true);
  const [savingTreeId, setSavingTreeId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

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
      .select("id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const { data: byEmail } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", email)
      .maybeSingle();

    return byId || byEmail || null;
  }

  async function resolveCaretaker(currentProfile: Row) {
    const email = String(currentProfile.email || "").trim().toLowerCase();

    const { data: byProfile } = await supabase
      .from("caretakers")
      .select("*")
      .eq("caretaker_profile_id", currentProfile.id)
      .maybeSingle();

    if (byProfile) return byProfile;

    const { data: byEmail } = await supabase
      .from("caretakers")
      .select("*")
      .ilike("email", email)
      .maybeSingle();

    return byEmail || null;
  }

  function unique(values: any[]) {
    return Array.from(new Set(values.filter(Boolean).map(String)));
  }

  async function loadData() {
    setLoading(true);
    setMessage("");

    const currentProfile = await resolveProfile();

    if (!currentProfile) {
      setLoading(false);
      setMessage("Profile not found.");
      return;
    }

    setProfile(currentProfile);

    const currentCaretaker = await resolveCaretaker(currentProfile);

    if (!currentCaretaker) {
      setLoading(false);
      setMessage("Gardener profile not found.");
      return;
    }

    if (normalize(currentCaretaker.status) !== "ACTIVE") {
      setLoading(false);
      setMessage("Your gardener account is not ACTIVE.");
      return;
    }

    setCaretaker(currentCaretaker);

    const filters = [
      `caretaker_id.eq.${currentCaretaker.id}`,
      currentCaretaker.caretaker_profile_id
        ? `caretaker_profile_id.eq.${currentCaretaker.caretaker_profile_id}`
        : "",
    ].filter(Boolean);

    const [assignmentResult, taskResult] = await Promise.all([
      supabase
        .from("caretaker_assignments")
        .select("*")
        .or(filters.join(","))
        .in("status", ACTIVE_STATUSES)
        .order("created_at", { ascending: false }),
      supabase
        .from("caretaker_task_logs")
        .select("*")
        .or(filters.join(","))
        .order("created_at", { ascending: false }),
    ]);

    if (assignmentResult.error) {
      setLoading(false);
      setMessage(assignmentResult.error.message);
      return;
    }

    if (taskResult.error) {
      setLoading(false);
      setMessage(taskResult.error.message);
      return;
    }

    const assignmentRows = assignmentResult.data || [];
    const taskRows = taskResult.data || [];
    const requestIds = unique([
      ...assignmentRows.map((item) => item.operation_request_id),
      ...taskRows.map((item) => item.operation_request_id),
    ]);

    let requestRows: Row[] = [];
    if (requestIds.length) {
      const { data } = await supabase
        .from("tree_operation_requests")
        .select("*")
        .in("id", requestIds);
      requestRows = data || [];
    }

    const treeIds = unique([
      ...assignmentRows.map((item) => item.tree_id),
      ...taskRows.map((item) => item.tree_id),
      ...requestRows.map((item) => item.tree_id),
    ]);

    let treeRows: Row[] = [];
    if (treeIds.length) {
      const { data } = await supabase.from("trees").select("*").in("id", treeIds);
      treeRows = data || [];
    }

    const groupIds = unique([
      ...assignmentRows.map((item) => item.group_id),
      ...taskRows.map((item) => item.group_id),
      ...requestRows.map((item) => item.group_id),
      ...treeRows.map((item) => item.group_id),
    ]);

    let groupRows: Row[] = [];
    if (groupIds.length) {
      const { data } = await supabase
        .from("tree_groups")
        .select("*")
        .in("id", groupIds);
      groupRows = data || [];
    }

    const customerIds = unique([
      ...assignmentRows.map((item) => item.customer_profile_id),
      ...taskRows.map((item) => item.customer_profile_id),
      ...requestRows.map((item) => item.customer_profile_id),
      ...requestRows.map((item) => item.profile_id),
      ...treeRows.map((item) => item.customer_profile_id),
      ...treeRows.map((item) => item.profile_id),
      ...groupRows.map((item) => item.customer_profile_id),
      ...groupRows.map((item) => item.profile_id),
    ]);

    let customerRows: Row[] = [];
    if (customerIds.length) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", customerIds);
      customerRows = data || [];
    }

    const assignedTreeIds = unique([
      ...assignmentRows.map((item) => item.tree_id),
      ...taskRows.map((item) => item.tree_id),
      ...requestRows.map((item) => item.tree_id),
    ]);

    const assignedGroupIds = unique([
      ...assignmentRows.map((item) => item.group_id),
      ...taskRows.map((item) => item.group_id),
      ...requestRows.map((item) => item.group_id),
      ...treeRows.map((item) => item.group_id),
    ]);

    const { data: qrTagRows, error: qrTagError } = await supabase
      .from("v_tree_qr_tag_lifecycle")
      .select("*")
      .in("qr_tag_status", ["PENDING_TAG", "PRINTED"])
      .order("created_at", { ascending: true });

    if (qrTagError) {
      console.warn("QR tag lifecycle load skipped:", qrTagError.message);
    }

    const assignedTreeSet = new Set(assignedTreeIds);
    const assignedGroupSet = new Set(assignedGroupIds);
    const filteredQrTagRows = ((qrTagRows || []) as QrTagRow[]).filter((row) => {
      return assignedTreeSet.has(row.tree_id) || (!!row.group_id && assignedGroupSet.has(row.group_id));
    });

    setAssignments(assignmentRows);
    setTasks(taskRows);
    setRequests(requestRows);
    setTrees(treeRows);
    setGroups(groupRows);
    setCustomers(customerRows);
    setQrTagQueue(filteredQrTagRows);
    setLoading(false);
  }

  const assignedSummary = useMemo(() => {
    return assignments.map((assignment) => {
      const request = requests.find((item) => item.id === assignment.operation_request_id) || null;
      const task =
        tasks.find((item) => item.assignment_id === assignment.id) ||
        tasks.find((item) => item.operation_request_id === assignment.operation_request_id) ||
        null;
      const tree = trees.find((item) => item.id === (assignment.tree_id || request?.tree_id)) || null;
      const group = groups.find((item) => item.id === (assignment.group_id || request?.group_id || tree?.group_id)) || null;
      const customerId =
        assignment.customer_profile_id ||
        request?.customer_profile_id ||
        request?.profile_id ||
        tree?.customer_profile_id ||
        tree?.profile_id ||
        group?.customer_profile_id ||
        group?.profile_id;
      const customer = customers.find((item) => item.id === customerId) || null;

      return { assignment, request, task, tree, group, customer };
    });
  }, [assignments, tasks, requests, trees, groups, customers]);

  async function uploadProofPhoto(treeId: string, file: File) {
    if (!profile || !caretaker) throw new Error("Gardener profile not loaded.");

    const ownerProfileId = caretaker.caretaker_profile_id || profile.id;
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `${ownerProfileId}/qr-tags/${treeId}/${Date.now()}.${ext}`;

    const upload = await supabase.storage.from("tree-evidence").upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (upload.error) throw upload.error;

    const { data } = supabase.storage.from("tree-evidence").getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function markInstalled(row: QrTagRow) {
    if (!profile || !caretaker || savingTreeId) return;

    setSavingTreeId(row.tree_id);
    setMessage("");

    try {
      const file = proofFiles[row.tree_id] || null;
      const photoUrl = file ? await uploadProofPhoto(row.tree_id, file) : null;

      const { error } = await supabase.rpc("mark_tree_qr_tag_installed", {
        p_tree_id: row.tree_id,
        p_gardener_profile_id: profile.id,
        p_photo_url: photoUrl || row.qr_tag_install_photo_url || null,
      });

      if (error) throw error;

      setProofFiles((current) => ({ ...current, [row.tree_id]: null }));
      setMessage(`${row.seedling_name || "Tree"} marked as QR tag installed via secure RPC.`);
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || "QR tag install update failed.");
    } finally {
      setSavingTreeId("");
    }
  }

  return (
    <main className="min-h-screen bg-[#03130d] p-6 text-white md:p-8">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(217,180,95,0.20),transparent_32%),radial-gradient(circle_at_top_right,rgba(52,120,77,0.28),transparent_30%),linear-gradient(180deg,#082015,#03130d_48%,#010805)]" />

      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-7 shadow-2xl backdrop-blur-xl md:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-[#d9b45f]">
                Arganwood Gardener Portal
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                Assigned Trees & QR Tagging
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/65">
                View assigned field work and install physical QR tags for trees in your assigned forest portfolio.
              </p>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-6 py-4 font-black text-[#f7d774] disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl border border-[#d9b45f]/25 bg-[#d9b45f]/10 p-4 text-sm font-bold text-[#ffe49a]">
              {message}
            </div>
          )}
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#d9b45f]">
                QR Physical Tagging
              </p>
              <h2 className="mt-2 text-3xl font-black text-white">Trees Needing QR Tag Installation</h2>
              <p className="mt-2 text-sm font-semibold text-white/60">
                Print the QR label, attach it to the physical tree, optionally upload proof, then mark it installed.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/40">Queue</p>
              <p className="mt-1 text-3xl font-black text-[#ffe49a]">{qrTagQueue.length}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {loading ? (
              <EmptyCard text="Loading QR tag queue..." />
            ) : qrTagQueue.length === 0 ? (
              <EmptyCard text="No QR tag installation tasks found for your assigned trees or forests." />
            ) : (
              qrTagQueue.map((row) => (
                <article key={row.tree_id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full border border-[#d9b45f]/30 bg-[#d9b45f]/10 px-3 py-1 text-xs font-black text-[#ffe49a]">
                          {normalize(row.qr_tag_status || "PENDING_TAG").replaceAll("_", " ")}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-white/60">
                          {qrTagLabel(row.qr_tag_status)}
                        </span>
                      </div>

                      <h3 className="mt-4 text-2xl font-black text-white">
                        {row.seedling_name || "Seedling"}
                      </h3>
                      <p className="mt-1 text-sm font-bold text-[#ffe49a]">
                        {row.tree_code || "No tree code"}
                      </p>

                      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <Info label="Owner" value={row.owner_name || row.owner_email || "Customer"} />
                        <Info label="Forest" value={row.forest_name || "Unnamed Forest"} />
                        <Info label="Purchase Date" value={formatDate(row.purchase_date || row.created_at)} />
                        <Info label="QR URL" value={qrUrl(row)} />
                        <Info label="Printed At" value={formatDate(row.qr_tag_printed_at)} />
                        <Info label="Installed At" value={formatDate(row.qr_tag_installed_at)} />
                      </div>
                    </div>

                    <aside className="rounded-3xl border border-white/10 bg-[#03130d]/70 p-5">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Actions</p>
                      <div className="mt-4 grid gap-3">
                        <Link
                          href={`/tree/qr-label/${row.tree_id}`}
                          target="_blank"
                          className="rounded-2xl bg-[#d9b45f] px-5 py-4 text-center text-sm font-black text-[#071f16]"
                        >
                          Print QR Label
                        </Link>

                        <Link
                          href={qrUrl(row)}
                          target="_blank"
                          className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-center text-sm font-black text-white/75"
                        >
                          Open QR URL
                        </Link>

                        <label className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs font-black uppercase tracking-[0.16em] text-white/45">
                          Optional proof photo
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) =>
                              setProofFiles((current) => ({
                                ...current,
                                [row.tree_id]: event.target.files?.[0] || null,
                              }))
                            }
                            className="text-sm font-bold normal-case tracking-normal text-white"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => markInstalled(row)}
                          disabled={savingTreeId === row.tree_id}
                          className="rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-[#03130d] disabled:opacity-50"
                        >
                          {savingTreeId === row.tree_id ? "Saving..." : "Mark as Installed"}
                        </button>
                      </div>
                    </aside>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#d9b45f]">Assigned Work Overview</p>
          <h2 className="mt-2 text-3xl font-black text-white">Current Field Assignments</h2>

          <div className="mt-6 grid gap-4">
            {loading ? (
              <EmptyCard text="Loading assigned work..." />
            ) : assignedSummary.length === 0 ? (
              <EmptyCard text="No active assigned work found." />
            ) : (
              assignedSummary.map(({ assignment, task, request, tree, group, customer }) => (
                <article key={assignment.id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-[#d9b45f]/30 bg-[#d9b45f]/10 px-3 py-1 text-xs font-black text-[#ffe49a]">
                          {normalize(task?.status || assignment.status).replaceAll("_", " ")}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-white/55">
                          {assignment.source_type || request?.service_name || request?.operation_type || "TREE OPERATION"}
                        </span>
                      </div>
                      <h3 className="mt-3 text-xl font-black text-white">
                        {tree?.custom_name || tree?.display_name || tree?.tree_code || "Forest-level assignment"}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-white/55">
                        {group?.forest_name || group?.group_name || "Single Tree"} • {customer?.full_name || customer?.email || "Customer"}
                      </p>
                    </div>
                    <Link
                      href={`/gardener/tasks?assignment_id=${assignment.id}`}
                      className="rounded-2xl bg-[#d9b45f] px-5 py-4 text-center text-sm font-black text-[#071f16]"
                    >
                      Open Work Center
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-2 break-words text-sm font-bold text-white/80">{value || "—"}</p>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-sm font-bold text-white/55">
      {text}
    </div>
  );
}
