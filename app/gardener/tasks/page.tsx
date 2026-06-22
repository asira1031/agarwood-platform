"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function GardenerTasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  async function markCompleted(task: any) {
    setMessage("");

    const { error } = await supabase
      .from("caretaker_task_logs")
      .update({ status: "COMPLETED" })
      .eq("id", task.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Task marked as completed.");
    await loadData();
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <main style={{ padding: 30 }}>
      <p style={eyebrowStyle}>Arganwood Gardener Portal</p>
      <h1 style={{ margin: 0, fontSize: 42 }}>Gardener Tasks</h1>
      <p style={{ maxWidth: 850, color: "#5f665e" }}>
        View assigned field tasks and mark completed work.
      </p>

      {message && <div style={messageStyle}>{message}</div>}

      {loading ? (
        <div style={cardStyle}>Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div style={cardStyle}>No tasks yet.</div>
      ) : (
        <section style={{ display: "grid", gap: 14, marginTop: 24 }}>
          {tasks.map((task) => {
            const status = String(task.status || "ASSIGNED").toUpperCase();
            const completed = status === "COMPLETED";

            return (
              <div key={task.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <p style={eyebrowStyle}>{task.task_type || "Tree Task"}</p>
                    <h2 style={{ margin: "6px 0 0", color: "#10281f" }}>
                      Tree: {task.tree_id || "—"}
                    </h2>
                    <p style={{ margin: "8px 0 0", color: "#5f665e" }}>
                      Operation Request: {task.operation_request_id || "—"}
                    </p>
                    {task.notes && (
                      <p style={{ margin: "10px 0 0", color: "#5f665e" }}>
                        Notes: {task.notes}
                      </p>
                    )}
                  </div>

                  <div style={{ minWidth: 180 }}>
                    <span style={badgeStyle}>{status}</span>

                    {!completed && (
                      <button
                        onClick={() => markCompleted(task)}
                        style={buttonStyle}
                      >
                        Mark Completed
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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

const badgeStyle = {
  display: "block",
  textAlign: "center" as const,
  borderRadius: 999,
  padding: "8px 12px",
  background: "#244536",
  color: "white",
  fontWeight: 900,
};

const buttonStyle = {
  width: "100%",
  marginTop: 12,
  border: 0,
  borderRadius: 14,
  padding: "12px 14px",
  background: "#d9b45f",
  color: "#10281f",
  fontWeight: 900,
  cursor: "pointer",
};