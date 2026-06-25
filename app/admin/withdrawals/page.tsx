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

  if (status === "PAID" || status === "COMPLETED") return "paid";
  if (status === "PROCESSING") return "processing";
  if (status === "REJECTED") return "rejected";
  return "pending";
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
        "id, profile_id, amount, processing_fee, net_receive, status, created_at, payout_method, payout_account_name, payout_account_number"
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

    const profileIds = Array.from(new Set(rows.map((item) => item.profile_id).filter(Boolean))) as string[];
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
    const processing = requests.filter((item) => normalize(item.status) === "PROCESSING");
    const paid = requests.filter((item) => normalize(item.status) === "PAID");
    const rejected = requests.filter((item) => normalize(item.status) === "REJECTED");

    return { pending, processing, paid, rejected };
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

  async function getFreshTransaction(referenceNo: string) {
    const { data, error } = await supabase
      .from("wallet_transactions")
      .select("id, profile_id, transaction_type, amount, reference_no, description, status, created_at")
      .eq("reference_no", referenceNo)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as WalletTransaction | null;
  }

  async function getFreshWallet(profileId: string) {
    const { data, error } = await supabase
      .from("wallets")
      .select("id, profile_id, balance")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (error) throw error;
    return data as WalletRow | null;
  }

  async function updateWithdrawalTransaction(
    request: WithdrawalRequest,
    status: "PROCESSING" | "COMPLETED" | "REJECTED"
  ) {
    if (!request.profile_id) throw new Error("Profile ID missing.");

    const existing = await getFreshTransaction(request.id);
    const fallbackAmount = -Math.abs(Number(request.amount || 0));
    const amount = Number(existing?.amount || fallbackAmount);

    const description =
      status === "COMPLETED"
        ? `Withdrawal paid via ${request.payout_method || "payout method"}. Account: ${
            request.payout_account_name || "N/A"
          } - ${request.payout_account_number || "N/A"}.`
        : status === "PROCESSING"
        ? `Withdrawal moved to processing. Amount: ${peso(request.amount)}.`
        : `Withdrawal rejected and wallet restored once. Amount: ${peso(request.amount)}.`;

    if (existing) {
      const { data: updatedTx, error } = await supabase
        .from("wallet_transactions")
        .update({
          transaction_type: "WITHDRAWAL",
          amount,
          status,
          description,
        })
        .eq("id", existing.id)
        .select("id,status")
        .maybeSingle();

      if (error) throw error;

      if (!updatedTx || normalize(updatedTx.status) !== status) {
        throw new Error("Wallet transaction status was not updated.");
      }

      return;
    }

    const { data: insertedTx, error } = await supabase
      .from("wallet_transactions")
      .insert({
        profile_id: request.profile_id,
        transaction_type: "WITHDRAWAL",
        amount,
        reference_no: request.id,
        description,
        status,
        created_at: new Date().toISOString(),
      })
      .select("id,status")
      .maybeSingle();

    if (error) throw error;

    if (!insertedTx || normalize(insertedTx.status) !== status) {
      throw new Error("Wallet transaction status was not updated.");
    }
  }

  async function restoreWalletOnce(request: WithdrawalRequest) {
    if (!request.profile_id) throw new Error("Profile ID missing.");

    const freshTx = await getFreshTransaction(request.id);

    if (freshTx && normalize(freshTx.status) === "REJECTED") {
      return false;
    }

    const wallet = await getFreshWallet(request.profile_id);

    if (!wallet?.id) {
      throw new Error("Customer wallet not found. Cannot restore rejected withdrawal.");
    }

    const restoreAmount = Math.abs(Number(request.amount || 0));
    const currentBalance = Number(wallet.balance || 0);
    const newBalance = currentBalance + restoreAmount;

    const { error: walletError } = await supabase
      .from("wallets")
      .update({ balance: newBalance })
      .eq("id", wallet.id);

    if (walletError) throw walletError;

    return true;
  }

  async function rollbackWithdrawalStatus(requestId: string, previousStatus: string) {
    const { error } = await supabase
      .from("withdrawal_requests")
      .update({ status: previousStatus })
      .eq("id", requestId);

    if (error) {
      console.error("Withdrawal status rollback failed:", error);
      throw new Error(`Treasury failed, then withdrawal rollback failed: ${error.message}`);
    }
  }

  async function rollbackWalletTransaction(
    requestId: string,
    previousTx: WalletTransaction | null,
    insertedTxId: string | null
  ) {
    if (previousTx?.id) {
      const { error } = await supabase
        .from("wallet_transactions")
        .update({
          profile_id: previousTx.profile_id,
          transaction_type: previousTx.transaction_type,
          amount: previousTx.amount,
          reference_no: previousTx.reference_no,
          description: previousTx.description,
          status: previousTx.status,
        })
        .eq("id", previousTx.id);

      if (error) {
        console.error("Wallet transaction rollback failed:", error);
        throw new Error(`Treasury failed, then wallet transaction rollback failed: ${error.message}`);
      }

      return;
    }

    if (insertedTxId) {
      const { error } = await supabase
        .from("wallet_transactions")
        .delete()
        .eq("id", insertedTxId);

      if (error) {
        console.error("Inserted wallet transaction rollback failed:", error);
        throw new Error(`Treasury failed, then inserted wallet transaction rollback failed: ${error.message}`);
      }

      return;
    }

    const { error } = await supabase
      .from("wallet_transactions")
      .delete()
      .eq("reference_no", requestId)
      .eq("transaction_type", "WITHDRAWAL")
      .eq("status", "COMPLETED");

    if (error) {
      console.error("Fallback wallet transaction rollback failed:", error);
      throw new Error(`Treasury failed, then fallback wallet transaction rollback failed: ${error.message}`);
    }
  }

  async function insertWithdrawalTreasury(request: WithdrawalRequest) {
    if (!request.id || !request.profile_id) {
      throw new Error("Missing withdrawal request profile.");
    }

    const { data: existingTreasury, error: treasuryCheckError } = await supabase
      .from("platform_treasury")
      .select("id")
      .eq("source_type", "WITHDRAWAL")
      .eq("source_id", request.id)
      .limit(1);

    if (treasuryCheckError) {
      throw treasuryCheckError;
    }

    if (existingTreasury && existingTreasury.length > 0) {
      return;
    }

    const { error: treasuryError } = await supabase.from("platform_treasury").insert({
      source: "WITHDRAWAL",
      source_type: "WITHDRAWAL",
      source_id: request.id,
      reference_id: request.id,
      reference_no: request.id,
      customer_profile_id: request.profile_id,
      profile_id: request.profile_id,
      amount: -Math.abs(Number(request.amount || 0)),
      description: "Withdrawal paid",
      status: "POSTED",
      created_at: new Date().toISOString(),
    });

    if (treasuryError) {
      throw treasuryError;
    }
  }

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
      const { data: updatedRequest, error } = await supabase
        .from("withdrawal_requests")
        .update({ status: "PROCESSING" })
        .eq("id", request.id)
        .eq("status", "PENDING")
        .select("id,status")
        .maybeSingle();

      if (error) throw error;

      if (!updatedRequest || normalize(updatedRequest.status) !== "PROCESSING") {
        throw new Error("Withdrawal request status was not updated.");
      }

      await updateWithdrawalTransaction(request, "PROCESSING");

      setMessage("Withdrawal moved to PROCESSING.");
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

    const previousStatus = normalize(request.status);

    if (previousStatus !== "PROCESSING" && previousStatus !== "PENDING") {
      setMessage("Only PENDING or PROCESSING withdrawals can be marked PAID.");
      return;
    }

    const confirmed = window.confirm(
      "Mark this withdrawal as PAID? This will NOT deduct wallet again."
    );
    if (!confirmed) return;

    setActionLoading(request.id);
    setMessage("");

    let previousTx: WalletTransaction | null = null;
    let insertedTxId: string | null = null;
    let withdrawalMovedToPaid = false;
    let walletTxCompleted = false;

    try {
      previousTx = await getFreshTransaction(request.id);

      const { data: updatedRequest, error: withdrawalError } = await supabase
        .from("withdrawal_requests")
        .update({ status: "PAID" })
        .eq("id", request.id)
        .in("status", ["PENDING", "PROCESSING"])
        .select("id,status")
        .maybeSingle();

      if (withdrawalError) throw withdrawalError;

      if (!updatedRequest || normalize(updatedRequest.status) !== "PAID") {
        throw new Error("Withdrawal request status was not updated.");
      }

      withdrawalMovedToPaid = true;

      const amount = Number(previousTx?.amount || -Math.abs(Number(request.amount || 0)));
      const description = `Withdrawal paid via ${
        request.payout_method || "payout method"
      }. Account: ${request.payout_account_name || "N/A"} - ${
        request.payout_account_number || "N/A"
      }.`;

      if (previousTx?.id) {
        const { data: updatedTx, error: txError } = await supabase
          .from("wallet_transactions")
          .update({
            transaction_type: "WITHDRAWAL",
            amount,
            status: "COMPLETED",
            description,
          })
          .eq("id", previousTx.id)
          .select("id,status")
          .maybeSingle();

        if (txError) throw txError;

        if (!updatedTx || normalize(updatedTx.status) !== "COMPLETED") {
          throw new Error("Wallet transaction status was not updated.");
        }
      } else {
        const { data: insertedTx, error: txError } = await supabase
          .from("wallet_transactions")
          .insert({
            profile_id: request.profile_id,
            transaction_type: "WITHDRAWAL",
            amount,
            reference_no: request.id,
            description,
            status: "COMPLETED",
            created_at: new Date().toISOString(),
          })
          .select("id,status")
          .maybeSingle();

        if (txError) throw txError;

        if (!insertedTx || normalize(insertedTx.status) !== "COMPLETED") {
          throw new Error("Wallet transaction status was not updated.");
        }

        insertedTxId = insertedTx.id;
      }

      walletTxCompleted = true;

      try {
        await insertWithdrawalTreasury(request);
      } catch (treasuryError: any) {
        console.error("Withdrawal treasury sync failed:", treasuryError);

        if (walletTxCompleted) {
          await rollbackWalletTransaction(request.id, previousTx, insertedTxId);
        }

        if (withdrawalMovedToPaid) {
          await rollbackWithdrawalStatus(request.id, previousStatus);
        }

        throw new Error(
          `Treasury sync failed: ${treasuryError?.message || "Unknown treasury error"}`
        );
      }

      setMessage("Withdrawal marked as PAID. Wallet transaction completed. Platform treasury synced.");
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

    const confirmed = window.confirm("Reject this withdrawal request and restore wallet once?");
    if (!confirmed) return;

    setActionLoading(request.id);
    setMessage("");

    try {
      await restoreWalletOnce(request);

      const { data: updatedRequest, error } = await supabase
        .from("withdrawal_requests")
        .update({ status: "REJECTED" })
        .eq("id", request.id)
        .in("status", ["PENDING", "PROCESSING"])
        .select("id,status")
        .maybeSingle();

      if (error) throw error;

      if (!updatedRequest || normalize(updatedRequest.status) !== "REJECTED") {
        throw new Error("Withdrawal request status was not updated.");
      }

      await updateWithdrawalTransaction(request, "REJECTED");

      setMessage("Withdrawal rejected. Customer wallet restored once.");
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
        <div>
          <p className="eyebrow">Admin Finance Center</p>
          <h1>Payout Queue / Withdrawals</h1>
          <span>
            Review withdrawal requests, move to processing, and mark paid after external payout.
            Admin does not deduct customer wallet again. PAID status now requires wallet transaction
            completion and platform treasury POSTED sync.
          </span>
        </div>

        <button onClick={loadData} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </section>

      {message && <div className="message">{message}</div>}

      <section className="stats">
        <Stat label="Pending" value={String(grouped.pending.length)} />
        <Stat label="Processing" value={String(grouped.processing.length)} />
        <Stat label="Paid" value={String(grouped.paid.length)} />
        <Stat label="Rejected" value={String(grouped.rejected.length)} />
        <Stat label="Pending Amount" value={peso(pendingAmount)} />
        <Stat label="Processing Amount" value={peso(processingAmount)} />
        <Stat label="Total Paid" value={peso(paidAmount)} />
      </section>

      <section className="tabs">
        {(["PENDING", "PROCESSING", "PAID", "REJECTED", "ALL"] as TabKey[]).map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </section>

      <section className="panel">
        {loading ? (
          <div className="empty">Loading withdrawal requests...</div>
        ) : activeRequests.length === 0 ? (
          <div className="empty">No withdrawal requests in this tab.</div>
        ) : (
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
                        <strong>{profile?.full_name || "Unknown Customer"}</strong>
                        <small>{profile?.email || request.profile_id || "No profile"}</small>
                      </td>

                      <td>{peso(request.amount)}</td>
                      <td>{peso(request.processing_fee)}</td>
                      <td>{peso(request.net_receive || request.amount)}</td>
                      <td>{peso(wallet?.balance)}</td>

                      <td>
                        <strong>{request.payout_method || "—"}</strong>
                        <small>{request.payout_account_name || "No account name"}</small>
                        <small>{request.payout_account_number || "No account number"}</small>
                      </td>

                      <td>
                        <span className={`badge ${statusClass(status)}`}>{status}</span>
                      </td>

                      <td>{formatDate(request.created_at)}</td>

                      <td>
                        {tx ? (
                          <>
                            <strong>{tx.transaction_type || "WITHDRAWAL"}</strong>
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
          grid-template-columns: repeat(4, 1fr);
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
          min-width: 1250px;
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

        .paid {
          background: rgba(16,185,129,.18);
          color: #bbf7d0;
        }

        .processing {
          background: rgba(59,130,246,.18);
          color: #bfdbfe;
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