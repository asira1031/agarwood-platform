"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TreeRow = Record<string, any>;
type SellRequest = Record<string, any>;

const STAGES = ["Seedling", "Sapling", "Young Tree", "Mature Tree", "Harvest Ready"];

export default function MyTreesPage() {
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [sellRequests, setSellRequests] = useState<SellRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTree, setSelectedTree] = useState<TreeRow | null>(null);
  const [message, setMessage] = useState("");

  async function loadTrees() {
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
      .select("id, email, full_name, membership_status, kyc_status")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, email, full_name, membership_status, kyc_status")
      .eq("email", email)
      .maybeSingle();

    const profile = profileById || profileByEmail;

    if (!profile) {
      setMessage("Profile not found.");
      setLoading(false);
      return;
    }

    const { data: treeData, error: treeError } = await supabase
      .from("trees")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false });

    if (treeError) {
      setMessage(treeError.message);
      setLoading(false);
      return;
    }

    const { data: sellData } = await supabase
      .from("sell_tree_requests")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false });

    setTrees(treeData || []);
    setSellRequests(sellData || []);
    setSelectedTree((treeData || [])[0] || null);
    setLoading(false);
  }

  useEffect(() => {
    loadTrees();
  }, []);

  const stats = useMemo(() => {
    const owned = trees.length;
    const totalSpent = trees.reduce((sum, tree) => sum + getTotalSpent(tree), 0);
    const estimatedValue = trees.reduce((sum, tree) => sum + getEstimatedValue(tree), 0);
    const profit = estimatedValue - totalSpent;

    return { owned, totalSpent, estimatedValue, profit };
  }, [trees]);

  const selectedMath = selectedTree
    ? getTreeMath(selectedTree)
    : { totalSpent: 0, estimatedValue: 0, profit: 0, roi: 0 };

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Agarwood Portfolio</p>
          <h1>My Trees</h1>
          <span>
            Track your owned agarwood trees, growth stage, QR identity, total spending,
            estimated value, and profit/loss before selling.
          </span>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      {loading ? (
        <div className="empty">Loading your trees...</div>
      ) : trees.length === 0 ? (
        <div className="empty">
          You do not own any trees yet. Visit Marketplace to purchase your first agarwood tree.
        </div>
      ) : (
        <>
          <section className="stats">
            <Stat label="Owned Trees" value={String(stats.owned)} />
            <Stat label="Total Spent" value={peso(stats.totalSpent)} />
            <Stat label="Estimated Value" value={peso(stats.estimatedValue)} />
            <Stat label="Projected Profit" value={peso(stats.profit)} good={stats.profit >= 0} />
          </section>

          <section className="layout">
            <aside className="treeList">
              {trees.map((tree) => {
                const math = getTreeMath(tree);
                const active = selectedTree?.id === tree.id;

                return (
                  <button
                    key={tree.id}
                    className={`treeItem ${active ? "active" : ""}`}
                    onClick={() => setSelectedTree(tree)}
                  >
                    <div>
                      <strong>{tree.tree_code || tree.code || tree.id}</strong>
                      <p>{tree.custom_name || tree.name || "Agarwood Tree"}</p>
                    </div>
                    <span className={math.profit >= 0 ? "gain" : "loss"}>
                      {peso(math.profit)}
                    </span>
                  </button>
                );
              })}
            </aside>

            {selectedTree && (
              <section className="detail">
                <div className="detailTop">
                  <div>
                    <p className="eyebrow">Tree Asset</p>
                    <h2>{selectedTree.custom_name || selectedTree.name || "Agarwood Tree"}</h2>
                    <span>{selectedTree.tree_code || selectedTree.code || selectedTree.id}</span>
                  </div>

                  <div className="qrBadge">
                    <strong>QR</strong>
                    <p>Tree Identity</p>
                  </div>
                </div>

                <section className="growth">
                  <div className="panelHead">
                    <div>
                      <h3>Growth Guide</h3>
                      <p>Current stage is based on the tree record from Supabase.</p>
                    </div>
                  </div>

                  <div className="stageLine">
                    {STAGES.map((stage, index) => {
                      const current = normalizeStage(selectedTree.stage || selectedTree.growth_stage);
                      const currentIndex = Math.max(
                        0,
                        STAGES.findIndex((item) => item.toLowerCase() === current.toLowerCase())
                      );

                      return (
                        <div
                          key={stage}
                          className={`stage ${index <= currentIndex ? "done" : ""} ${
                            index === currentIndex ? "current" : ""
                          }`}
                        >
                          <span>{index + 1}</span>
                          <strong>{stage}</strong>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="cards">
                  <Mini label="Stage" value={selectedTree.stage || selectedTree.growth_stage || "—"} />
                  <Mini label="Age" value={getAgeText(selectedTree)} />
                  <Mini label="GPS Status" value={selectedTree.gps_status || selectedTree.gpsStatus || "Pending"} />
                  <Mini label="Care Plan" value={selectedTree.care_plan || selectedTree.carePlan || "Not Enrolled"} />
                  <Mini label="Valuation" value={selectedTree.valuation_status || "Awaiting Valuation"} />
                  <Mini label="Availability" value={selectedTree.availability_status || "Owned"} />
                </section>

                <section className="moneyBox">
                  <div className="panelHead">
                    <div>
                      <h3>Tree Cost Tracker</h3>
                      <p>Shows if this tree is currently projected as profit or loss.</p>
                    </div>
                  </div>

                  <div className="moneyGrid">
                    <Money label="Purchase Price" value={getPurchasePrice(selectedTree)} />
                    <Money label="Operations / Care Cost" value={getOperationCost(selectedTree)} />
                    <Money label="GPS / Photo Fees" value={getVerificationCost(selectedTree)} />
                    <Money label="Total Spent" value={selectedMath.totalSpent} strong />
                    <Money label="Estimated Sell Value" value={selectedMath.estimatedValue} />
                    <Money label="Projected Profit / Loss" value={selectedMath.profit} strong good={selectedMath.profit >= 0} />
                    <Money label="ROI" value={selectedMath.roi} percent good={selectedMath.roi >= 0} />
                  </div>
                </section>

                <section className="actions">
                  <button>View Photos</button>
                  <button>View GPS</button>
                  <button>Request Care</button>
                  <button className="sell">Sell Tree</button>
                </section>

                <section className="history">
                  <div className="panelHead">
                    <div>
                      <h3>Sell Requests</h3>
                      <p>Pending or completed sale requests for this tree.</p>
                    </div>
                  </div>

                  {sellRequests.filter((item) => item.tree_id === selectedTree.id).length === 0 ? (
                    <div className="empty small">No sell request for this tree.</div>
                  ) : (
                    <div className="requestList">
                      {sellRequests
                        .filter((item) => item.tree_id === selectedTree.id)
                        .map((item) => (
                          <div className="requestRow" key={item.id}>
                            <div>
                              <strong>{peso(Number(item.expected_amount || item.selling_price || 0))}</strong>
                              <p>{formatDate(item.created_at)}</p>
                            </div>
                            <span>{item.status || "PENDING"}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </section>
              </section>
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

        .hero {
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
          font-size: 44px;
          letter-spacing: -1.6px;
          color: #101a14;
        }

        .hero span {
          display: block;
          margin-top: 8px;
          color: #5f665e;
          font-size: 15px;
          max-width: 850px;
          line-height: 1.6;
        }

        .message,
        .empty,
        .stat,
        .treeList,
        .detail,
        .growth,
        .moneyBox,
        .history {
          border-radius: 26px;
          background: rgba(255,253,246,.88);
          border: 1px solid rgba(92,70,35,.08);
          box-shadow: 0 18px 42px rgba(82,60,27,.09);
        }

        .message,
        .empty {
          padding: 20px;
          color: #31553d;
          font-weight: 900;
        }

        .small {
          box-shadow: none;
          border-radius: 18px;
          background: #f3ead8;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 18px;
        }

        .stat {
          padding: 22px;
        }

        .stat p {
          margin: 0;
          color: #6b6b62;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .stat h3 {
          margin: 10px 0 0;
          color: #244536;
          font-size: 28px;
        }

        .stat.good h3 {
          color: #176b3a;
        }

        .layout {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 18px;
          align-items: start;
        }

        .treeList {
          padding: 14px;
          display: grid;
          gap: 10px;
          max-height: 780px;
          overflow: auto;
        }

        .treeItem {
          border: 1px solid rgba(92,70,35,.08);
          border-radius: 20px;
          padding: 16px;
          background: #f3ead8;
          text-align: left;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .treeItem.active {
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
        }

        .treeItem strong {
          display: block;
          font-size: 15px;
        }

        .treeItem p {
          margin: 6px 0 0;
          color: inherit;
          opacity: .75;
          font-size: 13px;
          font-weight: 800;
        }

        .treeItem span {
          font-weight: 900;
          white-space: nowrap;
        }

        .gain { color: #176b3a; }
        .loss { color: #a33c2a; }
        .treeItem.active .gain,
        .treeItem.active .loss { color: #d9b45f; }

        .detail {
          padding: 24px;
        }

        .detailTop {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 18px;
        }

        .detailTop h2 {
          margin: 0;
          font-size: 36px;
          color: #101a14;
        }

        .detailTop span {
          display: block;
          margin-top: 8px;
          color: #6b6b62;
          font-weight: 900;
        }

        .qrBadge {
          width: 120px;
          height: 120px;
          border-radius: 26px;
          display: grid;
          place-items: center;
          text-align: center;
          color: white;
          background: linear-gradient(135deg, #244536, #10281f);
        }

        .qrBadge strong {
          font-size: 34px;
        }

        .qrBadge p {
          margin: -18px 0 0;
          font-size: 12px;
          opacity: .7;
          font-weight: 900;
        }

        .growth,
        .moneyBox,
        .history {
          padding: 20px;
          margin-top: 18px;
        }

        .panelHead h3 {
          margin: 0;
          font-size: 24px;
          color: #101a14;
        }

        .panelHead p {
          margin: 6px 0 0;
          color: #6b6b62;
          font-size: 14px;
        }

        .stageLine {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
          margin-top: 18px;
        }

        .stage {
          border-radius: 20px;
          padding: 16px;
          background: #f3ead8;
          border: 1px solid rgba(92,70,35,.08);
          text-align: center;
        }

        .stage span {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          margin: 0 auto 10px;
          background: rgba(214,178,94,.25);
          color: #8c6a3c;
          font-weight: 900;
        }

        .stage strong {
          font-size: 13px;
          color: #6b6b62;
        }

        .stage.done {
          background: rgba(49,85,61,.12);
        }

        .stage.done span {
          background: #244536;
          color: white;
        }

        .stage.current {
          outline: 3px solid rgba(214,178,94,.45);
        }

        .cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 18px;
        }

        .mini,
        .money,
        .requestRow {
          border-radius: 18px;
          background: #f3ead8;
          padding: 14px;
          border: 1px solid rgba(92,70,35,.08);
        }

        .mini span,
        .money span {
          display: block;
          color: #6b6b62;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .1em;
        }

        .mini strong,
        .money strong {
          display: block;
          margin-top: 7px;
          color: #101a14;
          font-size: 16px;
        }

        .moneyGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 18px;
        }

        .money.strong {
          background: linear-gradient(135deg, #244536, #10281f);
        }

        .money.strong span,
        .money.strong strong {
          color: white;
        }

        .money.good strong {
          color: #176b3a;
        }

        .money.strong.good strong {
          color: #d9b45f;
        }

        .actions {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-top: 18px;
        }

        .actions button {
          border: 0;
          border-radius: 18px;
          padding: 15px;
          background: #f3ead8;
          color: #244536;
          font-weight: 900;
          cursor: pointer;
        }

        .actions .sell {
          background: linear-gradient(135deg, #d6b25e, #b99242);
          color: #10281f;
        }

        .requestList {
          display: grid;
          gap: 12px;
          margin-top: 16px;
        }

        .requestRow {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
        }

        .requestRow p {
          margin: 6px 0 0;
          color: #6b6b62;
          font-size: 13px;
        }

        .requestRow span {
          border-radius: 999px;
          padding: 8px 12px;
          background: rgba(214,178,94,.20);
          color: #8c6a3c;
          font-weight: 900;
          font-size: 12px;
        }

        @media (max-width: 1180px) {
          .stats,
          .stageLine,
          .cards,
          .moneyGrid,
          .actions {
            grid-template-columns: repeat(2, 1fr);
          }

          .layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .page {
            padding: 18px;
          }

          .hero h1 {
            font-size: 34px;
          }

          .stats,
          .stageLine,
          .cards,
          .moneyGrid,
          .actions {
            grid-template-columns: 1fr;
          }

          .detailTop {
            flex-direction: column;
          }

          .qrBadge {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}

function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className={`stat ${good ? "good" : ""}`}>
      <p>{label}</p>
      <h3>{value}</h3>
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

function Money({
  label,
  value,
  strong,
  good,
  percent,
}: {
  label: string;
  value: number;
  strong?: boolean;
  good?: boolean;
  percent?: boolean;
}) {
  return (
    <div className={`money ${strong ? "strong" : ""} ${good ? "good" : ""}`}>
      <span>{label}</span>
      <strong>{percent ? `${value.toFixed(2)}%` : peso(value)}</strong>
    </div>
  );
}

function getTreeMath(tree: TreeRow) {
  const totalSpent = getTotalSpent(tree);
  const estimatedValue = getEstimatedValue(tree);
  const profit = estimatedValue - totalSpent;
  const roi = totalSpent > 0 ? (profit / totalSpent) * 100 : 0;

  return { totalSpent, estimatedValue, profit, roi };
}

function getPurchasePrice(tree: TreeRow) {
  return Number(tree.purchase_price || tree.buy_price || tree.price || tree.investment_amount || 0);
}

function getOperationCost(tree: TreeRow) {
  return Number(tree.operation_cost || tree.operations_cost || tree.care_cost || tree.total_operation_cost || 0);
}

function getVerificationCost(tree: TreeRow) {
  return Number(tree.verification_cost || tree.gps_photo_cost || tree.photo_fee_total || tree.gps_fee_total || 0);
}

function getTotalSpent(tree: TreeRow) {
  return Number(tree.total_spent || getPurchasePrice(tree) + getOperationCost(tree) + getVerificationCost(tree));
}

function getEstimatedValue(tree: TreeRow) {
  return Number(tree.estimated_value || tree.current_value || tree.selling_price || 0);
}

function normalizeStage(value: string | null | undefined) {
  if (!value) return "Seedling";
  return value;
}

function getAgeText(tree: TreeRow) {
  if (tree.age_text) return tree.age_text;
  if (!tree.planting_date && !tree.created_at) return "—";

  const start = new Date(tree.planting_date || tree.created_at);
  const now = new Date();
  const months = Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth()
  );

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years <= 0) return `${remainingMonths} month${remainingMonths === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"} ${remainingMonths} month${remainingMonths === 1 ? "" : "s"}`;
}

function peso(value: number) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}