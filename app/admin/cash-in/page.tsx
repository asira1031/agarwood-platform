// app/admin/cashin/page.tsx
// FULL FILE REPLACEMENT ONLY

"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type CashInRequest = {
  id: string;
  profile_id: string | null;
  amount: number | null;
  status: string | null;
  created_at: string | null;
  payment_method?: string | null;
  reference_no?: string | null;
  notes?: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type WalletRow = {
  id: string;
  profile_id: string | null;
  balance: number | null;
};

type WalletTransaction = {
  id: string;
  profile_id: string | null;
  transaction_type: string | null;
  amount: number | null;
  reference_no: string | null;
  description: string | null;
  status: string | null;
  created_at: string | null;
};

type TabKey = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

function normalize(value: any) {
  return String(value || "PENDING").trim().toUpperCase();
}

function peso(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusClass(value: string | null | undefined) {
  const status = normalize(value);
  if (status === "APPROVED" || status === "COMPLETED") return "approved";
  if (status === "REJECTED") return "rejected";
  return "pending";
}

export default function AdminCashInPage() {
  const [requests, setRequests] = useState<CashInRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [wallets, setWallets] = useState<Record<string, WalletRow>>({});
  const [transactions, setTransactions] = useState<Record<string, WalletTransaction>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<TabKey>("PENDING");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const { data: requestRows, error: requestError } = await supabase
      .from("cashin_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (requestError) {
      setMessage(requestError.message);
      setRequests([]);
      setLoading(false);
      return;
    }

    const rows = (requestRows || []) as CashInRequest[];
    setRequests(rows);

    const profileIds = Array.from(
      new Set(rows.map((item) => item.profile_id).filter(Boolean))
    ) as string[];

    const requestIds = rows.map((item) => item.id).filter(Boolean);

    if (profileIds.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", profileIds);

      const profileMap: Record<string, ProfileRow> = {};
      ((profileRows || []) as ProfileRow[]).forEach((profile) => {
        profileMap[profile.id] = profile;
      });
      setProfiles(profileMap);

      const { data: walletRows } = await supabase
        .from("wallets")
        .select("id, profile_id, balance")
        .in("profile_id", profileIds);

      const walletMap: Record<string, WalletRow> = {};
      ((walletRows || []) as WalletRow[]).forEach((wallet) => {
        if (wallet.profile_id) walletMap[wallet.profile_id] = wallet;
      });
      setWallets(walletMap);
    } else {
      setProfiles({});
      setWallets({});
    }

    if (requestIds.length > 0) {
      const { data: txRows } = await supabase
        .from("wallet_transactions")
        .select("id, profile_id, transaction_type, amount, reference_no, description, status, created_at")
        .in("reference_no", requestIds);

      const txMap: Record<string, WalletTransaction> = {};
      ((txRows || []) as WalletTransaction[]).forEach((tx) => {
        if (tx.reference_no && !txMap[tx.reference_no]) txMap[tx.reference_no] = tx;
      });
      setTransactions(txMap);
    } else {
      setTransactions({});
    }

    setLoading(false);
  }

  const grouped = useMemo(() => {
    const pending = requests.filter((item) => normalize(item.status) === "PENDING");
    const approved = requests.filter((item) =>
      ["APPROVED", "COMPLETED"].includes(normalize(item.status))
    );
    const rejected = requests.filter((item) => normalize(item.status) === "REJECTED");

    return { pending, approved, rejected };
  }, [requests]);

  const activeRequests = useMemo(() => {
    if (tab === "PENDING") return grouped.pending;
    if (tab === "APPROVED") return grouped.approved;
    if (tab === "REJECTED") return grouped.rejected;
    return requests;
  }, [tab, grouped, requests]);

  const pendingAmount = grouped.pending.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const approvedAmount = grouped.approved.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  async function approveCashIn(request: CashInRequest) {
    if (!request.id) return;

    if (normalize(request.status) !== "PENDING") {
      setMessage("Only PENDING cash-in requests can be approved.");
      return;
    }

    const confirmed = window.confirm(`Approve cash-in ${peso(request.amount)}?`);
    if (!confirmed) return;

    setActionLoading(request.id);
    setMessage("");

    try {
      const { error } = await supabase.rpc("approve_cashin_request", {
        p_cashin_request_id: request.id,
        p_admin_notes: "Approved by Admin",
      });

      if (error) throw error;

      setMessage("Cash-in approved successfully via atomic RPC.");
      await loadData();
      setTab("APPROVED");
    } catch (error: any) {
      setMessage(error?.message || "Failed to approve cash-in.");
    }

    setActionLoading("");
  }

  async function rejectCashIn(request: CashInRequest) {
    if (!request.id) return;

    if (normalize(request.status) !== "PENDING") {
      setMessage("Only PENDING cash-in requests can be rejected.");
      return;
    }

    const confirmed = window.confirm("Reject this cash-in request?");
    if (!confirmed) return;

    setActionLoading(request.id);
    setMessage("");

    try {
      const { data: updatedRequest, error } = await supabase
        .from("cashin_requests")
        .update({ status: "REJECTED" })
        .eq("id", request.id)
        .eq("status", "PENDING")
        .select("id,status")
        .maybeSingle();

      if (error) throw error;

      if (!updatedRequest || normalize(updatedRequest.status) !== "REJECTED") {
        throw new Error("Cash-in request status was not updated.");
      }

      setMessage("Cash-in request rejected.");
      await loadData();
      setTab("REJECTED");
    } catch (error: any) {
      setMessage(error?.message || "Failed to reject cash-in.");
    }

    setActionLoading("");
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Admin Finance Center</p>
          <h1>Cash-In Queue</h1>
          <span>
            Approve verified customer cash-ins using the production atomic RPC.
            Wallet credit, wallet transaction, and platform treasury posting are
            handled server-side.
          </span>
        </div>

        <button onClick={loadData} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </section>

      {message && <div className="message">{message}</div>}

      <section className="stats">
        <Stat label="Pending" value={String(grouped.pending.length)} />
        <Stat label="Approved" value={String(grouped.approved.length)} />
        <Stat label="Rejected" value={String(grouped.rejected.length)} />
        <Stat label="Pending Amount" value={peso(pendingAmount)} />
        <Stat label="Approved Amount" value={peso(approvedAmount)} />
      </section>

      <section className="tabs">
        {(["PENDING", "APPROVED", "REJECTED", "ALL"] as TabKey[]).map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </section>

      <section className="panel">
        {loading ? (
          <div className="empty">Loading cash-in requests...</div>
        ) : activeRequests.length === 0 ? (
          <div className="empty">No cash-in requests in this tab.</div>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Wallet Balance</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Transaction</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {activeRequests.map((request) => {
                  const profile = request.profile_id ? profiles[request.profile_id] : null;
                  const wallet = request.profile_id ? wallets[request.profile_id] : null;
                  const tx = transactions[request.id];
                  const status = normalize(request.status);
                  const processing = actionLoading === request.id;

                  return (
                    <tr key={request.id}>
                      <td>
                        <strong>{profile?.full_name || "Unknown Customer"}</strong>
                        <small>{profile?.email || request.profile_id || "No profile"}</small>
                      </td>

                      <td>{peso(request.amount)}</td>
                      <td>{peso(wallet?.balance)}</td>

                      <td>
                        <strong>{request.payment_method || "—"}</strong>
                        <small>{request.reference_no || request.id}</small>
                        <small>{request.notes || "No notes"}</small>
                      </td>

                      <td>
                        <span className={`badge ${statusClass(status)}`}>{status}</span>
                      </td>

                      <td>{formatDate(request.created_at)}</td>

                      <td>
                        {tx ? (
                          <>
                            <strong>{tx.transaction_type || "CASH_IN"}</strong>
                            <small>{tx.status || "—"}</small>
                          </>
                        ) : (
                          <small>No wallet log yet</small>
                        )}
                      </td>

                      <td>
                        <div className="actions">
                          <button
                            disabled={processing || status !== "PENDING"}
                            onClick={() => approveCashIn(request)}
                          >
                            {processing ? "Processing..." : "Approve"}
                          </button>

                          <button
                            disabled={processing || status !== "PENDING"}
                            onClick={() => rejectCashIn(request)}
                          >
                            Reject
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

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          padding: 30px;
          color: white;
          font-family: Arial, Helvetica, sans-serif;
          background: #071f16;
        }

        .hero {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: start;
          margin-bottom: 22px;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #d9b45f;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .22em;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          color: #d9b45f;
          font-size: 40px;
        }

        .hero span {
          display: block;
          margin-top: 8px;
          color: rgba(255,255,255,.7);
          max-width: 850px;
          line-height: 1.6;
        }

        .message,
        .panel,
        .stat,
        .tabs {
          border: 1px solid rgba(255,255,255,.1);
          background: rgba(255,255,255,.08);
          border-radius: 22px;
          box-shadow: 0 20px 50px rgba(0,0,0,.22);
        }

        .message {
          padding: 16px;
          margin-bottom: 18px;
          color: #ffe8a3;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 14px;
          margin-bottom: 18px;
        }

        .stat {
          padding: 18px;
        }

        .stat p {
          margin: 0;
          color: rgba(255,255,255,.6);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .stat h3 {
          margin: 8px 0 0;
          color: #f7d774;
          font-size: 24px;
        }

        .tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          padding: 12px;
          margin-bottom: 18px;
        }

        button {
          border: 0;
          border-radius: 999px;
          padding: 11px 14px;
          background: rgba(255,255,255,.1);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        button.active,
        .hero button {
          background: #f7d774;
          color: #071f16;
        }

        button:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .panel {
          padding: 18px;
        }

        .empty {
          padding: 20px;
          color: rgba(255,255,255,.7);
        }

        .tableWrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1100px;
          border-collapse: collapse;
          font-size: 14px;
        }

        th {
          text-align: left;
          padding: 14px;
          color: rgba(255,255,255,.65);
          background: rgba(0,0,0,.25);
        }

        td {
          padding: 14px;
          border-top: 1px solid rgba(255,255,255,.1);
          vertical-align: top;
        }

        td strong {
          display: block;
          color: white;
        }

        td small {
          display: block;
          margin-top: 4px;
          color: rgba(255,255,255,.55);
          word-break: break-word;
        }

        .badge {
          display: inline-flex;
          border-radius: 999px;
          padding: 8px 12px;
          font-weight: 900;
          font-size: 12px;
        }

        .approved {
          background: rgba(16,185,129,.18);
          color: #bbf7d0;
        }

        .pending {
          background: rgba(217,180,95,.18);
          color: #fde68a;
        }

        .rejected {
          background: rgba(239,68,68,.18);
          color: #fecaca;
        }

        .actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        @media (max-width: 900px) {
          .hero {
            display: grid;
          }

          .stats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="stat">
      <p>{label}</p>
      <h3>{value}</h3>
    </article>
  );
}