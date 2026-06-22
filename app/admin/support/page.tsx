"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Ticket = Record<string, any>;
type MessageRow = Record<string, any>;
type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type TabKey = "OPEN" | "PENDING" | "RESOLVED" | "CLOSED" | "ALL";

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState("");
  const [tab, setTab] = useState<TabKey>("OPEN");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const { data: ticketRows, error: ticketError } = await supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (ticketError) {
      setMessage(ticketError.message);
      setLoading(false);
      return;
    }

    const { data: messageRows, error: messageError } = await supabase
      .from("support_messages")
      .select("*")
      .order("created_at", { ascending: true });

    if (messageError) {
      setMessage(messageError.message);
      setLoading(false);
      return;
    }

    const profileIds = Array.from(
      new Set((ticketRows || []).map((item) => item.profile_id).filter(Boolean))
    ) as string[];

    let profileRows: ProfileRow[] = [];

    if (profileIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", profileIds);

      if (profileError) {
        setMessage(profileError.message);
      } else {
        profileRows = (profileData || []) as ProfileRow[];
      }
    }

    const rows = ticketRows || [];

    setTickets(rows);
    setMessages(messageRows || []);
    setProfiles(profileRows);

    setSelectedTicket((current) => {
      if (current) {
        return rows.find((item) => item.id === current.id) || rows[0] || null;
      }

      return rows[0] || null;
    });

    setLoading(false);
  }

  function normalizeStatus(value: any) {
    return String(value || "OPEN").toUpperCase();
  }

  const openTickets = useMemo(
    () => tickets.filter((item) => normalizeStatus(item.status) === "OPEN"),
    [tickets]
  );

  const pendingTickets = useMemo(
    () => tickets.filter((item) => normalizeStatus(item.status) === "PENDING"),
    [tickets]
  );

  const resolvedTickets = useMemo(
    () => tickets.filter((item) => normalizeStatus(item.status) === "RESOLVED"),
    [tickets]
  );

  const closedTickets = useMemo(
    () => tickets.filter((item) => normalizeStatus(item.status) === "CLOSED"),
    [tickets]
  );

  const activeTickets = useMemo(() => {
    if (tab === "OPEN") return openTickets;
    if (tab === "PENDING") return pendingTickets;
    if (tab === "RESOLVED") return resolvedTickets;
    if (tab === "CLOSED") return closedTickets;
    return tickets;
  }, [tab, tickets, openTickets, pendingTickets, resolvedTickets, closedTickets]);

  const selectedMessages = useMemo(() => {
    if (!selectedTicket) return [];

    return messages.filter((item) => {
      const ticketId = String(item.ticket_id || item.support_ticket_id || "");
      return ticketId === String(selectedTicket.id);
    });
  }, [messages, selectedTicket]);

  function getProfile(profileId: string | null | undefined) {
    return profiles.find((profile) => profile.id === profileId) || null;
  }

  function formatDate(value: string | null | undefined) {
    if (!value) return "—";

    return new Date(value).toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function badgeClass(statusValue: any) {
    const status = normalizeStatus(statusValue);

    if (status === "RESOLVED") {
      return "border-emerald-400/30 bg-emerald-500/20 text-emerald-200";
    }

    if (status === "CLOSED") {
      return "border-white/10 bg-white/10 text-white/60";
    }

    if (status === "PENDING") {
      return "border-blue-400/30 bg-blue-500/20 text-blue-200";
    }

    return "border-yellow-400/30 bg-yellow-500/20 text-yellow-200";
  }

  async function sendReply() {
    setMessage("");

    if (!selectedTicket) {
      setMessage("Select a ticket first.");
      return;
    }

    if (!replyText.trim()) {
      setMessage("Reply message is required.");
      return;
    }

    setSending(true);

    const { error: insertError } = await supabase.from("support_messages").insert({
      ticket_id: selectedTicket.id,
      support_ticket_id: selectedTicket.id,
      profile_id: selectedTicket.profile_id || null,
      sender_role: "ADMIN",
      sender_type: "ADMIN",
      message: replyText.trim(),
      body: replyText.trim(),
      status: "SENT",
    });

    if (insertError) {
      setMessage(insertError.message);
      setSending(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("support_tickets")
      .update({
        status: "PENDING",
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedTicket.id);

    if (updateError) {
      setMessage(updateError.message);
      setSending(false);
      return;
    }

    setReplyText("");
    setSending(false);
    setMessage("Reply sent. Ticket moved to PENDING.");
    await loadData();
    setTab("PENDING");
  }

  async function updateTicketStatus(nextStatus: "OPEN" | "PENDING" | "RESOLVED" | "CLOSED") {
    setMessage("");

    if (!selectedTicket) {
      setMessage("Select a ticket first.");
      return;
    }

    const { error } = await supabase
      .from("support_tickets")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedTicket.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(`Ticket marked as ${nextStatus}.`);
    await loadData();
    setTab(nextStatus);
  }

  return (
    <main className="min-h-screen p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8 rounded-3xl border border-white/10 bg-[#071f16]/80 p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
              Admin Support Desk
            </p>

            <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
              Support Tickets
            </h1>

            <p className="mt-2 text-white/70">
              Review customer support tickets, reply to messages, and manage status logs.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-5 py-3 text-sm font-semibold text-[#f7d774] hover:bg-[#d9b45f]/25 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh Support"}
          </button>
        </div>

        {message && (
          <div className="rounded-2xl border border-[#d9b45f]/20 bg-[#d9b45f]/10 p-4 text-sm font-semibold text-[#ffe8a3]">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-5">
          <StatCard label="Open" value={String(openTickets.length)} />
          <StatCard label="Pending" value={String(pendingTickets.length)} />
          <StatCard label="Resolved" value={String(resolvedTickets.length)} />
          <StatCard label="Closed" value={String(closedTickets.length)} />
          <StatCard label="Total" value={String(tickets.length)} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/10 p-5">
          <div className="flex flex-wrap gap-3">
            {(["OPEN", "PENDING", "RESOLVED", "CLOSED", "ALL"] as TabKey[]).map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`rounded-full px-5 py-3 text-sm font-bold transition ${
                  tab === item
                    ? "bg-[#f7d774] text-[#071f16]"
                    : "bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-white/70">
            Loading support tickets...
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-white/70">
            No support tickets yet.
          </div>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
              <h2 className="text-2xl font-bold text-[#ffe49a]">
                Ticket Queue
              </h2>

              {activeTickets.length === 0 ? (
                <p className="mt-5 text-white/70">No tickets in this tab.</p>
              ) : (
                <div className="mt-5 space-y-3">
                  {activeTickets.map((ticket) => {
                    const profile = getProfile(ticket.profile_id);
                    const active = selectedTicket?.id === ticket.id;

                    return (
                      <button
                        key={ticket.id}
                        onClick={() => setSelectedTicket(ticket)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          active
                            ? "border-[#d9b45f]/50 bg-[#d9b45f]/15"
                            : "border-white/10 bg-black/20 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <strong className="text-white">
                            {ticket.subject || ticket.title || "Support Ticket"}
                          </strong>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(
                              ticket.status
                            )}`}
                          >
                            {normalizeStatus(ticket.status)}
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-white/60">
                          {profile?.full_name || profile?.email || ticket.profile_id || "Unknown Customer"}
                        </p>

                        <p className="mt-1 line-clamp-2 text-sm text-white/50">
                          {ticket.description || ticket.message || ticket.body || "No description."}
                        </p>

                        <p className="mt-2 text-xs text-white/40">
                          {formatDate(ticket.created_at)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              {!selectedTicket ? (
                <p className="text-white/70">Select a ticket to view conversation.</p>
              ) : (
                <>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-[#ffe49a]">
                        {selectedTicket.subject || selectedTicket.title || "Support Ticket"}
                      </h2>

                      <p className="mt-2 text-white/60">
                        Customer:{" "}
                        <b className="text-white">
                          {getProfile(selectedTicket.profile_id)?.full_name ||
                            getProfile(selectedTicket.profile_id)?.email ||
                            selectedTicket.profile_id ||
                            "Unknown Customer"}
                        </b>
                      </p>

                      <p className="mt-1 text-white/60">
                        Created: {formatDate(selectedTicket.created_at)}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(
                        selectedTicket.status
                      )}`}
                    >
                      {normalizeStatus(selectedTicket.status)}
                    </span>
                  </div>

                  <div className="mt-5 rounded-2xl bg-black/20 p-4 text-sm text-white/70">
                    {selectedTicket.description ||
                      selectedTicket.message ||
                      selectedTicket.body ||
                      "No original description."}
                  </div>

                  <div className="mt-6">
                    <h3 className="text-lg font-bold text-[#f7d774]">
                      Conversation
                    </h3>

                    {selectedMessages.length === 0 ? (
                      <p className="mt-3 rounded-2xl bg-black/20 p-4 text-white/60">
                        No messages yet.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {selectedMessages.map((item) => {
                          const role = String(
                            item.sender_role || item.sender_type || "CUSTOMER"
                          ).toUpperCase();

                          const isAdmin = role === "ADMIN";

                          return (
                            <div
                              key={item.id}
                              className={`rounded-2xl border p-4 ${
                                isAdmin
                                  ? "border-[#d9b45f]/30 bg-[#d9b45f]/10"
                                  : "border-white/10 bg-black/20"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <strong className={isAdmin ? "text-[#f7d774]" : "text-white"}>
                                  {isAdmin ? "Admin" : "Customer"}
                                </strong>

                                <small className="text-white/40">
                                  {formatDate(item.created_at)}
                                </small>
                              </div>

                              <p className="mt-2 whitespace-pre-wrap text-sm text-white/75">
                                {item.message || item.body || item.content || "No message."}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <label className="text-sm font-bold text-white/70">
                      Admin Reply
                    </label>

                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type reply to customer..."
                      className="mt-2 min-h-[120px] w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                    />

                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <button
                        onClick={sendReply}
                        disabled={sending}
                        className="rounded-xl bg-[#d9b45f] px-4 py-3 font-black text-[#071f16] disabled:opacity-50"
                      >
                        {sending ? "Sending..." : "Send Reply"}
                      </button>

                      <button
                        onClick={() => updateTicketStatus("OPEN")}
                        className="rounded-xl border border-yellow-300/30 bg-yellow-500/10 px-4 py-3 font-black text-yellow-100"
                      >
                        Open
                      </button>

                      <button
                        onClick={() => updateTicketStatus("RESOLVED")}
                        className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 font-black text-emerald-100"
                      >
                        Resolve
                      </button>

                      <button
                        onClick={() => updateTicketStatus("CLOSED")}
                        className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 font-black text-white/70"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
      <p className="text-sm text-white/70">{label}</p>
      <p className="mt-3 text-2xl font-bold text-[#d9b45f]">{value}</p>
    </div>
  );
}