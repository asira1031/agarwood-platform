"use client";

import Link from "next/link";
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

const MEMBERSHIP_BENEFITS = [
  "Unlock Tree Operations and forest care requests",
  "Request Sell Tree review when ready",
  "Access QR verified tree records",
  "Monitor portfolio activity and service history",
  "View approved photo, GPS, and health evidence",
  "Access customer support for your Arganwood account",
];

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
        setMessage("Profile not found. Please contact support.");
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

  const annualPlan = useMemo(() => {
    return plans[0] || null;
  }, [plans]);

  const annualFee = Number(annualPlan?.annual_fee || pendingOrder?.amount || pendingOrder?.annual_fee || membership?.amount || 999);

  async function payMembership() {
    setMessage("");

    if (!profile) return setMessage("Profile not loaded.");
    if (!wallet) return setMessage("Wallet not found. Please cash in first.");
    if (!annualPlan) return setMessage("No active membership plan found.");
    if (activeMembership) return setMessage("Your Arganwood Annual Membership is already active.");
    if (pendingOrder) return setMessage("You already have a pending membership order waiting for admin approval.");
    if (walletBalance < annualFee) return setMessage("Insufficient wallet balance. Please cash in first.");

    setProcessing(true);

    try {
      const { error } = await supabase.rpc("submit_membership_order", {
        p_profile_id: profile.id,
      });

      if (error) throw error;

      setMessage("Membership payment submitted. Admin approval will activate your Arganwood Annual Membership.");
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || "Membership payment failed.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <main className="membershipPage">
      <div className="membershipShell">
        <section className="hero">
          <div className="heroCopy">
            <p className="eyebrow">Arganwood Access</p>
            <h1>Arganwood Annual Membership</h1>
            <p>
              One simple annual membership for Tree Operations, Sell Tree access,
              QR verified records, customer service, and portfolio monitoring.
            </p>

            <div className="heroActions">
              <Link href="/dashboard">Back to Dashboard</Link>
              <Link href="/dashboard/wallet">Open Wallet</Link>
            </div>
          </div>

          <div className="statusGlass">
            <span className={`statusBadge ${activeMembership ? "active" : pendingOrder ? "pending" : ""}`}>
              {activeMembership ? "ACTIVE" : pendingOrder ? "PENDING APPROVAL" : "NOT ACTIVE"}
            </span>

            <h2>{profile?.full_name || profile?.email || "Customer"}</h2>
            <p>Wallet Balance</p>
            <strong>{peso(walletBalance)}</strong>
          </div>
        </section>

        {message && <div className="messageBox">{message}</div>}

        {loading ? (
          <div className="emptyBox">Loading membership records...</div>
        ) : (
          <>
            <section className="summaryGrid">
              <SummaryCard label="Membership Status" value={profile?.membership_status || membership?.status || "INACTIVE"} />
              <SummaryCard label="Start Date" value={formatDate(membership?.start_date)} />
              <SummaryCard label="Expiry Date" value={formatDate(membership?.expiry_date)} />
              <SummaryCard label="KYC Status" value={profile?.kyc_status || "NOT SUBMITTED"} />
            </section>

            <section className="mainGrid">
              <article className="membershipCard">
                <div className="cardTop">
                  <div>
                    <p className="eyebrow">Membership Product</p>
                    <h2>Arganwood Annual Membership</h2>
                  </div>

                  <div className="priceBox">
                    <small>Annual Fee</small>
                    <b>{peso(annualFee)}</b>
                  </div>
                </div>

                <p className="membershipDescription">
                  {annualPlan?.description ||
                    "Annual access for Arganwood customer features and forest operation services."}
                </p>

                <div className="benefitGrid">
                  {MEMBERSHIP_BENEFITS.map((benefit) => (
                    <div className="benefit" key={benefit}>
                      <span>✓</span>
                      <p>{benefit}</p>
                    </div>
                  ))}
                </div>

                <div className="actionBox">
                  <button
                    type="button"
                    disabled={processing || !!pendingOrder || activeMembership || !annualPlan}
                    onClick={payMembership}
                  >
                    {activeMembership
                      ? "Membership Active"
                      : pendingOrder
                      ? "Waiting for Admin Approval"
                      : processing
                      ? "Processing..."
                      : "Pay / Renew Membership"}
                  </button>

                  <p>
                    Payment and approval are handled by the existing audited membership RPC.
                    Admin approval activates your access after submission.
                  </p>
                </div>
              </article>

              <aside className="timelineCard">
                <p className="eyebrow">How It Works</p>
                <h2>Approval Flow</h2>

                <div className="timeline">
                  <Step done={Boolean(pendingOrder || activeMembership)} title="Pay Membership" text="Submit annual payment from wallet." />
                  <Step done={Boolean(pendingOrder || activeMembership)} title="Admin Review" text="Admin verifies and approves the order." />
                  <Step done={activeMembership} title="Membership Activated" text="Your membership becomes ACTIVE." />
                  <Step done={activeMembership} title="Access Features" text="Use Tree Operations, Sell Tree, QR records, and support." />
                </div>

                {pendingOrder && (
                  <div className="pendingNotice">
                    <strong>Pending Approval</strong>
                    <p>
                      Submitted {formatDate(pendingOrder.submitted_at || pendingOrder.created_at)}.
                      Please wait for admin approval.
                    </p>
                  </div>
                )}
              </aside>
            </section>

            <section className="historyGrid">
              <div className="panel">
                <div className="panelHead">
                  <div>
                    <p className="eyebrow">Membership Orders</p>
                    <h2>History</h2>
                  </div>
                  <button type="button" onClick={loadData}>Refresh</button>
                </div>

                {orders.length === 0 ? (
                  <div className="emptySmall">No membership orders yet.</div>
                ) : (
                  <div className="list">
                    {orders.map((order) => (
                      <div className="row" key={order.id}>
                        <div>
                          <strong>{order.plan_name || "Arganwood Annual Membership"}</strong>
                          <p>{formatDate(order.submitted_at || order.created_at)}</p>
                        </div>
                        <span>
                          {peso(Number(order.amount || order.annual_fee || 0))} • {order.status || "PENDING"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panelHead">
                  <div>
                    <p className="eyebrow">Wallet Logs</p>
                    <h2>Membership Payments</h2>
                  </div>
                </div>

                {transactions.length === 0 ? (
                  <div className="emptySmall">No membership wallet logs yet.</div>
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
        * {
          box-sizing: border-box;
        }

        .membershipPage {
          min-height: 100vh;
          width: 100%;
          overflow-x: hidden;
          color: #f8f1d8;
          font-family: Arial, Helvetica, sans-serif;
          background:
            radial-gradient(circle at 15% 5%, rgba(214,178,94,.24), transparent 28%),
            radial-gradient(circle at 88% 10%, rgba(65,120,82,.22), transparent 32%),
            linear-gradient(180deg, #06110d 0%, #0d2118 48%, #07120d 100%);
        }

        .membershipShell {
          width: 100%;
          max-width: 1280px;
          margin: 0 auto;
          padding: 28px;
        }

        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 360px;
          gap: 18px;
          margin-bottom: 18px;
        }

        .heroCopy,
        .statusGlass,
        .summaryCard,
        .membershipCard,
        .timelineCard,
        .panel,
        .messageBox,
        .emptyBox {
          border: 1px solid rgba(214,178,94,.22);
          background: linear-gradient(180deg, rgba(255,255,255,.105), rgba(255,255,255,.055));
          backdrop-filter: blur(18px);
          box-shadow: 0 24px 60px rgba(0,0,0,.28);
        }

        .heroCopy {
          border-radius: 32px;
          padding: 30px;
          background:
            linear-gradient(rgba(2,20,12,.70), rgba(2,20,12,.88)),
            url('/images/agarwood-real-tree.jpg');
          background-size: cover;
          background-position: center;
        }

        .eyebrow {
          margin: 0 0 9px;
          color: #d6b25e;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: .16em;
          text-transform: uppercase;
        }

        h1,
        h2,
        p {
          margin-top: 0;
        }

        .hero h1 {
          margin-bottom: 14px;
          color: #fff8dc;
          font-size: clamp(36px, 6vw, 58px);
          line-height: .95;
          letter-spacing: -2px;
        }

        .hero p,
        .membershipDescription,
        .actionBox p,
        .timelineCard p,
        .row p {
          color: rgba(248,241,216,.68);
          line-height: 1.65;
        }

        .heroActions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 24px;
        }

        .heroActions a,
        .panelHead button,
        .actionBox button {
          border: 0;
          border-radius: 999px;
          padding: 13px 17px;
          background: linear-gradient(135deg, #d6b25e, #8c6a3c);
          color: #07140f;
          font-weight: 950;
          text-decoration: none;
          cursor: pointer;
        }

        .heroActions a:nth-child(2) {
          background: rgba(255,255,255,.10);
          color: #fff8dc;
          border: 1px solid rgba(214,178,94,.22);
        }

        .statusGlass {
          border-radius: 32px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 290px;
        }

        .statusBadge {
          align-self: flex-start;
          border-radius: 999px;
          padding: 9px 12px;
          background: rgba(255,255,255,.10);
          border: 1px solid rgba(214,178,94,.22);
          color: #f8f1d8;
          font-size: 12px;
          font-weight: 950;
        }

        .statusBadge.active {
          background: rgba(16,185,129,.16);
          border-color: rgba(16,185,129,.35);
          color: #b8f7d1;
        }

        .statusBadge.pending {
          background: rgba(214,178,94,.16);
          border-color: rgba(214,178,94,.38);
          color: #ffe49a;
        }

        .statusGlass h2 {
          margin: 22px 0 0;
          color: #fff8dc;
          font-size: 25px;
          overflow-wrap: anywhere;
        }

        .statusGlass p {
          margin: auto 0 8px;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: rgba(248,241,216,.55);
        }

        .statusGlass strong {
          color: #d6b25e;
          font-size: clamp(28px, 4vw, 38px);
          overflow-wrap: anywhere;
        }

        .messageBox,
        .emptyBox {
          border-radius: 22px;
          padding: 18px;
          margin-bottom: 18px;
          color: #fff8dc;
          font-weight: 900;
        }

        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .summaryCard {
          border-radius: 24px;
          padding: 18px;
        }

        .summaryCard p {
          margin: 0;
          color: rgba(248,241,216,.55);
          font-size: 11px;
          font-weight: 950;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .summaryCard h3 {
          margin: 10px 0 0;
          color: #fff8dc;
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .mainGrid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(320px, .65fr);
          gap: 18px;
          margin-bottom: 18px;
        }

        .membershipCard,
        .timelineCard,
        .panel {
          border-radius: 30px;
          padding: 24px;
          overflow: hidden;
        }

        .cardTop {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-start;
          margin-bottom: 14px;
        }

        .membershipCard h2,
        .timelineCard h2,
        .panel h2 {
          margin: 0;
          color: #fff8dc;
          font-size: clamp(26px, 4vw, 34px);
          letter-spacing: -.8px;
        }

        .priceBox {
          min-width: 160px;
          border-radius: 22px;
          padding: 16px;
          background: rgba(0,0,0,.26);
          border: 1px solid rgba(214,178,94,.18);
          text-align: right;
        }

        .priceBox small {
          display: block;
          color: rgba(248,241,216,.55);
          font-weight: 900;
        }

        .priceBox b {
          display: block;
          margin-top: 8px;
          color: #d6b25e;
          font-size: 24px;
        }

        .benefitGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin: 22px 0;
        }

        .benefit {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          border-radius: 18px;
          padding: 14px;
          background: rgba(0,0,0,.22);
          border: 1px solid rgba(214,178,94,.12);
        }

        .benefit span {
          width: 26px;
          height: 26px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(214,178,94,.18);
          color: #d6b25e;
          font-weight: 950;
        }

        .benefit p {
          margin: 0;
          color: rgba(248,241,216,.78);
          font-weight: 800;
          line-height: 1.45;
        }

        .actionBox {
          border-radius: 22px;
          padding: 18px;
          background: rgba(0,0,0,.22);
          border: 1px solid rgba(214,178,94,.14);
        }

        .actionBox button {
          width: 100%;
          font-size: 15px;
        }

        .actionBox button:disabled {
          cursor: not-allowed;
          opacity: .55;
        }

        .actionBox p {
          margin: 12px 0 0;
          font-size: 13px;
        }

        .timeline {
          display: grid;
          gap: 12px;
          margin-top: 20px;
        }

        .step {
          display: grid;
          grid-template-columns: 38px 1fr;
          gap: 12px;
          align-items: flex-start;
          border-radius: 18px;
          padding: 14px;
          background: rgba(0,0,0,.22);
          border: 1px solid rgba(214,178,94,.12);
        }

        .stepIcon {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(255,255,255,.10);
          color: rgba(248,241,216,.65);
          font-weight: 950;
        }

        .step.done .stepIcon {
          background: linear-gradient(135deg, #d6b25e, #8c6a3c);
          color: #07140f;
        }

        .step strong {
          color: #fff8dc;
        }

        .step p {
          margin: 4px 0 0;
          font-size: 13px;
        }

        .pendingNotice {
          margin-top: 18px;
          border-radius: 20px;
          padding: 16px;
          background: rgba(214,178,94,.12);
          border: 1px solid rgba(214,178,94,.24);
        }

        .pendingNotice strong {
          color: #ffe49a;
        }

        .pendingNotice p {
          margin: 6px 0 0;
          font-size: 13px;
        }

        .historyGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .panelHead {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 16px;
        }

        .panelHead button {
          padding: 10px 14px;
        }

        .list {
          display: grid;
          gap: 12px;
        }

        .row {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          border-radius: 18px;
          padding: 14px;
          background: rgba(0,0,0,.22);
          border: 1px solid rgba(214,178,94,.12);
        }

        .row div {
          min-width: 0;
        }

        .row strong {
          display: block;
          color: #fff8dc;
          overflow-wrap: anywhere;
        }

        .row p {
          margin: 5px 0 0;
          font-size: 13px;
        }

        .row span {
          color: #d6b25e;
          font-weight: 950;
          white-space: nowrap;
        }

        .emptySmall {
          border-radius: 18px;
          padding: 16px;
          background: rgba(0,0,0,.22);
          border: 1px solid rgba(214,178,94,.12);
          color: rgba(248,241,216,.62);
          font-weight: 800;
        }

        @media (max-width: 1080px) {
          .hero,
          .mainGrid,
          .historyGrid {
            grid-template-columns: 1fr;
          }

          .summaryGrid,
          .benefitGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .membershipShell {
            padding: 18px;
          }

          .summaryGrid,
          .benefitGrid {
            grid-template-columns: 1fr;
          }

          .cardTop,
          .panelHead,
          .row {
            flex-direction: column;
          }

          .priceBox {
            width: 100%;
            text-align: left;
          }

          .row span {
            white-space: normal;
          }

          .heroActions a,
          .panelHead button {
            width: 100%;
            text-align: center;
          }
        }
      `}</style>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="summaryCard">
      <p>{label}</p>
      <h3>{value}</h3>
    </article>
  );
}

function Step({ done, title, text }: { done: boolean; title: string; text: string }) {
  return (
    <div className={`step ${done ? "done" : ""}`}>
      <span className="stepIcon">{done ? "✓" : "•"}</span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}