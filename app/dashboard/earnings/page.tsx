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
  profile_id: string;
  transaction_type: string | null;
  amount: number | null;
  status: string | null;
  reference_no: string | null;
  description: string | null;
  created_at: string | null;
};

type SellTreeRequest = {
  id: string;
  profile_id: string;
  tree_id: string | null;
  tree_value: number | null;
  platform_fee: number | null;
  net_receive: number | null;
  status: string | null;
  created_at: string | null;
};

type WithdrawalRequest = {
  id: string;
  profile_id: string;
  amount: number | null;
  processing_fee: number | null;
  net_receive: number | null;
  status: string | null;
  created_at: string | null;
};

export default function EarningsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [sellRequests, setSellRequests] = useState<SellTreeRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRealData() {
      setLoading(true);

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
        setLoading(false);
        return;
      }

      setProfile(currentProfile);

      const profileId = currentProfile.id;

      const { data: walletData } = await supabase
        .from("wallets")
        .select("id, profile_id, balance")
        .eq("profile_id", profileId)
        .maybeSingle();

      const { data: transactionData } = await supabase
        .from("wallet_transactions")
        .select(
          "id, profile_id, transaction_type, amount, status, reference_no, description, created_at"
        )
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });

      const { data: sellData } = await supabase
        .from("sell_tree_requests")
        .select(
          "id, profile_id, tree_id, tree_value, platform_fee, net_receive, status, created_at"
        )
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });

      const { data: withdrawalData } = await supabase
        .from("withdrawal_requests")
        .select(
          "id, profile_id, amount, processing_fee, net_receive, status, created_at"
        )
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });

      setWallet(walletData || null);
      setTransactions(transactionData || []);
      setSellRequests(sellData || []);
      setWithdrawals(withdrawalData || []);
      setLoading(false);
    }

    loadRealData();
  }, []);

  const totals = useMemo(() => {
    const treeSaleTransactions = transactions.filter(
      (item) => item.transaction_type === "TREE_SALE"
    );

    const referralTransactions = transactions.filter(
      (item) => item.transaction_type === "REFERRAL_BONUS"
    );

    const completedEarnings = transactions
      .filter(
        (item) =>
          item.status === "COMPLETED" &&
          ["TREE_SALE", "REFERRAL_BONUS"].includes(item.transaction_type || "")
      )
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const pendingSellNet = sellRequests
      .filter((item) => item.status === "PENDING")
      .reduce((sum, item) => sum + Number(item.net_receive || 0), 0);

    const totalTreeSales = treeSaleTransactions.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const totalReferral = referralTransactions.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const totalPlatformFees = sellRequests.reduce(
      (sum, item) => sum + Number(item.platform_fee || 0),
      0
    );

    const totalWithdrawn = withdrawals
      .filter((item) => item.status === "COMPLETED")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      completedEarnings,
      pendingSellNet,
      totalTreeSales,
      totalReferral,
      totalPlatformFees,
      totalWithdrawn,
    };
  }, [transactions, sellRequests, withdrawals]);

  const membershipStatus = profile?.membership_status || "UNKNOWN";
  const kycStatus = profile?.kyc_status || "UNKNOWN";
  const walletBalance = Number(wallet?.balance || 0);

  return (
    <main className="earningsPage">
      <section className="hero">
        <div>
          <p className="eyebrow">Real Database Connected</p>
          <h1>Earnings Center</h1>
          <span>
            Earnings are now loaded from Supabase wallet transactions, sell tree
            requests, withdrawal requests, and wallet balance.
          </span>
        </div>

        <div className="heroActions">
          <Link href="/dashboard/sell-tree">Sell Tree</Link>
          <Link href="/dashboard/wallet" className="primary">
            Wallet / Withdraw
          </Link>
        </div>
      </section>

      {loading ? (
        <div className="loadingBox">Loading real earnings data...</div>
      ) : (
        <>
          <section className="cards">
            <SummaryCard
              icon="💳"
              label="Wallet Balance"
              value={peso(walletBalance)}
              note="From wallets table"
              gold
            />
            <SummaryCard
              icon="🌳"
              label="Tree Sale Earnings"
              value={peso(totals.totalTreeSales)}
              note="Completed TREE_SALE transactions"
            />
            <SummaryCard
              icon="👥"
              label="Referral Earnings"
              value={peso(totals.totalReferral)}
              note="Completed referral bonuses"
            />
            <SummaryCard
              icon="🏛️"
              label="Platform Fees"
              value={peso(totals.totalPlatformFees)}
              note="2% fees from sell requests"
              gold
            />
          </section>

          <section className="grid">
            <div className="panel bigPanel">
              <div className="panelHead">
                <div>
                  <h2>Wallet Transactions</h2>
                  <p>
                    Real transaction records from{" "}
                    <strong>wallet_transactions</strong>.
                  </p>
                </div>
                <Link href="/dashboard/transactions">View Transactions ›</Link>
              </div>

              {transactions.length === 0 ? (
                <EmptyState message="No wallet transactions yet." />
              ) : (
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.reference_no || "—"}</strong>
                          </td>
                          <td>{cleanType(item.transaction_type)}</td>
                          <td>{item.description || "—"}</td>
                          <td>
                            <strong>{peso(Number(item.amount || 0))}</strong>
                          </td>
                          <td>
                            <span className={`status ${statusClass(item.status)}`}>
                              {item.status || "UNKNOWN"}
                            </span>
                          </td>
                          <td>{formatDate(item.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <aside className="panel sidePanel">
              <h2>Account Rules</h2>

              <div className="rule active">
                <span>✓</span>
                <div>
                  <strong>Membership Status</strong>
                  <p>{membershipStatus}</p>
                </div>
              </div>

              <div className="rule warning">
                <span>!</span>
                <div>
                  <strong>KYC Status</strong>
                  <p>{kycStatus}</p>
                </div>
              </div>

              <div className="withdrawBox">
                <p>Available Wallet Balance</p>
                <h3>{peso(walletBalance)}</h3>
                <Link href="/dashboard/wallet">Go to Wallet</Link>
              </div>

              <div className="pendingBox">
                <p>Pending Sell Tree Net</p>
                <strong>{peso(totals.pendingSellNet)}</strong>
                <small>Pending admin approval.</small>
              </div>

              <div className="pendingBox">
                <p>Total Withdrawn</p>
                <strong>{peso(totals.totalWithdrawn)}</strong>
                <small>Completed withdrawal requests.</small>
              </div>
            </aside>
          </section>

          <section className="lowerGrid">
            <div className="panel">
              <div className="panelHead">
                <div>
                  <h2>Sell Tree Requests</h2>
                  <p>Real records from sell_tree_requests.</p>
                </div>
              </div>

              {sellRequests.length === 0 ? (
                <EmptyState message="No sell tree requests yet." />
              ) : (
                <div className="requestList">
                  {sellRequests.map((item) => (
                    <div className="requestCard" key={item.id}>
                      <div>
                        <strong>{item.tree_id || "No Tree ID"}</strong>
                        <p>Tree Value: {peso(Number(item.tree_value || 0))}</p>
                        <p>Platform Fee: {peso(Number(item.platform_fee || 0))}</p>
                      </div>
                      <div>
                        <span className={`status ${statusClass(item.status)}`}>
                          {item.status || "UNKNOWN"}
                        </span>
                        <b>{peso(Number(item.net_receive || 0))}</b>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel">
              <div className="panelHead">
                <div>
                  <h2>Withdrawal Requests</h2>
                  <p>Real records from withdrawal_requests.</p>
                </div>
              </div>

              {withdrawals.length === 0 ? (
                <EmptyState message="No withdrawal requests yet." />
              ) : (
                <div className="requestList">
                  {withdrawals.map((item) => (
                    <div className="requestCard" key={item.id}>
                      <div>
                        <strong>{peso(Number(item.amount || 0))}</strong>
                        <p>Processing Fee: {peso(Number(item.processing_fee || 0))}</p>
                        <p>Net Receive: {peso(Number(item.net_receive || 0))}</p>
                      </div>
                      <div>
                        <span className={`status ${statusClass(item.status)}`}>
                          {item.status || "UNKNOWN"}
                        </span>
                        <b>{formatDate(item.created_at)}</b>
                      </div>
                    </div>
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
          color: #18261d;
          font-family: Arial, Helvetica, sans-serif;
          background:
            radial-gradient(circle at 18% 5%, rgba(255, 226, 154, .55), transparent 22%),
            radial-gradient(circle at 90% 12%, rgba(255,255,255,.72), transparent 28%),
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
          letter-spacing: .5px;
          text-transform: uppercase;
          font-size: 12px;
        }

        .hero h1 {
          margin: 0;
          font-size: 42px;
          letter-spacing: -1.4px;
          color: #101a14;
        }

        .hero span {
          display: block;
          margin-top: 8px;
          color: #5f665e;
          font-size: 15px;
          max-width: 720px;
        }

        .heroActions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .heroActions a {
          border-radius: 14px;
          padding: 13px 18px;
          text-decoration: none;
          color: #244536;
          background: rgba(255,253,246,.78);
          border: 1px solid rgba(92,70,35,.10);
          font-weight: 900;
          box-shadow: 0 14px 30px rgba(82,60,27,.08);
        }

        .heroActions a.primary {
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
        }

        .loadingBox,
        .emptyState {
          border-radius: 22px;
          background: rgba(255,253,246,.86);
          border: 1px solid rgba(92,70,35,.08);
          padding: 28px;
          color: #6b6b62;
          font-weight: 900;
          box-shadow: 0 18px 42px rgba(82,60,27,.09);
        }

        .cards {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
        }

        .summaryCard {
          min-height: 145px;
          border-radius: 22px;
          background: rgba(255,253,246,.84);
          border: 1px solid rgba(92,70,35,.08);
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 18px;
          box-shadow: 0 18px 40px rgba(82,60,27,.08);
        }

        .summaryIcon {
          width: 66px;
          height: 66px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 28px;
          background: radial-gradient(circle, #f5e8c9, #d9ccb0);
          box-shadow: inset -10px -12px 20px rgba(103,78,35,.12);
        }

        .summaryIcon.gold {
          background: radial-gradient(circle, #fff2bc, #c9a34d);
        }

        .summaryCard p {
          margin: 0 0 8px;
          font-size: 13px;
          color: #5f665e;
          font-weight: 900;
        }

        .summaryCard h3 {
          margin: 0 0 8px;
          font-size: 27px;
          letter-spacing: -1px;
          color: #101a14;
        }

        .summaryCard small {
          color: #8c6a3c;
          font-weight: 900;
        }

        .grid {
          display: grid;
          grid-template-columns: 1.5fr 420px;
          gap: 16px;
          margin-bottom: 16px;
        }

        .lowerGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .panel {
          border-radius: 22px;
          background: rgba(255,253,246,.86);
          border: 1px solid rgba(92,70,35,.08);
          box-shadow: 0 18px 42px rgba(82,60,27,.09);
          padding: 22px;
        }

        .panelHead {
          display: flex;
          justify-content: space-between;
          align-items: start;
          gap: 18px;
          margin-bottom: 18px;
        }

        .panelHead h2,
        .sidePanel h2 {
          margin: 0;
          color: #101a14;
          font-size: 22px;
        }

        .panelHead p {
          margin: 6px 0 0;
          color: #6b6b62;
          font-size: 14px;
        }

        .panelHead a {
          text-decoration: none;
          font-weight: 900;
          color: #31553d;
          white-space: nowrap;
        }

        .tableWrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 850px;
        }

        th {
          text-align: left;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .4px;
          color: #8c6a3c;
          padding: 14px 12px;
          border-bottom: 1px solid rgba(92,70,35,.14);
          background: rgba(243,234,216,.55);
        }

        td {
          padding: 15px 12px;
          border-bottom: 1px solid rgba(92,70,35,.10);
          color: #2c352e;
          font-size: 14px;
        }

        td strong {
          color: #101a14;
        }

        .status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 92px;
          padding: 8px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
        }

        .status.completed,
        .status.approved,
        .status.paid {
          background: rgba(49,85,61,.12);
          color: #31553d;
        }

        .status.pending,
        .status.processing {
          background: rgba(214,178,94,.20);
          color: #8c6a3c;
        }

        .status.rejected,
        .status.failed {
          background: rgba(163,60,42,.12);
          color: #a33c2a;
        }

        .sidePanel {
          min-height: 520px;
        }

        .rule {
          margin-top: 16px;
          display: grid;
          grid-template-columns: 42px 1fr;
          gap: 12px;
          padding: 14px;
          border-radius: 18px;
          background: #f3ead8;
          border: 1px solid rgba(92,70,35,.08);
        }

        .rule span {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #efe3cc;
          font-weight: 900;
          color: #8c6a3c;
        }

        .rule.active span {
          background: rgba(49,85,61,.14);
          color: #31553d;
        }

        .rule.warning span {
          background: rgba(214,178,94,.25);
          color: #8c6a3c;
        }

        .rule strong {
          color: #101a14;
        }

        .rule p {
          margin: 5px 0 0;
          color: #6b6b62;
          font-size: 13px;
          line-height: 1.45;
        }

        .withdrawBox {
          margin-top: 18px;
          border-radius: 20px;
          padding: 20px;
          color: white;
          background:
            radial-gradient(circle at 80% 20%, rgba(214,178,94,.38), transparent 26%),
            linear-gradient(135deg, #244536, #10281f);
        }

        .withdrawBox p {
          margin: 0;
          color: rgba(255,255,255,.75);
          font-weight: 800;
        }

        .withdrawBox h3 {
          margin: 8px 0 16px;
          font-size: 34px;
          letter-spacing: -1px;
        }

        .withdrawBox a {
          display: inline-flex;
          border-radius: 13px;
          background: #d6b25e;
          color: #10281f;
          padding: 12px 15px;
          text-decoration: none;
          font-weight: 900;
        }

        .pendingBox {
          margin-top: 16px;
          border-radius: 18px;
          padding: 16px;
          background: rgba(255,253,246,.72);
          border: 1px solid rgba(92,70,35,.10);
        }

        .pendingBox p {
          margin: 0 0 6px;
          color: #6b6b62;
          font-weight: 800;
        }

        .pendingBox strong {
          display: block;
          font-size: 24px;
          color: #101a14;
        }

        .pendingBox small {
          display: block;
          margin-top: 5px;
          color: #8c6a3c;
          font-weight: 900;
        }

        .requestList {
          display: grid;
          gap: 12px;
        }

        .requestCard {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          padding: 15px;
          border-radius: 18px;
          background: #f3ead8;
          border: 1px solid rgba(92,70,35,.08);
        }

        .requestCard strong {
          color: #101a14;
          font-size: 16px;
        }

        .requestCard p {
          margin: 5px 0 0;
          color: #6b6b62;
          font-size: 13px;
        }

        .requestCard div:last-child {
          display: grid;
          justify-items: end;
          gap: 8px;
        }

        .requestCard b {
          color: #31553d;
          font-size: 14px;
        }

        @media (max-width: 1200px) {
          .cards {
            grid-template-columns: repeat(2, 1fr);
          }

          .grid,
          .lowerGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .earningsPage {
            padding: 18px;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
          }

          .cards {
            grid-template-columns: 1fr;
          }

          .hero h1 {
            font-size: 34px;
          }

          .requestCard {
            align-items: flex-start;
            flex-direction: column;
          }

          .requestCard div:last-child {
            justify-items: start;
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
  icon,
  gold,
}: {
  label: string;
  value: string;
  note: string;
  icon: string;
  gold?: boolean;
}) {
  return (
    <div className="summaryCard">
      <div className={`summaryIcon ${gold ? "gold" : ""}`}>{icon}</div>
      <div>
        <p>{label}</p>
        <h3>{value}</h3>
        <small>{note}</small>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="emptyState">{message}</div>;
}

function peso(value: number) {
  return `₱ ${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function cleanType(value: string | null) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

function statusClass(value: string | null) {
  return (value || "pending").toLowerCase();
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}