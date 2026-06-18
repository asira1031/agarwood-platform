"use client";

import Link from "next/link";

type EarningRecord = {
  id: string;
  source: string;
  treeId: string;
  date: string;
  gross: number;
  fee: number;
  net: number;
  status: "AVAILABLE" | "PENDING" | "PROCESSING";
};

const earnings: EarningRecord[] = [
  {
    id: "EARN-001",
    source: "Tree Sale Earnings",
    treeId: "AG-001",
    date: "Jun 18, 2026",
    gross: 25000,
    fee: 500,
    net: 24500,
    status: "AVAILABLE",
  },
  {
    id: "EARN-002",
    source: "Referral Bonus",
    treeId: "REF-2026-18",
    date: "Jun 16, 2026",
    gross: 750,
    fee: 0,
    net: 750,
    status: "AVAILABLE",
  },
  {
    id: "EARN-003",
    source: "Tree Sale Pending",
    treeId: "AG-014",
    date: "Jun 15, 2026",
    gross: 18000,
    fee: 360,
    net: 17640,
    status: "PENDING",
  },
  {
    id: "EARN-004",
    source: "Package Tree Yield",
    treeId: "PKG-050",
    date: "Jun 12, 2026",
    gross: 5200,
    fee: 104,
    net: 5096,
    status: "PROCESSING",
  },
];

export default function EarningsPage() {
  const totalGross = earnings.reduce((sum, item) => sum + item.gross, 0);
  const totalFees = earnings.reduce((sum, item) => sum + item.fee, 0);
  const totalNet = earnings.reduce((sum, item) => sum + item.net, 0);
  const withdrawable = earnings
    .filter((item) => item.status === "AVAILABLE")
    .reduce((sum, item) => sum + item.net, 0);
  const pending = earnings
    .filter((item) => item.status !== "AVAILABLE")
    .reduce((sum, item) => sum + item.net, 0);

  return (
    <main className="earningsPage">
      <section className="hero">
        <div>
          <p className="eyebrow">Agarwood Earnings</p>
          <h1>Earnings Center</h1>
          <span>
            Track tree sale proceeds, referral bonuses, pending earnings, and
            withdrawable balance.
          </span>
        </div>

        <div className="heroActions">
          <Link href="/dashboard/sell-tree">Sell Tree</Link>
          <Link href="/dashboard/wallet" className="primary">
            Withdraw
          </Link>
        </div>
      </section>

      <section className="cards">
        <SummaryCard
          label="Total Gross Earnings"
          value={peso(totalGross)}
          note="Before platform fees"
          icon="🌳"
        />
        <SummaryCard
          label="Platform Fees"
          value={peso(totalFees)}
          note="2% fee on tree sale earnings"
          icon="🏛️"
          gold
        />
        <SummaryCard
          label="Net Earnings"
          value={peso(totalNet)}
          note="After deductions"
          icon="💹"
        />
        <SummaryCard
          label="Withdrawable"
          value={peso(withdrawable)}
          note="KYC required before withdrawal"
          icon="💳"
          gold
        />
      </section>

      <section className="grid">
        <div className="panel bigPanel">
          <div className="panelHead">
            <div>
              <h2>Earnings History</h2>
              <p>Latest customer earnings from agarwood investment activity.</p>
            </div>
            <Link href="/dashboard/transactions">View Transactions ›</Link>
          </div>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Earning ID</th>
                  <th>Source</th>
                  <th>Tree / Ref</th>
                  <th>Date</th>
                  <th>Gross</th>
                  <th>Fee</th>
                  <th>Net</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.id}</strong>
                    </td>
                    <td>{item.source}</td>
                    <td>{item.treeId}</td>
                    <td>{item.date}</td>
                    <td>{peso(item.gross)}</td>
                    <td>{peso(item.fee)}</td>
                    <td>
                      <strong>{peso(item.net)}</strong>
                    </td>
                    <td>
                      <span className={`status ${item.status.toLowerCase()}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="panel sidePanel">
          <h2>Withdraw Rules</h2>

          <div className="rule active">
            <span>✓</span>
            <div>
              <strong>Membership Active</strong>
              <p>Required to access wallet and earnings features.</p>
            </div>
          </div>

          <div className="rule warning">
            <span>!</span>
            <div>
              <strong>KYC Required</strong>
              <p>Only verified users can withdraw earnings.</p>
            </div>
          </div>

          <div className="rule">
            <span>%</span>
            <div>
              <strong>Withdraw Fee</strong>
              <p>Processing fee is 2% of withdrawal amount.</p>
            </div>
          </div>

          <div className="withdrawBox">
            <p>Available to withdraw</p>
            <h3>{peso(withdrawable)}</h3>
            <Link href="/dashboard/wallet">Go to Wallet</Link>
          </div>

          <div className="pendingBox">
            <p>Pending earnings</p>
            <strong>{peso(pending)}</strong>
            <small>Pending admin approval or processing.</small>
          </div>
        </aside>
      </section>

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
          max-width: 680px;
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
          min-width: 860px;
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
          min-width: 96px;
          padding: 8px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
        }

        .status.available {
          background: rgba(49,85,61,.12);
          color: #31553d;
        }

        .status.pending {
          background: rgba(214,178,94,.20);
          color: #8c6a3c;
        }

        .status.processing {
          background: rgba(70,91,120,.12);
          color: #465b78;
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

        @media (max-width: 1200px) {
          .cards {
            grid-template-columns: repeat(2, 1fr);
          }

          .grid {
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

function peso(value: number) {
  return `₱ ${value.toLocaleString("en-PH")}`;
}