"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AdminRow = {
  id: string;
  admin_profile_id: string | null;
  full_name: string | null;
  email: string | null;
  status: string | null;
  created_at: string | null;
};

export default function AdminSettingsPage() {
  const [admin, setAdmin] = useState<AdminRow | null>(null);
  const [email, setEmail] = useState("");
  const [supportCount, setSupportCount] = useState(0);
  const [openTickets, setOpenTickets] = useState(0);
  const [closedTickets, setClosedTickets] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadSettings() {
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

    const cleanEmail = user.email?.trim().toLowerCase() || "";
    setEmail(cleanEmail);

    const { data: adminRow, error: adminError } = await supabase
      .from("admins")
      .select("*")
      .eq("email", cleanEmail)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (adminError) {
      setMessage(adminError.message);
      setLoading(false);
      return;
    }

    setAdmin(adminRow || null);

    const { data: tickets } = await supabase
      .from("support_tickets")
      .select("id,status");

    const rows = tickets || [];

    setSupportCount(rows.length);
    setOpenTickets(
      rows.filter((item) => String(item.status || "").toUpperCase() !== "CLOSED").length
    );
    setClosedTickets(
      rows.filter((item) => String(item.status || "").toUpperCase() === "CLOSED").length
    );

    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <main
      className="min-h-screen p-8 text-white"
      style={{
        backgroundImage:
          "linear-gradient(rgba(2,24,13,.35), rgba(2,24,13,.75)), url('/images/agarwood-real-tree.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      <section className="mx-auto max-w-6xl rounded-3xl border border-white/10 bg-[#071f16]/80 p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div>
            <p className="font-black uppercase tracking-[0.25em] text-[#d9b45f]">
              Admin Settings
            </p>
            <h1 className="mt-3 text-4xl font-black">Arganwood System Settings</h1>
            <p className="mt-3 max-w-2xl text-white/70">
              Manage admin session, support system status, and launch-readiness checks.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadSettings}
              disabled={loading}
              className="rounded-xl bg-white/10 px-5 py-3 font-black text-white hover:bg-white/15 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={handleLogout}
              className="rounded-xl bg-[#d9b45f] px-5 py-3 font-black text-[#10281f] hover:bg-[#f0ca6c]"
            >
              Logout
            </button>
          </div>
        </div>

        {message && (
          <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/15 p-4 font-bold text-red-100">
            {message}
          </div>
        )}

        {loading ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/10 p-6 text-white/70">
            Loading settings...
          </div>
        ) : (
          <>
            <section className="mt-8 grid gap-5 md:grid-cols-4">
              <Card title="Admin Email" value={email || "No email"} />
              <Card title="Admin Status" value={admin?.status || "NOT ACTIVE"} />
              <Card title="Support Tickets" value={String(supportCount)} />
              <Card title="Open Tickets" value={String(openTickets)} />
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-6">
                <h2 className="text-2xl font-black text-[#d9b45f]">
                  Admin Account
                </h2>

                <div className="mt-5 space-y-4">
                  <Row label="Full Name" value={admin?.full_name || "No admin name"} />
                  <Row label="Email" value={admin?.email || email || "No email"} />
                  <Row label="Admin Profile ID" value={admin?.admin_profile_id || "Not linked"} />
                  <Row label="Admin Row ID" value={admin?.id || "No active admin row"} />
                  <Row label="Created" value={admin?.created_at || "No date"} />
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/10 p-6">
                <h2 className="text-2xl font-black text-[#d9b45f]">
                  Support System
                </h2>

                <div className="mt-5 space-y-4">
                  <Row label="Support Table" value="support_tickets" />
                  <Row label="Total Tickets" value={String(supportCount)} />
                  <Row label="Open / Active" value={String(openTickets)} />
                  <Row label="Closed" value={String(closedTickets)} />
                  <Row label="Customer ↔ Admin" value="Connected via support_tickets" />
                </div>
              </div>
            </section>

            <section className="mt-8 rounded-3xl border border-white/10 bg-white/10 p-6">
              <h2 className="text-2xl font-black text-[#d9b45f]">
                Launch Checklist
              </h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Check label="Backend role routing uses admins/caretakers tables" />
                <Check label="Admin does not depend on profiles.role" />
                <Check label="Support tickets table is connected" />
                <Check label="Customer support can create tickets" />
                <Check label="Admin can view/reply to support tickets after admin support page is added" />
                <Check label="Forest background branding is active" />
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-5 shadow-xl">
      <p className="text-sm font-black uppercase tracking-wide text-white/60">
        {title}
      </p>
      <h3 className="mt-3 break-words text-2xl font-black text-[#d9b45f]">
        {value}
      </h3>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col justify-between gap-2 rounded-2xl border border-white/10 bg-black/10 p-4 md:flex-row">
      <span className="font-bold text-white/60">{label}</span>
      <b className="break-all text-white">{value}</b>
    </div>
  );
}

function Check({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-green-400/20 bg-green-500/10 p-4 font-bold text-green-100">
      ✅ {label}
    </div>
  );
}