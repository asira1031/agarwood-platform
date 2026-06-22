"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function GardenerDashboardPage() {
  const [caretaker, setCaretaker] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [gps, setGps] = useState<any[]>([]);
  const [health, setHealth] = useState<any[]>([]);
  const [concerns, setConcerns] = useState<any[]>([]);
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
      setMessage("Caretaker profile not found. Ask admin to create your gardener account.");
      setLoading(false);
      return;
    }

    if ((caretakerRow.status || "").toUpperCase() !== "ACTIVE") {
      setMessage("Your gardener account is not active.");
      setLoading(false);
      return;
    }

    setCaretaker(caretakerRow);

    const caretakerId = caretakerRow.id;

    const { data: assignmentRows } = await supabase
      .from("caretaker_assignments")
      .select("*")
      .eq("caretaker_id", caretakerId)
      .order("created_at", { ascending: false });

    const { data: taskRows } = await supabase
      .from("caretaker_task_logs")
      .select("*")
      .eq("caretaker_id", caretakerId)
      .order("created_at", { ascending: false });

    const { data: photoRows } = await supabase
      .from("tree_photo_updates")
      .select("*")
      .eq("caretaker_id", caretakerId)
      .order("created_at", { ascending: false });

    const { data: gpsRows } = await supabase
      .from("tree_gps_logs")
      .select("*")
      .eq("caretaker_id", caretakerId)
      .order("created_at", { ascending: false });

    const { data: healthRows } = await supabase
      .from("tree_health_reports")
      .select("*")
      .eq("caretaker_id", caretakerId)
      .order("created_at", { ascending: false });

    const { data: concernRows } = await supabase
      .from("caretaker_concern_reports")
      .select("*")
      .eq("caretaker_id", caretakerId)
      .order("created_at", { ascending: false });

    setAssignments(assignmentRows || []);
    setTasks(taskRows || []);
    setPhotos(photoRows || []);
    setGps(gpsRows || []);
    setHealth(healthRows || []);
    setConcerns(concernRows || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const activeJobs = assignments.filter((item) => {
      const status = String(item.status || "ASSIGNED").toUpperCase();
      return status !== "COMPLETED";
    }).length;

    const inProgress = assignments.filter(
      (item) => String(item.status || "").toUpperCase() === "IN_PROGRESS"
    ).length;

    const completed = assignments.filter(
      (item) => String(item.status || "").toUpperCase() === "COMPLETED"
    ).length;

    const assignedTasks = tasks.filter(
      (item) => String(item.status || "ASSIGNED").toUpperCase() === "ASSIGNED"
    ).length;

    const completedTasks = tasks.filter(
      (item) => String(item.status || "").toUpperCase() === "COMPLETED"
    ).length;

    return {
      activeJobs,
      inProgress,
      completed,
      assignedTasks,
      completedTasks,
    };
  }, [assignments, tasks]);

  return (
    <main style={pageStyle}>
      <section style={shellStyle}>
        <div style={headerStyle}>
          <div>
            <p style={eyebrowStyle}>Arganwood Field Operations</p>
            <h1 style={titleStyle}>Gardener Dashboard</h1>
            <p style={subtitleStyle}>
              Monitor assigned trees, active jobs, task progress, GPS logs, photos,
              health reports, and concerns.
            </p>
          </div>

          <div style={profileCardStyle}>
            <p style={smallLabelStyle}>Gardener</p>
            <h3 style={{ margin: "8px 0 0", color: "#244536" }}>
              {caretaker?.full_name || caretaker?.email || "—"}
            </h3>
            <p style={{ margin: "6px 0 0", color: "#667366", fontWeight: 800 }}>
              {caretaker?.status || "ACTIVE"}
            </p>
          </div>
        </div>

        {message && <div style={messageStyle}>{message}</div>}

        {loading ? (
          <div style={cardStyle}>Loading gardener dashboard...</div>
        ) : (
          <>
            <section style={gridStyle}>
              <Card label="Active Jobs" value={String(stats.activeJobs)} />
              <Card label="In Progress" value={String(stats.inProgress)} />
              <Card label="Completed Jobs" value={String(stats.completed)} />
              <Card label="Assigned Tasks" value={String(stats.assignedTasks)} />
              <Card label="Finished Tasks" value={String(stats.completedTasks)} />
              <Card label="Photo Updates" value={String(photos.length)} />
              <Card label="GPS Logs" value={String(gps.length)} />
              <Card label="Health Reports" value={String(health.length)} />
            </section>

            <section style={twoColumnStyle}>
              <div style={panelStyle}>
                <h2 style={panelTitleStyle}>Latest Assigned Jobs</h2>

                {assignments.length === 0 ? (
                  <p style={emptyStyle}>No assignments yet.</p>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {assignments.slice(0, 5).map((item) => {
                      const status = String(item.status || "ASSIGNED").toUpperCase();

                      return (
                        <div key={item.id} style={rowStyle}>
                          <div>
                            <strong style={{ color: "#244536" }}>
                              {item.assignment_type || "Tree Assignment"}
                            </strong>
                            <p style={rowTextStyle}>Tree: {item.tree_id || "—"}</p>
                            <p style={rowTextStyle}>
                              Request: {item.operation_request_id || "—"}
                            </p>
                          </div>

                          <span style={getBadgeStyle(status)}>
                            {status.replace("_", " ")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={panelStyle}>
                <h2 style={panelTitleStyle}>Latest Tasks</h2>

                {tasks.length === 0 ? (
                  <p style={emptyStyle}>No tasks yet.</p>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {tasks.slice(0, 5).map((item) => {
                      const status = String(item.status || "ASSIGNED").toUpperCase();

                      return (
                        <div key={item.id} style={rowStyle}>
                          <div>
                            <strong style={{ color: "#244536" }}>
                              {item.task_type || "Tree Task"}
                            </strong>
                            <p style={rowTextStyle}>Tree: {item.tree_id || "—"}</p>
                            <p style={rowTextStyle}>
                              Request: {item.operation_request_id || "—"}
                            </p>
                          </div>

                          <span style={getBadgeStyle(status)}>
                            {status.replace("_", " ")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <section style={panelStyle}>
              <h2 style={panelTitleStyle}>Field Activity Summary</h2>

              <div style={summaryGridStyle}>
                <Summary label="Photos Uploaded" value={photos.length} />
                <Summary label="GPS Checks" value={gps.length} />
                <Summary label="Health Reports" value={health.length} />
                <Summary label="Concern Reports" value={concerns.length} />
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div style={cardStyle}>
      <p style={cardLabelStyle}>{label}</p>
      <h3 style={cardValueStyle}>{value}</h3>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div style={summaryCardStyle}>
      <p style={smallLabelStyle}>{label}</p>
      <h3 style={{ margin: "8px 0 0", color: "#244536", fontSize: 26 }}>
        {value}
      </h3>
    </div>
  );
}

function getBadgeStyle(status: string): React.CSSProperties {
  return {
    height: "fit-content",
    borderRadius: 999,
    padding: "8px 12px",
    background:
      status === "COMPLETED"
        ? "#1f6f4a"
        : status === "IN_PROGRESS"
        ? "#b98124"
        : "#244536",
    color: "white",
    fontWeight: 900,
    whiteSpace: "nowrap",
  };
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
  textTransform: "uppercase",
  letterSpacing: 1,
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

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 16,
  marginTop: 24,
};

const cardStyle: React.CSSProperties = {
  borderRadius: 24,
  background: "rgba(255,255,255,.92)",
  border: "1px solid rgba(255,255,255,.22)",
  boxShadow: "0 18px 42px rgba(0,0,0,.16)",
  padding: 22,
  backdropFilter: "blur(8px)",
};

const profileCardStyle: React.CSSProperties = {
  ...cardStyle,
  minWidth: 260,
};

const cardLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#6b6b62",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const cardValueStyle: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: 30,
  color: "#244536",
  fontWeight: 900,
};

const smallLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#6b6b62",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".08em",
};

const twoColumnStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 16,
  marginTop: 24,
};

const panelStyle: React.CSSProperties = {
  ...cardStyle,
  marginTop: 24,
};

const panelTitleStyle: React.CSSProperties = {
  marginTop: 0,
  color: "#244536",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: 16,
  borderRadius: 18,
  background: "#f3ead8",
};

const rowTextStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#667366",
  fontWeight: 700,
};

const emptyStyle: React.CSSProperties = {
  color: "#667366",
  fontWeight: 800,
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 14,
};

const summaryCardStyle: React.CSSProperties = {
  borderRadius: 18,
  background: "#f3ead8",
  padding: 16,
};

const messageStyle: React.CSSProperties = {
  ...cardStyle,
  marginTop: 20,
  color: "#31553d",
  fontWeight: 900,
};