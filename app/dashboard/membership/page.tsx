"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const plans = [
  {
    name: "Basic",
    price: "₱999",
    description: "Entry-level agarwood ownership access.",
    features: [
      "Membership Certificate",
      "Access to My Forests",
      "Ownership Dashboard",
      "Annual Membership",
    ],
  },
  {
    name: "Premium",
    price: "₱4,999",
    description: "Enhanced ownership experience.",
    features: [
      "Everything in Basic",
      "Priority Forest Access",
      "Premium Reports",
      "Investor Priority Support",
    ],
  },
  {
    name: "Legacy",
    price: "₱9,999",
    description: "Highest level membership.",
    features: [
      "Everything in Premium",
      "Legacy Recognition",
      "Priority Marketplace Access",
      "Exclusive Ownership Opportunities",
    ],
  },
];

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  membership_status: string | null;
  kyc_status: string | null;
  account_status: string | null;
};

export default function MembershipPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [loading, setLoading] = useState(true);
  const [submittingPlan, setSubmittingPlan] = useState("");

  async function loadProfile() {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("USER ERROR:", userError);
    }

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const userEmail = user.email?.trim().toLowerCase() || "";

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, full_name, email, membership_status, kyc_status, account_status")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, full_name, email, membership_status, kyc_status, account_status")
      .eq("email", userEmail)
      .maybeSingle();

    const foundProfile = profileById || profileByEmail;

    if (!foundProfile) {
      alert("Profile not found. Please contact admin.");
      setLoading(false);
      return;
    }

    setProfile(foundProfile);
    setSelectedPlan(foundProfile.membership_status || "");
    setLoading(false);
  }

  async function applyMembership(plan: string) {
    if (!profile?.id) {
      alert("Profile not found.");
      return;
    }

    if (profile.kyc_status?.toUpperCase() !== "APPROVED") {
      alert("Please complete KYC approval before applying for membership.");
      return;
    }

    setSubmittingPlan(plan);

    const { error } = await supabase
      .from("profiles")
      .update({
        membership_status: "PENDING",
        account_status: "PENDING",
      })
      .eq("id", profile.id);

    if (error) {
      console.error("MEMBERSHIP APPLY ERROR:", error);
      alert("Failed to submit membership application.");
      setSubmittingPlan("");
      return;
    }

    alert(`${plan} membership application submitted for admin approval.`);
    await loadProfile();
    setSubmittingPlan("");
  }

  useEffect(() => {
    loadProfile();
  }, []);

  const membershipStatus = profile?.membership_status?.toUpperCase() || "NONE";
  const kycStatus = profile?.kyc_status?.toUpperCase() || "NONE";

  return (
    <main className="min-h-screen bg-[#071f16] text-white px-6 py-10">
      <div className="mx-auto max-w-7xl space-y-10">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-[#d9b45f]">
            Agarwood Membership Program
          </p>

          <h1 className="mt-3 text-5xl font-bold">Choose Your Membership</h1>

          <p className="mt-4 max-w-2xl text-white/60">
            Membership unlocks forest ownership, investor privileges, and access
            to the Agarwood ownership ecosystem.
          </p>
        </div>

        <section className="rounded-[28px] border border-[#d9b45f]/20 bg-white/[0.05] p-6 shadow-2xl">
          <div className="grid gap-5 md:grid-cols-4">
            <StatusCard
              title="Account"
              value={profile?.account_status || "Loading"}
            />
            <StatusCard title="KYC Status" value={kycStatus} />
            <StatusCard title="Membership" value={membershipStatus} />
            <StatusCard
              title="Approval"
              value={
                membershipStatus === "ACTIVE"
                  ? "Approved"
                  : membershipStatus === "PENDING"
                  ? "Waiting Admin"
                  : membershipStatus === "REJECTED"
                  ? "Rejected"
                  : "Not Applied"
              }
            />
          </div>

          {membershipStatus === "PENDING" && (
            <div className="mt-6 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-yellow-200">
              Your membership application is pending admin approval.
            </div>
          )}

          {membershipStatus === "ACTIVE" && (
            <div className="mt-6 rounded-2xl border border-green-400/20 bg-green-400/10 p-4 text-green-200">
              Your membership is active. You can access investor features.
            </div>
          )}

          {membershipStatus === "REJECTED" && (
            <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
              Your membership application was rejected. Please contact support or
              submit again.
            </div>
          )}

          {kycStatus !== "APPROVED" && (
            <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
              KYC approval is required before membership application.
            </div>
          )}
        </section>

        {loading ? (
          <div className="rounded-[28px] border border-[#d9b45f]/20 bg-white/[0.05] p-8 text-white/70">
            Loading membership details...
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            {plans.map((plan) => {
              const disabled =
                submittingPlan === plan.name ||
                membershipStatus === "PENDING" ||
                membershipStatus === "ACTIVE" ||
                kycStatus !== "APPROVED";

              return (
                <div
                  key={plan.name}
                  className="rounded-[32px] border border-[#d9b45f]/20 bg-white/[0.05] p-8 shadow-2xl"
                >
                  <h2 className="text-3xl font-bold text-[#d9b45f]">
                    {plan.name}
                  </h2>

                  <p className="mt-3 text-4xl font-bold">
                    {plan.price}
                    <span className="text-lg text-white/60"> / year</span>
                  </p>

                  <p className="mt-4 text-white/60">{plan.description}</p>

                  <div className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <div
                        key={feature}
                        className="rounded-xl bg-black/20 p-3 text-sm"
                      >
                        ✓ {feature}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => applyMembership(plan.name)}
                    disabled={disabled}
                    className="mt-8 w-full rounded-2xl bg-[#d9b45f] px-6 py-4 font-bold text-[#071f16] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submittingPlan === plan.name
                      ? "Submitting..."
                      : membershipStatus === "ACTIVE"
                      ? "Membership Active"
                      : membershipStatus === "PENDING"
                      ? "Waiting Admin Approval"
                      : kycStatus !== "APPROVED"
                      ? "KYC Required"
                      : "Apply Membership"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function StatusCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <p className="text-sm text-white/60">{title}</p>
      <div className="mt-3">
        <Badge value={value} />
      </div>
    </div>
  );
}

function Badge({ value }: { value: string }) {
  const status = value.toUpperCase();

  const color =
    status === "ACTIVE" || status === "APPROVED"
      ? "bg-green-500/20 text-green-300 border-green-500/30"
      : status === "PENDING" || status === "WAITING ADMIN"
      ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
      : status === "REJECTED" || status === "KYC REQUIRED"
      ? "bg-red-500/20 text-red-300 border-red-500/30"
      : "bg-white/10 text-white/70 border-white/10";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${color}`}
    >
      {status}
    </span>
  );
}