// app/admin/membership/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type MembershipOrder = {
  id: string;
  profile_id: string | null;
  plan_name: string | null;
  annual_fee: number | null;
  amount: number | null;
  status: string | null;
  payment_status: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string | null;
  plan_id: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  membership_status: string | null;
};

function normalize(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

function formatMoney(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminMembershipPage() {
  const [adminProfileId, setAdminProfileId] = useState("");
  const [orders, setOrders] = useState<MembershipOrder[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    loadData();
  }, []);

  async function resolveAdminProfileId() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/login";
      return "";
    }

    const email = user.email?.trim().toLowerCase() || "";

    const { data: profileById, error: profileByIdError } = await supabase
      .from("profiles")
      .select("id,email")
      .eq("id", user.id)
      .maybeSingle();

    if (profileByIdError) throw profileByIdError;

    const { data: profileByEmail, error: profileByEmailError } = await supabase
      .from("profiles")
      .select("id,email")
      .eq("email", email)
      .maybeSingle();

    if (profileByEmailError) throw profileByEmailError;

    const resolvedProfileId = profileById?.id || profileByEmail?.id || user.id;

    const { data: adminByProfile, error: adminByProfileError } = await supabase
      .from("admins")
      .select("id, admin_profile_id, email, status")
      .eq("admin_profile_id", resolvedProfileId)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (adminByProfileError) throw adminByProfileError;

    if (adminByProfile?.admin_profile_id) {
      return adminByProfile.admin_profile_id as string;
    }

    const { data: adminByEmail, error: adminByEmailError } = await supabase
      .from("admins")
      .select("id, admin_profile_id, email, status")
      .ilike("email", email)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (adminByEmailError) throw adminByEmailError;

    if (adminByEmail?.admin_profile_id) {
      return adminByEmail.admin_profile_id as string;
    }

    throw new Error("Active admin profile not found.");
  }

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const resolvedAdminProfileId = await resolveAdminProfileId();
      setAdminProfileId(resolvedAdminProfileId);

      const { data: orderRows, error: orderError } = await supabase
        .from("membership_orders")
        .select(
          "id, profile_id, plan_name, annual_fee, amount, status, payment_status, submitted_at, approved_at, created_at, plan_id"
        )
        .order("created_at", { ascending: false });

      if (orderError) throw orderError;

      const nextOrders = (orderRows || []) as MembershipOrder[];

      const profileIds = Array.from(
        new Set(nextOrders.map((item) => item.profile_id).filter(Boolean))
      ) as string[];

      let profileRows: ProfileRow[] = [];

      if (profileIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, email, membership_status")
          .in("id", profileIds);

        if (profileError) throw profileError;
        profileRows = (profileData || []) as ProfileRow[];
      }

      setOrders(nextOrders);
      setProfiles(profileRows);
    } catch (error: any) {
      setMessage(error?.message || "Membership admin data failed to load.");
      setOrders([]);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = useMemo(() => {
    if (filter === "ALL") return orders;
    if (filter === "EXPIRED") return [];
    return orders.filter((order) => normalize(order.status) === filter);
  }, [orders, filter]);

  const pendingCount = orders.filter((item) => normalize(item.status) === "PENDING").length;
  const approvedCount = orders.filter((item) => normalize(item.status) === "APPROVED").length;
  const rejectedCount = orders.filter((item) => normalize(item.status) === "REJECTED").length;
  const revenue = orders
    .filter((item) => normalize(item.status) === "APPROVED")
    .reduce((sum, item) => sum + Number(item.amount || item.annual_fee || 0), 0);

  function getProfile(profileId: string | null) {
    return profiles.find((profile) => profile.id === profileId) || null;
  }

  function badgeClass(value: string | null | undefined) {
    const status = normalize(value);

    if (status === "APPROVED" || status === "ACTIVE" || status === "PAID") {
      return "bg-emerald-500/20 text-emerald-200 border-emerald-400/30";
    }

    if (status === "PENDING") {
      return "bg-yellow-500/20 text-yellow-200 border-yellow-400/30";
    }

    if (status === "REJECTED" || status === "FAILED") {
      return "bg-red-500/20 text-red-200 border-red-400/30";
    }

    return "bg-white/10 text-white/60 border-white/10";
  }

  async function approveOrder(order: MembershipOrder) {
    if (!order.id) return;

    if (!adminProfileId) {
      setMessage("Active admin profile not loaded.");
      return;
    }

    if (normalize(order.status) === "APPROVED") {
      setMessage("This membership order is already approved.");
      return;
    }

    const confirmed = window.confirm(
      "Approve this membership order? This will activate membership through the audited RPC."
    );

    if (!confirmed) return;

    setActionLoading(order.id);
    setMessage("");

    try {
      const { error } = await supabase.rpc("approve_membership_order", {
        p_order_id: order.id,
        p_admin_profile_id: adminProfileId,
      });

      if (error) throw error;

      setMessage("Membership approved. Profile, membership record, and treasury were synced by RPC.");
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || "Membership approval failed.");
    } finally {
      setActionLoading("");
    }
  }

  async function rejectOrder(order: MembershipOrder) {
    if (!order.id) return;

    const confirmed = window.confirm("Reject this membership order?");
    if (!confirmed) return;

    setActionLoading(order.id);
    setMessage("");

    try {
      const { error } = await supabase
        .from("membership_orders")
        .update({
          status: "REJECTED",
          payment_status: "REJECTED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("status", "PENDING");

      if (error) throw error;

      setMessage("Membership order rejected.");
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || "Membership rejection failed.");
    } finally {
      setActionLoading("");
    }
  }

  return (
    <main className="min-h-screen bg-[#03130d] p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8 rounded-3xl border border-white/10 bg-[#071f16]/80 p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
              Admin Forest Command
            </p>
            <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
              Membership Center
            </h1>
            <p className="mt-2 text-white/70">
              Review Arganwood Annual Membership orders. Approval uses the audited
              approve_membership_order RPC only.
            </p>
          </div>

          <button
            onClick={loadData}
            className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-5 py-3 text-sm font-semibold text-[#f7d774] hover:bg-[#d9b45f]/25"
          >
            Refresh
          </button>
        </div>

        {message && (
          <div className="rounded-2xl border border-[#d9b45f]/25 bg-[#d9b45f]/10 p-4 text-sm font-semibold text-[#ffe49a]">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-5">
          <StatCard label="Pending" value={String(pendingCount)} />
          <StatCard label="Approved" value={String(approvedCount)} />
          <StatCard label="Rejected" value={String(rejectedCount)} />
          <StatCard label="Expired" value="0" />
          <StatCard label="Revenue" value={formatMoney(revenue)} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/10 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#d9b45f]">
                Membership Orders
              </h2>
              <p className="text-sm text-white/60">
                Showing {filteredOrders.length} of {orders.length} orders.
              </p>
            </div>

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#071f16]/70 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="ALL">All</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/10">
          {loading ? (
            <div className="p-8 text-white/70">Loading membership orders...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-8 text-white/70">No membership orders found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-[#071f16]/80 text-white/70">
                  <tr>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Plan</th>
                    <th className="px-5 py-4">Amount</th>
                    <th className="px-5 py-4">Order Status</th>
                    <th className="px-5 py-4">Payment</th>
                    <th className="px-5 py-4">Submitted</th>
                    <th className="px-5 py-4">Approved</th>
                    <th className="px-5 py-4">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.map((order) => {
                    const profile = getProfile(order.profile_id);
                    const isPending = normalize(order.status) === "PENDING";

                    return (
                      <tr
                        key={order.id}
                        className="border-t border-white/10 hover:bg-white/5"
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-white">
                            {profile?.full_name || "Unknown Customer"}
                          </div>
                          <div className="mt-1 text-xs text-white/50">
                            {profile?.email || "No email"}
                          </div>
                          <div className="mt-1 text-xs text-emerald-200/70">
                            Membership: {profile?.membership_status || "INACTIVE"}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div>
                            {order.plan_name || "Arganwood Annual Membership"}
                          </div>
                          <div className="mt-1 text-xs text-white/40">
                            {order.plan_id || "No plan id"}
                          </div>
                        </td>

                        <td className="px-5 py-4 font-semibold text-[#f7d774]">
                          {formatMoney(order.amount || order.annual_fee)}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                              order.status
                            )}`}
                          >
                            {normalize(order.status || "UNKNOWN")}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                              order.payment_status
                            )}`}
                          >
                            {normalize(order.payment_status || "UNKNOWN")}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-white/70">
                          {formatDate(order.submitted_at || order.created_at)}
                        </td>

                        <td className="px-5 py-4 text-white/70">
                          {formatDate(order.approved_at)}
                        </td>

                        <td className="px-5 py-4">
                          {isPending ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => approveOrder(order)}
                                disabled={actionLoading === order.id}
                                className="rounded-xl bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
                              >
                                {actionLoading === order.id
                                  ? "Working..."
                                  : "Approve"}
                              </button>

                              <button
                                onClick={() => rejectOrder(order)}
                                disabled={actionLoading === order.id}
                                className="rounded-xl bg-red-500/20 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/30 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-white/50">
                              No action
                            </span>
                          )}
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
      <p className="text-sm text-white/70">{label}</p>
      <p className="mt-3 text-2xl font-bold text-[#d9b45f]">{value}</p>
    </div>
  );
}