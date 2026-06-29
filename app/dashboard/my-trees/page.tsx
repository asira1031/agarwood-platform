"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import {
  getMissionLabel,
  getMissionRequirement,
  missionStatusLabel as engineMissionStatusLabel,
  treeOnlyOperations as engineTreeOnlyOperations,
  forestLevelOperations as engineForestLevelOperations,
} from "@/lib/tree-mission-engine";

type AlertStatus = "PROTECTED" | "ATTENTION" | "CRITICAL" | string;
type EvidenceMode = "PHOTOS" | "GPS" | "HEALTH";
type CareBucket = "HEALTHY" | "MONITORING" | "NEEDS_ATTENTION" | "PENDING_EVIDENCE";

type Profile = {
  id: string;
  full_name: string | null;
  display_name?: string | null;
  email: string | null;
};

type ForestSummary = {
  group_id: string;
  customer_profile_id: string | null;
  forest_name: string | null;
  display_forest_name?: string | null;
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
  alert_status: AlertStatus | null;
  alert_reason: string | null;
  valuation_status: string | null;
  official_valuation_amount: number | null;
  latest_photo_at: string | null;
  latest_photo_url: string | null;
  latest_image_url: string | null;
  image_url?: string | null;
  photo_url?: string | null;
  default_image_url?: string | null;
  product_image_url?: string | null;
  marketplace_image_url?: string | null;
  latest_gps_at: string | null;
  latest_latitude: number | null;
  latest_longitude: number | null;
  latest_map_url: string | null;
  latest_gps_url: string | null;
  latest_health_at: string | null;
  latest_health_status: string | null;
  latest_issue_severity: string | null;
  latest_issue_summary: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type OperationRequest = {
  id: string;
  customer_profile_id: string | null;
  profile_id?: string | null;
  tree_id: string | null;
  group_id: string | null;
  service_type?: string | null;
  operation_type?: string | null;
  care_type?: string | null;
  product_name?: string | null;
  mission_label?: string | null;
  status: string | null;
  evidence_status?: string | null;
  amount?: number | null;
  total_amount?: number | null;
  created_at: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  assigned_at?: string | null;
  submitted_at?: string | null;
};

type PhotoEvidence = {
  id: string;
  tree_id?: string | null;
  photo_url: string | null;
  image_url: string | null;
  caption: string | null;
  notes: string | null;
  status: string | null;
  created_at: string | null;
};

type GpsEvidence = {
  id: string;
  tree_id?: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  gps_url: string | null;
  map_url: string | null;
  location_note: string | null;
  notes: string | null;
  status: string | null;
  created_at: string | null;
};

type HealthEvidence = {
  id: string;
  tree_id?: string | null;
  health_status: string | null;
  issue_severity: string | null;
  issue_summary: string | null;
  report_notes: string | null;
  notes: string | null;
  status: string | null;
  created_at: string | null;
};

function peso(value: number | null | undefined) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No update yet";
  try {
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "No update yet";
  }
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "No update yet";
  try {
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "No update yet";
  }
}

function normalizeStatus(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase();
}

function cleanLabel(value: any) {
  return String(value || "Record")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\w/g, (char) => char.toUpperCase());
}

function customerTreeName(tree: TreeDetail | null | undefined) {
  return tree?.custom_name || tree?.customer_tree_name || tree?.display_name || "Seedling";
}

function forestName(forest: ForestSummary | null | undefined) {
  return forest?.display_forest_name || forest?.forest_name || "Unnamed Forest";
}

function treeForestName(tree: TreeDetail | null | undefined) {
  return tree?.forest_name || "Unnamed Forest";
}

function careLabel(status: string | null | undefined) {
  const normalized = normalizeStatus(status);
  if (["ACTIVE", "SUBSCRIBED", "PROTECTED"].includes(normalized)) return "Subscribed";
  if (normalized === "EXPIRED") return "Expired";
  if (normalized === "CANCELLED" || normalized === "CANCELED") return "Cancelled";
  if (normalized === "INACTIVE") return "Inactive";
  return "Not Subscribed";
}

function valuationLabel(status: string | null | undefined, amount: number | null | undefined) {
  const normalized = normalizeStatus(status);
  if (normalized === "APPROVED" && amount) return `Official Value: ${peso(amount)}`;
  if (normalized === "APPROVED") return "Approved";
  if (["PENDING_ADMIN_VALUATION", "PENDING", "REQUESTED"].includes(normalized)) {
    return "Pending Admin Valuation";
  }
  if (normalized === "ASSIGNED") return "Assigned for Inspection";
  if (normalized === "INSPECTION_SUBMITTED") return "Inspection Submitted";
  return "Not Requested";
}

function getQrPath(tree: TreeDetail) {
  return tree.tree_qr_url || `/tree/verify/${tree.tree_id}`;
}

function getQrValue(tree: TreeDetail) {
  const path = getQrPath(tree);
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

function getMapLink(gps: GpsEvidence | TreeDetail) {
  const direct = "map_url" in gps ? gps.map_url : gps.latest_map_url;
  const gpsUrl = "gps_url" in gps ? gps.gps_url : gps.latest_gps_url;
  const lat = "latitude" in gps ? gps.latitude : gps.latest_latitude;
  const lng = "longitude" in gps ? gps.longitude : gps.latest_longitude;
  if (direct) return direct;
  if (gpsUrl) return gpsUrl;
  if (lat && lng) return `https://maps.google.com/?q=${lat},${lng}`;
  return "";
}

function latestTreeUpdate(tree: TreeDetail) {
  return tree.latest_health_at || tree.latest_photo_at || tree.latest_gps_at || tree.updated_at || tree.created_at;
}

function treeDisplayImage(tree: TreeDetail | null | undefined) {
  return (
    tree?.latest_photo_url ||
    tree?.latest_image_url ||
    tree?.image_url ||
    tree?.photo_url ||
    tree?.default_image_url ||
    tree?.product_image_url ||
    tree?.marketplace_image_url ||
    "/images/arganwood-reference/young-agarwood-tree.png"
  );
}

function treeStageLabel(tree: TreeDetail | null | undefined) {
  const row = tree as Record<string, any> | null | undefined;
  return row?.stage || row?.growth_stage || row?.status || tree?.care_status || "Active";
}

function isCareInactive(tree: TreeDetail) {
  const care = normalizeStatus(tree.care_status);
  return ["", "INACTIVE", "EXPIRED", "CANCELLED", "CANCELED"].includes(care);
}

function needsRecentUpdate(tree: TreeDetail) {
  const latest = latestTreeUpdate(tree);
  if (!latest) return true;
  const ageMs = Date.now() - new Date(latest).getTime();
  return ageMs > 1000 * 60 * 60 * 24 * 30;
}

function missionRawLabel(operation: OperationRequest | null | undefined) {
  return (
    operation?.mission_label ||
    operation?.product_name ||
    operation?.service_type ||
    operation?.operation_type ||
    operation?.care_type ||
    "Care Mission"
  );
}

function missionLabel(operation: OperationRequest | null | undefined) {
  return getMissionLabel(missionRawLabel(operation));
}

function missionRequirement(operation: OperationRequest | null | undefined) {
  return getMissionRequirement(missionRawLabel(operation));
}

function missionStatusLabel(value: string | null | undefined) {
  return engineMissionStatusLabel(value);
}

function treeCareBucket(tree: TreeDetail, activeMission?: OperationRequest | null): CareBucket {
  const missionStatus = normalizeStatus(activeMission?.status);
  const alert = normalizeStatus(tree.alert_status);
  const health = normalizeStatus(tree.latest_health_status);
  const severity = normalizeStatus(tree.latest_issue_severity);

  if (["SUBMITTED"].includes(missionStatus)) return "PENDING_EVIDENCE";
  if (["PENDING", "REQUESTED", "PAID", "PROCESSING", "ASSIGNED", "IN_PROGRESS"].includes(missionStatus)) return "MONITORING";
  if (alert === "CRITICAL" || severity === "CRITICAL" || health === "CRITICAL" || isCareInactive(tree)) return "NEEDS_ATTENTION";
  if (alert === "ATTENTION" || needsRecentUpdate(tree)) return "MONITORING";
  return "HEALTHY";
}

function bucketLabel(bucket: CareBucket) {
  if (bucket === "HEALTHY") return "Healthy";
  if (bucket === "MONITORING") return "Monitoring";
  if (bucket === "PENDING_EVIDENCE") return "Pending Evidence";
  return "Needs Attention";
}

function bucketClass(bucket: CareBucket) {
  if (bucket === "HEALTHY") return "healthy";
  if (bucket === "MONITORING") return "monitoring";
  if (bucket === "PENDING_EVIDENCE") return "pendingEvidence";
  return "needsAttention";
}

function sortByNewest<T extends { created_at?: string | null; updated_at?: string | null }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const left = new Date(a.updated_at || a.created_at || 0).getTime();
    const right = new Date(b.updated_at || b.created_at || 0).getTime();
    return right - left;
  });
}

function buildUniqueForests(forestRows: ForestSummary[], treeRows: TreeDetail[]) {
  const byId = new Map<string, ForestSummary>();
  const rawNameCounts = new Map<string, number>();

  forestRows.forEach((forest) => {
    if (!forest.group_id || byId.has(forest.group_id)) return;
    const groupTrees = treeRows.filter((tree) => tree.group_id === forest.group_id);
    const latestUpdate = groupTrees.map(latestTreeUpdate).filter(Boolean).sort().pop();
    const rawName = forest.forest_name || "Unnamed Forest";
    const nextNameCount = (rawNameCounts.get(rawName) || 0) + 1;
    rawNameCounts.set(rawName, nextNameCount);

    byId.set(forest.group_id, {
      ...forest,
      display_forest_name: nextNameCount > 1 ? `${rawName} #${nextNameCount}` : rawName,
      total_trees: groupTrees.length || Number(forest.total_trees || 0),
      protected_count: groupTrees.length,
      attention_count: 0,
      critical_count: 0,
      updated_at: latestUpdate || forest.updated_at || forest.created_at,
    });
  });

  treeRows.forEach((tree) => {
    if (!tree.group_id || byId.has(tree.group_id)) return;
    const rawName = tree.forest_name || "Unnamed Forest";
    const nextNameCount = (rawNameCounts.get(rawName) || 0) + 1;
    rawNameCounts.set(rawName, nextNameCount);
    const groupTrees = treeRows.filter((item) => item.group_id === tree.group_id);

    byId.set(tree.group_id, {
      group_id: tree.group_id,
      customer_profile_id: tree.customer_profile_id,
      forest_name: rawName,
      display_forest_name: nextNameCount > 1 ? `${rawName} #${nextNameCount}` : rawName,
      total_trees: groupTrees.length,
      protected_count: groupTrees.length,
      attention_count: 0,
      critical_count: 0,
      status: "ACTIVE",
      created_at: tree.created_at,
      updated_at: tree.updated_at || tree.created_at,
    });
  });

  return Array.from(byId.values());
}

export default function MyTreesPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [forests, setForests] = useState<ForestSummary[]>([]);
  const [trees, setTrees] = useState<TreeDetail[]>([]);
  const [operationRequests, setOperationRequests] = useState<OperationRequest[]>([]);
  const [selectedForestId, setSelectedForestId] = useState("");
  const [selectedTree, setSelectedTree] = useState<TreeDetail | null>(null);
  const [missionPlanTree, setMissionPlanTree] = useState<TreeDetail | null>(null);
  const [qrTree, setQrTree] = useState<TreeDetail | null>(null);
  const [renameTree, setRenameTree] = useState<TreeDetail | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameForest, setRenameForest] = useState<ForestSummary | null>(null);
  const [renameForestValue, setRenameForestValue] = useState("");
  const [moveTree, setMoveTree] = useState<TreeDetail | null>(null);
  const [moveTargetForestId, setMoveTargetForestId] = useState("");
  const [evidenceTree, setEvidenceTree] = useState<TreeDetail | null>(null);
  const [evidenceMode, setEvidenceMode] = useState<EvidenceMode>("PHOTOS");
  const [photoEvidence, setPhotoEvidence] = useState<PhotoEvidence[]>([]);
  const [gpsEvidence, setGpsEvidence] = useState<GpsEvidence[]>([]);
  const [healthEvidence, setHealthEvidence] = useState<HealthEvidence[]>([]);
  const [missionPhotos, setMissionPhotos] = useState<PhotoEvidence[]>([]);
  const [missionGps, setMissionGps] = useState<GpsEvidence[]>([]);
  const [missionHealth, setMissionHealth] = useState<HealthEvidence[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [loadingMissionPlan, setLoadingMissionPlan] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function resolveProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return null;
    }

    const email = user.email?.trim().toLowerCase() || "";

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, full_name, display_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, full_name, display_name, email")
      .eq("email", email)
      .maybeSingle();

    return (profileById || profileByEmail) as Profile | null;
  }

  async function loadMyTrees(keepSelectedForestId?: string) {
    setLoading(true);
    setMessage("");

    const currentProfile = await resolveProfile();
    if (!currentProfile) {
      setMessage("Profile not found.");
      setLoading(false);
      return;
    }

    setProfile(currentProfile);

    const { data: forestRows, error: forestError } = await supabase
      .from("v_customer_forest_view")
      .select("*")
      .eq("customer_profile_id", currentProfile.id)
      .order("created_at", { ascending: true });

    if (forestError) {
      setMessage(`Forest view failed: ${forestError.message}`);
      setLoading(false);
      return;
    }

    const { data: treeRows, error: treeError } = await supabase
      .from("v_customer_tree_detail")
      .select("*")
      .eq("customer_profile_id", currentProfile.id)
      .order("created_at", { ascending: true });

    if (treeError) {
      setMessage(`Tree detail view failed: ${treeError.message}`);
      setLoading(false);
      return;
    }

    const { data: operationRows, error: operationError } = await supabase
      .from("tree_operation_requests")
      .select("*")
      .or(`customer_profile_id.eq.${currentProfile.id},profile_id.eq.${currentProfile.id}`)
      .order("created_at", { ascending: false });

    if (operationError) {
      setOperationRequests([]);
      setMessage(`Mission history could not load: ${operationError.message}`);
    } else {
      setOperationRequests((operationRows || []) as OperationRequest[]);
    }

    const nextTrees = (treeRows || []) as TreeDetail[];
    const nextForests = buildUniqueForests((forestRows || []) as ForestSummary[], nextTrees);

    setForests(nextForests);
    setTrees(nextTrees);

    const preferredForestId = keepSelectedForestId || selectedForestId;
    if (preferredForestId && nextForests.some((forest) => forest.group_id === preferredForestId)) {
      setSelectedForestId(preferredForestId);
    } else {
      setSelectedForestId(nextForests[0]?.group_id || "");
    }

    setSelectedTree((previous) => {
      if (!previous) return null;
      return nextTrees.find((tree) => tree.tree_id === previous.tree_id) || null;
    });

    setLoading(false);
  }

  useEffect(() => {
    loadMyTrees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function treeOnlyOperations(tree: TreeDetail | null | undefined) {
    return engineTreeOnlyOperations(tree, operationRequests);
  }

  function forestLevelOperations(forestId: string | null | undefined) {
    return engineForestLevelOperations(forestId, operationRequests);
  }

  function latestOperationForTree(tree: TreeDetail | null | undefined) {
    const rows = treeOnlyOperations(tree);

    return rows.find((request) => {
      const status = normalizeStatus(request.status);
      return !["COMPLETED", "APPROVED", "CANCELLED", "CANCELED", "REJECTED"].includes(status);
    }) || rows[0] || null;
  }

  const treeBuckets = useMemo(() => {
    return trees.reduce(
      (sum, tree) => {
        const bucket = treeCareBucket(tree, latestOperationForTree(tree));
        sum[bucket] += 1;
        return sum;
      },
      {
        HEALTHY: 0,
        MONITORING: 0,
        NEEDS_ATTENTION: 0,
        PENDING_EVIDENCE: 0,
      } as Record<CareBucket, number>,
    );
  }, [trees, operationRequests]);

  const totals = useMemo(() => {
    return {
      forests: forests.length,
      total: trees.length,
      healthy: treeBuckets.HEALTHY,
      monitoring: treeBuckets.MONITORING,
      needsAttention: treeBuckets.NEEDS_ATTENTION,
      pendingEvidence: treeBuckets.PENDING_EVIDENCE,
    };
  }, [forests.length, trees.length, treeBuckets]);

  const selectedForest = useMemo(() => {
    return forests.find((forest) => forest.group_id === selectedForestId) || null;
  }, [forests, selectedForestId]);

  const selectedForestTrees = useMemo(() => {
    return trees.filter((tree) => tree.group_id === selectedForestId);
  }, [trees, selectedForestId]);

  const selectedForestGroups = useMemo(() => {
    return {
      healthy: selectedForestTrees.filter((tree) => treeCareBucket(tree, latestOperationForTree(tree)) === "HEALTHY"),
      monitoring: selectedForestTrees.filter((tree) => treeCareBucket(tree, latestOperationForTree(tree)) === "MONITORING"),
      needsAttention: selectedForestTrees.filter((tree) => treeCareBucket(tree, latestOperationForTree(tree)) === "NEEDS_ATTENTION"),
      pendingEvidence: selectedForestTrees.filter((tree) => treeCareBucket(tree, latestOperationForTree(tree)) === "PENDING_EVIDENCE"),
    };
  }, [selectedForestTrees, operationRequests]);

  async function openEvidence(tree: TreeDetail, mode: EvidenceMode) {
    setEvidenceTree(tree);
    setEvidenceMode(mode);
    setLoadingEvidence(true);
    setPhotoEvidence([]);
    setGpsEvidence([]);
    setHealthEvidence([]);

    if (mode === "PHOTOS") {
      const { data, error } = await supabase
        .from("tree_photo_updates")
        .select("id, tree_id, photo_url, image_url, caption, notes, status, created_at")
        .eq("tree_id", tree.tree_id)
        .order("created_at", { ascending: false });
      if (error) setMessage(`Photo updates failed: ${error.message}`);
      else setPhotoEvidence((data || []) as PhotoEvidence[]);
    }

    if (mode === "GPS") {
      const { data, error } = await supabase
        .from("tree_gps_logs")
        .select("id, tree_id, latitude, longitude, accuracy_meters, gps_url, map_url, location_note, notes, status, created_at")
        .eq("tree_id", tree.tree_id)
        .order("created_at", { ascending: false });
      if (error) setMessage(`GPS updates failed: ${error.message}`);
      else setGpsEvidence((data || []) as GpsEvidence[]);
    }

    if (mode === "HEALTH") {
      const { data, error } = await supabase
        .from("tree_health_reports")
        .select("id, tree_id, health_status, issue_severity, issue_summary, report_notes, notes, status, created_at")
        .eq("tree_id", tree.tree_id)
        .order("created_at", { ascending: false });
      if (error) setMessage(`Health reports failed: ${error.message}`);
      else setHealthEvidence((data || []) as HealthEvidence[]);
    }

    setLoadingEvidence(false);
  }

  async function openMissionPlan(tree: TreeDetail) {
    setMissionPlanTree(tree);
    setLoadingMissionPlan(true);
    setMissionPhotos([]);
    setMissionGps([]);
    setMissionHealth([]);

    const [photos, gps, health] = await Promise.all([
      supabase
        .from("tree_photo_updates")
        .select("id, tree_id, photo_url, image_url, caption, notes, status, created_at")
        .eq("tree_id", tree.tree_id)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("tree_gps_logs")
        .select("id, tree_id, latitude, longitude, accuracy_meters, gps_url, map_url, location_note, notes, status, created_at")
        .eq("tree_id", tree.tree_id)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("tree_health_reports")
        .select("id, tree_id, health_status, issue_severity, issue_summary, report_notes, notes, status, created_at")
        .eq("tree_id", tree.tree_id)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    if (!photos.error) setMissionPhotos((photos.data || []) as PhotoEvidence[]);
    if (!gps.error) setMissionGps((gps.data || []) as GpsEvidence[]);
    if (!health.error) setMissionHealth((health.data || []) as HealthEvidence[]);

    setLoadingMissionPlan(false);
  }

  function startRename(tree: TreeDetail) {
    setRenameTree(tree);
    setRenameValue(customerTreeName(tree));
  }

  async function saveRename() {
    if (!profile || !renameTree || actionLoading) return;
    const cleanName = renameValue.trim();
    if (!cleanName) {
      setMessage("Please enter a friendly tree name.");
      return;
    }

    setActionLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("trees")
      .update({ custom_name: cleanName, updated_at: new Date().toISOString() })
      .eq("id", renameTree.tree_id)
      .eq("customer_profile_id", profile.id);

    if (error) {
      setMessage(`Rename failed: ${error.message}`);
      setActionLoading(false);
      return;
    }

    setRenameTree(null);
    setRenameValue("");
    await loadMyTrees(selectedForestId);
    setMessage("Tree renamed successfully.");
    setActionLoading(false);
  }

  function startRenameForest(forest: ForestSummary) {
    setRenameForest(forest);
    setRenameForestValue(forest.forest_name || forest.display_forest_name || "Unnamed Forest");
    setMessage("");
  }

  async function saveRenameForest() {
    if (!profile || !renameForest || actionLoading) return;
    const cleanName = renameForestValue.trim();
    if (!cleanName) {
      setMessage("Rename Forest blocker: Please enter a forest name.");
      return;
    }

    setActionLoading(true);
    setMessage("");

    const payload = { forest_name: cleanName, updated_at: new Date().toISOString() };
    let updateResult = await supabase
      .from("tree_groups")
      .update(payload)
      .eq("id", renameForest.group_id)
      .eq("customer_profile_id", profile.id);

    if (updateResult.error && updateResult.error.message.toLowerCase().includes("customer_profile_id")) {
      updateResult = await supabase
        .from("tree_groups")
        .update(payload)
        .eq("id", renameForest.group_id)
        .eq("profile_id", profile.id);
    }

    if (updateResult.error && updateResult.error.message.toLowerCase().includes("profile_id")) {
      updateResult = await supabase.from("tree_groups").update(payload).eq("id", renameForest.group_id);
    }

    if (updateResult.error) {
      setMessage(`Rename Forest failed: ${updateResult.error.message}`);
      setActionLoading(false);
      return;
    }

    const renamedForestId = renameForest.group_id;
    setRenameForest(null);
    setRenameForestValue("");
    await loadMyTrees(renamedForestId);
    setMessage("Forest renamed successfully. Cards and tree grouping were refreshed.");
    setActionLoading(false);
  }

  function addTreesToForest(groupId: string) {
    window.location.href = `/dashboard/marketplace?group_id=${encodeURIComponent(groupId)}&mode=add_to_forest`;
  }

  function startMoveTree(tree: TreeDetail) {
    setMoveTree(tree);
    setMoveTargetForestId(tree.group_id || selectedForestId || forests[0]?.group_id || "");
    setMessage("");
  }

  async function saveMoveTree() {
    if (!profile || !moveTree || actionLoading) return;
    if (!moveTargetForestId) {
      setMessage("Move Tree blocker: Please choose the forest where this seedling should belong.");
      return;
    }
    if (moveTargetForestId === moveTree.group_id) {
      setMoveTree(null);
      setMoveTargetForestId("");
      setMessage("Tree is already inside that forest.");
      return;
    }

    const targetForest = forests.find((forest) => forest.group_id === moveTargetForestId);
    if (!targetForest) {
      setMessage("Move Tree blocker: Selected forest was not found. Reload My Trees and try again.");
      return;
    }

    setActionLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("trees")
      .update({ group_id: moveTargetForestId, updated_at: new Date().toISOString() })
      .eq("id", moveTree.tree_id)
      .eq("customer_profile_id", profile.id);

    if (error) {
      setMessage(`Move Tree failed: ${error.message}`);
      setActionLoading(false);
      return;
    }

    const movedTreeName = customerTreeName(moveTree);
    const movedForestName = forestName(targetForest);
    setMoveTree(null);
    setMoveTargetForestId("");
    setSelectedTree(null);
    await loadMyTrees(moveTargetForestId);
    setMessage(`${movedTreeName} moved to ${movedForestName}. Forest counts were recalculated.`);
    setActionLoading(false);
  }

  function requestCare(tree: TreeDetail) {
    const params = new URLSearchParams();
    params.set("tree_id", tree.tree_id);
    if (tree.group_id) params.set("group_id", tree.group_id);
    window.location.href = `/dashboard/tree-operations?${params.toString()}`;
  }

  async function requestValuation(tree: TreeDetail) {
    if (!profile || actionLoading) return;
    setActionLoading(true);
    setMessage("");

    const { data: existingRows, error: existingError } = await supabase
      .from("tree_valuation_requests")
      .select("id, status")
      .eq("customer_profile_id", profile.id)
      .eq("tree_id", tree.tree_id)
      .in("status", ["PENDING", "REQUESTED", "ASSIGNED", "INSPECTION_SUBMITTED"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingError) {
      setMessage(`Valuation check failed: ${existingError.message}`);
      setActionLoading(false);
      return;
    }

    if ((existingRows || []).length > 0) {
      setMessage("Valuation request already pending for this tree.");
      setActionLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("tree_valuation_requests").insert({
      customer_profile_id: profile.id,
      tree_id: tree.tree_id,
      group_id: tree.group_id,
      status: "PENDING",
      customer_notes: `Customer requested valuation for ${customerTreeName(tree)} in ${treeForestName(tree)}.`,
      requested_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      setMessage(`Valuation request failed: ${insertError.message}`);
      setActionLoading(false);
      return;
    }

    await supabase
      .from("trees")
      .update({ valuation_status: "PENDING", valuation_requested_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", tree.tree_id)
      .eq("customer_profile_id", profile.id);

    await loadMyTrees(selectedForestId);
    setMessage("Valuation requested. Admin will assign a gardener for inspection.");
    setActionLoading(false);
  }

  function renderTreePremiumCard(tree: TreeDetail) {
    const activeMission = latestOperationForTree(tree);
    const bucket = treeCareBucket(tree, activeMission);
    const latestUpdate = latestTreeUpdate(tree);

    return (
      <article className={`treeCard ${bucketClass(bucket)}`} key={tree.tree_id}>
        <button className="treeCardMain" type="button" onClick={() => setSelectedTree(tree)}>
          <div className="treeCardImage">
            <img src={treeDisplayImage(tree)} alt={customerTreeName(tree)} />
            <small>{bucketLabel(bucket)}</small>
          </div>

          <div className="treeCardTop">
            <span className="lineBadge" />
            <small>{cleanLabel(treeStageLabel(tree))}</small>
          </div>

          <b>{customerTreeName(tree)}</b>
          <code>{tree.tree_code || "Tree code pending"}</code>
          <p>{treeForestName(tree)}</p>

          <div className="treeMetaGrid">
            <div>
              <small>Care Status</small>
              <span>{careLabel(tree.care_status)}</span>
            </div>
            <div>
              <small>Latest Farm Update</small>
              <span>{formatShortDate(latestUpdate)}</span>
            </div>
            <div className="wideMeta">
              <small>Current Mission</small>
              <span>{activeMission ? `${missionLabel(activeMission)} · ${missionStatusLabel(activeMission.status)}` : "No active mission"}</span>
            </div>
          </div>
        </button>

        <div className="treeCardActionsInline">
          <button type="button" onClick={() => setSelectedTree(tree)}>Open Details</button>
          <button type="button" onClick={() => openMissionPlan(tree)}>View Mission Plan</button>
          <button type="button" onClick={() => requestCare(tree)}>Request Care</button>
          <button type="button" onClick={() => startRename(tree)}>Rename</button>
          <button type="button" onClick={() => startMoveTree(tree)}>Move Tree</button>
        </div>
      </article>
    );
  }

  function renderMissionList(tree: TreeDetail) {
    const rows = treeOnlyOperations(tree);
    if (rows.length === 0) {
      return <div className="softEmpty">No mission record yet. Request a care mission or subscribe to a protection plan.</div>;
    }

    return (
      <div className="missionList">
        {rows.map((request) => (
          <article className="missionItem" key={request.id}>
            <div>
              <b>{missionLabel(request)}</b>
              <small>{missionRequirement(request)}</small>
            </div>
            <span>{missionStatusLabel(request.status)}</span>
            <em>{formatDate(request.updated_at || request.created_at)}</em>
          </article>
        ))}
      </div>
    );
  }

  function renderForestLevelMissionList(forestId: string | null | undefined) {
    const rows = forestLevelOperations(forestId);

    if (rows.length === 0) {
      return <div className="softEmpty">No forest-level care missions for this forest yet.</div>;
    }

    return (
      <div className="missionList forestMissionList">
        {rows.map((request) => (
          <article className="missionItem" key={request.id}>
            <div>
              <b>{missionLabel(request)}</b>
              <small>{missionRequirement(request)}</small>
            </div>
            <span>{missionStatusLabel(request.status)}</span>
            <em>{formatDate(request.updated_at || request.created_at)}</em>
          </article>
        ))}
      </div>
    );
  }

  function renderLatestProof(tree: TreeDetail) {
    const proofs = [
      { label: "Photo", date: tree.latest_photo_at, value: tree.latest_photo_url || tree.latest_image_url ? "Available" : "No photo yet" },
      { label: "GPS", date: tree.latest_gps_at, value: tree.latest_latitude && tree.latest_longitude ? `${tree.latest_latitude}, ${tree.latest_longitude}` : "No GPS yet" },
      { label: "Health", date: tree.latest_health_at, value: tree.latest_health_status || tree.latest_issue_summary || "No health report yet" },
    ];

    return (
      <div className="proofGrid">
        {proofs.map((proof) => (
          <div key={proof.label}>
            <small>{proof.label}</small>
            <b>{proof.value}</b>
            <span>{formatShortDate(proof.date)}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="heroCopy">
          <Link href="/dashboard" className="back">← Back to Dashboard</Link>
          <p className="eyebrow">Arganwood V6 Care Progress</p>
          <h1>My Trees & Care Progress</h1>
          <span>
            Monitor each seedling, latest farm proof, active mission, and care history using real Admin and Gardener workflow data.
          </span>
          <div className="heroActions">
            <Link href="/dashboard/marketplace">Buy Trees</Link>
            <Link href="/dashboard/tree-operations">Request Care</Link>
          </div>
        </div>

        <div className="forestHeroCard">
          <div className="forestHeroGlow" />
          <p>Care Progress Overview</p>
          <strong>{totals.total}</strong>
          <span>Total Trees Managed</span>
          <div className="heroMiniStats">
            <div><small>Total Forests</small><b>{totals.forests}</b></div>
            <div><small>Healthy</small><b>{totals.healthy}</b></div>
            <div><small>Monitoring</small><b>{totals.monitoring}</b></div>
            <div><small>Needs Attention</small><b>{totals.needsAttention}</b></div>
            <div><small>Pending Evidence</small><b>{totals.pendingEvidence}</b></div>
          </div>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      {loading ? (
        <div className="empty">Loading your trees...</div>
      ) : forests.length === 0 ? (
        <section className="emptyState">
          <div className="emptyIcon"><span /></div>
          <p className="eyebrow">No forest yet</p>
          <h2>Create your first forest</h2>
          <p>Buy trees from Marketplace and choose Create New Forest. Your real mission history will appear here after care requests or subscriptions.</p>
          <Link href="/dashboard/marketplace">Go to Marketplace</Link>
        </section>
      ) : (
        <>
          <section className="forestGrid">
            {forests.map((forest) => {
              const isActive = selectedForestId === forest.group_id;
              const groupTrees = trees.filter((tree) => tree.group_id === forest.group_id);
              const healthyCount = groupTrees.filter((tree) => treeCareBucket(tree, latestOperationForTree(tree)) === "HEALTHY").length;
              const monitoringCount = groupTrees.filter((tree) => treeCareBucket(tree, latestOperationForTree(tree)) === "MONITORING").length;
              const attentionCount = groupTrees.filter((tree) => treeCareBucket(tree, latestOperationForTree(tree)) === "NEEDS_ATTENTION").length;

              return (
                <article key={forest.group_id} className={isActive ? "forestCard active" : "forestCard"}>
                  <button className="forestMainButton" type="button" onClick={() => setSelectedForestId(forest.group_id)}>
                    <div className="forestTop">
                      <div>
                        <small>Forest</small>
                        <b>{forestName(forest)}</b>
                      </div>
                      <span>{Number(forest.total_trees || 0)} Trees</span>
                    </div>
                    <div className="forestCounts">
                      <div className="healthy"><small>Healthy</small><b>{healthyCount}</b></div>
                      <div className="monitoring"><small>Monitoring</small><b>{monitoringCount}</b></div>
                      <div className="needsAttention"><small>Needs Attention</small><b>{attentionCount}</b></div>
                    </div>
                    <div className="forestMetaLine">Latest update: {formatShortDate(forest.updated_at || forest.created_at)}</div>
                  </button>

                  <div className="forestCardActions">
                    <button type="button" onClick={() => setSelectedForestId(forest.group_id)}>Open Forest</button>
                    <button type="button" onClick={() => startRenameForest(forest)}>Rename</button>
                    <Link href={`/dashboard/tree-operations?group_id=${forest.group_id}`}>Request Care</Link>
                    <button type="button" onClick={() => addTreesToForest(forest.group_id)}>Add Trees</button>
                  </div>
                </article>
              );
            })}
          </section>

          {selectedForest && (
            <section className="forestDetail">
              <div className="forestDetailHead">
                <div>
                  <p className="eyebrow">Open Forest</p>
                  <h2>{forestName(selectedForest)}</h2>
                  <span>
                    {Number(selectedForest.total_trees || 0)} trees · {selectedForestGroups.healthy.length} healthy · {selectedForestGroups.monitoring.length} monitoring · {selectedForestGroups.needsAttention.length} needs attention · {selectedForestGroups.pendingEvidence.length} pending evidence
                  </span>
                  <small className="forestDetailHint">Showing real trees for this forest only. Mission data comes from tree_operation_requests and evidence tables.</small>
                </div>

                <div className="forestHeadActions">
                  <button type="button" onClick={() => startRenameForest(selectedForest)}>Rename Forest</button>
                  <Link href={`/dashboard/tree-operations?group_id=${selectedForest.group_id}`}>Request Care</Link>
                  <Link href={`/dashboard/marketplace?group_id=${selectedForest.group_id}&mode=add_to_forest`}>Add Trees</Link>
                </div>
              </div>

              <div className="forestMissionSection">
                <div className="treeSectionHead"><b>Forest-Level Care Missions</b><span>{forestLevelOperations(selectedForest.group_id).length}</span></div>
                {renderForestLevelMissionList(selectedForest.group_id)}
              </div>

              <div className="treeSections">
                <section className="treeSection healthyBox">
                  <div className="treeSectionHead"><b>Healthy</b><span>{selectedForestGroups.healthy.length}</span></div>
                  {selectedForestGroups.healthy.length === 0 ? <div className="softEmpty">No healthy trees yet.</div> : <div className="treeList">{selectedForestGroups.healthy.map(renderTreePremiumCard)}</div>}
                </section>

                <section className="treeSection monitoringBox">
                  <div className="treeSectionHead"><b>Monitoring</b><span>{selectedForestGroups.monitoring.length}</span></div>
                  {selectedForestGroups.monitoring.length === 0 ? <div className="softEmpty">No active monitoring.</div> : <div className="treeList">{selectedForestGroups.monitoring.map(renderTreePremiumCard)}</div>}
                </section>

                <section className="treeSection attentionBox">
                  <div className="treeSectionHead"><b>Needs Attention</b><span>{selectedForestGroups.needsAttention.length}</span></div>
                  {selectedForestGroups.needsAttention.length === 0 ? <div className="softEmpty">No attention items.</div> : <div className="treeList">{selectedForestGroups.needsAttention.map(renderTreePremiumCard)}</div>}
                </section>

                <section className="treeSection pendingEvidenceBox">
                  <div className="treeSectionHead"><b>Pending Evidence</b><span>{selectedForestGroups.pendingEvidence.length}</span></div>
                  {selectedForestGroups.pendingEvidence.length === 0 ? <div className="softEmpty">No submitted missions waiting for review.</div> : <div className="treeList">{selectedForestGroups.pendingEvidence.map(renderTreePremiumCard)}</div>}
                </section>
              </div>
            </section>
          )}
        </>
      )}

      {selectedTree && (
        <div className="modalOverlay" onClick={() => setSelectedTree(null)}>
          <div className="modal treeDetailModal" onClick={(event) => event.stopPropagation()}>
            <button className="closeBtn" onClick={() => setSelectedTree(null)}>×</button>
            <div className={`detailStatus ${bucketClass(treeCareBucket(selectedTree, latestOperationForTree(selectedTree)))}`}>
              <span className="lineBadge" />
              <b>{bucketLabel(treeCareBucket(selectedTree, latestOperationForTree(selectedTree)))}</b>
            </div>

            <p className="eyebrow">Tree Detail</p>
            <h2>{customerTreeName(selectedTree)}</h2>
            <p className="detailSubtitle">{treeForestName(selectedTree)}</p>

            <div className="detailHeroImage">
              <img src={treeDisplayImage(selectedTree)} alt={customerTreeName(selectedTree)} />
              <span>Latest approved farm photo automatically overrides the original marketplace image.</span>
            </div>

            <div className="detailBlock">
              <h3>Tree Identity</h3>
              <div className="detailGrid">
                <div><small>Tree Code</small><b>{selectedTree.tree_code || "No tree code yet"}</b></div>
                <div><small>Forest</small><b>{treeForestName(selectedTree)}</b></div>
                <div><small>Purchase Price</small><b>{peso(selectedTree.purchase_price)}</b></div>
                <div><small>Valuation</small><b>{valuationLabel(selectedTree.valuation_status, selectedTree.official_valuation_amount)}</b></div>
              </div>
            </div>

            <div className="detailBlock">
              <h3>Current Care Status</h3>
              <div className="detailGrid">
                <div><small>Care Status</small><b>{careLabel(selectedTree.care_status)}</b></div>
                <div><small>Latest Farm Update</small><b>{formatShortDate(latestTreeUpdate(selectedTree))}</b></div>
              </div>
            </div>

            <div className="detailBlock">
              <h3>Active Mission</h3>
              {latestOperationForTree(selectedTree) ? (
                <div className="activeMissionBox">
                  <b>{missionLabel(latestOperationForTree(selectedTree))}</b>
                  <span>{missionRequirement(latestOperationForTree(selectedTree))}</span>
                  <small>{missionStatusLabel(latestOperationForTree(selectedTree)?.status)}</small>
                </div>
              ) : (
                <div className="softEmpty">No active mission. Request care or subscribe to a protection plan.</div>
              )}
            </div>

            <div className="detailBlock">
              <h3>Latest Farm Proof</h3>
              {renderLatestProof(selectedTree)}
            </div>

            <div className="detailBlock">
              <h3>Mission History</h3>
              {renderMissionList(selectedTree)}
            </div>

            {selectedTree.latest_issue_summary && (
              <div className="warningNote"><b>Health Note</b><p>{selectedTree.latest_issue_summary}</p></div>
            )}

            <div className="detailBlock">
              <h3>Actions</h3>
              <div className="actionGrid">
                <button onClick={() => requestCare(selectedTree)}>Request Care</button>
                <button onClick={() => openMissionPlan(selectedTree)}>View Mission Plan</button>
                <button onClick={() => openEvidence(selectedTree, "PHOTOS")}>View Photos</button>
                <button onClick={() => openEvidence(selectedTree, "GPS")}>View GPS</button>
                <button onClick={() => openEvidence(selectedTree, "HEALTH")}>View Health</button>
                <button onClick={() => setQrTree(selectedTree)}>View QR</button>
                <button onClick={() => startRename(selectedTree)}>Rename</button>
                <button onClick={() => startMoveTree(selectedTree)}>Move Tree</button>
                <button disabled={actionLoading} onClick={() => requestValuation(selectedTree)}>Request Valuation</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {missionPlanTree && (
        <div className="modalOverlay" onClick={() => setMissionPlanTree(null)}>
          <div className="modal missionPlanModal" onClick={(event) => event.stopPropagation()}>
            <button className="closeBtn" onClick={() => setMissionPlanTree(null)}>×</button>
            <p className="eyebrow">Mission Plan</p>
            <h2>{customerTreeName(missionPlanTree)}</h2>
            <p className="detailSubtitle">Real care progress from mission and evidence records.</p>

            {loadingMissionPlan ? (
              <div className="softEmpty">Loading mission plan...</div>
            ) : (
              <>
                <div className="detailBlock">
                  <h3>Active Mission</h3>
                  {latestOperationForTree(missionPlanTree) ? (
                    <div className="activeMissionBox">
                      <b>{missionLabel(latestOperationForTree(missionPlanTree))}</b>
                      <span>{missionRequirement(latestOperationForTree(missionPlanTree))}</span>
                      <small>{missionStatusLabel(latestOperationForTree(missionPlanTree)?.status)}</small>
                    </div>
                  ) : (
                    <div className="softEmpty">No mission record yet. Request a care mission or subscribe to a protection plan.</div>
                  )}
                </div>

                <div className="detailBlock">
                  <h3>Latest Farm Proof</h3>
                  <div className="proofGrid">
                    <div><small>Photos</small><b>{missionPhotos.length}</b><span>{formatShortDate(missionPhotos[0]?.created_at)}</span></div>
                    <div><small>GPS</small><b>{missionGps.length}</b><span>{formatShortDate(missionGps[0]?.created_at)}</span></div>
                    <div><small>Health</small><b>{missionHealth.length}</b><span>{formatShortDate(missionHealth[0]?.created_at)}</span></div>
                  </div>
                </div>

                <div className="detailBlock">
                  <h3>Mission History</h3>
                  {renderMissionList(missionPlanTree)}
                </div>

                <div className="actionGrid">
                  <button onClick={() => requestCare(missionPlanTree)}>Request Care</button>
                  <button onClick={() => openEvidence(missionPlanTree, "PHOTOS")}>View Photos</button>
                  <button onClick={() => openEvidence(missionPlanTree, "GPS")}>View GPS</button>
                  <button onClick={() => openEvidence(missionPlanTree, "HEALTH")}>View Health</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {qrTree && (
        <div className="modalOverlay" onClick={() => setQrTree(null)}>
          <div className="modal qrModal" onClick={(event) => event.stopPropagation()}>
            <button className="closeBtn" onClick={() => setQrTree(null)}>×</button>
            <div className="tagCard">
              <p>ARGANWOOD TREE TAG</p>
              <div className="tagRows">
                <div><small>Customer</small><b>{profile?.full_name || profile?.display_name || "Customer"}</b></div>
                <div><small>Forest</small><b>{treeForestName(qrTree)}</b></div>
                <div><small>Tree</small><b>{customerTreeName(qrTree)}</b></div>
                <div><small>Care</small><b>{careLabel(qrTree.care_status)}</b></div>
              </div>
              <div className="qrBox">
                <QRCodeCanvas value={getQrValue(qrTree)} size={214} includeMargin />
              </div>
              <small className="qrHint">Scan to verify this tree.</small>
            </div>
          </div>
        </div>
      )}

      {renameTree && (
        <div className="modalOverlay" onClick={() => setRenameTree(null)}>
          <div className="modal renameModal" onClick={(event) => event.stopPropagation()}>
            <button className="closeBtn" onClick={() => setRenameTree(null)}>×</button>
            <p className="eyebrow">Friendly Name</p>
            <h2>Rename Tree</h2>
            <p className="detailSubtitle">This changes the customer-visible name only. QR identity stays the same.</p>
            <label className="fieldLabel">Tree Name<input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} placeholder="Seedling 1" /></label>
            <button className="primaryBtn" disabled={actionLoading} onClick={saveRename}>{actionLoading ? "Saving..." : "Save Name"}</button>
          </div>
        </div>
      )}

      {renameForest && (
        <div className="modalOverlay" onClick={() => setRenameForest(null)}>
          <div className="modal renameModal" onClick={(event) => event.stopPropagation()}>
            <button className="closeBtn" onClick={() => setRenameForest(null)}>×</button>
            <p className="eyebrow">Forest Management</p>
            <h2>Rename Forest</h2>
            <p className="detailSubtitle">Rename this forest. Tree QR identity and group_id stay the same.</p>
            <label className="fieldLabel">Forest Name<input value={renameForestValue} onChange={(event) => setRenameForestValue(event.target.value)} placeholder="My Family Plantation" /></label>
            <button className="primaryBtn" disabled={actionLoading} onClick={saveRenameForest}>{actionLoading ? "Saving..." : "Save Forest Name"}</button>
          </div>
        </div>
      )}

      {moveTree && (
        <div className="modalOverlay" onClick={() => setMoveTree(null)}>
          <div className="modal renameModal" onClick={(event) => event.stopPropagation()}>
            <button className="closeBtn" onClick={() => setMoveTree(null)}>×</button>
            <p className="eyebrow">Forest Grouping</p>
            <h2>Move Tree to Another Forest</h2>
            <p className="detailSubtitle">Move {customerTreeName(moveTree)} into the correct forest.</p>
            <label className="fieldLabel">Destination Forest
              <select value={moveTargetForestId} onChange={(event) => setMoveTargetForestId(event.target.value)}>
                <option value="">Select destination forest</option>
                {forests.map((forest) => <option key={forest.group_id} value={forest.group_id}>{forestName(forest)} · {Number(forest.total_trees || 0)} tree(s)</option>)}
              </select>
            </label>
            <button className="primaryBtn" disabled={actionLoading || !moveTargetForestId} onClick={saveMoveTree}>{actionLoading ? "Moving..." : "Move Tree"}</button>
          </div>
        </div>
      )}

      {evidenceTree && (
        <div className="modalOverlay" onClick={() => setEvidenceTree(null)}>
          <div className="modal evidenceModal" onClick={(event) => event.stopPropagation()}>
            <button className="closeBtn" onClick={() => setEvidenceTree(null)}>×</button>
            <p className="eyebrow">{evidenceMode}</p>
            <h2>{customerTreeName(evidenceTree)}</h2>
            <p className="detailSubtitle">{treeForestName(evidenceTree)}</p>

            {loadingEvidence ? <div className="softEmpty">Loading evidence...</div> : (
              <>
                {evidenceMode === "PHOTOS" && (
                  <div className="evidenceList">
                    {photoEvidence.length === 0 ? <div className="softEmpty">No photo updates yet.</div> : photoEvidence.map((item) => {
                      const src = item.photo_url || item.image_url || "";
                      return <article className="evidenceCard" key={item.id}>{src ? <img src={src} alt={item.caption || "Tree photo update"} /> : <div className="imageFallback"><span /></div>}<div><b>{item.caption || item.status || "Photo Update"}</b><small>{formatDate(item.created_at)}</small><p>{item.notes || "No notes provided."}</p></div></article>;
                    })}
                  </div>
                )}

                {evidenceMode === "GPS" && (
                  <div className="evidenceList">
                    {gpsEvidence.length === 0 ? <div className="softEmpty">No GPS updates yet.</div> : gpsEvidence.map((item) => {
                      const mapLink = getMapLink(item);
                      return <article className="evidenceCard gpsCard" key={item.id}><div className="proofIcon" /><div><b>{item.location_note || item.status || "GPS Update"}</b><small>{formatDate(item.created_at)}</small><p>{item.latitude && item.longitude ? `${item.latitude}, ${item.longitude}` : item.notes || "Coordinates not provided."}</p>{mapLink && <a href={mapLink} target="_blank" rel="noreferrer">Open Map</a>}</div></article>;
                    })}
                  </div>
                )}

                {evidenceMode === "HEALTH" && (
                  <div className="evidenceList">
                    {healthEvidence.length === 0 ? <div className="softEmpty">No health reports yet.</div> : healthEvidence.map((item) => <article className="evidenceCard healthCard" key={item.id}><div className="proofIcon" /><div><b>{item.health_status || "Health Report"}</b><small>{formatDate(item.created_at)}</small><p>{item.issue_summary || item.report_notes || item.notes || "No health notes provided."}</p>{item.issue_severity && <span className="severity">{item.issue_severity}</span>}</div></article>)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; }
        .page { min-height: 100vh; padding: 30px; color: #fff7df; font-family: Arial, Helvetica, sans-serif; background: radial-gradient(circle at 15% 5%, rgba(220,176,88,.24), transparent 28%), radial-gradient(circle at 86% 0%, rgba(85,132,93,.22), transparent 30%), linear-gradient(180deg, #07130d 0%, #0b1f15 45%, #06100b 100%); }
        .hero { display: grid; grid-template-columns: 1fr 430px; gap: 22px; align-items: stretch; margin-bottom: 22px; }
        .heroCopy, .forestHeroCard, .message, .empty, .forestCard, .forestDetail, .emptyState { border: 1px solid rgba(232,190,103,.18); background: linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.03)), rgba(7,24,15,.82); box-shadow: 0 24px 70px rgba(0,0,0,.32); backdrop-filter: blur(10px); }
        .heroCopy { border-radius: 34px; min-height: 330px; padding: 28px; position: relative; overflow: hidden; }
        .heroCopy:before { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(7,19,13,.96), rgba(7,19,13,.74), rgba(7,19,13,.92)), url("/images/arganwood-reference/premium-background.png"); background-size: cover; background-position: center; opacity: .82; z-index: -2; }
        .heroCopy:after { content: ""; position: absolute; width: 300px; height: 300px; right: -90px; bottom: -120px; border-radius: 50%; background: rgba(232,190,103,.20); filter: blur(8px); z-index: -1; }
        .back { display: inline-flex; margin-bottom: 18px; color: #e8be67; font-weight: 900; text-decoration: none; }
        .eyebrow { margin: 0 0 8px; color: #e8be67; font-weight: 900; text-transform: uppercase; letter-spacing: .14em; font-size: 12px; }
        h1 { margin: 0; color: #fff7df; font-size: 58px; letter-spacing: -2.4px; line-height: .95; }
        .heroCopy span { display: block; margin-top: 16px; max-width: 760px; color: rgba(255,247,223,.78); font-weight: 800; line-height: 1.65; }
        .heroActions, .forestHeadActions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 26px; }
        .heroActions a, .forestHeadActions a, .forestHeadActions button, .emptyState a { display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 16px; padding: 14px 18px; color: #08120d; background: linear-gradient(135deg, #f4d58b, #c99536); text-decoration: none; font-weight: 900; box-shadow: 0 16px 34px rgba(201,149,54,.20); cursor: pointer; }
        .heroActions a:last-child, .forestHeadActions a:first-child, .forestHeadActions button:first-child { color: #fff7df; background: rgba(255,255,255,.10); border: 1px solid rgba(232,190,103,.22); box-shadow: none; }
        .forestHeroCard { border-radius: 34px; padding: 26px; position: relative; overflow: hidden; }
        .forestHeroGlow { position: absolute; width: 220px; height: 220px; right: -80px; top: -80px; border-radius: 50%; background: rgba(232,190,103,.24); filter: blur(4px); }
        .forestHeroCard p { margin: 0; color: rgba(255,247,223,.72); font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .13em; }
        .forestHeroCard strong { display: block; margin-top: 22px; color: #f4d58b; font-size: 84px; line-height: .9; letter-spacing: -4px; }
        .forestHeroCard > span { display: block; margin-top: 8px; color: rgba(255,247,223,.78); font-weight: 900; }
        .heroMiniStats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 26px; }
        .heroMiniStats div, .detailGrid div, .proofGrid div, .tagRows div { border-radius: 20px; padding: 14px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.08); }
        .heroMiniStats small, .detailGrid small, .proofGrid small, .tagRows small { display: block; color: rgba(255,247,223,.58); font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: .10em; margin-bottom: 6px; }
        .heroMiniStats b { display: block; color: #fff7df; font-size: 28px; }
        .message, .empty { border-radius: 24px; padding: 18px; margin-bottom: 18px; color: #f4d58b; font-weight: 900; }
        .emptyState { min-height: 440px; display: grid; place-items: center; text-align: center; padding: 44px; border-radius: 34px; }
        .emptyState h2 { margin: 0; color: #fff7df; font-size: 36px; }
        .emptyState p { max-width: 600px; color: rgba(255,247,223,.72); font-weight: 800; line-height: 1.65; }
        .emptyIcon span, .proofIcon, .lineBadge { display: inline-block; border-radius: 999px; background: linear-gradient(135deg, rgba(244,213,139,.92), rgba(114,181,127,.70)); }
        .emptyIcon span { width: 74px; height: 74px; margin-bottom: 10px; }
        .lineBadge { width: 38px; height: 38px; box-shadow: inset 0 0 0 10px rgba(8,18,13,.48); }
        .forestGrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 18px; }
        .forestCard { border-radius: 28px; padding: 18px; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
        .forestCard:hover, .forestCard.active { transform: translateY(-3px); border-color: rgba(232,190,103,.46); box-shadow: 0 28px 70px rgba(0,0,0,.40); }
        .forestCard.active { background: radial-gradient(circle at 90% 8%, rgba(232,190,103,.22), transparent 28%), linear-gradient(135deg, rgba(255,255,255,.10), rgba(255,255,255,.04)), rgba(9,30,19,.94); }
        .forestMainButton, .treeCardMain { width: 100%; padding: 0; border: 0; text-align: left; color: inherit; background: transparent; cursor: pointer; }
        .forestTop { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 16px; }
        .forestTop small { display: block; color: #e8be67; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .10em; margin-bottom: 6px; }
        .forestTop b { display: block; color: #fff7df; font-size: 24px; line-height: 1.12; }
        .forestTop span { white-space: nowrap; border-radius: 999px; padding: 8px 11px; color: #08120d; background: #f4d58b; font-size: 12px; font-weight: 900; }
        .forestCounts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .forestCounts div { border-radius: 18px; padding: 12px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.08); }
        .forestCounts small { display: block; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 5px; }
        .forestCounts b { font-size: 22px; }
        .healthy small, .healthy b { color: #8df0a4; }
        .monitoring small, .monitoring b { color: #9fd8ff; }
        .needsAttention small, .needsAttention b { color: #ffb08e; }
        .pendingEvidence small, .pendingEvidence b { color: #f4d58b; }
        .forestMetaLine { margin-top: 12px; color: rgba(255,247,223,.68); font-size: 12px; font-weight: 800; }
        .forestCardActions { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 14px; }
        .forestCardActions button, .forestCardActions a { border: 0; border-radius: 14px; padding: 10px 8px; text-align: center; text-decoration: none; background: rgba(232,190,103,.16); color: #f4d58b; font-size: 11px; font-weight: 900; cursor: pointer; }
        .forestDetail { border-radius: 34px; padding: 22px; }
        .forestDetailHead { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 20px; }
        .forestDetailHead h2 { margin: 0; color: #fff7df; font-size: 38px; letter-spacing: -1.2px; }
        .forestDetailHead span { display: block; margin-top: 7px; color: rgba(255,247,223,.68); font-weight: 900; }
        .forestDetailHint { display: block; margin-top: 8px; color: rgba(255,247,223,.58); font-weight: 800; }
        .treeSections { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; align-items: start; }
        .treeSection { border-radius: 26px; padding: 14px; min-height: 260px; }
        .healthyBox { background: linear-gradient(180deg, rgba(121,225,146,.12), rgba(121,225,146,.04)); border: 1px solid rgba(121,225,146,.18); }
        .monitoringBox { background: linear-gradient(180deg, rgba(159,216,255,.12), rgba(159,216,255,.04)); border: 1px solid rgba(159,216,255,.18); }
        .attentionBox { background: linear-gradient(180deg, rgba(255,176,142,.13), rgba(255,176,142,.04)); border: 1px solid rgba(255,176,142,.18); }
        .pendingEvidenceBox { background: linear-gradient(180deg, rgba(244,213,139,.14), rgba(244,213,139,.04)); border: 1px solid rgba(244,213,139,.18); }
        .treeSectionHead { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 12px; }
        .treeSectionHead b { color: #fff7df; font-size: 18px; }
        .treeSectionHead span { display: inline-grid; place-items: center; min-width: 31px; height: 31px; border-radius: 999px; color: #08120d; background: #f4d58b; font-size: 12px; font-weight: 900; }
        .treeList { display: grid; gap: 10px; }
        .treeCard { width: 100%; border: 1px solid rgba(255,255,255,.08); border-radius: 22px; padding: 14px; background: linear-gradient(135deg, rgba(255,255,255,.10), rgba(255,255,255,.04)), rgba(8,23,15,.78); box-shadow: 0 14px 30px rgba(0,0,0,.20); transition: transform .18s ease, border-color .18s ease; }
        .treeCard:hover { transform: translateY(-2px); border-color: rgba(232,190,103,.38); }
        .treeCard.healthy { border-color: rgba(121,225,146,.22); }
        .treeCard.monitoring { border-color: rgba(159,216,255,.22); }
        .treeCard.needsAttention { border-color: rgba(255,176,142,.26); }
        .treeCard.pendingEvidence { border-color: rgba(244,213,139,.24); }
        .treeCardImage { position: relative; height: 154px; margin-bottom: 13px; overflow: hidden; border-radius: 18px; border: 1px solid rgba(255,255,255,.08); background: rgba(0,0,0,.18); }
        .treeCardImage img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .treeCardImage small { position: absolute; left: 10px; bottom: 10px; border-radius: 999px; padding: 7px 10px; color: #08120d; background: rgba(244,213,139,.92); font-size: 10px; font-weight: 1000; text-transform: uppercase; letter-spacing: .08em; box-shadow: 0 10px 24px rgba(0,0,0,.22); }
        .treeCardTop { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
        .treeCardTop small { border-radius: 999px; padding: 7px 10px; background: rgba(255,255,255,.08); color: rgba(255,247,223,.75); font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
        .treeCard b { display: block; color: #fff7df; font-size: 18px; margin-bottom: 6px; }
        .treeCard code { color: #f4d58b; font-weight: 900; }
        .treeCard p { margin: 8px 0 0; color: rgba(255,247,223,.66); font-weight: 800; line-height: 1.45; }
        .treeMetaGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
        .treeMetaGrid div { border-radius: 15px; padding: 10px; background: rgba(255,255,255,.06); }
        .treeMetaGrid small { display: block; color: rgba(255,247,223,.54); font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 5px; }
        .treeMetaGrid span { color: rgba(255,247,223,.82); font-size: 11px; font-weight: 900; }
        .wideMeta { grid-column: 1 / -1; }
        .treeCardActionsInline { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); gap: 8px; margin-top: 14px; }
        .treeCardActionsInline button { border: 1px solid rgba(232,190,103,.18); border-radius: 14px; padding: 10px 8px; color: #f4d58b; background: rgba(232,190,103,.10); font-size: 11px; font-weight: 1000; cursor: pointer; }
        .softEmpty { border-radius: 20px; padding: 16px; color: rgba(255,247,223,.62); background: rgba(255,255,255,.06); font-weight: 900; text-align: center; }
        .modalOverlay { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: 20px; background: rgba(3,10,7,.72); backdrop-filter: blur(9px); }
        .modal { position: relative; width: min(880px, 100%); max-height: 92vh; overflow: auto; border-radius: 34px; padding: 26px; color: #fff7df; background: radial-gradient(circle at 90% 8%, rgba(232,190,103,.20), transparent 30%), linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.03)), #07180f; box-shadow: 0 34px 100px rgba(0,0,0,.52); border: 1px solid rgba(232,190,103,.18); }
        .closeBtn { position: absolute; top: 16px; right: 16px; width: 42px; height: 42px; border: 0; border-radius: 999px; background: rgba(255,255,255,.10); color: #f4d58b; font-size: 26px; font-weight: 900; cursor: pointer; }
        .detailStatus { display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; padding: 9px 12px; margin-bottom: 14px; font-size: 13px; font-weight: 900; background: rgba(255,255,255,.08); color: #f4d58b; }
        .detailHeroImage { position: relative; overflow: hidden; height: 260px; border-radius: 26px; border: 1px solid rgba(232,190,103,.18); margin: 18px 0; background: rgba(0,0,0,.20); }
        .detailHeroImage img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .detailHeroImage span { position: absolute; left: 16px; right: 16px; bottom: 14px; border-radius: 16px; padding: 10px 12px; color: #fff7df; background: rgba(7,24,15,.76); backdrop-filter: blur(10px); font-size: 12px; font-weight: 900; }
        .modal h2 { margin: 0; color: #fff7df; font-size: 38px; letter-spacing: -1px; }
        .modal h3 { margin: 0 0 12px; color: #f4d58b; font-size: 16px; }
        .detailSubtitle { margin: 8px 0 18px; color: rgba(255,247,223,.66); font-weight: 900; }
        .detailBlock { margin-top: 18px; }
        .detailGrid, .proofGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .proofGrid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .detailGrid b, .proofGrid b, .tagRows b { display: block; color: #fff7df; font-size: 15px; line-height: 1.35; }
        .proofGrid span { display: block; margin-top: 6px; color: rgba(255,247,223,.58); font-size: 12px; font-weight: 900; }
        .activeMissionBox { border-radius: 22px; padding: 16px; background: rgba(244,213,139,.10); border: 1px solid rgba(244,213,139,.18); }
        .activeMissionBox b, .activeMissionBox span, .activeMissionBox small { display: block; }
        .activeMissionBox b { color: #fff7df; font-size: 20px; }
        .activeMissionBox span { margin-top: 8px; color: rgba(255,247,223,.72); font-weight: 900; }
        .activeMissionBox small { margin-top: 8px; color: #f4d58b; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
        .missionList { display: grid; gap: 10px; }
        .missionItem { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; border-radius: 18px; padding: 14px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.08); }
        .missionItem b { color: #fff7df; }
        .missionItem small, .missionItem em { display: block; margin-top: 4px; color: rgba(255,247,223,.58); font-style: normal; font-size: 12px; font-weight: 900; }
        .missionItem span { border-radius: 999px; padding: 8px 10px; color: #08120d; background: #f4d58b; font-size: 11px; font-weight: 900; }
        .warningNote { border-radius: 18px; padding: 14px; margin: 18px 0 0; background: rgba(255,120,96,.10); border: 1px solid rgba(255,120,96,.16); }
        .warningNote b { color: #ffb08e; }
        .warningNote p { margin: 6px 0 0; color: rgba(255,247,223,.74); font-weight: 800; line-height: 1.5; }
        .actionGrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .actionGrid button, .primaryBtn { border: 0; border-radius: 16px; padding: 14px; color: #08120d; background: linear-gradient(135deg, #f4d58b, #c99536); font-weight: 900; cursor: pointer; }
        .actionGrid button:nth-child(odd) { color: #fff7df; background: rgba(255,255,255,.10); border: 1px solid rgba(232,190,103,.20); }
        .actionGrid button:disabled, .primaryBtn:disabled { opacity: .55; cursor: not-allowed; }
        .qrModal { width: min(470px, 100%); }
        .tagCard { border-radius: 28px; padding: 22px; text-align: center; background: radial-gradient(circle at 50% 0%, rgba(232,190,103,.22), transparent 30%), rgba(255,255,255,.06); border: 1px solid rgba(232,190,103,.20); }
        .tagCard p { margin: 0 0 16px; color: #f4d58b; font-size: 18px; font-weight: 900; letter-spacing: .10em; }
        .tagRows { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; text-align: left; }
        .qrBox { display: inline-grid; place-items: center; padding: 14px; border-radius: 22px; background: white; box-shadow: 0 14px 38px rgba(0,0,0,.28); }
        .qrHint { display: block; margin-top: 12px; color: rgba(255,247,223,.64); font-weight: 900; }
        .fieldLabel { display: grid; gap: 8px; margin: 18px 0; color: #e8be67; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .09em; }
        .fieldLabel input, .fieldLabel select { width: 100%; border: 1px solid rgba(232,190,103,.20); border-radius: 16px; padding: 14px; background: rgba(255,255,255,.08); color: #fff7df; outline: none; font-size: 16px; font-weight: 900; text-transform: none; letter-spacing: 0; }
        .fieldLabel option { color: #08120d; }
        .evidenceList { display: grid; gap: 12px; }
        .evidenceCard { display: grid; grid-template-columns: 130px 1fr; gap: 14px; border-radius: 22px; padding: 12px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.08); align-items: center; }
        .evidenceCard img, .imageFallback { width: 130px; height: 100px; border-radius: 18px; object-fit: cover; background: rgba(255,255,255,.08); display: grid; place-items: center; }
        .imageFallback span { width: 42px; height: 42px; border-radius: 999px; background: rgba(244,213,139,.40); }
        .evidenceCard b { display: block; color: #fff7df; font-size: 18px; }
        .evidenceCard small { display: block; margin-top: 4px; color: #e8be67; font-weight: 900; }
        .evidenceCard p { margin: 8px 0 0; color: rgba(255,247,223,.66); font-weight: 800; line-height: 1.5; }
        .evidenceCard a { display: inline-flex; margin-top: 8px; color: #f4d58b; font-weight: 900; }
        .proofIcon { width: 74px; height: 74px; box-shadow: inset 0 0 0 18px rgba(8,18,13,.48); }
        .gpsCard, .healthCard { grid-template-columns: 74px 1fr; }
        .severity { display: inline-flex; margin-top: 8px; border-radius: 999px; padding: 7px 10px; color: #ffb08e; background: rgba(255,120,96,.12); font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
        @media (max-width: 1180px) { .hero, .forestGrid, .treeSections { grid-template-columns: 1fr; } .forestHeroCard strong { font-size: 66px; } }
        @media (max-width: 760px) { .page { padding: 18px; } h1 { font-size: 42px; } .heroMiniStats, .forestCounts, .forestDetailHead, .detailGrid, .proofGrid, .actionGrid, .tagRows, .evidenceCard, .gpsCard, .healthCard, .treeMetaGrid { display: grid; grid-template-columns: 1fr; } .forestDetailHead { align-items: start; } .forestHeadActions, .heroActions { display: grid; grid-template-columns: 1fr; width: 100%; } .forestCardActions, .treeCardActionsInline { grid-template-columns: 1fr; } .evidenceCard img, .imageFallback { width: 100%; height: 180px; } .detailHeroImage { height: 210px; } }
      `}</style>
    </main>
  );
}
