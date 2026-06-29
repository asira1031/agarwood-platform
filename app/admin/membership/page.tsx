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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function badgeClass(value: string | null | undefined) {
  const status = normalize(value);

  if (status === "APPROVED" || status === "ACTIVE" || status === "PAID") return "badge approved";
  if (status === "PENDING") return "badge pending";
  if (status === "REJECTED" || status === "FAILED" || status === "INACTIVE") return "badge rejected";

  return "badge neutral";
}

export default function AdminMembershipPage() {
  const [adminProfileId, setAdminProfileId] = useState("");
  const [orders, setOrders] = useState<MembershipOrder[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("PENDING");
  const [selectedOrder, setSelectedOrder] = useState<MembershipOrder | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

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
    if (adminByProfile?.admin_profile_id) return adminByProfile.admin_profile_id as string;

    const { data: adminByEmail, error: adminByEmailError } = await supabase
      .from("admins")
      .select("id, admin_profile_id, email, status")
      .ilike("email", email)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (adminByEmailError) throw adminByEmailError;
    if (adminByEmail?.admin_profile_id) return adminByEmail.admin_profile_id as string;

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
        .select("id, profile_id, plan_name, annual_fee, amount, status, payment_status, submitted_at, approved_at, created_at, plan_id")
        .order("created_at", { ascending: false });

      if (orderError) throw orderError;

      const nextOrders = (orderRows || []) as MembershipOrder[];
      const profileIds = Array.from(new Set(nextOrders.map((item) => item.profile_id).filter(Boolean))) as string[];

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

  function openReview(order: MembershipOrder) {
    setSelectedOrder(order);
    setReviewNotes("");
  }

  function closeReview() {
    setSelectedOrder(null);
    setReviewNotes("");
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

    const confirmed = window.confirm("Approve this membership order through the audited RPC?");
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
      closeReview();
      await loadData();
      setFilter("PENDING");
    } catch (error: any) {
      setMessage(error?.message || "Membership approval failed.");
    } finally {
      setActionLoading("");
    }
  }

  async function rejectOrder(order: MembershipOrder) {
    if (!order.id) return;

    const confirmed = window.confirm("Reject this membership order through the audited RPC?");
    if (!confirmed) return;

    setActionLoading(order.id);
    setMessage("");

    try {
      const { error } = await supabase.rpc("reject_membership_order", {
        p_order_id: order.id,
        p_admin_profile_id: adminProfileId || null,
        p_admin_notes: reviewNotes.trim() || null,
      });

      if (error) throw error;

      setMessage("Membership order rejected by RPC.");
      closeReview();
      await loadData();
      setFilter("PENDING");
    } catch (error: any) {
      setMessage(error?.message || "Membership rejection failed.");
    } finally {
      setActionLoading("");
    }
  }

  return (
    <main className="page">
      <section className="shell">
        <header className="hero">
          <div>
            <p className="eyebrow">Admin Forest Command</p>
            <h1>Membership Center</h1>
            <p>Review Arganwood Annual Membership orders. Actions happen only inside Open Review.</p>
          </div>

          <button onClick={loadData} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </header>

        {message && <div className="message">{message}</div>}

        <section className="stats">
          <StatCard label="Pending" value={String(pendingCount)} />
          <StatCard label="Approved" value={String(approvedCount)} />
          <StatCard label="Rejected" value={String(rejectedCount)} />
          <StatCard label="Expired" value="0" />
          <StatCard label="Revenue" value={formatMoney(revenue)} />
        </section>

        <section className="toolbar">
          <div>
            <h2>Membership Orders</h2>
            <p>Showing {filteredOrders.length} of {orders.length} orders.</p>
          </div>

          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="ALL">All</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </section>

        <section className="panel">
          {loading ? (
            <div className="empty">Loading membership orders...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="empty">No membership orders found.</div>
          ) : (
            <div className="orderGrid">
              {filteredOrders.map((order) => {
                const profile = getProfile(order.profile_id);
                return (
                  <article className="orderCard" key={order.id}>
                    <div>
                      <p className="eyebrow small">Customer</p>
                      <h3>{profile?.full_name || "Unknown Customer"}</h3>
                      <span>{profile?.email || "No email"}</span>
                    </div>

                    <div className="cardMeta">
                      <Info label="Plan" value={order.plan_name || "Arganwood Annual Membership"} />
                      <Info label="Amount" value={formatMoney(order.amount || order.annual_fee)} />
                      <Info label="Submitted" value={formatDate(order.submitted_at || order.created_at)} />
                      <Info label="Approved" value={formatDate(order.approved_at)} />
                    </div>

                    <div className="statusLine">
                      <span className={badgeClass(order.status)}>{normalize(order.status || "UNKNOWN")}</span>
                      <span className={badgeClass(order.payment_status)}>{normalize(order.payment_status || "UNKNOWN")}</span>
                    </div>

                    <button className="openBtn" onClick={() => openReview(order)}>
                      Open Review
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>

      {selectedOrder && (
        <section className="drawerBackdrop">
          <div className="drawer">
            <header className="drawerHead">
              <div>
                <p className="eyebrow">Membership Review</p>
                <h2>{getProfile(selectedOrder.profile_id)?.full_name || "Unknown Customer"}</h2>
                <span>{getProfile(selectedOrder.profile_id)?.email || "No email"}</span>
              </div>

              <button onClick={closeReview}>Close</button>
            </header>

            <div className="reviewGrid">
              <Info label="Plan" value={selectedOrder.plan_name || "Arganwood Annual Membership"} />
              <Info label="Plan ID" value={selectedOrder.plan_id || "—"} />
              <Info label="Amount" value={formatMoney(selectedOrder.amount || selectedOrder.annual_fee)} />
              <Info label="Order Status" value={normalize(selectedOrder.status || "UNKNOWN")} />
              <Info label="Payment Status" value={normalize(selectedOrder.payment_status || "UNKNOWN")} />
              <Info label="Submitted" value={formatDate(selectedOrder.submitted_at || selectedOrder.created_at)} />
            </div>

            <label className="notesLabel">
              Admin Notes
              <textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Optional rejection note..." />
            </label>

            {normalize(selectedOrder.status) === "PENDING" ? (
              <div className="drawerActions">
                <button className="approveBtn" onClick={() => approveOrder(selectedOrder)} disabled={actionLoading === selectedOrder.id}>
                  {actionLoading === selectedOrder.id ? "Working..." : "Approve Membership"}
                </button>
                <button className="rejectBtn" onClick={() => rejectOrder(selectedOrder)} disabled={actionLoading === selectedOrder.id}>
                  Reject Membership
                </button>
              </div>
            ) : (
              <div className="empty small">This membership order is already reviewed.</div>
            )}
          </div>
        </section>
      )}

      <style>{styles}</style>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="stat">
      <p>{label}</p>
      <h3>{value}</h3>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

const styles = `
* { box-sizing: border-box; }
.page { min-height: 100vh; padding: 28px; color: #f8f1d8; font-family: Arial, Helvetica, sans-serif; background: radial-gradient(circle at 18% 0%, rgba(214,178,94,.18), transparent 24%), linear-gradient(180deg, #06110d, #0b2117 52%, #06110d); }
.shell { max-width: 1400px; margin: 0 auto; border: 1px solid rgba(214,178,94,.18); background: rgba(255,255,255,.07); border-radius: 30px; padding: 24px; box-shadow: 0 26px 70px rgba(0,0,0,.32); }
.hero { display: flex; justify-content: space-between; gap: 18px; align-items: start; margin-bottom: 18px; }
.eyebrow { margin: 0 0 8px; color: #d6b25e; font-size: 12px; font-weight: 950; text-transform: uppercase; letter-spacing: .18em; }
.eyebrow.small { font-size: 10px; }
h1, h2, h3 { margin: 0; color: #fff8dc; }
h1 { font-size: 42px; color: #d6b25e; }
.hero p, .toolbar p, .orderCard span, .drawerHead span { color: rgba(248,241,216,.68); line-height: 1.55; }
button, select, textarea { font-family: inherit; }
button { border: 0; border-radius: 999px; padding: 12px 16px; background: linear-gradient(135deg, #d6b25e, #8c6a3c); color: #07140f; font-weight: 950; cursor: pointer; }
button:disabled { opacity: .5; cursor: not-allowed; }
.message, .toolbar, .panel, .stat, .orderCard, .drawer, .empty { border: 1px solid rgba(214,178,94,.16); background: rgba(0,0,0,.20); border-radius: 22px; }
.message, .empty { padding: 16px; margin-bottom: 16px; color: #ffe49a; font-weight: 900; }
.stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.stat { padding: 16px; }
.stat p { margin: 0; color: rgba(248,241,216,.58); font-size: 11px; font-weight: 950; text-transform: uppercase; letter-spacing: .12em; }
.stat h3 { margin-top: 8px; color: #d6b25e; font-size: 24px; }
.toolbar { padding: 16px; display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 16px; }
select, textarea { border: 1px solid rgba(214,178,94,.22); border-radius: 16px; padding: 12px 14px; background: rgba(0,0,0,.28); color: #fff8dc; outline: none; }
option { color: #07140f; }
.panel { padding: 16px; }
.orderGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.orderCard { padding: 18px; display: grid; gap: 14px; transition: transform .15s ease, border-color .15s ease; }
.orderCard:hover { transform: translateY(-2px); border-color: rgba(214,178,94,.35); }
.cardMeta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.info { border-radius: 16px; padding: 12px; background: rgba(255,255,255,.06); border: 1px solid rgba(214,178,94,.11); }
.info p { margin: 0 0 6px; color: rgba(248,241,216,.52); font-size: 10px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
.info strong { color: #fff8dc; word-break: break-word; }
.statusLine { display: flex; flex-wrap: wrap; gap: 8px; }
.badge { width: fit-content; border: 1px solid; border-radius: 999px; padding: 7px 10px; font-size: 11px; font-weight: 950; }
.approved { color: #b7f7c8; background: rgba(46,204,113,.15); border-color: rgba(46,204,113,.35); }
.pending { color: #ffe49a; background: rgba(214,178,94,.14); border-color: rgba(214,178,94,.35); }
.rejected { color: #ffc4c4; background: rgba(255,80,80,.14); border-color: rgba(255,80,80,.35); }
.neutral { color: rgba(248,241,216,.72); background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.14); }
.openBtn { width: 100%; }
.drawerBackdrop { position: fixed; inset: 0; z-index: 50; padding: 24px; background: rgba(0,0,0,.72); overflow: auto; }
.drawer { max-width: 900px; margin: 0 auto; padding: 24px; }
.drawerHead { display: flex; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
.reviewGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.notesLabel { display: grid; gap: 8px; color: rgba(248,241,216,.65); font-size: 12px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 14px; }
textarea { min-height: 120px; resize: vertical; }
.drawerActions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.approveBtn { background: linear-gradient(135deg, #2ecc71, #168a48); color: white; }
.rejectBtn { background: linear-gradient(135deg, #ff6b6b, #a83232); color: white; }
.small { margin: 0; color: rgba(248,241,216,.68); }
@media (max-width: 900px) { .hero, .toolbar, .drawerHead { display: grid; } .stats, .orderGrid, .cardMeta, .reviewGrid, .drawerActions { grid-template-columns: 1fr; } }
`;
