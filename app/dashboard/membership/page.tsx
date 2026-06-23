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

  async function insertMembershipWalletTransaction(orderId: string, plan: MembershipPlan, amount: number) {
    if (!profile) throw new Error("Profile not loaded.");

    const referenceNo = makeReference("MEMBERSHIP");

    const { error } = await supabase.from("wallet_transactions").insert({
      profile_id: profile.id,
      transaction_type: "MEMBERSHIP_PAYMENT",
      amount: -Math.abs(amount),
      reference_no: referenceNo,
      description: `Forest Membership payment: ${plan.name || "Membership Plan"} / Order ${orderId}`,
      status: "COMPLETED",
      created_at: new Date().toISOString(),
    });

    if (error) throw error;
  }

  async function payMembership(plan: MembershipPlan) {
    setMessage("");

    if (!profile) return setMessage("Profile not loaded.");
    if (!wallet) return setMessage("Wallet not found. Please cash in first.");
    if (activeMembership) return setMessage("Your Forest Membership is already active.");
    if (pendingOrder) return setMessage("You already have a pending membership order waiting for admin approval.");

    const annualFee = Number(plan.annual_fee || 0);

    if (annualFee <= 0) return setMessage("Invalid membership annual fee.");
    if (walletBalance < annualFee) return setMessage("Insufficient wallet balance. Please add funds first.");

    setProcessing(true);

    const previousBalance = walletBalance;
    const newBalance = previousBalance - annualFee;

    try {
      const { error: walletError } = await supabase
        .from("wallets")
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", wallet.id)
        .eq("profile_id", profile.id);

      if (walletError) throw walletError;

      const { data: orderData, error: orderError } = await supabase
        .from("membership_orders")
        .insert({
          profile_id: profile.id,
          plan_id: plan.id,
          plan_name: plan.name || "Forest Membership",
          annual_fee: annualFee,
          amount: annualFee,
          status: "PENDING",
          payment_status: "PAID",
          submitted_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (orderError) {
        await supabase.from("wallets").update({ balance: previousBalance }).eq("id", wallet.id);
        throw orderError;
      }

      try {
        await insertMembershipWalletTransaction(orderData.id, plan, annualFee);
      } catch (txError) {
        await supabase.from("wallets").update({ balance: previousBalance }).eq("id", wallet.id);
        await supabase
          .from("membership_orders")
          .delete()
          .eq("id", orderData.id)
          .eq("profile_id", profile.id);
        throw txError;
      }

      setMessage("Forest Membership payment submitted. Wallet deducted and order is waiting for admin approval.");
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || "Membership payment failed.");
    }

    setProcessing(false);
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Customer Account</p>
          <h1>Forest Membership</h1>
          <span>
            Activate your premium customer access using wallet payment. Admin approval will activate your membership.
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
        <div className="empty">Loading Forest Membership...</div>
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
              <h2>{membership.plan_name || "Forest Membership"}</h2>
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

                return (
                  <article className="planCard" key={plan.id}>
                    <p className="eyebrow">Forest Plan</p>
                    <h2>{plan.name || "Forest Membership"}</h2>
                    <strong>{peso(annualFee)}</strong>
                    <small>Annual membership fee</small>
                    <span>{plan.description || "Premium access to Arganwood customer services."}</span>

                    <button disabled={disabled} onClick={() => payMembership(plan)}>
                      {activeMembership
                        ? "Already Active"
                        : pendingOrder
                        ? "Waiting Approval"
                        : processing
                        ? "Processing..."
                        : "Pay From Wallet"}
                    </button>
                  </article>
                );
              })
            )}
          </section>

          <section className="panel twoCols">
            <div>
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
                        <strong>{order.plan_name || "Forest Membership"}</strong>
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

            <div>
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

        .hero h1 {
          margin: 0;
          font-size: 46px;
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
          background: rgba(255,255,255,.07);
          backdrop-filter: blur(18px);
          box-shadow: 0 24px 60px rgba(0,0,0,.28);
        }

        .walletCard {
          min-width: 290px;
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
          font-size: 34px;
          color: #d6b25e;
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
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 18px;
        }

        .card {
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
          font-size: 26px;
        }

        .currentBox,
        .pendingBox {
          border-radius: 28px;
          padding: 22px;
          margin-bottom: 18px;
        }

        .currentBox h2,
        .pendingBox h2 {
          margin: 0;
          color: #fff8dc;
          font-size: 30px;
        }

        .currentBox span,
        .pendingBox span {
          display: block;
          margin-top: 8px;
          color: rgba(248,241,216,.68);
        }

        .planGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
        }

        .planCard {
          border-radius: 28px;
          padding: 24px;
          min-height: 280px;
          display: flex;
          flex-direction: column;
        }

        .planCard h2 {
          margin: 0;
          color: #fff8dc;
          font-size: 26px;
        }

        .planCard strong {
          display: block;
          margin-top: 14px;
          color: #d6b25e;
          font-size: 34px;
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

        button {
          border: 0;
          border-radius: 999px;
          padding: 12px 16px;
          background: linear-gradient(135deg, #d6b25e, #8c6a3c);
          color: #07140f;
          font-weight: 950;
          cursor: pointer;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: .55;
        }

        .panel {
          border-radius: 28px;
          padding: 22px;
        }

        .twoCols {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }

        .panelHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          margin-bottom: 16px;
        }

        .panelHead h2 {
          margin: 0;
          color: #fff8dc;
          font-size: 24px;
        }

        .list {
          display: grid;
          gap: 12px;
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

        .row p {
          margin: 6px 0 0;
          color: rgba(248,241,216,.6);
          line-height: 1.4;
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

        @media (max-width: 980px) {
          .hero,
          .twoCols {
            grid-template-columns: 1fr;
            display: grid;
          }

          .stats,
          .planGrid {
            grid-template-columns: 1fr;
          }

          .walletCard {
            min-width: 0;
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