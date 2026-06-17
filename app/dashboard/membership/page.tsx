"use client";

import { useState } from "react";

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

export default function MembershipPage() {
  const [selectedPlan, setSelectedPlan] = useState("");

  async function applyMembership(plan: string) {
    setSelectedPlan(plan);

    alert(`${plan} membership application submitted.`);
  }

  return (
    <main className="min-h-screen bg-[#071f16] text-white px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm uppercase tracking-[0.35em] text-[#d9b45f]">
          Agarwood Membership Program
        </p>

        <h1 className="mt-3 text-5xl font-bold">
          Choose Your Membership
        </h1>

        <p className="mt-4 max-w-2xl text-white/60">
          Membership unlocks forest ownership, investor privileges,
          and access to the Agarwood ownership ecosystem.
        </p>

        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
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

              <p className="mt-4 text-white/60">
                {plan.description}
              </p>

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
                disabled={selectedPlan === plan.name}
                className="mt-8 w-full rounded-2xl bg-[#d9b45f] px-6 py-4 font-bold text-[#071f16] transition hover:scale-[1.02]"
              >
                {selectedPlan === plan.name
                  ? "Application Submitted"
                  : "Apply Membership"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}