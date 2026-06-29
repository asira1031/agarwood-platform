"use client";

import { useEffect, useMemo, useState } from "react";
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

type BackendRole = "ADMIN" | "GARDENER" | "CUSTOMER";
type RoleMap = Record<string, BackendRole>;

function normalize(value: string | null | undefined) {
  return String(value || "UNKNOWN").trim().toUpperCase();
}

function formatDate(dateValue: string | null) {
  if (!dateValue) return "—";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function badgeClass(value: string | null | undefined) {
  const status = normalize(value);

  if (["ACTIVE", "APPROVED", "VERIFIED", "ADMIN", "GARDENER", "CUSTOMER"].includes(status)) {
    return "badge approved";
  }

  if (status === "PENDING" || status === "REVIEW") {
    return "badge pending";
  }

  if (status === "REJECTED" || status === "SUSPENDED" || status === "INACTIVE") {
    return "badge rejected";
  }

  return "badge neutral";
}

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
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);

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
    const emails = rows.map((item) => item.email?.trim().toLowerCase()).filter(Boolean) as string[];

    if (emails.length === 0) {
      setRoles({});
      return;
    }

    const { data: adminRows } = await supabase.from("admins").select("email, status").in("email", emails);
    const { data: caretakerRows } = await supabase.from("caretakers").select("email, status").in("email", emails);

    const nextRoles: RoleMap = {};

    rows.forEach((profile) => {
      const email = profile.email?.trim().toLowerCase();
      if (!email) return;

      const isAdmin = (adminRows || []).some(
        (item: any) =>
          String(item.email || "").trim().toLowerCase() === email &&
          String(item.status || "").toUpperCase() === "ACTIVE",
      );

      const isGardener = (caretakerRows || []).some(
        (item: any) =>
          String(item.email || "").trim().toLowerCase() === email &&
          String(item.status || "").toUpperCase() === "ACTIVE",
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

      const matchesSearch = !keyword || name.includes(keyword) || email.includes(keyword) || phone.includes(keyword);
      const matchesStatus = statusFilter === "ALL" || normalize(customer.account_status) === statusFilter;
      const matchesKyc = kycFilter === "ALL" || normalize(customer.kyc_status) === kycFilter;
      const matchesMembership = membershipFilter === "ALL" || normalize(customer.membership_status) === membershipFilter;

      return matchesSearch && matchesStatus && matchesKyc && matchesMembership;
    });
  }, [customers, search, statusFilter, kycFilter, membershipFilter]);

  const totalCustomers = customers.length;
  const activeCustomers = customers.filter((item) => normalize(item.account_status) === "ACTIVE").length;
  const approvedKyc = customers.filter((item) => normalize(item.kyc_status) === "APPROVED").length;
  const activeMembers = customers.filter((item) => normalize(item.membership_status) === "ACTIVE").length;

  function cleanEmail(customer: CustomerProfile) {
    return customer.email?.trim().toLowerCase() || "";
  }

  function cleanName(customer: CustomerProfile) {
    return customer.full_name?.trim() || customer.email?.trim() || "User";
  }

  function currentRole(customer: CustomerProfile): BackendRole {
    const email = cleanEmail(customer);
    return roles[email] || "CUSTOMER";
  }

  async function changeRole(customer: CustomerProfile, nextRole: BackendRole) {
    const email = cleanEmail(customer);

    if (!email) {
      setErrorText("Customer email is required.");
      return;
    }

    const confirmed = window.confirm(`Change ${cleanName(customer)} backend role to ${nextRole}?`);
    if (!confirmed) return;

    setProcessingEmail(email);
    setErrorText("");
    setSuccessText("");

    try {
      const { error } = await supabase.rpc("change_user_backend_role", {
        p_profile_id: customer.id,
        p_email: email,
        p_full_name: cleanName(customer),
        p_backend_role: nextRole,
      });

      if (error) throw error;

      setSuccessText(`${email} is now ${nextRole}.`);
      await loadCustomers();
      setSelectedCustomer((current) => (current?.id === customer.id ? { ...customer } : current));
    } catch (error: any) {
      setErrorText(error?.message || "Backend role update failed.");
    } finally {
      setProcessingEmail("");
    }
  }

  return (
    <main className="page">
      <section className="shell">
        <header className="hero">
          <div>
            <p className="eyebrow">Admin Center</p>
            <h1>Customer Management</h1>
            <p>View customer profiles. Click a card to open customer details and role controls.</p>
          </div>

          <button onClick={loadCustomers} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh Customers"}
          </button>
        </header>

        {errorText && <div className="errorBox">{errorText}</div>}
        {successText && <div className="successBox">{successText}</div>}

        <section className="stats">
          <Stat label="Total Profiles" value={totalCustomers} />
          <Stat label="Active Accounts" value={activeCustomers} />
          <Stat label="Approved KYC" value={approvedKyc} />
          <Stat label="Active Members" value={activeMembers} />
        </section>

        <section className="filters">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or phone" />

          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">All Account Status</option>
            <option value="ACTIVE">Active</option>
            <option value="VERIFIED">Verified</option>
            <option value="PENDING">Pending</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          <select value={kycFilter} onChange={(event) => setKycFilter(event.target.value)}>
            <option value="ALL">All KYC Status</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING">Pending</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select value={membershipFilter} onChange={(event) => setMembershipFilter(event.target.value)}>
            <option value="ALL">All Membership</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </section>

        <section className="panel">
          <div className="panelHead">
            <div>
              <h2>User Records</h2>
              <p>Showing {filteredCustomers.length} of {totalCustomers} profiles.</p>
            </div>
          </div>

          {loading ? (
            <div className="empty">Loading customers...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="empty">No customer records found.</div>
          ) : (
            <div className="customerGrid">
              {filteredCustomers.map((customer) => {
                const role = currentRole(customer);

                return (
                  <button className="customerCard" key={customer.id} onClick={() => setSelectedCustomer(customer)}>
                    <div className="avatar">{cleanName(customer).slice(0, 1).toUpperCase()}</div>

                    <div className="customerMain">
                      <strong>{customer.full_name || "Unnamed Customer"}</strong>
                      <span>{customer.email || "No email"}</span>
                      <small>{customer.phone || "No phone"}</small>
                    </div>

                    <div className="badges">
                      <span className={badgeClass(role)}>{role}</span>
                      <span className={badgeClass(customer.account_status)}>{normalize(customer.account_status)}</span>
                      <span className={badgeClass(customer.kyc_status)}>KYC {normalize(customer.kyc_status)}</span>
                      <span className={badgeClass(customer.membership_status)}>MEM {normalize(customer.membership_status)}</span>
                    </div>

                    <div className="cardFooter">
                      <span>Created {formatDate(customer.created_at)}</span>
                      <b>Open →</b>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </section>

      {selectedCustomer && (
        <section className="drawerBackdrop">
          <div className="drawer">
            <header className="drawerHead">
              <div>
                <p className="eyebrow">Customer Detail</p>
                <h2>{cleanName(selectedCustomer)}</h2>
                <span>{selectedCustomer.email || "No email"}</span>
              </div>

              <button onClick={() => setSelectedCustomer(null)}>Close</button>
            </header>

            <section className="detailGrid">
              <Info label="Profile ID" value={selectedCustomer.id} />
              <Info label="Phone" value={selectedCustomer.phone || "—"} />
              <Info label="Created" value={formatDate(selectedCustomer.created_at)} />
              <Info label="Backend Role" value={currentRole(selectedCustomer)} />
              <Info label="Account" value={normalize(selectedCustomer.account_status)} />
              <Info label="KYC" value={normalize(selectedCustomer.kyc_status)} />
              <Info label="Membership" value={normalize(selectedCustomer.membership_status)} />
            </section>

            <section className="rolePanel">
              <div>
                <h3>Backend Access</h3>
                <p>Role changes now use change_user_backend_role RPC only.</p>
              </div>

              <div className="roleButtons">
                <button disabled={processingEmail === cleanEmail(selectedCustomer)} onClick={() => changeRole(selectedCustomer, "ADMIN")}>Make Admin</button>
                <button disabled={processingEmail === cleanEmail(selectedCustomer)} onClick={() => changeRole(selectedCustomer, "GARDENER")}>Make Gardener</button>
                <button disabled={processingEmail === cleanEmail(selectedCustomer)} onClick={() => changeRole(selectedCustomer, "CUSTOMER")}>Make Customer</button>
              </div>
            </section>
          </div>
        </section>
      )}

      <style>{styles}</style>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
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
.shell { max-width: 1450px; margin: 0 auto; border: 1px solid rgba(214,178,94,.18); background: rgba(255,255,255,.07); border-radius: 30px; padding: 24px; box-shadow: 0 26px 70px rgba(0,0,0,.32); }
.hero { display: flex; justify-content: space-between; gap: 18px; align-items: start; margin-bottom: 18px; }
.eyebrow { margin: 0 0 8px; color: #d6b25e; font-size: 12px; font-weight: 950; text-transform: uppercase; letter-spacing: .18em; }
h1, h2, h3 { margin: 0; color: #fff8dc; }
h1 { font-size: 42px; color: #d6b25e; }
.hero p, .panelHead p, .rolePanel p, .drawerHead span { color: rgba(248,241,216,.68); line-height: 1.55; }
button, input, select { font-family: inherit; }
button { border: 0; border-radius: 999px; padding: 12px 16px; background: linear-gradient(135deg, #d6b25e, #8c6a3c); color: #07140f; font-weight: 950; cursor: pointer; }
button:disabled { opacity: .5; cursor: not-allowed; }
.errorBox, .successBox, .filters, .panel, .stat, .drawer, .empty { border: 1px solid rgba(214,178,94,.16); background: rgba(0,0,0,.20); border-radius: 22px; }
.errorBox, .successBox, .empty { padding: 16px; margin-bottom: 16px; font-weight: 900; }
.errorBox { color: #ffc4c4; border-color: rgba(255,80,80,.3); }
.successBox { color: #b7f7c8; border-color: rgba(46,204,113,.3); }
.stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.stat { padding: 16px; }
.stat p { margin: 0; color: rgba(248,241,216,.58); font-size: 11px; font-weight: 950; text-transform: uppercase; letter-spacing: .12em; }
.stat h3 { margin-top: 8px; color: #d6b25e; font-size: 30px; }
.filters { display: grid; grid-template-columns: 1.2fr 1fr 1fr 1fr; gap: 12px; padding: 16px; margin-bottom: 16px; }
input, select { border: 1px solid rgba(214,178,94,.22); border-radius: 16px; padding: 12px 14px; background: rgba(0,0,0,.28); color: #fff8dc; outline: none; }
option { color: #07140f; }
.panel { padding: 18px; }
.panelHead { display: flex; justify-content: space-between; gap: 14px; margin-bottom: 14px; }
.customerGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.customerCard { width: 100%; text-align: left; color: inherit; border-radius: 24px; padding: 18px; display: grid; gap: 14px; background: rgba(255,255,255,.07); border: 1px solid rgba(214,178,94,.14); transition: transform .15s ease, border-color .15s ease; }
.customerCard:hover { transform: translateY(-2px); border-color: rgba(214,178,94,.38); }
.avatar { width: 48px; height: 48px; border-radius: 18px; display: grid; place-items: center; color: #07140f; background: linear-gradient(135deg, #d6b25e, #8c6a3c); font-size: 22px; font-weight: 950; }
.customerMain { display: grid; gap: 4px; }
.customerMain strong { color: #fff8dc; font-size: 18px; }
.customerMain span, .customerMain small, .cardFooter span { color: rgba(248,241,216,.62); word-break: break-word; }
.badges { display: flex; flex-wrap: wrap; gap: 8px; }
.badge { width: fit-content; border: 1px solid; border-radius: 999px; padding: 7px 10px; font-size: 11px; font-weight: 950; }
.approved { color: #b7f7c8; background: rgba(46,204,113,.15); border-color: rgba(46,204,113,.35); }
.pending { color: #ffe49a; background: rgba(214,178,94,.14); border-color: rgba(214,178,94,.35); }
.rejected { color: #ffc4c4; background: rgba(255,80,80,.14); border-color: rgba(255,80,80,.35); }
.neutral { color: rgba(248,241,216,.72); background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.14); }
.cardFooter { display: flex; justify-content: space-between; gap: 12px; align-items: center; border-top: 1px solid rgba(214,178,94,.12); padding-top: 12px; }
.cardFooter b { color: #d6b25e; }
.drawerBackdrop { position: fixed; inset: 0; z-index: 50; padding: 24px; background: rgba(0,0,0,.72); overflow: auto; }
.drawer { max-width: 900px; margin: 0 auto; padding: 24px; }
.drawerHead { display: flex; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
.detailGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.info { border-radius: 16px; padding: 12px; background: rgba(255,255,255,.06); border: 1px solid rgba(214,178,94,.11); }
.info p { margin: 0 0 6px; color: rgba(248,241,216,.52); font-size: 10px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
.info strong { color: #fff8dc; word-break: break-word; }
.rolePanel { border-radius: 22px; padding: 16px; border: 1px solid rgba(214,178,94,.16); background: rgba(255,255,255,.06); }
.roleButtons { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px; }
@media (max-width: 1050px) { .customerGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .filters { grid-template-columns: 1fr 1fr; } }
@media (max-width: 720px) { .hero, .drawerHead { display: grid; } .stats, .customerGrid, .filters, .detailGrid, .roleButtons { grid-template-columns: 1fr; } }
`;
