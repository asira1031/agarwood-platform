"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  referral_code: string | null;
};

type ReferralLink = {
  id: string;
  owner_profile_id: string | null;
  target_type: string | null;
  referral_code: string | null;
  referral_url: string | null;
  status: string | null;
  created_at: string | null;
};

type Referral = {
  id: string;
  referred_email: string | null;
  referral_code: string | null;
  target_type: string | null;
  qualified: boolean | null;
  reward_amount: number | null;
  status: string | null;
  created_at: string | null;
};

const TARGETS = [
  {
    type: "CUSTOMER",
    title: "Customer Invite Link",
    text: "Use this for new customers who want to register and buy agarwood trees.",
    route: "/register",
  },
  {
    type: "PARTNER",
    title: "Partner Invite Link",
    text: "Use this for business partners, affiliates, or field partners.",
    route: "/partner/register",
  },
  {
    type: "GARDENER",
    title: "Gardener Invite Link",
    text: "Use this for gardeners/caretakers who will later upload care updates.",
    route: "/gardener/register",
  },
];

const REWARD_AMOUNT = 250;

export default function ReferralsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [links, setLinks] = useState<ReferralLink[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [email, setEmail] = useState("");
  const [targetType, setTargetType] = useState("CUSTOMER");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const emailLogin = user.email?.trim().toLowerCase() || "";

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, full_name, email, referral_code")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, full_name, email, referral_code")
      .eq("email", emailLogin)
      .maybeSingle();

    const currentProfile = profileById || profileByEmail;

    if (!currentProfile) {
      setMessage("Profile not found.");
      setLoading(false);
      return;
    }

    const baseCode =
      currentProfile.referral_code || generateReferralCode(currentProfile.email || emailLogin);

    if (!currentProfile.referral_code) {
      await supabase
        .from("profiles")
        .update({ referral_code: baseCode })
        .eq("id", currentProfile.id);
    }

    const finalProfile = { ...currentProfile, referral_code: baseCode };
    setProfile(finalProfile);

    await ensureReferralLinks(finalProfile.id, baseCode);

    const { data: linkData } = await supabase
      .from("referral_links")
      .select("id, owner_profile_id, target_type, referral_code, referral_url, status, created_at")
      .eq("owner_profile_id", finalProfile.id)
      .order("created_at", { ascending: true });

    const { data: referralData } = await supabase
      .from("referrals")
      .select("id, referred_email, referral_code, target_type, qualified, reward_amount, status, created_at")
      .eq("referrer_profile_id", finalProfile.id)
      .order("created_at", { ascending: false });

    setLinks(linkData || []);
    setReferrals(referralData || []);
    setLoading(false);
  }

  async function ensureReferralLinks(profileId: string, baseCode: string) {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://agarwood-platform.vercel.app";

    for (const target of TARGETS) {
      const code = `${baseCode}-${target.type}`;
      const url = `${origin}${target.route}?ref=${encodeURIComponent(code)}`;

      const { data: existing } = await supabase
        .from("referral_links")
        .select("id")
        .eq("owner_profile_id", profileId)
        .eq("target_type", target.type)
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from("referral_links")
          .update({
            referral_code: code,
            referral_url: url,
            status: "ACTIVE",
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("referral_links").insert({
          owner_profile_id: profileId,
          target_type: target.type,
          referral_code: code,
          referral_url: url,
          status: "ACTIVE",
        });
      }
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const total = referrals.length;
    const qualified = referrals.filter((item) => item.qualified).length;
    const pending = referrals.filter(
      (item) => (item.status || "PENDING").toUpperCase() === "PENDING"
    ).length;
    const rewards = referrals
      .filter((item) =>
        ["APPROVED", "PAID", "COMPLETED"].includes((item.status || "").toUpperCase())
      )
      .reduce((sum, item) => sum + Number(item.reward_amount || 0), 0);

    return { total, qualified, pending, rewards };
  }, [referrals]);

  async function copyLink(value: string) {
    await navigator.clipboard.writeText(value);
    setMessage("Referral link copied.");
  }

  async function submitReferral() {
    setMessage("");

    if (!profile) return setMessage("Profile not found.");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      return setMessage("Enter a valid referred email.");
    }

    if (cleanEmail === (profile.email || "").toLowerCase()) {
      return setMessage("You cannot refer your own email.");
    }

    const selectedLink = links.find((item) => item.target_type === targetType);

    const alreadyExists = referrals.some(
      (item) =>
        (item.referred_email || "").toLowerCase() === cleanEmail &&
        (item.target_type || "CUSTOMER") === targetType
    );

    if (alreadyExists) {
      return setMessage("This email already exists in your referral list.");
    }

    const { error } = await supabase.from("referrals").insert({
      referrer_profile_id: profile.id,
      referred_email: cleanEmail,
      referral_code: selectedLink?.referral_code || profile.referral_code,
      target_type: targetType,
      qualified: false,
      reward_amount: REWARD_AMOUNT,
      status: "PENDING",
    });

    if (error) return setMessage(error.message);

    setEmail("");
    setMessage("Referral submitted. Waiting for qualification/admin approval.");
    await loadData();
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Agarwood Referral System</p>
          <h1>Referral Links</h1>
          <span>
            Share registration links for customers, partners, and gardeners. Every link
            has an automatic referral code for tracking.
          </span>
        </div>

        <div className="codeCard">
          <p>Base Referral Code</p>
          <strong>{profile?.referral_code || "LOADING"}</strong>
        </div>
      </section>

      {loading ? (
        <div className="empty">Loading referral links...</div>
      ) : (
        <>
          {message && <div className="message">{message}</div>}

          <section className="stats">
            <Stat label="Total Referrals" value={String(stats.total)} />
            <Stat label="Qualified" value={String(stats.qualified)} />
            <Stat label="Pending" value={String(stats.pending)} />
            <Stat label="Rewards Earned" value={peso(stats.rewards)} good />
          </section>

          <section className="linkGrid">
            {TARGETS.map((target) => {
              const link = links.find((item) => item.target_type === target.type);
              const url = link?.referral_url || "";
              const code = link?.referral_code || "";

              return (
                <div className="linkCard" key={target.type}>
                  <span>{target.type}</span>
                  <h2>{target.title}</h2>
                  <p>{target.text}</p>

                  <div className="codeBox">
                    <small>Referral Code</small>
                    <strong>{code || "Generating..."}</strong>
                  </div>

                  <div className="urlBox">
                    <small>Registration Link</small>
                    <p>{url || "Generating link..."}</p>
                  </div>

                  <button disabled={!url} onClick={() => copyLink(url)}>
                    Copy {target.type} Link
                  </button>
                </div>
              );
            })}
          </section>

          <section className="grid">
            <section className="panel">
              <PanelHead
                title="Submit Referral Lead"
                text="Use this when you already know the referred person's email."
              />

              <label>
                Referral Type
                <select value={targetType} onChange={(e) => setTargetType(e.target.value)}>
                  {TARGETS.map((target) => (
                    <option key={target.type} value={target.type}>
                      {target.type}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Referred Email
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="friend@example.com"
                />
              </label>

              <div className="rewardBox">
                <span>Potential Reward</span>
                <strong>{peso(REWARD_AMOUNT)}</strong>
                <p>Reward is paid only after the referred user qualifies.</p>
              </div>

              <button onClick={submitReferral}>Submit Referral</button>
            </section>

            <section className="panel">
              <PanelHead
                title="How Qualification Works"
                text="Referral is not instantly paid. It must become qualified first."
              />

              <div className="rule">
                <span>1</span>
                <div>
                  <strong>Customer</strong>
                  <p>Must cash in or buy at least one tree.</p>
                </div>
              </div>

              <div className="rule">
                <span>2</span>
                <div>
                  <strong>Partner</strong>
                  <p>Must be approved by admin as active partner.</p>
                </div>
              </div>

              <div className="rule">
                <span>3</span>
                <div>
                  <strong>Gardener</strong>
                  <p>Must be approved by admin before receiving work access.</p>
                </div>
              </div>
            </section>
          </section>

          <section className="panel history">
            <PanelHead title="Referral History" text="Real records from referrals table." />

            {referrals.length === 0 ? (
              <div className="empty small">No referrals submitted yet.</div>
            ) : (
              <div className="list">
                {referrals.map((item) => (
                  <div className="row" key={item.id}>
                    <div>
                      <strong>{item.referred_email || "No email"}</strong>
                      <p>
                        {item.target_type || "CUSTOMER"} • Code:{" "}
                        {item.referral_code || profile?.referral_code}
                      </p>
                      <small>{formatDate(item.created_at)}</small>
                    </div>

                    <div className="right">
                      <span className={`status ${statusClass(item.status)}`}>
                        {item.status || "PENDING"}
                      </span>
                      <b>{item.qualified ? "Qualified" : "Not Qualified Yet"}</b>
                      <small>{peso(Number(item.reward_amount || 0))}</small>
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
          display: flex;
          justify-content: space-between;
          align-items: stretch;
          gap: 18px;
          margin-bottom: 22px;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #8c6a3c;
          font-weight: 900;
          letter-spacing: .5px;
          text-transform: uppercase;
          font-size: 12px;
        }

        .hero h1 {
          margin: 0;
          font-size: 44px;
          letter-spacing: -1.6px;
          color: #101a14;
        }

        .hero span {
          display: block;
          margin-top: 8px;
          color: #5f665e;
          font-size: 15px;
          max-width: 850px;
          line-height: 1.6;
        }

        .codeCard {
          min-width: 320px;
          border-radius: 28px;
          padding: 22px;
          color: white;
          background:
            radial-gradient(circle at 80% 18%, rgba(214,178,94,.44), transparent 34%),
            linear-gradient(135deg, #244536, #10281f);
          box-shadow: 0 24px 56px rgba(36,69,54,.24);
        }

        .codeCard p {
          margin: 0;
          color: rgba(255,255,255,.72);
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .14em;
          font-size: 12px;
        }

        .codeCard strong {
          display: block;
          margin-top: 10px;
          font-size: 30px;
        }

        .message,
        .empty,
        .stat,
        .panel,
        .linkCard {
          border-radius: 26px;
          background: rgba(255,253,246,.88);
          border: 1px solid rgba(92,70,35,.08);
          box-shadow: 0 18px 42px rgba(82,60,27,.09);
        }

        .message,
        .empty {
          padding: 20px;
          color: #31553d;
          font-weight: 900;
          margin-bottom: 18px;
        }

        .small {
          box-shadow: none;
          border-radius: 18px;
          background: #f3ead8;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 18px;
        }

        .stat {
          padding: 22px;
        }

        .stat p {
          margin: 0;
          color: #6b6b62;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .stat h3 {
          margin: 10px 0 0;
          color: #244536;
          font-size: 28px;
        }

        .stat.good h3 {
          color: #176b3a;
        }

        .linkGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 18px;
        }

        .linkCard,
        .panel {
          padding: 22px;
        }

        .linkCard > span {
          border-radius: 999px;
          padding: 8px 12px;
          background: rgba(214,178,94,.20);
          color: #8c6a3c;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .12em;
        }

        .linkCard h2,
        .panelHead h2 {
          margin: 16px 0 0;
          color: #101a14;
          font-size: 24px;
        }

        .linkCard p,
        .panelHead p {
          margin: 8px 0 0;
          color: #6b6b62;
          line-height: 1.5;
          font-size: 14px;
          font-weight: 800;
        }

        .codeBox,
        .urlBox,
        .rewardBox,
        .rule {
          margin-top: 16px;
          border-radius: 18px;
          background: #f3ead8;
          padding: 14px;
          border: 1px solid rgba(92,70,35,.08);
        }

        .codeBox small,
        .urlBox small,
        .rewardBox span {
          display: block;
          color: #6b6b62;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .codeBox strong,
        .rewardBox strong {
          display: block;
          margin-top: 7px;
          color: #101a14;
          font-size: 22px;
        }

        .urlBox p {
          word-break: break-all;
          color: #244536;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 18px;
        }

        label {
          display: grid;
          gap: 8px;
          margin-top: 18px;
          color: #6b6b62;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        input,
        select {
          width: 100%;
          border: 1px solid rgba(92,70,35,.14);
          border-radius: 14px;
          padding: 13px 14px;
          background: rgba(255,253,246,.94);
          color: #101a14;
          outline: none;
          font-weight: 800;
        }

        button {
          width: 100%;
          margin-top: 16px;
          border: 0;
          border-radius: 16px;
          padding: 15px;
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .rule {
          display: grid;
          grid-template-columns: 42px 1fr;
          gap: 12px;
        }

        .rule span {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #244536;
          color: white;
          font-weight: 900;
        }

        .rule strong {
          color: #101a14;
        }

        .rule p {
          margin: 5px 0 0;
          color: #6b6b62;
          font-size: 13px;
          font-weight: 800;
        }

        .history {
          margin-top: 18px;
        }

        .list {
          display: grid;
          gap: 12px;
          margin-top: 18px;
        }

        .row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 14px;
          align-items: center;
          padding: 16px;
          border-radius: 18px;
          background: #f3ead8;
          border: 1px solid rgba(92,70,35,.08);
        }

        .row strong {
          color: #101a14;
          font-size: 16px;
        }

        .row p,
        .row small {
          display: block;
          margin: 6px 0 0;
          color: #6b6b62;
          font-size: 13px;
          font-weight: 800;
        }

        .right {
          display: grid;
          justify-items: end;
          gap: 8px;
        }

        .right b {
          color: #244536;
        }

        .status {
          display: inline-flex;
          justify-content: center;
          min-width: 92px;
          border-radius: 999px;
          padding: 8px 10px;
          font-size: 11px;
          font-weight: 900;
        }

        .status.pending {
          background: rgba(214,178,94,.20);
          color: #8c6a3c;
        }

        .status.approved,
        .status.completed,
        .status.paid {
          background: rgba(49,85,61,.12);
          color: #31553d;
        }

        .status.rejected,
        .status.failed {
          background: rgba(163,60,42,.12);
          color: #a33c2a;
        }

        @media (max-width: 1100px) {
          .hero,
          .grid {
            grid-template-columns: 1fr;
            flex-direction: column;
          }

          .linkGrid,
          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .codeCard {
            min-width: 100%;
          }
        }

        @media (max-width: 760px) {
          .page {
            padding: 18px;
          }

          .hero h1 {
            font-size: 34px;
          }

          .linkGrid,
          .stats,
          .row {
            grid-template-columns: 1fr;
          }

          .right {
            justify-items: start;
          }
        }
      `}</style>
    </main>
  );
}

function PanelHead({ title, text }: { title: string; text: string }) {
  return (
    <div className="panelHead">
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className={`stat ${good ? "good" : ""}`}>
      <p>{label}</p>
      <h3>{value}</h3>
    </div>
  );
}

function generateReferralCode(email: string) {
  const clean = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${clean.slice(0, 6)}-${suffix}`;
}

function peso(value: number) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusClass(value: string | null) {
  return (value || "pending").toLowerCase().replaceAll(" ", "_");
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}