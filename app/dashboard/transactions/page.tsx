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

export default function TransactionsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<
    WalletTransaction[]
  >([]);
  const [sellRequests, setSellRequests] = useState<SellTreeRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTransactions() {
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
        .select("id, full_name, email")
        .eq("id", user.id)
        .maybeSingle();

      const { data: profileByEmail } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("email", email)
        .maybeSingle();

      const currentProfile = profileById || profileByEmail;

      if (!currentProfile) {
        setLoading(false);
        return;
      }

      setProfile(currentProfile);

      const profileId = currentProfile.id;

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

      setWalletTransactions(transactionData || []);
      setSellRequests(sellData || []);
      setWithdrawals(withdrawalData || []);
      setLoading(false);
    }

    loadTransactions();
  }, []);

  const stats = useMemo(() => {
    const totalRecords =
      walletTransactions.length + sellRequests.length + withdrawals.length;

    const completedWallet = walletTransactions.filter((item) =>
      ["COMPLETED", "APPROVED", "PAID"].includes(item.status || "")
    ).length;

    const completedSell = sellRequests.filter((item) =>
      ["COMPLETED", "APPROVED", "PAID"].includes(item.status || "")
    ).length;

    const completedWithdrawals = withdrawals.filter((item) =>
      ["COMPLETED", "APPROVED", "PAID"].includes(item.status || "")
    ).length;

    const pendingWallet = walletTransactions.filter((item) =>
      ["PENDING", "PROCESSING"].includes(item.status || "")
    ).length;

    const pendingSell = sellRequests.filter((item) =>
      ["PENDING", "PROCESSING"].includes(item.status || "")
    ).length;

    const pendingWithdrawals = withdrawals.filter((item) =>
      ["PENDING", "PROCESSING"].includes(item.status || "")
    ).length;

    const walletValue = walletTransactions.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const sellValue = sellRequests.reduce(
      (sum, item) => sum + Number(item.net_receive || 0),
      0
    );

    const withdrawalValue = withdrawals.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    return {
      totalRecords,
      completed: completedWallet + completedSell + completedWithdrawals,
      pending: pendingWallet + pendingSell + pendingWithdrawals,
      totalValue: walletValue + sellValue + withdrawalValue,
    };
  }, [walletTransactions, sellRequests, withdrawals]);

  return (
    <main className="transactionsPage">
      <section className="hero">
        <div>
          <p className="eyebrow">Real Database Connected</p>
          <h1>Transactions</h1>
          <span>
            View wallet activity, sell tree requests, withdrawals, and platform
            money movement from Supabase.
          </span>
        </div>

        <div className="heroActions">
          <Link href="/dashboard/earnings">Earnings</Link>
          <Link href="/dashboard/wallet" className="primary">
            Wallet
          </Link>
        </div>
      </section>

      {loading ? (
        <div className="loadingBox">Loading real transaction data...</div>
      ) : (
        <>
          <section className="cards">
            <SummaryCard
              icon="🧾"
              label="Total Records"
              value={String(stats.totalRecords)}
              note="All transaction records"
            />
            <SummaryCard
              icon="✅"
              label="Completed"
              value={String(stats.completed)}
              note="Completed, approved, or paid"
              gold
            />
            <SummaryCard
              icon="⏳"
              label="Pending"
              value={String(stats.pending)}
              note="Pending or processing"
            />
            <SummaryCard
              icon="💳"
              label="Total Value"
              value={peso(stats.totalValue)}
              note="Combined transaction value"
              gold
            />
          </section>

          <section className="panel">
            <div className="panelHead">
              <div>
                <h2>Wallet Transactions</h2>
                <p>Real records from wallet_transactions.</p>
              </div>
            </div>

            {walletTransactions.length === 0 ? (
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
                    {walletTransactions.map((item) => (
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
          </section>

          <section className="lowerGrid">
            <div className="panel">
              <div className="panelHead">
                <div>
                  <h2>Sell Tree Activity</h2>
                  <p>Real records from sell_tree_requests.</p>
                </div>
                <Link href="/dashboard/sell-tree">Sell Tree ›</Link>
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
                        <p>
                          Platform Fee: {peso(Number(item.platform_fee || 0))}
                        </p>
                      </div>
                      <div>
                        <span className={`status ${statusClass(item.status)}`}>
                          {item.status || "UNKNOWN"}
                        </span>
                        <b>Net: {peso(Number(item.net_receive || 0))}</b>
                        <small>{formatDate(item.created_at)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel">
              <div className="panelHead">
                <div>
                  <h2>Withdrawal Activity</h2>
                  <p>Real records from withdrawal_requests.</p>
                </div>
                <Link href="/dashboard/wallet">Withdraw ›</Link>
              </div>

              {withdrawals.length === 0 ? (
                <EmptyState message="No withdrawal requests yet." />
              ) : (
                <div className="requestList">
                  {withdrawals.map((item) => (
                    <div className="requestCard" key={item.id}>
                      <div>
                        <strong>{peso(Number(item.amount || 0))}</strong>
                        <p>
                          Processing Fee:{" "}
                          {peso(Number(item.processing_fee || 0))}
                        </p>
                        <p>Net Receive: {peso(Number(item.net_receive || 0))}</p>
                      </div>
                      <div>
                        <span className={`status ${statusClass(item.status)}`}>
                          {item.status || "UNKNOWN"}
                        </span>
                        <small>{formatDate(item.created_at)}</small>
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

        .transactionsPage {
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

        .heroActions a,
        .panelHead a {
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

        .cards {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
        }

        .summaryCard,
        .panel,
        .loadingBox,
        .emptyState {
          border-radius: 22px;
          background: rgba(255,253,246,.86);
          border: 1px solid rgba(92,70,35,.08);
          box-shadow: 0 18px 42px rgba(82,60,27,.09);
        }

        .summaryCard {
          min-height: 145px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .summaryIcon {
          width: 66px;
          height: 66px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 28px;
          background: radial-gradient(circle, #f5e8c9, #d9ccb0);
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

        .panel {
          padding: 22px;
          margin-bottom: 16px;
        }

        .panelHead {
          display: flex;
          justify-content: space-between;
          align-items: start;
          gap: 18px;
          margin-bottom: 18px;
        }

        .panelHead h2 {
          margin: 0;
          color: #101a14;
          font-size: 22px;
        }

        .panelHead p {
          margin: 6px 0 0;
          color: #6b6b62;
          font-size: 14px;
        }

        .loadingBox,
        .emptyState {
          padding: 28px;
          color: #6b6b62;
          font-weight: 900;
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

        .lowerGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
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

        .requestCard small {
          color: #6b6b62;
          font-weight: 800;
        }

        @media (max-width: 1200px) {
          .cards {
            grid-template-columns: repeat(2, 1fr);
          }

          .lowerGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .transactionsPage {
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