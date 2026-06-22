"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type CustomerProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  account_status: string | null;
  kyc_status: string | null;
  membership_status: string | null;
  created_at: string | null;
};

type RoleMap = Record<string, "ADMIN" | "GARDENER" | "CUSTOMER">;

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [roles, setRoles] = useState<RoleMap>({});
  const [loading, setLoading] = useState(true);
  const [processingEmail, setProcessingEmail] = useState("");
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
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
    setSuccessText("");

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, account_status, kyc_status, membership_status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorText(error.message);
      setCustomers([]);
      setLoading(false);
      return;
    }

    const rows = (data || []) as CustomerProfile[];
    setCustomers(rows);
    await loadRoles(rows);
    setLoading(false);
  }

  async function loadRoles(rows: CustomerProfile[]) {
    const emails = rows
      .map((item) => item.email?.trim().toLowerCase())
      .filter(Boolean) as string[];

    if (emails.length === 0) {
      setRoles({});
      return;
    }

    const { data: adminRows } = await supabase
      .from("admins")
      .select("email, status")
      .in("email", emails);

    const { data: caretakerRows } = await supabase
      .from("caretakers")
      .select("email, status")
      .in("email", emails);

    const nextRoles: RoleMap = {};

    rows.forEach((profile) => {
      const email = profile.email?.trim().toLowerCase();
      if (!email) return;

      const isAdmin = (adminRows || []).some(
        (item: any) =>
          String(item.email || "").trim().toLowerCase() === email &&
          String(item.status || "").toUpperCase() === "ACTIVE"
      );

      const isGardener = (caretakerRows || []).some(
        (item: any) =>
          String(item.email || "").trim().toLowerCase() === email &&
          String(item.status || "").toUpperCase() === "ACTIVE"
      );

      nextRoles[email] = isAdmin ? "ADMIN" : isGardener ? "GARDENER" : "CUSTOMER";
    });

    setRoles(nextRoles);
  }

  const filteredCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return customers.filter((customer) => {
      const name = customer.full_name?.toLowerCase() || "";
      const email = customer.email?.toLowerCase() || "";
      const phone = customer.phone?.toLowerCase() || "";

      const matchesSearch =
        !keyword || name.includes(keyword) || email.includes(keyword) || phone.includes(keyword);

      const matchesStatus =
        statusFilter === "ALL" ||
        (customer.account_status || "").toUpperCase() === statusFilter;

      const matchesKyc =
        kycFilter === "ALL" || (customer.kyc_status || "").toUpperCase() === kycFilter;

      const matchesMembership =
        membershipFilter === "ALL" ||
        (customer.membership_status || "").toUpperCase() === membershipFilter;

      return matchesSearch && matchesStatus && matchesKyc && matchesMembership;
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

  function cleanEmail(customer: CustomerProfile) {
    return customer.email?.trim().toLowerCase() || "";
  }

  function cleanName(customer: CustomerProfile) {
    return customer.full_name?.trim() || customer.email?.trim() || "User";
  }

  async function makeAdmin(customer: CustomerProfile) {
    const email = cleanEmail(customer);
    if (!email) return setErrorText("Customer email is required.");

    setProcessingEmail(email);
    setErrorText("");
    setSuccessText("");

    const { data: existingAdmin } = await supabase
      .from("admins")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingAdmin?.id) {
      const { error } = await supabase
        .from("admins")
        .update({
          full_name: cleanName(customer),
          admin_profile_id: customer.id,
          status: "ACTIVE",
        })
        .eq("id", existingAdmin.id);

      if (error) {
        setErrorText(error.message);
        setProcessingEmail("");
        return;
      }
    } else {
      const { error } = await supabase.from("admins").insert({
        full_name: cleanName(customer),
        email,
        admin_profile_id: customer.id,
        status: "ACTIVE",
      });

      if (error) {
        setErrorText(error.message);
        setProcessingEmail("");
        return;
      }
    }

    await supabase.from("caretakers").update({ status: "INACTIVE" }).eq("email", email);

    setSuccessText(`${email} is now ADMIN.`);
    setProcessingEmail("");
    await loadCustomers();
  }

  async function makeGardener(customer: CustomerProfile) {
    const email = cleanEmail(customer);
    if (!email) return setErrorText("Customer email is required.");

    setProcessingEmail(email);
    setErrorText("");
    setSuccessText("");

    const { data: existingCaretaker } = await supabase
      .from("caretakers")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingCaretaker?.id) {
      const { error } = await supabase
        .from("caretakers")
        .update({
          full_name: cleanName(customer),
          caretaker_profile_id: customer.id,
          status: "ACTIVE",
          assigned_area: "Main Plantation",
        })
        .eq("id", existingCaretaker.id);

      if (error) {
        setErrorText(error.message);
        setProcessingEmail("");
        return;
      }
    } else {
      const { error } = await supabase.from("caretakers").insert({
        full_name: cleanName(customer),
        email,
        caretaker_profile_id: customer.id,
        status: "ACTIVE",
        assigned_area: "Main Plantation",
      });

      if (error) {
        setErrorText(error.message);
        setProcessingEmail("");
        return;
      }
    }

    await supabase.from("admins").update({ status: "INACTIVE" }).eq("email", email);

    setSuccessText(`${email} is now GARDENER.`);
    setProcessingEmail("");
    await loadCustomers();
  }

  async function makeCustomer(customer: CustomerProfile) {
    const email = cleanEmail(customer);
    if (!email) return setErrorText("Customer email is required.");

    setProcessingEmail(email);
    setErrorText("");
    setSuccessText("");

    await supabase.from("admins").update({ status: "INACTIVE" }).eq("email", email);
    await supabase.from("caretakers").update({ status: "INACTIVE" }).eq("email", email);

    setSuccessText(`${email} is now CUSTOMER.`);
    setProcessingEmail("");
    await loadCustomers();
  }

  function badgeClass(value: string | null) {
    const status = (value || "UNKNOWN").toUpperCase();

    if (["ACTIVE", "APPROVED", "VERIFIED", "ADMIN", "GARDENER", "CUSTOMER"].includes(status)) {
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
              View customers and assign backend access as Customer, Gardener, or Admin.
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

        {successText && (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {successText}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <Stat label="Total Profiles" value={totalCustomers} />
          <Stat label="Active Accounts" value={activeCustomers} />
          <Stat label="Approved KYC" value={approvedKyc} />
          <Stat label="Active Members" value={activeMembers} />
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
              User Records
            </h2>
            <p className="text-sm text-white/60">
              Showing {filteredCustomers.length} of {totalCustomers} profiles.
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-white/70">Loading customers...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-8 text-white/70">No customer records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px] text-left text-sm">
                <thead className="bg-[#071f16]/80 text-white/70">
                  <tr>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Contact</th>
                    <th className="px-5 py-4">Backend Role</th>
                    <th className="px-5 py-4">Account</th>
                    <th className="px-5 py-4">KYC</th>
                    <th className="px-5 py-4">Membership</th>
                    <th className="px-5 py-4">Created</th>
                    <th className="px-5 py-4">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCustomers.map((customer) => {
                    const email = cleanEmail(customer);
                    const currentRole = roles[email] || "CUSTOMER";
                    const isProcessing = processingEmail === email;

                    return (
                      <tr key={customer.id} className="border-t border-white/10 hover:bg-white/5">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-white">
                            {customer.full_name || "Unnamed Customer"}
                          </div>
                          <div className="mt-1 text-xs text-white/40">{customer.id}</div>
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
                              currentRole
                            )}`}
                          >
                            {currentRole}
                          </span>
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
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/admin/customers/${customer.id}`}
                              className="rounded-xl border border-[#d9b45f]/40 px-3 py-2 text-xs font-semibold text-[#f7d774] hover:bg-[#d9b45f]/15"
                            >
                              View
                            </Link>

                            <button
                              onClick={() => makeAdmin(customer)}
                              disabled={isProcessing || !email}
                              className="rounded-xl border border-purple-300/30 bg-purple-500/10 px-3 py-2 text-xs font-semibold text-purple-100 disabled:opacity-40"
                            >
                              Admin
                            </button>

                            <button
                              onClick={() => makeGardener(customer)}
                              disabled={isProcessing || !email}
                              className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 disabled:opacity-40"
                            >
                              Gardener
                            </button>

                            <button
                              onClick={() => makeCustomer(customer)}
                              disabled={isProcessing || !email}
                              className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                            >
                              Customer
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
      <p className="text-sm text-white/70">{label}</p>
      <p className="mt-3 text-3xl font-bold text-[#d9b45f]">{value}</p>
    </div>
  );
}