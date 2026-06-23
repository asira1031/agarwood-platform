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

type WalletTransaction = {
  id: string;
  transaction_type: string | null;
  amount: number | null;
  reference_no: string | null;
  description: string | null;
  status: string | null;
  created_at: string | null;
};

type SellTreeRequest = {
  id: string;
  profile_id: string | null;
  tree_id: string | null;
  tree_value: number | null;
  platform_fee: number | null;
  net_receive: number | null;
  status: string | null;
  admin_notes: string | null;
  created_at: string | null;
  approved_value: number | null;
  approved_at: string | null;
  rejected_at: string | null;
};

type WithdrawalRequest = {
  id: string;
  profile_id: string | null;
  amount: number | null;
  processing_fee: number | null;
  net_receive: number | null;
  status: string | null;
  created_at: string | null;
};

const POSITIVE_EARNING_TYPES = [
  "TREE_SALE",
  "SELL_TREE",
  "SELL_TREE_PAYOUT",
  "REFERRAL_BONUS",
  "BONUS",
  "PAYOUT",
  "EARNING",
];

export default function EarningsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [sellRequests, setSellRequests] = useState<SellTreeRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

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
      .select("id, full_name, email, membership_status, kyc_status")
      .eq("id", user.id)
      .maybeSingle();

    let profileByEmail: Profile | null = null;

    if (email) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, membership_status, kyc_status")
        .eq("email", email)
        .maybeSingle();

      profileByEmail = data as Profile | null;
    }

    return (profileById || profileByEmail) as Profile | null;
  }

  async function loadEarnings() {
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
      const profileId = currentProfile.id;

      const [walletResult, txResult, sellResult, withdrawalResult] = await Promise.all([
        supabase
          .from("wallets")
          .select("id, profile_id, balance")
          .eq("profile_id", profileId)
          .order("created_at", { ascending: false })
          .limit(1),

        supabase
          .from("wallet_transactions")
          .select("id, transaction_type, amount, reference_no, description, status, created_at")
          .eq("profile_id", profileId)
          .order("created_at", { ascending: false }),

        supabase
          .from("sell_tree_requests")
          .select("id, profile_id, tree_id, tree_value, platform_fee, net_receive, status, admin_notes, created_at, approved_value, approved_at, rejected_at")
          .eq("profile_id", profileId)
          .order("created_at", { ascending: false }),

        supabase
          .from("withdrawal_requests")
          .select("id, profile_id, amount, processing_fee, net_receive, status, created_at")
          .eq("profile_id", profileId)
          .order("created_at", { ascending: false }),
      ]);

      if (txResult.error) throw txResult.error;

      setWallet(walletResult.error ? null : ((walletResult.data?.[0] as Wallet) || null));
      setTransactions((txResult.data as WalletTransaction[]) || []);
      setSellRequests(sellResult.error ? [] : ((sellResult.data as SellTreeRequest[]) || []));
      setWithdrawals(withdrawalResult.error ? [] : ((withdrawalResult.data as WithdrawalRequest[]) || []));
    } catch (error: any) {
      console.error("Forest earnings load error:", error);
      setMessage(error?.message || "Failed to load Forest Earnings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEarnings();
  }, []);

  const earnings = useMemo(() => {
    const completedCredits = transactions.filter((item) => {
      const type = String(item.transaction_type || "").toUpperCase();
      const status = String(item.status || "").toUpperCase();

      return (
        ["COMPLETED", "APPROVED", "SUCCESS", "PAID"].includes(status) &&
        POSITIVE_EARNING_TYPES.some((earningType) => type.includes(earningType))
      );
    });

    const pendingCredits = transactions.filter((item) => {
      const type = String(item.transaction_type || "").toUpperCase();
      const status = String(item.status || "").toUpperCase();

      return (
        ["PENDING", "PROCESSING", "UNDER_REVIEW", "UNDER REVIEW", "WAITING"].includes(status) &&
        POSITIVE_EARNING_TYPES.some((earningType) => type.includes(earningType))
      );
    });

    const treeSalePayouts = completedCredits
      .filter((item) => {
        const type = String(item.transaction_type || "").toUpperCase();
        return type.includes("TREE_SALE") || type.includes("SELL_TREE") || type.includes("PAYOUT");
      })
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const referralBonuses = completedCredits
      .filter((item) => String(item.transaction_type || "").toUpperCase().includes("REFERRAL"))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const completedEarnings = completedCredits.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const pendingEarnings = pendingCredits.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const pendingSellPayouts = sellRequests
      .filter((item) => ["PENDING", "PROCESSING", "OFFER_SENT", "CUSTOMER_ACCEPTED"].includes(String(item.status || "").toUpperCase()))
      .reduce((sum, item) => sum + Number(item.net_receive || item.approved_value || item.tree_value || 0), 0);

    const completedSellPayouts = sellRequests
      .filter((item) => ["COMPLETED", "APPROVED", "PAID"].includes(String(item.status || "").toUpperCase()))
      .reduce((sum, item) => sum + Number(item.net_receive || item.approved_value || item.tree_value || 0), 0);

    const totalWithdrawn = withdrawals
      .filter((item) => ["APPROVED", "COMPLETED", "PAID"].includes(String(item.status || "").toUpperCase()))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      completedCredits,
      pendingCredits,
      completedEarnings,
      pendingEarnings,
      treeSalePayouts,
      referralBonuses,
      pendingSellPayouts,
      completedSellPayouts,
      totalWithdrawn,
    };
  }, [transactions, sellRequests, withdrawals]);

  const walletBalance = Number(wallet?.balance || 0);
  const membershipStatus = profile?.membership_status || "UNKNOWN";
  const kycStatus = profile?.kyc_status || "UNKNOWN";

  return (
    <main className="earningsPage">
      <section className="hero">
        <div>
          <p className="eyebrow">Real Customer Revenue</p>
          <h1>Forest Earnings</h1>
          <span>
            Earnings are based only on real completed wallet credits and real sell tree payout records.
            This page does not invent ROI, dividends, or static revenue.
          </span>
        </div>

        <div className="heroActions">
          <button type="button" onClick={loadEarnings}>Refresh</button>
          <Link href="/dashboard/sell-tree">Sell Tree</Link>
          <Link href="/dashboard/wallet">Forest Wallet</Link>
        </div>
      </section>

      {message && <div className="messageBox">{message}</div>}

      {loading ? (
        <div className="loadingBox">Loading Forest Earnings...</div>
      ) : (
        <>
          <section className="cards">
            <SummaryCard label="Completed Earnings" value={peso(earnings.completedEarnings)} note="Completed positive wallet credits" gold />
            <SummaryCard label="Pending Earnings" value={peso(earnings.pendingEarnings + earnings.pendingSellPayouts)} note="Pending wallet credits + pending sell payouts" />
            <SummaryCard label="Tree Sale Payouts" value={peso(earnings.treeSalePayouts + earnings.completedSellPayouts)} note="Real sell tree payout records" />
            <SummaryCard label="Referral Bonuses" value={peso(earnings.referralBonuses)} note="Only if recorded in wallet ledger" />
          </section>

          <section className="cards second">
            <SummaryCard label="Available Forest Balance" value={peso(walletBalance)} note="Latest wallet balance" gold />
            <SummaryCard label="Total Withdrawn" value={peso(earnings.totalWithdrawn)} note="Approved/completed withdrawals" />
            <SummaryCard label="Membership" value={membershipStatus} note="Customer access status" />
            <SummaryCard label="KYC" value={kycStatus} note="Verification status" />
          </section>

          <section className="grid">
            <div className="panel bigPanel">
              <div className="panelHead">
                <div>
                  <h2>Forest Revenue Center</h2>
                  <p>
                    Completed Earnings, Pending Earnings, and Completed Credits are read from real data only.
                  </p>
                </div>

                <Link href="/dashboard/transactions">View Forest Ledger ›</Link>
              </div>

              {earnings.completedCredits.length === 0 && earnings.pendingCredits.length === 0 ? (
                <EmptyState message="No earning wallet credits yet. Tree sale payouts and referral bonuses will appear here once recorded." />
              ) : (
                <div className="earningList">
                  {[...earnings.completedCredits, ...earnings.pendingCredits].map((item) => (
                    <article className="earningRow" key={item.id}>
                      <div>
                        <strong>{friendlyEarning(item.transaction_type)}</strong>
                        <p>{item.description || "Forest earning credit"}</p>
                        <small>{friendlyReference(item.reference_no)} • {formatDate(item.created_at)}</small>
                      </div>

                      <div>
                        <b>{peso(Number(item.amount || 0))}</b>
                        <span className={`status ${statusClass(item.status)}`}>{cleanType(item.status)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <aside className="panel sidePanel">
              <h2>Account Readiness</h2>

              <div className={`rule ${membershipStatus === "ACTIVE" ? "ok" : "warning"}`}>
                <span>{membershipStatus === "ACTIVE" ? "✓" : "!"}</span>
                <div>
                  <strong>Membership Status</strong>
                  <p>{membershipStatus}</p>
                </div>
              </div>

              <div className={`rule ${kycStatus === "APPROVED" ? "ok" : "warning"}`}>
                <span>{kycStatus === "APPROVED" ? "✓" : "!"}</span>
                <div>
                  <strong>KYC Status</strong>
                  <p>{kycStatus}</p>
                </div>
              </div>

              <div className="goldBox">
                <p>Completed Earnings</p>
                <strong>{peso(earnings.completedEarnings)}</strong>
                <small>No fake ROI included.</small>
              </div>

              <div className="goldBox muted">
                <p>Pending Payouts</p>
                <strong>{peso(earnings.pendingEarnings + earnings.pendingSellPayouts)}</strong>
                <small>Waiting for completion or payout.</small>
              </div>
            </aside>
          </section>

          <section className="lowerGrid">
            <div className="panel">
              <div className="panelHead">
                <div>
                  <h2>Sell Tree Payout Requests</h2>
                  <p>Real records from sell_tree_requests.</p>
                </div>
              </div>

              {sellRequests.length === 0 ? (
                <EmptyState message="No sell tree payout requests yet." />
              ) : (
                <div className="requestList">
                  {sellRequests.map((item) => (
                    <article className="requestCard" key={item.id}>
                      <div>
                        <strong>{friendlyTreeRef(item.tree_id)}</strong>
                        <p>Tree Value: {peso(Number(item.tree_value || 0))}</p>
                        <p>Platform Fee: {peso(Number(item.platform_fee || 0))}</p>
                      </div>

                      <div>
                        <span className={`status ${statusClass(item.status)}`}>{cleanType(item.status)}</span>
                        <b>{peso(Number(item.net_receive || item.approved_value || item.tree_value || 0))}</b>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="panel">
              <div className="panelHead">
                <div>
                  <h2>Withdrawal History</h2>
                  <p>Real records from withdrawal_requests.</p>
                </div>
              </div>

              {withdrawals.length === 0 ? (
                <EmptyState message="No withdrawal records yet." />
              ) : (
                <div className="requestList">
                  {withdrawals.map((item) => (
                    <article className="requestCard" key={item.id}>
                      <div>
                        <strong>{peso(Number(item.amount || 0))}</strong>
                        <p>Processing Fee: {peso(Number(item.processing_fee || 0))}</p>
                        <p>Net Receive: {peso(Number(item.net_receive || 0))}</p>
                      </div>

                      <div>
                        <span className={`status ${statusClass(item.status)}`}>{cleanType(item.status)}</span>
                        <b>{formatDate(item.created_at)}</b>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <style>{`
        * { box-sizing: border-box; }

        .earningsPage {
          min-height: 100vh;
          padding: 28px;
          color: #f6f1df;
          font-family: Arial, Helvetica, sans-serif;
          background:
            radial-gradient(circle at 18% 0%, rgba(230, 187, 92, .20), transparent 28%),
            radial-gradient(circle at 86% 10%, rgba(42, 120, 78, .30), transparent 30%),
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
        .loadingBox,
        .messageBox {
          border: 1px solid rgba(230, 187, 92, .22);
          background: rgba(255, 255, 255, .07);
          box-shadow: 0 24px 70px rgba(0, 0, 0, .35);
          backdrop-filter: blur(18px);
        }

        .hero > div:first-child {
          flex: 1;
          border-radius: 30px;
          padding: 28px;
          position: relative;
          overflow: hidden;
        }

        .hero > div:first-child:before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(120deg, rgba(230, 187, 92, .16), transparent 42%),
            repeating-linear-gradient(135deg, rgba(255,255,255,.025) 0 1px, transparent 1px 18px);
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
          width: 260px;
          border-radius: 30px;
          padding: 20px;
          display: grid;
          gap: 10px;
          align-content: center;
        }

        .heroActions a,
        .heroActions button,
        .panelHead a {
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
        .heroActions button:hover,
        .panelHead a:hover {
          background: rgba(216, 180, 95, .16);
          border-color: rgba(216, 180, 95, .58);
        }

        .loadingBox,
        .messageBox {
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 18px;
        }

        .messageBox {
          color: #f1cf7a;
          border-color: rgba(241, 207, 122, .36);
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

        .card.gold {
          background:
            linear-gradient(135deg, rgba(216, 180, 95, .20), rgba(255,255,255,.06)),
            rgba(255,255,255,.07);
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

        .card.gold strong {
          color: #f1cf7a;
        }

        .card small {
          display: block;
          margin-top: 8px;
          color: rgba(246, 241, 223, .54);
          line-height: 1.45;
        }

        .grid {
          display: grid;
          grid-template-columns: 1.6fr .8fr;
          gap: 16px;
          margin-bottom: 16px;
        }

        .lowerGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
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

        .panelHead h2,
        .sidePanel h2 {
          margin: 0;
          color: #fff8dc;
        }

        .panelHead p {
          margin: 6px 0 0;
          color: rgba(246, 241, 223, .62);
          line-height: 1.5;
        }

        .earningList,
        .requestList {
          display: grid;
          gap: 12px;
        }

        .earningRow,
        .requestCard {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          border: 1px solid rgba(255,255,255,.09);
          background: rgba(0,0,0,.20);
          border-radius: 22px;
          padding: 16px;
        }

        .earningRow strong,
        .requestCard strong {
          color: #fff8dc;
        }

        .earningRow p,
        .requestCard p {
          margin: 6px 0;
          color: rgba(246, 241, 223, .62);
        }

        .earningRow small {
          color: rgba(246, 241, 223, .48);
        }

        .earningRow > div:last-child,
        .requestCard > div:last-child {
          text-align: right;
          flex: 0 0 auto;
        }

        .earningRow b,
        .requestCard b {
          display: block;
          color: #f1cf7a;
          margin-top: 8px;
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

        .rule,
        .goldBox {
          border: 1px solid rgba(255,255,255,.09);
          background: rgba(0,0,0,.20);
          border-radius: 22px;
          padding: 16px;
          margin-top: 12px;
        }

        .rule {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .rule span {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 14px;
          font-weight: 1000;
        }

        .rule.ok span {
          background: rgba(74, 222, 128, .16);
          color: #86efac;
        }

        .rule.warning span {
          background: rgba(251, 191, 36, .16);
          color: #fde68a;
        }

        .rule strong,
        .goldBox strong {
          color: #fff8dc;
        }

        .rule p,
        .goldBox p,
        .goldBox small {
          margin: 6px 0 0;
          color: rgba(246, 241, 223, .62);
        }

        .goldBox strong {
          display: block;
          color: #f1cf7a;
          font-size: 24px;
          margin-top: 8px;
        }

        .goldBox.muted strong {
          color: #fde68a;
        }

        .emptyState {
          border: 1px dashed rgba(216, 180, 95, .28);
          border-radius: 22px;
          padding: 24px;
          color: rgba(246, 241, 223, .62);
          text-align: center;
        }

        @media (max-width: 1100px) {
          .hero,
          .grid,
          .lowerGrid {
            grid-template-columns: 1fr;
            display: grid;
          }

          .heroActions {
            width: 100%;
          }

          .cards {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .earningsPage {
            padding: 18px;
          }

          .cards {
            grid-template-columns: 1fr;
          }

          .panelHead,
          .earningRow,
          .requestCard {
            flex-direction: column;
          }

          .earningRow > div:last-child,
          .requestCard > div:last-child {
            text-align: left;
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
  gold,
}: {
  label: string;
  value: string;
  note: string;
  gold?: boolean;
}) {
  return (
    <article className={`card ${gold ? "gold" : ""}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="emptyState">{message}</div>;
}

function friendlyEarning(value: string | null | undefined) {
  const type = String(value || "EARNING").toUpperCase();

  if (type.includes("TREE_SALE") || type.includes("SELL_TREE") || type.includes("PAYOUT")) return "Tree Sale Payout";
  if (type.includes("REFERRAL")) return "Referral Bonus";
  if (type.includes("BONUS")) return "Forest Bonus";
  if (type.includes("EARNING")) return "Forest Earning";

  return cleanType(type);
}

function friendlyReference(value: string | null | undefined) {
  if (!value) return "No reference";
  if (value.length > 18) return `Reference ${value.slice(0, 8)}…${value.slice(-4)}`;
  return `Reference ${value}`;
}

function friendlyTreeRef(value: string | null | undefined) {
  if (!value) return "Tree payout request";
  if (value.length > 18) return `Tree ${value.slice(0, 8)}…${value.slice(-4)}`;
  return `Tree ${value}`;
}

function statusClass(value: string | null | undefined) {
  const status = String(value || "PENDING").toUpperCase();

  if (["APPROVED", "COMPLETED", "SUCCESS", "PAID", "ACTIVE"].includes(status)) return "good";
  if (["PENDING", "PROCESSING", "UNDER_REVIEW", "UNDER REVIEW", "WAITING", "OFFER_SENT", "CUSTOMER_ACCEPTED"].includes(status)) return "warning";
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