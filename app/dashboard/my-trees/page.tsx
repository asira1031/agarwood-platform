"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TreeRow = Record<string, any>;
type SellRequest = Record<string, any>;
type PanelType = "NONE" | "PHOTOS" | "GPS" | "QR" | "RENAME" | "CARE";

const STAGES = ["Seedling", "Sapling", "Young Tree", "Mature Tree", "Harvest Ready"];

export default function MyTreesPage() {
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [sellRequests, setSellRequests] = useState<SellRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTree, setSelectedTree] = useState<TreeRow | null>(null);
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"TREES" | "GROUPS">("TREES");
  const [stageFilter, setStageFilter] = useState("ALL");

  const [activePanel, setActivePanel] = useState<PanelType>("NONE");
  const [renameValue, setRenameValue] = useState("");

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

    const { data: profileByEmailLower } = await supabase
      .from("profiles")
      .select("id, email, full_name, membership_status, kyc_status")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    const { data: profileByEmailLike } = await supabase
      .from("profiles")
      .select("id, email, full_name, membership_status, kyc_status")
      .ilike("email", email)
      .maybeSingle();

    const profile = profileById || profileByEmail || profileByEmailLower || profileByEmailLike;

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

    const rows = treeData || [];

    setTrees(rows);
    setSellRequests(sellData || []);

    setSelectedTree((current) => {
      if (current) {
        const refreshed = rows.find((tree) => tree.id === current.id);
        if (refreshed) return refreshed;
      }

      return rows[0] || null;
    });

    setLoading(false);
  }

  useEffect(() => {
    loadTrees();
  }, []);

  const stats = useMemo(() => {
    const owned = trees.length;
    const protectedTrees = trees.filter((tree) => getCareStatus(tree).type === "PROTECTED").length;
    const needsCare = trees.filter((tree) => getCareStatus(tree).type === "NONE").length;
    const estimatedValue = trees.reduce((sum, tree) => sum + getEstimatedValue(tree), 0);
    const totalSpent = trees.reduce((sum, tree) => sum + getTotalSpent(tree), 0);
    const profit = estimatedValue - totalSpent;

    return { owned, protectedTrees, needsCare, totalSpent, estimatedValue, profit };
  }, [trees]);

  const filteredTrees = useMemo(() => {
    const q = search.trim().toLowerCase();

    return trees.filter((tree) => {
      const stage = String(tree.stage || tree.growth_stage || "").toLowerCase();
      const code = String(tree.tree_code || tree.code || tree.id || "").toLowerCase();
      const name = String(tree.custom_name || tree.display_name || tree.tree_code || tree.code || "").toLowerCase();
      const group = String(tree.tree_group_name || "Ungrouped Trees").toLowerCase();
      const care = getCareStatus(tree).label.toLowerCase();

      const matchesSearch =
        !q ||
        code.includes(q) ||
        name.includes(q) ||
        group.includes(q) ||
        stage.includes(q) ||
        care.includes(q);

      const matchesStage =
        stageFilter === "ALL" ||
        stage === stageFilter.toLowerCase() ||
        normalizeStage(stage).toLowerCase() === stageFilter.toLowerCase();

      return matchesSearch && matchesStage;
    });
  }, [trees, search, stageFilter]);

  const groups = useMemo(() => {
    const map: Record<string, TreeRow[]> = {};

    filteredTrees.forEach((tree) => {
      const groupName = tree.tree_group_name || "Ungrouped Trees";
      if (!map[groupName]) map[groupName] = [];
      map[groupName].push(tree);
    });

    return Object.entries(map).map(([name, groupTrees]) => {
      const totalSpent = groupTrees.reduce((sum, tree) => sum + getTotalSpent(tree), 0);
      const estimatedValue = groupTrees.reduce((sum, tree) => sum + getEstimatedValue(tree), 0);
      const profit = estimatedValue - totalSpent;
      const protectedCount = groupTrees.filter((tree) => getCareStatus(tree).type === "PROTECTED").length;

      return { name, trees: groupTrees, totalSpent, estimatedValue, profit, protectedCount };
    });
  }, [filteredTrees]);

  const selectedMath = selectedTree
    ? getTreeMath(selectedTree)
    : { totalSpent: 0, estimatedValue: 0, profit: 0, roi: 0 };

  const selectedQrUrl = selectedTree
    ? selectedTree.tree_qr_url || selectedTree.tree_verification_url || ""
    : "";

  const selectedCare = selectedTree
    ? getCareStatus(selectedTree)
    : { type: "NONE", label: "No Active Care Program", description: "Not enrolled", className: "none" };

  function openPanel(panel: PanelType) {
    if (!selectedTree) return;

    if (panel === "RENAME") {
      setRenameValue(
        selectedTree.custom_name ||
          selectedTree.display_name ||
          
          "Agarwood Tree"
      );
    }

    setActivePanel(panel);
  }

  async function saveRename() {
    setMessage("");

    if (!selectedTree) return;

    const cleanName = renameValue.trim();

    if (!cleanName) {
      setMessage("Tree name cannot be empty.");
      return;
    }

    const { error } = await supabase
      .from("trees")
      .update({ custom_name: cleanName })
      .eq("id", selectedTree.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setActivePanel("NONE");
    setMessage("Tree renamed successfully. Tree code and QR identity did not change.");
    await loadTrees();
  }

  function goToCarePrograms() {
    window.location.href = "/dashboard/tree-operations";
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Agarwood Asset Portfolio</p>
          <h1>My Trees</h1>
          <span>
            Monitor your owned agarwood assets, protection status, care program,
            projected value, QR identity, GPS verification, and sell readiness.
          </span>
        </div>

        <div className="heroActions">
          <Link href="/dashboard/marketplace">Buy More Trees</Link>
          <Link className="primary" href="/dashboard/tree-operations">
            Manage Care
          </Link>
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
            <Stat label="Protected Trees" value={String(stats.protectedTrees)} good />
            <Stat label="Needs Care" value={String(stats.needsCare)} warning={stats.needsCare > 0} />
            <Stat label="Projected Profit" value={peso(stats.profit)} good={stats.profit >= 0} />
          </section>

          {stats.needsCare > 0 && (
            <section className="careAlert">
              <div>
                <strong>Protect your agarwood investment</strong>
                <p>
                  {stats.needsCare} tree{stats.needsCare === 1 ? "" : "s"} do not have an active
                  care program. Subscribe to a care program to keep monitoring and treatment organized.
                </p>
              </div>
              <button onClick={goToCarePrograms}>Protect Trees Now</button>
            </section>
          )}

          <section className="layout">
            <aside className="treeList">
              <div className="searchBox">
                <label>Search Portfolio</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tree code, name, group, stage, care status..."
                />
              </div>

              <div className="viewSwitch">
                <button
                  className={viewMode === "TREES" ? "active" : ""}
                  onClick={() => setViewMode("TREES")}
                >
                  Trees
                </button>
                <button
                  className={viewMode === "GROUPS" ? "active" : ""}
                  onClick={() => setViewMode("GROUPS")}
                >
                  Groups
                </button>
              </div>

              <div className="stageFilters">
                {["ALL", ...STAGES].map((stage) => (
                  <button
                    key={stage}
                    className={stageFilter === stage ? "active" : ""}
                    onClick={() => setStageFilter(stage)}
                  >
                    {stage}
                  </button>
                ))}
              </div>

              {viewMode === "TREES" ? (
                <div className="listItems">
                  {filteredTrees.length === 0 ? (
                    <div className="empty small">No matching trees.</div>
                  ) : (
                    filteredTrees.map((tree) => {
                      const math = getTreeMath(tree);
                      const care = getCareStatus(tree);
                      const active = selectedTree?.id === tree.id;

                      return (
                        <button
                          key={tree.id}
                          className={`treeItem ${active ? "active" : ""}`}
                          onClick={() => setSelectedTree(tree)}
                        >
                          <div>
                            <strong>{tree.tree_code || tree.code || tree.id}</strong>
                            <p>{tree.custom_name || tree.display_name ||  "Agarwood Tree"}</p>
                            <small>{tree.tree_group_name || "Ungrouped Trees"}</small>
                            <em className={`carePill ${care.className}`}>{care.label}</em>
                          </div>
                          <span className={math.profit >= 0 ? "gain" : "loss"}>
                            {peso(math.profit)}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="listItems">
                  {groups.length === 0 ? (
                    <div className="empty small">No matching groups.</div>
                  ) : (
                    groups.map((group) => (
                      <button
                        key={group.name}
                        className="groupItem"
                        onClick={() => setSelectedTree(group.trees[0])}
                      >
                        <div>
                          <strong>{group.name}</strong>
                          <p>{group.trees.length} tree{group.trees.length === 1 ? "" : "s"}</p>
                          <small>{group.protectedCount} protected • Value {peso(group.estimatedValue)}</small>
                        </div>
                        <span className={group.profit >= 0 ? "gain" : "loss"}>
                          {peso(group.profit)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </aside>

            {selectedTree && (
              <section className="detail">
                <div className="detailTop">
                  <div>
                    <p className="eyebrow">Tree Asset</p>
                    <h2>{selectedTree.custom_name || selectedTree.display_name ||  "Agarwood Tree"}</h2>
                    <span>{selectedTree.tree_code || selectedTree.code || selectedTree.id}</span>
                    <p className="groupName">{selectedTree.tree_group_name || "Ungrouped Trees"}</p>
                  </div>

                  <div className={`protectionBox ${selectedCare.className}`}>
                    <strong>{selectedCare.label}</strong>
                    <p>{selectedCare.description}</p>
                    <button onClick={() => openPanel("CARE")}>
                      {selectedCare.type === "PROTECTED" ? "View Care" : "Protect Tree"}
                    </button>
                  </div>
                </div>

                <section className="growth">
                  <div className="panelHead">
                    <div>
                      <h3>Growth Journey</h3>
                      <p>Current stage is based on the tree record from Supabase.</p>
                    </div>
                  </div>

                  <div className="stageLine">
                    {STAGES.map((stage, index) => {
                      const current = normalizeStage(selectedTree.stage || selectedTree.growth_stage);
                      const foundIndex = STAGES.findIndex(
                        (item) => item.toLowerCase() === current.toLowerCase()
                      );
                      const currentIndex = foundIndex >= 0 ? foundIndex : 0;

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
                  <Mini label="Care Program" value={getCareProgramName(selectedTree)} />
                  <Mini label="Auto Renew" value={getAutoRenewText(selectedTree)} />
                  <Mini label="Next Renewal" value={formatDate(selectedTree.next_renewal_date || selectedTree.care_program_next_renewal)} />
                </section>

                <section className={`carePanel ${selectedCare.className}`}>
                  <div>
                    <strong>{selectedCare.type === "PROTECTED" ? "Active Care Protection" : "Care Protection Needed"}</strong>
                    <p>
                      {selectedCare.type === "PROTECTED"
                        ? "This tree is enrolled in a care program. Keep auto-renew active to avoid coverage gaps."
                        : "This tree has no active care program. Protect it with weekly or monthly care from Tree Operations."}
                    </p>
                  </div>

                  <div className="carePanelActions">
                    <Link href="/dashboard/tree-operations">
                      {selectedCare.type === "PROTECTED" ? "Manage Care Program" : "Protect This Tree"}
                    </Link>
                    <Link className="secondary" href="/dashboard/marketplace">
                      Buy Supplies
                    </Link>
                  </div>
                </section>

                <section className="moneyBox">
                  <div className="panelHead">
                    <div>
                      <h3>Investment Tracker</h3>
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
                  <button onClick={() => openPanel("PHOTOS")}>View Photos</button>
                  <button onClick={() => openPanel("GPS")}>View GPS</button>
                  <button onClick={() => openPanel("QR")}>Tree QR</button>
                  <button onClick={() => openPanel("RENAME")}>Rename</button>
                  <button onClick={goToCarePrograms} className="care">
                    Protect / Manage Care
                  </button>
                  <button onClick={() => (window.location.href = `/dashboard/sell-tree?tree_id=${encodeURIComponent(String(selectedTree.id || ""))}&tree_code=${encodeURIComponent(String(selectedTree.tree_code || selectedTree.code || ""))}`)} className="sell">
                    Sell Tree
                  </button>
                </section>

                <section className="history">
                  <div className="panelHead">
                    <div>
                      <h3>Sell Requests</h3>
                      <p>Pending or completed sale requests for this tree.</p>
                    </div>
                  </div>

                  {sellRequests.filter((item) => item.tree_id === selectedTree.tree_code || item.tree_id === selectedTree.id).length === 0 ? (
                    <div className="empty small">No sell request for this tree.</div>
                  ) : (
                    <div className="requestList">
                      {sellRequests
                        .filter((item) => item.tree_id === selectedTree.tree_code || item.tree_id === selectedTree.id)
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

          {activePanel !== "NONE" && selectedTree && (
            <div className="modal">
              <div className="modalCard">
                {activePanel === "PHOTOS" && (
                  <>
                    <h3>Tree Photos</h3>
                    <p>
                      Photos will appear here after caretaker or operations team uploads real tree photo updates.
                      No fake images are shown.
                    </p>
                    <div className="empty small">No caretaker photo uploaded yet.</div>
                    <ModalActions close={() => setActivePanel("NONE")} />
                  </>
                )}

                {activePanel === "GPS" && (
                  <>
                    <h3>GPS Verification</h3>
                    <p>
                      GPS details will appear here once field staff uploads verified plantation location data.
                    </p>
                    <div className="modalGrid">
                      <Mini label="GPS Status" value={selectedTree.gps_status || "Pending"} />
                      <Mini label="Plantation Block" value={selectedTree.plantation_block || "Not assigned"} />
                      <Mini label="GPS Location" value={selectedTree.gps_location || "Not uploaded"} />
                    </div>
                    <ModalActions close={() => setActivePanel("NONE")} />
                  </>
                )}

                {activePanel === "CARE" && (
                  <>
                    <h3>Care Protection</h3>
                    <p>{selectedCare.description}</p>

                    <div className="modalGrid">
                      <Mini label="Care Status" value={selectedCare.label} />
                      <Mini label="Program" value={getCareProgramName(selectedTree)} />
                      <Mini label="Coverage" value={selectedTree.care_program_coverage || selectedTree.care_coverage || "No active coverage"} />
                      <Mini label="Next Renewal" value={formatDate(selectedTree.next_renewal_date || selectedTree.care_program_next_renewal)} />
                      <Mini label="Auto Renew" value={getAutoRenewText(selectedTree)} />
                      <Mini label="Program Cost" value={peso(Number(selectedTree.care_program_price || selectedTree.care_plan_price || 0))} />
                    </div>

                    <div className="modalActions">
                      <button onClick={() => setActivePanel("NONE")}>Close</button>
                      <button className="primary" onClick={goToCarePrograms}>
                        Go To Care Programs
                      </button>
                    </div>
                  </>
                )}

                {activePanel === "QR" && (
                  <>
                    <h3>Tree QR Identity</h3>
                    <p>
                      This QR identity is for the real tree tag. Scanning opens the official tree
                      verification page.
                    </p>

                    <div className="qrPreview">
                      <div className="fakeQr">
                        <span>QR</span>
                      </div>

                      <div>
                        <strong>{selectedTree.tree_code || selectedTree.id}</strong>
                        <p>{selectedTree.custom_name || selectedTree.display_name ||  "Agarwood Tree"}</p>
                        <small>{selectedQrUrl || "QR verification URL not available"}</small>
                      </div>
                    </div>

                    <div className="modalActions">
                      <button onClick={() => setActivePanel("NONE")}>Close</button>
                      <button className="primary" onClick={() => selectedQrUrl ? window.open(selectedQrUrl, "_blank") : setMessage("QR verification URL is not available yet.")}>
                        Open Verification Page
                      </button>
                    </div>
                  </>
                )}

                {activePanel === "RENAME" && (
                  <>
                    <h3>Rename Tree</h3>
                    <p>
                      Rename only changes the display name. Tree code and QR identity remain permanent.
                    </p>

                    <label>New Tree Name</label>
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      placeholder="Example: Retirement Tree A"
                    />

                    <div className="modalActions">
                      <button onClick={() => setActivePanel("NONE")}>Cancel</button>
                      <button className="primary" onClick={saveRename}>
                        Save Name
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
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
          align-items: flex-start;
          gap: 18px;
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

        .heroActions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .heroActions a,
        .carePanelActions a {
          border-radius: 999px;
          padding: 13px 16px;
          background: rgba(255,253,246,.9);
          color: #244536;
          border: 1px solid rgba(92,70,35,.12);
          text-decoration: none;
          font-weight: 900;
          box-shadow: 0 14px 28px rgba(82,60,27,.08);
        }

        .heroActions a.primary,
        .carePanelActions a {
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
          border-color: transparent;
        }

        .carePanelActions a.secondary {
          background: #f3ead8;
          color: #244536;
          border: 1px solid rgba(92,70,35,.12);
        }

        .message,
        .empty,
        .stat,
        .treeList,
        .detail,
        .growth,
        .moneyBox,
        .history,
        .careAlert,
        .carePanel {
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

        .stat.warning h3 {
          color: #a33c2a;
        }

        .careAlert {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
          padding: 20px;
          margin-bottom: 18px;
          background:
            radial-gradient(circle at 94% 20%, rgba(255, 226, 154, .5), transparent 26%),
            rgba(255,253,246,.9);
        }

        .careAlert strong {
          display: block;
          color: #101a14;
          font-size: 20px;
        }

        .careAlert p {
          margin: 6px 0 0;
          color: #6b6b62;
          font-weight: 800;
          line-height: 1.5;
        }

        .careAlert button {
          border: 0;
          border-radius: 999px;
          padding: 13px 16px;
          background: linear-gradient(135deg, #d6b25e, #b99242);
          color: #10281f;
          font-weight: 900;
          cursor: pointer;
          white-space: nowrap;
        }

        .layout {
          display: grid;
          grid-template-columns: 390px 1fr;
          gap: 18px;
          align-items: start;
        }

        .treeList {
          padding: 14px;
          display: grid;
          gap: 12px;
          max-height: 880px;
          overflow: auto;
        }

        .searchBox {
          display: grid;
          gap: 8px;
        }

        .searchBox label,
        .modalCard label {
          color: #6b6b62;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        input {
          width: 100%;
          border: 1px solid rgba(92,70,35,.14);
          border-radius: 14px;
          padding: 13px 14px;
          background: rgba(255,253,246,.94);
          color: #101a14;
          outline: none;
          font-weight: 800;
        }

        .viewSwitch {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .viewSwitch button,
        .stageFilters button {
          border: 1px solid rgba(92,70,35,.12);
          border-radius: 999px;
          padding: 11px 12px;
          background: #f3ead8;
          color: #244536;
          font-weight: 900;
          cursor: pointer;
        }

        .viewSwitch button.active,
        .stageFilters button.active {
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
          border-color: transparent;
        }

        .stageFilters {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .listItems {
          display: grid;
          gap: 10px;
        }

        .treeItem,
        .groupItem {
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

        .treeItem strong,
        .groupItem strong {
          display: block;
          font-size: 15px;
        }

        .treeItem p,
        .groupItem p {
          margin: 6px 0 0;
          color: inherit;
          opacity: .75;
          font-size: 13px;
          font-weight: 800;
        }

        .treeItem small,
        .groupItem small {
          display: block;
          margin-top: 6px;
          color: inherit;
          opacity: .65;
          font-weight: 800;
        }

        .treeItem span,
        .groupItem span {
          font-weight: 900;
          white-space: nowrap;
        }

        .carePill {
          display: inline-flex;
          margin-top: 10px;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 11px;
          font-style: normal;
          font-weight: 900;
        }

        .carePill.protected { background: rgba(49,85,61,.12); color: #176b3a; }
        .carePill.pending { background: rgba(214,178,94,.22); color: #8c6a3c; }
        .carePill.expired,
        .carePill.none { background: rgba(163,60,42,.12); color: #a33c2a; }

        .treeItem.active .carePill {
          background: rgba(255,255,255,.13);
          color: #d9b45f;
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

        .groupName {
          margin: 8px 0 0;
          color: #8c6a3c;
          font-weight: 900;
        }

        .protectionBox {
          min-width: 280px;
          border-radius: 26px;
          padding: 20px;
          color: white;
          background: linear-gradient(135deg, #244536, #10281f);
          box-shadow: 0 18px 42px rgba(36,69,54,.18);
        }

        .protectionBox.none,
        .protectionBox.expired {
          background: linear-gradient(135deg, #7c3329, #3b1712);
        }

        .protectionBox.pending {
          background: linear-gradient(135deg, #8c6a3c, #4e371a);
        }

        .protectionBox strong {
          display: block;
          font-size: 22px;
        }

        .protectionBox p {
          margin: 8px 0 14px;
          color: rgba(255,255,255,.78);
          line-height: 1.5;
          font-weight: 800;
        }

        .protectionBox button {
          width: 100%;
          border: 0;
          border-radius: 999px;
          padding: 12px;
          background: rgba(255,255,255,.14);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .growth,
        .moneyBox,
        .history,
        .carePanel {
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

        .cards,
        .modalGrid {
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

        .carePanel {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: center;
          background:
            radial-gradient(circle at 94% 12%, rgba(255,255,255,.72), transparent 25%),
            rgba(49,85,61,.08);
        }

        .carePanel.none,
        .carePanel.expired {
          background:
            radial-gradient(circle at 94% 12%, rgba(255,255,255,.72), transparent 25%),
            rgba(163,60,42,.08);
        }

        .carePanel strong {
          display: block;
          color: #101a14;
          font-size: 21px;
        }

        .carePanel p {
          margin: 7px 0 0;
          color: #6b6b62;
          line-height: 1.5;
          font-weight: 800;
        }

        .carePanelActions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
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
          grid-template-columns: repeat(6, 1fr);
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

        .actions .care {
          grid-column: span 2;
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
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

        .modal {
          position: fixed;
          inset: 0;
          z-index: 100;
          padding: 24px;
          background: rgba(0,0,0,.55);
          display: grid;
          place-items: center;
        }

        .modalCard {
          width: min(680px, 100%);
          max-height: 88vh;
          overflow: auto;
          border-radius: 28px;
          padding: 24px;
          background: #fffdf6;
          box-shadow: 0 24px 70px rgba(0,0,0,.22);
        }

        .modalCard h3 {
          margin: 0;
          font-size: 28px;
          color: #101a14;
        }

        .modalCard p {
          color: #6b6b62;
          line-height: 1.5;
          font-weight: 800;
        }

        .modalActions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 18px;
        }

        .modalActions button {
          border: 0;
          border-radius: 16px;
          padding: 14px;
          background: #f3ead8;
          color: #244536;
          font-weight: 900;
          cursor: pointer;
        }

        .modalActions .primary {
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
        }

        .qrPreview {
          display: grid;
          grid-template-columns: 150px 1fr;
          gap: 16px;
          align-items: center;
          padding: 18px;
          border-radius: 22px;
          background: #f3ead8;
          margin-top: 18px;
        }

        .fakeQr {
          width: 150px;
          height: 150px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          background:
            linear-gradient(90deg, #10281f 12px, transparent 12px) 0 0 / 30px 30px,
            linear-gradient(#10281f 12px, transparent 12px) 0 0 / 30px 30px,
            white;
          border: 8px solid white;
        }

        .fakeQr span {
          border-radius: 999px;
          padding: 8px 12px;
          background: white;
          color: #244536;
          font-weight: 900;
        }

        .qrPreview strong {
          display: block;
          color: #101a14;
          font-size: 20px;
        }

        .qrPreview p {
          margin: 8px 0;
        }

        .qrPreview small {
          display: block;
          color: #6b6b62;
          word-break: break-all;
          font-weight: 800;
        }

        @media (max-width: 1180px) {
          .stats,
          .stageLine,
          .cards,
          .moneyGrid,
          .actions,
          .modalGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .layout {
            grid-template-columns: 1fr;
          }

          .carePanel {
            flex-direction: column;
            align-items: stretch;
          }

          .carePanelActions {
            justify-content: flex-start;
          }
        }

        @media (max-width: 760px) {
          .page {
            padding: 18px;
          }

          .hero {
            flex-direction: column;
          }

          .heroActions {
            justify-content: flex-start;
          }

          .hero h1 {
            font-size: 34px;
          }

          .stats,
          .stageLine,
          .cards,
          .moneyGrid,
          .actions,
          .modalActions,
          .qrPreview,
          .modalGrid {
            grid-template-columns: 1fr;
          }

          .detailTop,
          .careAlert {
            flex-direction: column;
          }

          .protectionBox {
            width: 100%;
          }

          .fakeQr {
            width: 100%;
          }

          .actions .care {
            grid-column: span 1;
          }
        }
      `}</style>
    </main>
  );
}

function ModalActions({ close }: { close: () => void }) {
  return (
    <div className="modalActions">
      <button onClick={close}>Close</button>
      <button className="primary" onClick={close}>
        Done
      </button>
    </div>
  );
}

function Stat({
  label,
  value,
  good,
  warning,
}: {
  label: string;
  value: string;
  good?: boolean;
  warning?: boolean;
}) {
  return (
    <div className={`stat ${good ? "good" : ""} ${warning ? "warning" : ""}`}>
      <p>{label}</p>
      <h3>{value}</h3>
    </div>
  );
}

function Mini({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
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

function getCareStatus(tree: TreeRow) {
  const rawStatus = String(
    tree.care_program_status ||
      tree.care_status ||
      tree.protection_status ||
      ""
  ).toUpperCase();

  const carePlan = getCareProgramName(tree);
  const hasPlan = Boolean(carePlan && carePlan !== "Not Enrolled");

  if (["ACTIVE", "PROTECTED", "ENROLLED"].includes(rawStatus) || hasPlan) {
    return {
      type: "PROTECTED",
      label: "Protected",
      className: "protected",
      description: `${carePlan} is active for this tree.`,
    };
  }

  if (["PENDING", "PROCESSING", "FOR_REVIEW"].includes(rawStatus)) {
    return {
      type: "PENDING",
      label: "Care Pending",
      className: "pending",
      description: "Care program request is waiting for admin or operations processing.",
    };
  }

  if (["EXPIRED", "CANCELLED", "INACTIVE"].includes(rawStatus)) {
    return {
      type: "EXPIRED",
      label: "Care Expired",
      className: "expired",
      description: "Care coverage is no longer active. Renew to keep the tree protected.",
    };
  }

  return {
    type: "NONE",
    label: "No Active Care Program",
    className: "none",
    description: "This tree has no active care program yet.",
  };
}

function getCareProgramName(tree: TreeRow) {
  return (
    tree.care_program_name ||
    tree.care_plan ||
    tree.carePlan ||
    tree.subscription_name ||
    "Not Enrolled"
  );
}

function getAutoRenewText(tree: TreeRow) {
  const value =
    tree.auto_renew_enabled ??
    tree.auto_renew ??
    tree.care_auto_renew ??
    false;

  return value ? "ON" : "OFF";
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

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
