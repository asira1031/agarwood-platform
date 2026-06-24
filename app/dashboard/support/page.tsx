"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

type Ticket = {
  id: string;
  customer_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  subject: string | null;
  status: string | null;
  category: string | null;
  priority: string | null;
  message: string | null;
  admin_reply: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SupportMessage = {
  id: string;
  ticket_id: string | null;
  sender_type: string | null;
  sender_id: string | null;
  sender_email: string | null;
  message: string | null;
  created_at?: string | null;
};

const TABS: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

const forestBg =
  "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1800&q=80";

export default function AdminSupportCenterPage() {
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [messages, setMessages] = useState<Record<string, SupportMessage[]>>({});
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [activeTab, setActiveTab] = useState<TicketStatus>("OPEN");
  const [replyMessage, setReplyMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSupportCenter();
  }, []);

  const stats = useMemo(() => {
    return {
      OPEN: tickets.filter((t) => normalizeStatus(t.status) === "OPEN").length,
      IN_PROGRESS: tickets.filter((t) => normalizeStatus(t.status) === "IN_PROGRESS").length,
      RESOLVED: tickets.filter((t) => normalizeStatus(t.status) === "RESOLVED").length,
      CLOSED: tickets.filter((t) => normalizeStatus(t.status) === "CLOSED").length,
      TOTAL: tickets.length,
    };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => normalizeStatus(ticket.status) === activeTab);
  }, [tickets, activeTab]);

  async function resolveAdminProfile() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      throw new Error("Please login first.");
    }

    const user = authData.user;
    const email = user.email?.trim() || "";

    const { data: profileById, error: profileByIdError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", user.id)
      .limit(1)
      .maybeSingle();

    if (profileByIdError) throw profileByIdError;

    let profileByEmail: Profile | null = null;

    if (email) {
      const { data: profileByEmailData, error: profileByEmailError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();

      if (profileByEmailError) throw profileByEmailError;
      profileByEmail = profileByEmailData as Profile | null;
    }

    const resolvedProfile = (profileById || profileByEmail) as Profile | null;

    if (!resolvedProfile) {
      throw new Error("Admin profile not found.");
    }

    return resolvedProfile;
  }

  async function loadSupportCenter() {
    try {
      setLoading(true);

      const resolvedProfile = await resolveAdminProfile();
      setAdminProfile(resolvedProfile);

      const { data: ticketRows, error: ticketError } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (ticketError) throw ticketError;

      const cleanTickets = ((ticketRows || []) as Ticket[]).map((ticket) => ({
        ...ticket,
        status: normalizeStatus(ticket.status),
      }));

      setTickets(cleanTickets);

      const currentSelectedStillExists =
        selectedTicket && cleanTickets.some((ticket) => ticket.id === selectedTicket.id);

      if (currentSelectedStillExists && selectedTicket) {
        const refreshedSelected =
          cleanTickets.find((ticket) => ticket.id === selectedTicket.id) || selectedTicket;
        setSelectedTicket(refreshedSelected);
      } else {
        const preferred =
          cleanTickets.find((ticket) => normalizeStatus(ticket.status) === activeTab) ||
          cleanTickets[0] ||
          null;

        setSelectedTicket(preferred);
      }

      if (cleanTickets.length > 0) {
        const ticketIds = cleanTickets.map((ticket) => ticket.id);

        const { data: messageRows, error: messageError } = await supabase
          .from("support_messages")
          .select("*")
          .in("ticket_id", ticketIds)
          .order("created_at", { ascending: true });

        if (messageError) throw messageError;

        const grouped: Record<string, SupportMessage[]> = {};

        ((messageRows || []) as SupportMessage[]).forEach((msg) => {
          if (!msg.ticket_id) return;
          if (!grouped[msg.ticket_id]) grouped[msg.ticket_id] = [];
          grouped[msg.ticket_id].push(msg);
        });

        setMessages(grouped);
      } else {
        setMessages({});
      }
    } catch (error: any) {
      alert(error?.message || "Failed to load admin support center.");
    } finally {
      setLoading(false);
    }
  }

  async function replyToTicket(ticket: Ticket) {
    if (!adminProfile) return alert("Admin profile not found.");
    if (!replyMessage.trim()) return alert("Please enter your reply.");

    try {
      setSaving(true);

      const cleanReply = replyMessage.trim();
      const nextStatus =
        normalizeStatus(ticket.status) === "OPEN" ? "IN_PROGRESS" : normalizeStatus(ticket.status);

      const { error: replyError } = await supabase.from("support_messages").insert({
        ticket_id: ticket.id,
        sender_type: "ADMIN",
        sender_id: adminProfile.id,
        sender_email: adminProfile.email,
        message: cleanReply,
      });

      if (replyError) throw replyError;

      const { error: ticketUpdateError } = await supabase
        .from("support_tickets")
        .update({
          admin_reply: cleanReply,
          status: nextStatus,
        })
        .eq("id", ticket.id);

      if (ticketUpdateError) throw ticketUpdateError;

      setReplyMessage("");
      await loadSupportCenter();
      alert("Admin reply sent.");
    } catch (error: any) {
      alert(error?.message || "Failed to send admin reply.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTicketStatus(ticket: Ticket, status: TicketStatus) {
    try {
      setSaving(true);

      const { error } = await supabase
        .from("support_tickets")
        .update({ status })
        .eq("id", ticket.id);

      if (error) throw error;

      await loadSupportCenter();
      alert(`Ticket marked as ${status}.`);
    } catch (error: any) {
      alert(error?.message || "Failed to update ticket status.");
    } finally {
      setSaving(false);
    }
  }

  function selectTab(tab: TicketStatus) {
    setActiveTab(tab);

    const firstInTab = tickets.find((ticket) => normalizeStatus(ticket.status) === tab);
    if (firstInTab) setSelectedTicket(firstInTab);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#020b06] text-white flex items-center justify-center">
        <div className="rounded-3xl border border-amber-400/20 bg-white/5 px-8 py-6 text-amber-200">
          Loading Admin Support Center...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020b06] text-white p-4 md:p-6">
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-emerald-400/20 bg-[#03110b]/95 p-4 md:p-6 shadow-2xl">
        <section
          className="relative overflow-hidden rounded-[2rem] border border-emerald-300/20 bg-cover bg-center p-8 md:p-12"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(2,11,6,.98), rgba(2,11,6,.72), rgba(2,11,6,.28)), url(${forestBg})`,
          }}
        >
          <div className="relative z-10 max-w-3xl">
            <p className="text-amber-300 text-sm font-bold tracking-[0.25em] uppercase">
              Admin Support Desk
            </p>
            <h1 className="mt-4 text-4xl md:text-5xl font-serif font-bold">
              Support Agent Center
            </h1>
            <p className="mt-4 text-white/85 max-w-xl">
              Review customer tickets, read conversation history, reply as admin,
              and move cases through the support queue.
            </p>
            <p className="mt-3 text-sm text-white/60">
              Agent:{" "}
              <span className="text-amber-200">
                {adminProfile?.full_name || adminProfile?.email || "Admin"}
              </span>
            </p>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            ["OPEN", "Open", stats.OPEN],
            ["IN_PROGRESS", "In Progress", stats.IN_PROGRESS],
            ["RESOLVED", "Resolved", stats.RESOLVED],
            ["CLOSED", "Closed", stats.CLOSED],
            ["TOTAL", "Total Tickets", stats.TOTAL],
          ].map(([key, label, value]) => (
            <div key={String(key)} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-sm font-semibold text-white/70">{label}</p>
              <p className="mt-3 text-4xl font-bold text-amber-200">{value}</p>
              <p className="text-white/45 text-sm">Customer support cases</p>
            </div>
          ))}
        </section>

        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => selectTab(tab)}
                className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
                  activeTab === tab
                    ? "bg-amber-400 text-black"
                    : "bg-black/25 text-white/75 hover:bg-white/10"
                }`}
              >
                {labelStatus(tab)} ({stats[tab]})
              </button>
            ))}
          </div>
        </section>

        <section className="mt-5 grid grid-cols-1 lg:grid-cols-[430px_1fr] gap-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-lg">TICKET QUEUE</h2>
                <p className="text-white/60 text-sm">
                  {labelStatus(activeTab)} customer tickets.
                </p>
              </div>

              <button
                onClick={loadSupportCenter}
                disabled={saving}
                className="rounded-xl border border-emerald-400/40 px-4 py-2 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/10 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>

            <div className="mt-5 space-y-3 max-h-[720px] overflow-y-auto pr-1">
              {filteredTickets.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-white/60">
                  No {labelStatus(activeTab).toLowerCase()} tickets.
                </div>
              ) : (
                filteredTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedTicket?.id === ticket.id
                        ? "border-amber-400/60 bg-amber-500/10"
                        : "border-white/10 bg-black/20 hover:border-amber-400/40"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-11 w-11 shrink-0 rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-300 flex items-center justify-center font-bold">
                        {ticketIcon(ticket.status)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-bold truncate">
                          {ticket.subject || "Support Ticket"}
                        </p>
                        <p className="mt-1 text-xs text-white/70 truncate">
                          {ticket.customer_name || "Customer"} •{" "}
                          {ticket.customer_email || "No email"}
                        </p>
                        <p className="mt-1 text-xs text-white/50">
                          {ticket.category || "GENERAL"} •{" "}
                          {ticket.priority || "NORMAL"} • {formatDate(ticket.created_at)}
                        </p>
                      </div>

                      <span className={`shrink-0 text-xs px-3 py-1 rounded-full border ${statusBadge(ticket.status)}`}>
                        {normalizeStatus(ticket.status)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            {!selectedTicket ? (
              <div className="rounded-3xl border border-white/10 bg-black/20 p-8 text-white/60">
                Select a ticket to view customer details and conversation.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                  <div>
                    <p className="text-amber-300 text-xs font-bold tracking-[0.2em] uppercase">
                      Ticket Conversation
                    </p>
                    <h2 className="mt-2 text-2xl font-bold">
                      {selectedTicket.subject || "Support Ticket"}
                    </h2>
                    <p className="mt-2 text-white/60 text-sm">
                      Created {formatDate(selectedTicket.created_at)}
                    </p>
                  </div>

                  <span className={`w-fit text-xs px-4 py-2 rounded-xl border ${statusBadge(selectedTicket.status)}`}>
                    {normalizeStatus(selectedTicket.status)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <InfoBox label="Customer" value={selectedTicket.customer_name || "Customer"} />
                  <InfoBox label="Email" value={selectedTicket.customer_email || "No email"} />
                  <InfoBox label="Priority" value={selectedTicket.priority || "NORMAL"} />
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-sm font-bold text-white/60">Customer Message</p>
                  <p className="mt-3 text-white/90 whitespace-pre-wrap">
                    {selectedTicket.message || "No ticket message."}
                  </p>
                </div>

                {selectedTicket.admin_reply && (
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5">
                    <p className="text-emerald-300 font-bold">Latest Admin Reply</p>
                    <p className="mt-2 text-white/85 whitespace-pre-wrap">
                      {selectedTicket.admin_reply}
                    </p>
                  </div>
                )}

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-lg">Status Controls</h3>
                      <p className="text-white/55 text-sm">
                        Move this case through the admin support queue.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {TABS.map((status) => (
                      <button
                        key={status}
                        onClick={() => updateTicketStatus(selectedTicket, status)}
                        disabled={saving || normalizeStatus(selectedTicket.status) === status}
                        className={`rounded-xl px-3 py-3 text-xs font-bold border transition disabled:opacity-50 ${
                          normalizeStatus(selectedTicket.status) === status
                            ? "bg-amber-400 text-black border-amber-300"
                            : "border-white/10 bg-white/5 text-white/75 hover:border-amber-400/40"
                        }`}
                      >
                        {labelStatus(status)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-lg">Conversation Thread</h3>

                  {(messages[selectedTicket.id] || []).length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-white/60">
                      No conversation messages yet.
                    </div>
                  ) : (
                    (messages[selectedTicket.id] || []).map((msg) => {
                      const sender = normalizeSender(msg.sender_type);

                      return (
                        <div
                          key={msg.id}
                          className={`rounded-2xl border p-5 ${
                            sender === "ADMIN"
                              ? "border-emerald-400/20 bg-emerald-500/10"
                              : "border-amber-400/20 bg-amber-500/10"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div
                              className={`h-11 w-11 rounded-full flex items-center justify-center ${
                                sender === "ADMIN"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-amber-500/20 text-amber-300"
                              }`}
                            >
                              {sender === "ADMIN" ? "🎧" : "👤"}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className={`font-bold ${sender === "ADMIN" ? "text-emerald-300" : "text-white"}`}>
                                {sender === "ADMIN" ? "Admin Support" : "Customer"}
                              </p>
                              <p className="mt-2 text-white/85 whitespace-pre-wrap">
                                {msg.message}
                              </p>
                              <p className="mt-3 text-xs text-white/45">
                                {msg.sender_email || "No email"} • {formatDate(msg.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <label className="block">
                    <span className="text-sm font-bold">Admin Reply</span>
                    <textarea
                      className="mt-3 w-full min-h-32 rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-amber-400"
                      placeholder="Type admin reply to customer..."
                      value={replyMessage}
                      maxLength={1000}
                      onChange={(e) => setReplyMessage(e.target.value)}
                    />
                    <p className="text-right text-xs text-white/50">
                      {replyMessage.length} / 1000
                    </p>
                  </label>

                  <button
                    onClick={() => replyToTicket(selectedTicket)}
                    disabled={saving}
                    className="mt-3 w-full md:w-72 float-right rounded-xl bg-gradient-to-r from-amber-400 to-yellow-600 text-black font-bold py-3 hover:opacity-90 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Send Admin Reply"}
                  </button>

                  <div className="clear-both" />
                </div>
              </div>
            )}
          </div>
        </section>

        <footer className="py-8 text-center">
          <p className="text-amber-300 font-serif text-xl font-bold">ARGANWOOD</p>
          <p className="text-xs text-white/45">Admin Support Operations</p>
        </footer>
      </div>
    </main>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-white/45 font-bold">{label}</p>
      <p className="mt-2 text-white/90 font-bold break-words">{value}</p>
    </div>
  );
}

function normalizeStatus(status?: string | null): TicketStatus {
  const clean = String(status || "OPEN").trim().toUpperCase();

  if (clean === "IN_PROGRESS") return "IN_PROGRESS";
  if (clean === "RESOLVED") return "RESOLVED";
  if (clean === "CLOSED") return "CLOSED";

  return "OPEN";
}

function normalizeSender(sender?: string | null) {
  const clean = String(sender || "CUSTOMER").trim().toUpperCase();
  return clean === "ADMIN" ? "ADMIN" : "CUSTOMER";
}

function labelStatus(status: string) {
  if (status === "IN_PROGRESS") return "In Progress";
  return status
    .toLowerCase()
    .split("_")
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(" ");
}

function statusBadge(status?: string | null) {
  const s = normalizeStatus(status);

  if (s === "CLOSED") return "bg-white/10 text-white/70 border-white/20";
  if (s === "RESOLVED") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (s === "IN_PROGRESS") return "bg-green-500/15 text-green-300 border-green-400/30";
  return "bg-amber-500/15 text-amber-300 border-amber-400/40";
}

function ticketIcon(status?: string | null) {
  const s = normalizeStatus(status);

  if (s === "RESOLVED") return "✓";
  if (s === "CLOSED") return "▣";
  if (s === "IN_PROGRESS") return "⌁";

  return "!";
}

function formatDate(date?: string | null) {
  if (!date) return "No date";
  return new Date(date).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}