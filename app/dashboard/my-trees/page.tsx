"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TreeRow = Record<string, any>;
type UpdateRow = Record<string, any>;

type PanelType = "NONE" | "PHOTOS" | "GPS" | "HEALTH" | "QR" | "RENAME";

const STAGES = ["Seedling", "Sapling", "Young Tree", "Mature Tree", "Harvest Ready"];

export default function MyTreesPage() {
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTree, setSelectedTree] = useState<TreeRow | null>(null);
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"TREES" | "GROUPS">("TREES");
  const [stageFilter, setStageFilter] = useState("ALL");

  const [activePanel, setActivePanel] = useState<PanelType>("NONE");
  const [renameValue, setRenameValue] = useState("");

  const [photoUpdates, setPhotoUpdates] = useState<UpdateRow[]>([]);
  const [gpsLogs, setGpsLogs] = useState<UpdateRow[]>([]);
  const [healthReports, setHealthReports] = useState<UpdateRow[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);

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

    const rows = treeData || [];

    setTrees(rows);

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

  async function loadTreeUpdates(tree: TreeRow) {
    setPanelLoading(true);
    setPhotoUpdates([]);
    setGpsLogs([]);
    setHealthReports([]);

    const treeId = String(tree.id || "");
    const treeCode = String(tree.tree_code || tree.code || "");

    const photoQuery = supabase
      .from("tree_photo_updates")
      .select("*")
      .order("created_at", { ascending: false });

    const gpsQuery = supabase
      .from("tree_gps_logs")
      .select("*")
      .order("created_at", { ascending: false });

    const healthQuery = supabase
      .from("tree_health_reports")
      .select("*")
      .order("created_at", { ascending: false });

    const [{ data: photos }, { data: gps }, { data: health }] = await Promise.all([
      photoQuery,
      gpsQuery,
      healthQuery,
    ]);

    const matchesTree = (row: UpdateRow) => {
      const rowTreeId = String(row.tree_id || "");
      return rowTreeId === treeId || rowTreeId === treeCode;
    };

    setPhotoUpdates((photos || []).filter(matchesTree));
    setGpsLogs((gps || []).filter(matchesTree));
    setHealthReports((health || []).filter(matchesTree));
    setPanelLoading(false);
  }

  const stats = useMemo(() => {
    const owned = trees.length;
    const totalSpent = trees.reduce((sum, tree) => sum + getTotalSpent(tree), 0);
    const estimatedValue = trees.reduce((sum, tree) => sum + getEstimatedValue(tree), 0);
    const profit = estimatedValue - totalSpent;

    return { owned, totalSpent, estimatedValue, profit };
  }, [trees]);

  const filteredTrees = useMemo(() => {
    const q = search.trim().toLowerCase();

    return trees.filter((tree) => {
      const stage = String(tree.stage || tree.growth_stage || "").toLowerCase();
      const code = String(tree.tree_code || tree.code || tree.id || "").toLowerCase();
      const name = String(tree.custom_name || tree.name || "").toLowerCase();
      const group = String(tree.tree_group_name || "Ungrouped Trees").toLowerCase();

      const matchesSearch =
        !q || code.includes(q) || name.includes(q) || group.includes(q) || stage.includes(q);

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

      return { name, trees: groupTrees, totalSpent, estimatedValue, profit };
    });
  }, [filteredTrees]);

  const selectedMath = selectedTree
    ? getTreeMath(selectedTree)
    : { totalSpent: 0, estimatedValue: 0, profit: 0, roi: 0 };

  const selectedQrUrl = selectedTree
    ? selectedTree.tree_qr_url || `/tree/${selectedTree.id}`
    : "";

  async function openPanel(panel: PanelType) {
    if (!selectedTree) return;

    if (panel === "RENAME") {
      setRenameValue(selectedTree.custom_name || selectedTree.name || "Agarwood Tree");
    }

    if (panel === "PHOTOS" || panel === "GPS" || panel === "HEALTH") {
      await loadTreeUpdates(selectedTree);
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

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Agarwood Portfolio</p>
          <h1>My Trees</h1>
          <span>
            Search, group, rename, verify QR identity, track caretaker photos,
            GPS logs, health reports, care program sync, spending, and profit/loss.
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
              <div className="searchBox">
                <label>Search Trees</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tree code, name, group, stage..."
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
                            <small>{tree.tree_group_name || "Ungrouped Trees"}</small>
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
                          <small>Value: {peso(group.estimatedValue)}</small>
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
                    <h2>{selectedTree.custom_name || selectedTree.name || "Agarwood Tree"}</h2>
                    <span>{selectedTree.tree_code || selectedTree.code || selectedTree.id}</span>
                    <p className="groupName">{selectedTree.tree_group_name || "Ungrouped Trees"}</p>
                  </div>

                  <div className="identityBox">
                    <strong>Tree Identity</strong>
                    <p>{selectedTree.tree_code || selectedTree.id}</p>
                    <div className="identityActions">
                      <button onClick={() => openPanel("RENAME")}>Rename</button>
                      <button onClick={() => openPanel("QR")}>View QR</button>
                    </div>
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
                  <Mini label="Care Plan" value={selectedTree.care_plan || selectedTree.carePlan || "Not Enrolled"} />
                  <Mini label="Program Status" value={selectedTree.care_program_status || "NOT_ENROLLED"} />
                  <Mini label="Coverage" value={selectedTree.care_program_coverage || "No active coverage"} />
                  <Mini label="Next Renewal" value={formatDate(selectedTree.care_program_next_renewal)} />
                  <Mini label="Auto Renew" value={selectedTree.auto_renew_enabled ? "ON - Display Only" : "OFF"} />
                  <Mini label="Program Cost" value={peso(Number(selectedTree.care_program_price || 0))} />
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
                    <Money label="Operation Cost" value={getOperationCost(selectedTree)} />
                    <Money label="Care Program Cost" value={getCareProgramCost(selectedTree)} />
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
                  <button onClick={() => openPanel("HEALTH")}>View Health</button>
                  <button onClick={() => (window.location.href = "/dashboard/tree-operations")}>
                    Request Care
                  </button>
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
                    <p>Live caretaker photo updates for this tree.</p>

                    {panelLoading ? (
                      <div className="empty small">Loading photos...</div>
                    ) : photoUpdates.length === 0 ? (
                      <div className="empty small">No caretaker photo uploaded yet.</div>
                    ) : (
                      <div className="updateList">
                        {photoUpdates.map((item) => (
                          <div key={item.id} className="updateCard">
                            <strong>{item.caption || "Tree Photo Update"}</strong>
                            <p>{item.notes || "No notes."}</p>
                            <small>{formatDateTime(item.created_at)}</small>

                            <div className="photoLinks">
                              {item.photo_url && (
                                <a href={item.photo_url} target="_blank" rel="noreferrer">
                                  Open Main Photo
                                </a>
                              )}
                              {item.before_photo_url && (
                                <a href={item.before_photo_url} target="_blank" rel="noreferrer">
                                  Before
                                </a>
                              )}
                              {item.after_photo_url && (
                                <a href={item.after_photo_url} target="_blank" rel="noreferrer">
                                  After
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <ModalActions close={() => setActivePanel("NONE")} />
                  </>
                )}

                {activePanel === "GPS" && (
                  <>
                    <h3>GPS Verification</h3>
                    <p>Live GPS logs submitted by gardener or field staff.</p>

                    {panelLoading ? (
                      <div className="empty small">Loading GPS logs...</div>
                    ) : gpsLogs.length === 0 ? (
                      <div className="empty small">No GPS log uploaded yet.</div>
                    ) : (
                      <div className="updateList">
                        {gpsLogs.map((item) => {
                          const lat = item.latitude;
                          const lng = item.longitude;
                          const mapUrl =
                            lat && lng
                              ? `https://www.google.com/maps?q=${lat},${lng}`
                              : "";

                          return (
                            <div key={item.id} className="updateCard">
                              <strong>GPS Verification</strong>
                              <p>Latitude: {lat || "—"}</p>
                              <p>Longitude: {lng || "—"}</p>
                              <p>Accuracy: {item.accuracy_meters || "—"} meters</p>
                              <p>{item.gps_note || item.notes || "No GPS note."}</p>
                              <small>{formatDateTime(item.created_at)}</small>

                              {mapUrl && (
                                <div className="photoLinks">
                                  <a href={mapUrl} target="_blank" rel="noreferrer">
                                    Open Google Maps
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <ModalActions close={() => setActivePanel("NONE")} />
                  </>
                )}

                {activePanel === "HEALTH" && (
                  <>
                    <h3>Tree Health Reports</h3>
                    <p>Live health reports submitted by gardener.</p>

                    {panelLoading ? (
                      <div className="empty small">Loading health reports...</div>
                    ) : healthReports.length === 0 ? (
                      <div className="empty small">No health report submitted yet.</div>
                    ) : (
                      <div className="updateList">
                        {healthReports.map((item) => (
                          <div key={item.id} className="updateCard">
                            <strong>{item.health_status || "Health Report"}</strong>
                            <p>Disease Found: {item.disease_found ? "YES" : "NO"}</p>
                            <p>Pest Found: {item.pest_found ? "YES" : "NO"}</p>
                            <p>Issue Notes: {item.issue_notes || "—"}</p>
                            <p>Recommendation: {item.recommendation || "—"}</p>
                            <small>{formatDateTime(item.created_at)}</small>
                          </div>
                        ))}
                      </div>
                    )}

                    <ModalActions close={() => setActivePanel("NONE")} />
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
                        <p>{selectedTree.custom_name || selectedTree.name || "Agarwood Tree"}</p>
                        <small>{selectedQrUrl}</small>
                      </div>
                    </div>

                    <div className="modalActions">
                      <button onClick={() => setActivePanel("NONE")}>Close</button>
                      <button className="primary" onClick={() => window.open(selectedQrUrl, "_blank")}>
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
          grid-template-columns: 380px 1fr;
          gap: 18px;
          align-items: start;
        }

        .treeList {
          padding: 14px;
          display: grid;
          gap: 12px;
          max-height: 840px;
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

        .identityBox {
          min-width: 240px;
          border-radius: 24px;
          padding: 18px;
          color: white;
          background: linear-gradient(135deg, #244536, #10281f);
        }

        .identityBox strong {
          display: block;
          color: rgba(255,255,255,.7);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .identityBox p {
          margin: 8px 0 14px;
          font-size: 22px;
          font-weight: 900;
        }

        .identityActions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .identityActions button {
          border: 0;
          border-radius: 999px;
          padding: 10px;
          background: rgba(255,255,255,.13);
          color: white;
          font-weight: 900;
          cursor: pointer;
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
          width: min(720px, 100%);
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

        .updateList {
          display: grid;
          gap: 12px;
          margin-top: 16px;
        }

        .updateCard {
          border-radius: 18px;
          background: #f3ead8;
          border: 1px solid rgba(92,70,35,.08);
          padding: 15px;
        }

        .updateCard strong {
          color: #101a14;
          font-size: 16px;
        }

        .updateCard p {
          margin: 7px 0 0;
          color: #5f665e;
          font-size: 13px;
        }

        .updateCard small {
          display: block;
          margin-top: 8px;
          color: #8c6a3c;
          font-weight: 900;
        }

        .photoLinks {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .photoLinks a {
          border-radius: 999px;
          padding: 9px 12px;
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
          text-decoration: none;
          font-size: 12px;
          font-weight: 900;
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
          .actions,
          .modalActions,
          .qrPreview,
          .modalGrid {
            grid-template-columns: 1fr;
          }

          .detailTop {
            flex-direction: column;
          }

          .identityBox {
            width: 100%;
          }

          .fakeQr {
            width: 100%;
          }
        }
      `}</style>
        </>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good?: boolean;
}) {
  return (
    <div className={`stat ${good ? "good" : ""}`}>
      <p>{label}</p>
      <h3>{value}</h3>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: any }) {
  return (
    <div className="mini">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
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
      <strong>{percent ? `${Number(value || 0).toFixed(2)}%` : peso(value)}</strong>
    </div>
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

function normalizeStage(stage: any) {
  const value = String(stage || "").trim().toLowerCase();

  if (!value) return "Seedling";
  if (value.includes("harvest")) return "Harvest Ready";
  if (value.includes("mature")) return "Mature Tree";
  if (value.includes("young")) return "Young Tree";
  if (value.includes("sapling")) return "Sapling";
  if (value.includes("seed")) return "Seedling";

  return String(stage || "Seedling");
}

function getPurchasePrice(tree: TreeRow) {
  return Number(
    tree.purchase_price ||
      tree.price ||
      tree.tree_price ||
      tree.base_price ||
      tree.amount_paid ||
      0
  );
}

function getOperationCost(tree: TreeRow) {
  return Number(
    tree.operation_cost ||
      tree.total_operation_cost ||
      tree.care_operation_cost ||
      tree.service_cost ||
      0
  );
}

function getCareProgramCost(tree: TreeRow) {
  return Number(
    tree.care_program_total_cost ||
      tree.care_program_cost ||
      tree.care_program_price ||
      tree.subscription_total ||
      0
  );
}

function getVerificationCost(tree: TreeRow) {
  return Number(
    tree.verification_cost ||
      tree.gps_fee ||
      tree.photo_fee ||
      tree.gps_photo_fee ||
      0
  );
}

function getTotalSpent(tree: TreeRow) {
  return (
    getPurchasePrice(tree) +
    getOperationCost(tree) +
    getCareProgramCost(tree) +
    getVerificationCost(tree)
  );
}

function getEstimatedValue(tree: TreeRow) {
  const explicit = Number(
    tree.estimated_value ||
      tree.estimated_sell_value ||
      tree.market_value ||
      tree.current_value ||
      tree.valuation_amount ||
      0
  );

  if (explicit > 0) return explicit;

  const purchase = getPurchasePrice(tree);
  const stage = normalizeStage(tree.stage || tree.growth_stage).toLowerCase();

  if (stage === "harvest ready") return purchase * 4;
  if (stage === "mature tree") return purchase * 3;
  if (stage === "young tree") return purchase * 2;
  if (stage === "sapling") return purchase * 1.35;

  return purchase;
}

function getTreeMath(tree: TreeRow) {
  const totalSpent = getTotalSpent(tree);
  const estimatedValue = getEstimatedValue(tree);
  const profit = estimatedValue - totalSpent;
  const roi = totalSpent > 0 ? (profit / totalSpent) * 100 : 0;

  return { totalSpent, estimatedValue, profit, roi };
}

function getAgeText(tree: TreeRow) {
  const plantedDate = tree.planted_at || tree.planted_date || tree.created_at;

  if (!plantedDate) return "—";

  const start = new Date(plantedDate);
  const now = new Date();

  if (Number.isNaN(start.getTime())) return "—";

  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months === 1 ? "" : "s"}`;
  }

  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);

  if (months <= 0) return `${years} year${years === 1 ? "" : "s"}`;

  return `${years}y ${months}m`;
}

function formatDate(value: any) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: any) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function peso(value: any) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(amount);
}
