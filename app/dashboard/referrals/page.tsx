"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  referral_code: string | null;
};

type Referral = {
  id: string;
  referred_email: string | null;
  referral_code: string | null;
  qualified: boolean | null;
  reward_amount: number | null;
  status: string | null;
  created_at: string | null;
};

function peso(value: number) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function generateReferralCode(email: string) {
  const base = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `ARGAN-${base || "CUSTOMER"}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function statusClass(value: string | null | undefined) {
  const status = String(value || "").toUpperCase();
  if (["APPROVED", "PAID", "COMPLETED"].includes(status)) return "good";
  if (status === "REJECTED") return "bad";
  return "pending";
}

export default function ReferralsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [referralUrl, setReferralUrl] = useState("");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function findProfile(userId: string, email: string) {
    const cleanEmail = email.trim();
    const lowerEmail = cleanEmail.toLowerCase();

    const { data: profileById, error: byIdError } = await supabase
      .from("profiles")
      .select("id, full_name, email, referral_code")
      .eq("id", userId)
      .maybeSingle();

    if (byIdError) throw byIdError;

    const { data: profileByEmail, error: byEmailError } = await supabase
      .from("profiles")
      .select("id, full_name, email, referral_code")
      .eq("email", lowerEmail)
      .maybeSingle();

    if (byEmailError) throw byEmailError;

    const { data: profileByEmailFallback, error: fallbackError } = await supabase
      .from("profiles")
      .select("id, full_name, email, referral_code")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (fallbackError) throw fallbackError;

    return (profileById || profileByEmail || profileByEmailFallback) as Profile | null;
  }

  async function loadData() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/login";
      return;
    }

    try {
      const currentProfile = await findProfile(user.id, user.email || "");

      if (!currentProfile) {
        setMessage("Profile not found.");
        setLoading(false);
        return;
      }

      const baseCode =
        currentProfile.referral_code ||
        generateReferralCode(currentProfile.email || user.email || "");

      if (!currentProfile.referral_code) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            referral_code: baseCode,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentProfile.id);

        if (updateError) throw updateError;
      }

      const finalProfile = { ...currentProfile, referral_code: baseCode };
      setProfile(finalProfile);

      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : "https://agarwood-platform.vercel.app";

      const computedUrl = `${origin}/login?mode=register&ref=${encodeURIComponent(baseCode)}`;
      setReferralUrl(computedUrl);

      const { error: linkError } = await supabase.from("referral_links").upsert(
        {
          owner_profile_id: finalProfile.id,
          target_type: "CUSTOMER",
          referral_code: baseCode,
          referral_url: computedUrl,
          status: "ACTIVE",
        },
        { onConflict: "owner_profile_id,target_type" }
      );

      if (linkError) throw linkError;

      const { data: referralData, error: referralError } = await supabase
        .from("referrals")
        .select("id, referred_email, referral_code, qualified, reward_amount, status, created_at")
        .eq("referrer_profile_id", finalProfile.id)
        .order("created_at", { ascending: false });

      if (referralError) throw referralError;

      setReferrals((referralData || []) as Referral[]);
    } catch (error: any) {
      setMessage(error?.message || "Referral data failed to load.");
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const total = referrals.length;
    const qualified = referrals.filter((item) => item.qualified).length;
    const pending = referrals.filter(
      (item) => String(item.status || "PENDING").toUpperCase() === "PENDING"
    ).length;
    const rewards = referrals
      .filter((item) =>
        ["APPROVED", "PAID", "COMPLETED"].includes(String(item.status || "").toUpperCase())
      )
      .reduce((sum, item) => sum + Number(item.reward_amount || 0), 0);

    return { total, qualified, pending, rewards };
  }, [referrals]);

  async function copyText(text: string, success: string) {
    if (!text) return setMessage("Still generating.");
    await navigator.clipboard.writeText(text);
    setMessage(success);
  }

  async function submitReferral() {
    setMessage("");

    if (!profile) return setMessage("Profile not found.");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setMessage("Enter a valid referred customer email.");
      return;
    }

    if (cleanEmail === String(profile.email || "").toLowerCase()) {
      setMessage("You cannot refer your own email.");
      return;
    }

    const exists = referrals.some(
      (item) => String(item.referred_email || "").toLowerCase() === cleanEmail
    );

    if (exists) {
      setMessage("This customer already exists in your referral history.");
      return;
    }

    const { error } = await supabase.from("referrals").insert({
      referrer_profile_id: profile.id,
      referred_email: cleanEmail,
      referral_code: profile.referral_code,
      qualified: false,
      reward_amount: 0,
      status: "PENDING",
      created_at: new Date().toISOString(),
    });

    if (error) return setMessage(error.message);

    setEmail("");
    setMessage("Customer referral submitted.");
    await loadData();
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Customer Growth</p>
          <h1>Forest Referral Center</h1>
          <span>
            Share your Forest Referral Link with new customers and track real referral records.
          </span>
        </div>

        <div className="codeCard">
          <p>Your Referral Code</p>
          <strong>{profile?.referral_code || "LOADING"}</strong>
          <button
            onClick={() => copyText(profile?.referral_code || "", "Referral code copied.")}
            disabled={!profile?.referral_code}
          >
            Copy Code
          </button>
        </div>
      </section>

      {loading ? (
        <div className="empty">Loading Forest Referral Center...</div>
      ) : (
        <>
          {message && <div className="message">{message}</div>}

          <section className="stats">
            <Stat label="Total Referrals" value={String(stats.total)} />
            <Stat label="Qualified" value={String(stats.qualified)} />
            <Stat label="Pending" value={String(stats.pending)} />
            <Stat label="Referral Rewards" value={peso(stats.rewards)} />
          </section>

          <section className="shareCard">
            <div>
              <p className="eyebrow">Referral Link</p>
              <h2>Premium Sharing Experience</h2>
              <span>
                This link opens registration mode with your referral code attached.
              </span>
            </div>

            <div className="urlBox">
              <small>Your Link</small>
              <p>{referralUrl || "Generating..."}</p>
            </div>

            <button onClick={() => copyText(referralUrl, "Referral link copied.")}>
              Copy Referral Link
            </button>
          </section>

          <section className="grid">
            <section className="panel">
              <p className="eyebrow">Manual Referral</p>
              <h2>Submit Customer Email</h2>
              <span>Use this when you already know the referred customer email.</span>

              <label>
                Referred Customer Email
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@example.com"
                />
              </label>

              <button onClick={submitReferral}>Submit Referral</button>
            </section>

            <section className="panel">
              <p className="eyebrow">How It Works</p>
              <h2>Referral Flow</h2>

              <div className="rule">
                <b>1</b>
                <div>
                  <strong>Share Link</strong>
                  <p>Send your referral link to a new customer.</p>
                </div>
              </div>

              <div className="rule">
                <b>2</b>
                <div>
                  <strong>Customer Registers</strong>
                  <p>New customer opens register mode with your code.</p>
                </div>
              </div>

              <div className="rule">
                <b>3</b>
                <div>
                  <strong>Reward Review</strong>
                  <p>Admin validates and updates qualification/reward status.</p>
                </div>
              </div>
            </section>
          </section>

          <section className="panel">
            <p className="eyebrow">Referral History</p>
            <h2>Real Referral Records</h2>

            {referrals.length === 0 ? (
              <div className="empty small">No referrals yet.</div>
            ) : (
              <div className="list">
                {referrals.map((item) => (
                  <div className="row" key={item.id}>
                    <div>
                      <strong>{item.referred_email || "No email"}</strong>
                      <p>Code: {item.referral_code || profile?.referral_code || "—"}</p>
                      <small>{formatDate(item.created_at)}</small>
                    </div>

                    <div className="right">
                      <span className={statusClass(item.status)}>
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
          color: #f8f1d8;
          font-family: Arial, Helvetica, sans-serif;
          background:
            radial-gradient(circle at 15% 5%, rgba(214,178,94,.24), transparent 28%),
            radial-gradient(circle at 90% 10%, rgba(65,120,82,.22), transparent 30%),
            linear-gradient(180deg, #07140f 0%, #0d2118 48%, #07120d 100%);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 22px;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #d6b25e;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .14em;
          font-size: 12px;
        }

        h1 {
          margin: 0;
          color: #fff8dc;
          font-size: 46px;
          letter-spacing: -1.6px;
        }

        h2 {
          margin: 0;
          color: #fff8dc;
          font-size: 26px;
        }

        .hero span,
        .shareCard span,
        .panel span {
          display: block;
          margin-top: 8px;
          color: rgba(248,241,216,.68);
          line-height: 1.6;
        }

        .codeCard,
        .stat,
        .shareCard,
        .panel,
        .message,
        .empty {
          border: 1px solid rgba(214,178,94,.22);
          background: rgba(255,255,255,.07);
          backdrop-filter: blur(18px);
          box-shadow: 0 24px 60px rgba(0,0,0,.28);
        }

        .codeCard {
          min-width: 320px;
          border-radius: 28px;
          padding: 24px;
        }

        .codeCard p {
          margin: 0;
          color: rgba(248,241,216,.68);
          font-weight: 900;
        }

        .codeCard strong {
          display: block;
          margin: 10px 0 14px;
          color: #d6b25e;
          font-size: 30px;
          word-break: break-word;
        }

        .message,
        .empty {
          padding: 18px;
          border-radius: 22px;
          margin-bottom: 18px;
          color: #fff8dc;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 18px;
        }

        .stat {
          border-radius: 24px;
          padding: 20px;
        }

        .stat p {
          margin: 0;
          color: rgba(248,241,216,.62);
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .stat h3 {
          margin: 10px 0 0;
          color: #fff8dc;
          font-size: 26px;
        }

        .shareCard,
        .panel {
          border-radius: 28px;
          padding: 22px;
          margin-bottom: 18px;
        }

        .urlBox,
        .rule {
          margin-top: 16px;
          border-radius: 18px;
          background: rgba(0,0,0,.22);
          padding: 14px;
          border: 1px solid rgba(214,178,94,.12);
        }

        .urlBox small {
          color: rgba(248,241,216,.56);
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .urlBox p {
          margin: 8px 0 0;
          color: #d6b25e;
          font-weight: 900;
          word-break: break-all;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }

        label {
          display: grid;
          gap: 8px;
          margin: 18px 0;
          color: rgba(248,241,216,.64);
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        input {
          width: 100%;
          border: 1px solid rgba(214,178,94,.22);
          border-radius: 16px;
          padding: 13px 14px;
          background: rgba(0,0,0,.25);
          color: #fff8dc;
          outline: none;
        }

        button {
          border: 0;
          border-radius: 999px;
          padding: 12px 18px;
          background: linear-gradient(135deg, #d6b25e, #8c6a3c);
          color: #07140f;
          font-weight: 950;
          cursor: pointer;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: .55;
        }

        .rule {
          display: flex;
          gap: 14px;
          align-items: start;
        }

        .rule b {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          color: #07140f;
          background: #d6b25e;
        }

        .rule strong {
          color: #fff8dc;
        }

        .rule p {
          margin: 5px 0 0;
          color: rgba(248,241,216,.62);
        }

        .list {
          display: grid;
          gap: 12px;
          margin-top: 16px;
        }

        .row {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          padding: 14px;
          border-radius: 18px;
          background: rgba(0,0,0,.22);
          border: 1px solid rgba(214,178,94,.12);
        }

        .row strong {
          color: #fff8dc;
        }

        .row p,
        .row small {
          display: block;
          margin: 5px 0 0;
          color: rgba(248,241,216,.6);
        }

        .right {
          text-align: right;
          display: grid;
          gap: 5px;
        }

        .right span,
        .right b {
          font-weight: 900;
        }

        .good { color: #83e6a2; }
        .bad { color: #ff8d8d; }
        .pending { color: #d6b25e; }

        .small {
          box-shadow: none;
          margin-top: 16px;
          background: rgba(0,0,0,.22);
        }

        @media (max-width: 980px) {
          .hero,
          .grid {
            display: grid;
            grid-template-columns: 1fr;
          }

          .stats {
            grid-template-columns: 1fr;
          }

          .codeCard {
            min-width: 0;
          }

          .row {
            display: grid;
          }

          .right {
            text-align: left;
          }
        }
      `}</style>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="stat">
      <p>{label}</p>
      <h3>{value}</h3>
    </article>
  );
}