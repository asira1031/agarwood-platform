"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TreeRow = Record<string, any>;

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  auto_renew?: boolean | null;
};

type Wallet = {
  id: string;
  profile_id: string;
  balance: number | null;
};

type InventoryItem = {
  id: string;
  profile_id: string;
  tree_id: string | null;
  item_name: string | null;
  category: string | null;
  unit: string | null;
  starting_qty: number | null;
  remaining_qty: number | null;
  low_stock_level: number | null;
  status: string | null;
  created_at: string | null;
};

type OperationRequest = {
  id: string;
  profile_id: string;
  tree_id: string | null;
  operation_type: string | null;
  operation_fee: number | null;
  platform_fee: number | null;
  total_amount: number | null;
  notes: string | null;
  status: string | null;
  created_at: string | null;
  care_program_name?: string | null;
  care_program_price?: number | null;
  care_program_duration?: string | null;
  care_program_status?: string | null;
  next_renewal_date?: string | null;
  auto_renew_enabled?: boolean | null;
};

type MarketplaceProduct = {
  id: string;
  product_key: string | null;
  name: string | null;
  price: number | null;
  note: string | null;
  stock_status: string | null;
  icon: string | null;
  image_url?: string | null;
  category: string | null;
  unit: string | null;
  low_stock_level: number | null;
  product_type: string | null;
  status: string | null;
  created_at: string | null;
};

type OperationItem = {
  name: string;
  category: "Service" | "Inventory Use" | "Care Program";
  price: number;
  description: string;
  requiredInventoryCategory?: string;
  requiredQty?: number;
  duration?: string;
  coverage?: string;
  status?: string;
  sourceProduct?: MarketplaceProduct;
};

const BASE_OPERATIONS: OperationItem[] = [
  {
    name: "Photo Update",
    category: "Service",
    price: 100,
    description: "Request a real caretaker photo update for the selected tree.",
  },
  {
    name: "GPS Verification",
    category: "Service",
    price: 80,
    description: "Request field verification of QR tag and plantation GPS location.",
  },
  {
    name: "Watering Service",
    category: "Service",
    price: 150,
    description: "Request watering support from the plantation operation team.",
  },
  {
    name: "Apply Fertilizer",
    category: "Inventory Use",
    price: 45,
    description: "Request fertilizer application for the selected tree.",
    requiredInventoryCategory: "Fertilizer",
    requiredQty: 1,
  },
  {
    name: "Apply Fungicide",
    category: "Inventory Use",
    price: 45,
    description: "Request fungicide application for fungal prevention or treatment.",
    requiredInventoryCategory: "Fungicide",
    requiredQty: 1,
  },
  {
    name: "Apply Insecticide",
    category: "Inventory Use",
    price: 45,
    description: "Request insecticide application when field team confirms need.",
    requiredInventoryCategory: "Insecticide",
    requiredQty: 1,
  },
];

export default function TreeOperationsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [requests, setRequests] = useState<OperationRequest[]>([]);
  const [carePrograms, setCarePrograms] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [selectedOperation, setSelectedOperation] = useState("Photo Update");
  const [note, setNote] = useState("");
  const [processing, setProcessing] = useState(false);

  async function loadData() {
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

    const { data: walletRows } = await supabase
      .from("wallets")
      .select("id, profile_id, balance, created_at")
      .eq("profile_id", currentProfile.id)
      .order("created_at", { ascending: false })
      .limit(1);

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

    const { data: inventoryData, error: inventoryError } = await supabase
      .from("inventory")
      .select("*")
      .eq("profile_id", currentProfile.id)
      .order("created_at", { ascending: false });

    if (inventoryError) {
      console.warn("Inventory load error:", inventoryError.message);
    }

    const { data: requestData } = await supabase
      .from("tree_operation_requests")
      .select(
        "id, profile_id, tree_id, operation_type, operation_fee, platform_fee, total_amount, notes, status, created_at, care_program_name, care_program_price, care_program_duration, care_program_status, next_renewal_date, auto_renew_enabled"
      )
      .eq("profile_id", currentProfile.id)
      .order("created_at", { ascending: false });

    const { data: programData, error: programError } = await supabase
      .from("marketplace_products")
      .select(
        "id, product_key, name, price, note, stock_status, icon, image_url, category, unit, low_stock_level, product_type, status, created_at"
      )
      .eq("category", "Tree Care Programs")
      .eq("status", "ACTIVE")
      .order("price", { ascending: true });

    if (programError) {
      console.warn("Care program load error:", programError.message);
    }

    const ownedTrees = treeData || [];

    setWallet((walletRows?.[0] as Wallet) || null);
    setTrees(ownedTrees);
    setInventory(inventoryError ? [] : ((inventoryData as InventoryItem[]) || []));
    setRequests((requestData as OperationRequest[]) || []);
    setCarePrograms((programData as MarketplaceProduct[]) || []);
    setSelectedTreeId((current) => current || ownedTrees[0]?.id || "");
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

 const careProgramOperations = useMemo<OperationItem[]>(() => {
  return carePrograms.map(
    (program): OperationItem => ({
      name: program.name || "Tree Care Program",
      category: "Care Program",
      price: Number(program.price || 0),
      description: program.note || "Marketplace Tree Care Program.",
      duration: getProgramDuration(program),
      coverage: getProgramCoverage(program),
      status: program.stock_status || "ACTIVE",
      sourceProduct: program,
    })
  );
}, [carePrograms]);

 const operations = useMemo<OperationItem[]>(() => {
  return [...BASE_OPERATIONS, ...careProgramOperations];
}, [careProgramOperations]);

  const selectedTree = useMemo(() => {
    return trees.find((tree) => tree.id === selectedTreeId) || null;
  }, [trees, selectedTreeId]);

  const operation = useMemo<OperationItem | undefined>(() => {
    const found = operations.find((item) => item.name === selectedOperation);
    return found || operations[0] || BASE_OPERATIONS[0];
  }, [operations, selectedOperation]);

  const requiredInventoryCategory = getRequiredInventoryCategory(operation);
  const requiredInventoryQty = getRequiredInventoryQty(operation);

  const requiredInventoryItem = useMemo(() => {
    if (!requiredInventoryCategory) return null;

    return (
      inventory.find((item) => {
        const category = String(item.category || "").toLowerCase();
        const name = String(item.item_name || "").toLowerCase();
        const required = requiredInventoryCategory.toLowerCase();

        return (
          Number(item.remaining_qty || 0) > 0 &&
          (category.includes(required) || name.includes(required))
        );
      }) || null
    );
  }, [inventory, requiredInventoryCategory]);

  const hasRequiredInventory =
    operation?.category !== "Inventory Use" ||
    (requiredInventoryItem &&
      Number(requiredInventoryItem.remaining_qty || 0) >= requiredInventoryQty);

  const walletBalance = Number(wallet?.balance || 0);
  const baseOperationFee = Number(operation?.price || 0);
  const platformFeePreview = operation?.category === "Care Program" ? 0 : baseOperationFee * 0.02;
  const totalPreview = baseOperationFee + platformFeePreview;

  const stats = useMemo(() => {
    const pending = requests.filter(
      (item) => (item.status || "PENDING").toUpperCase() === "PENDING"
    ).length;
    const completed = requests.filter(
      (item) => (item.status || "").toUpperCase() === "COMPLETED"
    ).length;
    const totalSpent = requests
      .filter((item) =>
        ["APPROVED", "COMPLETED", "PENDING"].includes((item.status || "").toUpperCase())
      )
      .reduce((sum, item) => sum + Number(item.total_amount || 0), 0);

    return {
      ownedTrees: trees.length,
      pending,
      completed,
      totalSpent,
    };
  }, [trees, requests]);

  function handleChooseOperation(item: OperationItem) {
    setSelectedOperation(item.name);

    if (item.category === "Care Program") {
      setMessage(
        `${item.name} selected. Step 6B creates a care program request, then updates only the selected tree care program fields. No wallet charge, inventory deduction, subscription table, billing, auto-renew processing, or background job will run.`
      );
      return;
    }

    setMessage("");
  }

  async function createOperationRequest(autoRenewEnabled: boolean) {
    setMessage("");

    if (!profile) return setMessage("Profile not found.");
    if (!selectedTree) return setMessage("Please select a tree.");
    if (!operation) return setMessage("Please choose a care program.");

    if (operation.category !== "Care Program") {
      setMessage("Step 6B is only for Tree Care Program activation on the selected tree.");
      return;
    }

    setProcessing(true);

    const startedAt = new Date().toISOString();
    const nextRenewalDate = getNextRenewalDate(operation.duration || "Program");
    const programPrice = Number(operation.price || 0);
    const programDuration = operation.duration || "Program";
    const programCoverage = operation.coverage || "Program coverage pending";

    const requestPayload = {
      profile_id: profile.id,
      tree_id: selectedTree.id,
      operation_type: operation.name,
      operation_fee: programPrice,
      platform_fee: 0,
      total_amount: programPrice,
      notes: note.trim() || null,
      status: "PENDING",
      care_program_name: operation.name,
      care_program_price: programPrice,
      care_program_duration: programDuration,
      care_program_status: "PENDING",
      next_renewal_date: nextRenewalDate,
      auto_renew_enabled: autoRenewEnabled,
    };

    const { error: requestError } = await supabase
      .from("tree_operation_requests")
      .insert(requestPayload);

    if (requestError) {
      setProcessing(false);
      setMessage(requestError.message);
      return;
    }

    const treeUpdatePayload = {
      care_program_name: operation.name,
      care_program_price: programPrice,
      care_program_started_at: startedAt,
      care_program_next_renewal: nextRenewalDate,
      care_program_coverage: programCoverage,
      care_program_status: "ACTIVE",
      auto_renew_enabled: autoRenewEnabled,
    };

    const { error: treeUpdateError } = await supabase
      .from("trees")
      .update(treeUpdatePayload)
      .eq("id", selectedTree.id)
      .eq("profile_id", profile.id);

    if (treeUpdateError) {
      setProcessing(false);
      setMessage(
        `Request was created, but selected tree update failed: ${treeUpdateError.message}`
      );
      await loadData();
      return;
    }

    setNote("");
    setProcessing(false);

    await loadData();

    setMessage(
      `${operation.name} activated for ${selectedTree.tree_code || selectedTree.id}. ${
        autoRenewEnabled ? "Subscribe selected." : "Buy Once selected."
      } Request created first, then selected tree care program fields updated. No wallet, inventory, billing, subscription table, cron job, or background job was run.`
    );
  }

  function previewOperation() {
    setMessage("");

    if (!selectedTree) return setMessage("Please select a tree.");
    if (!operation) return setMessage("Please choose a service.");

    if (operation.category === "Inventory Use" && !hasRequiredInventory) {
      setMessage(
        `Preview only: ${requiredInventoryCategory || "Required supply"} is missing or low. Buy supplies from Marketplace before this is connected later.`
      );
      return;
    }

    setMessage(
      `${operation.name} preview checked for ${
        selectedTree.tree_code || selectedTree.id
      }. Step 6B creates Tree Care Program requests and updates only selected tree fields.`
    );
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Tree Operations Sync</p>
          <h1>Request Tree Care Services</h1>
          <span>
            Select one of your owned trees, choose a service, and preview
            operation details. Marketplace Tree Care Programs are synced from
            marketplace_products. Step 6B creates a request, then updates only the selected tree record.
          </span>
        </div>

        <div className="walletCard">
          <p>Wallet Balance</p>
          <strong>{peso(walletBalance)}</strong>
          <small>No wallet charge in Step 6B</small>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      {loading ? (
        <div className="empty">Loading tree operations...</div>
      ) : trees.length === 0 ? (
        <div className="empty">
          You do not own any trees yet. Purchase or assign trees first before requesting operations.
        </div>
      ) : (
        <>
          <section className="stats">
            <Stat label="Owned Trees" value={String(stats.ownedTrees)} />
            <Stat label="Pending Requests" value={String(stats.pending)} />
            <Stat label="Completed Services" value={String(stats.completed)} />
            <Stat label="Recorded Spend" value={peso(stats.totalSpent)} />
          </section>

          <section className="grid">
            <section className="panel">
              <PanelHead
                title="1. Select Tree"
                text="Only trees owned by your account are shown."
              />

              <div className="treeList">
                {trees.map((tree) => {
                  const active = selectedTreeId === tree.id;

                  return (
                    <button
                      key={tree.id}
                      className={`treeCard ${active ? "active" : ""}`}
                      onClick={() => setSelectedTreeId(tree.id)}
                    >
                      <strong>{tree.tree_code || tree.code || tree.id}</strong>
                      <p>
                        {tree.custom_name ||
                          tree.display_name ||
                          tree.name ||
                          "Agarwood Tree"}
                      </p>
                      <small>
                        {tree.stage || tree.growth_stage || tree.current_stage || "Stage Pending"} •{" "}
                        {tree.tree_group_name || "Ungrouped"}
                      </small>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="panel">
              <PanelHead
                title="2. Choose Service"
                text="Care programs are read from Marketplace V5 products."
              />

              <div className="serviceList">
                {operations.map((item) => (
                  <button
                    key={`${item.category}-${item.name}`}
                    className={`serviceCard ${
                      selectedOperation === item.name ? "active" : ""
                    } ${item.category === "Care Program" ? "program" : ""}`}
                    onClick={() => handleChooseOperation(item)}
                  >
                    <span>{item.category}</span>
                    <strong>{item.name}</strong>
                    <p>{item.description}</p>
                    <b>
                      {item.category === "Care Program"
                        ? `${peso(item.price)} • ${item.duration || "Program"}`
                        : peso(item.price)}
                    </b>
                  </button>
                ))}
              </div>

              {careProgramOperations.length === 0 && (
                <div className="empty small">
                  No active Tree Care Programs found in marketplace_products.
                </div>
              )}
            </section>

            <section className="panel">
              <PanelHead
                title="3. Activate Program"
                text="Creates the request first, then updates only the selected tree."
              />

              {selectedTree && (
                <div className="selectedBox">
                  <span>Selected Tree</span>
                  <strong>{selectedTree.tree_code || selectedTree.id}</strong>
                  <p>
                    {selectedTree.custom_name ||
                      selectedTree.display_name ||
                      selectedTree.name ||
                      "Agarwood Tree"}
                  </p>
                </div>
              )}

              {selectedTree && (
                <div className="currentProgramBox">
                  <strong>Current Program on Tree</strong>

                  <div className="programMiniGrid">
                    <Mini label="Program" value={selectedTree.care_program_name || selectedTree.care_plan || "Not Enrolled"} />
                    <Mini
                      label="Status"
                      value={String(selectedTree.care_program_status || "NOT_ENROLLED")}
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
                      label="Auto Renew"
                      value={
                        selectedTree.auto_renew_enabled || profile?.auto_renew
                          ? "ON"
                          : "OFF"
                      }
                    />
                    <Mini
                      label="Program Cost"
                      value={peso(Number(selectedTree.care_program_price || 0))}
                    />
                  </div>
                </div>
              )}

              <div className="operationBox">
                <span>{operation?.category || "Service"}</span>
                <h3>{operation?.name || "Tree Operation"}</h3>
                <p>{operation?.description || "Operation preview."}</p>
              </div>

              {operation?.category === "Care Program" && (
                <div className="careSyncBox">
                  <strong>Marketplace Care Program Sync</strong>

                  <div className="programMiniGrid">
                    <Mini label="care_program_name" value={operation.name} />
                    <Mini label="care_program_price" value={peso(operation.price)} />
                    <Mini
                      label="care_program_status"
                      value={operation.status || "ACTIVE"}
                    />
                    <Mini
                      label="care_program_coverage"
                      value={operation.coverage || "Program coverage pending"}
                    />
                    <Mini
                      label="next_renewal_date"
                      value={
                        operation.duration === "1 Week"
                          ? "Weekly renewal"
                          : "Monthly renewal"
                      }
                    />
                    <Mini
                      label="auto_renew_enabled"
                      value="Choose Buy Once or Subscribe below"
                    />
                  </div>

                  <p>
                    This uses the Marketplace product name and price. Buy Once or Subscribe creates a request, then updates only the selected tree care program fields.
                  </p>
                </div>
              )}

              {operation?.category === "Inventory Use" && (
                <div className={`inventoryCheck ${hasRequiredInventory ? "ok" : "bad"}`}>
                  <strong>Inventory Preview</strong>
                  {hasRequiredInventory && requiredInventoryItem ? (
                    <p>
                      Available: {requiredInventoryItem.item_name} —{" "}
                      {Number(requiredInventoryItem.remaining_qty || 0)}{" "}
                      {requiredInventoryItem.unit || ""}
                    </p>
                  ) : (
                    <p>
                      No {requiredInventoryCategory || "required supply"} in inventory.
                      Please buy from Marketplace first.
                    </p>
                  )}

                  {!hasRequiredInventory && (
                    <Link className="buyMissing" href="/dashboard/marketplace">
                      Buy Missing Supplies
                    </Link>
                  )}
                </div>
              )}

              <div className="feeBox">
                <FeeRow
                  label={operation?.category === "Care Program" ? "Program Price" : "Operation Fee"}
                  value={baseOperationFee}
                />
                <FeeRow
                  label={
                    operation?.category === "Care Program"
                      ? "Platform Fee"
                      : "Platform Fee 2% Preview"
                  }
                  value={platformFeePreview}
                />
                <FeeRow label="Total Preview" value={totalPreview} strong />
                <FeeRow label="Wallet Balance" value={walletBalance} />
              </div>

              <label>
                Request Note
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note saved to tree_operation_requests."
                />
              </label>

              {operation?.category === "Care Program" ? (
                <div className="actionGrid">
                  <button
                    className="submitButton secondary"
                    disabled={processing}
                    onClick={() => createOperationRequest(false)}
                  >
                    {processing ? "Creating Request..." : "Buy Once"}
                  </button>

                  <button
                    className="submitButton"
                    disabled={processing}
                    onClick={() => createOperationRequest(true)}
                  >
                    {processing ? "Creating Request..." : "Subscribe"}
                  </button>
                </div>
              ) : (
                <button
                  className="submitButton"
                  disabled={processing}
                  onClick={previewOperation}
                >
                  Preview Only
                </button>
              )}

              <p className="warning">
                Step 6B: create tree_operation_request, then update selected tree only.
                No wallet deduction, inventory deduction, subscription table,
                billing, auto-renew job, cron job, or background job.
              </p>
            </section>
          </section>

          <section className="history panel">
            <PanelHead
              title="Recent Operation Requests"
              text="Read-only records from tree_operation_requests."
            />

            {requests.length === 0 ? (
              <div className="empty small">No operation requests yet.</div>
            ) : (
              <div className="requestList">
                {requests.map((request) => {
                  const tree = trees.find((item) => item.id === request.tree_id);

                  return (
                    <div className="requestRow" key={request.id}>
                      <div>
                        <strong>
                          {request.care_program_name ||
                            request.operation_type ||
                            "Tree Operation"}
                        </strong>
                        <p>
                          {tree?.tree_code || request.tree_id || "Unknown tree"} •{" "}
                          {formatDate(request.created_at)}
                        </p>
                        {request.notes && <small>{request.notes}</small>}
                      </div>

                      <div className="requestRight">
                        <span
                          className={`status ${statusClass(
                            request.care_program_status || request.status
                          )}`}
                        >
                          {request.care_program_status || request.status || "PENDING"}
                        </span>
                        <b>
                          {peso(
                            Number(
                              request.care_program_price ||
                                request.total_amount ||
                                request.operation_fee ||
                                0
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
          max-width: 880px;
          line-height: 1.6;
        }

        .walletCard {
          min-width: 260px;
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
          display: block;
          margin-top: 6px;
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
          margin-top: 14px;
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

        .grid {
          display: grid;
          grid-template-columns: .9fr 1.1fr .95fr;
          gap: 16px;
          align-items: start;
        }

        .panel {
          padding: 22px;
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

        .treeList,
        .serviceList {
          display: grid;
          gap: 12px;
          margin-top: 18px;
          max-height: 590px;
          overflow: auto;
          padding-right: 4px;
        }

        .treeCard,
        .serviceCard {
          border: 1px solid rgba(92,70,35,.08);
          border-radius: 20px;
          padding: 16px;
          background: #f3ead8;
          text-align: left;
          cursor: pointer;
        }

        .treeCard.active,
        .serviceCard.active {
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
        }

        .serviceCard.program {
          border-color: rgba(214,178,94,.38);
          background:
            radial-gradient(circle at 92% 8%, rgba(255, 222, 139, .34), transparent 32%),
            #f3ead8;
        }

        .serviceCard.program.active {
          background:
            radial-gradient(circle at 90% 12%, rgba(214,178,94,.28), transparent 34%),
            linear-gradient(135deg, #244536, #10281f);
        }

        .treeCard strong,
        .serviceCard strong {
          display: block;
          font-size: 16px;
        }

        .treeCard p,
        .serviceCard p {
          margin: 7px 0 0;
          color: inherit;
          opacity: .75;
          line-height: 1.45;
          font-size: 13px;
          font-weight: 800;
        }

        .treeCard small {
          display: block;
          margin-top: 8px;
          color: inherit;
          opacity: .65;
          font-weight: 800;
        }

        .serviceCard span {
          display: inline-flex;
          margin-bottom: 10px;
          border-radius: 999px;
          padding: 7px 10px;
          background: rgba(214,178,94,.20);
          color: #8c6a3c;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .1em;
        }

        .serviceCard.active span {
          background: rgba(255,255,255,.13);
          color: #d9b45f;
        }

        .serviceCard b {
          display: block;
          margin-top: 12px;
          color: #244536;
          font-size: 18px;
        }

        .serviceCard.active b {
          color: #d9b45f;
        }

        .selectedBox,
        .operationBox,
        .feeBox,
        .inventoryCheck,
        .careSyncBox,
        .currentProgramBox {
          border-radius: 22px;
          background: #f3ead8;
          border: 1px solid rgba(92,70,35,.08);
          padding: 16px;
          margin-top: 18px;
        }

        .currentProgramBox,
        .careSyncBox {
          background:
            radial-gradient(circle at 92% 8%, rgba(255,255,255,.54), transparent 28%),
            rgba(49,85,61,.08);
        }

        .selectedBox span,
        .operationBox span {
          display: block;
          color: #6b6b62;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .selectedBox strong,
        .operationBox h3,
        .currentProgramBox strong,
        .careSyncBox strong {
          display: block;
          margin: 8px 0 0;
          color: #101a14;
          font-size: 20px;
        }

        .selectedBox p,
        .operationBox p,
        .inventoryCheck p,
        .careSyncBox p {
          margin: 8px 0 0;
          color: #6b6b62;
          line-height: 1.5;
          font-weight: 800;
        }

        .programMiniGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-top: 14px;
        }

        .mini {
          border-radius: 16px;
          padding: 12px;
          background: rgba(255,253,246,.82);
        }

        .mini span {
          display: block;
          color: #6b6b62;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .mini b {
          display: block;
          margin-top: 6px;
          color: #244536;
          font-size: 13px;
          line-height: 1.35;
          word-break: break-word;
        }

        .inventoryCheck.ok {
          background: rgba(49,85,61,.10);
          color: #31553d;
        }

        .inventoryCheck.bad {
          background: rgba(163,60,42,.10);
          color: #a33c2a;
        }

        .inventoryCheck strong {
          display: block;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .buyMissing {
          display: inline-flex;
          margin-top: 12px;
          border-radius: 999px;
          padding: 10px 14px;
          background: #244536;
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .feeRow {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid rgba(92,70,35,.10);
          color: #6b6b62;
          font-weight: 900;
        }

        .feeRow:last-child {
          border-bottom: 0;
        }

        .feeRow.strong {
          color: #101a14;
          font-size: 18px;
        }

        label {
          display: grid;
          gap: 8px;
          margin-top: 18px;
          color: #6b6b62;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        textarea {
          width: 100%;
          min-height: 120px;
          border: 1px solid rgba(92,70,35,.14);
          border-radius: 16px;
          padding: 14px;
          background: rgba(255,253,246,.94);
          color: #101a14;
          outline: none;
          font-weight: 800;
          resize: vertical;
        }

        .actionGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-top: 16px;
        }

        .submitButton {
          width: 100%;
          margin-top: 16px;
          border: 0;
          border-radius: 16px;
          padding: 15px;
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .actionGrid .submitButton {
          margin-top: 0;
        }

        .submitButton.secondary {
          background: #d9b45f;
          color: #10281f;
        }

        .submitButton:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .warning {
          margin: 12px 0 0;
          color: #8c6a3c;
          font-weight: 900;
          line-height: 1.5;
        }

        .history {
          margin-top: 18px;
        }

        .requestList {
          display: grid;
          gap: 12px;
          margin-top: 18px;
        }

        .requestRow {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 16px;
          align-items: center;
          border-radius: 18px;
          background: #f3ead8;
          padding: 16px;
          border: 1px solid rgba(92,70,35,.08);
        }

        .requestRow strong {
          color: #101a14;
          font-size: 16px;
        }

        .requestRow p {
          margin: 6px 0 0;
          color: #6b6b62;
          font-size: 13px;
          font-weight: 800;
        }

        .requestRow small {
          display: block;
          margin-top: 6px;
          color: #8c6a3c;
          font-weight: 900;
          white-space: pre-line;
        }

        .requestRight {
          display: grid;
          justify-items: end;
          gap: 8px;
        }

        .requestRight b {
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
        .status.completed,
        .status.active {
          background: rgba(49,85,61,.12);
          color: #31553d;
        }

        .status.rejected,
        .status.failed,
        .status.expired {
          background: rgba(163,60,42,.12);
          color: #a33c2a;
        }

        @media (max-width: 1220px) {
          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .grid {
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
          .requestRow,
          .programMiniGrid,
          .actionGrid {
            grid-template-columns: 1fr;
          }

          .requestRight {
            justify-items: start;
          }
        }
      `}</style>
    </main>
  );
}


function getRequiredInventoryCategory(operation: OperationItem | undefined) {
  return operation && operation.category === "Inventory Use"
    ? String(operation.requiredInventoryCategory || "")
    : "";
}

function getRequiredInventoryQty(operation: OperationItem | undefined) {
  return operation && operation.category === "Inventory Use"
    ? Number(operation.requiredQty || 1)
    : 1;
}

function getProgramDuration(program: MarketplaceProduct) {
  const name = String(program.name || "").toLowerCase();
  const unit = String(program.unit || "").toLowerCase();

  if (name.includes("1 week") || unit.includes("week")) return "1 Week";
  if (name.includes("premium")) return "Monthly";
  if (name.includes("standard")) return "Monthly";

  return program.unit || "Program";
}

function getProgramCoverage(program: MarketplaceProduct) {
  const name = String(program.name || "").toLowerCase();

  if (name.includes("premium")) {
    return "Premium monthly care coverage with advanced pest control, tree health booster, plantation monitoring, and priority support.";
  }

  if (name.includes("standard")) {
    return "Standard monthly care coverage with fertilizer, nutrients, fungicide protection, pest control, monitoring, and health assessment.";
  }

  return "Weekly care coverage with organic fertilizer, tree nutrients, basic tree health check, and growth monitoring.";
}

function getNextRenewalDate(duration: string) {
  const nextDate = new Date();
  const normalized = String(duration || "").toLowerCase();

  if (normalized.includes("week")) {
    nextDate.setDate(nextDate.getDate() + 7);
  } else {
    nextDate.setMonth(nextDate.getMonth() + 1);
  }

  return nextDate.toISOString();
}

function PanelHead({ title, text }: { title: string; text: string }) {
  return (
    <div className="panelHead">
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <p>{label}</p>
      <h3>{value}</h3>
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

function FeeRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className={`feeRow ${strong ? "strong" : ""}`}>
      <span>{label}</span>
      <b>{peso(value)}</b>
    </div>
  );
}

function peso(value: number) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusClass(value: string | null | undefined) {
  return (value || "pending").toLowerCase().replaceAll(" ", "_");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}