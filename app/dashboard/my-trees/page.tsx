"use client";

import { useMemo, useState } from "react";

type OperationType =
  | "Watering Service"
  | "Photo Update"
  | "GPS Verification"
  | "Managed Care Subscription"
  | "Apply Fertilizer"
  | "Apply Insecticide"
  | "Apply Fungicide";

type TreeRecord = {
  id: string;
  stage: string;
  carePlan: "ACTIVE" | "NOT ENROLLED" | "EXPIRED";
  gpsStatus: string;
  latestPhoto: string;
};

type OperationItem = {
  name: OperationType;
  category: "Service" | "Inventory Use" | "Subscription";
  price: number;
  description: string;
};

const trees: TreeRecord[] = [
  {
    id: "AG-2026-001",
    stage: "Seedling",
    carePlan: "NOT ENROLLED",
    gpsStatus: "Pending GPS",
    latestPhoto: "Not Available",
  },
  {
    id: "AG-2026-002",
    stage: "Sapling",
    carePlan: "ACTIVE",
    gpsStatus: "Verified",
    latestPhoto: "Jun 18, 2026",
  },
  {
    id: "AG-2026-003",
    stage: "Young Tree",
    carePlan: "EXPIRED",
    gpsStatus: "Verified",
    latestPhoto: "Jun 12, 2026",
  },
  {
    id: "AG-2026-004",
    stage: "Mature Tree",
    carePlan: "ACTIVE",
    gpsStatus: "Verified",
    latestPhoto: "Jun 16, 2026",
  },
];

const operations: OperationItem[] = [
  {
    name: "Watering Service",
    category: "Service",
    price: 150,
    description: "Request operator watering service for the selected tree.",
  },
  {
    name: "Photo Update",
    category: "Service",
    price: 100,
    description: "Request a paid photo update. Latest paid photo is retained.",
  },
  {
    name: "GPS Verification",
    category: "Service",
    price: 80,
    description: "Request GPS verification for the selected tree record.",
  },
  {
    name: "Managed Care Subscription",
    category: "Subscription",
    price: 1500,
    description:
      "Subscribe selected tree to managed care operations and scheduled task coverage.",
  },
  {
    name: "Apply Fertilizer",
    category: "Inventory Use",
    price: 45,
    description:
      "Request application of owned fertilizer inventory. Operation fee applies.",
  },
  {
    name: "Apply Insecticide",
    category: "Inventory Use",
    price: 45,
    description:
      "Request application of owned insecticide inventory. Operation fee applies.",
  },
  {
    name: "Apply Fungicide",
    category: "Inventory Use",
    price: 45,
    description:
      "Request application of owned fungicide inventory. Operation fee applies.",
  },
];

const existingRequests = [
  {
    id: "OP-001",
    tree: "AG-2026-003",
    operation: "Photo Update",
    status: "PENDING",
    date: "Jun 18, 2026",
  },
  {
    id: "OP-002",
    tree: "AG-2026-001",
    operation: "Watering Service",
    status: "APPROVED",
    date: "Jun 17, 2026",
  },
  {
    id: "OP-003",
    tree: "AG-2026-002",
    operation: "Apply Fertilizer",
    status: "COMPLETED",
    date: "Jun 16, 2026",
  },
];

export default function TreeOperationsPage() {
  const [selectedTreeId, setSelectedTreeId] = useState(trees[0].id);
  const [selectedOperation, setSelectedOperation] =
    useState<OperationType>("Watering Service");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const selectedTree = useMemo(() => {
    return trees.find((tree) => tree.id === selectedTreeId) || trees[0];
  }, [selectedTreeId]);

  const operation = useMemo(() => {
    return (
      operations.find((item) => item.name === selectedOperation) || operations[0]
    );
  }, [selectedOperation]);

  const platformFee = operation.price * 0.02;
  const totalPay = operation.price + platformFee;

  function submitRequest() {
    setSubmitted(true);
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="kicker">TREE OPERATIONS</p>
          <h1>Request Tree Care Services</h1>
          <span>
            Select a tree, choose an operation, review the fee, and submit a
            request. Marketplace is for products only. This page is for
            services, inventory application, GPS, photo updates, and managed care.
          </span>
        </div>

        <div className="heroBadge">
          <strong>2%</strong>
          <p>Platform fee shown before payment</p>
        </div>
      </section>

      <section className="summaryGrid">
        <SummaryCard title="Owned Trees" value="128" sub="Available records" />
        <SummaryCard title="Active Care Plans" value="2" sub="Covered trees shown" />
        <SummaryCard title="Pending Requests" value="1" sub="Awaiting admin review" />
        <SummaryCard title="Wallet Balance" value="₱12,340" sub="Available balance" />
      </section>

      <section className="contentGrid">
        <div className="card">
          <div className="panelHead">
            <div>
              <h2>Create Operation Request</h2>
              <p>Customer request will be reviewed and processed by operations.</p>
            </div>
          </div>

          <label>Select Tree</label>
          <select
            value={selectedTreeId}
            onChange={(e) => {
              setSelectedTreeId(e.target.value);
              setSubmitted(false);
            }}
          >
            {trees.map((tree) => (
              <option key={tree.id} value={tree.id}>
                {tree.id} — {tree.stage} — Care Plan: {tree.carePlan}
              </option>
            ))}
          </select>

          <label>Select Operation</label>
          <select
            value={selectedOperation}
            onChange={(e) => {
              setSelectedOperation(e.target.value as OperationType);
              setSubmitted(false);
            }}
          >
            {operations.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name} — {item.category}
              </option>
            ))}
          </select>

          <div className="treePreview">
            <div>
              <h3>{selectedTree.id}</h3>
              <p>{selectedTree.stage}</p>
            </div>

            <div className="previewGrid">
              <Mini label="Care Plan" value={selectedTree.carePlan} />
              <Mini label="GPS" value={selectedTree.gpsStatus} />
              <Mini label="Latest Photo" value={selectedTree.latestPhoto} />
            </div>
          </div>

          <label>Request Note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Example: Please apply fertilizer during the next scheduled field visit."
          />
        </div>

        <div className="card">
          <div className="panelHead">
            <div>
              <h2>Fee Review</h2>
              <p>Customer sees operation fees before submitting.</p>
            </div>
          </div>

          <div className="operationBox">
            <span>{operation.category}</span>
            <h3>{operation.name}</h3>
            <p>{operation.description}</p>
          </div>

          <div className="feeBox">
            <FeeRow label="Operation Fee" value={operation.price} />
            <FeeRow label="Platform Fee 2%" value={platformFee} />
            <FeeRow label="Total Pay" value={totalPay} bold />
          </div>

          <button onClick={submitRequest}>
            {submitted ? "Request Submitted" : "Submit Operation Request"}
          </button>

          {submitted && (
            <div className="submittedBox">
              <strong>Request Pending</strong>
              <p>
                Your operation request for {selectedTree.id} has been submitted.
                It will appear as pending until processed by operations/admin.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="history card">
        <div className="panelHead">
          <div>
            <h2>Recent Operation Requests</h2>
            <p>Sample request timeline for customer view.</p>
          </div>
        </div>

        <div className="requestList">
          {existingRequests.map((request) => (
            <div className="requestRow" key={request.id}>
              <div>
                <strong>{request.id}</strong>
                <p>
                  {request.tree} • {request.operation}
                </p>
              </div>
              <span>{request.date}</span>
              <b className={request.status.toLowerCase()}>{request.status}</b>
            </div>
          ))}
        </div>
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
          text-transform: uppercase;
        }

        .hero h1 {
          margin: 0;
          font-size: clamp(34px, 5vw, 56px);
          letter-spacing: -2px;
        }

        .hero span {
          display: block;
          max-width: 820px;
          margin-top: 14px;
          color: rgba(255,255,255,.72);
          line-height: 1.6;
        }

        .heroBadge {
          width: 210px;
          min-width: 210px;
          border-radius: 24px;
          display: grid;
          place-items: center;
          text-align: center;
          background: rgba(255,255,255,.1);
          border: 1px solid rgba(255,255,255,.16);
          padding: 18px;
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

        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-top: 22px;
        }

        .summaryCard,
        .card {
          border-radius: 24px;
          padding: 22px;
          background: rgba(255, 253, 246, .9);
          border: 1px solid rgba(45, 34, 13, .07);
          box-shadow: 0 13px 38px rgba(20, 29, 18, .09);
        }

        .summaryCard p {
          margin: 0;
          color: #5c6259;
          font-weight: 800;
        }

        .summaryCard h3 {
          margin: 10px 0 8px;
          font-size: 34px;
        }

        .summaryCard small {
          color: #08782e;
          font-weight: 900;
        }

        .contentGrid {
          display: grid;
          grid-template-columns: 1.1fr .9fr;
          gap: 18px;
          margin-top: 22px;
        }

        .panelHead {
          display: flex;
          justify-content: space-between;
          gap: 14px;
        }

        .panelHead h2 {
          margin: 0;
          font-size: 28px;
        }

        .panelHead p {
          margin: 7px 0 0;
          color: #5c6259;
        }

        label {
          display: block;
          margin-top: 18px;
          color: #5c6259;
          font-weight: 900;
        }

        select,
        textarea {
          width: 100%;
          margin-top: 9px;
          border: 1px solid rgba(45, 34, 13, .12);
          border-radius: 16px;
          padding: 14px;
          color: #10251a;
          background: #fffdf6;
          font-size: 15px;
          outline: none;
        }

        textarea {
          min-height: 125px;
          resize: vertical;
        }

        .treePreview {
          margin-top: 18px;
          border-radius: 24px;
          padding: 20px;
          background: linear-gradient(135deg, #07351f, #0e4d2e);
          color: white;
        }

        .treePreview h3 {
          margin: 0;
          font-size: 28px;
        }

        .treePreview p {
          margin: 7px 0 0;
          color: rgba(255,255,255,.72);
          font-weight: 800;
        }

        .previewGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 18px;
        }

        .mini {
          border-radius: 16px;
          padding: 13px;
          background: rgba(255,255,255,.1);
          border: 1px solid rgba(255,255,255,.12);
        }

        .mini span {
          display: block;
          color: rgba(255,255,255,.65);
          font-size: 11px;
          font-weight: 900;
        }

        .mini strong {
          display: block;
          margin-top: 6px;
          font-size: 13px;
        }

        .operationBox {
          margin-top: 18px;
          border-radius: 22px;
          padding: 20px;
          background: rgba(14, 77, 46, .08);
          border: 1px solid rgba(14, 77, 46, .12);
        }

        .operationBox span {
          color: #08782e;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .operationBox h3 {
          margin: 10px 0 8px;
          font-size: 26px;
        }

        .operationBox p {
          margin: 0;
          color: #5c6259;
          line-height: 1.55;
        }

        .feeBox {
          margin-top: 18px;
          border-radius: 22px;
          padding: 16px;
          background: #f3ead8;
        }

        .feeRow {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 0;
          color: #5c6259;
          border-bottom: 1px solid rgba(0,0,0,.08);
        }

        .feeRow:last-child {
          border-bottom: 0;
        }

        .feeRow.bold {
          color: #10251a;
          font-size: 18px;
          font-weight: 900;
        }

        button {
          width: 100%;
          margin-top: 18px;
          border: 0;
          border-radius: 16px;
          padding: 16px;
          background: #0e4d2e;
          color: white;
          font-size: 15px;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 14px 30px rgba(14, 77, 46, .22);
        }

        .submittedBox {
          margin-top: 16px;
          border-radius: 18px;
          padding: 15px;
          background: #fff4cc;
          border: 1px solid rgba(240, 196, 88, .35);
        }

        .submittedBox p {
          margin: 8px 0 0;
          color: #66521e;
          line-height: 1.5;
        }

        .history {
          margin-top: 22px;
        }

        .requestList {
          margin-top: 18px;
          display: grid;
          gap: 12px;
        }

        .requestRow {
          display: grid;
          grid-template-columns: 1fr auto auto;
          align-items: center;
          gap: 14px;
          border-radius: 16px;
          padding: 14px;
          background: #f3ead8;
        }

        .requestRow strong {
          display: block;
          font-size: 15px;
        }

        .requestRow p {
          margin: 5px 0 0;
          color: #5c6259;
          font-size: 13px;
          font-weight: 800;
        }

        .requestRow span {
          color: #5c6259;
          font-size: 13px;
          font-weight: 800;
        }

        .requestRow b {
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 11px;
          text-align: center;
          background: #e3f1d6;
          color: #08782e;
        }

        .requestRow b.pending {
          background: #fff4cc;
          color: #9a6700;
        }

        .requestRow b.approved {
          background: #dff4cb;
          color: #08782e;
        }

        .requestRow b.completed {
          background: #dbeafe;
          color: #1d4ed8;
        }

        @media (max-width: 1100px) {
          .summaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .contentGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .page {
            padding: 18px;
          }

          .hero {
            flex-direction: column;
          }

          .heroBadge {
            width: 100%;
          }

          .summaryGrid,
          .previewGrid {
            grid-template-columns: 1fr;
          }

          .requestRow {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function SummaryCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="summaryCard">
      <p>{title}</p>
      <h3>{value}</h3>
      <small>{sub}</small>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FeeRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div className={`feeRow ${bold ? "bold" : ""}`}>
      <span>{label}</span>
      <strong>{peso(value)}</strong>
    </div>
  );
}

function peso(value: number) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    maximumFractionDigits: 0,
  })}`;
}
