"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type SenderType = "CUSTOMER" | "AI" | "ADMIN" | "SYSTEM";

type ChatMessage = {
  id: string;
  sender_type: SenderType;
  message: string;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type SupportTicket = {
  id: string;
  customer_id: string | null;
  customer_email: string | null;
  customer_name?: string | null;
  subject: string | null;
  category?: string | null;
  priority?: string | null;
  status: string | null;
  message?: string | null;
  admin_reply?: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type FAQ = {
  keywords: string[];
  question: string;
  answer: string;
};

const faqs: FAQ[] = [
  {
    keywords: ["membership", "member", "annual", "renew", "payment"],
    question: "How does membership work?",
    answer:
      "Membership payments are paid from your wallet. After payment, the order waits for admin approval before your membership becomes active.",
  },
  {
    keywords: ["care", "subscription", "auto renew", "renewal", "program"],
    question: "How does care subscription work?",
    answer:
      "Tree care packages are activated from Tree Operations. Buy Once creates one paid request. Subscribe creates a paid request and an active subscription record.",
  },
  {
    keywords: ["photo", "picture", "update", "tree photo"],
    question: "Why is my tree photo not updated?",
    answer:
      "Photo updates become available after an operation request is assigned and completed by the gardener or operations team.",
  },
  {
    keywords: ["gps", "location", "verify", "verification"],
    question: "How does GPS verification work?",
    answer:
      "GPS verification is requested from Tree Operations. Once assigned and completed, the location update should be visible to the customer and admin.",
  },
  {
    keywords: ["wallet", "withdraw", "cash out", "cashin", "cash in", "add funds", "transaction"],
    question: "Where can I see wallet transactions?",
    answer:
      "All wallet movements should be recorded in wallet transactions, including marketplace buys, membership payments, cash-in, cash-out, and tree operations.",
  },
  {
    keywords: ["marketplace", "buy", "fertilizer", "product", "package"],
    question: "How do Marketplace purchases work?",
    answer:
      "Marketplace purchases deduct your wallet first, then add trees, packages, care packages, or inventory depending on the product type.",
  },
  {
    keywords: ["task", "operation", "tree operation", "watering", "gardener"],
    question: "How do tree operation requests work?",
    answer:
      "Tree operation requests are created by the customer, reviewed by admin, assigned to a gardener, then updated back to the customer after completion.",
  },
];

const quickSuggestions = faqs.map((item) => item.question);

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  try {
    return new Date(value).toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Invalid date";
  }
}

function getAiAnswer(input: string) {
  const text = input.toLowerCase().trim();

  const matched = faqs.find((faq) => {
    return (
      faq.question.toLowerCase().includes(text) ||
      faq.keywords.some((keyword) => text.includes(keyword))
    );
  });

  if (matched) return matched.answer;

  return "I can help with membership, wallet, marketplace, inventory, tree operations, gardener updates, GPS, photo updates, and sell tree requests. If this needs admin review, start Admin Live Chat and your ticket will be visible to admin.";
}

function buildMessagesFromTicket(ticket: SupportTicket | null): ChatMessage[] {
  const base: ChatMessage[] = [
    {
      id: "welcome",
      sender_type: "AI",
      message:
        "Welcome to Arganwood Concierge. Ask me about membership, wallet, marketplace, inventory, tree operations, gardener updates, or selling a tree.",
      created_at: new Date().toISOString(),
    },
  ];

  if (!ticket) return base;

  if (ticket.message) {
    base.push({
      id: `ticket-${ticket.id}-customer`,
      sender_type: "CUSTOMER",
      message: ticket.message,
      created_at: ticket.created_at || new Date().toISOString(),
    });
  }

  if (ticket.admin_reply) {
    base.push({
      id: `ticket-${ticket.id}-admin`,
      sender_type: "ADMIN",
      message: ticket.admin_reply,
      created_at: ticket.updated_at || ticket.created_at || new Date().toISOString(),
    });
  }

  base.push({
    id: `ticket-${ticket.id}-system`,
    sender_type: "SYSTEM",
    message: `Ticket connected: ${ticket.id.slice(0, 8).toUpperCase()} • Status: ${ticket.status || "OPEN"}`,
    created_at: ticket.updated_at || ticket.created_at || new Date().toISOString(),
  });

  return base;
}

export default function SupportPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [input, setInput] = useState("");
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(buildMessagesFromTicket(null));
  const [loading, setLoading] = useState(true);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [liveChatOpen, setLiveChatOpen] = useState(false);
  const [errorText, setErrorText] = useState("");

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const filteredSuggestions = useMemo(() => {
    const text = input.toLowerCase().trim();

    if (!text) return quickSuggestions.slice(0, 4);

    return quickSuggestions
      .filter((question) => question.toLowerCase().includes(text))
      .slice(0, 4);
  }, [input]);

  async function resolveProfile() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      window.location.href = "/login";
      return null;
    }

    const email = user.email?.trim() || "";
    const normalizedEmail = email.toLowerCase();

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByExactEmail } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", email)
      .maybeSingle();

    const { data: profileByLowerEmail } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    const { data: profileByEmailFallback } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .ilike("email", email)
      .maybeSingle();

    const foundProfile =
      profileById ||
      profileByExactEmail ||
      profileByLowerEmail ||
      profileByEmailFallback ||
      null;

    if (!foundProfile) throw new Error("Profile not found.");

    return foundProfile as Profile;
  }

  async function loadSupport() {
    setLoading(true);
    setErrorText("");

    try {
      const currentProfile = await resolveProfile();
      if (!currentProfile) return;

      setProfile(currentProfile);

      const { data: latestTicket, error: ticketError } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("customer_id", currentProfile.id)
        .neq("status", "CLOSED")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ticketError) throw ticketError;

      if (latestTicket) {
        const loadedTicket = latestTicket as SupportTicket;
        setTicket(loadedTicket);
        setLiveChatOpen(true);
        setMessages(buildMessagesFromTicket(loadedTicket));
      } else {
        setTicket(null);
        setLiveChatOpen(false);
        setMessages(buildMessagesFromTicket(null));
      }
    } catch (error: any) {
      setErrorText(error?.message || "Support page failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSupport();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!ticket?.id) return;

    const channel = supabase
      .channel(`customer-support-ticket-${ticket.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_tickets",
          filter: `id=eq.${ticket.id}`,
        },
        (payload) => {
          const updatedTicket = payload.new as SupportTicket;
          setTicket(updatedTicket);
          setMessages(buildMessagesFromTicket(updatedTicket));
          setLiveChatOpen((updatedTicket.status || "OPEN") !== "CLOSED");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticket?.id]);

  function addLocalMessage(sender_type: SenderType, message: string) {
    setMessages((current) => [
      ...current,
      {
        id: makeId(),
        sender_type,
        message,
        created_at: new Date().toISOString(),
      },
    ]);
  }

  async function sendAiQuestion(customText?: string) {
    const text = (customText || input).trim();
    if (!text) return;

    setInput("");
    setErrorText("");

    addLocalMessage("CUSTOMER", text);

    window.setTimeout(() => {
      addLocalMessage("AI", getAiAnswer(text));
    }, 150);
  }

  async function createLiveTicket(firstMessage?: string) {
    setLoadingTicket(true);
    setErrorText("");

    try {
      const currentProfile = profile || (await resolveProfile());
      if (!currentProfile) return;

      setProfile(currentProfile);

      const messageToSend =
        firstMessage?.trim() || input.trim() || "Customer requested admin live chat support.";

      const subject =
        messageToSend.length > 70 ? `${messageToSend.slice(0, 70)}...` : messageToSend;

      const { data: newTicket, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({
          customer_id: currentProfile.id,
          customer_email: currentProfile.email,
          customer_name: currentProfile.full_name || currentProfile.email || "Customer",
          subject,
          category: "SUPPORT",
          priority: "NORMAL",
          status: "OPEN",
          message: messageToSend,
          admin_reply: null,
        })
        .select("*")
        .single();

      if (ticketError) throw ticketError;

      const createdTicket = newTicket as SupportTicket;
      setTicket(createdTicket);
      setLiveChatOpen(true);
      setInput("");
      setMessages(buildMessagesFromTicket(createdTicket));
    } catch (error: any) {
      setErrorText(
        error?.message ||
          "Hindi nagawa yung live chat ticket. Check support_tickets table columns sa Supabase."
      );
    } finally {
      setLoadingTicket(false);
    }
  }

  async function sendLiveMessage() {
    const text = input.trim();
    if (!text) return;

    if (!ticket?.id) {
      await createLiveTicket(text);
      return;
    }

    setErrorText("");

    try {
      const updatedMessage = `${ticket.message || ""}\n\nCustomer follow-up (${new Date().toLocaleString("en-PH")}):\n${text}`.trim();

      const { data: updatedTicket, error } = await supabase
        .from("support_tickets")
        .update({
          message: updatedMessage,
          status: "OPEN",
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticket.id)
        .select("*")
        .single();

      if (error) throw error;

      const savedTicket = updatedTicket as SupportTicket;
      setTicket(savedTicket);
      setInput("");
      setMessages(buildMessagesFromTicket(savedTicket));
    } catch (error: any) {
      setErrorText(error?.message || "Hindi nasend yung message. Try again.");
    }
  }

  async function closeCustomerTicket() {
    if (!ticket?.id) return;

    setLoadingTicket(true);
    setErrorText("");

    try {
      const { data: closedTicket, error } = await supabase
        .from("support_tickets")
        .update({
          status: "CLOSED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticket.id)
        .select("*")
        .single();

      if (error) throw error;

      setTicket(closedTicket as SupportTicket);
      setLiveChatOpen(false);
      setMessages(buildMessagesFromTicket(null));
    } catch (error: any) {
      setErrorText(error?.message || "Failed to close ticket.");
    } finally {
      setLoadingTicket(false);
    }
  }

  return (
    <main className="page">
      <section className="shell">
        <aside className="sideQuote">
          <div>
            <p>Arganwood</p>
            <p>Concierge</p>
            <p>Support</p>
            <p>Customer</p>
            <p>To Admin</p>
          </div>
          <span>🌿</span>
        </aside>

        <section className="content">
          <header className="header">
            <div>
              <h1>Customer Service</h1>
              <p>Ask the AI assistant first, then continue to admin live chat when needed.</p>
            </div>

            <div className="supportBadge">
              <span>SUPPORT STATUS</span>
              <strong>{liveChatOpen ? "Admin Chat Connected" : "AI Concierge Online"}</strong>
              <b>💬</b>
            </div>
          </header>

          {errorText && <div className="errorBox topError">{errorText}</div>}

          <section className="grid">
            <section className="chatPanel">
              <div className="panelHead">
                <div>
                  <h2>{liveChatOpen ? "Admin Live Chat" : "AI Concierge Assistant"}</h2>
                  <p>
                    {liveChatOpen
                      ? "Your messages are saved to support_tickets. Admin replies appear here after admin updates the ticket."
                      : "Suggested questions appear while typing. You can start admin chat anytime."}
                  </p>
                </div>
                <span>{liveChatOpen ? "Ticket Mode" : "AI Mode"}</span>
              </div>

              {loading ? (
                <div className="loadingBox">Loading support chat...</div>
              ) : (
                <>
                  <div className="chatWindow">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`message ${
                          message.sender_type === "CUSTOMER"
                            ? "user"
                            : message.sender_type === "ADMIN"
                            ? "admin"
                            : message.sender_type === "SYSTEM"
                            ? "system"
                            : "bot"
                        }`}
                      >
                        <div className="bubble">
                          {message.sender_type === "ADMIN" && <strong>Admin Support</strong>}
                          {message.sender_type === "AI" && <strong>AI Concierge</strong>}
                          {message.sender_type === "SYSTEM" && <strong>System</strong>}
                          {message.sender_type === "CUSTOMER" && <strong>You</strong>}
                          <p>{message.message}</p>
                          <small>{formatDate(message.created_at)}</small>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  {!liveChatOpen && filteredSuggestions.length > 0 && (
                    <div className="suggestionBox">
                      {filteredSuggestions.map((question) => (
                        <button
                          key={question}
                          type="button"
                          onClick={() => {
                            setInput(question);
                            sendAiQuestion(question);
                          }}
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="inputArea">
                    <input
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          if (liveChatOpen) sendLiveMessage();
                          else sendAiQuestion();
                        }
                      }}
                      placeholder={
                        liveChatOpen
                          ? "Type your message to admin support..."
                          : "Ask about wallet, membership, operations, inventory..."
                      }
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (liveChatOpen) sendLiveMessage();
                        else sendAiQuestion();
                      }}
                    >
                      Send
                    </button>
                  </div>

                  {!liveChatOpen && (
                    <div className="helpfulBox">
                      <p>Need human support?</p>
                      <button type="button" onClick={() => createLiveTicket()} disabled={loadingTicket}>
                        {loadingTicket ? "Creating Ticket..." : "Continue to Admin Live Chat"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            <aside className="rightPanel">
              <section className="card">
                <div className="cardHead">
                  <h2>Live Chat</h2>
                  <div className="cardIcon">🟢</div>
                </div>

                {!liveChatOpen ? (
                  <div className="liveState">
                    <h3>Admin Support Available</h3>
                    <p>
                      Create a live ticket when AI cannot solve the concern. Admin can see the ticket from the admin support page.
                    </p>
                    <button type="button" onClick={() => createLiveTicket()} disabled={loadingTicket}>
                      {loadingTicket ? "Creating..." : "Start Admin Live Chat"}
                    </button>
                  </div>
                ) : (
                  <div className="liveState">
                    <h3>Ticket Connected</h3>
                    <p>
                      Ticket ID: <strong>{ticket?.id ? ticket.id.slice(0, 8).toUpperCase() : "ACTIVE"}</strong>
                    </p>
                    <p>Status: {ticket?.status || "OPEN"}</p>
                    <p>Last Updated: {formatDate(ticket?.updated_at || ticket?.created_at)}</p>
                    <button type="button" className="softButton" onClick={loadSupport} disabled={loadingTicket}>
                      Refresh Chat
                    </button>
                    <button type="button" className="dangerButton" onClick={closeCustomerTicket} disabled={loadingTicket}>
                      Close Ticket
                    </button>
                  </div>
                )}
              </section>

              <section className="card">
                <div className="cardHead">
                  <h2>Support Sync</h2>
                  <div className="cardIcon">✨</div>
                </div>

                <div className="guideList">
                  <p>1. Customer creates ticket.</p>
                  <p>2. Ticket saves to support_tickets.</p>
                  <p>3. Admin updates admin_reply.</p>
                  <p>4. Customer chat refreshes in real time.</p>
                </div>
              </section>
            </aside>
          </section>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background: #f5f1e8;
          padding: 0;
          font-family: Arial, Helvetica, sans-serif;
        }

        .shell {
          min-height: 100vh;
          max-width: 1440px;
          margin: auto;
          display: grid;
          grid-template-columns: 150px 1fr;
          background:
            radial-gradient(circle at 88% 10%, rgba(205, 164, 75, .2), transparent 28%),
            radial-gradient(circle at 32% 20%, rgba(71, 132, 72, .18), transparent 30%),
            linear-gradient(135deg, #03170f, #062819 48%, #021108);
          border-left: 8px solid #062819;
          border-right: 8px solid #062819;
          color: #fff8dd;
        }

        .sideQuote {
          min-height: 100vh;
          padding: 24px 14px;
          border-right: 1px solid rgba(217, 176, 83, .35);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          background:
            radial-gradient(circle at bottom, rgba(80, 135, 65, .35), transparent 32%),
            rgba(0, 0, 0, .12);
        }

        .sideQuote div {
          border: 1px solid rgba(217, 176, 83, .45);
          border-radius: 12px;
          padding: 18px 10px;
          text-align: center;
          color: #d9b053;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 13px;
          line-height: 1.4;
        }

        .sideQuote p { margin: 4px 0; }
        .sideQuote span { margin-top: 18px; font-size: 44px; text-align: center; display: block; }

        .content { padding: 34px; }

        .header {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .header h1 {
          margin: 0;
          font-size: 42px;
          color: #e7c76c;
          font-family: Georgia, "Times New Roman", serif;
        }

        .header p {
          margin: 8px 0 0;
          color: rgba(255, 248, 221, .72);
          font-style: italic;
        }

        .supportBadge,
        .chatPanel,
        .card {
          border-radius: 18px;
          background: linear-gradient(145deg, rgba(255, 255, 255, .075), rgba(255, 255, 255, .025));
          border: 1px solid rgba(217, 176, 83, .32);
          box-shadow: 0 18px 40px rgba(0, 0, 0, .22);
        }

        .supportBadge {
          min-width: 260px;
          padding: 18px 22px;
          position: relative;
        }

        .supportBadge span {
          display: block;
          font-size: 10px;
          color: #d9b053;
          font-weight: 900;
          letter-spacing: .2em;
        }

        .supportBadge strong {
          display: block;
          margin-top: 7px;
          font-size: 22px;
          color: #fff8dd;
        }

        .supportBadge b { position: absolute; right: 18px; top: 22px; }

        .grid {
          display: grid;
          grid-template-columns: 1.45fr .85fr;
          gap: 16px;
        }

        .chatPanel,
        .card { padding: 20px; }
        .rightPanel { display: grid; gap: 16px; align-content: start; }

        .panelHead,
        .cardHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding-bottom: 14px;
          margin-bottom: 16px;
          border-bottom: 1px solid rgba(217, 176, 83, .22);
        }

        .panelHead h2,
        .cardHead h2 {
          margin: 0;
          color: #e7c76c;
          font-size: 20px;
          font-family: Georgia, "Times New Roman", serif;
        }

        .panelHead p {
          margin: 5px 0 0;
          color: rgba(255, 248, 221, .62);
          font-size: 13px;
          line-height: 1.5;
        }

        .panelHead span {
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(217, 176, 83, .12);
          border: 1px solid rgba(217, 176, 83, .24);
          color: #e7c76c;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .chatWindow {
          min-height: 460px;
          max-height: 560px;
          overflow-y: auto;
          padding: 18px;
          border-radius: 18px;
          background: rgba(0, 0, 0, .18);
          border: 1px solid rgba(255, 255, 255, .08);
        }

        .message {
          display: flex;
          margin-bottom: 12px;
        }

        .message.user { justify-content: flex-end; }
        .message.bot,
        .message.admin,
        .message.system { justify-content: flex-start; }

        .bubble {
          max-width: 78%;
          padding: 12px 14px;
          border-radius: 16px;
          background: rgba(255, 255, 255, .09);
          border: 1px solid rgba(255, 255, 255, .1);
        }

        .message.user .bubble {
          background: rgba(217, 176, 83, .18);
          border-color: rgba(217, 176, 83, .35);
        }

        .message.admin .bubble {
          background: rgba(34, 197, 94, .18);
          border-color: rgba(34, 197, 94, .35);
        }

        .message.system .bubble {
          background: rgba(59, 130, 246, .14);
          border-color: rgba(59, 130, 246, .25);
        }

        .bubble strong {
          display: block;
          margin-bottom: 5px;
          color: #e7c76c;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .message.admin .bubble strong { color: #8ff0b2; }
        .message.system .bubble strong { color: #9dccff; }

        .bubble p {
          white-space: pre-wrap;
          margin: 0;
          line-height: 1.5;
          color: rgba(255, 248, 221, .9);
          font-size: 14px;
        }

        .bubble small {
          display: block;
          margin-top: 7px;
          color: rgba(255,255,255,.38);
          font-size: 10px;
        }

        .suggestionBox {
          margin-top: 14px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .suggestionBox button,
        .softButton {
          border: 1px solid rgba(217, 176, 83, .28);
          color: #fff8dd;
          background: rgba(217, 176, 83, .1);
          border-radius: 999px;
          padding: 9px 12px;
          cursor: pointer;
          font-weight: 800;
        }

        .inputArea {
          margin-top: 14px;
          display: grid;
          grid-template-columns: 1fr 110px;
          gap: 10px;
        }

        .inputArea input {
          border: 1px solid rgba(217, 176, 83, .28);
          background: rgba(0, 0, 0, .2);
          color: #fff8dd;
          border-radius: 14px;
          padding: 14px 15px;
          outline: none;
        }

        .inputArea button,
        .helpfulBox button,
        .liveState button {
          border: 0;
          border-radius: 14px;
          padding: 13px 16px;
          background: #d9b053;
          color: #03170f;
          font-weight: 900;
          cursor: pointer;
        }

        button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .helpfulBox {
          margin-top: 16px;
          border-radius: 16px;
          border: 1px solid rgba(217, 176, 83, .24);
          background: rgba(217, 176, 83, .09);
          padding: 15px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .helpfulBox p { margin: 0; font-weight: 900; color: #fff8dd; }

        .cardIcon {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 14px;
          background: rgba(217, 176, 83, .14);
        }

        .liveState h3 {
          margin: 0;
          color: #fff8dd;
          font-size: 18px;
        }

        .liveState p,
        .guideList p {
          color: rgba(255, 248, 221, .66);
          line-height: 1.6;
          margin: 9px 0;
        }

        .liveState button {
          width: 100%;
          margin-top: 10px;
        }

        .dangerButton {
          background: #f87171 !important;
          color: #2b0808 !important;
        }

        .errorBox,
        .loadingBox {
          border-radius: 16px;
          padding: 14px;
          background: rgba(248, 113, 113, .14);
          border: 1px solid rgba(248, 113, 113, .28);
          color: #ffd6d6;
          font-weight: 800;
        }

        .topError { margin-bottom: 16px; }
        .loadingBox { background: rgba(217,176,83,.12); color: #f6dfa0; border-color: rgba(217,176,83,.25); }

        @media (max-width: 1050px) {
          .shell { grid-template-columns: 1fr; border: 0; }
          .sideQuote { display: none; }
          .grid { grid-template-columns: 1fr; }
          .header { flex-direction: column; }
          .supportBadge { width: 100%; }
          .content { padding: 22px; }
        }

        @media (max-width: 650px) {
          .header h1 { font-size: 32px; }
          .chatWindow { min-height: 380px; }
          .inputArea { grid-template-columns: 1fr; }
          .bubble { max-width: 92%; }
        }
      `}</style>
    </main>
  );
}
