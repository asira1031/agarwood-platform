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

export default function AdminMembershipPage() {
  const [orders, setOrders] = useState<MembershipOrder[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [errorText, setErrorText] = useState("");
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorText("");

    const { data: orderRows, error: orderError } = await supabase
      .from("membership_orders")
      .select(
        "id, profile_id, plan_name, annual_fee, amount, status, payment_status, submitted_at, approved_at, created_at, plan_id"
      )
      .order("created_at", { ascending: false });

    if (orderError) {
      setErrorText(orderError.message);
      setOrders([]);
      setProfiles([]);
      setLoading(false);
      return;
    }

    const profileIds = Array.from(
      new Set((orderRows || []).map((item) => item.profile_id).filter(Boolean))
    ) as string[];

    let profileRows: ProfileRow[] = [];

    if (profileIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, membership_status")
        .in("id", profileIds);

      if (profileError) {
        setErrorText(profileError.message);
      } else {
        profileRows = (profileData || []) as ProfileRow[];
      }
    }

    setOrders((orderRows || []) as MembershipOrder[]);
    setProfiles(profileRows);
    setLoading(false);
  }

  const filteredOrders = useMemo(() => {
    if (filter === "ALL") return orders;

    return orders.filter(
      (order) => (order.status || "").toUpperCase() === filter
    );
  }, [orders, filter]);

  const pendingCount = orders.filter(
    (order) => (order.status || "").toUpperCase() === "PENDING"
  ).length;

  const approvedCount = orders.filter(
    (order) => (order.status || "").toUpperCase() === "APPROVED"
  ).length;

  const rejectedCount = orders.filter(
    (order) => (order.status || "").toUpperCase() === "REJECTED"
  ).length;

  const totalAmount = orders.reduce(
    (sum, order) => sum + Number(order.amount || order.annual_fee || 0),
    0
  );

  function getProfile(profileId: string | null) {
    return profiles.find((profile) => profile.id === profileId) || null;
  }

  function badgeClass(value: string | null) {
    const status = (value || "UNKNOWN").toUpperCase();

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

  function formatMoney(value: number | null) {
    return Number(value || 0).toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
    });
  }

  function formatDate(dateValue: string | null) {
    if (!dateValue) return "—";

    return new Date(dateValue).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  async function approveOrder(order: MembershipOrder) {
    if (!order.id || !order.profile_id) return;

    const confirmed = window.confirm(
      "Approve this membership order and activate customer membership?"
    );

    if (!confirmed) return;

    setActionLoading(order.id);
    setErrorText("");

    const { error: orderError } = await supabase
      .from("membership_orders")
      .update({
        status: "APPROVED",
        payment_status: "PAID",
        approved_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (orderError) {
      setErrorText(orderError.message);
      setActionLoading("");
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        membership_status: "ACTIVE",
      })
      .eq("id", order.profile_id);

    if (profileError) {
      setErrorText(profileError.message);
      setActionLoading("");
      return;
    }

    await loadData();
    setActionLoading("");
  }

  async function rejectOrder(order: MembershipOrder) {
    if (!order.id) return;

    const confirmed = window.confirm("Reject this membership order?");
    if (!confirmed) return;

    setActionLoading(order.id);
    setErrorText("");

    const { error: orderError } = await supabase
      .from("membership_orders")
      .update({
        status: "REJECTED",
        payment_status: "REJECTED",
      })
      .eq("id", order.id);

    if (orderError) {
      setErrorText(orderError.message);
      setActionLoading("");
      return;
    }

    await loadData();
    setActionLoading("");
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
              Membership Approval
            </h1>
            <p className="mt-2 text-white/70">
              Review membership orders and activate customer membership after approval.
            </p>
          </div>

          <button
            onClick={loadData}
            className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-5 py-3 text-sm font-semibold text-[#f7d774] hover:bg-[#d9b45f]/25"
          >
            Refresh Orders
          </button>
        </div>

        {errorText && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
            {errorText}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard label="Pending Orders" value={String(pendingCount)} />
          <StatCard label="Approved Orders" value={String(approvedCount)} />
          <StatCard label="Rejected Orders" value={String(rejectedCount)} />
          <StatCard label="Total Order Value" value={formatMoney(totalAmount)} />
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
              <option value="ALL">All Orders</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
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
              <table className="w-full min-w-[1100px] text-left text-sm">
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
                    const isPending =
                      (order.status || "").toUpperCase() === "PENDING";

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
                            Membership:{" "}
                            {profile?.membership_status || "INACTIVE"}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div>{order.plan_name || "Annual Membership"}</div>
                          <div className="mt-1 text-xs text-white/40">
                            Plan ID: {order.plan_id || "—"}
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
                            {(order.status || "UNKNOWN").toUpperCase()}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                              order.payment_status
                            )}`}
                          >
                            {(order.payment_status || "UNKNOWN").toUpperCase()}
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
                                Approve
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
                              Completed
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
      <p className="mt-3 text-3xl font-bold text-[#d9b45f]">{value}</p>
    </div>
  );
}