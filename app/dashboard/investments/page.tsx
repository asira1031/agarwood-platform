"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TreeRow = Record<string, any>;
type OperationRequest = Record<string, any>;

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  auto_renew?: boolean | null;
};

type ViewMode = "TREE" | "GROUP" | "PACKAGE" | "LEDGER";

function peso(value: number) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function numberValue(value: any) {
  return Number(value || 0);
}

function normalizeStatus(value: any) {
  return String(value || "NOT_ENROLLED").trim().toUpperCase();
}

function getTreeName(tree: TreeRow) {
  return (
    tree.custom_name ||
    tree.display_name ||
    tree.name ||
    tree.tree_code ||
    "Agarwood Tree"
  );
}

function getTreeCode(tree: TreeRow) {
  return tree.tree_code || tree.code || tree.id;
}

function getGroupName(tree: TreeRow) {
  return tree.tree_group_name || tree.group_name || "Ungrouped Trees";
}

function getPackageName(tree: TreeRow) {
  return tree.package_name || "Single Tree Purchase";
}

function getPurchasePrice(tree: TreeRow) {
  return numberValue(tree.purchase_price || tree.price || tree.original_price);
}

function getOperationCost(tree: TreeRow) {
  return numberValue(tree.operation_cost || tree.care_cost);
}

function getVerificationCost(tree: TreeRow) {
  return numberValue(tree.verification_cost || tree.gps_fee || tree.photo_fee);
}

function getCareProgramCost(tree: TreeRow) {
  return numberValue(tree.care_program_price);
}

function getCurrentValue(tree: TreeRow) {
  return numberValue(tree.estimated_value || tree.current_value || tree.selling_price);
}

function getTotalSpent(tree: TreeRow) {
  return (
    getPurchasePrice(tree) +
    getOperationCost(tree) +
    getVerificationCost(tree) +
    getCareProgramCost(tree)
  );
}

function getProfit(tree: TreeRow) {
  return getCurrentValue(tree) - getTotalSpent(tree);
}

function getRoi(tree: TreeRow) {
  const totalSpent = getTotalSpent(tree);
  if (totalSpent <= 0) return 0;
  return (getProfit(tree) / totalSpent) * 100;
}

function statusClass(value: any) {
  const status = normalizeStatus(value);
  if (["ACTIVE", "APPROVED", "COVERED"].includes(status)) return "good";
  if (["PENDING", "WAITING", "PROCESSING"].includes(status)) return "warning";
  if (["EXPIRED", "CANCELLED", "REJECTED", "FAILED"].includes(status)) return "bad";
  return "neutral";
}

export default function InvestmentsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [requests, setRequests] = useState<OperationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("TREE");
  const [selectedTreeId, setSelectedTreeId] = useState("");

  async function loadInvestments() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      setMessage(userError.message);
      setLoading(false);
      return;
    }

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const email = user.email?.trim().toLowerCase() || "";

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, full_name, email, auto_renew")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, full_name, email, auto_renew")
      .eq("email", email)
      .maybeSingle();

    const currentProfile = profileById || profileByEmail;

    if (!currentProfile) {
      setMessage("Profile not found.");
      setLoading(false);
      return;
    }

    setProfile(currentProfile);

    const { data: treeData, error: treeError } = await supabase
      .from("trees")
      .select("*")
      .eq("profile_id", currentProfile.id)
      .order("created_at", { ascending: false });

    if (treeError) {
      setMessage(treeError.message);
      setLoading(false);
      return;
    }

    const { data: requestData } = await supabase
      .from("tree_operation_requests")
      .select("*")
      .eq("profile_id", currentProfile.id)
      .order("created_at", { ascending: false });

    const rows = (treeData || []) as TreeRow[];

    setTrees(rows);
    setRequests((requestData || []) as OperationRequest[]);
    setSelectedTreeId((current) => current || rows[0]?.id || "");
    setLoading(false);
  }

  useEffect(() => {
    loadInvestments();
  }, []);

  const selectedTree = useMemo(() => {
    return trees.find((tree) => tree.id === selectedTreeId) || trees[0] || null;
  }, [trees, selectedTreeId]);

  const stats = useMemo(() => {
    const totalPurchase = trees.reduce((sum, tree) => sum + getPurchasePrice(tree), 0);
    const totalCareProgram = trees.reduce((sum, tree) => sum + getCareProgramCost(tree), 0);
    const totalOperation = trees.reduce((sum, tree) => sum + getOperationCost(tree), 0);
    const totalVerification = trees.reduce((sum, tree) => sum + getVerificationCost(tree), 0);
    const totalSpent = trees.reduce((sum, tree) => sum + getTotalSpent(tree), 0);
    const currentValue = trees.reduce((sum, tree) => sum + getCurrentValue(tree), 0);
    const profit = currentValue - totalSpent;
    const roi = totalSpent > 0 ? (profit / totalSpent) * 100 : 0;

    return {
      ownedTrees: trees.length,
      totalPurchase,
      totalCareProgram,
      totalOperation,
      totalVerification,
      totalSpent,
      currentValue,
      profit,
      roi,
    };
  }, [trees]);

  const groupRows = useMemo(() => {
    const map: Record<string, TreeRow[]> = {};

    trees.forEach((tree) => {
      const group = getGroupName(tree);
      if (!map[group]) map[group] = [];
      map[group].push(tree);
    });

    return Object.entries(map).map(([name, groupTrees]) => {
      const totalSpent = groupTrees.reduce((sum, tree) => sum + getTotalSpent(tree), 0);
      const currentValue = groupTrees.reduce((sum, tree) => sum + getCurrentValue(tree), 0);
      const profit = currentValue - totalSpent;

      return {
        name,
        count: groupTrees.length,
        purchase: groupTrees.reduce((sum, tree) => sum + getPurchasePrice(tree), 0),
        careProgram: groupTrees.reduce((sum, tree) => sum + getCareProgramCost(tree), 0),
        operation: groupTrees.reduce((sum, tree) => sum + getOperationCost(tree), 0),
        verification: groupTrees.reduce((sum, tree) => sum + getVerificationCost(tree), 0),
        totalSpent,
        currentValue,
        profit,
        roi: totalSpent > 0 ? (profit / totalSpent) * 100 : 0,
      };
    });
  }, [trees]);

  const packageRows = useMemo(() => {
    const map: Record<string, TreeRow[]> = {};

    trees.forEach((tree) => {
      const packageName = getPackageName(tree);
      if (!map[packageName]) map[packageName] = [];
      map[packageName].push(tree);
    });

    return Object.entries(map).map(([name, packageTrees]) => {
      const totalSpent = packageTrees.reduce((sum, tree) => sum + getTotalSpent(tree), 0);
      const currentValue = packageTrees.reduce((sum, tree) => sum + getCurrentValue(tree), 0);
      const profit = currentValue - totalSpent;

      return {
        name,
        count: packageTrees.length,
        purchase: packageTrees.reduce((sum, tree) => sum + getPurchasePrice(tree), 0),
        careProgram: packageTrees.reduce((sum, tree) => sum + getCareProgramCost(tree), 0),
        operation: packageTrees.reduce((sum, tree) => sum + getOperationCost(tree), 0),
        verification: packageTrees.reduce((sum, tree) => sum + getVerificationCost(tree), 0),
        totalSpent,
        currentValue,
        profit,
        roi: totalSpent > 0 ? (profit / totalSpent) * 100 : 0,
      };
    });
  }, [trees]);

  const careProgramRequests = useMemo(() => {
    return requests.filter((request) => {
      const name = String(
        request.care_program_name || request.operation_type || ""
      ).toLowerCase();

      return name.includes("care") || name.includes("program") || name.includes("subscription");
    });
  }, [requests]);

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Agarwood Investments V5</p>
          <h1>Investment Portfolio</h1>
          <span>
            Track your trees by tree, group, package, and ledger. Care program
            cost is included in ROI, but this page is display-only and does not
            charge wallet or create renewals.
          </span>
        </div>

        <div className="heroCard">
          <p>Portfolio ROI</p>
          <strong className={stats.roi >= 0 ? "goodText" : "badText"}>
            {stats.roi.toFixed(2)}%
          </strong>
          <small>{profile?.auto_renew ? "Auto Renew: ON" : "Auto Renew: OFF"}</small>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      {loading ? (
        <div className="empty">Loading investments...</div>
      ) : trees.length === 0 ? (
        <div className="empty">
          No tree investments found yet. Buy trees or packages from Marketplace first.
        </div>
      ) : (
        <>
          <section className="stats">
            <Card label="Owned Trees" value={String(stats.ownedTrees)} />
            <Card label="Total Spent" value={peso(stats.totalSpent)} />
            <Card label="Current Value" value={peso(stats.currentValue)} />
            <Card
              label="Profit / Loss"
              value={peso(stats.profit)}
              good={stats.profit >= 0}
              bad={stats.profit < 0}
            />
          </section>

          <section className="stats second">
            <Card label="Purchase Price" value={peso(stats.totalPurchase)} />
            <Card label="Care Program Cost" value={peso(stats.totalCareProgram)} />
            <Card label="Operation Cost" value={peso(stats.totalOperation)} />
            <Card label="Verification Cost" value={peso(stats.totalVerification)} />
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
            <section className="layout">
              <aside className="treeList">
                {trees.map((tree) => {
                  const active = selectedTree?.id === tree.id;

                  return (
                    <button
                      key={tree.id}
                      className={`treeItem ${active ? "active" : ""}`}
                      onClick={() => setSelectedTreeId(tree.id)}
                    >
                      <div>
                        <strong>{getTreeCode(tree)}</strong>
                        <p>{getTreeName(tree)}</p>
                        <small>{getGroupName(tree)}</small>
                      </div>

                      <span className={getProfit(tree) >= 0 ? "gain" : "loss"}>
                        {peso(getProfit(tree))}
                      </span>
                    </button>
                  );
                })}
              </aside>

              {selectedTree && (
                <section className="detail">
                  <div className="detailTop">
                    <div>
                      <p className="eyebrow">Selected Asset</p>
                      <h2>{getTreeName(selectedTree)}</h2>
                      <span>{getTreeCode(selectedTree)}</span>
                    </div>

                    <div className={`statusBox ${statusClass(selectedTree.care_program_status)}`}>
                      <small>Care Program</small>
                      <strong>{selectedTree.care_plan || "Not Enrolled"}</strong>
                      <p>{normalizeStatus(selectedTree.care_program_status)}</p>
                    </div>
                  </div>

                  <section className="moneyGrid">
                    <Money label="Purchase Price" value={getPurchasePrice(selectedTree)} />
                    <Money label="Care Program Cost" value={getCareProgramCost(selectedTree)} />
                    <Money label="Operation Cost" value={getOperationCost(selectedTree)} />
                    <Money label="Verification Cost" value={getVerificationCost(selectedTree)} />
                    <Money label="Total Spent" value={getTotalSpent(selectedTree)} strong />
                    <Money label="Current Value" value={getCurrentValue(selectedTree)} />
                    <Money
                      label="Profit / Loss"
                      value={getProfit(selectedTree)}
                      strong
                      good={getProfit(selectedTree) >= 0}
                    />
                    <Money label="ROI" value={getRoi(selectedTree)} percent good={getRoi(selectedTree) >= 0} />
                  </section>

                  <section className="syncPanel">
                    <div className="panelHead">
                      <div>
                        <h3>Care Program Sync</h3>
                        <p>
                          Display-only status from the tree record. Renewal is
                          shown for planning only and does not auto-charge.
                        </p>
                      </div>
                    </div>

                    <div className="syncGrid">
                      <Mini label="Current Program" value={selectedTree.care_plan || "Not Enrolled"} />
                      <Mini
                        label="Program Status"
                        value={normalizeStatus(selectedTree.care_program_status)}
                      />
                      <Mini
                        label="Coverage"
                        value={selectedTree.care_program_coverage || "No active coverage"}
                      />
                      <Mini
                        label="Next Renewal"
                        value={formatDate(selectedTree.care_program_next_renewal)}
                      />
                      <Mini
                        label="Program Price"
                        value={peso(getCareProgramCost(selectedTree))}
                      />
                      <Mini
                        label="Auto Renew"
                        value={
                          selectedTree.auto_renew_enabled || profile?.auto_renew
                            ? "ON - Display Only"
                            : "OFF"
                        }
                      />
                    </div>
                  </section>
                </section>
              )}
            </section>
          )}

          {viewMode === "GROUP" && (
            <section className="tablePanel">
              <PanelTitle
                title="Investments by Group"
                text="Grouped by tree_group_name. Includes care program cost in total spent."
              />

              <div className="table">
                {groupRows.map((row) => (
                  <SummaryRow key={row.name} row={row} />
                ))}
              </div>
            </section>
          )}

          {viewMode === "PACKAGE" && (
            <section className="tablePanel">
              <PanelTitle
                title="Investments by Package"
                text="Grouped by package_name. Single purchases are grouped separately."
              />

              <div className="table">
                {packageRows.map((row) => (
                  <SummaryRow key={row.name} row={row} />
                ))}
              </div>
            </section>
          )}

          {viewMode === "LEDGER" && (
            <section className="tablePanel">
              <PanelTitle
                title="Care Program Ledger"
                text="Care program history from operation requests. Display only."
              />

              {careProgramRequests.length === 0 ? (
                <div className="empty small">No care program ledger records yet.</div>
              ) : (
                <div className="ledgerList">
                  {careProgramRequests.map((request) => {
                    const tree = trees.find((item) => item.id === request.tree_id);

                    return (
                      <div className="ledgerRow" key={request.id}>
                        <div>
                          <strong>
                            {request.care_program_name ||
                              request.operation_type ||
                              "Care Program"}
                          </strong>
                          <p>
                            {tree ? getTreeCode(tree) : request.tree_id || "Unknown Tree"} •{" "}
                            {formatDate(request.created_at)}
                          </p>
                          <small>{request.notes || "No notes"}</small>
                        </div>

                        <div className="ledgerRight">
                          <span className={`statusPill ${statusClass(request.care_program_status || request.status)}`}>
                            {request.care_program_status || request.status || "PENDING"}
                          </span>
                          <b>
                            {peso(
                              numberValue(
                                request.care_program_price ||
                                  request.total_amount ||
                                  request.operation_fee
                              )
                            )}
                          </b>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
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
          color: #101a14;
          letter-spacing: -1.6px;
        }

        .hero span {
          display: block;
          margin-top: 8px;
          color: #5f665e;
          max-width: 850px;
          line-height: 1.6;
          font-weight: 700;
        }

        .heroCard {
          min-width: 280px;
          border-radius: 28px;
          padding: 22px;
          color: white;
          background:
            radial-gradient(circle at 80% 18%, rgba(214,178,94,.44), transparent 34%),
            linear-gradient(135deg, #244536, #10281f);
          box-shadow: 0 24px 56px rgba(36,69,54,.24);
        }

        .heroCard p {
          margin: 0;
          color: rgba(255,255,255,.72);
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .14em;
          font-size: 12px;
        }

        .heroCard strong {
          display: block;
          margin-top: 10px;
          font-size: 34px;
        }

        .heroCard small {
          display: block;
          margin-top: 6px;
          color: rgba(255,255,255,.74);
          font-weight: 900;
        }

        .goodText { color: #d8f6d5; }
        .badText { color: #ffd5c9; }

        .message,
        .empty,
        .card,
        .tabs,
        .treeList,
        .detail,
        .tablePanel,
        .syncPanel {
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
          background: #f3ead8;
          border-radius: 18px;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 18px;
        }

        .stats.second {
          margin-top: -6px;
        }

        .card {
          padding: 22px;
        }

        .card p {
          margin: 0;
          color: #6b6b62;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .card h3 {
          margin: 10px 0 0;
          color: #244536;
          font-size: 26px;
        }

        .card.good h3 {
          color: #31553d;
        }

        .card.bad h3 {
          color: #a33c2a;
        }

        .tabs {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          padding: 12px;
          margin-bottom: 18px;
        }

        .tabs button {
          border: 0;
          border-radius: 18px;
          padding: 14px;
          background: #f3ead8;
          color: #244536;
          font-weight: 900;
          cursor: pointer;
        }

        .tabs button.active {
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
        }

        .layout {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 16px;
          align-items: start;
        }

        .treeList {
          padding: 14px;
          display: grid;
          gap: 10px;
          max-height: 720px;
          overflow: auto;
        }

        .treeItem {
          border: 0;
          border-radius: 18px;
          padding: 14px;
          background: #f3ead8;
          color: #18261d;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          text-align: left;
          cursor: pointer;
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
          font-weight: 900;
          opacity: .8;
        }

        .treeItem small {
          display: block;
          margin-top: 4px;
          opacity: .68;
          font-weight: 800;
        }

        .gain { color: #31553d; font-weight: 900; }
        .loss { color: #a33c2a; font-weight: 900; }
        .treeItem.active .gain,
        .treeItem.active .loss { color: #d9b45f; }

        .detail {
          padding: 22px;
        }

        .detailTop {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: start;
          margin-bottom: 18px;
        }

        .detailTop h2 {
          margin: 0;
          color: #101a14;
          font-size: 32px;
        }

        .detailTop span {
          display: block;
          margin-top: 6px;
          color: #6b6b62;
          font-weight: 900;
        }

        .statusBox {
          min-width: 260px;
          border-radius: 22px;
          padding: 16px;
          background: #f3ead8;
        }

        .statusBox small {
          color: #6b6b62;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .10em;
        }

        .statusBox strong {
          display: block;
          margin-top: 8px;
          color: #10281f;
          font-size: 18px;
        }

        .statusBox p {
          margin: 6px 0 0;
          font-weight: 900;
        }

        .statusBox.good { background: rgba(49,85,61,.12); }
        .statusBox.warning { background: rgba(214,178,94,.20); }
        .statusBox.bad { background: rgba(163,60,42,.12); }

        .moneyGrid,
        .syncGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .money,
        .mini {
          border-radius: 18px;
          padding: 15px;
          background: #f3ead8;
        }

        .money span,
        .mini span {
          display: block;
          color: #6b6b62;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .10em;
        }

        .money b,
        .mini b {
          display: block;
          margin-top: 8px;
          color: #244536;
          font-size: 18px;
        }

        .money.strong {
          background: linear-gradient(135deg, #244536, #10281f);
        }

        .money.strong span,
        .money.strong b {
          color: white;
        }

        .money.good b {
          color: #31553d;
        }

        .syncPanel {
          padding: 18px;
          margin-top: 18px;
        }

        .panelHead h3,
        .panelTitle h2 {
          margin: 0;
          color: #101a14;
        }

        .panelHead p,
        .panelTitle p {
          margin: 6px 0 0;
          color: #6b6b62;
          line-height: 1.5;
          font-weight: 800;
        }

        .tablePanel {
          padding: 22px;
        }

        .table,
        .ledgerList {
          display: grid;
          gap: 12px;
          margin-top: 18px;
        }

        .summaryRow,
        .ledgerRow {
          border-radius: 20px;
          padding: 16px;
          background: #f3ead8;
          display: grid;
          grid-template-columns: 1.2fr repeat(5, .8fr);
          gap: 12px;
          align-items: center;
        }

        .ledgerRow {
          grid-template-columns: 1fr auto;
        }

        .summaryRow strong,
        .ledgerRow strong {
          color: #101a14;
        }

        .summaryRow p,
        .ledgerRow p {
          margin: 6px 0 0;
          color: #6b6b62;
          font-size: 13px;
          font-weight: 800;
        }

        .summaryRow small,
        .ledgerRow small {
          display: block;
          margin-top: 5px;
          color: #8c6a3c;
          font-weight: 900;
          white-space: pre-line;
        }

        .summaryMetric span {
          display: block;
          color: #6b6b62;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .summaryMetric b {
          display: block;
          margin-top: 5px;
          color: #244536;
        }

        .ledgerRight {
          display: grid;
          gap: 8px;
          justify-items: end;
        }

        .ledgerRight b {
          color: #244536;
        }

        .statusPill {
          border-radius: 999px;
          padding: 8px 10px;
          font-size: 11px;
          font-weight: 900;
        }

        .statusPill.good {
          background: rgba(49,85,61,.12);
          color: #31553d;
        }

        .statusPill.warning {
          background: rgba(214,178,94,.20);
          color: #8c6a3c;
        }

        .statusPill.bad {
          background: rgba(163,60,42,.12);
          color: #a33c2a;
        }

        .statusPill.neutral {
          background: rgba(92,70,35,.10);
          color: #6b6b62;
        }

        @media (max-width: 1180px) {
          .stats,
          .moneyGrid,
          .syncGrid,
          .tabs {
            grid-template-columns: repeat(2, 1fr);
          }

          .layout {
            grid-template-columns: 1fr;
          }

          .summaryRow {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 760px) {
          .page {
            padding: 18px;
          }

          .hero,
          .stats,
          .tabs,
          .moneyGrid,
          .syncGrid,
          .detailTop,
          .summaryRow,
          .ledgerRow {
            display: grid;
            grid-template-columns: 1fr;
          }

          .hero h1 {
            font-size: 34px;
          }

          .heroCard,
          .statusBox {
            min-width: 0;
          }

          .ledgerRight {
            justify-items: start;
          }
        }
      `}</style>
    </main>
  );
}

function Card({
  label,
  value,
  good,
  bad,
}: {
  label: string;
  value: string;
  good?: boolean;
  bad?: boolean;
}) {
  return (
    <div className={`card ${good ? "good" : ""} ${bad ? "bad" : ""}`}>
      <p>{label}</p>
      <h3>{value}</h3>
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
      <b>{percent ? `${Number(value || 0).toFixed(2)}%` : peso(value)}</b>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function PanelTitle({ title, text }: { title: string; text: string }) {
  return (
    <div className="panelTitle">
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

function SummaryRow({ row }: { row: any }) {
  return (
    <div className="summaryRow">
      <div>
        <strong>{row.name}</strong>
        <p>{row.count} tree{row.count === 1 ? "" : "s"}</p>
      </div>

      <SummaryMetric label="Purchase" value={peso(row.purchase)} />
      <SummaryMetric label="Care Program" value={peso(row.careProgram)} />
      <SummaryMetric label="Total Spent" value={peso(row.totalSpent)} />
      <SummaryMetric label="Value" value={peso(row.currentValue)} />
      <SummaryMetric label="ROI" value={`${Number(row.roi || 0).toFixed(2)}%`} />
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="summaryMetric">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
