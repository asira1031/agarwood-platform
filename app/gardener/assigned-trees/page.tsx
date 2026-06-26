"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Row = Record<string, any>;

function normalize(value: any) {
  return String(value || "ASSIGNED").trim().replace(/\s+/g, "_").toUpperCase();
}

function unique(values: any[]) {
  return Array.from(new Set(values.filter(Boolean).map(String)));
}

function makeMap(rows: Row[]) {
  const map = new Map<string, Row>();
  rows.forEach((row) => {
    if (row?.id) map.set(String(row.id), row);
  });
  return map;
}

function serviceLabel(request: Row | null, assignment: Row) {
  const raw =
    request?.service_name ||
    request?.care_program_name ||
    request?.operation_type ||
    request?.request_type ||
    assignment.source_type ||
    assignment.assignment_type ||
    "Tree Operation";

  return String(raw).replaceAll("_", " ");
}

function formatDate(value: any) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function GardenerAssignedTreesPage() {
  const [caretaker, setCaretaker] = useState<Row | null>(null);
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [tasks, setTasks] = useState<Row[]>([]);
  const [requests, setRequests] = useState<Row[]>([]);
  const [trees, setTrees] = useState<Row[]>([]);
  const [groups, setGroups] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [filter, setFilter] = useState("ACTIVE");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      window.location.href = "/login";
      return;
    }

    const email = user.email?.trim().toLowerCase() || "";

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", email)
      .maybeSingle();

    const profile = profileById || profileByEmail;

    const { data: caretakerByProfile } = profile?.id
      ? await supabase.from("caretakers").select("*").eq("caretaker_profile_id", profile.id).maybeSingle()
      : { data: null };

    const { data: caretakerByEmail } = await supabase.from("caretakers").select("*").ilike("email", email).maybeSingle();
    const caretakerRow = caretakerByProfile || caretakerByEmail;

    if (!caretakerRow) {
      setMessage("Caretaker profile not found.");
      setLoading(false);
      return;
    }

    if (normalize(caretakerRow.status) !== "ACTIVE") {
      setMessage("Your gardener account is not ACTIVE.");
      setLoading(false);
      return;
    }

    setCaretaker(caretakerRow);

    const filters = [
      `caretaker_id.eq.${caretakerRow.id}`,
      caretakerRow.caretaker_profile_id ? `caretaker_profile_id.eq.${caretakerRow.caretaker_profile_id}` : "",
    ].filter(Boolean);

    const [assignmentResult, taskResult] = await Promise.all([
      supabase.from("caretaker_assignments").select("*").or(filters.join(",")).order("created_at", { ascending: false }),
      supabase.from("caretaker_task_logs").select("*").or(filters.join(",")).order("created_at", { ascending: false }),
    ]);

    if (assignmentResult.error) {
      setMessage(assignmentResult.error.message);
      setLoading(false);
      return;
    }

    if (taskResult.error) {
      setMessage(taskResult.error.message);
      setLoading(false);
      return;
    }

    const assignmentRows = assignmentResult.data || [];
    const taskRows = taskResult.data || [];
    const requestIds = unique([...assignmentRows.map((row) => row.operation_request_id), ...taskRows.map((row) => row.operation_request_id)]);

    let requestRows: Row[] = [];
    if (requestIds.length > 0) {
      const { data } = await supabase.from("tree_operation_requests").select("*").in("id", requestIds);
      requestRows = data || [];
    }

    const treeIds = unique([...assignmentRows.map((row) => row.tree_id), ...taskRows.map((row) => row.tree_id), ...requestRows.map((row) => row.tree_id)]);
    const groupIds = unique([...assignmentRows.map((row) => row.group_id), ...taskRows.map((row) => row.group_id), ...requestRows.map((row) => row.group_id)]);

    const [directTreeResult, groupTreeResult, groupResult] = await Promise.all([
      treeIds.length ? supabase.from("trees").select("*").in("id", treeIds) : Promise.resolve({ data: [] }),
      groupIds.length ? supabase.from("trees").select("*").in("group_id", groupIds) : Promise.resolve({ data: [] }),
      groupIds.length ? supabase.from("tree_groups").select("*").in("id", groupIds) : Promise.resolve({ data: [] }),
    ]);

    const allTrees = Array.from(new Map([...(directTreeResult.data || []), ...(groupTreeResult.data || [])].map((tree: Row) => [String(tree.id), tree])).values());
    const groupRows = groupResult.data || [];

    const customerIds = unique([
      ...assignmentRows.map((row) => row.customer_profile_id),
      ...taskRows.map((row) => row.customer_profile_id),
      ...requestRows.map((row) => row.customer_profile_id),
      ...requestRows.map((row) => row.profile_id),
      ...allTrees.map((row) => row.customer_profile_id),
      ...allTrees.map((row) => row.profile_id),
      ...groupRows.map((row) => row.customer_profile_id),
      ...groupRows.map((row) => row.profile_id),
    ]);

    let customerRows: Row[] = [];
    if (customerIds.length > 0) {
      const { data } = await supabase.from("profiles").select("id, full_name, display_name, email, phone").in("id", customerIds);
      customerRows = data || [];
    }

    setAssignments(assignmentRows);
    setTasks(taskRows);
    setRequests(requestRows);
    setTrees(allTrees);
    setGroups(groupRows);
    setCustomers(customerRows);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const requestMap = useMemo(() => makeMap(requests), [requests]);
  const treeMap = useMemo(() => makeMap(trees), [trees]);
  const groupMap = useMemo(() => makeMap(groups), [groups]);
  const customerMap = useMemo(() => makeMap(customers), [customers]);

  const items = useMemo(() => {
    return assignments.map((assignment) => {
      const task =
        tasks.find((row) => String(row.assignment_id || "") === String(assignment.id)) ||
        tasks.find((row) => String(row.operation_request_id || "") === String(assignment.operation_request_id || "")) ||
        null;
      const request = assignment.operation_request_id ? requestMap.get(String(assignment.operation_request_id)) || null : null;
      const treeId = assignment.tree_id || task?.tree_id || request?.tree_id;
      const tree = treeId ? treeMap.get(String(treeId)) || null : null;
      const groupId = assignment.group_id || task?.group_id || request?.group_id || tree?.group_id;
      const group = groupId ? groupMap.get(String(groupId)) || null : null;
      const customerId = assignment.customer_profile_id || task?.customer_profile_id || request?.customer_profile_id || request?.profile_id || tree?.customer_profile_id || tree?.profile_id || group?.customer_profile_id || group?.profile_id;
      const customer = customerId ? customerMap.get(String(customerId)) || null : null;
      const status = normalize(task?.status || assignment.status || request?.assignment_status || request?.status);

      return { assignment, task, request, tree, group, customer, status };
    });
  }, [assignments, tasks, requestMap, treeMap, groupMap, customerMap]);

  const visibleItems = useMemo(() => {
    if (filter === "ALL") return items;
    if (filter === "ACTIVE") return items.filter((item) => !["COMPLETED", "CANCELLED", "REJECTED", "FAILED"].includes(item.status));
    return items.filter((item) => item.status === filter);
  }, [items, filter]);

  const stats = useMemo(() => ({
    total: items.length,
    assigned: items.filter((item) => item.status === "ASSIGNED").length,
    inProgress: items.filter((item) => item.status === "IN_PROGRESS").length,
    submitted: items.filter((item) => item.status === "SUBMITTED").length,
    completed: items.filter((item) => item.status === "COMPLETED").length,
  }), [items]);

  return (
    <main className="min-h-screen bg-[#03130d] p-6 text-white md:p-8">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(217,180,95,0.20),transparent_32%),radial-gradient(circle_at_top_right,rgba(52,120,77,0.28),transparent_30%),linear-gradient(180deg,#082015,#03130d_48%,#010805)]" />

      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-7 shadow-2xl backdrop-blur-xl md:p-9">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-[#d9b45f]">Arganwood Gardener Portal</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">Assigned Trees & Forests</h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/65">
            This is your assignment overview. Open the Work Center to start work, scan QR, upload Photo + GPS + Health, and submit to Admin Review.
          </p>
          <Link href="/gardener/tasks" className="mt-6 inline-flex rounded-2xl bg-[#d9b45f] px-6 py-4 text-sm font-black text-[#071f16] hover:bg-[#f7d774]">
            Open Work Center
          </Link>
          {message && <div className="mt-6 rounded-2xl border border-[#d9b45f]/25 bg-[#d9b45f]/10 p-4 text-sm font-bold text-[#ffe49a]">{message}</div>}
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
          <div className="grid gap-4 md:grid-cols-5">
            <Stat label="Total" value={stats.total} />
            <Stat label="Assigned" value={stats.assigned} />
            <Stat label="In Progress" value={stats.inProgress} />
            <Stat label="Submitted" value={stats.submitted} />
            <Stat label="Completed" value={stats.completed} />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {["ACTIVE", "ALL", "ASSIGNED", "IN_PROGRESS", "SUBMITTED", "COMPLETED"].map((item) => (
              <button key={item} onClick={() => setFilter(item)} className={`rounded-full px-5 py-3 text-sm font-black ${filter === item ? "bg-[#d9b45f] text-[#071f16]" : "border border-white/10 bg-white/10 text-white/70"}`}>
                {item.replaceAll("_", " ")}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <Empty text="Loading assignments..." />
        ) : visibleItems.length === 0 ? (
          <Empty text="No assignments in this view." />
        ) : (
          <section className="grid gap-5">
            {visibleItems.map((item) => {
              const title = item.tree?.custom_name || item.tree?.display_name || item.tree?.tree_code || item.group?.forest_name || item.group?.group_name || "Assigned Forest";
              return (
                <article key={item.assignment.id} className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-3">
                        <Badge value={item.status} />
                        <span className="rounded-full border border-[#d9b45f]/30 bg-[#d9b45f]/10 px-3 py-1 text-xs font-black text-[#ffe49a]">{serviceLabel(item.request, item.assignment)}</span>
                      </div>
                      <h2 className="mt-4 text-2xl font-black text-white">{title}</h2>
                      <p className="mt-2 text-sm font-semibold text-white/60">
                        Customer: {item.customer?.full_name || item.customer?.email || "Customer"} • Forest: {item.group?.forest_name || item.group?.group_name || "Single Tree"}
                      </p>
                      <p className="mt-1 text-xs font-bold text-white/40">Assigned: {formatDate(item.assignment.assigned_at || item.assignment.created_at)}</p>
                    </div>
                    <Link href={`/gardener/tasks?assignment_id=${item.assignment.id}`} className="rounded-2xl bg-[#d9b45f] px-6 py-4 text-center text-sm font-black text-[#071f16] hover:bg-[#f7d774]">
                      Open Work Center
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-white/45">{label}</p>
      <p className="mt-3 text-3xl font-black text-[#ffe49a]">{value}</p>
    </div>
  );
}

function Badge({ value }: { value: string }) {
  const color = value === "COMPLETED" ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200" : value === "SUBMITTED" ? "border-purple-400/30 bg-purple-500/15 text-purple-200" : value === "IN_PROGRESS" ? "border-blue-400/30 bg-blue-500/15 text-blue-200" : "border-yellow-400/30 bg-yellow-500/15 text-yellow-200";
  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${color}`}>{value.replaceAll("_", " ")}</span>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-sm font-bold text-white/60 shadow-2xl backdrop-blur-xl">{text}</div>;
}
