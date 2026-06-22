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
  price: number | null;
  duration_days: number | null;
  description: string | null;
  status: string | null;
};

type MembershipOrder = {
  id: string;
  profile_id: string;
  plan_id: string | null;
  amount: number | null;
  status: string | null;
  payment_status: string | null;
  created_at: string | null;
};

type Membership = {
  id: string;
  profile_id: string;
  plan_id: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
};

type WalletTransaction = {
  id: string;
  amount: number | null;
  type: string | null;
  transaction_type?: string | null;
  category?: string | null;
  description: string | null;
  status: string | null;
  reference_id?: string | null;
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

      const currentWallet = (walletRows?.[0] as Wallet) || null;
      setWallet(currentWallet);

      const { data: planData, error: planError } = await supabase
        .from("membership_plans")
        .select("id, name, price, duration_days, description, status")
        .order("price", { ascending: true });

      if (planError) throw planError;

      setPlans(
        ((planData || []) as MembershipPlan[]).filter(
          (plan) => normalize(plan.status || "ACTIVE") === "ACTIVE"
        )
      );

      const { data: orderData } = await supabase
        .from("membership_orders")
        .select("id, profile_id, plan_id, amount, status, payment_status, created_at")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false });

      setOrders((orderData || []) as MembershipOrder[]);

      const { data: membershipData } = await supabase
        .from("memberships")
        .select("id, profile_id, plan_id, status, start_date, end_date")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setMembership((membershipData as Membership) || null);

      const { data: transactionData } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("profile_id", currentProfile.id)
        .or("category.ilike.%MEMBERSHIP%,type.ilike.%MEMBERSHIP%,transaction_type.ilike.%MEMBERSHIP%,description.ilike.%Membership%")
        .order("created_at", { ascending: false })
        .limit(20);

      setTransactions((transactionData || []) as WalletTransaction[]);
    } catch (error: any) {
      setMessage(error?.message || "Membership data failed to load.");
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const walletBalance = Number(wallet?.balance || 0);

  const pendingOrder = useMemo(() => {
    return orders.find((order) => normalize(order.status) === "PENDING");
  }, [orders]);

  const activeMembership = normalize(profile?.membership_status) === "ACTIVE" || normalize(membership?.status) === "ACTIVE";

  async function insertMembershipWalletTransaction(orderId: string, plan: MembershipPlan, amount: number) {
    if (!profile) throw new Error("Profile not loaded.");

    const basePayload = {
      profile_id: profile.id,
      wallet_id: wallet?.id || null,
      amount: -Math.abs(amount),
      type: "DEBIT",
      transaction_type: "MEMBERSHIP_PAYMENT",
      category: "MEMBERSHIP",
      status: "COMPLETED",
      description: `Membership payment: ${plan.name || "Membership Plan"}`,
      reference_id: orderId,
    };

    const attempts = [
      basePayload,
      { ...basePayload, transaction_type: "DEBIT" },
      {
        profile_id: profile.id,
        amount: Math.abs(amount),
        type: "MEMBERSHIP_PAYMENT",
        status: "COMPLETED",
        description: `Membership payment: ${plan.name || "Membership Plan"}`,
        reference_id: orderId,
      },
    ];

    let lastError = "Wallet transaction log failed.";

    for (const payload of attempts) {
      const { error } = await supabase.from("wallet_transactions").insert(payload);
      if (!error) return;
      lastError = error.message;
    }

    throw new Error(lastError);
  }

  async function payMembership(plan: MembershipPlan) {
    setMessage("");

    if (!profile) return setMessage("Profile not loaded.");
    if (!wallet) return setMessage("Wallet not found. Please cash in or refresh wallet first.");
    if (activeMembership) return setMessage("Membership is already active.");
    if (pendingOrder) return setMessage("You already have a pending membership order waiting for admin approval.");

    const price = Number(plan.price || 0);

    if (price <= 0) return setMessage("Invalid membership plan price.");
    if (walletBalance < price) return setMessage("Insufficient wallet balance. Please add funds first.");

    setProcessing(true);

    const previousBalance = walletBalance;
    const newBalance = previousBalance - price;

    try {
      const { error: walletError } = await supabase
        .from("wallets")
        .update({ balance: newBalance })
        .eq("id", wallet.id)
        .eq("profile_id", profile.id);

      if (walletError) throw walletError;

      const { data: orderData, error: orderError } = await supabase
        .from("membership_orders")
        .insert({
          profile_id: profile.id,
          plan_id: plan.id,
          amount: price,
          status: "PENDING",
          payment_status: "PAID",
        })
        .select("id")
        .single();

      if (orderError) {
        await supabase.from("wallets").update({ balance: previousBalance }).eq("id", wallet.id);
        throw orderError;
      }

      try {
        await insertMembershipWalletTransaction(orderData.id, plan, price);
      } catch (transactionError: any) {
        await supabase.from("wallets").update({ balance: previousBalance }).eq("id", wallet.id);
        await supabase.from("membership_orders").delete().eq("id", orderData.id).eq("profile_id", profile.id);
        throw transactionError;
      }

      setMessage("Membership payment submitted. Wallet deducted and transaction recorded. Waiting for admin approval.");
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
          <p className="eyebrow">Arganwood Membership Sync</p>
          <h1>Membership Payment</h1>
          <span>
            Pay from wallet, create a pending membership order, and record the wallet transaction so it appears in your ledger.
          </span>
        </div>

        <div className="walletCard">
          <p>Wallet Balance</p>
          <strong>{peso(walletBalance)}</strong>
          <small>{profile?.full_name || profile?.email || "Customer Account"}</small>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      {loading ? (
        <div className="empty">Loading membership data...</div>
      ) : (
        <>
          <section className="stats">
            <Card label="Wallet Balance" value={peso(walletBalance)} />
            <Card label="Membership Status" value={profile?.membership_status || membership?.status || "INACTIVE"} />
            <Card label="KYC Status" value={profile?.kyc_status || "NOT SUBMITTED"} />
          </section>

          {membership && (
            <section className="currentBox">
              <p className="eyebrow">Current Membership</p>
              <h2>{membership.status || "UNKNOWN"}</h2>
              <span>Start: {formatDate(membership.start_date)} • End: {formatDate(membership.end_date)}</span>
            </section>
          )}

          {pendingOrder && (
            <section className="pendingBox">
              <p className="eyebrow">Pending Admin Approval</p>
              <h2>{peso(Number(pendingOrder.amount || 0))}</h2>
              <span>Your payment is recorded. Admin approval will activate the membership.</span>
            </section>
          )}

          <section className="planGrid">
            {plans.length === 0 ? (
              <div className="empty">No active membership plans found.</div>
            ) : (
              plans.map((plan) => {
                const price = Number(plan.price || 0);
                const disabled = processing || !!pendingOrder || activeMembership;

                return (
                  <article className="planCard" key={plan.id}>
                    <p className="eyebrow">Membership Plan</p>
                    <h2>{plan.name || "Unnamed Plan"}</h2>
                    <strong>{peso(price)}</strong>
                    <small>{plan.duration_days || 0} days access</small>
                    <span>{plan.description || "No description added."}</span>
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
                <h2>Membership Orders</h2>
                <button onClick={loadData}>Refresh</button>
              </div>

              {orders.length === 0 ? (
                <div className="empty small">No membership orders yet.</div>
              ) : (
                <div className="list">
                  {orders.map((order) => (
                    <div className="row" key={order.id}>
                      <div>
                        <strong>{peso(Number(order.amount || 0))}</strong>
                        <p>{formatDate(order.created_at)}</p>
                      </div>
                      <span>{order.status || "PENDING"} • {order.payment_status || "UNKNOWN"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="panelHead">
                <h2>Membership Wallet Logs</h2>
              </div>

              {transactions.length === 0 ? (
                <div className="empty small">No membership wallet transaction yet.</div>
              ) : (
                <div className="list">
                  {transactions.map((tx) => (
                    <div className="row" key={tx.id}>
                      <div>
                        <strong>{tx.description || tx.type || "Wallet Transaction"}</strong>
                        <p>{formatDate(tx.created_at)}</p>
                      </div>
                      <span>{peso(Number(tx.amount || 0))} • {tx.status || "COMPLETED"}</span>
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
          color: #18261d;
          font-family: Arial, Helvetica, sans-serif;
          background:
            radial-gradient(circle at 18% 5%, rgba(255, 226, 154, .55), transparent 24%),
            radial-gradient(circle at 92% 8%, rgba(255,255,255,.72), transparent 28%),
            linear-gradient(180deg, #f8f4eb 0%, #f3eadb 52%, #eadcc3 100%);
        }
        .hero { display: flex; justify-content: space-between; gap: 18px; margin-bottom: 22px; }
        .eyebrow { margin: 0 0 8px; color: #8c6a3c; font-weight: 900; text-transform: uppercase; letter-spacing: .12em; font-size: 12px; }
        .hero h1 { margin: 0; font-size: 44px; color: #101a14; letter-spacing: -1.6px; }
        .hero span { display: block; margin-top: 8px; color: #5f665e; max-width: 850px; line-height: 1.6; font-weight: 700; }
        .walletCard { min-width: 290px; border-radius: 28px; padding: 22px; color: white; background: linear-gradient(135deg, #244536, #10281f); box-shadow: 0 24px 56px rgba(36,69,54,.24); }
        .walletCard p { margin: 0; color: rgba(255,255,255,.72); font-weight: 900; text-transform: uppercase; letter-spacing: .14em; font-size: 12px; }
        .walletCard strong { display: block; margin-top: 10px; font-size: 32px; }
        .walletCard small { display: block; margin-top: 6px; color: rgba(255,255,255,.72); font-weight: 800; }
        .message, .empty, .card, .currentBox, .pendingBox, .planCard, .panel { border-radius: 26px; background: rgba(255,253,246,.9); border: 1px solid rgba(92,70,35,.08); box-shadow: 0 18px 42px rgba(82,60,27,.09); }
        .message, .empty { padding: 20px; margin-bottom: 18px; color: #31553d; font-weight: 900; }
        .small { box-shadow: none; background: #f3ead8; border-radius: 18px; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 18px; }
        .card { padding: 22px; }
        .card p { margin: 0; color: #6b6b62; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .12em; }
        .card h3 { margin: 10px 0 0; color: #244536; font-size: 28px; }
        .currentBox, .pendingBox { padding: 22px; margin-bottom: 18px; }
        .currentBox h2, .pendingBox h2 { margin: 0; color: #244536; font-size: 28px; }
        .currentBox span, .pendingBox span { display: block; margin-top: 8px; color: #5f665e; font-weight: 800; }
        .pendingBox { background: rgba(255, 245, 215, .92); }
        .planGrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 18px; }
        .planCard { padding: 24px; display: flex; flex-direction: column; gap: 12px; }
        .planCard h2 { margin: 0; color: #10281f; font-size: 24px; }
        .planCard strong { color: #8c6a3c; font-size: 34px; }
        .planCard small, .planCard span { color: #5f665e; font-weight: 800; line-height: 1.5; }
        button { border: 0; border-radius: 16px; padding: 14px 16px; background: linear-gradient(135deg, #244536, #10281f); color: white; font-weight: 900; cursor: pointer; }
        button:disabled { cursor: not-allowed; opacity: .45; }
        .panel { padding: 22px; }
        .twoCols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .panelHead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .panelHead h2 { margin: 0; color: #10281f; }
        .list { display: grid; gap: 10px; }
        .row { display: flex; justify-content: space-between; gap: 14px; align-items: center; padding: 15px; border-radius: 18px; background: #f3ead8; }
        .row strong { color: #10281f; }
        .row p { margin: 4px 0 0; color: #6b6b62; font-size: 13px; font-weight: 800; }
        .row span { color: #244536; font-weight: 900; text-align: right; }
        @media (max-width: 900px) { .hero, .twoCols { grid-template-columns: 1fr; display: grid; } .stats, .planGrid { grid-template-columns: 1fr; } .walletCard { min-width: 0; } }
      `}</style>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p>{label}</p>
      <h3>{value}</h3>
    </div>
  );
}
