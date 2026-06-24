"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "@/lib/supabase";

type AlertStatus = "PROTECTED" | "ATTENTION" | "CRITICAL" | string;

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

type PhotoEvidence = {
  id: string;
  photo_url: string | null;
  image_url: string | null;
  caption: string | null;
  notes: string | null;
  status: string | null;
  created_at: string | null;
};

type GpsEvidence = {
  id: string;
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
  health_status: string | null;
  issue_severity: string | null;
  issue_summary: string | null;
  report_notes: string | null;
  notes: string | null;
  status: string | null;
  created_at: string | null;
};

type EvidenceMode = "PHOTOS" | "GPS" | "HEALTH";

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

function customerTreeName(tree: TreeDetail | null | undefined) {
  return (
    tree?.custom_name ||
    tree?.customer_tree_name ||
    tree?.display_name ||
    "Seedling"
  );
}

function forestName(forest: ForestSummary | null | undefined) {
  return forest?.display_forest_name || forest?.forest_name || "Unnamed Forest";
}

function treeForestName(tree: TreeDetail | null | undefined) {
  return tree?.forest_name || "Unnamed Forest";
}

function alertLabel(status: AlertStatus | null | undefined) {
  const normalized = normalizeStatus(status);

  if (normalized === "PROTECTED") return "Protected";
  if (normalized === "ATTENTION") return "Needs Attention";
  if (normalized === "CRITICAL") return "Critical";

  return "Needs Attention";
}

function alertIcon(status: AlertStatus | null | undefined) {
  const normalized = normalizeStatus(status);

  if (normalized === "PROTECTED") return "🟢";
  if (normalized === "ATTENTION") return "🟡";
  if (normalized === "CRITICAL") return "🔴";

  return "🟡";
}

function alertClass(status: AlertStatus | null | undefined) {
  const normalized = normalizeStatus(status);

  if (normalized === "PROTECTED") return "protected";
  if (normalized === "ATTENTION") return "attention";
  if (normalized === "CRITICAL") return "critical";

  return "attention";
}

function careLabel(status: string | null | undefined) {
  const normalized = normalizeStatus(status);

  if (
    normalized === "ACTIVE" ||
    normalized === "SUBSCRIBED" ||
    normalized === "PROTECTED"
  ) {
    return "Subscribed";
  }

  if (normalized === "EXPIRED") return "Expired";
  if (normalized === "CANCELLED" || normalized === "CANCELED")
    return "Cancelled";
  if (normalized === "INACTIVE") return "Inactive";

  return "Not Subscribed";
}

function valuationLabel(
  status: string | null | undefined,
  amount: number | null | undefined,
) {
  const normalized = normalizeStatus(status);

  if (normalized === "APPROVED" && amount)
    return `Official Value: ${peso(amount)}`;
  if (normalized === "APPROVED") return "Approved";
  if (normalized === "PENDING_ADMIN_VALUATION")
    return "Pending Admin Valuation";
  if (normalized === "PENDING" || normalized === "REQUESTED")
    return "Pending Admin Valuation";
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

function isCareInactive(tree: TreeDetail) {
  const care = normalizeStatus(tree.care_status);
  return (
    care === "INACTIVE" ||
    care === "EXPIRED" ||
    care === "CANCELLED" ||
    care === "CANCELED" ||
    care === ""
  );
}

function needsRecentUpdate(tree: TreeDetail) {
  const latest =
    tree.latest_photo_at ||
    tree.latest_gps_at ||
    tree.latest_health_at ||
    tree.updated_at ||
    tree.created_at;
  if (!latest) return true;

  const ageMs = Date.now() - new Date(latest).getTime();
  return ageMs > 1000 * 60 * 60 * 24 * 30;
}

function getTreeProtectionBucket(
  tree: TreeDetail,
): "CRITICAL" | "ATTENTION" | "PROTECTED" {
  const alert = normalizeStatus(tree.alert_status);
  const health = normalizeStatus(tree.latest_health_status);
  const issueSeverity = normalizeStatus(tree.latest_issue_severity);
  const care = normalizeStatus(tree.care_status);

  if (
    alert === "CRITICAL" ||
    health === "CRITICAL" ||
    issueSeverity === "CRITICAL" ||
    isCareInactive(tree)
  ) {
    return "CRITICAL";
  }

  if (
    alert === "ATTENTION" ||
    care === "PENDING" ||
    care === "PENDING_CARE" ||
    care === "PENDING_ACTIVATION" ||
    needsRecentUpdate(tree)
  ) {
    return "ATTENTION";
  }

  if (
    (care === "ACTIVE" || care === "SUBSCRIBED" || care === "PROTECTED") &&
    alert !== "CRITICAL"
  ) {
    return "PROTECTED";
  }

  return "ATTENTION";
}

function buildUniqueForests(
  forestRows: ForestSummary[],
  treeRows: TreeDetail[],
) {
  const byId = new Map<string, ForestSummary>();
  const rawNameCounts = new Map<string, number>();

  forestRows.forEach((forest) => {
    if (!forest.group_id || byId.has(forest.group_id)) return;

    const groupTrees = treeRows.filter(
      (tree) => tree.group_id === forest.group_id,
    );
    const protectedCount = groupTrees.filter(
      (tree) => getTreeProtectionBucket(tree) === "PROTECTED",
    ).length;
    const attentionCount = groupTrees.filter(
      (tree) => getTreeProtectionBucket(tree) === "ATTENTION",
    ).length;
    const criticalCount = groupTrees.filter(
      (tree) => getTreeProtectionBucket(tree) === "CRITICAL",
    ).length;
    const latestUpdate = groupTrees
      .map(
        (tree) =>
          tree.latest_photo_at ||
          tree.latest_gps_at ||
          tree.latest_health_at ||
          tree.updated_at ||
          tree.created_at,
      )
      .filter(Boolean)
      .sort()
      .pop();

    const rawName = forest.forest_name || "Unnamed Forest";
    const nextNameCount = (rawNameCounts.get(rawName) || 0) + 1;
    rawNameCounts.set(rawName, nextNameCount);

    byId.set(forest.group_id, {
      ...forest,
      display_forest_name:
        nextNameCount > 1 ? `${rawName} #${nextNameCount}` : rawName,
      total_trees: groupTrees.length || Number(forest.total_trees || 0),
      protected_count: protectedCount,
      attention_count: attentionCount,
      critical_count: criticalCount,
      updated_at: latestUpdate || forest.updated_at || forest.created_at,
    });
  });

  treeRows.forEach((tree) => {
    if (!tree.group_id || byId.has(tree.group_id)) return;

    const rawName = tree.forest_name || "Unnamed Forest";
    const nextNameCount = (rawNameCounts.get(rawName) || 0) + 1;
    rawNameCounts.set(rawName, nextNameCount);
    const groupTrees = treeRows.filter(
      (item) => item.group_id === tree.group_id,
    );

    byId.set(tree.group_id, {
      group_id: tree.group_id,
      customer_profile_id: tree.customer_profile_id,
      forest_name: rawName,
      display_forest_name:
        nextNameCount > 1 ? `${rawName} #${nextNameCount}` : rawName,
      total_trees: groupTrees.length,
      protected_count: groupTrees.filter(
        (item) => getTreeProtectionBucket(item) === "PROTECTED",
      ).length,
      attention_count: groupTrees.filter(
        (item) => getTreeProtectionBucket(item) === "ATTENTION",
      ).length,
      critical_count: groupTrees.filter(
        (item) => getTreeProtectionBucket(item) === "CRITICAL",
      ).length,
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
  const [selectedForestId, setSelectedForestId] = useState("");
  const [selectedTree, setSelectedTree] = useState<TreeDetail | null>(null);
  const [qrTree, setQrTree] = useState<TreeDetail | null>(null);
  const [renameTree, setRenameTree] = useState<TreeDetail | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [evidenceTree, setEvidenceTree] = useState<TreeDetail | null>(null);
  const [evidenceMode, setEvidenceMode] = useState<EvidenceMode>("PHOTOS");
  const [photoEvidence, setPhotoEvidence] = useState<PhotoEvidence[]>([]);
  const [gpsEvidence, setGpsEvidence] = useState<GpsEvidence[]>([]);
  const [healthEvidence, setHealthEvidence] = useState<HealthEvidence[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
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

    const nextTrees = (treeRows || []) as TreeDetail[];
    const nextForests = buildUniqueForests(
      (forestRows || []) as ForestSummary[],
      nextTrees,
    );

    setForests(nextForests);
    setTrees(nextTrees);

    const preferredForestId = keepSelectedForestId || selectedForestId;

    if (
      preferredForestId &&
      nextForests.some((forest) => forest.group_id === preferredForestId)
    ) {
      setSelectedForestId(preferredForestId);
    } else {
      setSelectedForestId(nextForests[0]?.group_id || "");
    }

    setSelectedTree((previous) => {
      if (!previous) return null;

      return (
        nextTrees.find((tree) => tree.tree_id === previous.tree_id) || null
      );
    });

    setLoading(false);
  }

  useEffect(() => {
    loadMyTrees();
  }, []);

  const totals = useMemo(() => {
    return forests.reduce(
      (sum, forest) => {
        sum.total += Number(forest.total_trees || 0);
        sum.protected += Number(forest.protected_count || 0);
        sum.attention += Number(forest.attention_count || 0);
        sum.critical += Number(forest.critical_count || 0);

        return sum;
      },
      {
        forests: forests.length,
        total: 0,
        protected: 0,
        attention: 0,
        critical: 0,
        pendingCare: trees.filter(
          (tree) => getTreeProtectionBucket(tree) !== "PROTECTED",
        ).length,
      },
    );
  }, [forests, trees]);

  const selectedForest = useMemo(() => {
    return (
      forests.find((forest) => forest.group_id === selectedForestId) || null
    );
  }, [forests, selectedForestId]);

  const selectedForestTrees = useMemo(() => {
    return trees.filter((tree) => tree.group_id === selectedForestId);
  }, [trees, selectedForestId]);

  const criticalTrees = useMemo(() => {
    return selectedForestTrees.filter(
      (tree) => getTreeProtectionBucket(tree) === "CRITICAL",
    );
  }, [selectedForestTrees]);

  const attentionTrees = useMemo(() => {
    return selectedForestTrees.filter(
      (tree) => getTreeProtectionBucket(tree) === "ATTENTION",
    );
  }, [selectedForestTrees]);

  const protectedTrees = useMemo(() => {
    return selectedForestTrees.filter(
      (tree) => getTreeProtectionBucket(tree) === "PROTECTED",
    );
  }, [selectedForestTrees]);

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
        .select("id, photo_url, image_url, caption, notes, status, created_at")
        .eq("tree_id", tree.tree_id)
        .order("created_at", { ascending: false });

      if (error) {
        setMessage(`Photo updates failed: ${error.message}`);
      } else {
        setPhotoEvidence((data || []) as PhotoEvidence[]);
      }
    }

    if (mode === "GPS") {
      const { data, error } = await supabase
        .from("tree_gps_logs")
        .select(
          "id, latitude, longitude, accuracy_meters, gps_url, map_url, location_note, notes, status, created_at",
        )
        .eq("tree_id", tree.tree_id)
        .order("created_at", { ascending: false });

      if (error) {
        setMessage(`GPS updates failed: ${error.message}`);
      } else {
        setGpsEvidence((data || []) as GpsEvidence[]);
      }
    }

    if (mode === "HEALTH") {
      const { data, error } = await supabase
        .from("tree_health_reports")
        .select(
          "id, health_status, issue_severity, issue_summary, report_notes, notes, status, created_at",
        )
        .eq("tree_id", tree.tree_id)
        .order("created_at", { ascending: false });

      if (error) {
        setMessage(`Health reports failed: ${error.message}`);
      } else {
        setHealthEvidence((data || []) as HealthEvidence[]);
      }
    }

    setLoadingEvidence(false);
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
      .update({
        custom_name: cleanName,
        updated_at: new Date().toISOString(),
      })
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

  function addTreesToForest(groupId: string) {
    window.location.href = `/dashboard/marketplace?group_id=${encodeURIComponent(groupId)}&mode=add_to_forest`;
  }

  function requestCare(tree: TreeDetail) {
    const params = new URLSearchParams();

    params.set("tree_id", tree.tree_id);

    if (tree.group_id) {
      params.set("group_id", tree.group_id);
    }

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
      .in("status", [
        "PENDING",
        "REQUESTED",
        "ASSIGNED",
        "INSPECTION_SUBMITTED",
      ])
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

    const { error: insertError } = await supabase
      .from("tree_valuation_requests")
      .insert({
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
      .update({
        valuation_status: "PENDING",
        valuation_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", tree.tree_id)
      .eq("customer_profile_id", profile.id);

    await loadMyTrees(selectedForestId);
    setMessage(
      "Valuation requested. Admin will assign a gardener for inspection.",
    );
    setActionLoading(false);
  }

  function renderTreePremiumCard(tree: TreeDetail) {
    return (
      <button
        className={`treeCard ${alertClass(tree.alert_status)}`}
        key={tree.tree_id}
        onClick={() => setSelectedTree(tree)}
      >
        <div className="treeCardTop">
          <span>{alertIcon(tree.alert_status)}</span>
          <small>{alertLabel(tree.alert_status)}</small>
        </div>

        <b>{customerTreeName(tree)}</b>
        <code>{tree.tree_code || "No tree code yet"}</code>
        <p>{tree.alert_reason || alertLabel(tree.alert_status)}</p>

        <div className="treeCardMeta">
          <span>{careLabel(tree.care_status)}</span>
          <span>
            {formatShortDate(
              tree.latest_health_at ||
                tree.latest_photo_at ||
                tree.latest_gps_at,
            )}
          </span>
        </div>
      </button>
    );
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="heroCopy">
          <Link href="/dashboard" className="back">
            ← Back to Dashboard
          </Link>

          <p className="eyebrow">Arganwood V6 Forest Command</p>
          <h1>My Forests</h1>
          <span>
            Monitor every forest at a glance. Protected trees stay green,
            attention trees need follow-up, and critical trees require care
            before they can be considered protected.
          </span>

          <div className="heroActions">
            <Link href="/dashboard/marketplace">Buy Trees</Link>
            <Link href="/dashboard/tree-operations">Request Care</Link>
          </div>
        </div>

        <div className="forestHeroCard">
          <div className="forestHeroGlow" />
          <p>Forest Protection Overview</p>
          <strong>{totals.total}</strong>
          <span>Total Trees Managed</span>

          <div className="heroMiniStats">
            <div>
              <small>Total Forests</small>
              <b>{totals.forests}</b>
            </div>
            <div>
              <small>Protected</small>
              <b>{totals.protected}</b>
            </div>
            <div>
              <small>Attention</small>
              <b>{totals.attention}</b>
            </div>
            <div>
              <small>Critical</small>
              <b>{totals.critical}</b>
            </div>
            <div>
              <small>Pending Care</small>
              <b>{totals.pendingCare}</b>
            </div>
          </div>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      {loading ? (
        <div className="empty">Loading your forests...</div>
      ) : forests.length === 0 ? (
        <section className="emptyState">
          <div className="emptyIcon">🌳</div>
          <p className="eyebrow">No forest yet</p>
          <h2>Create your first forest</h2>
          <p>
            Buy trees from Marketplace and choose Create New Forest. Your trees
            will appear here as friendly names like Seedling 1, Seedling 2, and
            Seedling 3.
          </p>
          <Link href="/dashboard/marketplace">Go to Marketplace</Link>
        </section>
      ) : (
        <>
          <section className="forestGrid">
            {forests.map((forest) => {
              const isActive = selectedForestId === forest.group_id;

              return (
                <article
                  key={forest.group_id}
                  className={isActive ? "forestCard active" : "forestCard"}
                >
                  <div className="forestTop">
                    <div>
                      <small>🌳 Forest</small>
                      <b>{forestName(forest)}</b>
                    </div>
                    <span>{Number(forest.total_trees || 0)} Trees</span>
                  </div>

                  <div className="forestCounts">
                    <div className="protected">
                      <small>Protected</small>
                      <b>{Number(forest.protected_count || 0)}</b>
                    </div>
                    <div className="attention">
                      <small>Attention</small>
                      <b>{Number(forest.attention_count || 0)}</b>
                    </div>
                    <div className="critical">
                      <small>Critical</small>
                      <b>{Number(forest.critical_count || 0)}</b>
                    </div>
                  </div>

                  <div className="forestMetaLine">
                    Latest update:{" "}
                    {formatShortDate(forest.updated_at || forest.created_at)}
                  </div>

                  <div className="forestCardActions">
                    <button
                      type="button"
                      onClick={() => setSelectedForestId(forest.group_id)}
                    >
                      Open Forest
                    </button>
                    <Link
                      href={`/dashboard/tree-operations?group_id=${forest.group_id}`}
                    >
                      Request Care
                    </Link>
                    <button
                      type="button"
                      onClick={() => addTreesToForest(forest.group_id)}
                    >
                      Add Trees
                    </button>
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
                    {Number(selectedForest.total_trees || 0)} trees •{" "}
                    {Number(selectedForest.protected_count || 0)} protected •{" "}
                    {Number(selectedForest.attention_count || 0)} attention •{" "}
                    {Number(selectedForest.critical_count || 0)} critical
                  </span>
                </div>

                <div className="forestHeadActions">
                  <Link
                    href={`/dashboard/tree-operations?group_id=${selectedForest.group_id}`}
                  >
                    Request Care
                  </Link>
                  <Link
                    href={`/dashboard/marketplace?group_id=${selectedForest.group_id}&mode=add_to_forest`}
                  >
                    Add Trees
                  </Link>
                </div>
              </div>

              <div className="treeSections">
                <section className="treeSection criticalBox">
                  <div className="treeSectionHead">
                    <b>🔴 Critical Trees</b>
                    <span>{criticalTrees.length}</span>
                  </div>

                  {criticalTrees.length === 0 ? (
                    <div className="softEmpty">No critical trees.</div>
                  ) : (
                    <div className="treeList">
                      {criticalTrees.map(renderTreePremiumCard)}
                    </div>
                  )}
                </section>

                <section className="treeSection attentionBox">
                  <div className="treeSectionHead">
                    <b>🟡 Needs Attention</b>
                    <span>{attentionTrees.length}</span>
                  </div>

                  {attentionTrees.length === 0 ? (
                    <div className="softEmpty">No attention warnings.</div>
                  ) : (
                    <div className="treeList">
                      {attentionTrees.map(renderTreePremiumCard)}
                    </div>
                  )}
                </section>

                <section className="treeSection protectedBox">
                  <div className="treeSectionHead">
                    <b>🟢 Protected Trees</b>
                    <span>{protectedTrees.length}</span>
                  </div>

                  {protectedTrees.length === 0 ? (
                    <div className="softEmpty">No protected trees yet.</div>
                  ) : (
                    <div className="treeList">
                      {protectedTrees.map(renderTreePremiumCard)}
                    </div>
                  )}
                </section>
              </div>
            </section>
          )}
        </>
      )}

      {selectedTree && (
        <div className="modalOverlay" onClick={() => setSelectedTree(null)}>
          <div
            className="modal treeDetailModal"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="closeBtn" onClick={() => setSelectedTree(null)}>
              ×
            </button>

            <div
              className={`detailStatus ${alertClass(selectedTree.alert_status)}`}
            >
              <span>{alertIcon(selectedTree.alert_status)}</span>
              <b>{alertLabel(selectedTree.alert_status)}</b>
            </div>

            <p className="eyebrow">Tree Detail</p>
            <h2>{customerTreeName(selectedTree)}</h2>
            <p className="detailSubtitle">{treeForestName(selectedTree)}</p>

            <div className="detailGrid">
              <div>
                <small>Care Status</small>
                <b>{careLabel(selectedTree.care_status)}</b>
              </div>
              <div>
                <small>Alert Reason</small>
                <b>
                  {selectedTree.alert_reason ||
                    alertLabel(selectedTree.alert_status)}
                </b>
              </div>
              <div>
                <small>Last Photo</small>
                <b>{formatShortDate(selectedTree.latest_photo_at)}</b>
              </div>
              <div>
                <small>Last GPS</small>
                <b>{formatShortDate(selectedTree.latest_gps_at)}</b>
              </div>
              <div>
                <small>Last Health Report</small>
                <b>
                  {selectedTree.latest_health_status ||
                    formatShortDate(selectedTree.latest_health_at)}
                </b>
              </div>
              <div>
                <small>Valuation</small>
                <b>
                  {valuationLabel(
                    selectedTree.valuation_status,
                    selectedTree.official_valuation_amount,
                  )}
                </b>
              </div>
            </div>

            {selectedTree.latest_issue_summary && (
              <div className="warningNote">
                <b>Health Note</b>
                <p>{selectedTree.latest_issue_summary}</p>
              </div>
            )}

            <div className="actionGrid">
              <button onClick={() => openEvidence(selectedTree, "PHOTOS")}>
                View Photos
              </button>
              <button onClick={() => openEvidence(selectedTree, "GPS")}>
                View GPS
              </button>
              <button onClick={() => openEvidence(selectedTree, "HEALTH")}>
                View Health
              </button>
              <button onClick={() => requestCare(selectedTree)}>
                Request Care
              </button>
              <button
                disabled={actionLoading}
                onClick={() => requestValuation(selectedTree)}
              >
                Request Valuation
              </button>
              <button onClick={() => setQrTree(selectedTree)}>View QR</button>
              <button onClick={() => startRename(selectedTree)}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {qrTree && (
        <div className="modalOverlay" onClick={() => setQrTree(null)}>
          <div
            className="modal qrModal"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="closeBtn" onClick={() => setQrTree(null)}>
              ×
            </button>

            <div className="tagCard">
              <p>ARGANWOOD TREE TAG</p>
              <div className="tagRows">
                <div>
                  <small>Customer</small>
                  <b>
                    {profile?.full_name || profile?.display_name || "Customer"}
                  </b>
                </div>
                <div>
                  <small>Forest</small>
                  <b>{treeForestName(qrTree)}</b>
                </div>
                <div>
                  <small>Tree</small>
                  <b>{customerTreeName(qrTree)}</b>
                </div>
                <div>
                  <small>Care</small>
                  <b>{careLabel(qrTree.care_status)}</b>
                </div>
              </div>

              <div className="qrBox">
                <QRCodeCanvas
                  value={getQrValue(qrTree)}
                  size={214}
                  includeMargin
                />
              </div>

              <small className="qrHint">Scan to verify this tree.</small>
            </div>
          </div>
        </div>
      )}

      {renameTree && (
        <div className="modalOverlay" onClick={() => setRenameTree(null)}>
          <div
            className="modal renameModal"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="closeBtn" onClick={() => setRenameTree(null)}>
              ×
            </button>

            <p className="eyebrow">Friendly Name</p>
            <h2>Rename Tree</h2>
            <p className="detailSubtitle">
              This changes the customer-visible name only. QR identity stays the
              same.
            </p>

            <label className="fieldLabel">
              Tree Name
              <input
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                placeholder="Seedling 1"
              />
            </label>

            <button
              className="primaryBtn"
              disabled={actionLoading}
              onClick={saveRename}
            >
              {actionLoading ? "Saving..." : "Save Name"}
            </button>
          </div>
        </div>
      )}

      {evidenceTree && (
        <div className="modalOverlay" onClick={() => setEvidenceTree(null)}>
          <div
            className="modal evidenceModal"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="closeBtn" onClick={() => setEvidenceTree(null)}>
              ×
            </button>

            <p className="eyebrow">{evidenceMode}</p>
            <h2>{customerTreeName(evidenceTree)}</h2>
            <p className="detailSubtitle">{treeForestName(evidenceTree)}</p>

            {loadingEvidence ? (
              <div className="softEmpty">Loading evidence...</div>
            ) : (
              <>
                {evidenceMode === "PHOTOS" && (
                  <div className="evidenceList">
                    {photoEvidence.length === 0 ? (
                      <div className="softEmpty">No photo updates yet.</div>
                    ) : (
                      photoEvidence.map((item) => {
                        const src = item.photo_url || item.image_url || "";

                        return (
                          <article className="evidenceCard" key={item.id}>
                            {src ? (
                              <img
                                src={src}
                                alt={item.caption || "Tree photo update"}
                              />
                            ) : (
                              <div className="imageFallback">🌳</div>
                            )}
                            <div>
                              <b>
                                {item.caption || item.status || "Photo Update"}
                              </b>
                              <small>{formatDate(item.created_at)}</small>
                              <p>{item.notes || "No notes provided."}</p>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                )}

                {evidenceMode === "GPS" && (
                  <div className="evidenceList">
                    {gpsEvidence.length === 0 ? (
                      <div className="softEmpty">No GPS updates yet.</div>
                    ) : (
                      gpsEvidence.map((item) => {
                        const mapLink = getMapLink(item);

                        return (
                          <article
                            className="evidenceCard gpsCard"
                            key={item.id}
                          >
                            <div className="gpsIcon">📍</div>
                            <div>
                              <b>
                                {item.location_note ||
                                  item.status ||
                                  "GPS Update"}
                              </b>
                              <small>{formatDate(item.created_at)}</small>
                              <p>
                                {item.latitude && item.longitude
                                  ? `${item.latitude}, ${item.longitude}`
                                  : item.notes || "Coordinates not provided."}
                              </p>
                              {mapLink && (
                                <a
                                  href={mapLink}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open Map
                                </a>
                              )}
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                )}

                {evidenceMode === "HEALTH" && (
                  <div className="evidenceList">
                    {healthEvidence.length === 0 ? (
                      <div className="softEmpty">No health reports yet.</div>
                    ) : (
                      healthEvidence.map((item) => (
                        <article
                          className="evidenceCard healthCard"
                          key={item.id}
                        >
                          <div className="gpsIcon">💚</div>
                          <div>
                            <b>{item.health_status || "Health Report"}</b>
                            <small>{formatDate(item.created_at)}</small>
                            <p>
                              {item.issue_summary ||
                                item.report_notes ||
                                item.notes ||
                                "No health notes provided."}
                            </p>
                            {item.issue_severity && (
                              <span className="severity">
                                {item.issue_severity}
                              </span>
                            )}
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
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
            radial-gradient(circle at 15% 5%, rgba(220, 176, 88, .24), transparent 28%),
            radial-gradient(circle at 86% 0%, rgba(85, 132, 93, .22), transparent 30%),
            radial-gradient(circle at 50% 90%, rgba(218, 173, 82, .12), transparent 34%),
            linear-gradient(180deg, #07130d 0%, #0b1f15 45%, #06100b 100%);
        }

        .hero {
          display: grid;
          grid-template-columns: 1fr 430px;
          gap: 22px;
          align-items: stretch;
          margin-bottom: 22px;
        }

        .heroCopy,
        .forestHeroCard,
        .message,
        .empty,
        .forestCard,
        .forestDetail,
        .emptyState {
          border: 1px solid rgba(232, 190, 103, .18);
          background:
            linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.03)),
            rgba(7, 24, 15, .82);
          box-shadow: 0 24px 70px rgba(0,0,0,.32);
          backdrop-filter: blur(10px);
        }

        .heroCopy {
          border-radius: 34px;
          min-height: 330px;
          padding: 28px;
          position: relative;
          overflow: hidden;
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
          z-index: -2;
        }

        .heroCopy:after {
          content: "";
          position: absolute;
          width: 300px;
          height: 300px;
          right: -90px;
          bottom: -120px;
          border-radius: 50%;
          background: rgba(232, 190, 103, .20);
          filter: blur(8px);
          z-index: -1;
        }

        .back {
          display: inline-flex;
          margin-bottom: 18px;
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

        h1 {
          margin: 0;
          color: #fff7df;
          font-size: 58px;
          letter-spacing: -2.4px;
          line-height: .95;
        }

        .heroCopy span {
          display: block;
          margin-top: 16px;
          max-width: 760px;
          color: rgba(255,247,223,.78);
          font-weight: 800;
          line-height: 1.65;
        }

        .heroActions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 26px;
        }

        .heroActions a,
        .forestHeadActions a,
        .emptyState a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          padding: 14px 18px;
          color: #08120d;
          background: linear-gradient(135deg, #f4d58b, #c99536);
          text-decoration: none;
          font-weight: 900;
          box-shadow: 0 16px 34px rgba(201, 149, 54, .20);
        }

        .heroActions a:last-child,
        .forestHeadActions a:first-child {
          color: #fff7df;
          background: rgba(255,255,255,.10);
          border: 1px solid rgba(232, 190, 103, .22);
          box-shadow: none;
        }

        .forestHeroCard {
          border-radius: 34px;
          padding: 26px;
          position: relative;
          overflow: hidden;
        }

        .forestHeroGlow {
          position: absolute;
          width: 220px;
          height: 220px;
          right: -80px;
          top: -80px;
          border-radius: 50%;
          background: rgba(232,190,103,.24);
          filter: blur(4px);
        }

        .forestHeroCard p {
          margin: 0;
          color: rgba(255,247,223,.72);
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .13em;
        }

        .forestHeroCard strong {
          display: block;
          margin-top: 22px;
          color: #f4d58b;
          font-size: 84px;
          line-height: .9;
          letter-spacing: -4px;
        }

        .forestHeroCard > span {
          display: block;
          margin-top: 8px;
          color: rgba(255,247,223,.78);
          font-weight: 900;
        }

        .heroMiniStats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 26px;
        }

        .heroMiniStats div {
          border-radius: 20px;
          padding: 14px;
          background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.08);
        }

        .heroMiniStats small {
          display: block;
          color: rgba(255,247,223,.58);
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .10em;
          margin-bottom: 6px;
        }

        .heroMiniStats b {
          display: block;
          color: #fff7df;
          font-size: 28px;
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
          min-height: 440px;
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
          max-width: 600px;
          color: rgba(255,247,223,.72);
          font-weight: 800;
          line-height: 1.65;
        }

        .emptyIcon {
          font-size: 72px;
          margin-bottom: 10px;
        }

        .forestGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
        }

        .forestCard {
          border-radius: 28px;
          cursor: pointer;
          text-align: left;
          padding: 18px;
          transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
        }

        .forestCard:hover,
        .forestCard.active {
          transform: translateY(-3px);
          border-color: rgba(232,190,103,.46);
          box-shadow: 0 28px 70px rgba(0,0,0,.40);
        }

        .forestCard.active {
          background:
            radial-gradient(circle at 90% 8%, rgba(232,190,103,.22), transparent 28%),
            linear-gradient(135deg, rgba(255,255,255,.10), rgba(255,255,255,.04)),
            rgba(9, 30, 19, .94);
        }

        .forestTop {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .forestTop small {
          display: block;
          color: #e8be67;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .10em;
          margin-bottom: 6px;
        }

        .forestTop b {
          display: block;
          color: #fff7df;
          font-size: 24px;
          line-height: 1.12;
        }

        .forestTop span {
          white-space: nowrap;
          border-radius: 999px;
          padding: 8px 11px;
          color: #08120d;
          background: #f4d58b;
          font-size: 12px;
          font-weight: 900;
        }

        .forestCounts {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .forestCounts div {
          border-radius: 18px;
          padding: 12px;
          background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.08);
        }

        .forestCounts small {
          display: block;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .08em;
          margin-bottom: 5px;
        }

        .forestCounts b {
          font-size: 22px;
        }


        .forestMetaLine {
          margin-top: 12px;
          color: rgba(255,247,223,.68);
          font-size: 12px;
          font-weight: 800;
        }

        .forestCardActions {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-top: 14px;
        }

        .forestCardActions button,
        .forestCardActions a {
          border: 0;
          border-radius: 14px;
          padding: 10px 8px;
          text-align: center;
          text-decoration: none;
          background: rgba(232,190,103,.16);
          color: #f4d58b;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
        }

        .protected small,
        .protected b {
          color: #8df0a4;
        }

        .attention small,
        .attention b {
          color: #f4d58b;
        }

        .critical small,
        .critical b {
          color: #ff9a88;
        }

        .forestDetail {
          border-radius: 34px;
          padding: 22px;
        }

        .forestDetailHead {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          margin-bottom: 20px;
        }

        .forestDetailHead h2 {
          margin: 0;
          color: #fff7df;
          font-size: 38px;
          letter-spacing: -1.2px;
        }

        .forestDetailHead span {
          display: block;
          margin-top: 7px;
          color: rgba(255,247,223,.68);
          font-weight: 900;
        }

        .forestHeadActions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 10px;
        }

        .treeSections {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          align-items: start;
        }

        .treeSection {
          border-radius: 26px;
          padding: 14px;
          min-height: 260px;
        }

        .criticalBox {
          background: linear-gradient(180deg, rgba(255,120,96,.13), rgba(255,120,96,.04));
          border: 1px solid rgba(255,120,96,.18);
        }

        .attentionBox {
          background: linear-gradient(180deg, rgba(244,213,139,.14), rgba(244,213,139,.04));
          border: 1px solid rgba(244,213,139,.18);
        }

        .protectedBox {
          background: linear-gradient(180deg, rgba(121,225,146,.12), rgba(121,225,146,.04));
          border: 1px solid rgba(121,225,146,.18);
        }

        .treeSectionHead {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 12px;
        }

        .treeSectionHead b {
          color: #fff7df;
          font-size: 18px;
        }

        .treeSectionHead span {
          display: inline-grid;
          place-items: center;
          min-width: 31px;
          height: 31px;
          border-radius: 999px;
          color: #08120d;
          background: #f4d58b;
          font-size: 12px;
          font-weight: 900;
        }

        .treeList {
          display: grid;
          gap: 10px;
        }

        .treeCard {
          width: 100%;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 22px;
          padding: 14px;
          text-align: left;
          cursor: pointer;
          background:
            linear-gradient(135deg, rgba(255,255,255,.10), rgba(255,255,255,.04)),
            rgba(8, 23, 15, .78);
          box-shadow: 0 14px 30px rgba(0,0,0,.20);
          transition: transform .18s ease, border-color .18s ease;
        }

        .treeCard:hover {
          transform: translateY(-2px);
          border-color: rgba(232,190,103,.38);
        }

        .treeCardTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 12px;
        }

        .treeCardTop span {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          border-radius: 16px;
          background: rgba(255,255,255,.08);
        }

        .treeCardTop small {
          border-radius: 999px;
          padding: 7px 10px;
          background: rgba(255,255,255,.08);
          color: rgba(255,247,223,.75);
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .treeCard b {
          display: block;
          color: #fff7df;
          font-size: 18px;
          margin-bottom: 6px;
        }

        .treeCard p {
          min-height: 38px;
          margin: 0;
          color: rgba(255,247,223,.66);
          font-weight: 800;
          line-height: 1.45;
        }

        .treeCardMeta {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: center;
          margin-top: 12px;
        }

        .treeCardMeta span {
          color: rgba(255,247,223,.62);
          font-size: 11px;
          font-weight: 900;
        }

        .treeCard.critical {
          border-color: rgba(255,120,96,.26);
        }

        .treeCard.attention {
          border-color: rgba(244,213,139,.24);
        }

        .treeCard.protected {
          border-color: rgba(121,225,146,.22);
        }

        .softEmpty {
          border-radius: 20px;
          padding: 16px;
          color: rgba(255,247,223,.62);
          background: rgba(255,255,255,.06);
          font-weight: 900;
          text-align: center;
        }

        .modalOverlay {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(3, 10, 7, .72);
          backdrop-filter: blur(9px);
        }

        .modal {
          position: relative;
          width: min(770px, 100%);
          max-height: 92vh;
          overflow: auto;
          border-radius: 34px;
          padding: 26px;
          color: #fff7df;
          background:
            radial-gradient(circle at 90% 8%, rgba(232,190,103,.20), transparent 30%),
            linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.03)),
            #07180f;
          box-shadow: 0 34px 100px rgba(0,0,0,.52);
          border: 1px solid rgba(232,190,103,.18);
        }

        .closeBtn {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 42px;
          height: 42px;
          border: 0;
          border-radius: 999px;
          background: rgba(255,255,255,.10);
          color: #f4d58b;
          font-size: 26px;
          font-weight: 900;
          cursor: pointer;
        }

        .detailStatus {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 9px 12px;
          margin-bottom: 14px;
          font-size: 13px;
          font-weight: 900;
        }

        .detailStatus.protected {
          background: rgba(121,225,146,.14);
          color: #8df0a4;
        }

        .detailStatus.attention {
          background: rgba(244,213,139,.14);
          color: #f4d58b;
        }

        .detailStatus.critical {
          background: rgba(255,120,96,.14);
          color: #ff9a88;
        }

        .modal h2 {
          margin: 0;
          color: #fff7df;
          font-size: 38px;
          letter-spacing: -1px;
        }

        .detailSubtitle {
          margin: 8px 0 18px;
          color: rgba(255,247,223,.66);
          font-weight: 900;
        }

        .detailGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin: 18px 0;
        }

        .detailGrid div {
          border-radius: 18px;
          padding: 14px;
          background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.08);
        }

        .detailGrid small,
        .tagRows small,
        .fieldLabel {
          display: block;
          color: #e8be67;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .09em;
          margin-bottom: 5px;
        }

        .detailGrid b,
        .tagRows b {
          display: block;
          color: #fff7df;
          font-size: 15px;
          line-height: 1.35;
        }

        .warningNote {
          border-radius: 18px;
          padding: 14px;
          margin: 0 0 18px;
          background: rgba(255,120,96,.10);
          border: 1px solid rgba(255,120,96,.16);
        }

        .warningNote b {
          color: #ff9a88;
        }

        .warningNote p {
          margin: 6px 0 0;
          color: rgba(255,247,223,.74);
          font-weight: 800;
          line-height: 1.5;
        }

        .actionGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .actionGrid button,
        .primaryBtn {
          border: 0;
          border-radius: 16px;
          padding: 14px;
          color: #08120d;
          background: linear-gradient(135deg, #f4d58b, #c99536);
          font-weight: 900;
          cursor: pointer;
        }

        .actionGrid button:nth-child(odd) {
          color: #fff7df;
          background: rgba(255,255,255,.10);
          border: 1px solid rgba(232,190,103,.20);
        }

        .actionGrid button:disabled,
        .primaryBtn:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .qrModal {
          width: min(470px, 100%);
        }

        .tagCard {
          border-radius: 28px;
          padding: 22px;
          text-align: center;
          background:
            radial-gradient(circle at 50% 0%, rgba(232,190,103,.22), transparent 30%),
            rgba(255,255,255,.06);
          border: 1px solid rgba(232,190,103,.20);
        }

        .tagCard p {
          margin: 0 0 16px;
          color: #f4d58b;
          font-size: 18px;
          font-weight: 900;
          letter-spacing: .10em;
        }

        .tagRows {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 18px;
          text-align: left;
        }

        .tagRows div {
          border-radius: 16px;
          padding: 12px;
          background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.08);
        }

        .qrBox {
          display: inline-grid;
          place-items: center;
          padding: 14px;
          border-radius: 22px;
          background: white;
          box-shadow: 0 14px 38px rgba(0,0,0,.28);
        }

        .qrHint {
          display: block;
          margin-top: 12px;
          color: rgba(255,247,223,.64);
          font-weight: 900;
        }

        .fieldLabel {
          display: grid;
          gap: 8px;
          margin: 18px 0;
        }

        .fieldLabel input {
          width: 100%;
          border: 1px solid rgba(232,190,103,.20);
          border-radius: 16px;
          padding: 14px;
          background: rgba(255,255,255,.08);
          color: #fff7df;
          outline: none;
          font-size: 16px;
          font-weight: 900;
          text-transform: none;
          letter-spacing: 0;
        }

        .evidenceList {
          display: grid;
          gap: 12px;
        }

        .evidenceCard {
          display: grid;
          grid-template-columns: 130px 1fr;
          gap: 14px;
          border-radius: 22px;
          padding: 12px;
          background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.08);
          align-items: center;
        }

        .evidenceCard img,
        .imageFallback {
          width: 130px;
          height: 100px;
          border-radius: 18px;
          object-fit: cover;
          background: rgba(255,255,255,.08);
          display: grid;
          place-items: center;
          font-size: 36px;
        }

        .evidenceCard b {
          display: block;
          color: #fff7df;
          font-size: 18px;
        }

        .evidenceCard small {
          display: block;
          margin-top: 4px;
          color: #e8be67;
          font-weight: 900;
        }

        .evidenceCard p {
          margin: 8px 0 0;
          color: rgba(255,247,223,.66);
          font-weight: 800;
          line-height: 1.5;
        }

        .evidenceCard a {
          display: inline-flex;
          margin-top: 8px;
          color: #f4d58b;
          font-weight: 900;
        }

        .gpsIcon {
          display: grid;
          place-items: center;
          width: 74px;
          height: 74px;
          border-radius: 24px;
          background: rgba(255,255,255,.08);
          font-size: 36px;
        }

        .gpsCard,
        .healthCard {
          grid-template-columns: 74px 1fr;
        }

        .severity {
          display: inline-flex;
          margin-top: 8px;
          border-radius: 999px;
          padding: 7px 10px;
          color: #ff9a88;
          background: rgba(255,120,96,.12);
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        @media (max-width: 1180px) {
          .hero,
          .forestGrid,
          .treeSections {
            grid-template-columns: 1fr;
          }

          .forestHeroCard strong {
            font-size: 66px;
          }
        }

        @media (max-width: 760px) {
          .page {
            padding: 18px;
          }

          h1 {
            font-size: 42px;
          }

          .heroMiniStats,
          .forestCounts,
          .forestDetailHead,
          .detailGrid,
          .actionGrid,
          .tagRows,
          .evidenceCard,
          .gpsCard,
          .healthCard {
            display: grid;
            grid-template-columns: 1fr;
          }

          .forestDetailHead {
            align-items: start;
          }

          .forestHeadActions,
          .heroActions {
            display: grid;
            grid-template-columns: 1fr;
            width: 100%;
          }

          .evidenceCard img,
          .imageFallback {
            width: 100%;
            height: 180px;
          }
        }
      `}</style>
    </main>
  );
}
