"use client";

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
  description: string | null;
  reference_no: string | null;
  created_at: string | null;
};

type SellTreeRequest = {
  id: string;
  tree_id: string | null;
  tree_value: number | null;
  expected_amount: number | null;
  selling_price: number | null;
  platform_fee: number | null;
  net_receive: number | null;
  status: string | null;
  created_at: string | null;
};

type ViewMode = "TREE" | "GROUP" | "PACKAGE" | "LEDGER";

export default function InvestmentsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [sellRequests, setSellRequests] = useState<SellTreeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("TREE");

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

    const profileId = currentProfile.id;

    const { data: walletRows } = await supabase
      .from("wallets")
      .select("id, profile_id, balance, created_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(1);

    const { data: treeData, error: treeError } = await supabase
      .from("trees")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    if (treeError) {
      setMessage(treeError.message);
      setLoading(false);
      return;
    }

    const { data: transactionData } = await supabase
      .from("wallet_transactions")
      .select("id, transaction_type, amount, status, description, reference_no, created_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    const { data: sellData } = await supabase
      .from("sell_tree_requests")
      .select("id, tree_id, tree_value, expected_amount, selling_price, platform_fee, net_receive, status, created_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    setWallet(walletRows?.[0] || null);
    setTrees(treeData || []);
    setTransactions(transactionData || []);
    setSellRequests(sellData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadInvestments();
  }, []);

  const stats = useMemo(() => {
    const ownedTrees = trees.filter((tree) => !isSold(tree)).length;
    const pendingSaleTrees = sellRequests.filter(
      (item) => (item.status || "PENDING").toUpperCase() === "PENDING"
    ).length;
    const soldTrees = trees.filter((tree) => isSold(tree)).length;

    const purchaseCapital = trees.reduce((sum, tree) => sum + getPurchasePrice(tree), 0);
    const careCosts = trees.reduce((sum, tree) => sum + getCareCost(tree), 0);
    const verificationCosts = trees.reduce((sum, tree) => sum + getVerificationCost(tree), 0);
    const totalSpent = purchaseCapital + careCosts + verificationCosts;

    const currentValue = trees
      .filter((tree) => !isSold(tree))
      .reduce((sum, tree) => sum + getEstimatedValue(tree), 0);

    const projectedProfit = currentValue - totalSpent;
    const roi = totalSpent > 0 ? (projectedProfit / totalSpent) * 100 : 0;

    const realizedSales = transactions
      .filter((item) => (item.transaction_type || "").toUpperCase() === "TREE_SALE")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      ownedTrees,
      pendingSaleTrees,
      soldTrees,
      purchaseCapital,
      careCosts,
      verificationCosts,
      totalSpent,
      currentValue,
      projectedProfit,
      roi,
      realizedSales,
    };
  }, [trees, transactions, sellRequests]);

  const treeInvestments = useMemo(() => {
    return trees.map((tree) => buildTreeInvestment(tree));
  }, [trees]);

  const groupInvestments = useMemo(() => {
    return buildGroupedInvestments(trees, "GROUP");
  }, [trees]);

  const packageInvestments = useMemo(() => {
    return buildGroupedInvestments(trees, "PACKAGE");
  }, [trees]);

  const investmentTransactions = useMemo(() => {
    return transactions.filter((item) =>
      [
        "TREE_PURCHASE",
        "PACKAGE_PURCHASE",
        "TREE_OPERATION",
        "TREE_SALE",
        "MARKETPLACE_PURCHASE",
        "MEMBERSHIP_PAYMENT",
        "CARE_SUBSCRIPTION",
      ].includes((item.transaction_type || "").toUpperCase())
    );
  }, [transactions]);

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Agarwood Investment Center V4</p>
          <h1>Investments</h1>
          <span>
            Review your tree capital, care costs, current valuation, projected
            profit, ROI, and investment activity. This page does not manage inventory.
          </span>
        </div>

        <div className="walletCard">
          <p>Wallet Balance</p>
          <strong>{peso(Number(wallet?.balance || 0))}</strong>
          <small>{profile?.membership_status || "MEMBERSHIP"} • {profile?.kyc_status || "KYC"}</small>
        </div>
      </section>

      {loading ? (
        <div className="empty">Loading investment records...</div>
      ) : (
        <>
          {message && <div className="message">{message}</div>}

          <section className="stats">
            <Stat label="Owned Trees" value={String(stats.ownedTrees)} />
            <Stat label="Total Capital" value={peso(stats.totalSpent)} />
            <Stat label="Portfolio Value" value={peso(stats.currentValue)} />
            <Stat
              label="Projected Profit"
              value={peso(stats.projectedProfit)}
              good={stats.projectedProfit >= 0}
            />
            <Stat label="Portfolio ROI" value={`${stats.roi.toFixed(2)}%`} good={stats.roi >= 0} />
          </section>

          <section className="summaryGrid">
            <section className="panel">
              <PanelHead
                title="Portfolio Cost Breakdown"
                text="Investment computation is based on tree purchase price, care cost, and verification cost."
              />

              <div className="moneyGrid">
                <Mini label="Purchase Capital" value={peso(stats.purchaseCapital)} />
                <Mini label="Care Cost" value={peso(stats.careCosts)} />
                <Mini label="GPS / Photo Cost" value={peso(stats.verificationCosts)} />
                <Mini label="Total Spent" value={peso(stats.totalSpent)} />
                <Mini label="Realized Sales" value={peso(stats.realizedSales)} />
                <Mini label="Pending Sale Requests" value={String(stats.pendingSaleTrees)} />
              </div>
            </section>

            <section className="panel">
              <PanelHead
                title="Investment Snapshot"
                text="Compare current value against total capital and care cost."
              />

              <div className="roiBox">
                <p>Projected ROI</p>
                <strong className={stats.roi >= 0 ? "positive" : "negative"}>
                  {stats.roi.toFixed(2)}%
                </strong>
                <div className="roiTrack">
                  <i style={{ width: `${Math.min(Math.abs(stats.roi), 100)}%` }} />
                </div>
                <small>
                  ROI = projected profit divided by total spent.
                </small>
              </div>
            </section>
          </section>

          <section className="tabs">
            <button className={viewMode === "TREE" ? "active" : ""} onClick={() => setViewMode("TREE")}>
              By Tree
            </button>
            <button className={viewMode === "GROUP" ? "active" : ""} onClick={() => setViewMode("GROUP")}>
              By Group
            </button>
            <button className={viewMode === "PACKAGE" ? "active" : ""} onClick={() => setViewMode("PACKAGE")}>
              By Package
            </button>
            <button className={viewMode === "LEDGER" ? "active" : ""} onClick={() => setViewMode("LEDGER")}>
              Ledger
            </button>
          </section>

          {viewMode === "TREE" && (
            <section className="panel">
              <PanelHead
                title="Tree Investment View"
                text="Each tree shows cost, estimated value, profit/loss, and ROI."
              />

              {treeInvestments.length === 0 ? (
                <div className="empty small">No trees found yet.</div>
              ) : (
                <div className="investmentList">
                  {treeInvestments.map((item) => (
                    <InvestmentRow key={item.id} item={item} />
                  ))}
                </div>
              )}
            </section>
          )}

          {viewMode === "GROUP" && (
            <section className="panel">
              <PanelHead
                title="Group Investment View"
                text="Grouped by tree_group_name from My Trees."
              />

              {groupInvestments.length === 0 ? (
                <div className="empty small">No groups found yet.</div>
              ) : (
                <div className="investmentList">
                  {groupInvestments.map((item) => (
                    <GroupRow key={item.name} item={item} />
                  ))}
                </div>
              )}
            </section>
          )}

          {viewMode === "PACKAGE" && (
            <section className="panel">
              <PanelHead
                title="Package Investment View"
                text="Grouped by package_name from Marketplace package purchases."
              />

              {packageInvestments.length === 0 ? (
                <div className="empty small">No package records found yet.</div>
              ) : (
                <div className="investmentList">
                  {packageInvestments.map((item) => (
                    <GroupRow key={item.name} item={item} />
                  ))}
                </div>
              )}
            </section>
          )}

          {viewMode === "LEDGER" && (
            <section className="panel">
              <PanelHead
                title="Investment Ledger"
                text="Wallet transaction records related to tree investment activity."
              />

              {investmentTransactions.length === 0 ? (
                <div className="empty small">No investment ledger records yet.</div>
              ) : (
                <div className="ledger">
                  {investmentTransactions.slice(0, 30).map((item) => (
                    <div className="ledgerRow" key={item.id}>
                      <div>
                        <strong>{cleanType(item.transaction_type)}</strong>
                        <p>{item.description || "Investment transaction"}</p>
                        <small>{formatDate(item.created_at)}</small>
                      </div>

                      <div className="ledgerRight">
                        <span className={`status ${statusClass(item.status)}`}>
                          {item.status || "COMPLETED"}
                        </span>
                        <b>{peso(Number(item.amount || 0))}</b>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="panel salePanel">
            <PanelHead
              title="Sell Request Watch"
              text="Sale requests are shown for investment visibility. Wallet is credited only after admin approval."
            />

            {sellRequests.length === 0 ? (
              <div className="empty small">No sell tree requests yet.</div>
            ) : (
              <div className="ledger">
                {sellRequests.map((item) => {
                  const tree = trees.find(
                    (row) => row.id === item.tree_id || row.tree_code === item.tree_id
                  );

                  const expectedNet = Number(
                    item.net_receive ||
                      item.expected_amount ||
                      item.selling_price ||
                      item.tree_value ||
                      0
                  );

                  return (
                    <div className="ledgerRow" key={item.id}>
                      <div>
                        <strong>{tree?.tree_code || item.tree_id || "Tree Request"}</strong>
                        <p>Expected Net: {peso(expectedNet)}</p>
                        <small>{formatDate(item.created_at)}</small>
                      </div>

                      <div className="ledgerRight">
                        <span className={`status ${statusClass(item.status)}`}>
                          {item.status || "PENDING"}
                        </span>
                      </div>
                    </div>
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
          align-items: stretch;
          gap: 18px;
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

        .walletCard {
          min-width: 280px;
          border-radius: 28px;
          padding: 22px;
          color: white;
          background:
            radial-gradient(circle at 80% 18%, rgba(214,178,94,.44), transparent 34%),
            linear-gradient(135deg, #244536, #10281f);
          box-shadow: 0 24px 56px rgba(36,69,54,.24);
        }

        .walletCard p {
          margin: 0;
          color: rgba(255,255,255,.72);
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .14em;
          font-size: 12px;
        }

        .walletCard strong {
          display: block;
          margin-top: 10px;
          font-size: 30px;
        }

        .walletCard small {
          color: rgba(255,255,255,.72);
          font-weight: 900;
        }

        .message,
        .empty,
        .stat,
        .panel {
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
          margin-bottom: 18px;
        }

        .small {
          box-shadow: none;
          border-radius: 18px;
          background: #f3ead8;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
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
          font-size: 26px;
        }

        .stat.good h3 {
          color: #176b3a;
        }

        .summaryGrid {
          display: grid;
          grid-template-columns: 1.2fr .8fr;
          gap: 16px;
          margin-bottom: 18px;
        }

        .panel {
          padding: 22px;
          margin-bottom: 18px;
        }

        .panelHead h2 {
          margin: 0;
          color: #101a14;
          font-size: 24px;
        }

        .panelHead p {
          margin: 6px 0 0;
          color: #6b6b62;
          line-height: 1.5;
          font-size: 14px;
        }

        .moneyGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 18px;
        }

        .mini {
          border-radius: 18px;
          background: #f3ead8;
          padding: 15px;
          border: 1px solid rgba(92,70,35,.08);
        }

        .mini span {
          display: block;
          color: #6b6b62;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .1em;
        }

        .mini strong {
          display: block;
          margin-top: 8px;
          color: #101a14;
          font-size: 17px;
        }

        .roiBox {
          margin-top: 18px;
          border-radius: 24px;
          padding: 22px;
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
        }

        .roiBox p {
          margin: 0;
          color: rgba(255,255,255,.72);
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .roiBox strong {
          display: block;
          margin-top: 10px;
          font-size: 40px;
        }

        .roiTrack {
          height: 10px;
          border-radius: 999px;
          background: rgba(255,255,255,.12);
          margin: 18px 0 12px;
          overflow: hidden;
        }

        .roiTrack i {
          display: block;
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(135deg, #d6b25e, #fff3bc);
        }

        .roiBox small {
          color: rgba(255,255,255,.70);
          font-weight: 900;
        }

        .tabs {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 18px;
        }

        .tabs button {
          border: 0;
          border-radius: 18px;
          padding: 15px;
          background: rgba(255,253,246,.88);
          color: #244536;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 12px 28px rgba(82,60,27,.08);
        }

        .tabs button.active {
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
        }

        .investmentList,
        .ledger {
          display: grid;
          gap: 12px;
          margin-top: 18px;
        }

        .investmentRow,
        .ledgerRow {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: center;
          border-radius: 20px;
          padding: 16px;
          background: #f3ead8;
          border: 1px solid rgba(92,70,35,.08);
        }

        .investmentRow strong,
        .ledgerRow strong {
          color: #101a14;
          font-size: 17px;
        }

        .investmentRow p,
        .ledgerRow p {
          margin: 6px 0 0;
          color: #6b6b62;
          font-size: 13px;
          font-weight: 800;
        }

        .investmentRow small,
        .ledgerRow small {
          display: block;
          margin-top: 6px;
          color: #8c6a3c;
          font-size: 12px;
          font-weight: 900;
        }

        .numbers {
          display: grid;
          justify-items: end;
          gap: 6px;
          min-width: 280px;
        }

        .numbers span {
          color: #6b6b62;
          font-size: 12px;
          font-weight: 900;
        }

        .numbers b {
          font-size: 17px;
        }

        .positive {
          color: #176b3a;
        }

        .negative {
          color: #a33c2a;
        }

        .ledgerRight {
          display: grid;
          justify-items: end;
          gap: 8px;
        }

        .ledgerRight b {
          color: #244536;
        }

        .status {
          display: inline-flex;
          justify-content: center;
          min-width: 92px;
          border-radius: 999px;
          padding: 8px 10px;
          font-size: 11px;
          font-weight: 900;
        }

        .status.pending {
          background: rgba(214,178,94,.20);
          color: #8c6a3c;
        }

        .status.approved,
        .status.completed {
          background: rgba(49,85,61,.12);
          color: #31553d;
        }

        .status.rejected,
        .status.failed {
          background: rgba(163,60,42,.12);
          color: #a33c2a;
        }

        .salePanel {
          margin-top: 18px;
        }

        @media (max-width: 1200px) {
          .stats,
          .moneyGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .summaryGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .page {
            padding: 18px;
          }

          .hero {
            flex-direction: column;
          }

          .hero h1 {
            font-size: 34px;
          }

          .walletCard {
            min-width: 100%;
          }

          .stats,
          .moneyGrid,
          .tabs,
          .investmentRow,
          .ledgerRow {
            grid-template-columns: 1fr;
          }

          .numbers,
          .ledgerRight {
            justify-items: start;
            min-width: 0;
          }
        }
      `}</style>
    </main>
  );
}

function InvestmentRow({ item }: { item: ReturnType<typeof buildTreeInvestment> }) {
  return (
    <div className="investmentRow">
      <div>
        <strong>{item.code}</strong>
        <p>{item.name}</p>
        <small>{item.groupName} • {item.packageName}</small>
      </div>

      <div className="numbers">
        <span>Purchase: {peso(item.purchasePrice)}</span>
        <span>Care: {peso(item.careCost)} • Verification: {peso(item.verificationCost)}</span>
        <span>Total Spent: {peso(item.totalSpent)}</span>
        <span>Current Value: {peso(item.currentValue)}</span>
        <b className={item.profit >= 0 ? "positive" : "negative"}>
          {item.profit >= 0 ? "+" : ""}
          {peso(item.profit)} / {item.roi.toFixed(2)}%
        </b>
      </div>
    </div>
  );
}

function GroupRow({ item }: { item: ReturnType<typeof buildGroupedInvestments>[number] }) {
  return (
    <div className="investmentRow">
      <div>
        <strong>{item.name}</strong>
        <p>
          {item.treeCount} tree{item.treeCount === 1 ? "" : "s"}
        </p>
        <small>Total current value: {peso(item.currentValue)}</small>
      </div>

      <div className="numbers">
        <span>Purchase: {peso(item.purchaseCapital)}</span>
        <span>Care: {peso(item.careCosts)} • Verification: {peso(item.verificationCosts)}</span>
        <span>Total Spent: {peso(item.totalSpent)}</span>
        <span>Current Value: {peso(item.currentValue)}</span>
        <b className={item.profit >= 0 ? "positive" : "negative"}>
          {item.profit >= 0 ? "+" : ""}
          {peso(item.profit)} / {item.roi.toFixed(2)}%
        </b>
      </div>
    </div>
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

function PanelHead({ title, text }: { title: string; text: string }) {
  return (
    <div className="panelHead">
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

function buildTreeInvestment(tree: TreeRow) {
  const purchasePrice = getPurchasePrice(tree);
  const careCost = getCareCost(tree);
  const verificationCost = getVerificationCost(tree);
  const totalSpent = purchasePrice + careCost + verificationCost;
  const currentValue = getEstimatedValue(tree);
  const profit = currentValue - totalSpent;
  const roi = totalSpent > 0 ? (profit / totalSpent) * 100 : 0;

  return {
    id: tree.id,
    code: tree.tree_code || tree.code || tree.id,
    name: tree.custom_name || tree.display_name || tree.name || "Agarwood Tree",
    groupName: tree.tree_group_name || "Ungrouped Trees",
    packageName: tree.package_name || "No Package",
    purchasePrice,
    careCost,
    verificationCost,
    totalSpent,
    currentValue,
    profit,
    roi,
  };
}

function buildGroupedInvestments(trees: TreeRow[], mode: "GROUP" | "PACKAGE") {
  const map: Record<string, TreeRow[]> = {};

  trees.forEach((tree) => {
    const key =
      mode === "GROUP"
        ? tree.tree_group_name || "Ungrouped Trees"
        : tree.package_name || "No Package";

    if (!map[key]) map[key] = [];
    map[key].push(tree);
  });

  return Object.entries(map).map(([name, groupTrees]) => {
    const purchaseCapital = groupTrees.reduce((sum, tree) => sum + getPurchasePrice(tree), 0);
    const careCosts = groupTrees.reduce((sum, tree) => sum + getCareCost(tree), 0);
    const verificationCosts = groupTrees.reduce((sum, tree) => sum + getVerificationCost(tree), 0);
    const totalSpent = purchaseCapital + careCosts + verificationCosts;
    const currentValue = groupTrees.reduce((sum, tree) => sum + getEstimatedValue(tree), 0);
    const profit = currentValue - totalSpent;
    const roi = totalSpent > 0 ? (profit / totalSpent) * 100 : 0;

    return {
      name,
      treeCount: groupTrees.length,
      purchaseCapital,
      careCosts,
      verificationCosts,
      totalSpent,
      currentValue,
      profit,
      roi,
    };
  });
}

function isSold(tree: TreeRow) {
  const ownership = String(tree.ownership_status || "").toUpperCase();
  const availability = String(tree.availability_status || "").toUpperCase();

  return ownership === "SOLD" || availability === "SOLD";
}

function getPurchasePrice(tree: TreeRow) {
  return Number(
    tree.purchase_price ||
      tree.buy_price ||
      tree.tree_price ||
      tree.price ||
      tree.investment_amount ||
      0
  );
}

function getCareCost(tree: TreeRow) {
  return Number(
    tree.care_cost ||
      tree.operation_cost ||
      tree.operations_cost ||
      tree.total_operation_cost ||
      0
  );
}

function getVerificationCost(tree: TreeRow) {
  return Number(
    tree.verification_cost ||
      tree.gps_photo_cost ||
      tree.photo_fee_total ||
      tree.gps_fee_total ||
      tree.gps_fee ||
      tree.photo_fee ||
      0
  );
}

function getEstimatedValue(tree: TreeRow) {
  return Number(
    tree.estimated_value ||
      tree.current_value ||
      tree.market_value ||
      tree.selling_price ||
      0
  );
}

function cleanType(value: string | null) {
  return String(value || "TRANSACTION").replaceAll("_", " ");
}

function statusClass(value: string | null) {
  return (value || "pending").toLowerCase().replaceAll(" ", "_");
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function peso(value: number) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
