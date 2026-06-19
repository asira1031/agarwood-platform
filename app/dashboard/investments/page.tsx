"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  membership_status: string | null;
  kyc_status: string | null;
};

type Wallet = {
  id: string;
  profile_id: string;
  balance: number | null;
};

type TreeRow = Record<string, any>;

type WalletTransaction = {
  id: string;
  transaction_type: string | null;
  amount: number | null;
  status: string | null;
  reference_no: string | null;
  description: string | null;
  created_at: string | null;
};

const INVESTMENT_EXPENSE_TYPES = [
  "MARKETPLACE_PURCHASE",
  "TREE_PURCHASE",
  "INVESTMENT_PURCHASE",
  "MEMBERSHIP",
  "MEMBERSHIP_PAYMENT",
];

const INVESTMENT_EARNING_TYPES = [
  "TREE_SALE",
  "SELL_TREE",
  "REFERRAL_BONUS",
  "ROI",
  "DIVIDEND",
  "EARNING",
];

export default function InvestmentsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadInvestments() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const email = user.email?.trim().toLowerCase() || "";

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, full_name, email, membership_status, kyc_status")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, full_name, email, membership_status, kyc_status")
      .eq("email", email)
      .maybeSingle();

    const currentProfile = profileById || profileByEmail;

    if (!currentProfile) {
      setMessage("Profile not found.");
      setLoading(false);
      return;
    }

    setProfile(currentProfile);

    const { data: walletRows } = await supabase
      .from("wallets")
      .select("id, profile_id, balance, created_at")
      .eq("profile_id", currentProfile.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const { data: treeData, error: treeError } = await supabase
      .from("trees")
      .select("*")
      .eq("profile_id", currentProfile.id)
      .order("created_at", { ascending: false });

    const { data: txData, error: txError } = await supabase
      .from("wallet_transactions")
      .select("id, transaction_type, amount, status, reference_no, description, created_at")
      .eq("profile_id", currentProfile.id)
      .order("created_at", { ascending: false });

    if (treeError) setMessage(treeError.message);
    if (txError) setMessage(txError.message);

    setWallet(walletRows?.[0] || null);
    setTrees(treeData || []);
    setTransactions(txData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadInvestments();
  }, []);

  const stats = useMemo(() => {
    const completed = transactions.filter(
      (item) => (item.status || "").toUpperCase() === "COMPLETED"
    );

    const totalInvested = completed
      .filter((item) =>
        INVESTMENT_EXPENSE_TYPES.includes((item.transaction_type || "").toUpperCase())
      )
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const totalReturns = completed
      .filter((item) =>
        INVESTMENT_EARNING_TYPES.includes((item.transaction_type || "").toUpperCase())
      )
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const marketplaceSpend = completed
      .filter((item) => (item.transaction_type || "").toUpperCase() === "MARKETPLACE_PURCHASE")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const treeSales = completed
      .filter((item) =>
        ["TREE_SALE", "SELL_TREE"].includes((item.transaction_type || "").toUpperCase())
      )
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const netGain = totalReturns - totalInvested;

    return {
      ownedTrees: trees.length,
      walletBalance: Number(wallet?.balance || 0),
      totalInvested,
      totalReturns,
      marketplaceSpend,
      treeSales,
      netGain,
    };
  }, [trees, wallet, transactions]);

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Agarwood Portfolio</p>
          <h1>Investments</h1>
          <span>
            Monitor your real wallet balance, owned trees, total invested amount,
            returns, and investment ledger from Supabase.
          </span>
        </div>

        <div className="heroActions">
          <button onClick={loadInvestments}>Refresh</button>
          <Link href="/dashboard/marketplace">Buy More Trees</Link>
          <Link href="/dashboard/wallet" className="primary">
            Wallet
          </Link>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      {loading ? (
        <div className="empty">Loading investment data...</div>
      ) : (
        <>
          <section className="cards">
            <Card icon="💳" label="Wallet Balance" value={peso(stats.walletBalance)} note="Latest wallet row" gold />
            <Card icon="🌳" label="Owned Trees" value={String(stats.ownedTrees)} note="Real trees table" />
            <Card icon="📥" label="Total Invested" value={peso(stats.totalInvested)} note="Purchases and investment costs" />
            <Card icon="📈" label="Total Returns" value={peso(stats.totalReturns)} note="Sales, ROI, referral, dividends" gold />
          </section>

          <section className="cards">
            <Card icon="🛒" label="Marketplace Spend" value={peso(stats.marketplaceSpend)} note="Completed marketplace purchases" />
            <Card icon="🌿" label="Tree Sale Returns" value={peso(stats.treeSales)} note="Completed tree sale payouts" />
            <Card
              icon={stats.netGain >= 0 ? "✅" : "⚠️"}
              label="Net Position"
              value={peso(stats.netGain)}
              note="Returns minus invested amount"
              gold={stats.netGain >= 0}
            />
            <Card
              icon="🎖️"
              label="Membership"
              value={profile?.membership_status || "UNKNOWN"}
              note={`KYC: ${profile?.kyc_status || "UNKNOWN"}`}
            />
          </section>

          <section className="grid">
            <div className="panel">
              <div className="panelHead">
                <div>
                  <h2>Owned Tree Portfolio</h2>
                  <p>Real owned trees from the trees table.</p>
                </div>
                <Link href="/dashboard/my-trees">View My Trees ›</Link>
              </div>

              {trees.length === 0 ? (
                <div className="empty small">
                  No owned trees yet. Buy trees from Marketplace to start your portfolio.
                </div>
              ) : (
                <div className="treeList">
                  {trees.slice(0, 10).map((tree) => (
                    <div className="treeRow" key={tree.id}>
                      <div>
                        <strong>{tree.tree_code || tree.code || tree.id}</strong>
                        <p>{tree.custom_name || tree.name || "Agarwood Tree"}</p>
                      </div>
                      <div>
                        <span>{tree.stage || tree.growth_stage || "Stage Pending"}</span>
                        <b>{peso(Number(tree.current_value || tree.tree_value || tree.purchase_price || 0))}</b>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel">
              <div className="panelHead">
                <div>
                  <h2>Investment Ledger</h2>
                  <p>Completed investment-related wallet transactions.</p>
                </div>
                <Link href="/dashboard/transactions">View All ›</Link>
              </div>

              {transactions.length === 0 ? (
                <div className="empty small">No wallet transactions yet.</div>
              ) : (
                <div className="ledgerList">
                  {transactions.slice(0, 12).map((item) => {
                    const type = (item.transaction_type || "").toUpperCase();
                    const isReturn = INVESTMENT_EARNING_TYPES.includes(type);
                    const isExpense = INVESTMENT_EXPENSE_TYPES.includes(type);

                    return (
                      <div className="ledgerRow" key={item.id}>
                        <div>
                          <strong>{cleanType(item.transaction_type)}</strong>
                          <p>{item.description || item.reference_no || "Wallet transaction"}</p>
                          <small>{formatDate(item.created_at)}</small>
                        </div>
                        <div className="right">
                          <span className={isReturn ? "return" : isExpense ? "expense" : "neutral"}>
                            {isReturn ? "Return" : isExpense ? "Investment" : "Other"}
                          </span>
                          <b>{peso(Number(item.amount || 0))}</b>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 22px;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #8c6a3c;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
          font-size: 12px;
        }

        .hero h1 {
          margin: 0;
          font-size: 44px;
          color: #101a14;
          letter-spacing: -1.6px;
        }

        .hero span {
          display: block;
          margin-top: 8px;
          color: #5f665e;
          max-width: 760px;
          line-height: 1.6;
        }

        .heroActions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .heroActions a,
        .heroActions button {
          border: 0;
          border-radius: 14px;
          padding: 13px 18px;
          background: rgba(255,253,246,.88);
          color: #244536;
          text-decoration: none;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 14px 30px rgba(82,60,27,.08);
        }

        .heroActions .primary {
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
        }

        .message,
        .empty,
        .card,
        .panel {
          border-radius: 26px;
          background: rgba(255,253,246,.88);
          border: 1px solid rgba(92,70,35,.08);
          box-shadow: 0 18px 42px rgba(82,60,27,.09);
        }

        .message,
        .empty {
          padding: 20px;
          margin-bottom: 18px;
          color: #31553d;
          font-weight: 900;
        }

        .small {
          box-shadow: none;
          border-radius: 18px;
          background: #f3ead8;
        }

        .cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 18px;
        }

        .card {
          min-height: 145px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .cardIcon {
          width: 66px;
          height: 66px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: radial-gradient(circle, #f5e8c9, #d9ccb0);
          font-size: 28px;
        }

        .cardIcon.gold {
          background: radial-gradient(circle, #fff2bc, #c9a34d);
        }

        .card p {
          margin: 0 0 8px;
          color: #5f665e;
          font-size: 13px;
          font-weight: 900;
        }

        .card h3 {
          margin: 0 0 8px;
          color: #101a14;
          font-size: 27px;
          letter-spacing: -1px;
        }

        .card small {
          color: #8c6a3c;
          font-weight: 900;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .panel {
          padding: 24px;
        }

        .panelHead {
          display: flex;
          justify-content: space-between;
          align-items: start;
          gap: 16px;
          margin-bottom: 18px;
        }

        .panelHead h2 {
          margin: 0;
          color: #101a14;
        }

        .panelHead p {
          margin: 6px 0 0;
          color: #6b6b62;
        }

        .panelHead a {
          color: #31553d;
          font-weight: 900;
          text-decoration: none;
          white-space: nowrap;
        }

        .treeList,
        .ledgerList {
          display: grid;
          gap: 12px;
        }

        .treeRow,
        .ledgerRow {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 16px;
          align-items: center;
          border-radius: 18px;
          background: #f3ead8;
          border: 1px solid rgba(92,70,35,.08);
          padding: 16px;
        }

        .treeRow strong,
        .ledgerRow strong {
          color: #101a14;
          font-size: 16px;
        }

        .treeRow p,
        .ledgerRow p {
          margin: 6px 0 0;
          color: #6b6b62;
          font-size: 13px;
          font-weight: 800;
        }

        .ledgerRow small {
          display: block;
          margin-top: 5px;
          color: #8c6a3c;
          font-weight: 900;
        }

        .treeRow div:last-child,
        .right {
          display: grid;
          justify-items: end;
          gap: 8px;
        }

        .treeRow span,
        .right span {
          border-radius: 999px;
          padding: 8px 10px;
          font-size: 11px;
          font-weight: 900;
          background: rgba(107,107,98,.12);
          color: #6b6b62;
        }

        .right span.return {
          background: rgba(49,85,61,.12);
          color: #31553d;
        }

        .right span.expense {
          background: rgba(163,60,42,.12);
          color: #a33c2a;
        }

        .treeRow b,
        .right b {
          color: #244536;
        }

        @media (max-width: 1200px) {
          .cards {
            grid-template-columns: repeat(2, 1fr);
          }

          .grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .page {
            padding: 18px;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
          }

          .cards,
          .treeRow,
          .ledgerRow {
            grid-template-columns: 1fr;
          }

          .treeRow div:last-child,
          .right {
            justify-items: start;
          }

          .hero h1 {
            font-size: 34px;
          }
        }
      `}</style>
    </main>
  );
}

function Card({
  icon,
  label,
  value,
  note,
  gold,
}: {
  icon: string;
  label: string;
  value: string;
  note: string;
  gold?: boolean;
}) {
  return (
    <div className="card">
      <div className={`cardIcon ${gold ? "gold" : ""}`}>{icon}</div>
      <div>
        <p>{label}</p>
        <h3>{value}</h3>
        <small>{note}</small>
      </div>
    </div>
  );
}

function peso(value: number) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function cleanType(value: string | null) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}