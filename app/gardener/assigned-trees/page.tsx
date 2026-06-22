"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function GardenerAssignedTreesPage() {
  const [caretaker, setCaretaker] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
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

    setAssignments(assignmentRows || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <main style={{ padding: 30 }}>
      <p style={{ color: "#8c6a3c", fontWeight: 900, textTransform: "uppercase" }}>
        Arganwood Gardener Portal
      </p>

      <h1 style={{ margin: 0, fontSize: 42 }}>Assigned Trees</h1>

      <p style={{ maxWidth: 850, color: "#5f665e" }}>
        These are the trees and operation jobs assigned to your gardener account.
      </p>

      {message && <div style={messageStyle}>{message}</div>}

      {loading ? (
        <div style={cardStyle}>Loading assigned trees...</div>
      ) : assignments.length === 0 ? (
        <div style={cardStyle}>No assigned trees yet.</div>
      ) : (
        <section style={{ display: "grid", gap: 14, marginTop: 24 }}>
          {assignments.map((item) => (
            <div key={item.id} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <p style={eyebrowStyle}>{item.assignment_type || "Tree Assignment"}</p>
                  <h2 style={{ margin: "6px 0 0", color: "#10281f" }}>
                    Tree: {item.tree_id || "—"}
                  </h2>
                  <p style={{ margin: "8px 0 0", color: "#5f665e" }}>
                    Customer: {item.customer_profile_id || "—"}
                  </p>
                  <p style={{ margin: "4px 0 0", color: "#5f665e" }}>
                    Operation Request: {item.operation_request_id || "—"}
                  </p>
                  {item.notes && (
                    <p style={{ margin: "10px 0 0", color: "#5f665e" }}>
                      Notes: {item.notes}
                    </p>
                  )}
                </div>

                <span style={badgeStyle}>{item.status || "ASSIGNED"}</span>
              </div>
            </div>
          ))}
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
  height: "fit-content",
  borderRadius: 999,
  padding: "8px 12px",
  background: "#244536",
  color: "white",
  fontWeight: 900,
};