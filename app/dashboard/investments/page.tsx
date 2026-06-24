"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TreeRow = Record<string, any>;
type OperationRequest = Record<string, any>;

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
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

function getTreeName(tree: TreeRow, index?: number) {
  return (
    tree.custom_name ||
    tree.display_name ||
    tree.name ||
    `Seedling #${typeof index === "number" ? index + 1 : ""}`.trim()
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

    const email = user.email?.trim() || "";
    const normalizedEmail = email.toLowerCase();

    const { data: profileById, error: profileByIdError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    if (profileByIdError) {
      setMessage(profileByIdError.message);
      setLoading(false);
      return;
    }

    const { data: profileByExactEmail, error: profileByExactEmailError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", email)
      .maybeSingle();

    if (profileByExactEmailError) {
      setMessage(profileByExactEmailError.message);
      setLoading(false);
      return;
    }

    const { data: profileByLowerEmail, error: profileByLowerEmailError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (profileByLowerEmailError) {
      setMessage(profileByLowerEmailError.message);
      setLoading(false);
      return;
    }

    const { data: profileByEmailFallback, error: profileByEmailFallbackError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .ilike("email", email)
      .maybeSingle();

    if (profileByEmailFallbackError) {
      setMessage(profileByEmailFallbackError.message);
      setLoading(false);
      return;
    }

    const currentProfile =
      profileById ||
      profileByExactEmail ||
      profileByLowerEmail ||
      profileByEmailFallback;

    if (!currentProfile) {
      setMessage(`Profile not found for ${email || user.id}.`);
      setLoading(false);
      return;
    }

    setProfile(currentProfile);

    const { data: treeData, error: treeError } = await supabase
      .from("trees")
      .select("*")
      .or(`profile_id.eq.${currentProfile.id},customer_profile_id.eq.${currentProfile.id}`)
      .order("created_at", { ascending: false });

    if (treeError) {
      setMessage(treeError.message);
      setLoading(false);
      return;
    }

    const { data: requestData } = await supabase
      .from("tree_operation_requests")
      .select("*")
      .or(`profile_id.eq.${currentProfile.id},customer_profile_id.eq.${currentProfile.id}`)
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

  const selectedTreeIndex = useMemo(() => {
    if (!selectedTree) return 0;
    const index = trees.findIndex((tree) => tree.id === selectedTree.id);
    return index >= 0 ? index : 0;
  }, [trees, selectedTree]);

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
          <p className="eyebrow">Agarwood Portfolio Command</p>
          <h1>Premium Forest Portfolio</h1>
          <span>
            Review your owned agarwood assets by tree, group, package, and ledger. ROI uses your live tree records and remains display-only for investor clarity.
          </span>
        </div>

        <div className="heroCard">
          <p>Live Portfolio ROI</p>
          <strong className={stats.roi >= 0 ? "goodText" : "badText"}>
            {stats.roi.toFixed(2)}%
          </strong>
          <small>Profile: {profile?.email || "Verified"}</small>
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
              Tree Assets
            </button>
            <button className={viewMode === "GROUP" ? "active" : ""} onClick={() => setViewMode("GROUP")}>
              Forest Groups
            </button>
            <button className={viewMode === "PACKAGE" ? "active" : ""} onClick={() => setViewMode("PACKAGE")}>
              Packages
            </button>
            <button className={viewMode === "LEDGER" ? "active" : ""} onClick={() => setViewMode("LEDGER")}>
              Cost Ledger
            </button>
          </section>

          {viewMode === "TREE" && (
            <section className="layout">
              <aside className="treeList">
                {trees.map((tree, index) => {
                  const active = selectedTree?.id === tree.id;

                  return (
                    <button
                      key={tree.id}
                      className={`treeItem ${active ? "active" : ""}`}
                      onClick={() => setSelectedTreeId(tree.id)}
                    >
                      <div>
                        <strong>{getTreeName(tree, index)}</strong>
                        <p>{getGroupName(tree)}</p>
                        <small>{getTreeCode(tree)}</small>
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
                      <p className="eyebrow">Selected Tree Asset</p>
                      <h2>{getTreeName(selectedTree, selectedTreeIndex)}</h2>
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
                        <h3>Care & Operations Sync</h3>
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
                          selectedTree.auto_renew_enabled
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
                title="Care Program Cost Ledger"
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
          width: 100%;
          min-width: 0;
          min-height: 100vh;
          padding: 32px;
          color: #f7f1df;
          font-family: Arial, Helvetica, sans-serif;
          background:
            radial-gradient(circle at 14% 8%, rgba(214, 178, 94, .24), transparent 28%),
            radial-gradient(circle at 88% 5%, rgba(86, 130, 92, .24), transparent 30%),
            radial-gradient(circle at 48% 112%, rgba(214, 178, 94, .14), transparent 36%),
            linear-gradient(135deg, #07130d 0%, #0d2117 46%, #03100a 100%);
          position: relative;
          overflow-x: hidden;
        }

        .page:before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px);
          background-size: 46px 46px;
          mask-image: radial-gradient(circle at top, black, transparent 78%);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: stretch;
          gap: 18px;
          margin-bottom: 22px;
          position: relative;
          z-index: 1;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #d9b45f;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .16em;
          font-size: 12px;
        }

        .hero h1 {
          margin: 0;
          font-size: 48px;
          color: #fff8df;
          letter-spacing: -1.8px;
          text-shadow: 0 14px 40px rgba(0,0,0,.32);
        }

        .hero span {
          display: block;
          margin-top: 10px;
          color: rgba(247,241,223,.74);
          max-width: 880px;
          line-height: 1.65;
          font-weight: 700;
        }

        .heroCard {
          min-width: 290px;
          border-radius: 30px;
          padding: 24px;
          color: white;
          background:
            radial-gradient(circle at 82% 16%, rgba(217,180,95,.44), transparent 34%),
            radial-gradient(circle at 10% 92%, rgba(83,128,90,.34), transparent 42%),
            linear-gradient(135deg, rgba(23,70,44,.96), rgba(5,24,15,.98));
          border: 1px solid rgba(217,180,95,.34);
          box-shadow: 0 28px 78px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.14);
        }

        .heroCard p {
          margin: 0;
          color: rgba(255,248,223,.72);
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .14em;
          font-size: 12px;
        }

        .heroCard strong {
          display: block;
          margin-top: 10px;
          font-size: 36px;
        }

        .heroCard small {
          display: block;
          margin-top: 6px;
          color: rgba(255,248,223,.74);
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
          border-radius: 28px;
          background: linear-gradient(180deg, rgba(255,255,255,.105), rgba(255,255,255,.055));
          border: 1px solid rgba(217,180,95,.22);
          box-shadow: 0 24px 70px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.10);
          backdrop-filter: blur(18px);
          position: relative;
          z-index: 1;
        }

        .message,
        .empty {
          padding: 20px;
          margin-bottom: 18px;
          color: #f8e6ad;
          font-weight: 900;
        }

        .small {
          box-shadow: none;
          background: rgba(4,18,11,.52);
          border-radius: 18px;
          border: 1px solid rgba(217,180,95,.14);
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 18px;
          position: relative;
          z-index: 1;
        }

        .stats.second { margin-top: -6px; }

        .card { padding: 22px; }

        .card p,
        .detailTop span,
        .statusBox small,
        .money span,
        .mini span,
        .panelHead p,
        .panelTitle p,
        .summaryRow p,
        .ledgerRow p,
        .summaryMetric span {
          color: rgba(247,241,223,.68);
        }

        .card p {
          margin: 0;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .card h3 {
          margin: 10px 0 0;
          color: #fff8df;
          font-size: 26px;
        }

        .card.good h3 { color: #a8f2ac; }
        .card.bad h3 { color: #ffb0a4; }

        .tabs {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          padding: 12px;
          margin-bottom: 18px;
        }

        .tabs button {
          border: 1px solid rgba(217,180,95,.16);
          border-radius: 18px;
          padding: 14px;
          background: rgba(4,18,11,.52);
          color: #f7f1df;
          font-weight: 900;
          cursor: pointer;
          transition: .2s ease;
        }

        .tabs button:hover,
        .tabs button.active {
          background: linear-gradient(135deg, #f2d686, #b58a38);
          color: #06130d;
          border-color: transparent;
          box-shadow: 0 16px 34px rgba(181,138,56,.24);
        }

        .layout {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 16px;
          align-items: start;
          position: relative;
          z-index: 1;
        }

        .treeList {
          padding: 14px;
          display: grid;
          gap: 10px;
          max-height: 720px;
          overflow: auto;
        }

        .treeList::-webkit-scrollbar { width: 8px; }
        .treeList::-webkit-scrollbar-thumb { background: rgba(217,180,95,.35); border-radius: 999px; }

        .treeItem {
          border: 1px solid rgba(217,180,95,.14);
          border-radius: 20px;
          padding: 14px;
          background: rgba(4,18,11,.52);
          color: #f7f1df;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          text-align: left;
          cursor: pointer;
          transition: .2s ease;
        }

        .treeItem:hover,
        .treeItem.active {
          background:
            radial-gradient(circle at 86% 12%, rgba(217,180,95,.20), transparent 34%),
            linear-gradient(135deg, rgba(23,70,44,.96), rgba(5,24,15,.98));
          border-color: rgba(242,214,134,.46);
          transform: translateY(-1px);
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

        .gain { color: #a8f2ac; font-weight: 900; }
        .loss { color: #ffb0a4; font-weight: 900; }
        .treeItem.active .gain,
        .treeItem.active .loss { color: #f2d686; }

        .detail { padding: 22px; }

        .detailTop {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: start;
          margin-bottom: 18px;
        }

        .detailTop h2 {
          margin: 0;
          color: #fff8df;
          font-size: 34px;
        }

        .detailTop span {
          display: block;
          margin-top: 6px;
          font-weight: 900;
        }

        .statusBox,
        .money,
        .mini,
        .summaryRow,
        .ledgerRow {
          border-radius: 20px;
          background: rgba(4,18,11,.52);
          border: 1px solid rgba(217,180,95,.14);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
        }

        .statusBox {
          min-width: 260px;
          padding: 16px;
        }

        .statusBox small {
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .10em;
        }

        .statusBox strong {
          display: block;
          margin-top: 8px;
          color: #fff8df;
          font-size: 18px;
        }

        .statusBox p {
          margin: 6px 0 0;
          font-weight: 900;
        }

        .statusBox.good { background: rgba(112,189,124,.13); }
        .statusBox.warning { background: rgba(217,180,95,.16); }
        .statusBox.bad { background: rgba(255,112,92,.13); }

        .moneyGrid,
        .syncGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .money,
        .mini { padding: 15px; }

        .money span,
        .mini span {
          display: block;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .10em;
        }

        .money b,
        .mini b,
        .summaryMetric b,
        .ledgerRight b {
          display: block;
          margin-top: 8px;
          color: #f2d686;
          font-size: 18px;
        }

        .money.strong {
          background:
            radial-gradient(circle at 90% 14%, rgba(217,180,95,.26), transparent 34%),
            linear-gradient(135deg, rgba(23,70,44,.96), rgba(5,24,15,.98));
          border-color: rgba(217,180,95,.28);
        }

        .money.strong span,
        .money.strong b { color: #fff8df; }
        .money.good b { color: #a8f2ac; }

        .syncPanel {
          padding: 18px;
          margin-top: 18px;
        }

        .panelHead h3,
        .panelTitle h2 {
          margin: 0;
          color: #fff8df;
        }

        .panelHead p,
        .panelTitle p {
          margin: 6px 0 0;
          line-height: 1.5;
          font-weight: 800;
        }

        .tablePanel {
          padding: 22px;
          position: relative;
          z-index: 1;
        }

        .table,
        .ledgerList {
          display: grid;
          gap: 12px;
          margin-top: 18px;
        }

        .summaryRow,
        .ledgerRow {
          padding: 16px;
          display: grid;
          grid-template-columns: 1.2fr repeat(5, .8fr);
          gap: 12px;
          align-items: center;
        }

        .ledgerRow { grid-template-columns: 1fr auto; }

        .summaryRow strong,
        .ledgerRow strong { color: #fff8df; }

        .summaryRow p,
        .ledgerRow p {
          margin: 6px 0 0;
          font-size: 13px;
          font-weight: 800;
        }

        .summaryRow small,
        .ledgerRow small {
          display: block;
          margin-top: 5px;
          color: #d9b45f;
          font-weight: 900;
          white-space: pre-line;
        }

        .summaryMetric span {
          display: block;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .summaryMetric b { margin-top: 5px; }

        .ledgerRight {
          display: grid;
          gap: 8px;
          justify-items: end;
        }

        .statusPill {
          border-radius: 999px;
          padding: 8px 10px;
          font-size: 11px;
          font-weight: 900;
          border: 1px solid transparent;
        }

        .statusPill.good { background: rgba(112,189,124,.15); color: #a8f2ac; border-color: rgba(112,189,124,.22); }
        .statusPill.warning { background: rgba(217,180,95,.16); color: #f2d686; border-color: rgba(217,180,95,.22); }
        .statusPill.bad { background: rgba(255,112,92,.14); color: #ffb0a4; border-color: rgba(255,112,92,.20); }
        .statusPill.neutral { background: rgba(255,255,255,.07); color: rgba(247,241,223,.72); border-color: rgba(255,255,255,.08); }

        @media (max-width: 1180px) {
          .stats,
          .moneyGrid,
          .syncGrid,
          .tabs { grid-template-columns: repeat(2, 1fr); }
          .layout { grid-template-columns: 1fr; }
          .summaryRow { grid-template-columns: 1fr 1fr; }
        }

        @media (max-width: 820px) {
          .page { padding: 18px; }
          .hero { display: block; }
          .hero h1 { font-size: 36px; }
          .heroCard { margin-top: 16px; min-width: 0; }
          .stats,
          .tabs,
          .moneyGrid,
          .syncGrid { grid-template-columns: 1fr; }
          .detailTop { display: block; }
          .statusBox { margin-top: 14px; min-width: 0; }
          .summaryRow,
          .ledgerRow { grid-template-columns: 1fr; }
          .ledgerRight { justify-items: start; }
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
