"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type InviteLink = {
  id: string;
  target_type: string | null;
  referral_code: string | null;
  invite_url: string | null;
  status: string | null;
  created_by: string | null;
  created_at: string | null;
};

const TARGETS = [
  {
    type: "CUSTOMER",
    title: "Customer Registration Link",
    route: "/register",
    description: "Send this to investors/customers who will buy trees.",
  },
  {
    type: "PARTNER",
    title: "Partner Registration Link",
    route: "/partner/register",
    description: "Send this to partners or affiliates.",
  },
  {
    type: "GARDENER",
    title: "Gardener / Caretaker Registration Link",
    route: "/gardener/register",
    description: "Send this to gardeners or caretakers.",
  },
];

export default function AdminReferralLinksPage() {
  const [links, setLinks] = useState<InviteLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  async function loadLinks() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const email = user?.email?.trim().toLowerCase() || "admin";
    setAdminEmail(email);

    const { data } = await supabase
      .from("admin_invite_links")
      .select("id, target_type, referral_code, invite_url, status, created_by, created_at")
      .order("created_at", { ascending: false });

    setLinks(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadLinks();
  }, []);

  const activeLinks = useMemo(() => {
    return TARGETS.map((target) => {
      const found = links.find(
        (item) =>
          (item.target_type || "").toUpperCase() === target.type &&
          (item.status || "ACTIVE").toUpperCase() === "ACTIVE"
      );

      return { ...target, link: found || null };
    });
  }, [links]);

  async function generateLink(target: (typeof TARGETS)[number]) {
    setMessage("");

    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://agarwood-platform.vercel.app";

    const code = `ADMIN-${target.type}-${Date.now().toString().slice(-6)}`;
    const inviteUrl =
  `${origin}/login?mode=register&admin_invite=${encodeURIComponent(code)}&type=${target.type}`;

    const { error } = await supabase.from("admin_invite_links").insert({
      target_type: target.type,
      referral_code: code,
      invite_url: inviteUrl,
      status: "ACTIVE",
      created_by: adminEmail,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(`${target.type} invite link generated.`);
    await loadLinks();
  }

  async function deactivateLink(id: string) {
    setMessage("");

    const { error } = await supabase
      .from("admin_invite_links")
      .update({ status: "INACTIVE" })
      .eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Invite link deactivated.");
    await loadLinks();
  }

  async function copyLink(url: string | null) {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setMessage("Invite link copied.");
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Admin Invite Center</p>
          <h1>Referral & Registration Links</h1>
          <span>
            Generate official registration links for customers, partners, and gardeners.
            Every generated link includes a trackable referral code.
          </span>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      {loading ? (
        <div className="empty">Loading invite links...</div>
      ) : (
        <>
          <section className="cards">
            {activeLinks.map((item) => (
              <div className="card" key={item.type}>
                <span>{item.type}</span>
                <h2>{item.title}</h2>
                <p>{item.description}</p>

                {item.link ? (
                  <>
                    <div className="box">
                      <small>Referral Code</small>
                      <strong>{item.link.referral_code}</strong>
                    </div>

                    <div className="urlBox">
                      <small>Invite URL</small>
                      <p>{item.link.invite_url}</p>
                    </div>

                    <button onClick={() => copyLink(item.link?.invite_url || "")}>
                      Copy Link
                    </button>

                    <button className="danger" onClick={() => deactivateLink(item.link!.id)}>
                      Deactivate
                    </button>
                  </>
                ) : (
                  <button onClick={() => generateLink(item)}>
                    Generate {item.type} Link
                  </button>
                )}
              </div>
            ))}
          </section>

          <section className="panel">
            <h2>All Generated Links</h2>

            {links.length === 0 ? (
              <div className="empty small">No links generated yet.</div>
            ) : (
              <div className="table">
                {links.map((link) => (
                  <div className="row" key={link.id}>
                    <div>
                      <strong>{link.target_type}</strong>
                      <p>{link.referral_code}</p>
                      <small>{link.invite_url}</small>
                    </div>

                    <div className="right">
                      <span className={`status ${(link.status || "ACTIVE").toLowerCase()}`}>
                        {link.status || "ACTIVE"}
                      </span>
                      <button onClick={() => copyLink(link.invite_url)}>Copy</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          padding: 30px;
          color: #18261d;
          font-family: Arial, Helvetica, sans-serif;
          background:
            radial-gradient(circle at 18% 5%, rgba(255, 226, 154, .55), transparent 24%),
            radial-gradient(circle at 92% 8%, rgba(255,255,255,.72), transparent 28%),
            linear-gradient(180deg, #f8f4eb 0%, #f3eadb 52%, #eadcc3 100%);
        }

        .hero {
          margin-bottom: 22px;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #8c6a3c;
          font-weight: 900;
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: .12em;
        }

        h1 {
          margin: 0;
          font-size: 42px;
          color: #101a14;
        }

        .hero span {
          display: block;
          margin-top: 8px;
          color: #5f665e;
          max-width: 850px;
          line-height: 1.6;
          font-weight: 800;
        }

        .message,
        .empty,
        .card,
        .panel {
          border-radius: 26px;
          background: rgba(255,253,246,.9);
          border: 1px solid rgba(92,70,35,.08);
          box-shadow: 0 18px 42px rgba(82,60,27,.09);
        }

        .message,
        .empty {
          padding: 18px;
          margin-bottom: 18px;
          color: #31553d;
          font-weight: 900;
        }

        .small {
          box-shadow: none;
          border-radius: 16px;
          background: #f3ead8;
        }

        .cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 18px;
        }

        .card,
        .panel {
          padding: 22px;
        }

        .card > span {
          display: inline-flex;
          border-radius: 999px;
          padding: 8px 12px;
          background: rgba(214,178,94,.20);
          color: #8c6a3c;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .12em;
        }

        .card h2,
        .panel h2 {
          margin: 16px 0 0;
          color: #101a14;
          font-size: 23px;
        }

        .card p {
          color: #6b6b62;
          line-height: 1.5;
          font-weight: 800;
        }

        .box,
        .urlBox {
          margin-top: 14px;
          border-radius: 18px;
          padding: 14px;
          background: #f3ead8;
        }

        small {
          display: block;
          color: #6b6b62;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .box strong {
          display: block;
          margin-top: 7px;
          color: #101a14;
          font-size: 20px;
        }

        .urlBox p {
          margin: 7px 0 0;
          color: #244536;
          font-weight: 800;
          word-break: break-all;
        }

        button {
          width: 100%;
          margin-top: 12px;
          border: 0;
          border-radius: 16px;
          padding: 14px;
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        button.danger {
          background: linear-gradient(135deg, #8c3f2b, #5b2117);
        }

        .table {
          display: grid;
          gap: 12px;
          margin-top: 18px;
        }

        .row {
          display: grid;
          grid-template-columns: 1fr 180px;
          gap: 14px;
          align-items: center;
          border-radius: 18px;
          padding: 16px;
          background: #f3ead8;
        }

        .row strong {
          color: #101a14;
        }

        .row p,
        .row small {
          margin: 6px 0 0;
          color: #6b6b62;
          font-weight: 800;
          word-break: break-all;
        }

        .right {
          display: grid;
          gap: 8px;
        }

        .status {
          display: inline-flex;
          justify-content: center;
          border-radius: 999px;
          padding: 8px 10px;
          font-size: 11px;
          font-weight: 900;
        }

        .status.active {
          background: rgba(49,85,61,.12);
          color: #31553d;
        }

        .status.inactive {
          background: rgba(163,60,42,.12);
          color: #a33c2a;
        }

        @media (max-width: 1100px) {
          .cards {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .page {
            padding: 18px;
          }

          h1 {
            font-size: 32px;
          }

          .row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}