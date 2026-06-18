"use client";

import { useMemo, useState } from "react";

type TreeRecord = {
  id: string;
  qrCode: string;
  stage: string;
  purchaseDate: string;
  plantingDate: string;
  latestPhoto: string;
  photoNote: string;
  gpsStatus: string;
  carePlan: "ACTIVE" | "NOT ENROLLED" | "EXPIRED";
  taskOrders: number;
  missedRequirements: number;
  packageType: "Individual" | "Package";
};

const trees: TreeRecord[] = [
  {
    id: "AG-2026-001",
    qrCode: "QR-AG-2026-001",
    stage: "Seedling",
    purchaseDate: "Jun 18, 2026",
    plantingDate: "Pending Planting",
    latestPhoto: "Not Available",
    photoNote: "Seedling stage may not have visible trunk growth yet.",
    gpsStatus: "Pending GPS",
    carePlan: "NOT ENROLLED",
    taskOrders: 2,
    missedRequirements: 1,
    packageType: "Individual",
  },
  {
    id: "AG-2026-002",
    qrCode: "QR-AG-2026-002",
    stage: "Sapling",
    purchaseDate: "May 28, 2026",
    plantingDate: "Jun 03, 2026",
    latestPhoto: "Jun 18, 2026",
    photoNote: "Latest paid photo retained until next photo update.",
    gpsStatus: "Verified",
    carePlan: "ACTIVE",
    taskOrders: 1,
    missedRequirements: 0,
    packageType: "Package",
  },
  {
    id: "AG-2026-003",
    qrCode: "QR-AG-2026-003",
    stage: "Young Tree",
    purchaseDate: "Apr 12, 2026",
    plantingDate: "Apr 20, 2026",
    latestPhoto: "Jun 12, 2026",
    photoNote: "New growth may not be reflected if photo update is expired.",
    gpsStatus: "Verified",
    carePlan: "EXPIRED",
    taskOrders: 3,
    missedRequirements: 2,
    packageType: "Individual",
  },
  {
    id: "AG-2026-004",
    qrCode: "QR-AG-2026-004",
    stage: "Mature Tree",
    purchaseDate: "Mar 08, 2026",
    plantingDate: "Mar 16, 2026",
    latestPhoto: "Jun 16, 2026",
    photoNote: "Photo update is current.",
    gpsStatus: "Verified",
    carePlan: "ACTIVE",
    taskOrders: 0,
    missedRequirements: 0,
    packageType: "Package",
  },
];

export default function MyTreesPage() {
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "NEEDS_ATTENTION">(
    "ALL"
  );

  const filteredTrees = useMemo(() => {
    if (filter === "ACTIVE") {
      return trees.filter((tree) => tree.carePlan === "ACTIVE");
    }

    if (filter === "NEEDS_ATTENTION") {
      return trees.filter(
        (tree) =>
          tree.carePlan !== "ACTIVE" ||
          tree.missedRequirements > 0 ||
          tree.taskOrders > 0
      );
    }

    return trees;
  }, [filter]);

  const activeCarePlans = trees.filter((tree) => tree.carePlan === "ACTIVE").length;
  const notEnrolled = trees.filter((tree) => tree.carePlan === "NOT ENROLLED").length;
  const needsAttention = trees.filter(
    (tree) => tree.missedRequirements > 0 || tree.carePlan !== "ACTIVE"
  ).length;

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="kicker">MY TREES</p>
          <h1>Agarwood Tree Records</h1>
          <span>
            Track each owned tree by QR, purchase date, planting date, stage,
            GPS, photo update, care plan, and task order status.
          </span>
        </div>

        <div className="heroBadge">
          <strong>{trees.length}</strong>
          <p>Total Records</p>
        </div>
      </section>

      <section className="stats">
        <Card title="Owned Trees" value={`${trees.length}`} sub="Current records" />
        <Card title="Active Care Plans" value={`${activeCarePlans}`} sub="Covered trees" />
        <Card title="Not Enrolled" value={`${notEnrolled}`} sub="Needs care decision" />
        <Card title="Needs Attention" value={`${needsAttention}`} sub="Care or task issues" />
      </section>

      <section className="toolbar">
        <div>
          <h2>Tree Registry</h2>
          <p>QR-based ownership and care monitoring.</p>
        </div>

        <div className="filters">
          <button
            className={filter === "ALL" ? "active" : ""}
            onClick={() => setFilter("ALL")}
          >
            All Trees
          </button>
          <button
            className={filter === "ACTIVE" ? "active" : ""}
            onClick={() => setFilter("ACTIVE")}
          >
            Active Care
          </button>
          <button
            className={filter === "NEEDS_ATTENTION" ? "active" : ""}
            onClick={() => setFilter("NEEDS_ATTENTION")}
          >
            Needs Attention
          </button>
        </div>
      </section>

      <section className="treeGrid">
        {filteredTrees.map((tree) => (
          <TreeCard key={tree.id} tree={tree} />
        ))}
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
        }

        .page {
          min-height: 100vh;
          padding: 32px;
          color: #10251a;
          background:
            radial-gradient(circle at 10% 10%, rgba(232, 207, 120, .18), transparent 30%),
            radial-gradient(circle at 90% 20%, rgba(74, 157, 74, .16), transparent 35%),
            linear-gradient(135deg, #f8f2e6, #efe6d0);
          font-family: Arial, Helvetica, sans-serif;
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: stretch;
          gap: 24px;
          border-radius: 28px;
          padding: 30px;
          color: white;
          background:
            radial-gradient(circle at 72% 20%, rgba(240, 196, 88, .35), transparent 28%),
            linear-gradient(135deg, #06281d, #0e4d2e);
          box-shadow: 0 24px 60px rgba(12, 33, 24, .18);
        }

        .kicker {
          margin: 0 0 10px;
          color: #f0c458;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 4px;
        }

        .hero h1 {
          margin: 0;
          font-size: clamp(34px, 5vw, 56px);
          letter-spacing: -2px;
        }

        .hero span {
          display: block;
          max-width: 760px;
          margin-top: 14px;
          color: rgba(255,255,255,.72);
          line-height: 1.6;
        }

        .heroBadge {
          width: 170px;
          min-width: 170px;
          border-radius: 24px;
          display: grid;
          place-items: center;
          text-align: center;
          background: rgba(255,255,255,.1);
          border: 1px solid rgba(255,255,255,.16);
        }

        .heroBadge strong {
          display: block;
          font-size: 48px;
          color: #f0c458;
        }

        .heroBadge p {
          margin: 6px 0 0;
          color: rgba(255,255,255,.75);
          font-weight: 800;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-top: 22px;
        }

        .stat {
          border-radius: 22px;
          padding: 22px;
          background: rgba(255, 253, 246, .86);
          border: 1px solid rgba(45, 34, 13, .07);
          box-shadow: 0 13px 38px rgba(20, 29, 18, .09);
        }

        .stat p {
          margin: 0;
          color: #5c6259;
          font-weight: 800;
        }

        .stat h3 {
          margin: 10px 0 8px;
          font-size: 34px;
        }

        .stat small {
          color: #08782e;
          font-weight: 900;
        }

        .toolbar {
          margin-top: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
          border-radius: 24px;
          padding: 20px;
          background: rgba(255, 253, 246, .72);
          border: 1px solid rgba(45, 34, 13, .07);
        }

        .toolbar h2 {
          margin: 0;
          font-size: 26px;
        }

        .toolbar p {
          margin: 6px 0 0;
          color: #5c6259;
        }

        .filters {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .filters button {
          border: 0;
          border-radius: 999px;
          padding: 11px 16px;
          background: #e3f1d6;
          color: #12351f;
          font-weight: 900;
          cursor: pointer;
        }

        .filters button.active {
          color: white;
          background: #0e4d2e;
        }

        .treeGrid {
          margin-top: 22px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .treeCard {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          padding: 22px;
          background: rgba(255, 253, 246, .9);
          border: 1px solid rgba(45, 34, 13, .07);
          box-shadow: 0 13px 38px rgba(20, 29, 18, .09);
        }

        .treeCard:before {
          content: "";
          position: absolute;
          right: -40px;
          top: -60px;
          width: 180px;
          height: 180px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(74, 157, 74, .2), transparent 70%);
        }

        .treeHead {
          position: relative;
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
        }

        .treeHead h3 {
          margin: 0;
          font-size: 24px;
          letter-spacing: -.5px;
        }

        .treeHead p {
          margin: 6px 0 0;
          color: #5c6259;
          font-weight: 800;
        }

        .qrBox {
          width: 92px;
          height: 92px;
          min-width: 92px;
          border-radius: 18px;
          background:
            linear-gradient(90deg, #12351f 8px, transparent 8px) 0 0 / 20px 20px,
            linear-gradient(#12351f 8px, transparent 8px) 0 0 / 20px 20px,
            #fffdf6;
          border: 5px solid #10251a;
          box-shadow: inset 0 0 0 8px #fffdf6;
        }

        .qrLabel {
          margin-top: 8px;
          text-align: center;
          font-size: 10px;
          color: #5c6259;
          font-weight: 900;
          word-break: break-word;
        }

        .stageBadge {
          display: inline-flex;
          margin-top: 14px;
          border-radius: 999px;
          padding: 8px 13px;
          color: white;
          background: #0e4d2e;
          font-size: 12px;
          font-weight: 900;
        }

        .details {
          position: relative;
          margin-top: 18px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .detail {
          border-radius: 16px;
          padding: 13px;
          background: #f3ead8;
          border: 1px solid rgba(45, 34, 13, .06);
        }

        .detail span {
          display: block;
          margin-bottom: 7px;
          color: #5c6259;
          font-size: 12px;
          font-weight: 900;
        }

        .detail strong {
          display: block;
          font-size: 14px;
          color: #10251a;
        }

        .note {
          margin-top: 14px;
          border-radius: 16px;
          padding: 13px;
          background: rgba(14, 77, 46, .08);
          color: #0e4d2e;
          font-size: 13px;
          line-height: 1.5;
          font-weight: 800;
        }

        .bottomRow {
          margin-top: 16px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .miniStatus {
          border-radius: 16px;
          padding: 12px;
          text-align: center;
          background: #fffaf0;
          border: 1px solid rgba(45, 34, 13, .07);
        }

        .miniStatus span {
          display: block;
          color: #5c6259;
          font-size: 11px;
          font-weight: 900;
        }

        .miniStatus strong {
          display: block;
          margin-top: 6px;
          font-size: 14px;
        }

        .careActive strong {
          color: #08782e;
        }

        .careExpired strong,
        .needs strong {
          color: #c2410c;
        }

        @media (max-width: 1100px) {
          .stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .treeGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .page {
            padding: 18px;
          }

          .hero,
          .toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .heroBadge {
            width: 100%;
          }

          .stats,
          .details,
          .bottomRow {
            grid-template-columns: 1fr;
          }

          .filters {
            justify-content: flex-start;
          }
        }
      `}</style>
    </main>
  );
}

function TreeCard({ tree }: { tree: TreeRecord }) {
  const careClass =
    tree.carePlan === "ACTIVE"
      ? "careActive"
      : tree.carePlan === "EXPIRED"
      ? "careExpired"
      : "";

  return (
    <article className="treeCard">
      <div className="treeHead">
        <div>
          <h3>{tree.id}</h3>
          <p>{tree.packageType} Tree</p>
          <span className="stageBadge">{tree.stage}</span>
        </div>

        <div>
          <div className="qrBox" />
          <div className="qrLabel">{tree.qrCode}</div>
        </div>
      </div>

      <div className="details">
        <Detail label="Purchase Date" value={tree.purchaseDate} />
        <Detail label="Planting Date" value={tree.plantingDate} />
        <Detail label="Latest Photo" value={tree.latestPhoto} />
        <Detail label="GPS Status" value={tree.gpsStatus} />
      </div>

      <div className="note">{tree.photoNote}</div>

      <div className="bottomRow">
        <div className={`miniStatus ${careClass}`}>
          <span>Care Plan</span>
          <strong>{tree.carePlan}</strong>
        </div>

        <div className="miniStatus">
          <span>Task Orders</span>
          <strong>{tree.taskOrders}</strong>
        </div>

        <div className={`miniStatus ${tree.missedRequirements > 0 ? "needs" : ""}`}>
          <span>Missed Requirements</span>
          <strong>{tree.missedRequirements}</strong>
        </div>
      </div>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Card({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="stat">
      <p>{title}</p>
      <h3>{value}</h3>
      <small>{sub}</small>
    </div>
  );
}
