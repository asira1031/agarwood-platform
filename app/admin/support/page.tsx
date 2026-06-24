"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type TicketStatus = "OPEN" | "IN_PROGRESS" | "CLOSED";
type AdminTab = TicketStatus | "HIGH_PRIORITY" | "NEEDS_REPLY" | "ALL";

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

const TABS: { key: AdminTab; label: string }[] = [
  { key: "OPEN", label: "Open Tickets" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "CLOSED", label: "Closed" },
  { key: "HIGH_PRIORITY", label: "Urgent / High Priority" },
  { key: "NEEDS_REPLY", label: "Unread / Needs Reply" },
  { key: "ALL", label: "All Tickets" },
];

export default function AdminSupportPage() {
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [messages, setMessages] = useState<Record<string, SupportMessage[]>>({});
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("OPEN");
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
      HIGH_PRIORITY: tickets.filter((ticket) => isHighPriority(ticket.priority)).length,
      NEEDS_REPLY: tickets.filter((ticket) => needsReply(ticket, messages)).length,
    };
  }, [tickets, messages]);

  const filteredTickets = useMemo(() => {
    if (activeTab === "ALL") return tickets;
    if (activeTab === "HIGH_PRIORITY") return tickets.filter((ticket) => isHighPriority(ticket.priority));
    if (activeTab === "NEEDS_REPLY") return tickets.filter((ticket) => needsReply(ticket, messages));
    return tickets.filter((ticket) => normalizeStatus(ticket.status) === activeTab);
  }, [activeTab, messages, tickets]);

  const selectedMessages = selectedTicket ? messages[selectedTicket.id] || [] : [];

  useEffect(() => {
    loadSupportCenter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resolveAdminProfile() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error("Admin auth lookup failed:", authError);
      throw new Error("admin not authorized: auth lookup failed");
    }

    if (!authData.user) {
      throw new Error("admin not authorized: please login first");
    }

    const user = authData.user;
    const email = user.email?.trim() || "";

    const { data: profileById, error: profileByIdError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    if (profileByIdError) {
      console.error("Admin profile lookup by id failed:", profileByIdError);
    }

    let profileByEmail: Profile | null = null;

    if (email) {
      const { data: profileByEmailData, error: profileByEmailError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .ilike("email", email)
        .maybeSingle();

      if (profileByEmailError) {
        console.error("Admin profile lookup by email failed:", profileByEmailError);
      }

      profileByEmail = profileByEmailData as Profile | null;
    }

    const resolvedProfile = (profileById || profileByEmail) as Profile | null;

    if (!resolvedProfile) {
      throw new Error("admin not authorized: profile not found");
    }

    await verifyAdminAccess(resolvedProfile, email);

    return resolvedProfile;
  }

  async function verifyAdminAccess(profile: Profile, email: string) {
    const checks: any[] = [];

    const byProfileId = await supabase
      .from("admins")
      .select("*")
      .eq("admin_profile_id", profile.id)
      .limit(1)
      .maybeSingle();

    if (byProfileId.error) {
      console.error("Admin authorization check by admin_profile_id failed:", byProfileId.error);
    } else if (byProfileId.data) {
      checks.push(byProfileId.data);
    }

    if (email) {
      const byEmail = await supabase
        .from("admins")
        .select("*")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();

      if (byEmail.error) {
        console.error("Admin authorization check by email failed:", byEmail.error);
      } else if (byEmail.data) {
        checks.push(byEmail.data);
      }
    }

    if (checks.length === 0) {
      throw new Error("admin not authorized");
    }

    const activeAdmin = checks.find((row) => String(row?.status || "ACTIVE").toUpperCase() === "ACTIVE");

    if (!activeAdmin) {
      throw new Error("admin not authorized: admin account is not ACTIVE");
    }
  }

  async function loadSupportCenter(keepSelectedId?: string) {
    try {
      setLoading(true);
      setUiError("");

      const resolvedProfile = await resolveAdminProfile();
      setAdminProfile(resolvedProfile);

      const { data: ticketRows, error: ticketError } = await supabase
        .from("support_tickets")
        .select("*")
        .order("updated_at", { ascending: false });

      if (ticketError) {
        console.error("ticket load failed:", ticketError);
        throw new Error(`ticket load failed: ${ticketError.message}`);
      }

      const cleanTickets = ((ticketRows || []) as Ticket[])
        .map((ticket) => ({ ...ticket, status: normalizeStatus(ticket.status) }))
        .sort((a, b) => dateMs(b.updated_at || b.created_at) - dateMs(a.updated_at || a.created_at));

      setTickets(cleanTickets);

      if (cleanTickets.length === 0) {
        setSelectedTicket(null);
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

      const nextSelected =
        cleanTickets.find((ticket) => ticket.id === (keepSelectedId || selectedTicket?.id)) ||
        cleanTickets.find((ticket) => normalizeStatus(ticket.status) === activeTab) ||
        cleanTickets[0];

      setSelectedTicket(nextSelected);
    } catch (error: any) {
      const messageText = error?.message || "ticket load failed";
      setUiError(messageText);
      console.error("Admin support center load failed:", error);
    } finally {
      setLoading(false);
    }
  }

  async function sendAdminReply() {
    if (!adminProfile) {
      setUiError("admin not authorized");
      return;
    }

    if (!selectedTicket) return;

    if (!replyMessage.trim()) {
      setUiError("Please enter your admin reply.");
      return;
    }

    try {
      setSaving(true);
      setUiError("");

      const now = new Date().toISOString();
      const cleanReply = replyMessage.trim();
      const currentStatus = normalizeStatus(selectedTicket.status);
      const nextStatus = currentStatus === "OPEN" ? "IN_PROGRESS" : currentStatus;

      await insertSupportMessage({
        ticketId: selectedTicket.id,
        profileId: adminProfile.id,
        role: "ADMIN",
        email: adminProfile.email,
        text: cleanReply,
        errorPrefix: "message send failed",
      });

      const { error: updateError } = await supabase
        .from("support_tickets")
        .update({
          status: nextStatus,
          admin_reply: cleanReply,
          updated_at: now,
        })
        .eq("id", selectedTicket.id);

      if (updateError) {
        console.error("message send failed: support_tickets update failed:", updateError);
        throw new Error(`message send failed: ${updateError.message}`);
      }

      setReplyMessage("");
      await loadSupportCenter(selectedTicket.id);
    } catch (error: any) {
      const messageText = error?.message || "message send failed";
      setUiError(messageText);
      console.error("Admin reply failed:", error);
    } finally {
      setSaving(false);
    }
  }

  async function updateTicketStatus(ticket: Ticket, status: TicketStatus) {
    try {
      setSaving(true);
      setUiError("");

      const { error } = await supabase
        .from("support_tickets")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticket.id);

      if (error) {
        console.error("ticket status update failed:", error);
        throw new Error(`ticket status update failed: ${error.message}`);
      }

      await loadSupportCenter(ticket.id);
    } catch (error: any) {
      const messageText = error?.message || "ticket status update failed";
      setUiError(messageText);
      console.error("Admin status action failed:", error);
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

  function selectTab(tab: AdminTab) {
    setActiveTab(tab);

    let first: Ticket | undefined;

    if (tab === "ALL") first = tickets[0];
    else if (tab === "HIGH_PRIORITY") first = tickets.find((ticket) => isHighPriority(ticket.priority));
    else if (tab === "NEEDS_REPLY") first = tickets.find((ticket) => needsReply(ticket, messages));
    else first = tickets.find((ticket) => normalizeStatus(ticket.status) === tab);

    if (first) setSelectedTicket(first);
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
              Admin Live Chat Center
            </p>
            <h1 className="mt-4 text-4xl md:text-5xl font-serif font-bold">
              Ticket Inbox
            </h1>
            <p className="mt-4 text-white/85 max-w-xl">
              Receive customer support tickets, open the conversation, reply as Admin Support, and close or reopen cases.
            </p>
            <p className="mt-3 text-sm text-white/60">
              Admin:{" "}
              <span className="text-amber-200">
                {adminProfile?.full_name || adminProfile?.email || "Admin"}
              </span>
            </p>
          </div>
        </section>

        {uiError ? (
          <section className="mt-5 rounded-2xl border border-red-400/40 bg-red-500/10 p-4 text-red-200">
            {uiError}
          </section>
        ) : null}

        <section className="mt-5 grid grid-cols-2 lg:grid-cols-6 gap-4">
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

        <section className="mt-5 grid grid-cols-1 lg:grid-cols-[450px_1fr] gap-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-lg">Ticket List</h2>
                <p className="text-white/60 text-sm">{activeTabLabel(activeTab)}.</p>
              </div>
              <button
                onClick={() => loadSupportCenter(selectedTicket?.id)}
                disabled={saving}
                className="rounded-xl border border-emerald-400/40 px-4 py-2 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/10 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>

            <div className="mt-5 space-y-3 max-h-[820px] overflow-y-auto pr-1">
              {filteredTickets.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-white/60">
                  No support tickets yet.
                </div>
              ) : (
                filteredTickets.map((ticket) => {
                  const latest = latestMessage(ticket, messages);
                  const preview = latest?.message || ticket.message || "No message preview.";

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
                          <p className="mt-1 text-xs text-white/70 truncate">
                            {ticket.customer_name || "Customer"} • {ticket.customer_email || "No email"}
                          </p>
                          <p className="mt-1 text-xs text-white/55">
                            {ticket.category || "GENERAL"} • {ticket.priority || "NORMAL"}
                          </p>
                          <p className="mt-2 text-sm text-white/80 line-clamp-2">{preview}</p>
                          <p className="mt-2 text-xs text-white/45">
                            Created {formatDate(ticket.created_at)} • Updated {formatDate(ticket.updated_at || ticket.created_at)}
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

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            {!selectedTicket ? (
              <div className="rounded-3xl border border-white/10 bg-black/20 p-8 text-white/60">
                Select a ticket to view the full support_messages conversation.
              </div>
            ) : (
              <div className="flex min-h-[860px] flex-col">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                    <div>
                      <p className="text-amber-300 text-xs font-bold tracking-[0.2em] uppercase">
                        Conversation Panel
                      </p>
                      <h2 className="mt-2 text-2xl font-bold">{selectedTicket.subject || "Support Ticket"}</h2>
                      <p className="mt-2 text-sm text-white/60">
                        Customer: {selectedTicket.customer_name || "Customer"} • {selectedTicket.customer_email || "No email"}
                      </p>
                      <p className="mt-1 text-sm text-white/60">
                        {selectedTicket.category || "GENERAL"} • {selectedTicket.priority || "NORMAL"} Priority
                      </p>
                    </div>

                    <span className={`w-fit text-xs px-4 py-2 rounded-xl border ${statusBadge(selectedTicket.status)}`}>
                      {normalizeStatus(selectedTicket.status)}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <InfoBox label="Customer" value={selectedTicket.customer_name || "Customer"} />
                    <InfoBox label="Email" value={selectedTicket.customer_email || "No email"} />
                    <InfoBox label="Category" value={selectedTicket.category || "GENERAL"} />
                    <InfoBox label="Priority" value={selectedTicket.priority || "NORMAL"} />
                  </div>

                  <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      onClick={() => updateTicketStatus(selectedTicket, "IN_PROGRESS")}
                      disabled={saving || normalizeStatus(selectedTicket.status) === "IN_PROGRESS"}
                      className="rounded-xl border border-green-400/40 px-4 py-3 text-green-300 font-bold hover:bg-green-500/10 disabled:opacity-50"
                    >
                      Mark In Progress
                    </button>
                    <button
                      onClick={() => updateTicketStatus(selectedTicket, "CLOSED")}
                      disabled={saving || normalizeStatus(selectedTicket.status) === "CLOSED"}
                      className="rounded-xl border border-white/20 px-4 py-3 text-white/80 font-bold hover:bg-white/10 disabled:opacity-50"
                    >
                      Close Ticket
                    </button>
                    <button
                      onClick={() => updateTicketStatus(selectedTicket, "OPEN")}
                      disabled={saving || normalizeStatus(selectedTicket.status) === "OPEN"}
                      className="rounded-xl border border-amber-400/40 px-4 py-3 text-amber-300 font-bold hover:bg-amber-500/10 disabled:opacity-50"
                    >
                      Reopen Ticket
                    </button>
                  </div>
                </div>

                <div className="mt-5 flex-1 space-y-4 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-5">
                  {selectedMessages.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white/60">
                      No conversation messages yet.
                    </div>
                  ) : (
                    selectedMessages.map((msg) => {
                      const sender = normalizeSender(msg);
                      const isAdmin = sender === "ADMIN";

                      return (
                        <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[85%] rounded-2xl border p-4 ${
                              isAdmin
                                ? "border-emerald-400/25 bg-emerald-500/10"
                                : "border-amber-400/25 bg-amber-500/10"
                            }`}
                          >
                            <p className={`text-sm font-bold ${isAdmin ? "text-emerald-300" : "text-amber-200"}`}>
                              {isAdmin ? "Admin Support" : selectedTicket.customer_name || "Customer"}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-white/90">{msg.message}</p>
                            <p className="mt-3 text-xs text-white/45">
                              {msg.sender_email || (isAdmin ? adminProfile?.email : selectedTicket.customer_email) || "No email"} • {formatDate(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5">
                  <label className="block">
                    <span className="text-sm font-bold">Admin reply</span>
                    <textarea
                      className="mt-3 w-full min-h-32 rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-amber-400"
                      placeholder="Type Admin Support reply..."
                      value={replyMessage}
                      maxLength={1000}
                      onChange={(event) => setReplyMessage(event.target.value)}
                    />
                    <p className="text-right text-xs text-white/50">{replyMessage.length} / 1000</p>
                  </label>

                  <button
                    onClick={sendAdminReply}
                    disabled={saving || normalizeStatus(selectedTicket.status) === "CLOSED"}
                    className="mt-3 w-full md:w-72 float-right rounded-xl bg-gradient-to-r from-amber-400 to-yellow-600 text-black font-bold py-3 hover:opacity-90 disabled:opacity-50"
                  >
                    {saving ? "Sending..." : normalizeStatus(selectedTicket.status) === "CLOSED" ? "Ticket Closed" : "Send Admin Reply"}
                  </button>

                  <div className="clear-both" />
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-white/45 font-bold">{label}</p>
      <p className="mt-2 text-white/90 font-bold break-words">{value}</p>
    </div>
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

function isHighPriority(priority?: string | null) {
  const clean = String(priority || "").trim().toUpperCase();
  return clean === "HIGH" || clean === "URGENT";
}

function latestMessage(ticket: Ticket, messages: Record<string, SupportMessage[]>) {
  const thread = messages[ticket.id] || [];
  return thread[thread.length - 1] || null;
}

function needsReply(ticket: Ticket, messages: Record<string, SupportMessage[]>) {
  if (normalizeStatus(ticket.status) === "CLOSED") return false;
  const latest = latestMessage(ticket, messages);
  if (!latest) return true;
  return normalizeSender(latest) === "CUSTOMER";
}

function activeTabLabel(tab: AdminTab) {
  if (tab === "HIGH_PRIORITY") return "Urgent and high priority tickets";
  if (tab === "NEEDS_REPLY") return "Unread or needs reply tickets";
  if (tab === "ALL") return "All support tickets";
  if (tab === "IN_PROGRESS") return "In progress tickets";
  if (tab === "CLOSED") return "Closed tickets";
  return "Open tickets";
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
