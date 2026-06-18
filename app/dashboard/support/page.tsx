"use client";

import { useMemo, useState, type ReactNode } from "react";

type FAQ = {
  category: string;
  question: string;
  answer: string;
};

const faqs: FAQ[] = [
  {
    category: "Membership",
    question: "How does membership work?",
    answer:
      "Membership gives you platform and app access. It is separate from tree care fees. Tree maintenance services are handled under Care Subscription or individual Tree Operations.",
  },
  {
    category: "Care Plan",
    question: "How does care subscription work?",
    answer:
      "Care Subscription covers maintenance services such as watering, fertilizer handling, photo updates, GPS verification, and scheduled care monitoring depending on your plan.",
  },
  {
    category: "Photo Updates",
    question: "Why is my tree photo not updated?",
    answer:
      "Photo updates require an active Photo Update service or active Care Subscription. Seedling-stage trees may also have limited visible updates because they are still in early growth.",
  },
  {
    category: "GPS",
    question: "How does GPS verification work?",
    answer:
      "GPS verification confirms the recorded location of your tree. It only shows verified after the GPS service has been paid, completed, and uploaded by operations.",
  },
  {
    category: "Wallet",
    question: "How do I withdraw earnings?",
    answer:
      "Go to Wallet, enter the withdraw amount, review the 2% processing fee, then confirm. The page must show Withdraw Amount, Processing Fee 2%, and Net Receive.",
  },
  {
    category: "Tree Sales",
    question: "How do I sell a tree?",
    answer:
      "When eligible, Sell Tree must show Tree Value, Platform Fee 2%, and Net Receive before confirmation.",
  },
  {
    category: "Marketplace",
    question: "How do I buy fertilizer?",
    answer:
      "Fertilizer and other products are bought from Marketplace. Service items like watering, photo update, GPS verification, and managed care belong in Tree Operations.",
  },
  {
    category: "Operations",
    question: "How do task orders work?",
    answer:
      "Task Orders show required tree operations, scheduled date, tree ID, and whether the task is covered by Care Plan or awaiting schedule/payment.",
  },
];

const suggestedQuestions = faqs.map((faq) => faq.question);

export default function SupportPage() {
  const [query, setQuery] = useState("");
  const [selectedQuestion, setSelectedQuestion] = useState(suggestedQuestions[0]);
  const [showLiveChat, setShowLiveChat] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);

  const matchedAnswer = useMemo(() => {
    const searchText = (query.trim() || selectedQuestion).toLowerCase();

    const exact = faqs.find(
      (item) => item.question.toLowerCase() === searchText
    );

    if (exact) return exact;

    const loose = faqs.find((item) => {
      return (
        item.question.toLowerCase().includes(searchText) ||
        item.answer.toLowerCase().includes(searchText) ||
        item.category.toLowerCase().includes(searchText)
      );
    });

    return (
      loose || {
        category: "Concierge",
        question: query || "Ask a question",
        answer:
          "I could not find an exact answer in the support knowledge base. You may continue to live chat and our support team will assist you.",
      }
    );
  }, [query, selectedQuestion]);

  function chooseQuestion(question: string) {
    setSelectedQuestion(question);
    setQuery(question);
    setShowLiveChat(false);
    setChatStarted(false);
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
              <h1>Support</h1>
              <p>Ask questions, get instant answers, or continue to live chat.</p>
            </div>

            <div className="supportBadge">
              <span>SUPPORT STATUS</span>
              <strong>Concierge Online</strong>
              <b>💬</b>
            </div>
          </header>

          <section className="grid">
            <section className="chatPanel">
              <div className="panelHead">
                <div>
                  <h2>AI Concierge Assistant</h2>
                  <p>Choose a question or type your concern below.</p>
                </div>
                <span>Q&A Mode</span>
              </div>

              <div className="chatWindow">
                <div className="message bot">
                  <div className="bubble">
                    Welcome to Agarwood Concierge. How can I help with your
                    membership, care plan, tree operations, wallet, or GPS updates?
                  </div>
                </div>

                <div className="message user">
                  <div className="bubble">{matchedAnswer.question}</div>
                </div>

                <div className="message bot">
                  <div className="bubble">
                    <strong>{matchedAnswer.category}</strong>
                    <p>{matchedAnswer.answer}</p>
                  </div>
                </div>
              </div>

              <div className="inputArea">
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowLiveChat(false);
                    setChatStarted(false);
                  }}
                  placeholder="Ask about care plan, GPS, withdrawals, photo updates..."
                />
                <button type="button">Ask</button>
              </div>

              <div className="helpfulBox">
                <p>Did this answer your question?</p>
                <div>
                  <button
                    type="button"
                    className="yesBtn"
                    onClick={() => {
                      setShowLiveChat(false);
                      setChatStarted(false);
                    }}
                  >
                    👍 Yes
                  </button>
                  <button
                    type="button"
                    className="noBtn"
                    onClick={() => {
                      setShowLiveChat(true);
                      setChatStarted(false);
                    }}
                  >
                    👎 Continue to Live Chat
                  </button>
                </div>
              </div>
            </section>

            <aside className="rightPanel">
              <Card title="Suggested Questions" icon="✨">
                <div className="questionList">
                  {suggestedQuestions.map((question) => (
                    <button
                      type="button"
                      key={question}
                      className={selectedQuestion === question ? "activeQuestion" : ""}
                      onClick={() => chooseQuestion(question)}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </Card>

              <Card title="Live Chat Redirect" icon="🟢">
                {!showLiveChat ? (
                  <div className="liveState">
                    <h3>Need more help?</h3>
                    <p>
                      If the AI answer does not solve your concern, continue to
                      live chat with support.
                    </p>
                    <button type="button" onClick={() => setShowLiveChat(true)}>
                      Continue to Live Chat
                    </button>
                  </div>
                ) : !chatStarted ? (
                  <div className="liveState">
                    <h3>Live Chat Ready</h3>
                    <p>Ticket ID: AG-SUP-2026-001</p>
                    <p>Estimated wait time: 3 minutes</p>
                    <button type="button" onClick={() => setChatStarted(true)}>
                      Start Live Chat
                    </button>
                  </div>
                ) : (
                  <div className="liveChatBox">
                    <div className="liveHeader">
                      <strong>Live Support Lounge</strong>
                      <span>Connected</span>
                    </div>

                    <div className="liveMessages">
                      <p>
                        <b>Support:</b> Hello, I reviewed your AI support
                        question. Please describe the remaining issue.
                      </p>
                      <p>
                        <b>You:</b> I need more help with this concern.
                      </p>
                    </div>

                    <input placeholder="Type your message..." />
                  </div>
                )}
              </Card>
            </aside>

            <section className="knowledgeBase">
              <div className="panelHead">
                <div>
                  <h2>Knowledge Base</h2>
                  <p>Quick support topics for agarwood investors.</p>
                </div>
                <span>FAQ</span>
              </div>

              <div className="faqGrid">
                {faqs.map((item) => (
                  <details key={item.question}>
                    <summary>
                      <span>{item.category}</span>
                      {item.question}
                    </summary>
                    <p>{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>

            <section className="supportHistory">
              <div className="panelHead">
                <div>
                  <h2>Support History</h2>
                  <p>Recent support and operations inquiries.</p>
                </div>
                <span>Recent</span>
              </div>

              <div className="historyRows">
                <HistoryRow
                  code="AG-SUP-2026-001"
                  title="Photo update concern"
                  status="Waiting for live chat"
                />
                <HistoryRow
                  code="AG-SUP-2026-0009"
                  title="GPS verification explanation"
                  status="Resolved"
                />
                <HistoryRow
                  code="AG-SUP-2026-0008"
                  title="Care plan renewal"
                  status="Resolved"
                />
              </div>
            </section>
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

        .supportBadge {
          min-width: 250px;
          padding: 18px 22px;
          border-radius: 15px;
          background: rgba(255, 255, 255, .055);
          border: 1px solid rgba(217, 176, 83, .38);
          box-shadow: inset 0 0 25px rgba(217, 176, 83, .08);
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
          color: #d9b053;
        }

        .grid {
          display: grid;
          grid-template-columns: 1.45fr .85fr;
          gap: 16px;
        }

        .chatPanel,
        .knowledgeBase,
        .supportHistory,
        .card {
          border-radius: 16px;
          padding: 20px;
          background:
            linear-gradient(145deg, rgba(255, 255, 255, .075), rgba(255, 255, 255, .025));
          border: 1px solid rgba(217, 176, 83, .32);
          box-shadow: 0 18px 40px rgba(0, 0, 0, .22);
        }

        .rightPanel {
          display: grid;
          gap: 16px;
        }

        .knowledgeBase,
        .supportHistory {
          grid-column: 1 / -1;
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
          min-height: 365px;
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

        .bubble {
          max-width: 78%;
          padding: 14px 16px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.5;
        }

        .message.bot .bubble {
          background: rgba(255, 255, 255, .075);
          border: 1px solid rgba(217, 176, 83, .18);
        }

        .message.user .bubble {
          color: #062819;
          background: linear-gradient(135deg, #f3d376, #b98222);
          font-weight: 900;
        }

        .bubble strong {
          color: #e7c76c;
          display: block;
          margin-bottom: 6px;
        }

        .bubble p {
          margin: 0;
        }

        .inputArea {
          display: grid;
          grid-template-columns: 1fr 110px;
          gap: 10px;
          margin-top: 14px;
        }

        .inputArea input,
        .liveChatBox input {
          width: 100%;
          border: 1px solid rgba(217, 176, 83, .3);
          background: rgba(255, 255, 255, .06);
          color: #fff8dd;
          border-radius: 12px;
          padding: 13px 14px;
          outline: none;
        }

        .inputArea input::placeholder,
        .liveChatBox input::placeholder {
          color: rgba(255, 248, 221, .45);
        }

        .inputArea button,
        .liveState button {
          border: 0;
          border-radius: 12px;
          color: #062819;
          background: linear-gradient(135deg, #f3d376, #b98222);
          font-weight: 900;
          cursor: pointer;
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

        .helpfulBox div {
          display: flex;
          gap: 10px;
        }

        .yesBtn,
        .noBtn {
          border: 1px solid rgba(217, 176, 83, .32);
          border-radius: 10px;
          padding: 10px 12px;
          cursor: pointer;
          font-weight: 900;
        }

        .yesBtn {
          color: #062819;
          background: #e7c76c;
        }

        .noBtn {
          color: #e7c76c;
          background: transparent;
        }

        .questionList {
          display: grid;
          gap: 10px;
        }

        .questionList button {
          text-align: left;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid rgba(217, 176, 83, .2);
          background: rgba(255, 255, 255, .045);
          color: rgba(255, 248, 221, .82);
          cursor: pointer;
          font-weight: 800;
        }

        .questionList button.activeQuestion,
        .questionList button:hover {
          color: #062819;
          background: linear-gradient(135deg, #f3d376, #b98222);
        }

        .liveState h3 {
          margin: 0;
          color: #e7c76c;
          font-family: Georgia, "Times New Roman", serif;
        }

        .liveState p {
          color: rgba(255, 248, 221, .68);
          line-height: 1.5;
        }

        .liveState button {
          width: 100%;
          padding: 13px;
          margin-top: 8px;
        }

        .liveChatBox {
          border-radius: 14px;
          background: rgba(0, 0, 0, .16);
          border: 1px solid rgba(217, 176, 83, .2);
          padding: 14px;
        }

        .liveHeader {
          display: flex;
          justify-content: space-between;
          padding-bottom: 10px;
          margin-bottom: 10px;
          border-bottom: 1px solid rgba(217, 176, 83, .18);
        }

        .liveHeader strong {
          color: #e7c76c;
        }

        .liveHeader span {
          color: #85ef91;
          font-weight: 900;
          font-size: 12px;
        }

        .liveMessages {
          display: grid;
          gap: 8px;
          margin-bottom: 12px;
        }

        .liveMessages p {
          margin: 0;
          padding: 10px;
          border-radius: 10px;
          background: rgba(255, 255, 255, .055);
          color: rgba(255, 248, 221, .76);
          font-size: 13px;
          line-height: 1.4;
        }

        .faqGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        details {
          border-radius: 14px;
          padding: 14px;
          border: 1px solid rgba(217, 176, 83, .18);
          background: rgba(255, 255, 255, .045);
        }

        summary {
          cursor: pointer;
          color: #fff8dd;
          font-weight: 900;
          line-height: 1.4;
        }

        summary span {
          display: block;
          color: #e7c76c;
          font-size: 11px;
          letter-spacing: .5px;
          margin-bottom: 5px;
        }

        details p {
          margin: 12px 0 0;
          color: rgba(255, 248, 221, .68);
          font-size: 13px;
          line-height: 1.5;
        }

        .historyRows {
          display: grid;
          gap: 10px;
        }

        .historyRow {
          display: grid;
          grid-template-columns: 160px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 13px;
          border-radius: 13px;
          background: rgba(255, 255, 255, .045);
          border: 1px solid rgba(217, 176, 83, .16);
        }

        .historyRow span {
          color: #e7c76c;
          font-size: 12px;
          font-weight: 900;
        }

        .historyRow strong {
          font-size: 14px;
        }

        .historyRow b {
          color: #85ef91;
          font-size: 12px;
          text-align: right;
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

          .knowledgeBase,
          .supportHistory {
            grid-column: auto;
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

          .helpfulBox div,
          .faqGrid {
            grid-template-columns: 1fr;
            display: grid;
          }

          .historyRow {
            grid-template-columns: 1fr;
          }

          .historyRow b {
            text-align: left;
          }

          .bubble {
            max-width: 92%;
          }
        }
      `}</style>
    </main>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <div className="cardHead">
        <h2>{title}</h2>
        <div className="cardIcon">{icon}</div>
      </div>
      {children}
    </section>
  );
}

function HistoryRow({
  code,
  title,
  status,
}: {
  code: string;
  title: string;
  status: string;
}) {
  return (
    <div className="historyRow">
      <span>{code}</span>
      <strong>{title}</strong>
      <b>{status}</b>
    </div>
  );
}