"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type TicketStatus = "OPEN" | "IN_PROGRESS" | "CLOSED";

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
  "/images/arganwood-reference/premium-background.png";

export default function CustomerSupportPage() {
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
  const [uiMessage, setUiMessage] = useState("");

  const selectedMessages = selectedTicket ? messages[selectedTicket.id] || [] : [];

  const openTickets = useMemo(
    () => tickets.filter((ticket) => normalizeStatus(ticket.status) === "OPEN"),
    [tickets]
  );

  const pendingSupportReply = useMemo(
    () => tickets.filter((ticket) => needsSupportReply(ticket, messages)),
    [tickets, messages]
  );

  const closedTickets = useMemo(
    () => tickets.filter((ticket) => normalizeStatus(ticket.status) === "CLOSED"),
    [tickets]
  );

  useEffect(() => {
    loadSupportCenter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resolveProfile() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      throw new Error("Please login first.");
    }

    const user = authData.user;
    const email = user.email?.trim() || "";

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    if (profileById) return profileById as Profile;

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .ilike("email", email)
      .maybeSingle();

    if (!profileByEmail) {
      throw new Error("Customer profile not found.");
    }

    return profileByEmail as Profile;
  }

  async function loadSupportCenter(keepSelectedId?: string) {
    try {
      setLoading(true);
      setUiMessage("");

      const resolvedProfile = await resolveProfile();
      setProfile(resolvedProfile);

      let ticketRows: any[] = [];

      const eitherResult = await supabase
        .from("support_tickets")
        .select("*")
        .or(`profile_id.eq.${resolvedProfile.id},customer_id.eq.${resolvedProfile.id}`)
        .order("updated_at", { ascending: false });

      if (!eitherResult.error) {
        ticketRows = eitherResult.data || [];
      } else {
        const profileOnlyResult = await supabase
          .from("support_tickets")
          .select("*")
          .eq("profile_id", resolvedProfile.id)
          .order("updated_at", { ascending: false });

        if (!profileOnlyResult.error) {
          ticketRows = profileOnlyResult.data || [];
        } else {
          const customerOnlyResult = await supabase
            .from("support_tickets")
            .select("*")
            .eq("customer_id", resolvedProfile.id)
            .order("updated_at", { ascending: false });

          if (!customerOnlyResult.error) {
            ticketRows = customerOnlyResult.data || [];
          } else {
            throw profileOnlyResult.error || customerOnlyResult.error || eitherResult.error;
          }
        }
      }

      const cleanTickets = ((ticketRows || []) as Ticket[])
        .map((ticket) => ({ ...ticket, status: normalizeStatus(ticket.status) }))
        .sort(
          (a, b) =>
            dateMs(b.updated_at || b.created_at) - dateMs(a.updated_at || a.created_at)
        );

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

      if (messageError) throw messageError;

      const grouped: Record<string, SupportMessage[]> = {};

      ((messageRows || []) as SupportMessage[]).forEach((msg) => {
        if (!msg.ticket_id) return;
        if (!grouped[msg.ticket_id]) grouped[msg.ticket_id] = [];
        grouped[msg.ticket_id].push(msg);
      });

      setMessages(grouped);

      const nextSelected =
        cleanTickets.find((ticket) => ticket.id === keepSelectedId) ||
        cleanTickets.find((ticket) => normalizeStatus(ticket.status) !== "CLOSED") ||
        cleanTickets[0];

      setSelectedTicket(nextSelected);
    } catch (error: any) {
      setUiMessage("Support tickets could not load. Please refresh or contact Arganwood Support.");
    } finally {
      setLoading(false);
    }
  }

  async function insertSupportMessage({
    ticketId,
    profileId,
    role,
    email,
    text,
  }: {
    ticketId: string;
    profileId: string;
    role: "CUSTOMER" | "ADMIN";
    email: string | null;
    text: string;
  }) {
    const now = new Date().toISOString();

    const modernPayload = {
      ticket_id: ticketId,
      sender_profile_id: profileId,
      sender_role: role,
      message: text,
      created_at: now,
    };

    const modernInsert = await supabase.from("support_messages").insert(modernPayload);

    if (!modernInsert.error) return;

    const fallbackPayload = {
      ticket_id: ticketId,
      sender_type: role,
      sender_id: profileId,
      sender_email: email,
      message: text,
      created_at: now,
    };

    const fallbackInsert = await supabase
      .from("support_messages")
      .insert(fallbackPayload);

    if (fallbackInsert.error) {
      throw new Error(
        fallbackInsert.error.message || modernInsert.error.message || "Message failed."
      );
    }
  }

  async function createTicket() {
    if (!profile) return setUiMessage("Customer profile not found.");
    if (!subject.trim()) return setUiMessage("Please enter a support subject.");
    if (!message.trim()) return setUiMessage("Please enter your support message.");

    try {
      setSaving(true);
      setUiMessage("");

      const now = new Date().toISOString();
      const cleanSubject = subject.trim();
      const cleanMessage = message.trim();

      const ticketPayload = {
        profile_id: profile.id,
        customer_id: profile.id,
        customer_name: profile.full_name,
        customer_email: profile.email,
        subject: cleanSubject,
        category,
        priority,
        status: "OPEN",
        message: cleanMessage,
        created_at: now,
        updated_at: now,
      };

      const { data: ticketData, error: ticketError } = await supabase
        .from("support_tickets")
        .insert(ticketPayload)
        .select("*")
        .single();

      if (ticketError) {
        const fallbackPayload = {
          profile_id: profile.id,
          subject: cleanSubject,
          category,
          priority,
          status: "OPEN",
          message: cleanMessage,
          created_at: now,
          updated_at: now,
        };

        const { data: fallbackTicket, error: fallbackError } = await supabase
          .from("support_tickets")
          .insert(fallbackPayload)
          .select("*")
          .single();

        if (fallbackError) throw fallbackError;

        await insertSupportMessage({
          ticketId: fallbackTicket.id,
          profileId: profile.id,
          role: "CUSTOMER",
          email: profile.email,
          text: cleanMessage,
        });

        setSubject("");
        setMessage("");
        setCategory("GENERAL");
        setPriority("NORMAL");
        await loadSupportCenter(fallbackTicket.id);
        setUiMessage("Message sent to Admin Support.");
        return;
      }

      await insertSupportMessage({
        ticketId: ticketData.id,
        profileId: profile.id,
        role: "CUSTOMER",
        email: profile.email,
        text: cleanMessage,
      });

      setSubject("");
      setMessage("");
      setCategory("GENERAL");
      setPriority("NORMAL");

      await loadSupportCenter(ticketData.id);
      setUiMessage("Message sent to Admin Support.");
    } catch (error: any) {
      setUiMessage("Support ticket could not be created. Please review the subject and message, then try again.");
    } finally {
      setSaving(false);
    }
  }

  async function sendCustomerReply() {
    if (!profile) return setUiMessage("Customer profile not found.");
    if (!selectedTicket) return;
    if (!replyMessage.trim()) return setUiMessage("Please enter your reply.");

    try {
      setSaving(true);
      setUiMessage("");

      const cleanReply = replyMessage.trim();
      const now = new Date().toISOString();

      await insertSupportMessage({
        ticketId: selectedTicket.id,
        profileId: profile.id,
        role: "CUSTOMER",
        email: profile.email,
        text: cleanReply,
      });

      const { error: updateError } = await supabase
        .from("support_tickets")
        .update({
          status: normalizeStatus(selectedTicket.status) === "CLOSED" ? "OPEN" : selectedTicket.status || "OPEN",
          updated_at: now,
        })
        .eq("id", selectedTicket.id);

      if (updateError) throw updateError;

      setReplyMessage("");
      await loadSupportCenter(selectedTicket.id);
      setUiMessage("Reply sent to Admin Support.");
    } catch (error: any) {
      setUiMessage("Reply could not be sent. Please try again.");
    } finally {
      setSaving(false);
    }
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
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(2,11,6,.98), rgba(2,11,6,.72), rgba(2,11,6,.28)), url(${forestBg})`,
          }}
        >
          <div className="relative z-10 max-w-3xl">
            <p className="text-amber-300 text-sm font-bold tracking-[0.25em] uppercase">
              Customer Support Center
            </p>
            <h1 className="mt-4 text-4xl md:text-5xl font-serif font-bold">
              Message Admin Support
            </h1>
            <p className="mt-4 text-white/85 max-w-xl">
              Create a support request and continue the same Support Conversation
              when Admin Support replies.
            </p>
            <p className="mt-3 text-sm text-white/60">
              Customer:{" "}
              <span className="text-amber-200">
                {profile?.full_name || profile?.email || "Customer"}
              </span>
            </p>
          </div>
        </section>

        {uiMessage ? (
          <section className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-amber-100">
            {uiMessage}
          </section>
        ) : null}

        <section className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="Open Support" value={openTickets.length} icon="💬" />
          <StatCard title="Pending Support Reply" value={pendingSupportReply.length} icon="⏳" />
          <StatCard title="Resolved Conversations" value={closedTickets.length} icon="✅" />
        </section>

        <section className="mt-5 grid grid-cols-1 lg:grid-cols-[430px_1fr] gap-5">
          <div className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <StepHeader
                step="1"
                title="Message Admin Support"
                subtitle="Send your concern to the support team."
              />

              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-sm font-semibold">Subject</span>
                  <input
                    className="mt-2 w-full rounded-xl bg-black/25 border border-white/10 px-4 py-3 outline-none focus:border-amber-400"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="Example: Tree purchase concern"
                    maxLength={120}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold">Category</span>
                  <select
                    className="mt-2 w-full rounded-xl bg-black/25 border border-white/10 px-4 py-3 outline-none focus:border-amber-400"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    <option value="GENERAL">General Support</option>
                    <option value="WALLET">Wallet / Payment</option>
                    <option value="TREE">Tree / Forest</option>
                    <option value="MARKETPLACE">Marketplace</option>
                    <option value="KYC">KYC / Profile</option>
                    <option value="PAYOUT">Withdrawal / Payout</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold">Priority</span>
                  <select
                    className="mt-2 w-full rounded-xl bg-black/25 border border-white/10 px-4 py-3 outline-none focus:border-amber-400"
                    value={priority}
                    onChange={(event) => setPriority(event.target.value)}
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold">Your Message</span>
                  <textarea
                    className="mt-2 w-full min-h-36 rounded-xl bg-black/25 border border-white/10 px-4 py-3 outline-none focus:border-amber-400"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Type your message for Admin Support..."
                    maxLength={1000}
                  />
                  <p className="mt-1 text-right text-xs text-white/45">
                    {message.length} / 1000
                  </p>
                </label>

                <button
                  onClick={createTicket}
                  disabled={saving}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-yellow-600 text-black font-bold py-3 hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Sending..." : "Send to Admin Support"}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between">
                <StepHeader
                  step="2"
                  title="Your Support Requests"
                  subtitle="Open a ticket to continue chatting."
                />

                <button
                  onClick={() => loadSupportCenter(selectedTicket?.id)}
                  disabled={saving}
                  className="rounded-xl border border-emerald-400/40 px-4 py-2 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/10 disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-6 space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {tickets.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-white/60">
                    No support requests yet.
                  </div>
                ) : (
                  tickets.map((ticket) => {
                    const latest = latestMessage(ticket, messages);
                    const preview = latest?.message || ticket.message || "No message preview.";
                    const waiting = needsSupportReply(ticket, messages);

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
                            <p className="font-bold truncate">
                              {ticket.subject || "Support Conversation"}
                            </p>
                            <p className="mt-1 text-xs text-white/55">
                              {customerCategory(ticket.category)} • {customerPriority(ticket.priority)}
                            </p>
                            <p className="mt-2 text-sm text-white/80 line-clamp-2">
                              {preview}
                            </p>
                            <p className="mt-2 text-xs text-white/45">
                              Updated {formatDate(ticket.updated_at || ticket.created_at)}
                            </p>

                            {waiting ? (
                              <p className="mt-2 w-fit rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-200">
                                Pending Support Reply
                              </p>
                            ) : null}
                          </div>

                          <span
                            className={`shrink-0 text-xs px-3 py-1 rounded-full border ${statusBadge(
                              ticket.status
                            )}`}
                          >
                            {customerStatus(ticket.status)}
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
                Select a support request to view your Support Conversation.
              </div>
            ) : (
              <div className="flex min-h-[760px] flex-col">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                    <div>
                      <p className="text-amber-300 text-xs font-bold tracking-[0.2em] uppercase">
                        Support Conversation
                      </p>
                      <h2 className="mt-2 text-2xl font-bold">
                        {selectedTicket.subject || "Support Request"}
                      </h2>
                      <p className="mt-2 text-sm text-white/60">
                        {customerCategory(selectedTicket.category)} •{" "}
                        {customerPriority(selectedTicket.priority)}
                      </p>
                    </div>

                    <span
                      className={`w-fit text-xs px-4 py-2 rounded-xl border ${statusBadge(
                        selectedTicket.status
                      )}`}
                    >
                      {customerStatus(selectedTicket.status)}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <InfoBox label="Support Status" value={customerStatus(selectedTicket.status)} />
                    <InfoBox
                      label="Reply State"
                      value={
                        needsSupportReply(selectedTicket, messages)
                          ? "Pending Support Reply"
                          : "Admin Support replied"
                      }
                    />
                    <InfoBox
                      label="Last Updated"
                      value={formatDate(selectedTicket.updated_at || selectedTicket.created_at)}
                    />
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
                        <div
                          key={msg.id}
                          className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl border p-4 ${
                              isAdmin
                                ? "border-emerald-400/25 bg-emerald-500/10"
                                : "border-amber-400/25 bg-amber-500/10"
                            }`}
                          >
                            <p
                              className={`text-sm font-bold ${
                                isAdmin ? "text-emerald-300" : "text-amber-200"
                              }`}
                            >
                              {isAdmin ? "Admin Support" : "You"}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-white/90">
                              {msg.message}
                            </p>
                            <p className="mt-3 text-xs text-white/45">
                              {formatDate(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5">
                  <label className="block">
                    <span className="text-sm font-bold">Reply to Admin Support</span>
                    <textarea
                      className="mt-3 w-full min-h-32 rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-amber-400"
                      placeholder="Type your reply..."
                      value={replyMessage}
                      maxLength={1000}
                      onChange={(event) => setReplyMessage(event.target.value)}
                    />
                    <p className="text-right text-xs text-white/50">
                      {replyMessage.length} / 1000
                    </p>
                  </label>

                  <button
                    onClick={sendCustomerReply}
                    disabled={saving}
                    className="mt-3 w-full md:w-72 float-right rounded-xl bg-gradient-to-r from-amber-400 to-yellow-600 text-black font-bold py-3 hover:opacity-90 disabled:opacity-50"
                  >
                    {saving ? "Sending..." : "Send Reply"}
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

function StepHeader({
  step,
  title,
  subtitle,
}: {
  step: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-full border border-amber-400 text-amber-300 flex items-center justify-center font-bold">
        {step}
      </div>
      <div>
        <h2 className="font-bold text-lg">{title}</h2>
        <p className="text-white/60 text-sm">{subtitle}</p>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-emerald-500/15 flex items-center justify-center text-xl">
          {icon}
        </div>
        <p className="text-sm font-semibold text-white/85">{title}</p>
      </div>
      <p className="mt-4 text-4xl font-bold">{value}</p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-white/45 font-bold">
        {label}
      </p>
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
  const role = String(message?.sender_role || message?.sender_type || "CUSTOMER")
    .trim()
    .toUpperCase();

  return role === "ADMIN" ? "ADMIN" : "CUSTOMER";
}

function latestMessage(ticket: Ticket, messages: Record<string, SupportMessage[]>) {
  const thread = messages[ticket.id] || [];
  return thread[thread.length - 1] || null;
}

function needsSupportReply(ticket: Ticket, messages: Record<string, SupportMessage[]>) {
  if (normalizeStatus(ticket.status) === "CLOSED") return false;
  const latest = latestMessage(ticket, messages);
  if (!latest) return true;
  return normalizeSender(latest) === "CUSTOMER";
}

function customerStatus(status?: string | null) {
  const s = normalizeStatus(status);

  if (s === "CLOSED") return "Resolved";
  if (s === "IN_PROGRESS") return "Admin Support Reviewing";

  return "Pending Support Reply";
}

function customerCategory(category?: string | null) {
  const clean = String(category || "GENERAL").toUpperCase();

  const labels: Record<string, string> = {
    GENERAL: "General Support",
    WALLET: "Wallet / Payment",
    TREE: "Tree / Forest",
    MARKETPLACE: "Marketplace",
    KYC: "KYC / Profile",
    PAYOUT: "Withdrawal / Payout",
  };

  return labels[clean] || "General Support";
}

function customerPriority(priority?: string | null) {
  const clean = String(priority || "NORMAL").toUpperCase();

  if (clean === "URGENT") return "Urgent";
  if (clean === "HIGH") return "High Priority";

  return "Normal Priority";
}

function statusBadge(status?: string | null) {
  const s = normalizeStatus(status);

  if (s === "CLOSED") return "bg-white/10 text-white/70 border-white/20";
  if (s === "IN_PROGRESS") {
    return "bg-green-500/15 text-green-300 border-green-400/30";
  }

  return "bg-amber-500/15 text-amber-300 border-amber-400/40";
}

function ticketIcon(status?: string | null) {
  const s = normalizeStatus(status);
  if (s === "CLOSED") return "✓";
  if (s === "IN_PROGRESS") return "💬";
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