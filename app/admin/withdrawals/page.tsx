"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type WithdrawalRequest = {
  id: string;
  profile_id: string | null;
  amount: number | null;
  processing_fee: number | null;
  net_receive: number | null;
  status: string | null;
  created_at: string | null;
  payout_method: string | null;
  payout_account_name: string | null;
  payout_account_number: string | null;
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

type TabKey = "PENDING" | "PROCESSING" | "PAID" | "REJECTED" | "ALL";

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

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusClass(value: string | null | undefined) {
  const status = normalize(value);

  if (status === "PAID" || status === "COMPLETED") return "paid";
  if (status === "PROCESSING") return "processing";
  if (status === "REJECTED") return "rejected";
  return "pending";
}

function statusText(value: string | null | undefined) {
  const status = normalize(value);

  if (status === "COMPLETED") return "COMPLETED";
  if (status === "PAID") return "PAID";
  if (status === "PROCESSING") return "PROCESSING";
  if (status === "REJECTED") return "REJECTED";
  return "PENDING";
}

export default function AdminWithdrawalsPage() {
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
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
      .from("withdrawal_requests")
      .select(
        "id, profile_id, amount, processing_fee, net_receive, status, created_at, payout_method, payout_account_name, payout_account_number",
      )
      .order("created_at", { ascending: false });

    if (requestError) {
      setMessage(requestError.message);
      setRequests([]);
      setLoading(false);
      return;
    }

    const rows = (requestRows || []) as WithdrawalRequest[];
    setRequests(rows);

    const profileIds = Array.from(
      new Set(rows.map((item) => item.profile_id).filter(Boolean)),
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
        if (tx.reference_no && !txMap[tx.reference_no]) {
          txMap[tx.reference_no] = tx;
        }
      });

      setTransactions(txMap);
    } else {
      setTransactions({});
    }

    setLoading(false);
  }

  const grouped = useMemo(() => {
    const pending = requests.filter((item) => normalize(item.status) === "PENDING");
    const processing = requests.filter((item) => normalize(item.status) === "PROCESSING");
    const paid = requests.filter((item) => normalize(item.status) === "PAID");
    const rejected = requests.filter((item) => normalize(item.status) === "REJECTED");

    return {
      pending,
      processing,
      paid,
      rejected,
    };
  }, [requests]);

  const activeRequests = useMemo(() => {
    if (tab === "PENDING") return grouped.pending;
    if (tab === "PROCESSING") return grouped.processing;
    if (tab === "PAID") return grouped.paid;
    if (tab === "REJECTED") return grouped.rejected;

    return requests;
  }, [tab, grouped, requests]);

  const pendingAmount = grouped.pending.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const processingAmount = grouped.processing.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const paidAmount = grouped.paid.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalRequestedAmount = requests.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalNetReceive = requests.reduce((sum, item) => sum + Number(item.net_receive || item.amount || 0), 0);
  const totalProcessingFees = requests.reduce((sum, item) => sum + Number(item.processing_fee || 0), 0);
  const pendingNetReceive = grouped.pending.reduce(
    (sum, item) => sum + Number(item.net_receive || item.amount || 0),
    0,
  );

  async function markProcessing(request: WithdrawalRequest) {
    if (!request.id || !request.profile_id) return;

    if (normalize(request.status) !== "PENDING") {
      setMessage("Only PENDING withdrawals can be moved to PROCESSING.");
      return;
    }

    const confirmed = window.confirm(`Move withdrawal ${peso(request.amount)} to PROCESSING?`);
    if (!confirmed) return;

    setActionLoading(request.id);
    setMessage("");

    try {
      const { error } = await supabase.rpc("mark_withdrawal_processing", {
        p_withdrawal_request_id: request.id,
      });

      if (error) throw error;

      setMessage("Withdrawal moved to PROCESSING by RPC.");
      await loadData();
      setTab("PROCESSING");
    } catch (error: any) {
      setMessage(error?.message || "Failed to move withdrawal to processing.");
    } finally {
      setActionLoading("");
    }
  }

  async function markPaid(request: WithdrawalRequest) {
    if (!request.id || !request.profile_id) return;

    const status = normalize(request.status);

    if (status !== "PROCESSING" && status !== "PENDING") {
      setMessage("Only PENDING or PROCESSING withdrawals can be marked PAID.");
      return;
    }

    const confirmed = window.confirm(
      "Mark this withdrawal as PAID through the audited RPC? This will NOT deduct wallet again.",
    );

    if (!confirmed) return;

    setActionLoading(request.id);
    setMessage("");

    try {
      const { error } = await supabase.rpc("mark_withdrawal_paid", {
        p_withdrawal_request_id: request.id,
      });

      if (error) throw error;

      setMessage("Withdrawal marked as PAID by RPC. Wallet transaction and platform treasury sync are handled server-side.");
      await loadData();
      setTab("PAID");
    } catch (error: any) {
      setMessage(error?.message || "Failed to mark withdrawal as PAID.");
      await loadData();
    } finally {
      setActionLoading("");
    }
  }

  async function rejectWithdrawal(request: WithdrawalRequest) {
    if (!request.id || !request.profile_id) return;

    if (["PAID", "REJECTED"].includes(normalize(request.status))) {
      setMessage("Paid or rejected withdrawals cannot be rejected again.");
      return;
    }

    const confirmed = window.confirm("Reject this withdrawal request through the audited RPC?");
    if (!confirmed) return;

    setActionLoading(request.id);
    setMessage("");

    try {
      const { error } = await supabase.rpc("reject_withdrawal_request", {
        p_withdrawal_request_id: request.id,
      });

      if (error) throw error;

      setMessage("Withdrawal rejected by RPC. Wallet restoration is handled server-side.");
      await loadData();
      setTab("REJECTED");
    } catch (error: any) {
      setMessage(error?.message || "Failed to reject withdrawal.");
    } finally {
      setActionLoading("");
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="heroOverlay" />

        <div className="heroContent">
          <p className="eyebrow">Admin Finance Center</p>
          <h1>Payout Queue / Withdrawals</h1>
          <span>
            Review withdrawal requests, move payouts into processing, and mark paid after external payout confirmation.
            Finance mutation is protected by RPC-only backend sync.
          </span>

          <div className="heroBadges">
            <span>RPC Protected</span>
            <span>No Direct Wallet Writes</span>
            <span>Treasury Server-Side</span>
          </div>
        </div>

        <div className="heroActionPanel">
          <div className="heroMetric">
            <p>Total Requested</p>
            <strong>{peso(totalRequestedAmount)}</strong>
            <small>{requests.length} withdrawal request(s)</small>
          </div>

          <button onClick={loadData} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh Withdrawals"}
          </button>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      <section className="financeGrid">
        <FinanceCard
          label="Pending Payouts"
          value={peso(pendingAmount)}
          note={`${grouped.pending.length} awaiting review`}
          tone="pending"
        />

        <FinanceCard
          label="Processing Queue"
          value={peso(processingAmount)}
          note={`${grouped.processing.length} in payout processing`}
          tone="processing"
        />

        <FinanceCard
          label="Paid Out"
          value={peso(paidAmount)}
          note={`${grouped.paid.length} completed payout(s)`}
          tone="paid"
        />

        <FinanceCard
          label="Customer Net Receive"
          value={peso(totalNetReceive)}
          note="Total requested net payout value"
          tone="neutral"
        />
      </section>

      <section className="stats">
        <Stat label="Pending" value={String(grouped.pending.length)} />
        <Stat label="Processing" value={String(grouped.processing.length)} />
        <Stat label="Paid" value={String(grouped.paid.length)} />
        <Stat label="Rejected" value={String(grouped.rejected.length)} />
        <Stat label="Pending Amount" value={peso(pendingAmount)} />
        <Stat label="Pending Net" value={peso(pendingNetReceive)} />
        <Stat label="Processing Amount" value={peso(processingAmount)} />
        <Stat label="Total Fees" value={peso(totalProcessingFees)} />
      </section>

      <section className="tabs">
        {(["PENDING", "PROCESSING", "PAID", "REJECTED", "ALL"] as TabKey[]).map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
            <span>{item}</span>
            <small>
              {item === "PENDING" && grouped.pending.length}
              {item === "PROCESSING" && grouped.processing.length}
              {item === "PAID" && grouped.paid.length}
              {item === "REJECTED" && grouped.rejected.length}
              {item === "ALL" && requests.length}
            </small>
          </button>
        ))}
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Withdrawal Records</p>
            <h2>{tab === "ALL" ? "All Payout Requests" : `${tab} Payout Requests`}</h2>
            <span>
              Showing {activeRequests.length} of {requests.length} withdrawal request(s).
            </span>
          </div>

          <div className="panelHint">
            <strong>Atomic backend actions</strong>
            <span>Processing / Paid / Reject are handled by Supabase RPCs.</span>
          </div>
        </div>

        {loading ? (
          <div className="empty">Loading withdrawal requests...</div>
        ) : activeRequests.length === 0 ? (
          <div className="empty">No withdrawal requests in this tab.</div>
        ) : (
          <div className="tableShell">
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Fee</th>
                    <th>Net Receive</th>
                    <th>Wallet Balance</th>
                    <th>Payout</th>
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
                          <div className="customerCell">
                            <div className="avatar">
                              {(profile?.full_name || profile?.email || "C").slice(0, 1).toUpperCase()}
                            </div>

                            <div>
                              <strong>{profile?.full_name || "Unknown Customer"}</strong>
                              <small>{profile?.email || request.profile_id || "No profile"}</small>
                            </div>
                          </div>
                        </td>

                        <td>
                          <strong className="money">{peso(request.amount)}</strong>
                          <small>Requested amount</small>
                        </td>

                        <td>
                          <strong>{peso(request.processing_fee)}</strong>
                          <small>Processing fee</small>
                        </td>

                        <td>
                          <strong className="net">{peso(request.net_receive || request.amount)}</strong>
                          <small>Customer receives</small>
                        </td>

                        <td>
                          <strong>{peso(wallet?.balance)}</strong>
                          <small>Wallet source of truth</small>
                        </td>

                        <td>
                          <strong>{request.payout_method || "—"}</strong>
                          <small>{request.payout_account_name || "No account name"}</small>
                          <small>{request.payout_account_number || "No account number"}</small>
                        </td>

                        <td>
                          <span className={`badge ${statusClass(status)}`}>{statusText(status)}</span>
                        </td>

                        <td>
                          <strong>{formatDate(request.created_at)}</strong>
                          <small>Submitted date</small>
                        </td>

                        <td>
                          {tx ? (
                            <>
                              <strong>{tx.transaction_type || "WITHDRAWAL"}</strong>
                              <small>{tx.status || "—"}</small>
                              <small>{tx.reference_no || request.id}</small>
                            </>
                          ) : (
                            <>
                              <strong>No wallet log yet</strong>
                              <small>Waiting for RPC sync</small>
                            </>
                          )}
                        </td>

                        <td>
                          <div className="actions">
                            <button
                              disabled={processing || status !== "PENDING"}
                              onClick={() => markProcessing(request)}
                            >
                              Processing
                            </button>

                            <button
                              disabled={processing || !["PENDING", "PROCESSING"].includes(status)}
                              onClick={() => markPaid(request)}
                            >
                              Paid
                            </button>

                            <button
                              disabled={processing || ["PAID", "REJECTED"].includes(status)}
                              onClick={() => rejectWithdrawal(request)}
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
          </div>
        )}
      </section>

      <style>{styles}</style>
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

function FinanceCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: "pending" | "processing" | "paid" | "neutral";
}) {
  return (
    <article className={`financeCard ${tone}`}>
      <div>
        <p>{label}</p>
        <h3>{value}</h3>
        <small>{note}</small>
      </div>
      <span />
    </article>
  );
}

const styles = `
  * {
    box-sizing: border-box;
  }

  .page {
    min-height: 100vh;
    padding: 30px;
    color: #f8f1d8;
    font-family: Arial, Helvetica, sans-serif;
    background:
      radial-gradient(circle at 12% 0%, rgba(214, 178, 94, .24), transparent 28%),
      radial-gradient(circle at 92% 8%, rgba(60, 130, 88, .22), transparent 32%),
      linear-gradient(180deg, #06110d 0%, #0b1f17 46%, #04100b 100%);
  }

  .hero {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 360px;
    gap: 20px;
    min-height: 300px;
    overflow: hidden;
    border-radius: 34px;
    padding: 30px;
    margin-bottom: 20px;
    border: 1px solid rgba(214, 178, 94, .22);
    background:
      linear-gradient(105deg, rgba(3, 18, 12, .96), rgba(5, 26, 16, .86), rgba(6, 34, 22, .54)),
      radial-gradient(circle at 72% 18%, rgba(214, 178, 94, .24), transparent 28%),
      linear-gradient(135deg, #0a2118, #06110d);
    box-shadow: 0 30px 90px rgba(0, 0, 0, .34);
  }

  .hero:before {
    content: "";
    position: absolute;
    inset: 0;
    opacity: .38;
    background:
      radial-gradient(circle at 12% 88%, rgba(214, 178, 94, .20), transparent 24%),
      repeating-linear-gradient(115deg, rgba(255,255,255,.045) 0 1px, transparent 1px 12px);
    pointer-events: none;
  }

  .heroOverlay {
    position: absolute;
    inset: auto -5% -35% auto;
    width: 520px;
    height: 520px;
    border-radius: 50%;
    background:
      radial-gradient(circle, rgba(214,178,94,.28), transparent 58%),
      radial-gradient(circle, rgba(95,178,116,.20), transparent 70%);
    filter: blur(3px);
  }

  .heroContent,
  .heroActionPanel {
    position: relative;
    z-index: 1;
  }

  .eyebrow {
    margin: 0 0 10px;
    color: #d6b25e;
    font-size: 12px;
    font-weight: 950;
    letter-spacing: .20em;
    text-transform: uppercase;
  }

  .hero h1 {
    margin: 0;
    max-width: 850px;
    color: #fff8dc;
    font-size: clamp(42px, 5vw, 68px);
    line-height: .92;
    letter-spacing: -2.4px;
  }

  .hero span {
    display: block;
    max-width: 820px;
    margin-top: 18px;
    color: rgba(248, 241, 216, .76);
    line-height: 1.65;
    font-weight: 750;
  }

  .heroBadges {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 24px;
  }

  .heroBadges span {
    width: fit-content;
    margin: 0;
    border-radius: 999px;
    padding: 9px 12px;
    color: #ffe49a;
    background: rgba(214,178,94,.12);
    border: 1px solid rgba(214,178,94,.24);
    font-size: 11px;
    font-weight: 950;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .heroActionPanel {
    display: grid;
    align-content: space-between;
    gap: 14px;
    min-width: 0;
    border-radius: 28px;
    padding: 18px;
    background: rgba(0,0,0,.28);
    border: 1px solid rgba(214,178,94,.18);
    backdrop-filter: blur(18px);
  }

  .heroMetric {
    border-radius: 22px;
    padding: 18px;
    background:
      radial-gradient(circle at 80% 10%, rgba(214,178,94,.18), transparent 36%),
      rgba(255,255,255,.06);
    border: 1px solid rgba(214,178,94,.14);
  }

  .heroMetric p {
    margin: 0;
    color: rgba(248,241,216,.60);
    font-size: 11px;
    font-weight: 950;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  .heroMetric strong {
    display: block;
    margin-top: 10px;
    color: #d6b25e;
    font-size: 32px;
    line-height: 1.05;
    word-break: break-word;
  }

  .heroMetric small {
    display: block;
    margin-top: 9px;
    color: rgba(248,241,216,.58);
    font-weight: 850;
  }

  button {
    border: 0;
    border-radius: 999px;
    padding: 12px 15px;
    color: #07140f;
    background: linear-gradient(135deg, #d6b25e, #8c6a3c);
    font-weight: 950;
    cursor: pointer;
    box-shadow: 0 16px 34px rgba(0,0,0,.18);
  }

  button:disabled {
    opacity: .44;
    cursor: not-allowed;
    box-shadow: none;
  }

  .message,
  .financeCard,
  .stat,
  .tabs,
  .panel,
  .empty {
    border: 1px solid rgba(214,178,94,.18);
    background: rgba(255,255,255,.075);
    backdrop-filter: blur(18px);
    box-shadow: 0 24px 70px rgba(0,0,0,.26);
  }

  .message {
    margin-bottom: 18px;
    border-radius: 22px;
    padding: 16px 18px;
    color: #ffe49a;
    font-weight: 950;
    background:
      linear-gradient(135deg, rgba(214,178,94,.14), rgba(255,255,255,.055));
  }

  .financeGrid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 18px;
  }

  .financeCard {
    position: relative;
    overflow: hidden;
    min-height: 150px;
    border-radius: 28px;
    padding: 20px;
  }

  .financeCard:before {
    content: "";
    position: absolute;
    inset: 0;
    opacity: .22;
    background:
      radial-gradient(circle at 88% 20%, currentColor, transparent 32%);
  }

  .financeCard p {
    margin: 0;
    color: rgba(248,241,216,.58);
    font-size: 11px;
    font-weight: 950;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  .financeCard h3 {
    margin: 11px 0 6px;
    color: #fff8dc;
    font-size: clamp(22px, 3vw, 32px);
    line-height: 1.05;
    word-break: break-word;
  }

  .financeCard small {
    color: #d6b25e;
    font-weight: 850;
  }

  .financeCard > span {
    position: absolute;
    right: 18px;
    bottom: 18px;
    width: 48px;
    height: 48px;
    border-radius: 17px;
    border: 1px solid rgba(214,178,94,.22);
    background:
      radial-gradient(circle at 35% 28%, rgba(255,255,255,.22), transparent 24%),
      rgba(214,178,94,.12);
  }

  .financeCard.pending {
    color: #d6b25e;
  }

  .financeCard.processing {
    color: #78bfff;
  }

  .financeCard.paid {
    color: #8dffa8;
  }

  .financeCard.neutral {
    color: #ffffff;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 18px;
  }

  .stat {
    min-width: 0;
    border-radius: 24px;
    padding: 18px;
  }

  .stat p {
    margin: 0;
    color: rgba(248,241,216,.55);
    font-size: 11px;
    font-weight: 950;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  .stat h3 {
    margin: 9px 0 0;
    color: #d6b25e;
    font-size: 24px;
    word-break: break-word;
  }

  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    border-radius: 26px;
    padding: 12px;
    margin-bottom: 18px;
  }

  .tabs button {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: rgba(255,255,255,.08);
    color: rgba(248,241,216,.76);
    border: 1px solid transparent;
    box-shadow: none;
  }

  .tabs button.active {
    color: #07140f;
    background: linear-gradient(135deg, #d6b25e, #8c6a3c);
  }

  .tabs button small {
    display: grid;
    place-items: center;
    min-width: 24px;
    height: 24px;
    border-radius: 999px;
    padding: 0 7px;
    color: inherit;
    background: rgba(255,255,255,.16);
    font-weight: 950;
  }

  .panel {
    border-radius: 32px;
    padding: 20px;
    overflow: hidden;
  }

  .panelHead {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    align-items: flex-start;
    margin-bottom: 18px;
  }

  .panelHead h2 {
    margin: 0;
    color: #fff8dc;
    font-size: 30px;
    letter-spacing: -.6px;
  }

  .panelHead span {
    display: block;
    margin-top: 7px;
    color: rgba(248,241,216,.64);
    line-height: 1.45;
    font-weight: 780;
  }

  .panelHint {
    width: 330px;
    max-width: 100%;
    border-radius: 22px;
    padding: 15px;
    background: rgba(0,0,0,.24);
    border: 1px solid rgba(214,178,94,.13);
  }

  .panelHint strong {
    display: block;
    color: #fff8dc;
    margin-bottom: 5px;
  }

  .panelHint span {
    margin: 0;
    color: rgba(248,241,216,.58);
    font-size: 13px;
  }

  .empty {
    border-radius: 22px;
    padding: 24px;
    color: rgba(248,241,216,.68);
    font-weight: 900;
    background: rgba(0,0,0,.22);
  }

  .tableShell {
    overflow: hidden;
    border-radius: 24px;
    border: 1px solid rgba(214,178,94,.13);
    background: rgba(0,0,0,.18);
  }

  .tableWrap {
    overflow-x: auto;
  }

  table {
    width: 100%;
    min-width: 1280px;
    border-collapse: collapse;
    font-size: 14px;
  }

  th {
    text-align: left;
    padding: 15px 14px;
    color: rgba(248,241,216,.64);
    background: rgba(0,0,0,.35);
    font-size: 11px;
    font-weight: 950;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  td {
    padding: 16px 14px;
    border-top: 1px solid rgba(214,178,94,.11);
    vertical-align: top;
  }

  tbody tr {
    transition: background .15s ease;
  }

  tbody tr:hover {
    background: rgba(214,178,94,.055);
  }

  td strong {
    display: block;
    color: #fff8dc;
    line-height: 1.35;
  }

  td small {
    display: block;
    margin-top: 5px;
    color: rgba(248,241,216,.52);
    line-height: 1.35;
    word-break: break-word;
    font-size: 12px;
    font-weight: 750;
  }

  .customerCell {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    min-width: 250px;
  }

  .avatar {
    width: 42px;
    height: 42px;
    border-radius: 15px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    color: #07140f;
    background: linear-gradient(135deg, #d6b25e, #8c6a3c);
    font-weight: 950;
    box-shadow: 0 12px 24px rgba(0,0,0,.22);
  }

  .money,
  .net {
    color: #d6b25e;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    padding: 8px 11px;
    font-size: 11px;
    font-weight: 950;
    border: 1px solid;
    letter-spacing: .05em;
  }

  .badge.paid {
    background: rgba(16,185,129,.18);
    border-color: rgba(16,185,129,.28);
    color: #bbf7d0;
  }

  .badge.processing {
    background: rgba(59,130,246,.18);
    border-color: rgba(59,130,246,.30);
    color: #bfdbfe;
  }

  .badge.pending {
    background: rgba(217,180,95,.18);
    border-color: rgba(217,180,95,.32);
    color: #fde68a;
  }

  .badge.rejected {
    background: rgba(239,68,68,.18);
    border-color: rgba(239,68,68,.30);
    color: #fecaca;
  }

  .actions {
    display: grid;
    gap: 8px;
    min-width: 160px;
  }

  .actions button {
    width: 100%;
    padding: 10px 12px;
    box-shadow: none;
  }

  .actions button:nth-child(1) {
    color: #bfdbfe;
    background: rgba(59,130,246,.16);
    border: 1px solid rgba(59,130,246,.30);
  }

  .actions button:nth-child(2) {
    color: #bbf7d0;
    background: rgba(16,185,129,.16);
    border: 1px solid rgba(16,185,129,.30);
  }

  .actions button:nth-child(3) {
    color: #fecaca;
    background: rgba(239,68,68,.16);
    border: 1px solid rgba(239,68,68,.30);
  }

  @media (max-width: 1180px) {
    .hero {
      grid-template-columns: 1fr;
    }

    .heroActionPanel {
      grid-template-columns: 1fr auto;
      align-items: center;
    }

    .financeGrid,
    .stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .panelHead {
      display: grid;
    }
  }

  @media (max-width: 720px) {
    .page {
      padding: 16px;
    }

    .hero {
      padding: 22px;
      border-radius: 26px;
    }

    .hero h1 {
      font-size: 38px;
    }

    .heroActionPanel {
      grid-template-columns: 1fr;
    }

    .financeGrid,
    .stats {
      grid-template-columns: 1fr;
    }

    .tabs {
      display: grid;
      grid-template-columns: 1fr;
    }

    .tabs button {
      justify-content: space-between;
    }

    .panel {
      padding: 14px;
      border-radius: 26px;
    }
  }
`;
