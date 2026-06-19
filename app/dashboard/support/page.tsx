"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type ChatMessage = {
  id: string;
  sender_type: "CUSTOMER" | "AI" | "ADMIN" | "SYSTEM";
  message: string;
  created_at: string;
};

type SupportTicket = {
  id: string;
  customer_id: string | null;
  customer_email: string | null;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type FAQ = {
  keywords: string[];
  question: string;
  answer: string;
};

const faqs: FAQ[] = [
  {
    keywords: ["membership", "member", "annual", "renew"],
    question: "How does membership work?",
    answer:
      "Membership gives you access to the Agarwood investor dashboard and platform services. Tree care fees and operation services are separate from membership.",
  },
  {
    keywords: ["care", "subscription", "auto renew", "renewal"],
    question: "How does care subscription work?",
    answer:
      "Care Subscription covers scheduled tree care such as monitoring, watering, fertilizer handling, photo updates, and GPS verification depending on your active plan.",
  },
  {
    keywords: ["photo", "picture", "update", "tree photo"],
    question: "Why is my tree photo not updated?",
    answer:
      "Photo updates require an active photo update service or active care subscription. Some young trees may also have limited visible updates during early growth.",
  },
  {
    keywords: ["gps", "location", "verify", "verification"],
    question: "How does GPS verification work?",
    answer:
      "GPS verification confirms the recorded location of your tree after the service is completed and uploaded by operations.",
  },
  {
    keywords: ["wallet", "withdraw", "cash out", "earnings"],
    question: "How do I withdraw earnings?",
    answer:
      "Go to Wallet, enter your withdrawal amount, review the 2% processing fee, then confirm. The page should show Withdraw Amount, Processing Fee, and Net Receive.",
  },
  {
    keywords: ["sell", "tree sale", "sell tree", "cash"],
    question: "How do I sell a tree?",
    answer:
      "Go to Sell Tree, choose an eligible tree, review the tree value, platform fee, and net receive amount before submitting your request.",
  },
  {
    keywords: ["marketplace", "buy", "fertilizer", "product"],
    question: "How do I buy fertilizer?",
    answer:
      "Fertilizer and other products are bought from Marketplace. Service items like watering, GPS verification, and photo updates belong in Tree Operations.",
  },
  {
    keywords: ["task", "operation", "tree operation", "schedule"],
    question: "How do task orders work?",
    answer:
      "Task orders show required tree operations, scheduled dates, tree ID, and whether the service is covered by your care plan or needs payment.",
  },
];

const quickSuggestions = faqs.map((item) => item.question);

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

  return "I can help with membership, wallet, tree operations, GPS, photo updates, marketplace, and sell tree requests. If this concern needs human review, you can continue to live chat and an admin support agent will receive your ticket.";
}

export default function SupportPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender_type: "AI",
      message:
        "Welcome to Agarwood Concierge. Ask me about membership, wallet, tree operations, GPS verification, photo updates, marketplace, or selling a tree.",
      created_at: new Date().toISOString(),
    },
  ]);
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

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUserId(user?.id || null);
      setUserEmail(user?.email || null);
    }

    loadUser();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!ticket?.id) return;

    const channel = supabase
      .channel(`support-ticket-${ticket.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${ticket.id}`,
        },
        (payload) => {
          const newMessage = payload.new as {
            id: string;
            sender_type: "CUSTOMER" | "AI" | "ADMIN" | "SYSTEM";
            message: string;
            created_at: string;
          };

          setMessages((current) => {
            const exists = current.some((msg) => msg.id === newMessage.id);
            if (exists) return current;

            return [
              ...current,
              {
                id: newMessage.id,
                sender_type: newMessage.sender_type,
                message: newMessage.message,
                created_at: newMessage.created_at,
              },
            ];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticket?.id]);

  function addLocalMessage(sender_type: ChatMessage["sender_type"], message: string) {
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

    setTimeout(() => {
      addLocalMessage("AI", getAiAnswer(text));
    }, 250);
  }

  async function createLiveTicket(firstMessage?: string) {
    try {
      setLoadingTicket(true);
      setErrorText("");

      const messageToSend =
        firstMessage?.trim() ||
        input.trim() ||
        "Customer requested live chat support.";

      const subject =
        messageToSend.length > 70
          ? `${messageToSend.slice(0, 70)}...`
          : messageToSend;

      const { data: newTicket, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({
          customer_id: userId,
          customer_email: userEmail,
          subject,
          status: "OPEN",
        })
        .select("*")
        .single();

      if (ticketError) throw ticketError;

      const { error: messageError } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: newTicket.id,
          sender_type: "CUSTOMER",
          sender_id: userId,
          sender_email: userEmail,
          message: messageToSend,
        });

      if (messageError) throw messageError;

      setTicket(newTicket);
      setLiveChatOpen(true);
      setInput("");

      addLocalMessage(
        "SYSTEM",
        `Live chat ticket created. Ticket ID: ${newTicket.id.slice(0, 8).toUpperCase()}`
      );
    } catch (error) {
      console.error(error);
      setErrorText(
        "Hindi nagawa yung live chat ticket. Check muna kung created na yung support_tickets at support_messages tables sa Supabase."
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

    try {
      setErrorText("");

      const { error } = await supabase.from("support_messages").insert({
        ticket_id: ticket.id,
        sender_type: "CUSTOMER",
        sender_id: userId,
        sender_email: userEmail,
        message: text,
      });

      if (error) throw error;

      setInput("");
    } catch (error) {
      console.error(error);
      setErrorText("Hindi nasend yung message. Try again.");
    }
  }

  return (
    <main className="page">
      <section className="shell">
        <aside className="sideQuote">
          <div>
            <p>Agarwood</p>
            <p>Concierge</p>
            <p>Support</p>
            <p>For Every</p>
            <p>Tree Owner</p>
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
              <strong>{liveChatOpen ? "Live Chat Active" : "AI Concierge Online"}</strong>
              <b>💬</b>
            </div>
          </header>

          <section className="grid">
            <section className="chatPanel">
              <div className="panelHead">
                <div>
                  <h2>AI Concierge Assistant</h2>
                  <p>Suggested questions appear inside the chat area while typing.</p>
                </div>
                <span>{liveChatOpen ? "Admin Chat Mode" : "AI Q&A Mode"}</span>
              </div>

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
                      <p>{message.message}</p>
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
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (liveChatOpen) {
                        sendLiveMessage();
                      } else {
                        sendAiQuestion();
                      }
                    }
                  }}
                  placeholder={
                    liveChatOpen
                      ? "Type your message to admin support..."
                      : "Ask about wallet, GPS, membership, tree operations..."
                  }
                />
                <button
                  type="button"
                  onClick={() => {
                    if (liveChatOpen) {
                      sendLiveMessage();
                    } else {
                      sendAiQuestion();
                    }
                  }}
                >
                  Send
                </button>
              </div>

              {errorText && <div className="errorBox">{errorText}</div>}

              {!liveChatOpen && (
                <div className="helpfulBox">
                  <p>Need human support?</p>
                  <button
                    type="button"
                    onClick={() => createLiveTicket()}
                    disabled={loadingTicket}
                  >
                    {loadingTicket ? "Creating Ticket..." : "Continue to Admin Live Chat"}
                  </button>
                </div>
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
                      If the AI answer does not solve your concern, create a live ticket.
                      Admin will receive your message on the admin support page.
                    </p>
                    <button
                      type="button"
                      onClick={() => createLiveTicket()}
                      disabled={loadingTicket}
                    >
                      {loadingTicket ? "Creating..." : "Start Admin Live Chat"}
                    </button>
                  </div>
                ) : (
                  <div className="liveState">
                    <h3>Ticket Connected</h3>
                    <p>
                      Ticket ID:{" "}
                      <strong>{ticket?.id ? ticket.id.slice(0, 8).toUpperCase() : "ACTIVE"}</strong>
                    </p>
                    <p>Status: {ticket?.status || "OPEN"}</p>
                    <p>Admin replies will appear directly in the chat window.</p>
                  </div>
                )}
              </section>

              <section className="card">
                <div className="cardHead">
                  <h2>Support Guide</h2>
                  <div className="cardIcon">✨</div>
                </div>

                <div className="guideList">
                  <p>1. Ask the AI assistant first.</p>
                  <p>2. Continue to Admin Live Chat if needed.</p>
                  <p>3. Your ticket will be visible to admin.</p>
                  <p>4. Admin replies will appear in this chat.</p>
                </div>
              </section>
            </aside>
          </section>
        </section>
      </section>

      <style>{`
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

        .sideQuote p {
          margin: 4px 0;
        }

        .sideQuote span {
          margin-top: 18px;
          font-size: 44px;
          text-align: center;
          display: block;
        }

        .content {
          padding: 34px;
        }

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
          border-radius: 16px;
          background:
            linear-gradient(145deg, rgba(255, 255, 255, .075), rgba(255, 255, 255, .025));
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
        }

        .supportBadge strong {
          display: block;
          margin-top: 7px;
          font-size: 22px;
          color: #fff8dd;
        }

        .supportBadge b {
          position: absolute;
          right: 18px;
          top: 22px;
        }

        .grid {
          display: grid;
          grid-template-columns: 1.45fr .85fr;
          gap: 16px;
        }

        .chatPanel,
        .card {
          padding: 20px;
        }

        .rightPanel {
          display: grid;
          gap: 16px;
          align-content: start;
        }

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
        }

        .panelHead span {
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(217, 176, 83, .12);
          border: 1px solid rgba(217, 176, 83, .28);
          color: #e7c76c;
          font-size: 12px;
          font-weight: 900;
        }

        .cardIcon {
          width: 38px;
          height: 38px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(217, 176, 83, .38);
          background: rgba(217, 176, 83, .08);
        }

        .chatWindow {
          height: 515px;
          overflow-y: auto;
          padding: 18px;
          border-radius: 16px;
          background:
            radial-gradient(circle at 90% 0%, rgba(217, 176, 83, .12), transparent 32%),
            rgba(0, 0, 0, .18);
          border: 1px solid rgba(255, 255, 255, .08);
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .message {
          display: flex;
        }

        .message.user {
          justify-content: flex-end;
        }

        .message.system {
          justify-content: center;
        }

        .bubble {
          max-width: 78%;
          padding: 14px 16px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.5;
        }

        .message.bot .bubble,
        .message.admin .bubble {
          background: rgba(255, 255, 255, .075);
          border: 1px solid rgba(217, 176, 83, .18);
        }

        .message.user .bubble {
          color: #062819;
          background: linear-gradient(135deg, #f3d376, #b98222);
          font-weight: 900;
        }

        .message.system .bubble {
          max-width: 90%;
          text-align: center;
          background: rgba(133, 239, 145, .08);
          border: 1px solid rgba(133, 239, 145, .24);
          color: #bfffc7;
        }

        .bubble strong {
          color: #e7c76c;
          display: block;
          margin-bottom: 6px;
        }

        .bubble p {
          margin: 0;
        }

        .suggestionBox {
          margin-top: 12px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .suggestionBox button {
          border: 1px solid rgba(217, 176, 83, .25);
          border-radius: 999px;
          padding: 9px 12px;
          background: rgba(255, 255, 255, .055);
          color: rgba(255, 248, 221, .82);
          cursor: pointer;
          font-weight: 800;
          font-size: 12px;
        }

        .suggestionBox button:hover {
          color: #062819;
          background: linear-gradient(135deg, #f3d376, #b98222);
        }

        .inputArea {
          display: grid;
          grid-template-columns: 1fr 110px;
          gap: 10px;
          margin-top: 14px;
        }

        .inputArea input {
          width: 100%;
          border: 1px solid rgba(217, 176, 83, .3);
          background: rgba(255, 255, 255, .06);
          color: #fff8dd;
          border-radius: 12px;
          padding: 13px 14px;
          outline: none;
        }

        .inputArea input::placeholder {
          color: rgba(255, 248, 221, .45);
        }

        .inputArea button,
        .helpfulBox button,
        .liveState button {
          border: 0;
          border-radius: 12px;
          color: #062819;
          background: linear-gradient(135deg, #f3d376, #b98222);
          font-weight: 900;
          cursor: pointer;
        }

        .inputArea button:disabled,
        .helpfulBox button:disabled,
        .liveState button:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .helpfulBox {
          margin-top: 14px;
          padding: 14px;
          border-radius: 14px;
          background: rgba(255, 255, 255, .045);
          border: 1px solid rgba(217, 176, 83, .18);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .helpfulBox p {
          margin: 0;
          color: rgba(255, 248, 221, .72);
        }

        .helpfulBox button {
          padding: 12px 14px;
        }

        .errorBox {
          margin-top: 12px;
          padding: 12px;
          border-radius: 12px;
          color: #ffd2d2;
          background: rgba(255, 80, 80, .12);
          border: 1px solid rgba(255, 80, 80, .25);
          font-size: 13px;
        }

        .liveState h3 {
          margin: 0;
          color: #e7c76c;
          font-family: Georgia, "Times New Roman", serif;
        }

        .liveState p,
        .guideList p {
          color: rgba(255, 248, 221, .68);
          line-height: 1.5;
        }

        .liveState strong {
          color: #fff8dd;
        }

        .liveState button {
          width: 100%;
          padding: 13px;
          margin-top: 8px;
        }

        .guideList {
          display: grid;
          gap: 8px;
        }

        .guideList p {
          margin: 0;
          padding: 10px;
          border-radius: 10px;
          background: rgba(255, 255, 255, .045);
          border: 1px solid rgba(217, 176, 83, .12);
        }

        @media (max-width: 1100px) {
          .shell {
            grid-template-columns: 1fr;
          }

          .sideQuote {
            display: none;
          }

          .grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .content {
            padding: 20px;
          }

          .header,
          .helpfulBox {
            flex-direction: column;
            align-items: stretch;
          }

          .supportBadge {
            width: 100%;
          }

          .inputArea {
            grid-template-columns: 1fr;
          }

          .inputArea button {
            padding: 13px;
          }

          .bubble {
            max-width: 92%;
          }
        }
      `}</style>
    </main>
  );
}