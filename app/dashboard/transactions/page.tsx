"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type WalletTransaction = {
  id: string;
  transaction_type: string | null;
  amount: number | null;
  reference_no: string | null;
  description: string | null;
  status: string | null;
  created_at: string | null;
};

type LedgerFilter = "ALL" | "CREDIT" | "DEBIT" | "PENDING";

export default function TransactionsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<LedgerFilter>("ALL");

  async function resolveProfile() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      window.location.href = "/login";
      return null;
    }

    const email = user.email?.trim().toLowerCase() || "";

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    let profileByEmail: Profile | null = null;

    if (email) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("email", email)
        .maybeSingle();

      profileByEmail = data as Profile | null;
    }

    return (profileById || profileByEmail) as Profile | null;
  }

  async function loadTransactions() {
    try {
      setLoading(true);
      setMessage("");

      const currentProfile = await resolveProfile();

      if (!currentProfile) {
        setMessage("Profile not found.");
        setLoading(false);
        return;
      }

      setProfile(currentProfile);

      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("id, transaction_type, amount, reference_no, description, status, created_at")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTransactions((data as WalletTransaction[]) || []);
    } catch (error: any) {
      console.error("Forest ledger load error:", error);
      setMessage(error?.message || "Failed to load Forest Ledger.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTransactions();
  }, []);

  const filteredTransactions = useMemo(() => {
    if (filter === "ALL") return transactions;

    if (filter === "PENDING") {
      return transactions.filter((item) => isPending(item.status));
    }

    return transactions.filter((item) => getDirection(item.transaction_type, Number(item.amount || 0)) === filter);
  }, [transactions, filter]);

  const stats = useMemo(() => {
    const credits = transactions
      .filter((item) => getDirection(item.transaction_type, Number(item.amount || 0)) === "CREDIT")
      .reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0);

    const debits = transactions
      .filter((item) => getDirection(item.transaction_type, Number(item.amount || 0)) === "DEBIT")
      .reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0);

    const pending = transactions.filter((item) => isPending(item.status)).length;

    return {
      total: transactions.length,
      credits,
      debits,
      pending,
      net: credits - debits,
    };
  }, [transactions]);

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Customer Money Movement</p>
          <h1>Forest Ledger</h1>
          <span>
            Real wallet transaction records only. This page reads the approved V6 ledger fields:
            transaction type, amount, reference number, description, status, and date.
          </span>
        </div>

        <div className="heroActions">
          <Link href="/dashboard/wallet">Forest Wallet</Link>
          <Link href="/dashboard/earnings">Forest Earnings</Link>
          <button type="button" onClick={loadTransactions}>Refresh</button>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      {loading ? (
        <div className="empty">Loading Forest Ledger...</div>
      ) : (
        <>
          <section className="cards">
            <SummaryCard label="Ledger Records" value={String(stats.total)} note="Real wallet movements" />
            <SummaryCard label="Forest Credits" value={peso(stats.credits)} note="Cash-in, payouts, bonuses" good />
            <SummaryCard label="Forest Debits" value={peso(stats.debits)} note="Withdrawals, purchases, fees" bad />
            <SummaryCard label="Pending Items" value={String(stats.pending)} note="Waiting or processing" />
          </section>

          <section className="filters">
            {(["ALL", "CREDIT", "DEBIT", "PENDING"] as LedgerFilter[]).map((item) => (
              <button
                key={item}
                type="button"
                className={filter === item ? "active" : ""}
                onClick={() => setFilter(item)}
              >
                {item === "ALL" ? "All Forest Movements" : cleanType(item)}
              </button>
            ))}
          </section>

          <section className="panel">
            <div className="panelHead">
              <div>
                <h2>Premium Transaction Timeline</h2>
                <p>{profile?.email || "Customer"} • wallet_transactions only</p>
              </div>

              <strong className={stats.net >= 0 ? "netGood" : "netBad"}>
                Net {peso(stats.net)}
              </strong>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="empty small">No Forest Ledger records found for this filter.</div>
            ) : (
              <div className="timeline">
                {filteredTransactions.map((item) => {
                  const direction = getDirection(item.transaction_type, Number(item.amount || 0));

                  return (
                    <article className="ledgerRow" key={item.id}>
                      <div className={`marker ${direction.toLowerCase()}`}>
                        {direction === "CREDIT" ? "+" : direction === "DEBIT" ? "−" : "•"}
                      </div>

                      <div className="ledgerBody">
                        <div className="ledgerTop">
                          <div>
                            <strong>{friendlyTransaction(item.transaction_type)}</strong>
                            <p>{item.description || "Forest wallet movement"}</p>
                          </div>

                          <div className="amountBlock">
                            <b className={direction.toLowerCase()}>
                              {direction === "DEBIT" ? "-" : direction === "CREDIT" ? "+" : ""}
                              {peso(Math.abs(Number(item.amount || 0)))}
                            </b>
                            <span className={`status ${statusClass(item.status)}`}>
                              {cleanType(item.status)}
                            </span>
                          </div>
                        </div>

                        <div className="ledgerMeta">
                          <span>{formatDate(item.created_at)}</span>
                          <span>{friendlyReference(item.reference_no)}</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          padding: 28px;
          color: #f6f1df;
          font-family: Arial, Helvetica, sans-serif;
          background:
            radial-gradient(circle at 15% 0%, rgba(230, 187, 92, .20), transparent 27%),
            radial-gradient(circle at 85% 10%, rgba(42, 120, 78, .28), transparent 30%),
            linear-gradient(145deg, #06130d 0%, #0a2117 48%, #020604 100%);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: stretch;
          gap: 18px;
          margin-bottom: 20px;
        }

        .hero > div:first-child,
        .heroActions,
        .card,
        .panel,
        .empty,
        .message {
          border: 1px solid rgba(230, 187, 92, .22);
          background: rgba(255, 255, 255, .07);
          box-shadow: 0 24px 70px rgba(0, 0, 0, .35);
          backdrop-filter: blur(18px);
        }

        .hero > div:first-child {
          flex: 1;
          border-radius: 30px;
          padding: 28px;
          overflow: hidden;
          position: relative;
        }

        .hero > div:first-child:before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(120deg, rgba(230, 187, 92, .16), transparent 42%),
            repeating-linear-gradient(135deg, rgba(255,255,255,.025) 0 1px, transparent 1px 18px);
          pointer-events: none;
        }

        .eyebrow {
          position: relative;
          margin: 0 0 10px;
          color: #d8b45f;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .18em;
          text-transform: uppercase;
        }

        h1 {
          position: relative;
          margin: 0;
          font-size: clamp(36px, 5vw, 66px);
          line-height: .94;
          letter-spacing: -2.5px;
        }

        .hero span {
          position: relative;
          display: block;
          max-width: 760px;
          margin-top: 14px;
          color: rgba(246, 241, 223, .72);
          line-height: 1.65;
        }

        .heroActions {
          width: 270px;
          border-radius: 30px;
          padding: 20px;
          display: grid;
          gap: 10px;
          align-content: center;
        }

        .heroActions a,
        .heroActions button {
          border: 1px solid rgba(216, 180, 95, .24);
          background: rgba(0,0,0,.22);
          color: #f6f1df;
          text-decoration: none;
          border-radius: 16px;
          padding: 13px 14px;
          cursor: pointer;
          font-weight: 900;
          text-align: center;
        }

        .heroActions a:hover,
        .heroActions button:hover {
          background: rgba(216, 180, 95, .16);
          border-color: rgba(216, 180, 95, .58);
        }

        .message,
        .empty {
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 18px;
        }

        .message {
          color: #f1cf7a;
          border-color: rgba(241, 207, 122, .36);
        }

        .empty {
          color: rgba(246, 241, 223, .70);
          text-align: center;
        }

        .empty.small {
          box-shadow: none;
          background: rgba(0,0,0,.18);
          border-style: dashed;
          margin: 0;
        }

        .cards {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 16px;
        }

        .card {
          border-radius: 26px;
          padding: 20px;
        }

        .card p {
          margin: 0 0 8px;
          color: rgba(246, 241, 223, .62);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .card strong {
          display: block;
          color: #fff8dc;
          font-size: 24px;
          letter-spacing: -.5px;
        }

        .card.good strong {
          color: #86efac;
        }

        .card.bad strong {
          color: #fca5a5;
        }

        .card small {
          display: block;
          margin-top: 8px;
          color: rgba(246, 241, 223, .54);
          line-height: 1.45;
        }

        .filters {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 16px;
        }

        .filters button {
          border: 1px solid rgba(216, 180, 95, .24);
          background: rgba(255,255,255,.06);
          color: #f6f1df;
          border-radius: 999px;
          padding: 11px 14px;
          cursor: pointer;
          font-weight: 900;
        }

        .filters button.active {
          background: linear-gradient(135deg, #f6d77e, #b9872f);
          color: #06130d;
          border-color: transparent;
        }

        .panel {
          border-radius: 30px;
          padding: 22px;
        }

        .panelHead {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 18px;
        }

        .panelHead h2 {
          margin: 0;
          color: #fff8dc;
        }

        .panelHead p {
          margin: 6px 0 0;
          color: rgba(246, 241, 223, .62);
        }

        .netGood {
          color: #86efac;
        }

        .netBad {
          color: #fca5a5;
        }

        .timeline {
          position: relative;
          display: grid;
          gap: 14px;
        }

        .ledgerRow {
          display: grid;
          grid-template-columns: 48px 1fr;
          gap: 14px;
          align-items: stretch;
        }

        .marker {
          width: 48px;
          height: 48px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          font-size: 24px;
          font-weight: 1000;
          border: 1px solid rgba(255,255,255,.1);
          background: rgba(0,0,0,.24);
        }

        .marker.credit {
          color: #86efac;
          background: rgba(74, 222, 128, .12);
        }

        .marker.debit {
          color: #fca5a5;
          background: rgba(248, 113, 113, .12);
        }

        .marker.neutral {
          color: #f1cf7a;
          background: rgba(216, 180, 95, .12);
        }

        .ledgerBody {
          border: 1px solid rgba(255,255,255,.09);
          background: rgba(0,0,0,.20);
          border-radius: 24px;
          padding: 16px;
        }

        .ledgerTop {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
        }

        .ledgerTop strong {
          color: #fff8dc;
          font-size: 17px;
        }

        .ledgerTop p {
          margin: 6px 0 0;
          color: rgba(246, 241, 223, .62);
          line-height: 1.5;
        }

        .amountBlock {
          text-align: right;
          flex: 0 0 auto;
        }

        .amountBlock b {
          display: block;
          font-size: 18px;
          margin-bottom: 8px;
        }

        .amountBlock b.credit {
          color: #86efac;
        }

        .amountBlock b.debit {
          color: #fca5a5;
        }

        .amountBlock b.neutral {
          color: #f1cf7a;
        }

        .status {
          display: inline-flex;
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 1000;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .status.good {
          background: rgba(74, 222, 128, .16);
          color: #86efac;
        }

        .status.warning {
          background: rgba(251, 191, 36, .16);
          color: #fde68a;
        }

        .status.bad {
          background: rgba(248, 113, 113, .16);
          color: #fca5a5;
        }

        .status.neutral {
          background: rgba(255,255,255,.10);
          color: rgba(246, 241, 223, .75);
        }

        .ledgerMeta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid rgba(255,255,255,.08);
        }

        .ledgerMeta span {
          color: rgba(246, 241, 223, .52);
          font-size: 12px;
        }

        @media (max-width: 1000px) {
          .hero {
            display: grid;
            grid-template-columns: 1fr;
          }

          .heroActions {
            width: 100%;
          }

          .cards {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 680px) {
          .page {
            padding: 18px;
          }

          .cards {
            grid-template-columns: 1fr;
          }

          .panelHead,
          .ledgerTop {
            flex-direction: column;
          }

          .amountBlock {
            text-align: left;
          }

          .ledgerRow {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  note,
  good,
  bad,
}: {
  label: string;
  value: string;
  note: string;
  good?: boolean;
  bad?: boolean;
}) {
  return (
    <article className={`card ${good ? "good" : ""} ${bad ? "bad" : ""}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function getDirection(transactionType: string | null, amount: number): "CREDIT" | "DEBIT" | "NEUTRAL" {
  const type = String(transactionType || "").toUpperCase();

  if (
    type.includes("CASH_IN") ||
    type.includes("CASHIN") ||
    type.includes("TREE_SALE") ||
    type.includes("SELL_TREE") ||
    type.includes("REFERRAL") ||
    type.includes("BONUS") ||
    type.includes("PAYOUT") ||
    type.includes("CREDIT")
  ) {
    return "CREDIT";
  }

  if (
    type.includes("WITHDRAW") ||
    type.includes("MARKETPLACE") ||
    type.includes("PURCHASE") ||
    type.includes("MEMBERSHIP") ||
    type.includes("TREE_OPERATION") ||
    type.includes("CARE") ||
    type.includes("SERVICE") ||
    type.includes("DEBIT")
  ) {
    return "DEBIT";
  }

  if (amount > 0) return "CREDIT";
  if (amount < 0) return "DEBIT";

  return "NEUTRAL";
}

function friendlyTransaction(value: string | null | undefined) {
  const type = String(value || "TRANSACTION").toUpperCase();

  if (type.includes("CASH_IN") || type.includes("CASHIN")) return "Forest Cash-In";
  if (type.includes("WITHDRAW")) return "Forest Withdrawal";
  if (type.includes("TREE_PURCHASE")) return "Tree Purchase";
  if (type.includes("MARKETPLACE")) return "Marketplace Purchase";
  if (type.includes("TREE_OPERATION") || type.includes("CARE") || type.includes("SERVICE")) return "Forest Care Service";
  if (type.includes("MEMBERSHIP")) return "Membership Payment";
  if (type.includes("SELL_TREE") || type.includes("TREE_SALE") || type.includes("PAYOUT")) return "Tree Sale Payout";
  if (type.includes("REFERRAL")) return "Referral Bonus";

  return cleanType(type);
}

function friendlyReference(value: string | null | undefined) {
  if (!value) return "No reference";
  if (value.length > 18) return `Reference: ${value.slice(0, 8)}…${value.slice(-4)}`;
  return `Reference: ${value}`;
}

function isPending(value: string | null | undefined) {
  return ["PENDING", "PROCESSING", "UNDER_REVIEW", "UNDER REVIEW", "WAITING"].includes(
    String(value || "").toUpperCase()
  );
}

function statusClass(value: string | null | undefined) {
  const status = String(value || "PENDING").toUpperCase();

  if (["APPROVED", "COMPLETED", "SUCCESS", "PAID", "ACTIVE"].includes(status)) return "good";
  if (["PENDING", "PROCESSING", "UNDER_REVIEW", "UNDER REVIEW", "WAITING"].includes(status)) return "warning";
  if (["REJECTED", "FAILED", "CANCELLED", "DECLINED"].includes(status)) return "bad";

  return "neutral";
}

function cleanType(value: string | null | undefined) {
  return String(value || "UNKNOWN").replaceAll("_", " ");
}

function peso(value: number) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}