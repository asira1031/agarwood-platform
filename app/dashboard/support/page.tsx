"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type TicketStatus = "OPEN" | "IN_PROGRESS" | "CLOSED";
type TicketTab = TicketStatus | "ALL";

type Ticket = {
  id: string;
  customer_id?: string | null;
  profile_id?: string | null;
  customer_email?: string | null;
  customer_name?: string | null;
  subject?: string | null;
  category?: string | null;
  priority?: string | null;
  status?: string | null;
  message?: string | null;
  admin_reply?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SupportMessage = {
  id: string;
  ticket_id: string | null;
  sender_profile_id?: string | null;
  sender_role?: string | null;
  sender_type?: string | null;
  sender_id?: string | null;
  sender_email?: string | null;
  message: string | null;
  created_at?: string | null;
};

const forestBg =
  "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1800&q=80";

const TABS: { key: TicketTab; label: string }[] = [
  { key: "ALL", label: "My Tickets" },
  { key: "OPEN", label: "Open" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "CLOSED", label: "Closed" },
];

export default function CustomerSupportPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [messages, setMessages] = useState<Record<string, SupportMessage[]>>({});
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [activeTab, setActiveTab] = useState<TicketTab>("ALL");

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [priority, setPriority] = useState("NORMAL");
  const [message, setMessage] = useState("");
  const [replyMessage, setReplyMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uiError, setUiError] = useState("");

  const stats = useMemo(() => {
    return {
      ALL: tickets.length,
      OPEN: tickets.filter((ticket) => normalizeStatus(ticket.status) === "OPEN").length,
      IN_PROGRESS: tickets.filter((ticket) => normalizeStatus(ticket.status) === "IN_PROGRESS").length,
      CLOSED: tickets.filter((ticket) => normalizeStatus(ticket.status) === "CLOSED").length,
    };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    if (activeTab === "ALL") return tickets;
    return tickets.filter((ticket) => normalizeStatus(ticket.status) === activeTab);
  }, [tickets, activeTab]);

  const selectedMessages = selectedTicket ? messages[selectedTicket.id] || [] : [];

  const conversationState = useMemo(() => {
    if (!selectedTicket) return "";
    if (normalizeStatus(selectedTicket.status) === "CLOSED") return "This ticket is closed. Create a new ticket if you need more help.";

    const last = selectedMessages[selectedMessages.length - 1];
    if (!last) return "Waiting for Admin Reply";

    return normalizeSender(last) === "ADMIN" ? "Admin replied" : "Waiting for Admin Reply";
  }, [selectedMessages, selectedTicket]);

  useEffect(() => {
    loadSupportCenter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resolveProfile() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error("Customer auth lookup failed:", authError);
      throw new Error("profile not found: auth lookup failed");
    }

    if (!authData.user) {
      throw new Error("profile not found: please login first");
    }

    const user = authData.user;
    const email = user.email?.trim() || "";

    const { data: profileById, error: profileByIdError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    if (profileByIdError) {
      console.error("Customer profile lookup by id failed:", profileByIdError);
    }

    let profileByEmail: Profile | null = null;

    if (email) {
      const { data: profileByEmailData, error: profileByEmailError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .ilike("email", email)
        .maybeSingle();

      if (profileByEmailError) {
        console.error("Customer profile lookup by email failed:", profileByEmailError);
      }

      profileByEmail = profileByEmailData as Profile | null;
    }

    const resolved = (profileById || profileByEmail) as Profile | null;

    if (!resolved) {
      throw new Error("profile not found");
    }

    return resolved;
  }

  async function loadSupportCenter(keepSelectedId?: string) {
    try {
      setLoading(true);
      setUiError("");

      const resolvedProfile = await resolveProfile();
      setProfile(resolvedProfile);

      let ticketRows: Ticket[] = [];

      const byCustomer = await supabase
        .from("support_tickets")
        .select("*")
        .eq("customer_id", resolvedProfile.id)
        .order("updated_at", { ascending: false });

      if (byCustomer.error) {
        console.error("ticket load failed using customer_id:", byCustomer.error);

        const byProfile = await supabase
          .from("support_tickets")
          .select("*")
          .eq("profile_id", resolvedProfile.id)
          .order("updated_at", { ascending: false });

        if (byProfile.error) {
          console.error("ticket load failed using profile_id:", byProfile.error);
          throw new Error(`ticket load failed: ${byProfile.error.message || byCustomer.error.message}`);
        }

        ticketRows = (byProfile.data || []) as Ticket[];
      } else {
        ticketRows = (byCustomer.data || []) as Ticket[];
      }

      const cleanTickets = ticketRows
        .map((ticket) => ({ ...ticket, status: normalizeStatus(ticket.status) }))
        .sort((a, b) => dateMs(b.updated_at || b.created_at) - dateMs(a.updated_at || a.created_at));

      setTickets(cleanTickets);

      const nextSelected =
        cleanTickets.find((ticket) => ticket.id === (keepSelectedId || selectedTicket?.id)) ||
        cleanTickets[0] ||
        null;

      setSelectedTicket(nextSelected);

      if (cleanTickets.length === 0) {
        setMessages({});
        return;
      }

      const ticketIds = cleanTickets.map((ticket) => ticket.id);

      const { data: messageRows, error: messageError } = await supabase
        .from("support_messages")
        .select("*")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: true });

      if (messageError) {
        console.error("ticket load failed: support_messages:", messageError);
        throw new Error(`ticket load failed: ${messageError.message}`);
      }

      const grouped: Record<string, SupportMessage[]> = {};

      ((messageRows || []) as SupportMessage[]).forEach((msg) => {
        if (!msg.ticket_id) return;
        if (!grouped[msg.ticket_id]) grouped[msg.ticket_id] = [];
        grouped[msg.ticket_id].push(msg);
      });

      setMessages(grouped);
    } catch (error: any) {
      const messageText = error?.message || "ticket load failed";
      setUiError(messageText);
      console.error("Customer support center load failed:", error);
    } finally {
      setLoading(false);
    }
  }

  async function createTicket() {
    if (!profile) {
      setUiError("profile not found");
      return;
    }

    if (!subject.trim()) {
      setUiError("Please enter a subject.");
      return;
    }

    if (!message.trim()) {
      setUiError("Please enter your message.");
      return;
    }

    try {
      setSaving(true);
      setUiError("");

      const now = new Date().toISOString();
      const basePayload = {
        subject: subject.trim(),
        category,
        priority,
        status: "OPEN",
        message: message.trim(),
        customer_email: profile.email,
        customer_name: profile.full_name || profile.email || "Customer",
        created_at: now,
        updated_at: now,
      };

      let ticket: Ticket | null = null;

      const insertByCustomer = await supabase
        .from("support_tickets")
        .insert({
          ...basePayload,
          customer_id: profile.id,
        })
        .select("*")
        .single();

      if (insertByCustomer.error) {
        console.error("ticket insert failed using customer_id:", insertByCustomer.error);

        const insertByProfile = await supabase
          .from("support_tickets")
          .insert({
            ...basePayload,
            profile_id: profile.id,
          })
          .select("*")
          .single();

        if (insertByProfile.error) {
          console.error("ticket insert failed using profile_id:", insertByProfile.error);
          throw new Error(`ticket insert failed: ${insertByProfile.error.message || insertByCustomer.error.message}`);
        }

        ticket = insertByProfile.data as Ticket;
      } else {
        ticket = insertByCustomer.data as Ticket;
      }

      if (!ticket?.id) {
        throw new Error("ticket insert failed: ticket id was not returned");
      }

      await insertSupportMessage({
        ticketId: ticket.id,
        profileId: profile.id,
        role: "CUSTOMER",
        email: profile.email,
        text: message.trim(),
        errorPrefix: "first message insert failed",
      });

      setSubject("");
      setCategory("GENERAL");
      setPriority("NORMAL");
      setMessage("");
      setReplyMessage("");

      await loadSupportCenter(ticket.id);
    } catch (error: any) {
      const messageText = error?.message || "ticket insert failed";
      setUiError(messageText);
      console.error("Customer ticket create failed:", error);
    } finally {
      setSaving(false);
    }
  }

  async function sendCustomerMessage() {
    if (!profile) {
      setUiError("profile not found");
      return;
    }

    if (!selectedTicket) return;

    if (normalizeStatus(selectedTicket.status) === "CLOSED") {
      setUiError("This ticket is closed. Create a new ticket if you need more help.");
      return;
    }

    if (!replyMessage.trim()) {
      setUiError("Please enter your message.");
      return;
    }

    try {
      setSaving(true);
      setUiError("");

      const now = new Date().toISOString();

      await insertSupportMessage({
        ticketId: selectedTicket.id,
        profileId: profile.id,
        role: "CUSTOMER",
        email: profile.email,
        text: replyMessage.trim(),
        errorPrefix: "message send failed",
      });

      const { error: updateError } = await supabase
        .from("support_tickets")
        .update({ updated_at: now })
        .eq("id", selectedTicket.id);

      if (updateError) {
        console.error("message send failed: ticket updated_at update failed:", updateError);
        throw new Error(`message send failed: ${updateError.message}`);
      }

      setReplyMessage("");
      await loadSupportCenter(selectedTicket.id);
    } catch (error: any) {
      const messageText = error?.message || "message send failed";
      setUiError(messageText);
      console.error("Customer support message send failed:", error);
    } finally {
      setSaving(false);
    }
  }

  async function insertSupportMessage({
    ticketId,
    profileId,
    role,
    email,
    text,
    errorPrefix,
  }: {
    ticketId: string;
    profileId: string;
    role: "CUSTOMER" | "ADMIN";
    email: string | null;
    text: string;
    errorPrefix: string;
  }) {
    const now = new Date().toISOString();

    const requestedPayload = {
      ticket_id: ticketId,
      sender_profile_id: profileId,
      sender_role: role,
      message: text,
      created_at: now,
    };

    const requestedInsert = await supabase.from("support_messages").insert(requestedPayload);

    if (!requestedInsert.error) return;

    console.error(`${errorPrefix} using sender_profile_id/sender_role:`, requestedInsert.error);

    const existingPayload = {
      ticket_id: ticketId,
      sender_type: role,
      sender_id: profileId,
      sender_email: email,
      message: text,
      created_at: now,
    };

    const existingInsert = await supabase.from("support_messages").insert(existingPayload);

    if (existingInsert.error) {
      console.error(`${errorPrefix} using sender_type/sender_id:`, existingInsert.error);
      throw new Error(`${errorPrefix}: ${existingInsert.error.message || requestedInsert.error.message}`);
    }
  }

  function selectTab(tab: TicketTab) {
    setActiveTab(tab);
    const first =
      tab === "ALL"
        ? tickets[0]
        : tickets.find((ticket) => normalizeStatus(ticket.status) === tab);
    if (first) setSelectedTicket(first);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#020b06] text-white flex items-center justify-center">
        <div className="rounded-3xl border border-amber-400/20 bg-white/5 px-8 py-6 text-amber-200">
          Loading Admin Support...
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
            backgroundImage: `linear-gradient(90deg, rgba(2,11,6,.98), rgba(2,11,6,.66), rgba(2,11,6,.25)), url(${forestBg})`,
          }}
        >
          <div className="relative z-10 max-w-3xl">
            <p className="text-amber-300 text-sm font-bold tracking-[0.25em] uppercase">
              Admin Support
            </p>
            <h1 className="mt-4 text-4xl md:text-5xl font-serif font-bold">
              Live Support Center
            </h1>
            <p className="mt-4 text-white/85 max-w-xl">
              Create a ticket, continue the same conversation, and receive replies from Admin Support.
            </p>
            <p className="mt-3 text-sm text-white/60">
              Customer: <span className="text-amber-200">{profile?.full_name || profile?.email || "Customer"}</span>
            </p>
          </div>
        </section>

        {uiError ? (
          <section className="mt-5 rounded-2xl border border-red-400/40 bg-red-500/10 p-4 text-red-200">
            {uiError}
          </section>
        ) : null}

        <section className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => selectTab(tab.key)}
              className={`rounded-3xl border p-5 text-left transition ${
                activeTab === tab.key
                  ? "border-amber-400 bg-amber-400 text-black"
                  : "border-white/10 bg-white/[0.04] text-white hover:border-amber-400/40"
              }`}
            >
              <p className="text-sm font-bold">{tab.label}</p>
              <p className="mt-3 text-4xl font-bold">{stats[tab.key]}</p>
            </button>
          ))}
        </section>

        <section className="mt-5 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-5">
          <div className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <h2 className="font-bold text-lg">Create Ticket</h2>
              <p className="text-white/60 text-sm">Start a new Admin Support conversation.</p>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-sm font-semibold">Subject</span>
                  <input
                    className="mt-2 w-full rounded-xl bg-black/25 border border-white/10 px-4 py-3 outline-none focus:border-amber-400"
                    placeholder="Example: Wallet cash-in concern"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold">Category</span>
                  <select
                    className="mt-2 w-full rounded-xl bg-black/25 border border-white/10 px-4 py-3 outline-none focus:border-amber-400"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    <option value="GENERAL">General</option>
                    <option value="ACCOUNT">Account</option>
                    <option value="WALLET">Wallet</option>
                    <option value="TREE">Tree</option>
                    <option value="MARKETPLACE">Marketplace</option>
                    <option value="TREE_OPERATIONS">Tree Operations</option>
                    <option value="SELL_TREE">Sell Tree</option>
                    <option value="CARE_PROGRAM">Care Program</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold">Priority</span>
                  <select
                    className="mt-2 w-full rounded-xl bg-black/25 border border-white/10 px-4 py-3 outline-none focus:border-amber-400"
                    value={priority}
                    onChange={(event) => setPriority(event.target.value)}
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
                    placeholder="Tell Admin Support what happened..."
                    value={message}
                    maxLength={1000}
                    onChange={(event) => setMessage(event.target.value)}
                  />
                  <p className="text-right text-xs text-white/50">{message.length} / 1000</p>
                </label>

                <button
                  onClick={createTicket}
                  disabled={saving}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-yellow-600 text-black font-bold py-3 hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Create Ticket"}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-lg">My Tickets</h2>
                  <p className="text-white/60 text-sm">Open / In Progress / Closed tabs.</p>
                </div>
                <button
                  onClick={() => loadSupportCenter(selectedTicket?.id)}
                  disabled={saving}
                  className="rounded-xl border border-emerald-400/40 px-4 py-2 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/10 disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-5 space-y-3 max-h-[620px] overflow-y-auto pr-1">
                {filteredTickets.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-white/60">
                    No support tickets yet.
                  </div>
                ) : (
                  filteredTickets.map((ticket) => {
                    const last = (messages[ticket.id] || [])[messages[ticket.id]?.length - 1];
                    const lastSender = normalizeSender(last);

                    return (
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
                            <p className="font-bold truncate">{ticket.subject || "Support Ticket"}</p>
                            <p className="mt-1 text-xs text-white/60">
                              {ticket.category || "GENERAL"} • {ticket.priority || "NORMAL"}
                            </p>
                            <p className="mt-1 text-xs text-white/50 truncate">
                              {last ? (lastSender === "ADMIN" ? "Admin replied" : "Waiting for Admin Reply") : "Waiting for Admin Reply"}
                            </p>
                            <p className="mt-1 text-xs text-white/45">
                              Updated {formatDate(ticket.updated_at || ticket.created_at)}
                            </p>
                          </div>
                          <span className={`shrink-0 text-xs px-3 py-1 rounded-full border ${statusBadge(ticket.status)}`}>
                            {normalizeStatus(ticket.status)}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            {!selectedTicket ? (
              <div className="rounded-3xl border border-white/10 bg-black/20 p-8 text-white/60">
                Select a ticket to view the Conversation.
              </div>
            ) : (
              <div className="flex min-h-[760px] flex-col">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <p className="text-amber-300 text-xs font-bold tracking-[0.2em] uppercase">
                        Conversation
                      </p>
                      <h2 className="mt-2 text-2xl font-bold">{selectedTicket.subject || "Support Ticket"}</h2>
                      <p className="mt-2 text-sm text-white/60">
                        Admin Support • {selectedTicket.category || "GENERAL"} • {selectedTicket.priority || "NORMAL"}
                      </p>
                      <p className="mt-2 text-sm text-emerald-300">{conversationState}</p>
                    </div>
                    <span className={`w-fit text-xs px-4 py-2 rounded-xl border ${statusBadge(selectedTicket.status)}`}>
                      {normalizeStatus(selectedTicket.status)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex-1 space-y-4 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-5">
                  {selectedMessages.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white/60">
                      No messages yet.
                    </div>
                  ) : (
                    selectedMessages.map((msg) => {
                      const sender = normalizeSender(msg);
                      const isCustomer = sender === "CUSTOMER";

                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl border p-4 ${
                              isCustomer
                                ? "border-amber-400/25 bg-amber-500/10"
                                : "border-emerald-400/25 bg-emerald-500/10"
                            }`}
                          >
                            <p className={`text-sm font-bold ${isCustomer ? "text-amber-200" : "text-emerald-300"}`}>
                              {isCustomer ? "You" : "Admin Support"}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-white/90">{msg.message}</p>
                            <p className="mt-3 text-xs text-white/45">{formatDate(msg.created_at)}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5">
                  {normalizeStatus(selectedTicket.status) === "CLOSED" ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/70">
                      This ticket is closed. Create a new ticket if you need more help.
                    </div>
                  ) : (
                    <>
                      <label className="block">
                        <span className="text-sm font-bold">Send Message</span>
                        <textarea
                          className="mt-3 w-full min-h-28 rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-amber-400"
                          placeholder="Type your message to Admin Support..."
                          value={replyMessage}
                          maxLength={1000}
                          onChange={(event) => setReplyMessage(event.target.value)}
                        />
                        <p className="text-right text-xs text-white/50">{replyMessage.length} / 1000</p>
                      </label>

                      <button
                        onClick={sendCustomerMessage}
                        disabled={saving}
                        className="mt-3 w-full md:w-72 float-right rounded-xl bg-gradient-to-r from-amber-400 to-yellow-600 text-black font-bold py-3 hover:opacity-90 disabled:opacity-50"
                      >
                        {saving ? "Sending..." : "Send Message"}
                      </button>
                      <div className="clear-both" />
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function normalizeStatus(status?: string | null): TicketStatus {
  const clean = String(status || "OPEN").trim().toUpperCase();

  if (clean === "IN_PROGRESS") return "IN_PROGRESS";
  if (clean === "CLOSED" || clean === "RESOLVED") return "CLOSED";

  return "OPEN";
}

function normalizeSender(message?: SupportMessage | null) {
  const role = String(message?.sender_role || message?.sender_type || "CUSTOMER").trim().toUpperCase();
  return role === "ADMIN" ? "ADMIN" : "CUSTOMER";
}

function statusBadge(status?: string | null) {
  const s = normalizeStatus(status);

  if (s === "CLOSED") return "bg-white/10 text-white/70 border-white/20";
  if (s === "IN_PROGRESS") return "bg-green-500/15 text-green-300 border-green-400/30";

  return "bg-amber-500/15 text-amber-300 border-amber-400/40";
}

function ticketIcon(status?: string | null) {
  const s = normalizeStatus(status);
  if (s === "CLOSED") return "✓";
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

function dateMs(date?: string | null) {
  if (!date) return 0;
  const value = new Date(date).getTime();
  return Number.isFinite(value) ? value : 0;
}
