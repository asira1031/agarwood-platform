"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TreeRow = Record<string, any>;
type SellRequest = Record<string, any>;
type InventoryItem = Record<string, any>;

type CarePlanKey = "WEEKLY" | "MONTHLY";

const STAGES = ["Seedling", "Sapling", "Young Tree", "Mature Tree", "Harvest Ready"];

const CARE_PLANS: Record<
  CarePlanKey,
  {
    label: string;
    duration: string;
    careCost: number;
    multiplier: number;
    needs: Record<string, number>;
  }
> = {
  WEEKLY: {
    label: "Weekly Care",
    duration: "1_WEEK",
    careCost: 500,
    multiplier: 1,
    needs: {
      Fertilizer: 1,
      Fungicide: 0.5,
      Insecticide: 0.25,
      Nutrients: 0.5,
      "Soil Conditioner": 0.5,
    },
  },
  MONTHLY: {
    label: "Monthly Care",
    duration: "1_MONTH",
    careCost: 1800,
    multiplier: 4,
    needs: {
      Fertilizer: 1,
      Fungicide: 0.5,
      Insecticide: 0.25,
      Nutrients: 0.5,
      "Soil Conditioner": 0.5,
    },
  },
};

export default function MyTreesPage() {
  const [profileId, setProfileId] = useState("");
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [sellRequests, setSellRequests] = useState<SellRequest[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTree, setSelectedTree] = useState<TreeRow | null>(null);
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"TREES" | "GROUPS">("TREES");
  const [stageFilter, setStageFilter] = useState("ALL");

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const [qrOpen, setQrOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<CarePlanKey>("WEEKLY");
  const [subscribing, setSubscribing] = useState(false);

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

    setProfileId(profile.id);

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

    const { data: inventoryData } = await supabase
      .from("inventory")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false });

    const rows = treeData || [];

    setTrees(rows);
    setSellRequests(sellData || []);
    setInventory(inventoryData || []);

    setSelectedTree((current: TreeRow | null) => {
      if (current) {
        const refreshed = rows.find((tree: TreeRow) => tree.id === current.id);
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
    const owned = trees.filter((tree) => !isSold(tree)).length;
    const totalSpent = trees.reduce((sum, tree) => sum + getTotalSpent(tree), 0);
    const estimatedValue = trees.reduce((sum, tree) => sum + getEstimatedValue(tree), 0);
    const profit = estimatedValue - totalSpent;

    return { owned, totalSpent, estimatedValue, profit };
  }, [trees]);

  const filteredTrees = useMemo(() => {
    const q = search.trim().toLowerCase();

    return trees.filter((tree) => {
      const stage = String(
        tree.stage || tree.growth_stage || tree.current_stage || ""
      ).toLowerCase();
      const code = String(tree.tree_code || tree.code || tree.id || "").toLowerCase();
      const name = String(
        tree.custom_name || tree.display_name || tree.name || ""
      ).toLowerCase();
      const group = String(
        tree.tree_group_name || tree.package_name || "Ungrouped"
      ).toLowerCase();

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
      const groupName = tree.tree_group_name || tree.package_name || "Ungrouped Trees";
      if (!map[groupName]) map[groupName] = [];
      map[groupName].push(tree);
    });

    return Object.entries(map).map(([name, groupTrees]) => {
      const totalSpent = groupTrees.reduce((sum, tree) => sum + getTotalSpent(tree), 0);
      const estimatedValue = groupTrees.reduce((sum, tree) => sum + getEstimatedValue(tree), 0);
      const profit = estimatedValue - totalSpent;

      return {
        name,
        trees: groupTrees,
        totalSpent,
        estimatedValue,
        profit,
      };
    });
  }, [filteredTrees]);

  const selectedMath = selectedTree
    ? getTreeMath(selectedTree)
    : { totalSpent: 0, estimatedValue: 0, profit: 0, roi: 0 };

  const selectedQrUrl = selectedTree
    ? selectedTree.tree_qr_url || `/tree/${selectedTree.id}`
    : "";

  const careCheck = useMemo(() => {
    return getCareCheck(selectedPlan, inventory);
  }, [selectedPlan, inventory]);

  const canSubscribe = Boolean(selectedTree) && careCheck.every((item) => item.enough);

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

    setRenameOpen(false);
    setMessage("Tree renamed successfully. Tree code and QR identity did not change.");
    await loadTrees();
  }

  function openRename() {
    if (!selectedTree) return;
    setRenameValue(
      selectedTree.custom_name ||
        selectedTree.display_name ||
        selectedTree.name ||
        "Agarwood Tree"
    );
    setRenameOpen(true);
  }

  function openQr() {
    if (!selectedTree) return;
    setQrOpen(true);
  }

  async function subscribeCare() {
    setMessage("");

    if (!profileId) {
      setMessage("Profile not found.");
      return;
    }

    if (!selectedTree) {
      setMessage("Select a tree first.");
      return;
    }

    const check = getCareCheck(selectedPlan, inventory);
    const missing = check.filter((item) => !item.enough);

    if (missing.length > 0) {
      setMessage(
        `Care subscription blocked. Low supply: ${missing
          .map((item) => `${item.category} need ${item.required} ${item.unit}, available ${item.available} ${item.unit}`)
          .join("; ")}.`
      );
      return;
    }

    try {
      setSubscribing(true);

      const plan = CARE_PLANS[selectedPlan];

      for (const item of check) {
        const inventoryItem = item.inventoryItem;

        if (!inventoryItem) continue;

        const newRemaining = Number(inventoryItem.remaining_qty || 0) - item.required;

        const { error: updateError } = await supabase
          .from("inventory")
          .update({
            remaining_qty: newRemaining,
            status: newRemaining <= 0 ? "OUT_OF_STOCK" : "AVAILABLE",
          })
          .eq("id", inventoryItem.id);

        if (updateError) throw updateError;

        const { error: logError } = await supabase.from("inventory_usage_logs").insert({
          profile_id: profileId,
          tree_id: selectedTree.id,
          inventory_id: inventoryItem.id,
          item_name: inventoryItem.item_name,
          category: inventoryItem.category,
          qty_used: item.required,
          unit: inventoryItem.unit,
          used_by: "CARE_SUBSCRIPTION",
          reason: `${plan.label} for ${selectedTree.tree_code || selectedTree.id}`,
        });

        if (logError) {
          console.warn("Inventory usage log skipped:", logError.message);
        }
      }

      const { error: subscriptionError } = await supabase.from("care_subscriptions").insert({
        profile_id: profileId,
        tree_id: selectedTree.id,
        plan_name: plan.label,
        duration: plan.duration,
        required_fertilizer: findRequired(check, "Fertilizer"),
        required_fungicide: findRequired(check, "Fungicide"),
        required_insecticide: findRequired(check, "Insecticide"),
        required_nutrients: findRequired(check, "Nutrients"),
        required_soil_conditioner: findRequired(check, "Soil Conditioner"),
        total_supply_units: check.reduce((sum, item) => sum + item.required, 0),
        status: "ACTIVE",
      });

      if (subscriptionError) {
        console.warn("Care subscription log skipped:", subscriptionError.message);
      }

      const currentCareCost = getOperationCost(selectedTree);

      const { error: treeUpdateError } = await supabase
        .from("trees")
        .update({
          care_cost: currentCareCost + plan.careCost,
          care_plan: plan.label,
        })
        .eq("id", selectedTree.id);

      if (treeUpdateError) throw treeUpdateError;

      setMessage(`${plan.label} activated. Supplies deducted from Inventory.`);
      await loadTrees();
    } catch (error: any) {
      setMessage(error?.message || "Care subscription failed.");
    } finally {
      setSubscribing(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Agarwood Portfolio V3</p>
          <h1>My Trees</h1>
          <span>
            Search, group, rename, verify QR identity, track ROI, and subscribe
            care only when Inventory supplies are enough.
          </span>
        </div>

        <div className="heroCard">
          <p>Inventory Gate</p>
          <strong>{careCheck.every((item) => item.enough) ? "READY" : "LOW"}</strong>
          <small>For selected care plan</small>
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
                  onChange={(e: any) => setSearch(e.target.value)}
                  placeholder="Tree code, name, group, package, stage..."
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
                            <p>
                              {tree.custom_name ||
                                tree.display_name ||
                                tree.name ||
                                "Agarwood Tree"}
                            </p>
                            <small>
                              {tree.tree_group_name || tree.package_name || "Ungrouped Trees"}
                            </small>
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
                          <p>
                            {group.trees.length} tree
                            {group.trees.length === 1 ? "" : "s"}
                          </p>
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
                    <h2>
                      {selectedTree.custom_name ||
                        selectedTree.display_name ||
                        selectedTree.name ||
                        "Agarwood Tree"}
                    </h2>
                    <span>{selectedTree.tree_code || selectedTree.code || selectedTree.id}</span>
                    <p className="groupName">
                      {selectedTree.tree_group_name ||
                        selectedTree.package_name ||
                        "Ungrouped Trees"}
                    </p>
                  </div>

                  <div className="identityBox">
                    <strong>Tree Identity</strong>
                    <p>{selectedTree.tree_code || selectedTree.id}</p>
                    <div className="identityActions">
                      <button onClick={openRename}>Rename</button>
                      <button onClick={openQr}>View QR</button>
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
                      const current = normalizeStage(
                        selectedTree.stage ||
                          selectedTree.growth_stage ||
                          selectedTree.current_stage
                      );
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
                  <Mini
                    label="Stage"
                    value={
                      selectedTree.stage ||
                      selectedTree.growth_stage ||
                      selectedTree.current_stage ||
                      "—"
                    }
                  />
                  <Mini label="Age" value={getAgeText(selectedTree)} />
                  <Mini
                    label="GPS Status"
                    value={selectedTree.gps_status || selectedTree.gpsStatus || "Pending"}
                  />
                  <Mini
                    label="Care Plan"
                    value={selectedTree.care_plan || selectedTree.carePlan || "Not Enrolled"}
                  />
                  <Mini
                    label="Valuation"
                    value={selectedTree.valuation_status || "Awaiting Valuation"}
                  />
                  <Mini
                    label="Availability"
                    value={selectedTree.availability_status || "Owned"}
                  />
                </section>

                <section className="careBox">
                  <div className="panelHead">
                    <div>
                      <h3>Care Subscription Inventory Check</h3>
                      <p>
                        This checks Inventory first. If supplies are low, subscription is blocked.
                      </p>
                    </div>
                  </div>

                  <div className="planSwitch">
                    <button
                      className={selectedPlan === "WEEKLY" ? "active" : ""}
                      onClick={() => setSelectedPlan("WEEKLY")}
                    >
                      1 Week Care
                    </button>
                    <button
                      className={selectedPlan === "MONTHLY" ? "active" : ""}
                      onClick={() => setSelectedPlan("MONTHLY")}
                    >
                      1 Month Care
                    </button>
                  </div>

                  <div className="supplyList">
                    {careCheck.map((item) => (
                      <div
                        className={`supplyRow ${item.enough ? "ok" : "bad"}`}
                        key={item.category}
                      >
                        <div>
                          <strong>{item.category}</strong>
                          <p>
                            Need {item.required} {item.unit} • Available{" "}
                            {item.available} {item.unit}
                          </p>
                        </div>
                        <span>{item.enough ? "Enough" : "Low Supply"}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    className="subscribe"
                    disabled={!canSubscribe || subscribing}
                    onClick={subscribeCare}
                  >
                    {subscribing
                      ? "Processing..."
                      : canSubscribe
                      ? `Subscribe ${CARE_PLANS[selectedPlan].label}`
                      : "Buy missing supplies first"}
                  </button>
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
                    <Money
                      label="Projected Profit / Loss"
                      value={selectedMath.profit}
                      strong
                      good={selectedMath.profit >= 0}
                    />
                    <Money label="ROI" value={selectedMath.roi} percent good={selectedMath.roi >= 0} />
                  </div>
                </section>

                <section className="actions">
                  <button onClick={() => setQrOpen(true)}>View QR</button>
                  <button onClick={() => (window.location.href = "/dashboard/inventory")}>
                    Check Inventory
                  </button>
                  <button onClick={() => (window.location.href = "/dashboard/sell-tree")} className="sell">
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

                  {sellRequests.filter((item) => item.tree_id === selectedTree.id || item.tree_id === selectedTree.tree_code).length === 0 ? (
                    <div className="empty small">No sell request for this tree.</div>
                  ) : (
                    <div className="requestList">
                      {sellRequests
                        .filter((item) => item.tree_id === selectedTree.id || item.tree_id === selectedTree.tree_code)
                        .map((item) => (
                          <div className="requestRow" key={item.id}>
                            <div>
                              <strong>
                                {peso(
                                  Number(
                                    item.expected_amount ||
                                      item.selling_price ||
                                      item.net_receive ||
                                      item.tree_value ||
                                      0
                                  )
                                )}
                              </strong>
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

          {renameOpen && selectedTree && (
            <div className="modal">
              <div className="modalCard">
                <h3>Rename Tree</h3>
                <p>
                  Rename only changes the display name. Tree code and QR identity remain permanent.
                </p>

                <label>New Tree Name</label>
                <input
                  value={renameValue}
                  onChange={(e: any) => setRenameValue(e.target.value)}
                  placeholder="Example: Retirement Tree A"
                />

                <div className="modalActions">
                  <button onClick={() => setRenameOpen(false)}>Cancel</button>
                  <button className="primary" onClick={saveRename}>
                    Save Name
                  </button>
                </div>
              </div>
            </div>
          )}

          {qrOpen && selectedTree && (
            <div className="modal">
              <div className="modalCard qrModal">
                <h3>Tree QR Identity</h3>
                <p>
                  This QR should be attached to the real tree. Scanning it opens the official
                  tree verification page.
                </p>

                <div className="qrPreview">
                  <div className="fakeQr">
                    <span>QR</span>
                  </div>

                  <div>
                    <strong>{selectedTree.tree_code || selectedTree.id}</strong>
                    <p>
                      {selectedTree.custom_name ||
                        selectedTree.display_name ||
                        selectedTree.name ||
                        "Agarwood Tree"}
                    </p>
                    <small>{selectedQrUrl}</small>
                  </div>
                </div>

                <div className="modalActions">
                  <button onClick={() => setQrOpen(false)}>Close</button>
                  <button
                    className="primary"
                    onClick={() => window.open(selectedQrUrl, "_blank")}
                  >
                    Open Verification Page
                  </button>
                </div>
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
          align-items: stretch;
          gap: 18px;
          margin-bottom: 22px;
        }

        .heroCard {
          min-width: 260px;
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
          font-size: 30px;
        }

        .heroCard small {
          color: rgba(255,255,255,.72);
          font-weight: 900;
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
        .history,
        .careBox {
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

        .searchBox label {
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
        .stageFilters button,
        .planSwitch button {
          border: 1px solid rgba(92,70,35,.12);
          border-radius: 999px;
          padding: 11px 12px;
          background: #f3ead8;
          color: #244536;
          font-weight: 900;
          cursor: pointer;
        }

        .viewSwitch button.active,
        .stageFilters button.active,
        .planSwitch button.active {
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
        .history,
        .careBox {
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
        .requestRow,
        .supplyRow {
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

        .planSwitch {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 16px;
        }

        .supplyList {
          display: grid;
          gap: 10px;
          margin-top: 16px;
        }

        .supplyRow {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }

        .supplyRow p {
          margin: 6px 0 0;
          color: #6b6b62;
          font-size: 13px;
          font-weight: 800;
        }

        .supplyRow span {
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 900;
        }

        .supplyRow.ok span {
          background: rgba(49,85,61,.12);
          color: #31553d;
        }

        .supplyRow.bad span {
          background: rgba(163,60,42,.12);
          color: #a33c2a;
        }

        .subscribe {
          width: 100%;
          margin-top: 16px;
          border: 0;
          border-radius: 18px;
          padding: 15px;
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .subscribe:disabled {
          opacity: .55;
          cursor: not-allowed;
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
          grid-template-columns: repeat(3, 1fr);
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
          width: min(560px, 100%);
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

        .modalCard label {
          display: block;
          margin: 16px 0 8px;
          color: #6b6b62;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
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
          .actions {
            grid-template-columns: repeat(2, 1fr);
          }

          .layout {
            grid-template-columns: 1fr;
          }

          .hero {
            display: grid;
          }

          .heroCard {
            min-width: 0;
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
          .planSwitch {
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

          .supplyRow {
            display: grid;
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

function getCareCheck(planKey: CarePlanKey, inventory: InventoryItem[]) {
  const plan = CARE_PLANS[planKey];

  return Object.entries(plan.needs).map(([category, weeklyQty]) => {
    const required = Number(weeklyQty || 0) * plan.multiplier;
    const inventoryItem = findInventoryByCategory(inventory, category);
    const available = Number(inventoryItem?.remaining_qty || 0);

    return {
      category,
      required,
      available,
      unit: inventoryItem?.unit || "unit",
      enough: available >= required,
      inventoryItem,
    };
  });
}

function findInventoryByCategory(inventory: InventoryItem[], category: string) {
  const target = category.trim().toLowerCase();

  return inventory.find((item) => {
    const itemCategory = String(item.category || "").trim().toLowerCase();
    const itemName = String(item.item_name || "").trim().toLowerCase();

    return itemCategory === target || itemName.includes(target);
  });
}

function findRequired(check: ReturnType<typeof getCareCheck>, category: string) {
  return check.find((item) => item.category === category)?.required || 0;
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

function isSold(tree: TreeRow) {
  const ownership = String(tree.ownership_status || "").toUpperCase();
  const availability = String(tree.availability_status || "").toUpperCase();

  return ownership === "SOLD" || availability === "SOLD";
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
