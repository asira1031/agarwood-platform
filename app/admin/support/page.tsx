"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

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

const forestBg =
  "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1800&q=80";

export default function CustomerSupportCenterV6() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [messages, setMessages] = useState<Record<string, SupportMessage[]>>({});
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [priority, setPriority] = useState("NORMAL");
  const [message, setMessage] = useState("");
  const [replyMessage, setReplyMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const totalTickets = tickets.length;
  const openTickets = tickets.filter((t) => (t.status || "OPEN") === "OPEN").length;
  const inProgressTickets = tickets.filter((t) => t.status === "IN_PROGRESS").length;
  const resolvedTickets = tickets.filter((t) => t.status === "RESOLVED").length;
  const closedTickets = tickets.filter((t) => t.status === "CLOSED").length;

  const customerName = useMemo(() => {
    return profile?.full_name || profile?.email || "Customer";
  }, [profile]);

  useEffect(() => {
    loadSupportCenter();
  }, []);

  async function resolveProfile() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      throw new Error("Please login first.");
    }

    const user = authData.user;

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", user.email || "")
      .maybeSingle();

    const resolved = profileById || profileByEmail;

    if (!resolved) {
      throw new Error("Customer profile not found.");
    }

    return resolved as Profile;
  }

  async function loadSupportCenter() {
    try {
      setLoading(true);

      const resolvedProfile = await resolveProfile();
      setProfile(resolvedProfile);

      const { data: ticketRows, error: ticketError } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("customer_id", resolvedProfile.id)
        .order("created_at", { ascending: false });

      if (ticketError) throw ticketError;

      const cleanTickets = (ticketRows || []) as Ticket[];
      setTickets(cleanTickets);

      if (!selectedTicket && cleanTickets.length > 0) {
        setSelectedTicket(cleanTickets[0]);
      }

      if (cleanTickets.length > 0) {
        const ticketIds = cleanTickets.map((t) => t.id);

        const { data: messageRows, error: messageError } = await supabase
          .from("support_messages")
          .select("*")
          .in("ticket_id", ticketIds)
          .order("created_at", { ascending: true });

        if (messageError) throw messageError;

        const grouped: Record<string, SupportMessage[]> = {};

        (messageRows || []).forEach((msg: SupportMessage) => {
          if (!msg.ticket_id) return;
          if (!grouped[msg.ticket_id]) grouped[msg.ticket_id] = [];
          grouped[msg.ticket_id].push(msg);
        });

        setMessages(grouped);
      } else {
        setMessages({});
      }
    } catch (error: any) {
      alert(error.message || "Failed to load support center.");
    } finally {
      setLoading(false);
    }
  }

  async function createTicket() {
    if (!profile) return alert("Profile not found.");
    if (!subject.trim()) return alert("Please enter a subject.");
    if (!message.trim()) return alert("Please enter your message.");

    try {
      setSaving(true);

      const { data: ticketData, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({
          customer_id: profile.id,
          customer_email: profile.email,
          customer_name: profile.full_name || profile.email || "Customer",
          subject: subject.trim(),
          status: "OPEN",
          category,
          priority,
          message: message.trim(),
          admin_reply: null,
        })
        .select("*")
        .single();

      if (ticketError) throw ticketError;

      const ticket = ticketData as Ticket;

      const { error: messageError } = await supabase.from("support_messages").insert({
        ticket_id: ticket.id,
        sender_type: "CUSTOMER",
        sender_id: profile.id,
        sender_email: profile.email,
        message: message.trim(),
      });

      if (messageError) throw messageError;

      setSubject("");
      setCategory("GENERAL");
      setPriority("NORMAL");
      setMessage("");
      setSelectedTicket(ticket);

      await loadSupportCenter();
      alert("Support ticket created.");
    } catch (error: any) {
      alert(error.message || "Failed to create ticket.");
    } finally {
      setSaving(false);
    }
  }

  async function replyToTicket(ticket: Ticket) {
    if (!profile) return alert("Profile not found.");
    if (!replyMessage.trim()) return alert("Please enter your reply.");

    try {
      setSaving(true);

      if (ticket.status === "CLOSED" || ticket.status === "RESOLVED") {
        const { error: reopenError } = await supabase
          .from("support_tickets")
          .update({ status: "OPEN" })
          .eq("id", ticket.id)
          .eq("customer_id", profile.id);

        if (reopenError) throw reopenError;
      }

      const { error: replyError } = await supabase.from("support_messages").insert({
        ticket_id: ticket.id,
        sender_type: "CUSTOMER",
        sender_id: profile.id,
        sender_email: profile.email,
        message: replyMessage.trim(),
      });

      if (replyError) throw replyError;

      setReplyMessage("");
      await loadSupportCenter();
      alert("Reply sent.");
    } catch (error: any) {
      alert(error.message || "Failed to send reply.");
    } finally {
      setSaving(false);
    }
  }

  async function reopenTicket(ticket: Ticket) {
    if (!profile) return alert("Profile not found.");

    try {
      setSaving(true);

      const { error } = await supabase
        .from("support_tickets")
        .update({ status: "OPEN" })
        .eq("id", ticket.id)
        .eq("customer_id", profile.id);

      if (error) throw error;

      await loadSupportCenter();
      alert("Ticket reopened.");
    } catch (error: any) {
      alert(error.message || "Failed to reopen ticket.");
    } finally {
      setSaving(false);
    }
  }

  function statusBadge(status?: string | null) {
    const s = status || "OPEN";

    if (s === "CLOSED") return "bg-white/10 text-white/70 border-white/20";
    if (s === "RESOLVED") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
    if (s === "IN_PROGRESS") return "bg-green-500/15 text-green-300 border-green-400/30";
    return "bg-amber-500/15 text-amber-300 border-amber-400/40";
  }

  function formatDate(date?: string | null) {
    if (!date) return "";
    return new Date(date).toLocaleString();
  }

  function ticketIcon(status?: string | null) {
    const s = status || "OPEN";
    if (s === "RESOLVED") return "✓";
    if (s === "CLOSED") return "▣";
    if (s === "IN_PROGRESS") return "⌁";
    return "!";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#020b06] text-white flex items-center justify-center">
        <div className="rounded-3xl border border-amber-400/20 bg-white/5 px-8 py-6 text-amber-200">
          Loading Customer Support Center...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020b06] text-white p-4 md:p-6">
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-emerald-400/20 bg-[#03110b]/95 p-4 md:p-6 shadow-2xl">
        <section
          className="relative overflow-hidden rounded-[2rem] border border-emerald-300/20 bg-cover bg-center p-8 md:p-12"
          style={{ backgroundImage: `linear-gradient(90deg, rgba(2,11,6,.98), rgba(2,11,6,.65), rgba(2,11,6,.25)), url(${forestBg})` }}
        >
          <div className="relative z-10 max-w-3xl">
            <p className="text-amber-300 text-sm font-bold tracking-[0.25em] uppercase">
              Customer Support
            </p>
            <h1 className="mt-4 text-4xl md:text-5xl font-serif font-bold">
              Customer Support Center V6
            </h1>
            <p className="mt-4 text-white/85 max-w-xl">
              We&apos;re here to help. Create tickets, view admin replies, and manage your support concerns.
            </p>
            <p className="mt-3 text-sm text-white/60">
              Customer: <span className="text-amber-200">{customerName}</span>
            </p>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            ["🎧", "Open Tickets", openTickets],
            ["🛡️", "In Progress", inProgressTickets],
            ["✅", "Resolved", resolvedTickets],
            ["🔒", "Closed", closedTickets],
            ["☰", "Total Tickets", totalTickets],
          ].map(([icon, label, value]) => (
            <div key={String(label)} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-emerald-500/15 flex items-center justify-center text-xl">
                  {icon}
                </div>
                <p className="text-sm font-semibold text-white/85">{label}</p>
              </div>
              <p className="mt-4 text-4xl font-bold">{value}</p>
              <p className="text-white/70 text-sm">Tickets</p>
            </div>
          ))}
        </section>

        <section className="mt-5 grid grid-cols-1 lg:grid-cols-[430px_1fr] gap-5">
          <div className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full border border-amber-400 text-amber-300 flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h2 className="font-bold text-lg">CREATE TICKET</h2>
                  <p className="text-white/60 text-sm">Submit a new support request.</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-sm font-semibold">Subject</span>
                  <input
                    className="mt-2 w-full rounded-xl bg-black/25 border border-white/10 px-4 py-3 outline-none focus:border-amber-400"
                    placeholder="Enter subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold">Category</span>
                  <select
                    className="mt-2 w-full rounded-xl bg-black/25 border border-white/10 px-4 py-3 outline-none focus:border-amber-400"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="GENERAL">General Inquiry</option>
                    <option value="TREE">Tree Concern</option>
                    <option value="WALLET">Wallet</option>
                    <option value="SELL_TREE">Sell Tree</option>
                    <option value="CARE_PROGRAM">Care Program</option>
                    <option value="ACCOUNT">Account</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold">Priority</span>
                  <select
                    className="mt-2 w-full rounded-xl bg-black/25 border border-white/10 px-4 py-3 outline-none focus:border-amber-400"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold">Message</span>
                  <textarea
                    className="mt-2 w-full min-h-32 rounded-xl bg-black/25 border border-white/10 px-4 py-3 outline-none focus:border-amber-400"
                    placeholder="Describe your concern..."
                    value={message}
                    maxLength={1000}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <p className="text-right text-xs text-white/50">{message.length} / 1000</p>
                </label>

                <button
                  onClick={createTicket}
                  disabled={saving}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-yellow-600 text-black font-bold py-3 hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Create Ticket ✈"}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full border border-amber-400 text-amber-300 flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h2 className="font-bold text-lg">TICKET HISTORY</h2>
                  <p className="text-white/60 text-sm">Your support tickets.</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {tickets.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-white/60">
                    No support tickets yet.
                  </div>
                ) : (
                  tickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selectedTicket?.id === ticket.id
                          ? "border-amber-400/60 bg-amber-500/10"
                          : "border-white/10 bg-black/20 hover:border-amber-400/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-300 flex items-center justify-center font-bold">
                          {ticketIcon(ticket.status)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="font-bold truncate">{ticket.subject || "Support Ticket"}</p>
                          <p className="text-xs text-white/60">
                            {ticket.category || "GENERAL"} • {ticket.priority || "NORMAL"}
                          </p>
                          <p className="text-xs text-white/50">{formatDate(ticket.created_at)}</p>
                        </div>

                        <span className={`text-xs px-3 py-1 rounded-full border ${statusBadge(ticket.status)}`}>
                          {ticket.status || "OPEN"}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full border border-amber-400 text-amber-300 flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h2 className="font-bold text-lg">CONVERSATION</h2>
                  <p className="text-white/60 text-sm">Ticket details and conversation.</p>
                </div>
              </div>

              {selectedTicket &&
              (selectedTicket.status === "CLOSED" || selectedTicket.status === "RESOLVED") ? (
                <button
                  onClick={() => reopenTicket(selectedTicket)}
                  disabled={saving}
                  className="rounded-xl border border-emerald-400/40 px-5 py-3 text-emerald-300 font-semibold hover:bg-emerald-500/10 disabled:opacity-50"
                >
                  ↻ Reopen Ticket
                </button>
              ) : null}
            </div>

            {!selectedTicket ? (
              <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-8 text-white/60">
                Select a ticket to view conversation.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full border border-amber-400 bg-amber-500/10 text-amber-300 flex items-center justify-center text-2xl font-bold">
                      {ticketIcon(selectedTicket.status)}
                    </div>

                    <div className="flex-1">
                      <h3 className="text-xl font-bold">{selectedTicket.subject || "Support Ticket"}</h3>
                      <p className="text-sm text-white/60">
                        {selectedTicket.category || "GENERAL"} • {selectedTicket.priority || "NORMAL"} Priority
                      </p>
                    </div>

                    <span className={`text-xs px-4 py-2 rounded-xl border ${statusBadge(selectedTicket.status)}`}>
                      {selectedTicket.status || "OPEN"}
                    </span>
                  </div>
                </div>

                {selectedTicket.admin_reply && (
                  <div className="rounded-2xl border border-amber-400/40 bg-emerald-500/10 p-5">
                    <p className="text-emerald-300 font-bold">Latest Admin Reply</p>
                    <p className="mt-2 text-white/85">{selectedTicket.admin_reply}</p>
                  </div>
                )}

                <div className="space-y-4">
                  {(messages[selectedTicket.id] || []).length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-white/60">
                      No replies yet.
                    </div>
                  ) : (
                    (messages[selectedTicket.id] || []).map((msg) => {
                      const isCustomer = msg.sender_type === "CUSTOMER";

                      return (
                        <div
                          key={msg.id}
                          className={`rounded-2xl border p-5 ${
                            isCustomer
                              ? "border-amber-400/20 bg-amber-500/10"
                              : "border-emerald-400/20 bg-emerald-500/10"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div
                              className={`h-11 w-11 rounded-full flex items-center justify-center ${
                                isCustomer
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-emerald-500/20 text-emerald-300"
                              }`}
                            >
                              {isCustomer ? "👤" : "🎧"}
                            </div>

                            <div>
                              <p className={`font-bold ${isCustomer ? "text-white" : "text-emerald-300"}`}>
                                {isCustomer ? "You (Customer)" : "Admin"}
                              </p>
                              <p className="mt-2 text-white/85">{msg.message}</p>
                              <p className="mt-3 text-xs text-white/45">{formatDate(msg.created_at)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <label className="block">
                    <span className="text-sm font-bold">Reply to this ticket</span>
                    <textarea
                      className="mt-3 w-full min-h-28 rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-amber-400"
                      placeholder="Type your reply..."
                      value={replyMessage}
                      maxLength={1000}
                      onChange={(e) => setReplyMessage(e.target.value)}
                    />
                    <p className="text-right text-xs text-white/50">{replyMessage.length} / 1000</p>
                  </label>

                  <button
                    onClick={() => replyToTicket(selectedTicket)}
                    disabled={saving}
                    className="mt-3 w-full md:w-72 float-right rounded-xl bg-gradient-to-r from-amber-400 to-yellow-600 text-black font-bold py-3 hover:opacity-90 disabled:opacity-50"
                  >
                    Send Reply ✈
                  </button>

                  <div className="clear-both" />
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-3xl">
              🌿
            </div>
            <div>
              <h3 className="text-xl font-bold">Need more help?</h3>
              <p className="text-white/70">Our support team is ready to assist you with your concerns.</p>
            </div>
          </div>

          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="rounded-xl border border-emerald-400/40 px-8 py-3 text-emerald-300 font-semibold hover:bg-emerald-500/10"
          >
            Contact Support
          </button>
        </section>

        <footer className="py-8 text-center">
          <p className="text-amber-300 font-serif text-xl font-bold">ARGANWOOD</p>
          <p className="text-xs text-white/45">Growing a Greener Tomorrow 🌿</p>
        </footer>
      </div>
    </main>
  );
}