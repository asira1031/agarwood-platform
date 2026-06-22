"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Task = Record<string, any>;
type Filter = "ALL" | "ASSIGNED" | "IN_PROGRESS" | "SUBMITTED" | "COMPLETED";

export default function GardenerTasksPage() {
  const [caretaker, setCaretaker] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState("");

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

    const { data: taskRows, error: taskError } = await supabase
      .from("caretaker_task_logs")
      .select("*")
      .eq("caretaker_id", caretakerRow.id)
      .order("created_at", { ascending: false });

    if (taskError) {
      setMessage(taskError.message);
      setLoading(false);
      return;
    }

    setTasks(taskRows || []);
    setLoading(false);
  }

  async function updateTaskStatus(task: Task, nextStatus: string) {
    setMessage("");
    setSavingId(task.id);

    const cleanStatus = nextStatus.toUpperCase();

    const { error: taskError } = await supabase
      .from("caretaker_task_logs")
      .update({ status: cleanStatus })
      .eq("id", task.id);

    if (taskError) {
      setMessage(taskError.message);
      setSavingId("");
      return;
    }

    if (task.assignment_id) {
      const { error: assignmentError } = await supabase
        .from("caretaker_assignments")
        .update({ status: cleanStatus })
        .eq("id", task.assignment_id);

      if (assignmentError) {
        setMessage(assignmentError.message);
        setSavingId("");
        return;
      }
    }

    if (task.operation_request_id) {
      const { error: requestError } = await supabase
        .from("tree_operation_requests")
        .update({ status: cleanStatus })
        .eq("id", task.operation_request_id);

      if (requestError) {
        setMessage(requestError.message);
        setSavingId("");
        return;
      }
    }

    await supabase.from("caretaker_task_logs").insert({
      assignment_id: task.assignment_id || null,
      caretaker_id: task.caretaker_id,
      customer_profile_id: task.customer_profile_id || null,
      tree_id: task.tree_id || null,
      operation_request_id: task.operation_request_id || null,
      task_type: task.task_type || "Tree Task",
      notes: `Gardener updated task status to ${cleanStatus.replace("_", " ")}.`,
      status: cleanStatus,
    });

    setMessage(`Task synced as ${cleanStatus.replace("_", " ")}.`);
    setSavingId("");
    await loadData();
  }

  const stats = useMemo(() => {
    return {
      total: tasks.length,
      assigned: tasks.filter(
        (task) => String(task.status || "ASSIGNED").toUpperCase() === "ASSIGNED"
      ).length,
      inProgress: tasks.filter(
        (task) => String(task.status || "").toUpperCase() === "IN_PROGRESS"
      ).length,
      submitted: tasks.filter(
        (task) => String(task.status || "").toUpperCase() === "SUBMITTED"
      ).length,
      completed: tasks.filter(
        (task) => String(task.status || "").toUpperCase() === "COMPLETED"
      ).length,
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (filter === "ALL") return tasks;

    return tasks.filter(
      (task) => String(task.status || "ASSIGNED").toUpperCase() === filter
    );
  }, [tasks, filter]);

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

  function badgeClass(status: string) {
    if (status === "COMPLETED") {
      return "border-emerald-400/30 bg-emerald-500/20 text-emerald-200";
    }

    if (status === "SUBMITTED") {
      return "border-purple-400/30 bg-purple-500/20 text-purple-200";
    }

    if (status === "IN_PROGRESS") {
      return "border-yellow-400/30 bg-yellow-500/20 text-yellow-200";
    }

    return "border-blue-400/30 bg-blue-500/20 text-blue-200";
  }

  return (
    <main className="min-h-screen p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8 rounded-3xl border border-white/10 bg-[#071f16]/80 p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
              Arganwood Gardener Portal
            </p>

            <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
              Gardener Tasks
            </h1>

            <p className="mt-2 text-white/70">
              Track assigned tasks, update progress, and sync work status back to Admin Operations.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">
              Logged Gardener
            </p>
            <h3 className="mt-2 font-bold text-[#f7d774]">
              {caretaker?.full_name || caretaker?.email || "—"}
            </h3>
          </div>
        </div>

        {message && (
          <div className="rounded-2xl border border-[#d9b45f]/20 bg-[#d9b45f]/10 p-4 text-sm font-semibold text-[#ffe8a3]">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-5">
          <StatCard label="Total Tasks" value={String(stats.total)} />
          <StatCard label="Assigned" value={String(stats.assigned)} />
          <StatCard label="In Progress" value={String(stats.inProgress)} />
          <StatCard label="Submitted" value={String(stats.submitted)} />
          <StatCard label="Completed" value={String(stats.completed)} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/10 p-5">
          <div className="flex flex-wrap gap-3">
            {(["ALL", "ASSIGNED", "IN_PROGRESS", "SUBMITTED", "COMPLETED"] as Filter[]).map(
              (item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`rounded-full px-5 py-3 text-sm font-bold transition ${
                    filter === item
                      ? "bg-[#f7d774] text-[#071f16]"
                      : "bg-white/10 text-white hover:bg-white/15"
                  }`}
                >
                  {item.replace("_", " ")}
                </button>
              )
            )}
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-white/70">
            Loading tasks...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-white/70">
            No tasks found for this status.
          </div>
        ) : (
          <section className="space-y-5">
            {filteredTasks.map((task) => {
              const status = String(task.status || "ASSIGNED").toUpperCase();
              const completed = status === "COMPLETED";

              return (
                <div
                  key={task.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.06] p-6"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-black text-[#ffe49a]">
                          {task.task_type || "Tree Task"}
                        </h2>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(
                            status
                          )}`}
                        >
                          {status.replace("_", " ")}
                        </span>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-4">
                        <Info label="Tree" value={task.tree_id || "—"} />
                        <Info label="Assignment" value={task.assignment_id || "—"} />
                        <Info label="Operation Request" value={task.operation_request_id || "—"} />
                        <Info label="Created" value={formatDate(task.created_at)} />
                      </div>

                      {task.notes && (
                        <div className="mt-4 rounded-2xl bg-black/20 p-4 text-sm text-white/70">
                          Notes: {task.notes}
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link
                          href="/gardener/photo-updates"
                          className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15"
                        >
                          Photo Update
                        </Link>

                        <Link
                          href="/gardener/gps-updates"
                          className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15"
                        >
                          GPS Update
                        </Link>

                        <Link
                          href="/gardener/health-reports"
                          className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15"
                        >
                          Health Report
                        </Link>
                      </div>
                    </div>

                    <div className="w-full rounded-2xl bg-black/20 p-4 lg:w-[320px]">
                      <label className="text-sm font-bold text-white/70">
                        Update Task Status
                      </label>

                      <select
                        value={status}
                        disabled={savingId === task.id}
                        onChange={(event) =>
                          updateTaskStatus(task, event.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-white/10 bg-[#071f16] px-4 py-3 text-white outline-none disabled:opacity-50"
                      >
                        <option value="ASSIGNED">ASSIGNED</option>
                        <option value="IN_PROGRESS">IN PROGRESS</option>
                        <option value="SUBMITTED">SUBMITTED</option>
                        <option value="COMPLETED">COMPLETED</option>
                      </select>

                      <div className="mt-4 grid gap-3">
                        {status === "ASSIGNED" && (
                          <button
                            onClick={() => updateTaskStatus(task, "IN_PROGRESS")}
                            disabled={savingId === task.id}
                            className="rounded-xl bg-blue-500/20 px-4 py-3 font-bold text-blue-100 hover:bg-blue-500/30 disabled:opacity-50"
                          >
                            {savingId === task.id ? "Saving..." : "Start Task"}
                          </button>
                        )}

                        {!completed && (
                          <button
                            onClick={() => updateTaskStatus(task, "COMPLETED")}
                            disabled={savingId === task.id}
                            className="rounded-xl bg-emerald-500/20 px-4 py-3 font-bold text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50"
                          >
                            {savingId === task.id ? "Saving..." : "Finish Task"}
                          </button>
                        )}

                        {completed && (
                          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-center text-sm font-bold text-emerald-100">
                            Completed and synced to Admin.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
      <p className="text-sm text-white/70">{label}</p>
      <p className="mt-3 text-2xl font-bold text-[#d9b45f]">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-white/40">
        {label}
      </p>
      <p className="mt-1 break-all font-bold text-white/85">{value}</p>
    </div>
  );
}