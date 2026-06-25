// app/dashboard/membership/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  membership_status: string | null;
  kyc_status: string | null;
};

type Wallet = {
  id: string;
  profile_id: string;
  balance: number | null;
};

type MembershipPlan = {
  id: string;
  name: string | null;
  description: string | null;
  annual_fee: number | null;
  status: string | null;
  created_at: string | null;
};

type MembershipOrder = {
  id: string;
  profile_id: string | null;
  plan_name: string | null;
  annual_fee: number | null;
  status: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  amount: number | null;
  payment_status: string | null;
  created_at: string | null;
  plan_id: string | null;
};

type Membership = {
  id: string;
  profile_id: string | null;
  plan_name: string | null;
  amount: number | null;
  start_date: string | null;
  expiry_date: string | null;
  status: string | null;
  created_at: string | null;
};

type WalletTransaction = {
  id: string;
  profile_id: string | null;
  transaction_type: string | null;
  amount: number | null;
  reference_no: string | null;
  description: string | null;
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
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function normalize(value: any) {
  return String(value || "").trim().toUpperCase();
}

function makeReference(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}


const PLAN_BENEFITS: Record<string, string[]> = {
  BASIC: [
    "Unlock Tree Operations",
    "Unlock Sell Tree Requests",
    "Access forestry maintenance services",
    "Request photo, GPS, and health updates",
    "Request valuation support",
    "Keep trees eligible for sale review",
  ],
  PREMIUM: [],
  LEGACY: [],
};

function getPlanTier(plan: MembershipPlan) {
  return "BASIC";
}

function getPlanPosition(tier: string) {
  return "Annual operations access";
}

export default function MembershipPage() {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [orders, setOrders] = useState<MembershipOrder[]>([]);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);

  async function findProfile(userId: string, email: string) {
    const cleanEmail = email.trim();
    const lowerEmail = cleanEmail.toLowerCase();

    const { data: profileById, error: byIdError } = await supabase
      .from("profiles")
      .select("id, email, full_name, membership_status, kyc_status")
      .eq("id", userId)
      .maybeSingle();

    if (byIdError) throw byIdError;

    const { data: profileByEmail, error: byEmailError } = await supabase
      .from("profiles")
      .select("id, email, full_name, membership_status, kyc_status")
      .eq("email", lowerEmail)
      .maybeSingle();

    if (byEmailError) throw byEmailError;

    const { data: profileByEmailFallback, error: fallbackError } = await supabase
      .from("profiles")
      .select("id, email, full_name, membership_status, kyc_status")
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
        setMessage("Profile not found. Please check the customer profile row.");
        setLoading(false);
        return;
      }

      setProfile(currentProfile);

      const { data: walletRows } = await supabase
        .from("wallets")
        .select("id, profile_id, balance")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false })
        .limit(1);

      setWallet((walletRows?.[0] as Wallet) || null);

      const { data: planData, error: planError } = await supabase
        .from("membership_plans")
        .select("id, name, description, annual_fee, status, created_at")
        .order("annual_fee", { ascending: true });

      if (planError) throw planError;

      setPlans(
        ((planData || []) as MembershipPlan[]).filter(
          (plan) => normalize(plan.status || "ACTIVE") === "ACTIVE"
        )
      );

      const { data: orderData, error: orderError } = await supabase
        .from("membership_orders")
        .select(
          "id, profile_id, plan_name, annual_fee, status, submitted_at, approved_at, amount, payment_status, created_at, plan_id"
        )
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false });

      if (orderError) throw orderError;
      setOrders((orderData || []) as MembershipOrder[]);

      const { data: membershipData } = await supabase
        .from("memberships")
        .select("id, profile_id, plan_name, amount, start_date, expiry_date, status, created_at")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setMembership((membershipData as Membership) || null);

      const { data: txData, error: txError } = await supabase
        .from("wallet_transactions")
        .select("id, profile_id, transaction_type, amount, reference_no, description, status, created_at")
        .eq("profile_id", currentProfile.id)
        .or("transaction_type.ilike.%MEMBERSHIP%,description.ilike.%Membership%")
        .order("created_at", { ascending: false })
        .limit(20);

      if (txError) throw txError;
      setTransactions((txData || []) as WalletTransaction[]);
    } catch (error: any) {
      setMessage(error?.message || "Membership data failed to load.");
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const walletBalance = Number(wallet?.balance || 0);

  const activeMembership =
    normalize(profile?.membership_status) === "ACTIVE" ||
    normalize(membership?.status) === "ACTIVE";

  const pendingOrder = useMemo(() => {
    return orders.find((order) => normalize(order.status) === "PENDING");
  }, [orders]);

  async function payMembership(plan: MembershipPlan) {
    setMessage("");

    if (!profile) return setMessage("Profile not loaded.");
    if (!wallet) return setMessage("Wallet not found. Please cash in first.");
    if (activeMembership) return setMessage("Your Arganwood Annual Membership is already active.");
    if (pendingOrder) return setMessage("You already have a pending membership order waiting for admin approval.");

    const annualFee = Number(plan.annual_fee || 999);
    if (walletBalance < annualFee) return setMessage("Insufficient wallet balance. Please cash in first.");

    setProcessing(true);

    try {
      const { error } = await supabase.rpc("submit_membership_order", {
        p_profile_id: profile.id,
      });

      if (error) throw error;

      setMessage("Arganwood Annual Membership payment submitted. Admin approval will activate your membership.");
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || "Membership payment failed.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <main className="membershipPage">
      <div className="membershipContainer">
        <section className="hero">
          <div>
            <p className="eyebrow">Customer Membership</p>
            <h1>Arganwood Annual Membership</h1>
            <span>
              Arganwood Annual Membership unlocks Tree Operations and Sell Tree only. Wallet payment is processed by audited PostgreSQL RPC.
            </span>
          </div>

          <div className="walletCard">
            <p>Wallet Balance</p>
            <strong>{peso(walletBalance)}</strong>
            <small>{profile?.full_name || profile?.email || "Customer"}</small>
          </div>
        </section>

        {message && <div className="message">{message}</div>}

        {loading ? (
          <div className="empty">Loading Arganwood Annual Membership...</div>
        ) : (
          <>
            <section className="stats">
              <Card label="Wallet Balance" value={peso(walletBalance)} />
              <Card label="Membership" value={profile?.membership_status || membership?.status || "INACTIVE"} />
              <Card label="KYC" value={profile?.kyc_status || "NOT SUBMITTED"} />
            </section>

            {membership && (
              <section className="currentBox">
                <p className="eyebrow">Current Membership</p>
                <h2>{membership.plan_name || "Arganwood Annual Membership"}</h2>
                <span>
                  Status: {membership.status || "UNKNOWN"} • Start: {formatDate(membership.start_date)} • Expiry:{" "}
                  {formatDate(membership.expiry_date)}
                </span>
              </section>
            )}

            {pendingOrder && (
              <section className="pendingBox">
                <p className="eyebrow">Pending Approval</p>
                <h2>{peso(Number(pendingOrder.amount || pendingOrder.annual_fee || 0))}</h2>
                <span>
                  Submitted: {formatDate(pendingOrder.submitted_at || pendingOrder.created_at)}. Admin approval will activate your membership.
                </span>
              </section>
            )}

            <section className="planGrid">
              {plans.length === 0 ? (
                <div className="empty">No active membership plans found.</div>
              ) : (
                plans.map((plan) => {
                  const annualFee = Number(plan.annual_fee || 0);
                  const disabled = processing || !!pendingOrder || activeMembership;
                  const tier = getPlanTier(plan);
                  const benefits = PLAN_BENEFITS[tier] || PLAN_BENEFITS.BASIC;

                  return (
                    <article className={`planCard ${tier.toLowerCase()}`} key={plan.id}>
                      <div className="planTopline">
                        <p className="eyebrow">Forest Plan</p>
                        <em>{getPlanPosition(tier)}</em>
                      </div>
                      <h2>{plan.name || "Arganwood Annual Membership"}</h2>
                      <strong>{peso(annualFee)}</strong>
                      <small>₱999 / Year</small>
                      <span>{plan.description || "Annual access for Tree Operations and Sell Tree services."}</span>

                      <ul className="benefitList">
                        {benefits.map((benefit) => (
                          <li key={benefit}>
                            <b>✓</b>
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>

                      <button disabled={disabled} onClick={() => payMembership(plan)}>
                        {activeMembership
                          ? "Already Active"
                          : pendingOrder
                          ? "Waiting Approval"
                          : processing
                          ? "Processing..."
                          : "Activate Membership"}
                      </button>
                    </article>
                  );
                })
              )}
            </section>

            <section className="panel twoCols">
              <div className="minCol">
                <div className="panelHead">
                  <h2>Membership History</h2>
                  <button onClick={loadData}>Refresh</button>
                </div>

                {orders.length === 0 ? (
                  <div className="empty small">No membership orders yet.</div>
                ) : (
                  <div className="list">
                    {orders.map((order) => (
                      <div className="row" key={order.id}>
                        <div>
                          <strong>{order.plan_name || "Arganwood Annual Membership"}</strong>
                          <p>
                            {peso(Number(order.amount || order.annual_fee || 0))} • Submitted{" "}
                            {formatDate(order.submitted_at || order.created_at)}
                          </p>
                        </div>
                        <span>
                          {order.status || "PENDING"} • {order.payment_status || "UNKNOWN"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="minCol">
                <div className="panelHead">
                  <h2>Wallet Logs</h2>
                </div>

                {transactions.length === 0 ? (
                  <div className="empty small">No membership wallet logs yet.</div>
                ) : (
                  <div className="list">
                    {transactions.map((tx) => (
                      <div className="row" key={tx.id}>
                        <div>
                          <strong>{tx.transaction_type || "MEMBERSHIP_PAYMENT"}</strong>
                          <p>{tx.description || tx.reference_no || "Membership transaction"}</p>
                        </div>
                        <span>
                          {peso(Number(tx.amount || 0))} • {tx.status || "COMPLETED"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      <style>{`
        * { box-sizing: border-box; }

        .membershipPage {
          width: 100%;
          min-width: 0;
          min-height: 100vh;
          overflow-x: hidden;
          color: #f8f1d8;
          font-family: Arial, Helvetica, sans-serif;
          background:
            radial-gradient(circle at 15% 5%, rgba(214,178,94,.24), transparent 28%),
            radial-gradient(circle at 90% 10%, rgba(65,120,82,.22), transparent 30%),
            linear-gradient(180deg, #07140f 0%, #0d2118 48%, #07120d 100%);
        }

        .membershipContainer {
          width: 100%;
          max-width: 1280px;
          min-width: 0;
          margin: 0 auto;
          padding: 30px;
        }

        .hero {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 22px;
          min-width: 0;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #d6b25e;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .14em;
          font-size: 12px;
        }

        .hero h1 {
          margin: 0;
          font-size: clamp(34px, 5vw, 46px);
          color: #fff8dc;
          letter-spacing: -1.6px;
        }

        .hero span {
          display: block;
          margin-top: 10px;
          color: rgba(248,241,216,.72);
          max-width: 820px;
          line-height: 1.6;
        }

        .walletCard,
        .planCard,
        .currentBox,
        .pendingBox,
        .panel,
        .message,
        .empty,
        .card {
          border: 1px solid rgba(214,178,94,.22);
          background: linear-gradient(180deg, rgba(255,255,255,.105), rgba(255,255,255,.055));
          backdrop-filter: blur(18px);
          box-shadow: 0 24px 60px rgba(0,0,0,.28);
        }

        .walletCard {
          width: 100%;
          max-width: 330px;
          min-width: 260px;
          border-radius: 28px;
          padding: 24px;
        }

        .walletCard p,
        .walletCard small {
          margin: 0;
          color: rgba(248,241,216,.68);
          font-weight: 900;
        }

        .walletCard strong {
          display: block;
          margin: 10px 0;
          font-size: clamp(26px, 4vw, 34px);
          color: #d6b25e;
          word-break: break-word;
        }

        .message,
        .empty {
          width: 100%;
          min-width: 0;
          padding: 18px;
          border-radius: 22px;
          margin-bottom: 18px;
          color: #fff8dc;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
          min-width: 0;
        }

        .card {
          min-width: 0;
          border-radius: 24px;
          padding: 20px;
        }

        .card p {
          margin: 0;
          color: rgba(248,241,216,.62);
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .card h3 {
          margin: 10px 0 0;
          color: #fff8dc;
          font-size: clamp(20px, 3vw, 26px);
          overflow-wrap: anywhere;
        }

        .currentBox,
        .pendingBox {
          width: 100%;
          min-width: 0;
          border-radius: 28px;
          padding: 22px;
          margin-bottom: 18px;
        }

        .currentBox h2,
        .pendingBox h2 {
          margin: 0;
          color: #fff8dc;
          font-size: clamp(24px, 4vw, 30px);
        }

        .currentBox span,
        .pendingBox span {
          display: block;
          margin-top: 8px;
          color: rgba(248,241,216,.68);
          line-height: 1.5;
        }

        .planGrid {
          width: 100%;
          min-width: 0;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
        }

        .planCard {
          min-width: 0;
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          padding: 24px;
          min-height: 560px;
          display: flex;
          flex-direction: column;
        }


        .planCard.premium {
          border-color: rgba(214,178,94,.48);
          box-shadow: 0 30px 80px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.14);
        }

        .planCard.legacy {
          border-color: rgba(255,224,137,.58);
          background:
            radial-gradient(circle at 85% 5%, rgba(214,178,94,.20), transparent 34%),
            linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.055));
        }

        .planTopline {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 6px;
        }

        .planTopline em {
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(214,178,94,.14);
          border: 1px solid rgba(214,178,94,.22);
          color: #f6dc98;
          font-size: 11px;
          font-style: normal;
          font-weight: 950;
          white-space: nowrap;
        }

        .planCard h2 {
          margin: 0;
          color: #fff8dc;
          font-size: 26px;
          overflow-wrap: anywhere;
        }

        .planCard strong {
          display: block;
          margin-top: 14px;
          color: #d6b25e;
          font-size: clamp(26px, 4vw, 34px);
          overflow-wrap: anywhere;
        }

        .planCard small {
          margin-top: 4px;
          color: rgba(248,241,216,.62);
          font-weight: 900;
        }

        .planCard span {
          display: block;
          margin: 16px 0;
          color: rgba(248,241,216,.7);
          line-height: 1.6;
          flex: 1;
        }


        .benefitList {
          list-style: none;
          padding: 0;
          margin: 0 0 20px;
          display: grid;
          gap: 10px;
          flex: 1;
        }

        .benefitList li {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px 11px;
          border-radius: 16px;
          background: rgba(0,0,0,.18);
          border: 1px solid rgba(214,178,94,.11);
          color: rgba(248,241,216,.82);
          font-size: 13px;
          line-height: 1.35;
          font-weight: 800;
        }

        .benefitList b {
          color: #d6b25e;
          flex: 0 0 auto;
        }

        .benefitList span {
          margin: 0;
          color: inherit;
          line-height: inherit;
          flex: initial;
        }

        button {
          border: 0;
          border-radius: 999px;
          padding: 12px 16px;
          background: linear-gradient(135deg, #d6b25e, #8c6a3c);
          color: #07140f;
          font-weight: 950;
          cursor: pointer;
          white-space: nowrap;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: .55;
        }

        .panel {
          width: 100%;
          min-width: 0;
          border-radius: 28px;
          padding: 22px;
        }

        .twoCols {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .minCol {
          min-width: 0;
        }

        .panelHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          margin-bottom: 16px;
          min-width: 0;
        }

        .panelHead h2 {
          margin: 0;
          color: #fff8dc;
          font-size: clamp(20px, 3vw, 24px);
        }

        .list {
          display: grid;
          gap: 12px;
          min-width: 0;
        }

        .row {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          padding: 14px;
          border-radius: 18px;
          background: rgba(0,0,0,.22);
          border: 1px solid rgba(214,178,94,.12);
          min-width: 0;
        }

        .row div {
          min-width: 0;
        }

        .row strong {
          color: #fff8dc;
          overflow-wrap: anywhere;
        }

        .row p {
          margin: 6px 0 0;
          color: rgba(248,241,216,.6);
          line-height: 1.4;
          overflow-wrap: anywhere;
        }

        .row span {
          color: #d6b25e;
          font-weight: 900;
          white-space: nowrap;
        }

        .small {
          box-shadow: none;
          margin: 0;
          background: rgba(0,0,0,.2);
        }

        @media (max-width: 1100px) {
          .membershipContainer {
            padding: 24px;
          }

          .planGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 980px) {
          .hero,
          .twoCols {
            grid-template-columns: 1fr;
            display: grid;
          }

          .walletCard {
            max-width: none;
            min-width: 0;
          }

          .stats,
          .planGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .membershipContainer {
            padding: 18px;
          }

          .row,
          .panelHead {
            align-items: flex-start;
            flex-direction: column;
          }

          .row span {
            white-space: normal;
          }

          button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <article className="card">
      <p>{label}</p>
      <h3>{value}</h3>
    </article>
  );
}