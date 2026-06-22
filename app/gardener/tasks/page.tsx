"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Task = Record<string, any>;
type Filter = "ALL" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";

export default function GardenerTasksPage() {
  const [caretaker, setCaretaker] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState("");

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
      .update({
        status: cleanStatus,
      })
      .eq("id", task.id);

    if (taskError) {
      setMessage(taskError.message);
      setSavingId("");
      return;
    }

    if (task.assignment_id) {
      await supabase
        .from("caretaker_assignments")
        .update({ status: cleanStatus })
        .eq("id", task.assignment_id);
    }

    if (task.operation_request_id) {
      await supabase
        .from("tree_operation_requests")
        .update({ status: cleanStatus })
        .eq("id", task.operation_request_id);
    }

    setMessage(`Task status updated to ${cleanStatus.replace("_", " ")}.`);
    setSavingId("");
    await loadData();
  }

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const assigned = tasks.filter(
      (task) => String(task.status || "ASSIGNED").toUpperCase() === "ASSIGNED"
    ).length;

    const inProgress = tasks.filter(
      (task) => String(task.status || "").toUpperCase() === "IN_PROGRESS"
    ).length;

    const completed = tasks.filter(
      (task) => String(task.status || "").toUpperCase() === "COMPLETED"
    ).length;

    return {
      total: tasks.length,
      assigned,
      inProgress,
      completed,
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (filter === "ALL") return tasks;

    return tasks.filter(
      (task) => String(task.status || "ASSIGNED").toUpperCase() === filter
    );
  }, [tasks, filter]);

  return (
    <main style={pageStyle}>
      <section style={shellStyle}>
        <div style={headerStyle}>
          <div>
            <p style={eyebrowStyle}>Arganwood Gardener Portal</p>
            <h1 style={titleStyle}>Gardener Tasks</h1>
            <p style={subtitleStyle}>
              Track assigned work, update progress, and mark finished tasks clearly.
            </p>
          </div>

          <div style={gardenerCardStyle}>
            <p style={smallLabelStyle}>Logged Gardener</p>
            <h3 style={{ margin: "6px 0 0", color: "#244536" }}>
              {caretaker?.full_name || caretaker?.email || "—"}
            </h3>
          </div>
        </div>

        {message && <div style={messageStyle}>{message}</div>}

        <section style={statsGridStyle}>
          <StatCard label="Total Tasks" value={stats.total} />
          <StatCard label="Assigned" value={stats.assigned} />
          <StatCard label="In Progress" value={stats.inProgress} />
          <StatCard label="Finished" value={stats.completed} />
        </section>

        <section style={toolbarStyle}>
          {(["ALL", "ASSIGNED", "IN_PROGRESS", "COMPLETED"] as Filter[]).map(
            (item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                style={{
                  ...filterButtonStyle,
                  background: filter === item ? "#244536" : "rgba(255,255,255,.78)",
                  color: filter === item ? "white" : "#244536",
                }}
              >
                {item.replace("_", " ")}
              </button>
            )
          )}
        </section>

        {loading ? (
          <div style={cardStyle}>Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div style={cardStyle}>No tasks found for this status.</div>
        ) : (
          <section style={taskGridStyle}>
            {filteredTasks.map((task) => {
              const status = String(task.status || "ASSIGNED").toUpperCase();
              const completed = status === "COMPLETED";

              return (
                <article key={task.id} style={taskCardStyle}>
                  <div style={taskTopStyle}>
                    <div>
                      <p style={eyebrowStyle}>{task.task_type || "Tree Task"}</p>
                      <h2 style={taskTitleStyle}>Tree: {task.tree_id || "—"}</h2>
                    </div>

                    <span
                      style={{
                        ...badgeStyle,
                        background: completed ? "#1f6f4a" : status === "IN_PROGRESS" ? "#b98124" : "#244536",
                      }}
                    >
                      {status.replace("_", " ")}
                    </span>
                  </div>

                  <div style={detailsGridStyle}>
                    <Info label="Operation Request" value={task.operation_request_id || "—"} />
                    <Info label="Assignment ID" value={task.assignment_id || "—"} />
                    <Info
                      label="Created"
                      value={
                        task.created_at
                          ? new Date(task.created_at).toLocaleString()
                          : "—"
                      }
                    />
                    <Info label="Status" value={status.replace("_", " ")} />
                  </div>

                  {task.notes && (
                    <div style={notesStyle}>
                      <p style={smallLabelStyle}>Notes</p>
                      <p style={{ margin: "6px 0 0", color: "#4d5a4f" }}>
                        {task.notes}
                      </p>
                    </div>
                  )}

                  <div style={actionRowStyle}>
                    <select
                      value={status}
                      disabled={savingId === task.id}
                      onChange={(event) =>
                        updateTaskStatus(task, event.target.value)
                      }
                      style={selectStyle}
                    >
                      <option value="ASSIGNED">ASSIGNED</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="COMPLETED">COMPLETED</option>
                    </select>

                    {!completed && (
                      <button
                        onClick={() => updateTaskStatus(task, "COMPLETED")}
                        disabled={savingId === task.id}
                        style={buttonStyle}
                      >
                        {savingId === task.id ? "Saving..." : "Finish Task"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={statCardStyle}>
      <p style={smallLabelStyle}>{label}</p>
      <h3 style={statValueStyle}>{value}</h3>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoStyle}>
      <p style={smallLabelStyle}>{label}</p>
      <p style={{ margin: "5px 0 0", color: "#244536", fontWeight: 900 }}>
        {value}
      </p>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: 30,
  backgroundImage:
    "linear-gradient(rgba(2,24,13,.35), rgba(2,24,13,.72)), url('/images/agarwood-real-tree.jpg')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  backgroundAttachment: "fixed",
};

const shellStyle: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  borderRadius: 32,
  padding: 30,
  background: "rgba(7,31,22,.78)",
  border: "1px solid rgba(255,255,255,.14)",
  boxShadow: "0 24px 80px rgba(0,0,0,.35)",
  backdropFilter: "blur(10px)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const eyebrowStyle: React.CSSProperties = {
  margin: 0,
  color: "#d9b45f",
  fontWeight: 900,
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: ".12em",
};

const titleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 42,
  color: "white",
  fontWeight: 900,
};

const subtitleStyle: React.CSSProperties = {
  maxWidth: 850,
  color: "rgba(255,255,255,.78)",
  fontWeight: 600,
  lineHeight: 1.7,
};

const cardStyle: React.CSSProperties = {
  borderRadius: 24,
  background: "rgba(255,255,255,.92)",
  border: "1px solid rgba(255,255,255,.22)",
  boxShadow: "0 18px 42px rgba(0,0,0,.16)",
  padding: 22,
  color: "#244536",
  fontWeight: 900,
};

const gardenerCardStyle: React.CSSProperties = {
  ...cardStyle,
  minWidth: 260,
};

const messageStyle: React.CSSProperties = {
  ...cardStyle,
  marginTop: 20,
  color: "#31553d",
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 16,
  marginTop: 24,
};

const statCardStyle: React.CSSProperties = {
  ...cardStyle,
  minHeight: 110,
};

const smallLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#6b6b62",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".08em",
};

const statValueStyle: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: 32,
  color: "#244536",
  fontWeight: 900,
};

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 22,
  marginBottom: 18,
};

const filterButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,.25)",
  borderRadius: 999,
  padding: "10px 14px",
  fontWeight: 900,
  cursor: "pointer",
};

const taskGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  marginTop: 12,
};

const taskCardStyle: React.CSSProperties = {
  borderRadius: 26,
  background: "rgba(255,253,246,.94)",
  border: "1px solid rgba(217,180,95,.22)",
  boxShadow: "0 20px 55px rgba(0,0,0,.20)",
  padding: 22,
};

const taskTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
};

const taskTitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#10281f",
  fontSize: 24,
};

const badgeStyle: React.CSSProperties = {
  height: "fit-content",
  borderRadius: 999,
  padding: "9px 13px",
  color: "white",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const detailsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 12,
  marginTop: 18,
};

const infoStyle: React.CSSProperties = {
  borderRadius: 18,
  background: "#f3ead8",
  padding: 14,
};

const notesStyle: React.CSSProperties = {
  marginTop: 14,
  borderRadius: 18,
  background: "rgba(36,69,54,.08)",
  padding: 14,
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  marginTop: 18,
  flexWrap: "wrap",
};

const selectStyle: React.CSSProperties = {
  flex: "1 1 220px",
  border: "1px solid rgba(36,69,54,.18)",
  borderRadius: 16,
  padding: "13px 14px",
  background: "white",
  color: "#244536",
  fontWeight: 900,
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  flex: "1 1 180px",
  border: 0,
  borderRadius: 16,
  padding: "13px 16px",
  background: "#d9b45f",
  color: "#10281f",
  fontWeight: 900,
  cursor: "pointer",
};