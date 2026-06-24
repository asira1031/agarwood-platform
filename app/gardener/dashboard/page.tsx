"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Row = Record<string, any>;

function statusOf(value: any) {
  return String(value || "ASSIGNED").toUpperCase();
}

export default function GardenerDashboardPage() {
  const [caretaker, setCaretaker] = useState<Row | null>(null);
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [tasks, setTasks] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

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
      ? await supabase
          .from("caretakers")
          .select("*")
          .eq("caretaker_profile_id", profile.id)
          .maybeSingle()
      : { data: null };

    const { data: caretakerByEmail } = await supabase
      .from("caretakers")
      .select("*")
      .ilike("email", email)
      .maybeSingle();

    const caretakerRow = caretakerByProfile || caretakerByEmail;

    if (!caretakerRow) {
      setMessage("Gardener account not found. Ask admin to activate your field account.");
      setLoading(false);
      return;
    }

    if (statusOf(caretakerRow.status) !== "ACTIVE") {
      setMessage("Your gardener account is not ACTIVE.");
      setLoading(false);
      return;
    }

    setCaretaker(caretakerRow);

    const filters = [
      `caretaker_id.eq.${caretakerRow.id}`,
      caretakerRow.caretaker_profile_id
        ? `caretaker_profile_id.eq.${caretakerRow.caretaker_profile_id}`
        : "",
    ].filter(Boolean);

    const [assignmentResult, taskResult] = await Promise.all([
      supabase
        .from("caretaker_assignments")
        .select("*")
        .or(filters.join(","))
        .order("created_at", { ascending: false }),

      supabase
        .from("caretaker_task_logs")
        .select("*")
        .or(filters.join(","))
        .order("created_at", { ascending: false }),
    ]);

    if (assignmentResult.error) setMessage(assignmentResult.error.message);
    if (taskResult.error) setMessage(taskResult.error.message);

    setAssignments(assignmentResult.data || []);
    setTasks(taskResult.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const allRows = assignments.length ? assignments : tasks;

    return {
      assigned: allRows.filter((x) => statusOf(x.status) === "ASSIGNED").length,
      inProgress: allRows.filter((x) => statusOf(x.status) === "IN_PROGRESS").length,
      submitted: allRows.filter((x) => statusOf(x.status) === "SUBMITTED").length,
      completed: allRows.filter((x) => statusOf(x.status) === "COMPLETED").length,
    };
  }, [assignments, tasks]);

  return (
    <main className="min-h-screen bg-[#03130d] p-6 text-white md:p-8">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(217,180,95,0.18),transparent_32%),linear-gradient(180deg,#082015,#03130d_55%,#010805)]" />

      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-7 shadow-2xl backdrop-blur-xl md:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-[#d9b45f]">
                Arganwood Field Workflow
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                Gardener Dashboard
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/65">
                Your field work starts in the Work Queue. Start the job, verify the tree QR,
                submit evidence, then wait for Admin approval before the customer sees it as completed.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/45">
                Logged Gardener
              </p>
              <p className="mt-2 text-xl font-black text-[#ffe49a]">
                {caretaker?.full_name || caretaker?.email || "—"}
              </p>
              <p className="mt-1 text-xs font-semibold text-white/45">
                {caretaker?.email || "No email"} • {caretaker?.status || "—"}
              </p>
            </div>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl border border-[#d9b45f]/25 bg-[#d9b45f]/10 p-4 text-sm font-bold text-[#ffe49a]">
              {message}
            </div>
          )}

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <Stat label="Assigned" value={stats.assigned} />
            <Stat label="In Progress" value={stats.inProgress} />
            <Stat label="Submitted" value={stats.submitted} />
            <Stat label="Completed" value={stats.completed} />
          </div>

          <div className="mt-8 rounded-[2rem] border border-[#d9b45f]/20 bg-[#d9b45f]/10 p-6">
            <h2 className="text-2xl font-black text-[#ffe49a]">Field Workflow</h2>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-white/70">
              Customer Request → Admin Assignment → Start Work → Verify Tree QR → Submit Evidence →
              Admin Review → Customer Timeline
            </p>

            <Link
              href="/gardener/tasks"
              className="mt-6 inline-flex rounded-2xl bg-[#d9b45f] px-6 py-4 text-sm font-black text-[#071f16] hover:bg-[#f7d774]"
            >
              Open Work Queue
            </Link>
          </div>
        </section>

        {loading && (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-white/65">
            Loading gardener dashboard...
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-white/45">{label}</p>
      <p className="mt-3 text-4xl font-black text-[#ffe49a]">{value}</p>
    </div>
  );
}