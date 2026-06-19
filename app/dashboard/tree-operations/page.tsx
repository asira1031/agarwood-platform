"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TreeRow = Record<string, any>;

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
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
};

type OperationItem = {
  name: string;
  category: "Service" | "Inventory Use" | "Subscription";
  price: number;
  description: string;
  requiredInventoryCategory?: string;
  requiredQty?: number;
};

const OPERATIONS: OperationItem[] = [
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
    name: "Managed Care Subscription",
    category: "Subscription",
    price: 1500,
    description: "Enroll selected tree in managed care service coverage.",
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
    name: "Apply Insecticide",
    category: "Inventory Use",
    price: 45,
    description: "Request insecticide application when field team confirms need.",
    requiredInventoryCategory: "Insecticide",
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
];

export default function TreeOperationsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [requests, setRequests] = useState<OperationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [selectedOperation, setSelectedOperation] = useState("Photo Update");
  const [subscriptionDuration, setSubscriptionDuration] = useState<"1 Week" | "1 Month">("1 Week");
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
      .select("id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, full_name, email")
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
        "id, profile_id, tree_id, operation_type, operation_fee, platform_fee, total_amount, notes, status, created_at"
      )
      .eq("profile_id", currentProfile.id)
      .order("created_at", { ascending: false });

    const ownedTrees = treeData || [];

    setWallet((walletRows?.[0] as Wallet) || null);
    setTrees(ownedTrees);
    setInventory(inventoryError ? [] : ((inventoryData as InventoryItem[]) || []));
    setRequests((requestData as OperationRequest[]) || []);
    setSelectedTreeId((current) => current || ownedTrees[0]?.id || "");
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedTree = useMemo(() => {
    return trees.find((tree) => tree.id === selectedTreeId) || null;
  }, [trees, selectedTreeId]);

  const operation = useMemo(() => {
    return OPERATIONS.find((item) => item.name === selectedOperation) || OPERATIONS[0];
  }, [selectedOperation]);

  const requiredInventoryItem = useMemo(() => {
    if (!operation.requiredInventoryCategory) return null;

    return (
      inventory.find((item) => {
        const category = String(item.category || "").toLowerCase();
        const name = String(item.item_name || "").toLowerCase();
        const required = String(operation.requiredInventoryCategory || "").toLowerCase();

        return (
          Number(item.remaining_qty || 0) > 0 &&
          (category.includes(required) || name.includes(required))
        );
      }) || null
    );
  }, [inventory, operation]);

  const walletBalance = Number(wallet?.balance || 0);
  const baseOperationFee =
    operation.category === "Subscription" && subscriptionDuration === "1 Week"
      ? 500
      : operation.price;
  const platformFee = baseOperationFee * 0.02;
  const totalPay = baseOperationFee + platformFee;
  const canPay = walletBalance >= totalPay;

  const hasRequiredInventory =
    operation.category !== "Inventory Use" ||
    (requiredInventoryItem &&
      Number(requiredInventoryItem.remaining_qty || 0) >= Number(operation.requiredQty || 1));

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

  async function submitRequest() {
    setMessage("");

    if (!profile) return setMessage("Profile not found.");
    if (!wallet) return setMessage("Wallet not found.");
    if (!selectedTree) return setMessage("Please select a tree.");
    if (!canPay) return setMessage("Insufficient wallet balance for this operation request.");

    if (operation.category === "Inventory Use" && !hasRequiredInventory) {
      return setMessage(
        `No ${operation.requiredInventoryCategory} in inventory. Please buy from Marketplace first.`
      );
    }

    setProcessing(true);

    const newBalance = walletBalance - totalPay;
    const requiredQty = Number(operation.requiredQty || 1);

    const { error: walletError } = await supabase
      .from("wallets")
      .update({ balance: newBalance })
      .eq("id", wallet.id);

    if (walletError) {
      setMessage(walletError.message);
      setProcessing(false);
      return;
    }

    let deductedInventoryId: string | null = null;
    let deductedInventoryName: string | null = null;
    let deductedInventoryUnit: string | null = null;

    if (operation.category === "Inventory Use" && requiredInventoryItem) {
      const currentRemaining = Number(requiredInventoryItem.remaining_qty || 0);
      const nextRemaining = currentRemaining - requiredQty;

      const { error: inventoryDeductError } = await supabase
        .from("inventory")
        .update({
          remaining_qty: nextRemaining,
          status: nextRemaining <= Number(requiredInventoryItem.low_stock_level || 0) ? "LOW_STOCK" : "AVAILABLE",
        })
        .eq("id", requiredInventoryItem.id);

      if (inventoryDeductError) {
        await supabase.from("wallets").update({ balance: walletBalance }).eq("id", wallet.id);
        setMessage(inventoryDeductError.message);
        setProcessing(false);
        return;
      }

      deductedInventoryId = requiredInventoryItem.id;
      deductedInventoryName = requiredInventoryItem.item_name;
      deductedInventoryUnit = requiredInventoryItem.unit;
    }

    const requestNotes = [
      note.trim() || null,
      operation.category === "Subscription" ? `Subscription Duration: ${subscriptionDuration}` : null,
      deductedInventoryName ? `Inventory deducted: ${requiredQty} ${deductedInventoryUnit || ""} ${deductedInventoryName}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const { data: requestData, error: requestError } = await supabase
      .from("tree_operation_requests")
      .insert({
        profile_id: profile.id,
        tree_id: selectedTree.id,
        operation_type: operation.name,
        operation_fee: baseOperationFee,
        platform_fee: platformFee,
        total_amount: totalPay,
        notes: requestNotes || null,
        status: "PENDING",
      })
      .select("id")
      .single();

    if (requestError) {
      await supabase.from("wallets").update({ balance: walletBalance }).eq("id", wallet.id);

      if (deductedInventoryId && requiredInventoryItem) {
        await supabase
          .from("inventory")
          .update({
            remaining_qty: Number(requiredInventoryItem.remaining_qty || 0),
            status: requiredInventoryItem.status || "AVAILABLE",
          })
          .eq("id", deductedInventoryId);
      }

      setMessage(requestError.message);
      setProcessing(false);
      return;
    }

    if (deductedInventoryId && deductedInventoryName) {
      await supabase.from("inventory_usage_logs").insert({
        profile_id: profile.id,
        tree_id: selectedTree.id,
        inventory_id: deductedInventoryId,
        item_name: deductedInventoryName,
        qty_used: requiredQty,
        unit: deductedInventoryUnit || null,
        used_by: "Customer Operation Request",
      });
    }

    const { error: txError } = await supabase.from("wallet_transactions").insert({
      profile_id: profile.id,
      transaction_type: "TREE_OPERATION",
      amount: totalPay,
      status: "COMPLETED",
      reference_no: requestData?.id || null,
      description: `${operation.name} request for ${
        selectedTree.tree_code || selectedTree.id
      }`,
    });

    if (txError) {
      setMessage(txError.message);
      setProcessing(false);
      await loadData();
      return;
    }

    setNote("");
    setMessage(
      operation.category === "Inventory Use"
        ? "Tree operation request submitted. Inventory stock was deducted and request is waiting for admin or gardener processing."
        : "Tree operation request submitted. Waiting for admin or operations processing."
    );
    setProcessing(false);
    await loadData();
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Tree Operations</p>
          <h1>Request Tree Care Services</h1>
          <span>
            Select one of your owned trees, choose a service, review the fee,
            and submit a real operation request for admin or gardener processing.
          </span>
        </div>

        <div className="walletCard">
          <p>Wallet Balance</p>
          <strong>{peso(walletBalance)}</strong>
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
            <Stat label="Operation Spend" value={peso(stats.totalSpent)} />
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
                      <p>{tree.custom_name || tree.name || "Agarwood Tree"}</p>
                      <small>
                        {tree.stage || tree.growth_stage || "Stage Pending"} •{" "}
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
                text="Inventory-use services require stock from Marketplace purchases."
              />

              <div className="serviceList">
                {OPERATIONS.map((item) => (
                  <button
                    key={item.name}
                    className={`serviceCard ${
                      selectedOperation === item.name ? "active" : ""
                    }`}
                    onClick={() => setSelectedOperation(item.name)}
                  >
                    <span>{item.category}</span>
                    <strong>{item.name}</strong>
                    <p>{item.description}</p>
                    <b>
                      {item.category === "Subscription"
                        ? "₱ 500.00 / week or ₱ 1,500.00 / month"
                        : peso(item.price)}
                    </b>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel">
              <PanelHead
                title="3. Fee & Inventory Review"
                text="Wallet is charged when request is submitted."
              />

              {selectedTree && (
                <div className="selectedBox">
                  <span>Selected Tree</span>
                  <strong>{selectedTree.tree_code || selectedTree.id}</strong>
                  <p>{selectedTree.custom_name || selectedTree.name || "Agarwood Tree"}</p>
                </div>
              )}

              <div className="operationBox">
                <span>{operation.category}</span>
                <h3>{operation.name}</h3>
                <p>{operation.description}</p>
              </div>

              {operation.category === "Subscription" && (
                <div className="durationBox">
                  <button
                    className={subscriptionDuration === "1 Week" ? "active" : ""}
                    onClick={() => setSubscriptionDuration("1 Week")}
                  >
                    1 Week
                  </button>
                  <button
                    className={subscriptionDuration === "1 Month" ? "active" : ""}
                    onClick={() => setSubscriptionDuration("1 Month")}
                  >
                    1 Month
                  </button>
                </div>
              )}

              {operation.category === "Inventory Use" && (
                <div className={`inventoryCheck ${hasRequiredInventory ? "ok" : "bad"}`}>
                  <strong>Inventory Check</strong>
                  {hasRequiredInventory && requiredInventoryItem ? (
                    <p>
                      Available: {requiredInventoryItem.item_name} —{" "}
                      {Number(requiredInventoryItem.remaining_qty || 0)}{" "}
                      {requiredInventoryItem.unit || ""}
                    </p>
                  ) : (
                    <p>
                      No {operation.requiredInventoryCategory} in inventory.
                      Please buy from Marketplace first.
                    </p>
                  )}
                </div>
              )}

              <div className="feeBox">
                <FeeRow label="Operation Fee" value={baseOperationFee} />
                <FeeRow label="Platform Fee 2%" value={platformFee} />
                <FeeRow label="Total Pay" value={totalPay} strong />
                <FeeRow label="Wallet Balance" value={walletBalance} />
              </div>

              <label>
                Request Note
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Example: Please upload a photo after watering service."
                />
              </label>

              <button
                className="submitButton"
                disabled={!canPay || processing || !hasRequiredInventory}
                onClick={submitRequest}
              >
                {processing
                  ? "Submitting..."
                  : !hasRequiredInventory
                  ? "Required Inventory Missing"
                  : canPay
                  ? "Submit Operation Request"
                  : "Insufficient Wallet Balance"}
              </button>

              {!canPay && (
                <p className="warning">
                  Please cash in first before requesting this operation.
                </p>
              )}
            </section>
          </section>

          <section className="history panel">
            <PanelHead
              title="Recent Operation Requests"
              text="Real records from tree_operation_requests."
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
                        <strong>{request.operation_type || "Tree Operation"}</strong>
                        <p>
                          {tree?.tree_code || request.tree_id || "Unknown tree"} •{" "}
                          {formatDate(request.created_at)}
                        </p>
                        {request.notes && <small>{request.notes}</small>}
                      </div>

                      <div className="requestRight">
                        <span className={`status ${statusClass(request.status)}`}>
                          {request.status || "PENDING"}
                        </span>
                        <b>{peso(Number(request.total_amount || 0))}</b>
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
          max-width: 850px;
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
          grid-template-columns: .9fr 1.1fr .9fr;
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
          max-height: 560px;
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
        .durationBox {
          border-radius: 22px;
          background: #f3ead8;
          border: 1px solid rgba(92,70,35,.08);
          padding: 16px;
          margin-top: 18px;
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
        .operationBox h3 {
          display: block;
          margin: 8px 0 0;
          color: #101a14;
          font-size: 22px;
        }

        .selectedBox p,
        .operationBox p,
        .inventoryCheck p {
          margin: 8px 0 0;
          color: #6b6b62;
          line-height: 1.5;
          font-weight: 800;
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

        .durationBox {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .durationBox button {
          border: 1px solid rgba(92,70,35,.12);
          border-radius: 16px;
          padding: 12px;
          background: rgba(255,253,246,.8);
          color: #244536;
          font-weight: 900;
          cursor: pointer;
        }

        .durationBox button.active {
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
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
          min-height: 130px;
          border: 1px solid rgba(92,70,35,.14);
          border-radius: 16px;
          padding: 14px;
          background: rgba(255,253,246,.94);
          color: #101a14;
          outline: none;
          font-weight: 800;
          resize: vertical;
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
        .status.completed {
          background: rgba(49,85,61,.12);
          color: #31553d;
        }

        .status.rejected,
        .status.failed {
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

          .stats {
            grid-template-columns: 1fr;
          }

          .requestRow {
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