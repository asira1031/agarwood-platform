"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [kycFilter, setKycFilter] = useState("ALL");
  const [membershipFilter, setMembershipFilter] = useState("ALL");

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoading(true);
    setErrorText("");

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email, phone, role, account_status, kyc_status, membership_status, created_at"
      )
      .or("role.eq.CUSTOMER,role.is.null")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorText(error.message);
      setCustomers([]);
      setLoading(false);
      return;
    }

    setCustomers((data || []) as CustomerProfile[]);
    setLoading(false);
  }

  const filteredCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return customers.filter((customer) => {
      const name = customer.full_name?.toLowerCase() || "";
      const email = customer.email?.toLowerCase() || "";
      const phone = customer.phone?.toLowerCase() || "";

      const matchesSearch =
        !keyword ||
        name.includes(keyword) ||
        email.includes(keyword) ||
        phone.includes(keyword);

      const matchesStatus =
        statusFilter === "ALL" ||
        (customer.account_status || "").toUpperCase() === statusFilter;

      const matchesKyc =
        kycFilter === "ALL" ||
        (customer.kyc_status || "").toUpperCase() === kycFilter;

      const matchesMembership =
        membershipFilter === "ALL" ||
        (customer.membership_status || "").toUpperCase() === membershipFilter;

      return (
        matchesSearch && matchesStatus && matchesKyc && matchesMembership
      );
    });
  }, [customers, search, statusFilter, kycFilter, membershipFilter]);

  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(
    (item) => (item.account_status || "").toUpperCase() === "ACTIVE"
  ).length;
  const approvedKyc = customers.filter(
    (item) => (item.kyc_status || "").toUpperCase() === "APPROVED"
  ).length;
  const activeMembers = customers.filter(
    (item) => (item.membership_status || "").toUpperCase() === "ACTIVE"
  ).length;

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

  function formatDate(dateValue: string | null) {
    if (!dateValue) return "—";

    return new Date(dateValue).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <main className="min-h-screen text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8 rounded-3xl bg-[#071f16]/75 p-8 backdrop-blur-md border border-white/10 shadow-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
              Admin Center
            </p>
            <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
              Customer Management
            </h1>
            <p className="mt-2 text-white/70">
              View customer accounts, KYC status, membership status, and profile records.
            </p>
          </div>

          <button
            onClick={loadCustomers}
            className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-5 py-3 text-sm font-semibold text-[#f7d774] hover:bg-[#d9b45f]/25"
          >
            Refresh Customers
          </button>
        </div>

        {errorText && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
            {errorText}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
            <p className="text-sm text-white/70">Total Customers</p>
            <p className="mt-3 text-3xl font-bold text-[#d9b45f]">
              {totalCustomers}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
            <p className="text-sm text-white/70">Active Accounts</p>
            <p className="mt-3 text-3xl font-bold text-[#d9b45f]">
              {activeCustomers}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
            <p className="text-sm text-white/70">Approved KYC</p>
            <p className="mt-3 text-3xl font-bold text-[#d9b45f]">
              {approvedKyc}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
            <p className="text-sm text-white/70">Active Members</p>
            <p className="mt-3 text-3xl font-bold text-[#d9b45f]">
              {activeMembers}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/10 p-5">
          <div className="grid gap-3 lg:grid-cols-4">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, or phone"
              className="rounded-xl border border-white/10 bg-[#071f16]/70 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#071f16]/70 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="ALL">All Account Status</option>
              <option value="ACTIVE">Active</option>
              <option value="VERIFIED">Verified</option>
              <option value="PENDING">Pending</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            <select
              value={kycFilter}
              onChange={(event) => setKycFilter(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#071f16]/70 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="ALL">All KYC Status</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <select
              value={membershipFilter}
              onChange={(event) => setMembershipFilter(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#071f16]/70 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="ALL">All Membership</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/10">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-xl font-bold text-[#d9b45f]">
              Customer Records
            </h2>
            <p className="text-sm text-white/60">
              Showing {filteredCustomers.length} of {totalCustomers} customers.
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-white/70">Loading customers...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-8 text-white/70">No customer records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="bg-[#071f16]/80 text-white/70">
                  <tr>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Contact</th>
                    <th className="px-5 py-4">Account</th>
                    <th className="px-5 py-4">KYC</th>
                    <th className="px-5 py-4">Membership</th>
                    <th className="px-5 py-4">Created</th>
                    <th className="px-5 py-4">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-t border-white/10 hover:bg-white/5"
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-white">
                          {customer.full_name || "Unnamed Customer"}
                        </div>
                        <div className="mt-1 text-xs text-white/40">
                          {customer.id}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div>{customer.email || "—"}</div>
                        <div className="mt-1 text-xs text-white/50">
                          {customer.phone || "No phone"}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                            customer.account_status
                          )}`}
                        >
                          {(customer.account_status || "UNKNOWN").toUpperCase()}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                            customer.kyc_status
                          )}`}
                        >
                          {(customer.kyc_status || "UNKNOWN").toUpperCase()}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                            customer.membership_status
                          )}`}
                        >
                          {(customer.membership_status || "UNKNOWN").toUpperCase()}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-white/70">
                        {formatDate(customer.created_at)}
                      </td>

                      <td className="px-5 py-4">
                        <Link
                          href={`/admin/customers/${customer.id}`}
                          className="rounded-xl border border-[#d9b45f]/40 px-4 py-2 text-xs font-semibold text-[#f7d774] hover:bg-[#d9b45f]/15"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}