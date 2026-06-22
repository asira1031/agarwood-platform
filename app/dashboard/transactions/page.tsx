"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type WalletTransaction = Record<string, any>;
type SellTreeRequest = Record<string, any>;
type WithdrawalRequest = Record<string, any>;
type CashInRequest = Record<string, any>;
type MembershipOrder = Record<string, any>;
type OperationRequest = Record<string, any>;

type LedgerEntry = {
  id: string;
  source: string;
  title: string;
  description: string;
  amount: number;
  direction: "CREDIT" | "DEBIT" | "NEUTRAL";
  status: string;
  date: string | null;
  reference?: string | null;
};

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

function normalizeStatus(value: any) {
  return String(value || "PENDING").trim().toUpperCase();
}

function normalizeType(value: any) {
  return String(value || "TRANSACTION")
    .replaceAll("_", " ")
    .trim()
    .toUpperCase();
}

function getDirectionFromWalletTx(tx: WalletTransaction): "CREDIT" | "DEBIT" | "NEUTRAL" {
  const type = normalizeType(tx.transaction_type || tx.type || tx.category);
  const amount = Number(tx.amount || 0);

  if (type.includes("CREDIT") || type.includes("CASH IN") || type.includes("ADD FUND") || amount > 0) {
    return "CREDIT";
  }

  if (
    type.includes("DEBIT") ||
    type.includes("WITHDRAW") ||
    type.includes("PURCHASE") ||
    type.includes("PAYMENT") ||
    type.includes("MEMBERSHIP") ||
    amount < 0
  ) {
    return "DEBIT";
  }

  return "NEUTRAL";
}

function signedAmount(amount: number, direction: "CREDIT" | "DEBIT" | "NEUTRAL") {
  const value = Math.abs(Number(amount || 0));
  if (direction === "DEBIT") return -value;
  if (direction === "CREDIT") return value;
  return Number(amount || 0);
}

export default function TransactionsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [sellRequests, setSellRequests] = useState<SellTreeRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [cashIns, setCashIns] = useState<CashInRequest[]>([]);
  const [membershipOrders, setMembershipOrders] = useState<MembershipOrder[]>([]);
  const [operationRequests, setOperationRequests] = useState<OperationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"ALL" | "CREDIT" | "DEBIT" | "PENDING">("ALL");

  async function getCurrentProfile() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) {
      window.location.href = "/login";
      return null;
    }

    const email = user.email?.trim() || "";
    const lowerEmail = email.toLowerCase();

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", email)
      .maybeSingle();

    const { data: profileByLowerEmail } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", lowerEmail)
      .maybeSingle();

    const { data: profileByIlike } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .ilike("email", email)
      .maybeSingle();

    return (profileById || profileByEmail || profileByLowerEmail || profileByIlike) as Profile | null;
  }

  async function loadTransactions() {
    setLoading(true);
    setMessage("");

    try {
      const currentProfile = await getCurrentProfile();

      if (!currentProfile) {
        setMessage("Profile not found.");
        setLoading(false);
        return;
      }

      setProfile(currentProfile);
      const profileId = currentProfile.id;

      const [walletTxResult, sellResult, withdrawalResult, cashInResult, membershipResult, operationsResult] =
        await Promise.all([
          supabase
            .from("wallet_transactions")
            .select("*")
            .eq("profile_id", profileId)
            .order("created_at", { ascending: false }),
          supabase
            .from("sell_tree_requests")
            .select("*")
            .eq("profile_id", profileId)
            .order("created_at", { ascending: false }),
          supabase
            .from("withdrawal_requests")
            .select("*")
            .eq("profile_id", profileId)
            .order("created_at", { ascending: false }),
          supabase
            .from("cashin_requests")
            .select("*")
            .eq("profile_id", profileId)
            .order("created_at", { ascending: false }),
          supabase
            .from("membership_orders")
            .select("*")
            .eq("profile_id", profileId)
            .order("created_at", { ascending: false }),
          supabase
            .from("tree_operation_requests")
            .select("*")
            .eq("profile_id", profileId)
            .order("created_at", { ascending: false }),
        ]);

      if (walletTxResult.error) throw walletTxResult.error;

      setWalletTransactions(walletTxResult.data || []);
      setSellRequests(sellResult.error ? [] : sellResult.data || []);
      setWithdrawals(withdrawalResult.error ? [] : withdrawalResult.data || []);
      setCashIns(cashInResult.error ? [] : cashInResult.data || []);
      setMembershipOrders(membershipResult.error ? [] : membershipResult.data || []);
      setOperationRequests(operationsResult.error ? [] : operationsResult.data || []);
    } catch (error: any) {
      setMessage(error?.message || "Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTransactions();
  }, []);

  const ledger = useMemo<LedgerEntry[]>(() => {
    const rows: LedgerEntry[] = [];

    walletTransactions.forEach((tx) => {
      const direction = getDirectionFromWalletTx(tx);
      const amount = signedAmount(Number(tx.amount || 0), direction);
      const type = normalizeType(tx.transaction_type || tx.type || tx.category);

      rows.push({
        id: `wallet-${tx.id}`,
        source: "Wallet Transactions",
        title: type,
        description: tx.description || tx.note || "Wallet movement",
        amount,
        direction,
        status: normalizeStatus(tx.status),
        date: tx.created_at,
        reference: tx.reference_no || tx.reference_id || tx.id,
      });
    });

    cashIns.forEach((item) => {
      rows.push({
        id: `cashin-${item.id}`,
        source: "Add Funds / Cash-In",
        title: "ADD FUNDS",
        description: item.method || item.reference_no || item.reference || "Cash-in request",
        amount: Math.abs(Number(item.amount || 0)),
        direction: "CREDIT",
        status: normalizeStatus(item.status),
        date: item.created_at,
        reference: item.reference_no || item.reference || item.id,
      });
    });

    withdrawals.forEach((item) => {
      rows.push({
        id: `withdraw-${item.id}`,
        source: "Cash-Out / Withdrawal",
        title: "CASH OUT",
        description: `Fee: ${peso(Number(item.processing_fee || 0))} • Net: ${peso(Number(item.net_receive || 0))}`,
        amount: -Math.abs(Number(item.amount || 0)),
        direction: "DEBIT",
        status: normalizeStatus(item.status),
        date: item.created_at,
        reference: item.reference_no || item.id,
      });
    });

    membershipOrders.forEach((item) => {
      rows.push({
        id: `membership-${item.id}`,
        source: "Membership",
        title: "MEMBERSHIP PAYMENT",
        description: `Payment: ${normalizeStatus(item.payment_status)} • Plan: ${item.plan_id || "Plan"}`,
        amount: -Math.abs(Number(item.amount || 0)),
        direction: "DEBIT",
        status: normalizeStatus(item.status || item.payment_status),
        date: item.created_at,
        reference: item.id,
      });
    });

    operationRequests.forEach((item) => {
      const amount = Number(item.total_amount || item.care_program_price || item.operation_fee || 0);
      rows.push({
        id: `operation-${item.id}`,
        source: "Tree Operations",
        title: normalizeType(item.care_program_name || item.operation_type || "TREE OPERATION"),
        description: item.notes || item.tree_id || "Tree care/service request",
        amount: -Math.abs(amount),
        direction: amount > 0 ? "DEBIT" : "NEUTRAL",
        status: normalizeStatus(item.status || item.care_program_status),
        date: item.created_at,
        reference: item.id,
      });
    });

    sellRequests.forEach((item) => {
      rows.push({
        id: `sell-${item.id}`,
        source: "Sell Tree",
        title: "SELL TREE REQUEST",
        description: `Value: ${peso(Number(item.tree_value || 0))} • Fee: ${peso(Number(item.platform_fee || 0))}`,
        amount: Math.abs(Number(item.net_receive || 0)),
        direction: "CREDIT",
        status: normalizeStatus(item.status),
        date: item.created_at,
        reference: item.tree_id || item.id,
      });
    });

    const seen = new Set<string>();
    return rows
      .filter((row) => {
        const key = `${row.source}-${row.reference}-${row.title}-${row.amount}-${row.date}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [walletTransactions, cashIns, withdrawals, membershipOrders, operationRequests, sellRequests]);

  const filteredLedger = useMemo(() => {
    if (filter === "ALL") return ledger;
    if (filter === "PENDING") {
      return ledger.filter((item) => ["PENDING", "PROCESSING", "WAITING"].includes(item.status));
    }
    return ledger.filter((item) => item.direction === filter);
  }, [ledger, filter]);

  const stats = useMemo(() => {
    const credits = ledger
      .filter((item) => item.direction === "CREDIT")
      .reduce((sum, item) => sum + Math.abs(item.amount), 0);

    const debits = ledger
      .filter((item) => item.direction === "DEBIT")
      .reduce((sum, item) => sum + Math.abs(item.amount), 0);

    const pending = ledger.filter((item) => ["PENDING", "PROCESSING", "WAITING"].includes(item.status)).length;

    return {
      total: ledger.length,
      credits,
      debits,
      net: credits - debits,
      pending,
    };
  }, [ledger]);

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Arganwood Synced Ledger</p>
          <h1>Transactions</h1>
          <span>
            All money movement from wallet transactions, marketplace purchases, tree operations,
            membership, add funds, cash-out, and sell tree requests.
          </span>
        </div>

        <div className="heroActions">
          <Link href="/dashboard/wallet">Wallet</Link>
          <Link href="/dashboard/marketplace" className="primary">Marketplace</Link>
          <button type="button" onClick={loadTransactions}>Refresh</button>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      {loading ? (
        <div className="empty">Loading transactions...</div>
      ) : (
        <>
          <section className="cards">
            <SummaryCard icon="🧾" label="Records" value={String(stats.total)} note="Combined ledger" />
            <SummaryCard icon="⬆️" label="Credits" value={peso(stats.credits)} note="Add funds / sell tree" good />
            <SummaryCard icon="⬇️" label="Debits" value={peso(stats.debits)} note="Purchases / payments" bad />
            <SummaryCard icon="⏳" label="Pending" value={String(stats.pending)} note="Waiting / processing" />
          </section>

          <section className="filters">
            {(["ALL", "CREDIT", "DEBIT", "PENDING"] as const).map((item) => (
              <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>
                {item}
              </button>
            ))}
          </section>

          <section className="panel">
            <div className="panelHead">
              <div>
                <h2>Unified Transaction Ledger</h2>
                <p>Profile: {profile?.email || "Customer"}</p>
              </div>
              <strong className={stats.net >= 0 ? "netGood" : "netBad"}>Net {peso(stats.net)}</strong>
            </div>

            {filteredLedger.length === 0 ? (
              <div className="empty small">No transactions found for this filter.</div>
            ) : (
              <div className="ledgerList">
                {filteredLedger.map((item) => (
                  <article className="ledgerRow" key={item.id}>
                    <div className={`direction ${item.direction.toLowerCase()}`}>
                      {item.direction === "CREDIT" ? "+" : item.direction === "DEBIT" ? "−" : "•"}
                    </div>

                    <div className="ledgerMain">
                      <div className="titleLine">
                        <strong>{item.title}</strong>
                        <span>{item.source}</span>
                      </div>
                      <p>{item.description}</p>
                      <small>Ref: {item.reference || "—"} • {formatDate(item.date)}</small>
                    </div>

                    <div className="ledgerRight">
                      <b className={item.direction === "CREDIT" ? "amountCredit" : item.direction === "DEBIT" ? "amountDebit" : ""}>
                        {item.direction === "CREDIT" ? "+" : item.direction === "DEBIT" ? "-" : ""}{peso(Math.abs(item.amount))}
                      </b>
                      <span className={`status ${item.status.toLowerCase()}`}>{item.status}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <style>{`
        * { box-sizing: border-box; }
        .page {
          min-height: 100vh;
          padding: 30px;
          color: #18261d;
          font-family: Arial, Helvetica, sans-serif;
          background:
            radial-gradient(circle at 18% 5%, rgba(255, 226, 154, .55), transparent 24%),
            radial-gradient(circle at 92% 8%, rgba(255,255,255,.72), transparent 28%),
            linear-gradient(180deg, #f8f4eb 0%, #f3eadb 52%, #eadcc3 100%);
        }
        .hero { display:flex; justify-content:space-between; gap:18px; align-items:flex-start; margin-bottom:22px; }
        .eyebrow { margin:0 0 8px; color:#8c6a3c; font-weight:900; text-transform:uppercase; letter-spacing:.12em; font-size:12px; }
        h1 { margin:0; font-size:44px; color:#101a14; letter-spacing:-1.6px; }
        .hero span { display:block; margin-top:8px; color:#5f665e; max-width:850px; line-height:1.6; font-weight:700; }
        .heroActions { display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
        .heroActions a, .heroActions button { border:0; border-radius:16px; padding:13px 17px; background:rgba(255,253,246,.9); color:#244536; font-weight:900; text-decoration:none; cursor:pointer; box-shadow:0 14px 30px rgba(82,60,27,.08); }
        .heroActions .primary { background:linear-gradient(135deg,#244536,#10281f); color:white; }
        .message, .empty, .summaryCard, .filters, .panel { border-radius:26px; background:rgba(255,253,246,.88); border:1px solid rgba(92,70,35,.08); box-shadow:0 18px 42px rgba(82,60,27,.09); }
        .message, .empty { padding:20px; margin-bottom:18px; color:#31553d; font-weight:900; }
        .small { box-shadow:none; background:#f3ead8; border-radius:18px; }
        .cards { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:18px; }
        .summaryCard { padding:22px; display:flex; gap:16px; align-items:center; }
        .summaryIcon { width:58px; height:58px; border-radius:20px; background:#f3ead8; display:grid; place-items:center; font-size:26px; }
        .summaryCard p { margin:0; color:#6b6b62; font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:.1em; }
        .summaryCard h3 { margin:7px 0; color:#244536; font-size:25px; }
        .summaryCard small { color:#8c6a3c; font-weight:900; }
        .summaryCard.good h3 { color:#31553d; }
        .summaryCard.bad h3 { color:#a33c2a; }
        .filters { display:flex; gap:10px; padding:12px; margin-bottom:18px; }
        .filters button { flex:1; border:0; border-radius:999px; padding:13px 14px; background:#f3ead8; color:#244536; font-weight:900; cursor:pointer; }
        .filters button.active { background:linear-gradient(135deg,#244536,#10281f); color:white; }
        .panel { padding:24px; }
        .panelHead { display:flex; justify-content:space-between; gap:18px; align-items:flex-start; margin-bottom:18px; }
        .panelHead h2 { margin:0; font-size:24px; color:#101a14; }
        .panelHead p { margin:6px 0 0; color:#6b6b62; font-weight:800; }
        .netGood { color:#31553d; } .netBad { color:#a33c2a; }
        .ledgerList { display:grid; gap:12px; }
        .ledgerRow { display:grid; grid-template-columns:54px 1fr auto; gap:14px; align-items:center; padding:16px; border-radius:22px; background:#f3ead8; border:1px solid rgba(92,70,35,.08); }
        .direction { width:48px; height:48px; border-radius:18px; display:grid; place-items:center; font-size:28px; font-weight:900; background:rgba(36,69,54,.12); color:#244536; }
        .direction.credit { background:rgba(49,85,61,.14); color:#31553d; }
        .direction.debit { background:rgba(163,60,42,.12); color:#a33c2a; }
        .titleLine { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
        .titleLine strong { color:#101a14; font-size:16px; }
        .titleLine span { padding:6px 9px; border-radius:999px; background:rgba(255,253,246,.85); color:#8c6a3c; font-size:11px; font-weight:900; }
        .ledgerMain p { margin:6px 0; color:#5f665e; font-weight:700; }
        .ledgerMain small { color:#8c6a3c; font-weight:900; }
        .ledgerRight { display:grid; justify-items:end; gap:8px; }
        .ledgerRight b { font-size:17px; color:#244536; }
        .amountCredit { color:#31553d !important; } .amountDebit { color:#a33c2a !important; }
        .status { display:inline-flex; align-items:center; justify-content:center; min-width:94px; padding:8px 10px; border-radius:999px; font-size:11px; font-weight:900; background:rgba(36,69,54,.10); color:#244536; }
        .status.completed, .status.approved, .status.paid, .status.active { background:rgba(49,85,61,.12); color:#31553d; }
        .status.pending, .status.processing, .status.waiting { background:rgba(214,178,94,.20); color:#8c6a3c; }
        .status.rejected, .status.failed, .status.cancelled { background:rgba(163,60,42,.12); color:#a33c2a; }
        @media (max-width: 1100px) { .cards { grid-template-columns:repeat(2,1fr); } .hero { flex-direction:column; } .heroActions { justify-content:flex-start; } }
        @media (max-width: 720px) { .page { padding:18px; } h1 { font-size:34px; } .cards { grid-template-columns:1fr; } .filters { display:grid; grid-template-columns:repeat(2,1fr); } .ledgerRow { grid-template-columns:1fr; } .ledgerRight { justify-items:start; } }
      `}</style>
    </main>
  );
}

function SummaryCard({ icon, label, value, note, good, bad }: { icon: string; label: string; value: string; note: string; good?: boolean; bad?: boolean }) {
  return (
    <article className={`summaryCard ${good ? "good" : ""} ${bad ? "bad" : ""}`}>
      <div className="summaryIcon">{icon}</div>
      <div>
        <p>{label}</p>
        <h3>{value}</h3>
        <small>{note}</small>
      </div>
    </article>
  );
}
