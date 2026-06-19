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

export default function MembershipPage() {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [orders, setOrders] = useState<MembershipOrder[]>([]);
  const [membership, setMembership] = useState<Membership | null>(null);

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

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, membership_status, kyc_status")
      .eq("id", user.id)
      .single();

    if (profileError || !profileData) {
      setMessage(profileError?.message || "Profile not found.");
      setLoading(false);
      return;
    }

    setProfile(profileData);

    const { data: walletData } = await supabase
      .from("wallets")
      .select("id, profile_id, balance")
      .eq("profile_id", profileData.id)
      .maybeSingle();

    setWallet(walletData || null);

    const { data: planData, error: planError } = await supabase
      .from("membership_plans")
      .select("id, name, price, duration_days, description, status")
      .order("price", { ascending: true });

    if (planError) {
      setMessage(planError.message);
      setLoading(false);
      return;
    }

    setPlans((planData || []).filter((plan) => (plan.status || "ACTIVE") === "ACTIVE"));

    const { data: orderData } = await supabase
      .from("membership_orders")
      .select("id, profile_id, plan_id, amount, status, payment_status, created_at")
      .eq("profile_id", profileData.id)
      .order("created_at", { ascending: false });

    setOrders(orderData || []);

    const { data: membershipData } = await supabase
      .from("memberships")
      .select("id, profile_id, plan_id, status, start_date, end_date")
      .eq("profile_id", profileData.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setMembership(membershipData || null);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const walletBalance = Number(wallet?.balance || 0);

  const pendingOrder = useMemo(() => {
    return orders.find(
      (order) =>
        (order.status || "").toUpperCase() === "PENDING" ||
        (order.payment_status || "").toUpperCase() === "PAID"
    );
  }, [orders]);

  async function payMembership(plan: MembershipPlan) {
    setMessage("");

    if (!profile) {
      setMessage("Profile not loaded.");
      return;
    }

    if (!wallet) {
      setMessage("Wallet not found. Please create or refresh your wallet first.");
      return;
    }

    if (pendingOrder) {
      setMessage("You already have a pending membership order waiting for admin approval.");
      return;
    }

    const price = Number(plan.price || 0);

    if (price <= 0) {
      setMessage("Invalid membership plan price.");
      return;
    }

    if (walletBalance < price) {
      setMessage("Insufficient wallet balance. Please cash in first.");
      return;
    }

    setProcessing(true);

    const newBalance = walletBalance - price;

    const { error: walletError } = await supabase
      .from("wallets")
      .update({ balance: newBalance })
      .eq("id", wallet.id);

    if (walletError) {
      setMessage(walletError.message);
      setProcessing(false);
      return;
    }

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
      await supabase.from("wallets").update({ balance: walletBalance }).eq("id", wallet.id);
      setMessage(orderError.message);
      setProcessing(false);
      return;
    }

    const { error: transactionError } = await supabase.from("wallet_transactions").insert({
      profile_id: profile.id,
      type: "MEMBERSHIP_PAYMENT",
      amount: price,
      status: "COMPLETED",
      description: `Membership payment for ${plan.name || "plan"}`,
      reference_id: orderData?.id || null,
    });

    if (transactionError) {
      setMessage(transactionError.message);
      setProcessing(false);
      await loadData();
      return;
    }

    setMessage("Membership payment submitted. Waiting for admin approval.");
    setProcessing(false);
    await loadData();
  }

  return (
    <main className="min-h-screen bg-[#071f16] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm uppercase tracking-[0.35em] text-[#d9b45f]">
          Agarwood Membership
        </p>

        <h1 className="mt-3 text-4xl font-bold">Membership Payment</h1>

        <p className="mt-3 max-w-3xl text-white/60">
          Activate your investor membership using your wallet balance. After payment,
          admin approval is required before your membership becomes ACTIVE.
        </p>

        {message && (
          <div className="mt-6 rounded-2xl border border-[#d9b45f]/30 bg-[#d9b45f]/10 p-4 text-sm font-semibold text-[#f3d891]">
            {message}
          </div>
        )}

        {loading ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-white/60">
            Loading membership data...
          </div>
        ) : (
          <>
            <section className="mt-8 grid gap-4 md:grid-cols-3">
              <Card label="Wallet Balance" value={`₱${walletBalance.toLocaleString()}`} />
              <Card label="Membership Status" value={profile?.membership_status || "INACTIVE"} />
              <Card label="KYC Status" value={profile?.kyc_status || "NOT SUBMITTED"} />
            </section>

            {membership && (
              <section className="mt-8 rounded-[28px] border border-emerald-400/20 bg-emerald-500/10 p-6">
                <p className="text-sm uppercase tracking-[0.25em] text-emerald-200">
                  Current Membership
                </p>
                <h2 className="mt-2 text-2xl font-black">{membership.status || "UNKNOWN"}</h2>
                <p className="mt-2 text-sm text-white/60">
                  Start: {formatDate(membership.start_date)} • End: {formatDate(membership.end_date)}
                </p>
              </section>
            )}

            {pendingOrder && (
              <section className="mt-8 rounded-[28px] border border-[#d9b45f]/30 bg-[#d9b45f]/10 p-6">
                <p className="text-sm uppercase tracking-[0.25em] text-[#d9b45f]">
                  Pending Admin Approval
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  ₱{Number(pendingOrder.amount || 0).toLocaleString()}
                </h2>
                <p className="mt-2 text-sm text-white/60">
                  Your payment is already recorded. Please wait for admin approval.
                </p>
              </section>
            )}

            <section className="mt-8 grid gap-5 lg:grid-cols-3">
              {plans.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-white/60">
                  No membership plans found.
                </div>
              ) : (
                plans.map((plan) => {
                  const price = Number(plan.price || 0);
                  const disabled =
                    processing ||
                    !!pendingOrder ||
                    (profile?.membership_status || "").toUpperCase() === "ACTIVE";

                  return (
                    <div
                      key={plan.id}
                      className="rounded-[32px] border border-white/10 bg-white/[0.06] p-6 shadow-2xl"
                    >
                      <p className="text-sm uppercase tracking-[0.25em] text-[#d9b45f]">
                        Membership Plan
                      </p>

                      <h2 className="mt-3 text-2xl font-black">
                        {plan.name || "Unnamed Plan"}
                      </h2>

                      <p className="mt-4 text-4xl font-black text-[#d9b45f]">
                        ₱{price.toLocaleString()}
                      </p>

                      <p className="mt-2 text-sm text-white/50">
                        Duration: {plan.duration_days || 0} days
                      </p>

                      <p className="mt-5 min-h-[80px] text-sm leading-6 text-white/60">
                        {plan.description || "No description added."}
                      </p>

                      <button
                        disabled={disabled}
                        onClick={() => payMembership(plan)}
                        className={`mt-6 w-full rounded-2xl px-6 py-4 font-black transition ${
                          disabled
                            ? "cursor-not-allowed bg-white/10 text-white/30"
                            : "bg-[#d9b45f] text-[#071f16] hover:scale-[1.01]"
                        }`}
                      >
                        {(profile?.membership_status || "").toUpperCase() === "ACTIVE"
                          ? "Already Active"
                          : pendingOrder
                          ? "Waiting Approval"
                          : processing
                          ? "Processing..."
                          : "Pay From Wallet"}
                      </button>
                    </div>
                  );
                })
              )}
            </section>

            <section className="mt-8 rounded-[32px] border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-2xl font-black">Membership Orders</h2>

              <div className="mt-5 grid gap-3">
                {orders.length === 0 ? (
                  <div className="rounded-2xl bg-black/20 p-5 text-white/50">
                    No membership orders yet.
                  </div>
                ) : (
                  orders.map((order) => (
                    <div
                      key={order.id}
                      className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-5 md:grid-cols-4"
                    >
                      <div>
                        <p className="text-xs text-white/40">Amount</p>
                        <p className="font-black text-[#d9b45f]">
                          ₱{Number(order.amount || 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-white/40">Status</p>
                        <p className="font-bold">{order.status || "PENDING"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/40">Payment</p>
                        <p className="font-bold">{order.payment_status || "UNKNOWN"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/40">Date</p>
                        <p className="font-bold">{formatDate(order.created_at)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5">
      <p className="text-sm text-white/50">{label}</p>
      <h3 className="mt-2 text-2xl font-black text-[#d9b45f]">{value}</h3>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}