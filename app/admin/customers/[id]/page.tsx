"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CustomerProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  account_status: string | null;
  kyc_status: string | null;
  membership_status: string | null;
  created_at: string | null;
};

type WalletRow = {
  id: string;
  profile_id: string | null;
  balance: number | null;
  created_at: string | null;
};

export default function AdminCustomerDetailPage() {
  const params = useParams();
  const customerId = String(params.id || "");

  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    if (customerId) loadCustomer();
  }, [customerId]);

  async function loadCustomer() {
    setLoading(true);
    setErrorText("");

    const { data: customerData, error: customerError } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email, phone, role, account_status, kyc_status, membership_status, created_at"
      )
      .eq("id", customerId)
      .maybeSingle();

    if (customerError) {
      setErrorText(customerError.message);
      setLoading(false);
      return;
    }

    const { data: walletRows, error: walletError } = await supabase
      .from("wallets")
      .select("id, profile_id, balance, created_at")
      .eq("profile_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (walletError) {
      setErrorText(walletError.message);
    }

    setCustomer(customerData as CustomerProfile | null);
    setWallet((walletRows?.[0] || null) as WalletRow | null);
    setLoading(false);
  }

  function badgeClass(value: string | null) {
    const status = (value || "UNKNOWN").toUpperCase();

    if (
      status === "ACTIVE" ||
      status === "APPROVED" ||
      status === "VERIFIED"
    ) {
      return "bg-emerald-500/20 text-emerald-200 border-emerald-400/30";
    }

    if (status === "PENDING" || status === "REVIEW") {
      return "bg-yellow-500/20 text-yellow-200 border-yellow-400/30";
    }

    if (status === "REJECTED" || status === "SUSPENDED" || status === "INACTIVE") {
      return "bg-red-500/20 text-red-200 border-red-400/30";
    }

    return "bg-white/10 text-white/60 border-white/10";
  }

  function formatMoney(value: number | null) {
    const amount = Number(value || 0);

    return amount.toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
    });
  }

  function formatDate(dateValue: string | null) {
    if (!dateValue) return "—";

    return new Date(dateValue).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen text-white p-8">
        <div className="max-w-7xl mx-auto rounded-3xl bg-[#071f16]/75 p-8 backdrop-blur-md border border-white/10 shadow-2xl">
          Loading customer profile...
        </div>
      </main>
    );
  }

  if (!customer) {
    return (
      <main className="min-h-screen text-white p-8">
        <div className="max-w-7xl mx-auto rounded-3xl bg-[#071f16]/75 p-8 backdrop-blur-md border border-white/10 shadow-2xl">
          <h1 className="text-3xl font-bold text-[#d9b45f]">
            Customer Not Found
          </h1>
          <p className="mt-2 text-white/70">
            No profile record found for this customer ID.
          </p>

          <Link
            href="/admin/customers"
            className="mt-6 inline-block rounded-xl border border-[#d9b45f]/40 px-4 py-2 text-sm font-semibold text-[#f7d774] hover:bg-[#d9b45f]/15"
          >
            Back to Customers
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8 rounded-3xl bg-[#071f16]/75 p-8 backdrop-blur-md border border-white/10 shadow-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href="/admin/customers"
              className="text-sm font-semibold text-[#f7d774] hover:underline"
            >
              ← Back to Customers
            </Link>

            <p className="mt-6 text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
              Customer Profile
            </p>

            <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
              {customer.full_name || "Unnamed Customer"}
            </h1>

            <p className="mt-2 text-white/70">{customer.email || "No email"}</p>
          </div>

          <button
            onClick={loadCustomer}
            className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-5 py-3 text-sm font-semibold text-[#f7d774] hover:bg-[#d9b45f]/25"
          >
            Refresh Profile
          </button>
        </div>

        {errorText && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
            {errorText}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
            <p className="text-sm text-white/70">Wallet Balance</p>
            <p className="mt-3 text-3xl font-bold text-[#d9b45f]">
              {formatMoney(wallet?.balance || 0)}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
            <p className="text-sm text-white/70">Account Status</p>
            <span
              className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                customer.account_status
              )}`}
            >
              {(customer.account_status || "UNKNOWN").toUpperCase()}
            </span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
            <p className="text-sm text-white/70">KYC Status</p>
            <span
              className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                customer.kyc_status
              )}`}
            >
              {(customer.kyc_status || "UNKNOWN").toUpperCase()}
            </span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
            <p className="text-sm text-white/70">Membership</p>
            <span
              className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                customer.membership_status
              )}`}
            >
              {(customer.membership_status || "UNKNOWN").toUpperCase()}
            </span>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-6">
            <h2 className="text-2xl font-bold text-[#d9b45f]">
              Profile Information
            </h2>

            <div className="mt-6 space-y-4 text-sm">
              <InfoRow label="Profile ID" value={customer.id} />
              <InfoRow label="Full Name" value={customer.full_name || "—"} />
              <InfoRow label="Email" value={customer.email || "—"} />
              <InfoRow label="Phone" value={customer.phone || "—"} />
              <InfoRow label="Role" value={customer.role || "CUSTOMER"} />
              <InfoRow label="Created" value={formatDate(customer.created_at)} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 p-6">
            <h2 className="text-2xl font-bold text-[#d9b45f]">
              Wallet Source of Truth
            </h2>

            <div className="mt-6 space-y-4 text-sm">
              <InfoRow label="Wallet ID" value={wallet?.id || "No wallet found"} />
              <InfoRow
                label="Wallet Profile ID"
                value={wallet?.profile_id || "—"}
              />
              <InfoRow
                label="Current Balance"
                value={formatMoney(wallet?.balance || 0)}
              />
              <InfoRow
                label="Wallet Created"
                value={formatDate(wallet?.created_at || null)}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/10 p-6">
          <h2 className="text-2xl font-bold text-[#d9b45f]">
            Admin Actions
          </h2>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <Link
              href="/admin/kyc"
              className="rounded-xl border border-white/10 bg-[#071f16]/70 px-4 py-3 text-center text-sm font-semibold hover:bg-white/10"
            >
              Review KYC
            </Link>

            <Link
              href="/admin/membership"
              className="rounded-xl border border-white/10 bg-[#071f16]/70 px-4 py-3 text-center text-sm font-semibold hover:bg-white/10"
            >
              Membership
            </Link>

            <Link
              href="/admin/wallet"
              className="rounded-xl border border-white/10 bg-[#071f16]/70 px-4 py-3 text-center text-sm font-semibold hover:bg-white/10"
            >
              Wallet
            </Link>

            <Link
              href="/admin/referrals"
              className="rounded-xl border border-white/10 bg-[#071f16]/70 px-4 py-3 text-center text-sm font-semibold hover:bg-white/10"
            >
              Referrals
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#071f16]/60 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-white/40">
        {label}
      </div>
      <div className="mt-2 break-all font-semibold text-white">{value}</div>
    </div>
  );
}