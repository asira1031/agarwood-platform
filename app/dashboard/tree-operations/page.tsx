"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  getMissionInventoryItems,
  getMissionKeyFromText,
  missionNeedsInventory,
} from "@/lib/tree-mission-engine";

type CareScope = "FOREST" | "TREE";

type Profile = {
  id: string;
  full_name: string | null;
  display_name?: string | null;
  email: string | null;
  membership_status: string | null;
};

type Wallet = {
  id: string;
  profile_id: string;
  balance: number | null;
};

type ForestSummary = {
  group_id: string;
  customer_profile_id: string | null;
  forest_name: string | null;
  total_trees: number | null;
  protected_count: number | null;
  attention_count: number | null;
  critical_count: number | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type TreeDetail = {
  tree_id: string;
  customer_profile_id: string | null;
  group_id: string | null;
  forest_name: string | null;
  customer_tree_name: string | null;
  custom_name: string | null;
  display_name: string | null;
  tree_code: string | null;
  tree_qr_url: string | null;
  purchase_price: number | null;
  care_status: string | null;
  care_started_at: string | null;
  care_expires_at: string | null;
  alert_status: string | null;
  alert_reason: string | null;
  valuation_status: string | null;
  official_valuation_amount: number | null;
  latest_photo_at: string | null;
  latest_gps_at: string | null;
  latest_health_at: string | null;
  latest_health_status: string | null;
  latest_issue_summary: string | null;
  created_at: string | null;
  updated_at: string | null;
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
  profile_id?: string | null;
  customer_profile_id?: string | null;
  tree_id: string | null;
  group_id?: string | null;
  operation_type: string | null;
  service_name?: string | null;
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

type CareProgramSubscription = {
  id: string;
  profile_id: string;
  tree_id: string | null;
  care_program_name: string | null;
  care_program_price: number | null;
  care_program_duration: string | null;
  status: string | null;
  auto_renew_enabled: boolean | null;
  started_at: string | null;
  next_renewal_date: string | null;
  created_at: string | null;
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

type MissionGroup = "Verification" | "Maintenance" | "Inspection" | "Protection Plan";
type EvidenceMode =
  | "GPS_ONLY"
  | "PHOTO_CURRENT_ONLY"
  | "PHOTO_BEFORE_AFTER"
  | "HEALTH_ONLY";

type MissionInfo = {
  missionKey:
    | "GPS_VERIFICATION"
    | "PHOTO_UPDATE"
    | "WATERING"
    | "FERTILIZER"
    | "HEALTH_CHECK"
    | "QR_TAGGING"
    | "CARE_PROGRAM";
  label: string;
  group: MissionGroup;
  evidenceMode: EvidenceMode;
  evidenceLabel: string;
  gardenerRequirement: string;
};

type OperationItem = {
  name: string;
  category: "Service" | "Inventory Use" | "Care Program";
  price: number;
  description: string;
  icon: string;
  missionGroup?: MissionGroup;
  evidenceMode?: EvidenceMode;
  evidenceLabel?: string;
  gardenerRequirement?: string;
  requiredInventoryCategory?: string;
  requiredQty?: number;
  duration?: string;
  coverage?: string;
  status?: string;
  sourceProduct?: MarketplaceProduct;
};

const BASE_OPERATIONS: OperationItem[] = [
  {
    name: "GPS Verification",
    category: "Service",
    price: 80,
    icon: "GPS_VERIFICATION",
    missionGroup: "Verification",
    evidenceMode: "GPS_ONLY",
    evidenceLabel: "GPS only",
    gardenerRequirement: "Gardener must submit GPS location only.",
    description:
      "Verify the exact plantation location and QR/tree identity from the field.",
  },
  {
    name: "Photo Update",
    category: "Service",
    price: 100,
    icon: "PHOTO_UPDATE",
    missionGroup: "Verification",
    evidenceMode: "PHOTO_CURRENT_ONLY",
    evidenceLabel: "Current photo only",
    gardenerRequirement: "Gardener must submit one current proof photo only.",
    description:
      "Request a current caretaker photo update for the selected seedling or forest.",
  },
  {
    name: "Watering",
    category: "Service",
    price: 150,
    icon: "WATERING",
    missionGroup: "Maintenance",
    evidenceMode: "PHOTO_BEFORE_AFTER",
    evidenceLabel: "Before & after photos",
    gardenerRequirement: "Gardener must submit before and after photos only.",
    description: "Request watering support from the plantation operation team.",
  },
  {
    name: "Fertilizer",
    category: "Inventory Use",
    price: 45,
    icon: "FERTILIZER",
    missionGroup: "Maintenance",
    evidenceMode: "PHOTO_BEFORE_AFTER",
    evidenceLabel: "Before & after photos",
    gardenerRequirement: "Gardener must submit before and after photos only.",
    description:
      "Request fertilizer application using your available inventory.",
    requiredInventoryCategory: "Fertilizer",
    requiredQty: 1,
  },
  {
    name: "Health Check",
    category: "Service",
    price: 120,
    icon: "HEALTH_CHECK",
    missionGroup: "Inspection",
    evidenceMode: "HEALTH_ONLY",
    evidenceLabel: "Health status only",
    gardenerRequirement: "Gardener must submit health status only.",
    description:
      "Request a field health inspection and status report for the selected target.",
  },
];

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

function normalize(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase();
}

function statusClass(value: string | null | undefined) {
  return String(value || "pending")
    .toLowerCase()
    .replaceAll(" ", "_");
}

function getForestName(forest: ForestSummary | null | undefined) {
  return forest?.forest_name || "Unnamed Forest";
}

function getTreeName(tree: TreeDetail | null | undefined) {
  return (
    tree?.custom_name ||
    tree?.customer_tree_name ||
    tree?.display_name ||
    "Seedling"
  );
}

function alertClass(value: string | null | undefined) {
  const status = normalize(value);

  if (status === "PROTECTED") return "protected";
  if (status === "CRITICAL") return "critical";

  return "attention";
}

function alertLabel(value: string | null | undefined) {
  const status = normalize(value);

  if (status === "PROTECTED") return "Healthy";
  if (status === "CRITICAL") return "Needs Attention";
  if (status === "SUBMITTED") return "Pending Evidence";

  return "Monitoring";
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
    return "Premium monthly protection with advanced pest control, health booster, plantation monitoring, and priority support.";
  }

  if (name.includes("standard")) {
    return "Standard monthly protection with fertilizer, nutrients, fungicide protection, pest control, monitoring, and health assessment.";
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

function getOperationIcon(item: OperationItem) {
  return <OperationIcon type={item.name || item.icon || item.category} />;
}

function getMissionInfo(item: OperationItem | undefined): MissionInfo {
  const rawName = String(item?.name || "").toLowerCase();

  if (item?.category === "Care Program") {
    return {
      missionKey: "CARE_PROGRAM",
      label: item.name || "Care Program",
      group: "Protection Plan",
      evidenceMode: "PHOTO_BEFORE_AFTER",
      evidenceLabel: "Before & after photos",
      gardenerRequirement:
        "Automatic Mission Workflow: Customer → Admin → Gardener → Customer.",
    };
  }

  if (rawName.includes("gps")) {
    return {
      missionKey: "GPS_VERIFICATION",
      label: "GPS Verification",
      group: "Verification",
      evidenceMode: "GPS_ONLY",
      evidenceLabel: "GPS only",
      gardenerRequirement: "Gardener must submit GPS location only.",
    };
  }

  if (rawName.includes("photo")) {
    return {
      missionKey: "PHOTO_UPDATE",
      label: "Photo Update",
      group: "Verification",
      evidenceMode: "PHOTO_CURRENT_ONLY",
      evidenceLabel: "Current photo only",
      gardenerRequirement: "Gardener must submit one current proof photo only.",
    };
  }

  if (rawName.includes("water")) {
    return {
      missionKey: "WATERING",
      label: "Watering",
      group: "Maintenance",
      evidenceMode: "PHOTO_BEFORE_AFTER",
      evidenceLabel: "Before & after photos",
      gardenerRequirement: "Gardener must submit before and after photos only.",
    };
  }

  if (rawName.includes("fertil")) {
    return {
      missionKey: "FERTILIZER",
      label: "Fertilizer",
      group: "Maintenance",
      evidenceMode: "PHOTO_BEFORE_AFTER",
      evidenceLabel: "Before & after photos",
      gardenerRequirement: "Gardener must submit before and after photos only.",
    };
  }

  if (rawName.includes("health") || rawName.includes("inspection")) {
    return {
      missionKey: "HEALTH_CHECK",
      label: "Health Check",
      group: "Inspection",
      evidenceMode: "HEALTH_ONLY",
      evidenceLabel: "Health status only",
      gardenerRequirement: "Gardener must submit health status only.",
    };
  }

  if (rawName.includes("qr")) {
    return {
      missionKey: "QR_TAGGING",
      label: "QR Tag Installation",
      group: "Verification",
      evidenceMode: "PHOTO_CURRENT_ONLY",
      evidenceLabel: "QR install proof photo",
      gardenerRequirement: "Gardener must submit QR install proof photo only.",
    };
  }

  return {
    missionKey: "CARE_PROGRAM",
    label: item?.name || "Care Mission",
    group: item?.missionGroup || "Maintenance",
    evidenceMode: item?.evidenceMode || "PHOTO_BEFORE_AFTER",
    evidenceLabel: item?.evidenceLabel || "Before & after photos",
    gardenerRequirement:
      item?.gardenerRequirement || "Gardener must submit the required mission proof only.",
  };
}

function requiredInventoryItemUnit(value: string | null | undefined) {
  const text = String(value || "").toLowerCase();

  if (text.includes("fertilizer")) return "Bag";
  if (text.includes("pesticide") || text.includes("fungicide")) return "Bottle";

  return "Unit";
}

function getHistoryBucket(status: string | null | undefined) {
  const value = normalize(status || "PENDING");

  if (["PENDING", "REQUESTED", "PAID", "PROCESSING", "NOT_ASSIGNED", ""].includes(value)) {
    return "Waiting for Admin";
  }

  if (value === "ASSIGNED") return "Assigned to Gardener";
  if (value === "IN_PROGRESS") return "In Progress";
  if (value === "SUBMITTED") return "Submitted for Review";
  if (value === "COMPLETED" || value === "APPROVED") return "Completed";

  return "Waiting for Admin";
}

export default function TreeOperationsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [forests, setForests] = useState<ForestSummary[]>([]);
  const [trees, setTrees] = useState<TreeDetail[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [requests, setRequests] = useState<OperationRequest[]>([]);
  const [carePrograms, setCarePrograms] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [selectedForestId, setSelectedForestId] = useState("");
  const [scope, setScope] = useState<CareScope>("TREE");
  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [selectedOperation, setSelectedOperation] = useState("Photo Update");
  const [note, setNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const [autoRenewProcessing, setAutoRenewProcessing] = useState(false);

  async function resolveProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return null;
    }

    const email = user.email?.trim() || "";
    const normalizedEmail = email.toLowerCase();

    const { data: profileById, error: profileByIdError } = await supabase
      .from("profiles")
      .select("id, full_name, display_name, email, membership_status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileByIdError) throw profileByIdError;

    const { data: profileByEmail, error: profileByEmailError } = await supabase
      .from("profiles")
      .select("id, full_name, display_name, email, membership_status")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (profileByEmailError) throw profileByEmailError;

    return (profileById || profileByEmail) as Profile | null;
  }

  async function loadData(keepForestId?: string, keepTreeId?: string) {
    setLoading(true);
    setMessage("");

    try {
      const currentProfile = await resolveProfile();

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

      const { data: forestRows, error: forestError } = await supabase
        .from("v_customer_forest_view")
        .select("*")
        .eq("customer_profile_id", currentProfile.id)
        .order("created_at", { ascending: true });

      if (forestError) throw forestError;

      const { data: treeRows, error: treeError } = await supabase
        .from("v_customer_tree_detail")
        .select("*")
        .eq("customer_profile_id", currentProfile.id)
        .order("created_at", { ascending: true });

      if (treeError) throw treeError;

      const { data: inventoryRows, error: inventoryError } = await supabase
        .from("inventory")
        .select("*")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false });

      if (inventoryError)
        console.warn("Inventory load error:", inventoryError.message);

      const { data: requestRows, error: requestLoadError } = await supabase
        .from("tree_operation_requests")
        .select(
          "id, profile_id, customer_profile_id, tree_id, group_id, operation_type, service_name, request_type, amount, operation_fee, platform_fee, total_amount, notes, status, created_at, care_program_name, care_program_price, care_program_duration, care_program_status, next_renewal_date, auto_renew_enabled",
        )
        .or(
          `profile_id.eq.${currentProfile.id},customer_profile_id.eq.${currentProfile.id}`,
        )
        .order("created_at", { ascending: false });

      if (requestLoadError) {
        throw new Error(`Recent care activity load failed: ${requestLoadError.message}`);
      }

      const { data: programRows, error: programError } = await supabase
        .from("marketplace_products")
        .select(
          "id, product_key, name, price, note, stock_status, icon, image_url, category, unit, low_stock_level, product_type, status, created_at",
        )
        .eq("category", "Tree Care Programs")
        .eq("status", "ACTIVE")
        .order("price", { ascending: true });

      if (programError)
        console.warn("Care program load error:", programError.message);

      const nextForests = (forestRows || []) as ForestSummary[];
      const nextTrees = (treeRows || []) as TreeDetail[];

      const urlParams =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : null;
      const queryGroupId = urlParams?.get("group_id") || "";
      const queryTreeId = urlParams?.get("tree_id") || "";

      const requestedForestId = keepForestId || queryGroupId;
      const requestedTreeId = keepTreeId || queryTreeId;
      const treeFromQuery = requestedTreeId
        ? nextTrees.find((tree) => tree.tree_id === requestedTreeId)
        : null;
      const treeGroupId = treeFromQuery?.group_id || "";

      const nextForestId =
        requestedForestId &&
        nextForests.some((forest) => forest.group_id === requestedForestId)
          ? requestedForestId
          : treeGroupId &&
              nextForests.some((forest) => forest.group_id === treeGroupId)
            ? treeGroupId
            : nextForests[0]?.group_id || "";

      const forestTrees = nextTrees.filter(
        (tree) => tree.group_id === nextForestId,
      );
      const nextTreeId =
        requestedTreeId &&
        forestTrees.some((tree) => tree.tree_id === requestedTreeId)
          ? requestedTreeId
          : forestTrees[0]?.tree_id || "";

      setWallet((walletRows?.[0] as Wallet) || null);
      setForests(nextForests);
      setTrees(nextTrees);
      setInventory(
        inventoryError ? [] : ((inventoryRows || []) as InventoryItem[]),
      );
      setRequests((requestRows || []) as OperationRequest[]);
      setCarePrograms((programRows || []) as MarketplaceProduct[]);
      setSelectedForestId(nextForestId);
      setSelectedTreeId(nextTreeId);

      if (!nextTreeId && nextForestId) setScope("FOREST");
      setLoading(false);
    } catch (error: any) {
      setMessage(error?.message || "Forest Care failed to load.");
      setLoading(false);
    }
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
        icon: "CARE_PROGRAM",
        missionGroup: "Protection Plan",
        evidenceMode: "PHOTO_BEFORE_AFTER",
        evidenceLabel: "Before & after photos",
        gardenerRequirement:
          "Automatic Mission Workflow: Customer → Admin → Gardener → Customer.",
        description: program.note || "Marketplace Tree Care Program.",
        duration: getProgramDuration(program),
        coverage: getProgramCoverage(program),
        status: program.stock_status || "ACTIVE",
        sourceProduct: program,
      }),
    );
  }, [carePrograms]);

  const operations = useMemo<OperationItem[]>(() => {
    return [...BASE_OPERATIONS, ...careProgramOperations];
  }, [careProgramOperations]);

  const selectedForest = useMemo(() => {
    return (
      forests.find((forest) => forest.group_id === selectedForestId) || null
    );
  }, [forests, selectedForestId]);

  const selectedForestTrees = useMemo(() => {
    return trees.filter((tree) => tree.group_id === selectedForestId);
  }, [trees, selectedForestId]);

  const selectedTree = useMemo(() => {
    return (
      selectedForestTrees.find((tree) => tree.tree_id === selectedTreeId) ||
      null
    );
  }, [selectedForestTrees, selectedTreeId]);

  const operation = useMemo<OperationItem | undefined>(() => {
    return (
      operations.find((item) => item.name === selectedOperation) ||
      operations[0]
    );
  }, [operations, selectedOperation]);

  const selectedMissionInfo = useMemo(() => {
    return getMissionInfo(operation);
  }, [operation]);

  const groupedOperations = useMemo(() => {
    const order: MissionGroup[] = [
      "Verification",
      "Maintenance",
      "Inspection",
      "Protection Plan",
    ];

    return order.map((group) => ({
      group,
      items: operations.filter((item) => getMissionInfo(item).group === group),
    }));
  }, [operations]);

  const missionKey = useMemo(() => {
    return getMissionKeyFromText(operation?.name || "");
  }, [operation]);

  const requiresInventory = missionNeedsInventory(missionKey);
  const missionInventoryItems = getMissionInventoryItems(missionKey);
  const requiredInventoryLabel =
    operation?.requiredInventoryCategory || missionInventoryItems[0] || "Required Supply";
  const requiredInventoryQty = Number(operation?.requiredQty || 1);
  const requiredInventoryUnit = requiredInventoryItemUnit(operation?.requiredInventoryCategory || requiredInventoryLabel);

  const requiredInventoryItem = useMemo(() => {
    if (!requiresInventory) return null;

    const requiredItems = missionInventoryItems.length
      ? missionInventoryItems
      : operation?.requiredInventoryCategory
        ? [operation.requiredInventoryCategory]
        : [];

    if (requiredItems.length === 0) return null;

    return (
      inventory.find((item) => {
        const category = String(item.category || "").toLowerCase();
        const name = String(item.item_name || "").toLowerCase();

        return (
          Number(item.remaining_qty || 0) > 0 &&
          requiredItems.some((requiredItem) => {
            const required = String(requiredItem || "").toLowerCase();
            return category.includes(required) || name.includes(required);
          })
        );
      }) || null
    );
  }, [inventory, missionInventoryItems, operation, requiresInventory]);

  const hasRequiredInventory =
    !requiresInventory ||
    Boolean(
      requiredInventoryItem &&
        Number(requiredInventoryItem.remaining_qty || 0) >= requiredInventoryQty,
    );
  const inventoryRemaining = Number(requiredInventoryItem?.remaining_qty || 0);
  const inventoryRemainingAfterMission = Math.max(inventoryRemaining - requiredInventoryQty, 0);

  const walletBalance = Number(wallet?.balance || 0);
  const membershipActive = normalize(profile?.membership_status) === "ACTIVE";
  const baseOperationFee = Number(operation?.price || 0);
  const platformFeePreview =
    operation?.category === "Care Program" ? 0 : baseOperationFee * 0.02;
  const totalPreview = baseOperationFee + platformFeePreview;
  const targetLabel =
    scope === "FOREST"
      ? getForestName(selectedForest)
      : selectedTree
        ? getTreeName(selectedTree)
        : "Select Seedling";

  const activeSameRequest = useMemo(() => {
    if (!operation || !selectedForest) return null;
    if (scope === "TREE" && !selectedTree) return null;

    const activeStatuses = [
      "PENDING",
      "ASSIGNED",
      "IN_PROGRESS",
      "SUBMITTED",
      "PROCESSING",
    ];
    const operationName = String(operation.name || "")
      .trim()
      .toUpperCase();

    return (
      requests.find((request) => {
        const requestName = String(
          request.service_name ||
            request.care_program_name ||
            request.operation_type ||
            "",
        )
          .trim()
          .toUpperCase();
        const requestStatus = String(request.status || "PENDING").toUpperCase();

        if (!activeStatuses.includes(requestStatus)) return false;
        if (requestName !== operationName) return false;

        if (scope === "FOREST") {
          return (
            String(request.group_id || "") ===
              String(selectedForest.group_id || "") && !request.tree_id
          );
        }

        return (
          String(request.tree_id || "") === String(selectedTree?.tree_id || "")
        );
      }) || null
    );
  }, [requests, selectedForest, selectedTree, operation, scope]);

  const hasActiveSameRequest = !!activeSameRequest;

  const stats = useMemo(() => {
    const pending = requests.filter(
      (item) => normalize(item.status || "PENDING") === "PENDING",
    ).length;
    const completed = requests.filter(
      (item) => normalize(item.status || "") === "COMPLETED",
    ).length;
    const totalSpent = requests
      .filter((item) =>
        ["APPROVED", "COMPLETED", "PENDING", "ASSIGNED"].includes(
          normalize(item.status || ""),
        ),
      )
      .reduce(
        (sum, item) =>
          sum + Number(item.total_amount || item.care_program_price || 0),
        0,
      );

    return {
      forests: forests.length,
      trees: trees.length,
      pending,
      completed,
      totalSpent,
    };
  }, [forests, trees, requests]);

  const missionHistoryGroups = useMemo(() => {
    const labels = [
      "Waiting for Admin",
      "Assigned to Gardener",
      "In Progress",
      "Submitted for Review",
      "Completed",
    ];

    return labels.map((label) => ({
      label,
      items: requests.filter((request) =>
        getHistoryBucket(request.care_program_status || request.status) === label,
      ),
    }));
  }, [requests]);

  function handleSelectForest(forestId: string) {
    const forestTrees = trees.filter((tree) => tree.group_id === forestId);

    setSelectedForestId(forestId);
    setSelectedTreeId(forestTrees[0]?.tree_id || "");

    if (forestTrees.length === 0) setScope("FOREST");
  }

  function handleChooseOperation(item: OperationItem) {
    setSelectedOperation(item.name);
    setMessage("");
  }

  async function hasDuplicateCareRequest(args: {
    operationName: string;
    groupId: string;
    treeId: string | null;
    careProgramName?: string | null;
  }) {
    if (!profile) return false;

    const activeStatuses = [
      "PENDING",
      "ASSIGNED",
      "IN_PROGRESS",
      "SUBMITTED",
      "PROCESSING",
    ];

    const { data, error } = await supabase
      .from("tree_operation_requests")
      .select("id, profile_id, customer_profile_id, tree_id, group_id, operation_type, service_name, care_program_name, status")
      .or(`profile_id.eq.${profile.id},customer_profile_id.eq.${profile.id}`)
      .in("status", activeStatuses);

    if (error) throw new Error(`duplicate request detected: ${error.message}`);

    const exactName = String(args.careProgramName || args.operationName || "")
      .trim()
      .toUpperCase();

    return (data || []).some((request: any) => {
      const requestName = String(
        request.service_name || request.care_program_name || request.operation_type || "",
      )
        .trim()
        .toUpperCase();

      if (requestName !== exactName) return false;
      if (String(request.group_id || "") !== String(args.groupId || "")) return false;

      if (args.treeId) {
        return String(request.tree_id || "") === String(args.treeId || "");
      }

      return !request.tree_id;
    });
  }

  async function ensureNoDuplicateCareRequests(args: {
    operationName: string;
    careProgramName?: string | null;
  }) {
    if (!selectedForest) throw new Error("Please select a forest.");

    if (scope === "FOREST") {
      const duplicate = await hasDuplicateCareRequest({
        operationName: args.operationName,
        groupId: selectedForest.group_id,
        treeId: null,
        careProgramName: args.careProgramName || null,
      });

      if (duplicate) {
        throw new Error(
          "This care request is already active for this forest. Please wait for Admin/Gardener completion.",
        );
      }

      return;
    }

    if (!selectedTree)
      throw new Error("Please select a seedling or choose entire forest.");

    const duplicate = await hasDuplicateCareRequest({
      operationName: args.operationName,
      groupId: selectedForest.group_id,
      treeId: selectedTree.tree_id,
      careProgramName: args.careProgramName || null,
    });

    if (duplicate) {
      throw new Error(
        "This care request is already active for this tree. Please wait for Admin/Gardener completion.",
      );
    }
  }

  async function submitServiceRequest() {
    setMessage("");

    if (!profile) return setMessage("Profile not found.");
    if (!wallet) return setMessage("Wallet not found.");
    if (!selectedForest)
      return setMessage(
        "selectedForest missing: Please select a forest before creating a request.",
      );
    if (scope === "TREE" && !selectedTree)
      return setMessage(
        "selectedTree missing: Please select a seedling or choose entire forest.",
      );
    if (!operation)
      return setMessage("operation missing: Please choose a care service.");

    if (operation.category === "Care Program") {
      setMessage("Use Buy Once or Subscribe for Forest Protection Plans.");
      return;
    }

    if (hasActiveSameRequest) {
      setMessage(
        `hasActiveSameRequest: ${operation.name} already has an active request for this exact tree/service or forest/service target.`,
      );
      return;
    }

    if (requiresInventory && !hasRequiredInventory) {
      setMessage(
        `inventory missing: ${requiredInventoryLabel} is missing or low. Buy supplies from Marketplace first.`,
      );
      return;
    }

    if (walletBalance < totalPreview) {
      setMessage(
        `wallet insufficient: Wallet balance ${peso(walletBalance)} is lower than required total ${peso(totalPreview)}.`,
      );
      return;
    }

    try {
      await ensureNoDuplicateCareRequests({
        operationName: operation.name,
      });
    } catch (error: any) {
      setMessage(
        `duplicate request detected: ${error?.message || "Duplicate care request check failed."}`,
      );
      return;
    }

    setProcessing(true);

    try {
      const { error } = await supabase.rpc("purchase_tree_operation", {
        p_profile_id: profile.id,
        p_tree_id: selectedTree?.tree_id,
        p_service_name: operation.name,
        p_amount: operation.price,
        p_care_program_duration: null,
        p_notes: note,
        p_auto_renew_enabled: false,
      });

      if (error) throw error;

      setNote("");
      await loadData(selectedForestId, selectedTreeId);
      setMessage(
        `${operation.name} requested for ${targetLabel}. Finance and request sync were completed by atomic RPC.`,
      );
    } catch (error: any) {
      setMessage(
        error?.message ||
          "Forest care request failed. No frontend finance write was performed.",
      );
    } finally {
      setProcessing(false);
    }
  }

  async function submitCareProgram(autoRenewEnabled: boolean) {
    setMessage("");

    if (!profile) return setMessage("Profile not found.");
    if (!wallet) return setMessage("Wallet not found.");
    if (!selectedForest)
      return setMessage(
        "selectedForest missing: Please select a forest before creating a request.",
      );
    if (scope === "TREE" && !selectedTree)
      return setMessage(
        "selectedTree missing: Please select a seedling or choose entire forest.",
      );
    if (!operation || operation.category !== "Care Program") {
      return setMessage(
        "operation missing: Please choose a Forest Protection Plan.",
      );
    }

    const programPrice = Number(operation.price || 0);

    if (programPrice <= 0) {
      setMessage("Invalid protection plan amount.");
      return;
    }

    if (walletBalance < programPrice) {
      setMessage(
        `wallet insufficient: Wallet balance ${peso(walletBalance)} is lower than required total ${peso(programPrice)}.`,
      );
      return;
    }

    try {
      await ensureNoDuplicateCareRequests({
        operationName: operation.name,
        careProgramName: operation.name,
      });
    } catch (error: any) {
      setMessage(
        `duplicate request detected: ${error?.message || "Duplicate care request check failed."}`,
      );
      return;
    }

    setProcessing(true);

    try {
      const { error } = await supabase.rpc("purchase_tree_operation", {
        p_profile_id: profile.id,
        p_tree_id: selectedTree?.tree_id,
        p_service_name: operation.name,
        p_amount: operation.price,
        p_care_program_duration: operation.duration,
        p_notes: note,
        p_auto_renew_enabled: autoRenewEnabled,
      });

      if (error) throw error;

      setNote("");
      await loadData(selectedForestId, selectedTreeId);
      setMessage(
        `${operation.name} submitted for ${targetLabel}. Finance, operation request, subscription, treasury, and rollback safety are handled by atomic RPC.`,
      );
    } catch (error: any) {
      setMessage(
        error?.message ||
          "Protection plan failed. No frontend finance write was performed.",
      );
      await loadData(selectedForestId, selectedTreeId);
    } finally {
      setProcessing(false);
    }
  }

  async function runAutoRenewEngine(
    currentProfile: Profile,
    currentWallet: Wallet | null,
  ) {
    if (!currentWallet) {
      setMessage("Wallet not found. Auto-renew was not processed.");
      return;
    }

    const today = new Date().toISOString();

    const { data: dueSubscriptions, error: subscriptionError } = await supabase
      .from("care_program_subscriptions")
      .select(
        "id, profile_id, tree_id, care_program_name, care_program_price, care_program_duration, status, auto_renew_enabled, started_at, next_renewal_date, created_at",
      )
      .eq("profile_id", currentProfile.id)
      .eq("status", "ACTIVE")
      .eq("auto_renew_enabled", true)
      .lte("next_renewal_date", today);

    if (subscriptionError) {
      setMessage(subscriptionError.message);
      return;
    }

    const subscriptions = (dueSubscriptions || []) as CareProgramSubscription[];

    if (subscriptions.length === 0) {
      setMessage("No due auto-renew subscriptions found.");
      return;
    }

    let renewedCount = 0;
    let failedCount = 0;
    const failedNames: string[] = [];

    for (const subscription of subscriptions) {
      const { error } = await supabase.rpc("process_care_program_renewal", {
        p_subscription_id: subscription.id,
      });

      if (error) {
        failedCount += 1;
        failedNames.push(subscription.care_program_name || "Protection Plan");
        console.error("Auto-renew RPC failed:", error.message);
        continue;
      }

      renewedCount += 1;
    }

    await loadData(selectedForestId, selectedTreeId);

    if (renewedCount > 0 && failedCount === 0) {
      setMessage(
        `Auto-renew completed for ${renewedCount} protection subscription(s) via atomic RPC.`,
      );
      return;
    }

    if (renewedCount > 0 && failedCount > 0) {
      setMessage(
        `Auto-renew completed for ${renewedCount} subscription(s). ${failedCount} failed: ${failedNames.join(", ")}.`,
      );
      return;
    }

    setMessage(
      `No subscriptions were renewed. ${failedCount} failed through RPC. Check wallet balance, due dates, or subscription status.`,
    );
  }

  async function handleManualAutoRenew() {
    setMessage("");

    if (!profile) {
      setMessage("Profile not found.");
      return;
    }

    if (!wallet) {
      setMessage("Wallet not found. Auto-renew was not processed.");
      return;
    }

    setAutoRenewProcessing(true);

    try {
      await runAutoRenewEngine(profile, wallet);
    } catch (error: any) {
      setMessage(error?.message || "Auto-renew failed.");
    } finally {
      setAutoRenewProcessing(false);
    }
  }

  function previewOperation() {
    setMessage("");

    if (!selectedForest) return setMessage("Please select a forest.");
    if (scope === "TREE" && !selectedTree)
      return setMessage("Please select a seedling or choose entire forest.");
    if (!operation)
      return setMessage("operation missing: Please choose a care service.");

    if (requiresInventory && !hasRequiredInventory) {
      setMessage(
        `Preview blocked: ${requiredInventoryLabel} is missing or low. Buy supplies from Marketplace first.`,
      );
      return;
    }

    setMessage(
      `${operation.name} preview for ${targetLabel}. Total charge will be ${peso(totalPreview)}.`,
    );
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="heroCopy">
          <Link href="/dashboard" className="back">
            ← Back to Dashboard
          </Link>

          <p className="eyebrow">Arganwood Tree Missions</p>
          <h1>Tree Mission Center</h1>
          <span>
            Choose a tree or forest mission. Subscribed care plans can be handled automatically through Admin and Gardener workflow.
          </span>
        </div>

        <div className="walletCard">
          <p>Wallet Balance</p>
          <strong>{peso(walletBalance)}</strong>
          <small>Tree missions and protection plans</small>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      {loading ? (
        <div className="empty">Loading Tree Missions...</div>
      ) : forests.length === 0 ? (
        <section className="emptyState">
          <div className="emptyIcon"><span /></div>
          <h2>No forest yet</h2>
          <p>
            Buy trees from Marketplace first. Your new forest will appear here
            for care and protection.
          </p>
          <Link href="/dashboard/marketplace">Go to Marketplace</Link>
        </section>
      ) : (
        <>
          <section className="stats">
            <Stat label="Forests" value={String(stats.forests)} />
            <Stat label="Seedlings" value={String(stats.trees)} />
            <Stat label="Pending Care" value={String(stats.pending)} />
            <Stat label="Recorded Spend" value={peso(stats.totalSpent)} />
          </section>

          <section className="careLayout">
            <section className="panel forestPanel">
              <PanelHead
                title="1. Choose Forest"
                text="Start with the forest you want to protect."
              />

              <div className="forestList">
                {forests.map((forest) => {
                  const active = selectedForestId === forest.group_id;

                  return (
                    <button
                      key={forest.group_id}
                      className={active ? "forestCard active" : "forestCard"}
                      onClick={() => handleSelectForest(forest.group_id)}
                    >
                      <div>
                        <small>Forest</small>
                        <b>{getForestName(forest)}</b>
                      </div>
                      <span>{Number(forest.total_trees || 0)} Trees</span>

                      <div className="forestMiniStats">
                        <em className="protected">
                          {Number(forest.protected_count || 0)} Protected
                        </em>
                        <em className="attention">
                          {Number(forest.attention_count || 0)} Attention
                        </em>
                        <em className="critical">
                          {Number(forest.critical_count || 0)} Critical
                        </em>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="panel targetPanel">
              <PanelHead
                title="2. Choose Tree / Forest Scope"
                text="Pick whether this mission covers the whole forest or one seedling."
              />

              {selectedForest && (
                <div className="selectedForestHero">
                  <small>Selected Forest</small>
                  <b>{getForestName(selectedForest)}</b>
                  <p>
                    {Number(selectedForest.total_trees || 0)} trees •{" "}
                    {Number(selectedForest.protected_count || 0)} protected •{" "}
                    {Number(selectedForest.attention_count || 0)} attention •{" "}
                    {Number(selectedForest.critical_count || 0)} critical
                  </p>
                </div>
              )}

              <div className="scopeGrid">
                <button
                  className={scope === "FOREST" ? "active" : ""}
                  onClick={() => setScope("FOREST")}
                >
                  <strong>Entire Forest</strong>
                  <span>
                    Best for protection plans and forest-wide maintenance.
                  </span>
                </button>

                <button
                  className={scope === "TREE" ? "active" : ""}
                  disabled={selectedForestTrees.length === 0}
                  onClick={() => setScope("TREE")}
                >
                  <strong>Single Seedling</strong>
                  <span>
                    Best for photo, GPS, health, or specific care requests.
                  </span>
                </button>
              </div>

              {scope === "TREE" && (
                <div className="seedlingList">
                  {selectedForestTrees.length === 0 ? (
                    <div className="softEmpty">
                      No seedlings found in this forest.
                    </div>
                  ) : (
                    selectedForestTrees.map((tree) => (
                      <button
                        key={tree.tree_id}
                        className={
                          selectedTreeId === tree.tree_id
                            ? "seedlingCard active"
                            : "seedlingCard"
                        }
                        onClick={() => setSelectedTreeId(tree.tree_id)}
                      >
                        <span className={`alertBadge ${alertClass(tree.alert_status)}`}>{alertLabel(tree.alert_status)}</span>
                        <div>
                          <b>{getTreeName(tree)}</b>
                          <small>
                            {tree.alert_reason ||
                              tree.care_status ||
                              "Care status pending"}
                          </small>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </section>

            <section className="panel actionPanel">
              <PanelHead
                title="3. Choose Mission"
                text="Mission cards are grouped by verification, maintenance, inspection, and protection plan."
              />

              <div className="operationPreview">
                <small>Mission Target</small>
                <b>{targetLabel}</b>
                <p>
                  {scope === "FOREST"
                    ? "This mission will include group_id."
                    : "This mission will include group_id and tree_id."}
                </p>
              </div>

              <div className="missionGroups">
                {groupedOperations.map((group) =>
                  group.items.length === 0 ? null : (
                    <div className="missionGroup" key={group.group}>
                      <div className="missionGroupHead">
                        <span>{group.group}</span>
                      </div>

                      <div className="serviceList compact">
                        {group.items.map((item) => {
                          const mission = getMissionInfo(item);

                          return (
                            <button
                              key={`${item.category}-${item.name}`}
                              className={`serviceCard ${selectedOperation === item.name ? "active" : ""} ${
                                item.category === "Care Program" ? "program" : ""
                              }`}
                              onClick={() => handleChooseOperation(item)}
                            >
                              <div className="serviceIcon">
                                {getOperationIcon(item)}
                              </div>
                              <div>
                                <span>{mission.group}</span>
                                <strong>{mission.label}</strong>
                                <p>{item.description}</p>

                                <div className="missionMetaGrid">
                                  <em>Required: {mission.evidenceLabel}</em>
                                  <em>
                                    Target: {scope === "FOREST" ? "Whole forest" : "Single tree"}
                                  </em>
                                </div>

                                <b>
                                  {item.category === "Care Program"
                                    ? `${peso(item.price)} • ${item.duration || "Program"}`
                                    : peso(item.price)}
                                </b>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </section>
          </section>

          <section className="checkout panel">
            {!membershipActive ? (
              <>
                <div className="checkoutHead">
                  <div>
                    <p className="eyebrow">Membership Locked</p>
                    <h2>Annual Membership Required</h2>
                    <span>
                      Tree Operations are available only to active Arganwood members. Activate your annual membership to request maintenance, photo, GPS, and health services for your trees.
                    </span>
                  </div>

                  <div className="checkoutTarget">
                    <small>Status</small>
                    <b>{profile?.membership_status || "INACTIVE"}</b>
                  </div>
                </div>

                <div className="careSyncBox">
                  <strong>Unlock Operational Services</strong>
                  <p>
                    Membership unlocks Tree Operations, forestry maintenance, photo updates, GPS verification, health reports, valuation support, and Sell Tree access.
                  </p>
                </div>

                <Link className="buyMissing" href="/dashboard/membership">
                  Go to Membership
                </Link>
              </>
            ) : (
              <>
                <div className="checkoutHead">
                  <div>
                    <p className="eyebrow">Confirm Mission</p>
                    <h2>{operation?.name || "Forest Care"}</h2>
                    <span>{operation?.description || "Mission preview."}</span>
                  </div>

                  <div className="checkoutTarget">
                    <small>Target</small>
                    <b>{targetLabel}</b>
                  </div>
                </div>

                <div className="missionRequirementBox">
                  <strong>Mission Requirement</strong>
                  <p>{selectedMissionInfo.gardenerRequirement}</p>
                  <div className="miniGrid">
                    <Mini label="Mission" value={selectedMissionInfo.label} />
                    <Mini label="Category" value={selectedMissionInfo.group} />
                    <Mini label="Evidence" value={selectedMissionInfo.evidenceLabel} />
                    <Mini
                      label="Target"
                      value={scope === "FOREST" ? "Entire Forest" : "Single Tree"}
                    />
                  </div>
                </div>

            {hasActiveSameRequest && (
              <div className="inventoryCheck ok">
                <strong>Active Request Found</strong>
                <p>
                  This same care request is already active for {targetLabel}.
                </p>
              </div>
            )}

            <div
              className={`inventoryCheck ${hasRequiredInventory ? "ok" : "bad"}`}
            >
              <strong>Inventory Status</strong>
              {!requiresInventory ? (
                <div className="miniGrid">
                  <Mini label="Inventory" value="None required" />
                  <Mini label="Status" value="Available" />
                  <Mini label="Required" value="0" />
                  <Mini label="Remaining After Mission" value="No inventory use" />
                </div>
              ) : hasRequiredInventory && requiredInventoryItem ? (
                <div className="miniGrid">
                  <Mini label="Status" value="Available" />
                  <Mini label="Supply" value={requiredInventoryItem.item_name || requiredInventoryLabel} />
                  <Mini
                    label="Remaining"
                    value={`${inventoryRemaining} ${requiredInventoryItem.unit || requiredInventoryUnit}`}
                  />
                  <Mini
                    label="Required"
                    value={`${requiredInventoryQty} ${requiredInventoryItem.unit || requiredInventoryUnit}`}
                  />
                  <Mini
                    label="Remaining After Mission"
                    value={`${inventoryRemainingAfterMission} ${requiredInventoryItem.unit || requiredInventoryUnit}`}
                  />
                </div>
              ) : (
                <>
                  <div className="miniGrid">
                    <Mini label="Status" value="Out of Stock" />
                    <Mini label="Required Supply" value={requiredInventoryLabel} />
                    <Mini label="Required" value={`${requiredInventoryQty} ${requiredInventoryUnit}`} />
                    <Mini label="Action" value="Buy from Marketplace" />
                  </div>
                  <p>
                    {operation?.requiredInventoryCategory
                      ? `No ${operation.requiredInventoryCategory} in inventory.`
                      : "Required inventory item is missing."}{" "}
                    Buy from Marketplace first.
                  </p>
                </>
              )}

              {requiresInventory && !hasRequiredInventory && (
                <Link className="buyMissing" href="/dashboard/marketplace">
                  Buy from Marketplace
                </Link>
              )}
            </div>

            {operation?.category === "Care Program" && (
              <div className="careSyncBox">
                <strong>Subscription Plan</strong>
                <div className="miniGrid">
                  <Mini label="Plan" value={operation.name} />
                  <Mini label="Price" value={peso(operation.price)} />
                  <Mini
                    label="Duration"
                    value={operation.duration || "Program"}
                  />
                  <Mini
                    label="Target"
                    value={
                      scope === "FOREST" ? "Entire Forest" : "Single Seedling"
                    }
                  />
                </div>
                <p>
                  Automatic Mission Workflow: Customer → Admin → Gardener → Customer. No mission is completed without real field evidence and Admin approval.
                </p>
              </div>
            )}

            <div className="checkoutGrid">
              <div className="feeBox">
                <FeeRow
                  label={
                    operation?.category === "Care Program"
                      ? "Program Price"
                      : "Care Fee"
                  }
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
                <FeeRow label="Total Charge" value={totalPreview} strong />
                <FeeRow label="Wallet Balance" value={walletBalance} />
              </div>

              <label>
                Request Note
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note for Admin and Gardener."
                />
              </label>
            </div>

            {operation?.category === "Care Program" ? (
              <div className="actionGrid">
                <button
                  className="submitButton secondary"
                  disabled={processing}
                  onClick={() => submitCareProgram(false)}
                >
                  {processing ? "Processing..." : "Buy Once"}
                </button>

                <button
                  className="submitButton"
                  disabled={processing}
                  onClick={() => submitCareProgram(true)}
                >
                  {processing ? "Processing..." : "Subscribe"}
                </button>
              </div>
            ) : (
              <div className="actionGrid">
                <button
                  className="submitButton secondary"
                  disabled={processing}
                  onClick={previewOperation}
                >
                  Preview
                </button>

                <button
                  className="submitButton"
                  disabled={processing || !operation || (requiresInventory && !hasRequiredInventory)}
                  onClick={submitServiceRequest}
                >
                  {processing
                    ? "Processing..."
                    : hasActiveSameRequest
                      ? "Already Requested"
                      : "Submit Mission Request"}
                </button>
              </div>
            )}

            <button
              className="autoRenewButton"
              disabled={processing || autoRenewProcessing}
              onClick={handleManualAutoRenew}
            >
              {autoRenewProcessing
                ? "Running Auto Renew..."
                : "Run Auto Renew Check"}
            </button>
              </>
            )}
          </section>

          <section className="history panel">
            <PanelHead
              title="Mission History"
              text="Grouped read-only records from tree_operation_requests."
            />

            {requests.length === 0 ? (
              <div className="softEmpty">
                No mission record yet. Request a care mission or subscribe to a protection plan.
              </div>
            ) : (
              <div className="historyGroups">
                {missionHistoryGroups.map((group) => (
                  <div className="historyGroup" key={group.label}>
                    <div className="historyGroupHead">
                      <strong>{group.label}</strong>
                      <span>{group.items.length}</span>
                    </div>

                    {group.items.length === 0 ? (
                      <div className="softEmpty small">No mission in this stage.</div>
                    ) : (
                      <div className="requestList">
                        {group.items.map((request) => {
                          const requestTree = trees.find(
                            (item) => item.tree_id === request.tree_id,
                          );
                          const requestForest = forests.find(
                            (item) => item.group_id === request.group_id,
                          );
                          const target =
                            request.tree_id && requestTree
                              ? getTreeName(requestTree)
                              : requestForest
                                ? getForestName(requestForest)
                                : request.tree_id || request.group_id || "Tree Mission";
                          const mission = getMissionInfo({
                            name:
                              request.service_name ||
                              request.care_program_name ||
                              request.operation_type ||
                              "Care Mission",
                            category: request.care_program_name
                              ? "Care Program"
                              : "Service",
                            price: Number(
                              request.care_program_price ||
                                request.total_amount ||
                                request.operation_fee ||
                                0,
                            ),
                            description: "",
                            icon: "",
                          });

                          return (
                            <div className="requestRow" key={request.id}>
                              <div>
                                <strong>{mission.label}</strong>
                                <p>
                                  {target} • {mission.evidenceLabel} • {formatDate(request.created_at)}
                                </p>
                                {request.notes && <small>{request.notes}</small>}
                              </div>

                              <div className="requestRight">
                                <span
                                  className={`status ${statusClass(request.care_program_status || request.status)}`}
                                >
                                  {request.care_program_status ||
                                    request.status ||
                                    "PENDING"}
                                </span>
                                <b>
                                  {peso(
                                    Number(
                                      request.care_program_price ||
                                        request.total_amount ||
                                        request.operation_fee ||
                                        0,
                                    ),
                                  )}
                                </b>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          padding: 30px;
          color: #fff7df;
          font-family: Arial, Helvetica, sans-serif;
          background:
            radial-gradient(circle at 16% 6%, rgba(220, 176, 88, .24), transparent 28%),
            radial-gradient(circle at 88% 0%, rgba(85, 132, 93, .22), transparent 30%),
            linear-gradient(180deg, #07130d 0%, #0b1f15 48%, #06100b 100%);
        }

        .hero {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 18px;
          align-items: stretch;
          margin-bottom: 18px;
        }

        .heroCopy,
        .walletCard,
        .message,
        .empty,
        .stat,
        .panel,
        .emptyState {
          border: 1px solid rgba(232, 190, 103, .18);
          background:
            linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.03)),
            rgba(7, 24, 15, .84);
          box-shadow: 0 24px 70px rgba(0,0,0,.32);
          backdrop-filter: blur(10px);
        }

        .heroCopy {
          position: relative;
          overflow: hidden;
          border-radius: 34px;
          min-height: 280px;
          padding: 28px;
        }

        .heroCopy:before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(7,19,13,.96), rgba(7,19,13,.74), rgba(7,19,13,.92)),
            url("https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=80");
          background-size: cover;
          background-position: center;
          opacity: .82;
          z-index: -1;
        }

        .back {
          display: inline-flex;
          margin-bottom: 16px;
          color: #e8be67;
          font-weight: 900;
          text-decoration: none;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #e8be67;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .14em;
          font-size: 12px;
        }

        .hero h1 {
          margin: 0;
          color: #fff7df;
          font-size: 54px;
          letter-spacing: -2px;
          line-height: .96;
        }

        .hero span {
          display: block;
          margin-top: 14px;
          color: rgba(255,247,223,.76);
          max-width: 880px;
          line-height: 1.65;
          font-weight: 800;
        }

        .walletCard {
          border-radius: 34px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .walletCard p {
          margin: 0;
          color: rgba(255,247,223,.62);
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .14em;
          font-size: 12px;
        }

        .walletCard strong {
          display: block;
          margin-top: 12px;
          color: #f4d58b;
          font-size: 34px;
        }

        .walletCard small {
          display: block;
          margin-top: 8px;
          color: rgba(255,247,223,.64);
          font-weight: 900;
        }

        .message,
        .empty {
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 18px;
          color: #f4d58b;
          font-weight: 900;
        }

        .emptyState {
          min-height: 430px;
          display: grid;
          place-items: center;
          text-align: center;
          padding: 44px;
          border-radius: 34px;
        }

        .emptyState h2 {
          margin: 0;
          color: #fff7df;
          font-size: 36px;
        }

        .emptyState p {
          max-width: 580px;
          color: rgba(255,247,223,.72);
          font-weight: 800;
          line-height: 1.65;
        }

        .emptyState a,
        .buyMissing {
          display: inline-flex;
          margin-top: 8px;
          border-radius: 16px;
          padding: 14px 18px;
          color: #08120d;
          background: linear-gradient(135deg, #f4d58b, #c99536);
          text-decoration: none;
          font-weight: 900;
        }

        .emptyIcon {
          font-size: 70px;
          margin-bottom: 10px;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 18px;
        }

        .stat {
          border-radius: 26px;
          padding: 20px;
        }

        .stat p {
          margin: 0;
          color: rgba(255,247,223,.58);
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .stat h3 {
          margin: 10px 0 0;
          color: #f4d58b;
          font-size: 28px;
        }

        .careLayout {
          display: grid;
          grid-template-columns: .9fr 1fr 1.1fr;
          gap: 16px;
          align-items: start;
          margin-bottom: 18px;
        }

        .panel {
          border-radius: 34px;
          padding: 22px;
        }

        .panelHead h2 {
          margin: 0;
          color: #fff7df;
          font-size: 24px;
          letter-spacing: -.4px;
        }

        .panelHead p {
          margin: 7px 0 0;
          color: rgba(255,247,223,.62);
          line-height: 1.5;
          font-size: 14px;
          font-weight: 800;
        }

        .forestList,
        .serviceList,
        .seedlingList {
          display: grid;
          gap: 12px;
          margin-top: 18px;
          max-height: 600px;
          overflow: auto;
          padding-right: 4px;
        }

        .forestCard,
        .seedlingCard,
        .serviceCard {
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 22px;
          background:
            linear-gradient(135deg, rgba(255,255,255,.10), rgba(255,255,255,.04)),
            rgba(8, 23, 15, .78);
          color: #fff7df;
          cursor: pointer;
          text-align: left;
          box-shadow: 0 14px 30px rgba(0,0,0,.20);
        }

        .forestCard {
          padding: 16px;
        }

        .forestCard.active,
        .seedlingCard.active,
        .serviceCard.active {
          border-color: rgba(232,190,103,.48);
          background:
            radial-gradient(circle at 90% 8%, rgba(232,190,103,.20), transparent 28%),
            linear-gradient(135deg, rgba(255,255,255,.12), rgba(255,255,255,.05)),
            rgba(9, 30, 19, .94);
        }

        .forestCard small,
        .selectedForestHero small,
        .operationPreview small,
        .checkoutTarget small {
          display: block;
          color: #e8be67;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .10em;
          margin-bottom: 6px;
        }

        .forestCard b,
        .selectedForestHero b,
        .operationPreview b,
        .checkoutTarget b {
          display: block;
          color: #fff7df;
          font-size: 20px;
          line-height: 1.18;
        }

        .forestCard > span {
          display: inline-flex;
          margin-top: 10px;
          border-radius: 999px;
          padding: 7px 10px;
          color: #08120d;
          background: #f4d58b;
          font-size: 12px;
          font-weight: 900;
        }

        .forestMiniStats {
          display: grid;
          grid-template-columns: 1fr;
          gap: 6px;
          margin-top: 14px;
        }

        .forestMiniStats em {
          font-style: normal;
          font-size: 12px;
          font-weight: 900;
        }

        .protected {
          color: #8df0a4;
        }

        .attention {
          color: #f4d58b;
        }

        .critical {
          color: #ff9a88;
        }

        .selectedForestHero,
        .operationPreview,
        .careSyncBox,
        .inventoryCheck,
        .feeBox {
          border-radius: 22px;
          padding: 16px;
          margin-top: 18px;
          background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.08);
        }

        .selectedForestHero p,
        .operationPreview p,
        .careSyncBox p,
        .inventoryCheck p {
          margin: 8px 0 0;
          color: rgba(255,247,223,.64);
          line-height: 1.5;
          font-weight: 800;
        }

        .scopeGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 16px;
        }

        .scopeGrid button {
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 20px;
          padding: 16px;
          background: rgba(255,255,255,.07);
          color: #fff7df;
          text-align: left;
          cursor: pointer;
        }

        .scopeGrid button.active {
          border-color: rgba(232,190,103,.46);
          background: rgba(232,190,103,.12);
        }

        .scopeGrid button:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .scopeGrid strong {
          display: block;
          margin-bottom: 6px;
        }

        .scopeGrid span {
          color: rgba(255,247,223,.62);
          font-size: 12px;
          line-height: 1.4;
          font-weight: 800;
        }

        .seedlingCard {
          padding: 13px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .seedlingCard > span {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          border-radius: 16px;
          background: rgba(255,255,255,.08);
          flex: 0 0 auto;
        }

        .seedlingCard b {
          display: block;
          color: #fff7df;
          font-size: 15px;
        }

        .seedlingCard small {
          display: block;
          margin-top: 3px;
          color: rgba(255,247,223,.58);
          font-weight: 800;
          line-height: 1.3;
        }

        .serviceCard {
          padding: 14px;
          display: grid;
          grid-template-columns: 48px 1fr;
          gap: 12px;
          align-items: start;
        }

        .serviceIcon {
          display: grid;
          place-items: center;
          width: 48px;
          height: 48px;
          border-radius: 18px;
          background: rgba(255,255,255,.08);
          font-size: 24px;
        }

        .serviceCard span {
          display: inline-flex;
          margin-bottom: 7px;
          border-radius: 999px;
          padding: 6px 9px;
          background: rgba(232,190,103,.12);
          color: #f4d58b;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .serviceCard strong {
          display: block;
          color: #fff7df;
          font-size: 16px;
        }

        .serviceCard p {
          margin: 7px 0 0;
          color: rgba(255,247,223,.62);
          line-height: 1.45;
          font-size: 13px;
          font-weight: 800;
        }

        .serviceCard b {
          display: block;
          margin-top: 10px;
          color: #f4d58b;
          font-size: 16px;
        }

        .checkout {
          margin-bottom: 18px;
        }

        .checkoutHead {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
        }

        .checkoutHead h2 {
          margin: 0;
          color: #fff7df;
          font-size: 32px;
        }

        .checkoutHead span {
          display: block;
          margin-top: 7px;
          color: rgba(255,247,223,.62);
          font-weight: 800;
        }

        .checkoutTarget {
          min-width: 220px;
          border-radius: 22px;
          padding: 16px;
          background: rgba(232,190,103,.10);
          border: 1px solid rgba(232,190,103,.18);
        }

        .checkoutGrid {
          display: grid;
          grid-template-columns: .8fr 1fr;
          gap: 16px;
          margin-top: 16px;
        }

        .miniGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-top: 14px;
        }

        .mini {
          border-radius: 16px;
          padding: 12px;
          background: rgba(255,255,255,.07);
        }

        .mini span {
          display: block;
          color: #e8be67;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .mini b {
          display: block;
          margin-top: 6px;
          color: #fff7df;
          font-size: 13px;
          line-height: 1.35;
          word-break: break-word;
        }

        .inventoryCheck.ok {
          border-color: rgba(121,225,146,.22);
        }

        .inventoryCheck.bad {
          border-color: rgba(255,120,96,.24);
        }

        .inventoryCheck strong,
        .careSyncBox strong {
          display: block;
          color: #fff7df;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: .10em;
        }

        .feeRow {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid rgba(255,255,255,.08);
          color: rgba(255,247,223,.68);
          font-weight: 900;
        }

        .feeRow:last-child {
          border-bottom: 0;
        }

        .feeRow.strong {
          color: #fff7df;
          font-size: 18px;
        }

        .feeRow b {
          color: #f4d58b;
        }

        label {
          display: grid;
          gap: 8px;
          color: #e8be67;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        textarea {
          width: 100%;
          min-height: 148px;
          border: 1px solid rgba(232,190,103,.20);
          border-radius: 18px;
          padding: 14px;
          background: rgba(255,255,255,.08);
          color: #fff7df;
          outline: none;
          font-weight: 800;
          resize: vertical;
        }

        textarea::placeholder {
          color: rgba(255,247,223,.38);
        }

        .actionGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-top: 16px;
        }

        .submitButton,
        .autoRenewButton {
          width: 100%;
          border: 0;
          border-radius: 18px;
          padding: 15px;
          background: linear-gradient(135deg, #f4d58b, #c99536);
          color: #08120d;
          font-weight: 900;
          cursor: pointer;
        }

        .submitButton.secondary {
          color: #fff7df;
          background: rgba(255,255,255,.10);
          border: 1px solid rgba(232,190,103,.22);
        }

        .autoRenewButton {
          margin-top: 12px;
          color: #fff7df;
          background: rgba(255,255,255,.10);
          border: 1px solid rgba(232,190,103,.22);
        }

        .submitButton:disabled,
        .autoRenewButton:disabled {
          opacity: .55;
          cursor: not-allowed;
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
          border-radius: 20px;
          background: rgba(255,255,255,.07);
          padding: 16px;
          border: 1px solid rgba(255,255,255,.08);
        }

        .requestRow strong {
          color: #fff7df;
          font-size: 16px;
        }

        .requestRow p {
          margin: 6px 0 0;
          color: rgba(255,247,223,.62);
          font-size: 13px;
          font-weight: 800;
        }

        .requestRow small {
          display: block;
          margin-top: 6px;
          color: #f4d58b;
          font-weight: 900;
          white-space: pre-line;
        }

        .requestRight {
          display: grid;
          justify-items: end;
          gap: 8px;
        }

        .requestRight b {
          color: #f4d58b;
        }

        .status {
          display: inline-flex;
          justify-content: center;
          min-width: 92px;
          border-radius: 999px;
          padding: 8px 10px;
          font-size: 11px;
          font-weight: 900;
          background: rgba(244,213,139,.16);
          color: #f4d58b;
        }

        .status.completed,
        .status.active,
        .status.approved {
          background: rgba(121,225,146,.14);
          color: #8df0a4;
        }

        .status.rejected,
        .status.failed,
        .status.expired,
        .status.cancelled {
          background: rgba(255,120,96,.14);
          color: #ff9a88;
        }

        .softEmpty {
          border-radius: 18px;
          padding: 14px;
          color: rgba(255,247,223,.62);
          background: rgba(255,255,255,.06);
          font-weight: 900;
          text-align: center;
          margin-top: 14px;
        }



        .missionGroups,
        .historyGroups {
          display: grid;
          gap: 14px;
          margin-top: 18px;
        }

        .missionGroup,
        .historyGroup,
        .missionRequirementBox {
          border-radius: 22px;
          padding: 14px;
          background: rgba(255,255,255,.055);
          border: 1px solid rgba(255,255,255,.08);
        }

        .missionRequirementBox {
          margin-top: 18px;
        }

        .missionRequirementBox strong,
        .missionGroupHead span,
        .historyGroupHead strong {
          display: block;
          color: #fff7df;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: .10em;
        }

        .missionRequirementBox p {
          margin: 8px 0 0;
          color: rgba(255,247,223,.66);
          line-height: 1.5;
          font-weight: 800;
        }

        .missionGroupHead,
        .historyGroupHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }

        .historyGroupHead span {
          display: inline-flex;
          min-width: 34px;
          height: 34px;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          color: #08120d;
          background: #f4d58b;
          font-weight: 900;
        }

        .serviceList.compact {
          margin-top: 0;
          max-height: none;
        }

        .missionMetaGrid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 6px;
          margin-top: 10px;
        }

        .missionMetaGrid em {
          display: inline-flex;
          width: fit-content;
          border-radius: 999px;
          padding: 7px 10px;
          color: rgba(255,247,223,.86);
          background: rgba(255,255,255,.08);
          font-style: normal;
          font-size: 11px;
          font-weight: 900;
        }

        .softEmpty.small {
          margin-top: 0;
          padding: 11px;
          font-size: 12px;
        }



        .alertBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: auto;
          min-width: 96px;
          height: 34px;
          border-radius: 999px;
          padding: 0 12px;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .06em;
          background: rgba(244,213,139,.14);
          color: #f4d58b;
          border: 1px solid rgba(244,213,139,.22);
        }

        .alertBadge.protected {
          color: #8df0a4;
          background: rgba(121,225,146,.12);
          border-color: rgba(121,225,146,.20);
        }

        .alertBadge.critical {
          color: #ffb08e;
          background: rgba(255,120,96,.12);
          border-color: rgba(255,120,96,.22);
        }

        .opIcon {
          width: 48px;
          height: 48px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.08);
          color: #f4d58b;
        }

        .opIcon svg {
          width: 25px;
          height: 25px;
          fill: none;
          stroke: currentColor;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .opIcon.blue { color: #9fd8ff; background: rgba(76,151,217,.14); }
        .opIcon.green { color: #8df0a4; background: rgba(121,225,146,.12); }
        .opIcon.orange { color: #f4d58b; background: rgba(244,213,139,.12); }
        .opIcon.purple { color: #d8c1ff; background: rgba(151,112,214,.13); }
        .opIcon.cyan { color: #a9fff3; background: rgba(77,209,197,.12); }
        .opIcon.gold { color: #f4d58b; background: rgba(244,213,139,.12); }

        .emptyIcon span {
          display: inline-block;
          width: 74px;
          height: 74px;
          border-radius: 999px;
          background:
            radial-gradient(circle at 50% 25%, rgba(244,213,139,.38), transparent 38%),
            linear-gradient(135deg, rgba(244,213,139,.26), rgba(114,181,127,.18));
          border: 1px solid rgba(244,213,139,.30);
        }
        @media (max-width: 1260px) {
          .hero,
          .careLayout,
          .checkoutGrid {
            grid-template-columns: 1fr;
          }

          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .miniGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .checkoutHead {
            display: grid;
          }
        }

        @media (max-width: 760px) {
          .page {
            padding: 18px;
          }

          .hero h1 {
            font-size: 40px;
          }

          .stats,
          .scopeGrid,
          .miniGrid,
          .actionGrid,
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


function OperationIcon({ type }: { type: string }) {
  const key = normalize(type);

  if (key.includes("WATER")) return <IconWrap tone="blue"><WaterIcon /></IconWrap>;
  if (key.includes("FERTILIZER")) return <IconWrap tone="green"><LeafIcon /></IconWrap>;
  if (key.includes("PHOTO")) return <IconWrap tone="orange"><CameraIcon /></IconWrap>;
  if (key.includes("HEALTH")) return <IconWrap tone="purple"><HeartPulseIcon /></IconWrap>;
  if (key.includes("GPS")) return <IconWrap tone="purple"><PinIcon /></IconWrap>;
  if (key.includes("QR")) return <IconWrap tone="cyan"><QrIcon /></IconWrap>;
  if (key.includes("CARE") || key.includes("PROGRAM") || key.includes("SUBSCRIPTION")) return <IconWrap tone="green"><RefreshIcon /></IconWrap>;

  return <IconWrap tone="gold"><TaskIcon /></IconWrap>;
}

function IconWrap({ children, tone }: { children: ReactNode; tone: string }) {
  return <span className={`opIcon ${tone}`}>{children}</span>;
}

function WaterIcon() {
  return <svg viewBox="0 0 24 24"><path d="M12 2S5.5 9.2 5.5 15a6.5 6.5 0 0 0 13 0C18.5 9.2 12 2 12 2Z" /><path d="M9 16.2c.7 1.4 1.8 2.1 3.3 2.1" /></svg>;
}

function LeafIcon() {
  return <svg viewBox="0 0 24 24"><path d="M21 4s-8.2-.8-13 4c-3.9 3.9-3 9-3 9s5.1.9 9-3c4.8-4.8 7-10 7-10Z" /><path d="M5 19c4-5 8-7 14-10" /></svg>;
}

function CameraIcon() {
  return <svg viewBox="0 0 24 24"><path d="M4 7h4l1.5-2h5L16 7h4v12H4V7Z" /><circle cx="12" cy="13" r="3.5" /></svg>;
}

function HeartPulseIcon() {
  return <svg viewBox="0 0 24 24"><path d="M20.5 5.8c-2-2-5.2-1.7-6.9.6L12 8.2l-1.6-1.8C8.7 4.1 5.5 3.8 3.5 5.8c-2.1 2.1-2 5.5.2 7.6L12 21l8.3-7.6c2.2-2.1 2.3-5.5.2-7.6Z" /><path d="M7 13h3l1.2-2.6L13.5 16l1.4-3H17" /></svg>;
}

function PinIcon() {
  return <svg viewBox="0 0 24 24"><path d="M12 21s7-6.1 7-12A7 7 0 0 0 5 9c0 5.9 7 12 7 12Z" /><circle cx="12" cy="9" r="2.4" /></svg>;
}

function QrIcon() {
  return <svg viewBox="0 0 24 24"><path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Z" /><path d="M14 14h2v2h-2v-2Zm4 0h2v6h-2v-6Zm-4 4h2v2h-2v-2Z" /></svg>;
}

function RefreshIcon() {
  return <svg viewBox="0 0 24 24"><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M18.2 9A7 7 0 0 0 6.7 6.7L4 9.4" /><path d="M5.8 15A7 7 0 0 0 17.3 17.3L20 14.6" /></svg>;
}

function TaskIcon() {
  return <svg viewBox="0 0 24 24"><path d="M7 3h10l3 3v15H4V3h3Z" /><path d="M8 12h8M8 16h6" /></svg>;
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
