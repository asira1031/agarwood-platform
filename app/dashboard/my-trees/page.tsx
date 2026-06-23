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
  return tree?.custom_name || tree?.customer_tree_name || tree?.display_name || "Seedling";
}

function forestName(forest: ForestSummary | null | undefined) {
  return forest?.forest_name || "Unnamed Forest";
}

function treeForestName(tree: TreeDetail | null | undefined) {
  return tree?.forest_name || "Unnamed Forest";
}

function alertLabel(status: AlertStatus | null | undefined) {
  const normalized = normalizeStatus(status);

  if (normalized === "PROTECTED") return "Protected";
  if (normalized === "ATTENTION") return "Attention";
  if (normalized === "CRITICAL") return "Critical";

  return "Attention";
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

  if (normalized === "ACTIVE" || normalized === "SUBSCRIBED" || normalized === "PROTECTED") {
    return "Subscribed";
  }

  if (normalized === "EXPIRED") return "Expired";
  if (normalized === "CANCELLED" || normalized === "CANCELED") return "Cancelled";
  if (normalized === "INACTIVE") return "Inactive";

  return "Not Subscribed";
}

function valuationLabel(status: string | null | undefined, amount: number | null | undefined) {
  const normalized = normalizeStatus(status);

  if (normalized === "APPROVED" && amount) return `Official Value: ${peso(amount)}`;
  if (normalized === "APPROVED") return "Approved";
  if (normalized === "PENDING_ADMIN_VALUATION") return "Pending Admin Valuation";
  if (normalized === "PENDING" || normalized === "REQUESTED") return "Pending Admin Valuation";
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

    const nextForests = (forestRows || []) as ForestSummary[];
    const nextTrees = (treeRows || []) as TreeDetail[];

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
        total: 0,
        protected: 0,
        attention: 0,
        critical: 0,
      }
    );
  }, [forests]);

  const selectedForest = useMemo(() => {
    return forests.find((forest) => forest.group_id === selectedForestId) || null;
  }, [forests, selectedForestId]);

  const selectedForestTrees = useMemo(() => {
    return trees.filter((tree) => tree.group_id === selectedForestId);
  }, [trees, selectedForestId]);

  const criticalTrees = useMemo(() => {
    return selectedForestTrees.filter((tree) => normalizeStatus(tree.alert_status) === "CRITICAL");
  }, [selectedForestTrees]);

  const attentionTrees = useMemo(() => {
    return selectedForestTrees.filter((tree) => normalizeStatus(tree.alert_status) === "ATTENTION");
  }, [selectedForestTrees]);

  const protectedTrees = useMemo(() => {
    return selectedForestTrees.filter((tree) => normalizeStatus(tree.alert_status) === "PROTECTED");
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
        .select("id, latitude, longitude, accuracy_meters, gps_url, map_url, location_note, notes, status, created_at")
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
        .select("id, health_status, issue_severity, issue_summary, report_notes, notes, status, created_at")
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
      .update({
        valuation_status: "PENDING",
        valuation_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", tree.tree_id)
      .eq("customer_profile_id", profile.id);

    await loadMyTrees(selectedForestId);
    setMessage("Valuation requested. Admin will assign a gardener for inspection.");
    setActionLoading(false);
  }

  function renderTreeMiniCard(tree: TreeDetail) {
    return (
      <button className={`treeMini ${alertClass(tree.alert_status)}`} key={tree.tree_id} onClick={() => setSelectedTree(tree)}>
        <span className="treeMiniIcon">{alertIcon(tree.alert_status)}</span>
        <span>
          <b>{customerTreeName(tree)}</b>
          <small>{tree.alert_reason || alertLabel(tree.alert_status)}</small>
        </span>
      </button>
    );
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <Link href="/dashboard" className="back">
            ← Back to Dashboard
          </Link>

          <p className="eyebrow">Arganwood V6 Forest View</p>
          <h1>My Forests</h1>
          <span>
            Your trees are grouped by forest. Open a forest to see which seedlings are protected, need attention, or are critical.
          </span>
        </div>

        <div className="heroStats">
          <div>
            <small>Total Trees</small>
            <b>{totals.total}</b>
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
            Buy trees from Marketplace and choose Create New Forest. Your trees will appear here as friendly names like
            Seedling 1, Seedling 2, and Seedling 3.
          </p>
          <Link href="/dashboard/marketplace">Go to Marketplace</Link>
        </section>
      ) : (
        <>
          <section className="forestGrid">
            {forests.map((forest) => {
              const isActive = selectedForestId === forest.group_id;

              return (
                <button
                  key={forest.group_id}
                  className={isActive ? "forestCard active" : "forestCard"}
                  onClick={() => setSelectedForestId(forest.group_id)}
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
                </button>
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
                    {Number(selectedForest.total_trees || 0)} trees • {Number(selectedForest.protected_count || 0)} protected •{" "}
                    {Number(selectedForest.attention_count || 0)} attention • {Number(selectedForest.critical_count || 0)} critical
                  </span>
                </div>

                <Link href="/dashboard/marketplace" className="addTreeBtn">
                  Add Trees
                </Link>
              </div>

              <div className="treeSections">
                <section className="treeSection criticalBox">
                  <div className="treeSectionHead">
                    <b>🔴 Critical</b>
                    <span>{criticalTrees.length}</span>
                  </div>

                  {criticalTrees.length === 0 ? (
                    <div className="softEmpty">No critical trees.</div>
                  ) : (
                    <div className="treeList">{criticalTrees.map(renderTreeMiniCard)}</div>
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
                    <div className="treeList">{attentionTrees.map(renderTreeMiniCard)}</div>
                  )}
                </section>

                <section className="treeSection protectedBox">
                  <div className="treeSectionHead">
                    <b>🟢 Protected / Healthy</b>
                    <span>{protectedTrees.length}</span>
                  </div>

                  {protectedTrees.length === 0 ? (
                    <div className="softEmpty">No protected trees yet.</div>
                  ) : (
                    <div className="treeList">{protectedTrees.map(renderTreeMiniCard)}</div>
                  )}
                </section>
              </div>
            </section>
          )}
        </>
      )}

      {selectedTree && (
        <div className="modalOverlay" onClick={() => setSelectedTree(null)}>
          <div className="modal treeDetailModal" onClick={(event) => event.stopPropagation()}>
            <button className="closeBtn" onClick={() => setSelectedTree(null)}>
              ×
            </button>

            <div className={`detailStatus ${alertClass(selectedTree.alert_status)}`}>
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
                <b>{selectedTree.alert_reason || alertLabel(selectedTree.alert_status)}</b>
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
                <b>{selectedTree.latest_health_status || formatShortDate(selectedTree.latest_health_at)}</b>
              </div>
              <div>
                <small>Valuation</small>
                <b>{valuationLabel(selectedTree.valuation_status, selectedTree.official_valuation_amount)}</b>
              </div>
            </div>

            {selectedTree.latest_issue_summary && (
              <div className="warningNote">
                <b>Health Note</b>
                <p>{selectedTree.latest_issue_summary}</p>
              </div>
            )}

            <div className="actionGrid">
              <button onClick={() => openEvidence(selectedTree, "PHOTOS")}>View Photos</button>
              <button onClick={() => openEvidence(selectedTree, "GPS")}>View GPS</button>
              <button onClick={() => openEvidence(selectedTree, "HEALTH")}>View Health</button>
              <button onClick={() => requestCare(selectedTree)}>Request Care</button>
              <button disabled={actionLoading} onClick={() => requestValuation(selectedTree)}>
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
          <div className="modal qrModal" onClick={(event) => event.stopPropagation()}>
            <button className="closeBtn" onClick={() => setQrTree(null)}>
              ×
            </button>

            <div className="tagCard">
              <p>ARGANWOOD TREE TAG</p>
              <div className="tagRows">
                <div>
                  <small>Customer</small>
                  <b>{profile?.full_name || profile?.display_name || "Customer"}</b>
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
                <QRCodeCanvas value={getQrValue(qrTree)} size={210} includeMargin />
              </div>

              <small className="qrPath">{getQrPath(qrTree)}</small>
            </div>
          </div>
        </div>
      )}

      {renameTree && (
        <div className="modalOverlay" onClick={() => setRenameTree(null)}>
          <div className="modal renameModal" onClick={(event) => event.stopPropagation()}>
            <button className="closeBtn" onClick={() => setRenameTree(null)}>
              ×
            </button>

            <p className="eyebrow">Friendly Name</p>
            <h2>Rename Tree</h2>
            <p className="detailSubtitle">This changes the customer-visible name only. QR identity stays the same.</p>

            <label className="fieldLabel">
              Tree Name
              <input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} placeholder="Seedling 1" />
            </label>

            <button className="primaryBtn" disabled={actionLoading} onClick={saveRename}>
              {actionLoading ? "Saving..." : "Save Name"}
            </button>
          </div>
        </div>
      )}

      {evidenceTree && (
        <div className="modalOverlay" onClick={() => setEvidenceTree(null)}>
          <div className="modal evidenceModal" onClick={(event) => event.stopPropagation()}>
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
                            {src ? <img src={src} alt={item.caption || "Tree photo update"} /> : <div className="imageFallback">🌳</div>}
                            <div>
                              <b>{item.caption || item.status || "Photo Update"}</b>
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
                          <article className="evidenceCard gpsCard" key={item.id}>
                            <div className="gpsIcon">📍</div>
                            <div>
                              <b>{item.location_note || item.status || "GPS Update"}</b>
                              <small>{formatDate(item.created_at)}</small>
                              <p>
                                {item.latitude && item.longitude
                                  ? `${item.latitude}, ${item.longitude}`
                                  : item.notes || "Coordinates not provided."}
                              </p>
                              {mapLink && (
                                <a href={mapLink} target="_blank" rel="noreferrer">
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
                        <article className="evidenceCard healthCard" key={item.id}>
                          <div className="gpsIcon">💚</div>
                          <div>
                            <b>{item.health_status || "Health Report"}</b>
                            <small>{formatDate(item.created_at)}</small>
                            <p>{item.issue_summary || item.report_notes || item.notes || "No health notes provided."}</p>
                            {item.issue_severity && <span className="severity">{item.issue_severity}</span>}
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
          color: #102017;
          font-family: Arial, Helvetica, sans-serif;
          background:
            radial-gradient(circle at 14% 7%, rgba(255, 222, 145, .50), transparent 25%),
            radial-gradient(circle at 90% 0%, rgba(255,255,255,.70), transparent 32%),
            linear-gradient(180deg, #f8f4e9 0%, #eee2cc 48%, #dfc9a8 100%);
        }

        .hero {
          display: grid;
          grid-template-columns: 1fr 460px;
          gap: 18px;
          align-items: stretch;
          margin-bottom: 20px;
        }

        .back {
          display: inline-block;
          margin-bottom: 14px;
          color: #8a6739;
          font-weight: 900;
          text-decoration: none;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #8a6739;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
          font-size: 12px;
        }

        h1 {
          margin: 0;
          font-size: 54px;
          letter-spacing: -2px;
          color: #0b1b12;
        }

        .hero span {
          display: block;
          margin-top: 8px;
          max-width: 780px;
          color: #627064;
          font-weight: 800;
          line-height: 1.6;
        }

        .heroStats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .heroStats div,
        .message,
        .empty,
        .forestCard,
        .forestDetail,
        .emptyState {
          border-radius: 28px;
          background: rgba(255,253,246,.88);
          border: 1px solid rgba(81, 61, 32, .08);
          box-shadow: 0 20px 50px rgba(79, 55, 20, .10);
        }

        .heroStats div {
          padding: 18px;
        }

        .heroStats small {
          display: block;
          color: #8a6739;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .10em;
          margin-bottom: 5px;
        }

        .heroStats b {
          display: block;
          color: #244536;
          font-size: 30px;
        }

        .message,
        .empty {
          padding: 18px;
          margin-bottom: 18px;
          color: #244536;
          font-weight: 900;
        }

        .emptyState {
          min-height: 440px;
          display: grid;
          place-items: center;
          text-align: center;
          padding: 40px;
        }

        .emptyState h2 {
          margin: 0;
          font-size: 34px;
          color: #0b1b12;
        }

        .emptyState p {
          max-width: 560px;
          color: #627064;
          font-weight: 800;
          line-height: 1.65;
        }

        .emptyState a {
          display: inline-flex;
          margin-top: 8px;
          padding: 14px 20px;
          border-radius: 16px;
          color: white;
          background: linear-gradient(135deg, #244536, #10281f);
          text-decoration: none;
          font-weight: 900;
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
          cursor: pointer;
          border: 1px solid rgba(81, 61, 32, .08);
          text-align: left;
          padding: 18px;
          transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
        }

        .forestCard:hover,
        .forestCard.active {
          transform: translateY(-3px);
          border-color: rgba(36,69,54,.25);
          box-shadow: 0 24px 60px rgba(36,69,54,.16);
        }

        .forestCard.active {
          background:
            radial-gradient(circle at 86% 10%, rgba(255, 222, 145, .36), transparent 32%),
            rgba(255,253,246,.95);
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
          color: #8a6739;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .10em;
          margin-bottom: 4px;
        }

        .forestTop b {
          display: block;
          color: #0b1b12;
          font-size: 24px;
          line-height: 1.12;
        }

        .forestTop span {
          white-space: nowrap;
          border-radius: 999px;
          padding: 8px 11px;
          color: white;
          background: #244536;
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
          background: #f2ead9;
        }

        .forestCounts small {
          display: block;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .08em;
          margin-bottom: 4px;
        }

        .forestCounts b {
          font-size: 22px;
        }

        .protected small,
        .protected b {
          color: #245f39;
        }

        .attention small,
        .attention b {
          color: #8a6739;
        }

        .critical small,
        .critical b {
          color: #8b2d20;
        }

        .forestDetail {
          padding: 22px;
        }

        .forestDetailHead {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          margin-bottom: 18px;
        }

        .forestDetailHead h2 {
          margin: 0;
          color: #0b1b12;
          font-size: 36px;
          letter-spacing: -1px;
        }

        .forestDetailHead span {
          display: block;
          margin-top: 7px;
          color: #627064;
          font-weight: 900;
        }

        .addTreeBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          padding: 14px 18px;
          color: white;
          background: linear-gradient(135deg, #244536, #10281f);
          text-decoration: none;
          font-weight: 900;
          white-space: nowrap;
        }

        .treeSections {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          align-items: start;
        }

        .treeSection {
          border-radius: 24px;
          padding: 14px;
          min-height: 220px;
        }

        .criticalBox {
          background: linear-gradient(180deg, rgba(139,45,32,.10), rgba(139,45,32,.04));
          border: 1px solid rgba(139,45,32,.14);
        }

        .attentionBox {
          background: linear-gradient(180deg, rgba(178,129,45,.14), rgba(178,129,45,.04));
          border: 1px solid rgba(178,129,45,.16);
        }

        .protectedBox {
          background: linear-gradient(180deg, rgba(36,95,57,.12), rgba(36,95,57,.04));
          border: 1px solid rgba(36,95,57,.14);
        }

        .treeSectionHead {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 12px;
        }

        .treeSectionHead b {
          color: #0b1b12;
          font-size: 18px;
        }

        .treeSectionHead span {
          display: inline-grid;
          place-items: center;
          min-width: 30px;
          height: 30px;
          border-radius: 999px;
          color: white;
          background: #244536;
          font-size: 12px;
          font-weight: 900;
        }

        .treeList {
          display: grid;
          gap: 9px;
        }

        .treeMini {
          width: 100%;
          border: 0;
          border-radius: 18px;
          padding: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          text-align: left;
          cursor: pointer;
          background: rgba(255,253,246,.78);
          box-shadow: 0 10px 24px rgba(79, 55, 20, .06);
        }

        .treeMiniIcon {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          border-radius: 14px;
          background: rgba(36,69,54,.08);
          flex: 0 0 auto;
        }

        .treeMini b {
          display: block;
          color: #0b1b12;
          font-size: 15px;
          margin-bottom: 3px;
        }

        .treeMini small {
          color: #687467;
          font-weight: 800;
          line-height: 1.3;
        }

        .treeMini.critical {
          border: 1px solid rgba(139,45,32,.16);
        }

        .treeMini.attention {
          border: 1px solid rgba(178,129,45,.16);
        }

        .treeMini.protected {
          border: 1px solid rgba(36,95,57,.16);
        }

        .softEmpty {
          border-radius: 18px;
          padding: 14px;
          color: #687467;
          background: rgba(255,253,246,.58);
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
          background: rgba(10, 18, 13, .55);
          backdrop-filter: blur(8px);
        }

        .modal {
          position: relative;
          width: min(760px, 100%);
          max-height: 92vh;
          overflow: auto;
          border-radius: 34px;
          padding: 26px;
          background:
            radial-gradient(circle at 90% 8%, rgba(255, 222, 145, .36), transparent 30%),
            #fffdf6;
          box-shadow: 0 30px 90px rgba(0,0,0,.28);
          border: 1px solid rgba(81, 61, 32, .10);
        }

        .closeBtn {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 42px;
          height: 42px;
          border: 0;
          border-radius: 999px;
          background: #f2ead9;
          color: #244536;
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
          background: rgba(36,95,57,.12);
          color: #245f39;
        }

        .detailStatus.attention {
          background: rgba(178,129,45,.14);
          color: #8a6739;
        }

        .detailStatus.critical {
          background: rgba(139,45,32,.12);
          color: #8b2d20;
        }

        .modal h2 {
          margin: 0;
          color: #0b1b12;
          font-size: 38px;
          letter-spacing: -1px;
        }

        .detailSubtitle {
          margin: 8px 0 18px;
          color: #627064;
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
          background: #f2ead9;
        }

        .detailGrid small,
        .tagRows small,
        .fieldLabel {
          display: block;
          color: #8a6739;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .09em;
          margin-bottom: 5px;
        }

        .detailGrid b,
        .tagRows b {
          display: block;
          color: #102017;
          font-size: 15px;
          line-height: 1.35;
        }

        .warningNote {
          border-radius: 18px;
          padding: 14px;
          margin: 0 0 18px;
          background: rgba(139,45,32,.08);
          border: 1px solid rgba(139,45,32,.12);
        }

        .warningNote b {
          color: #8b2d20;
        }

        .warningNote p {
          margin: 6px 0 0;
          color: #6f3c32;
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
          color: white;
          background: linear-gradient(135deg, #244536, #10281f);
          font-weight: 900;
          cursor: pointer;
        }

        .actionGrid button:disabled,
        .primaryBtn:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .qrModal {
          width: min(460px, 100%);
        }

        .tagCard {
          border-radius: 28px;
          padding: 22px;
          text-align: center;
          background:
            radial-gradient(circle at 50% 0%, rgba(255, 222, 145, .38), transparent 30%),
            #f8f1df;
          border: 1px solid rgba(81, 61, 32, .12);
        }

        .tagCard p {
          margin: 0 0 16px;
          color: #0b1b12;
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
          background: rgba(255,253,246,.78);
        }

        .qrBox {
          display: inline-grid;
          place-items: center;
          padding: 14px;
          border-radius: 22px;
          background: white;
          box-shadow: 0 14px 34px rgba(79, 55, 20, .12);
        }

        .qrPath {
          display: block;
          margin-top: 12px;
          color: #687467;
          font-weight: 900;
          word-break: break-word;
        }

        .fieldLabel {
          display: grid;
          gap: 8px;
          margin: 18px 0;
        }

        .fieldLabel input {
          width: 100%;
          border: 1px solid rgba(36,69,54,.16);
          border-radius: 16px;
          padding: 14px;
          background: rgba(255,253,246,.92);
          color: #102017;
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
          background: #f2ead9;
          align-items: center;
        }

        .evidenceCard img,
        .imageFallback {
          width: 130px;
          height: 100px;
          border-radius: 18px;
          object-fit: cover;
          background: rgba(36,69,54,.10);
          display: grid;
          place-items: center;
          font-size: 36px;
        }

        .evidenceCard b {
          display: block;
          color: #102017;
          font-size: 18px;
        }

        .evidenceCard small {
          display: block;
          margin-top: 4px;
          color: #8a6739;
          font-weight: 900;
        }

        .evidenceCard p {
          margin: 8px 0 0;
          color: #627064;
          font-weight: 800;
          line-height: 1.5;
        }

        .evidenceCard a {
          display: inline-flex;
          margin-top: 8px;
          color: #244536;
          font-weight: 900;
        }

        .gpsIcon {
          display: grid;
          place-items: center;
          width: 74px;
          height: 74px;
          border-radius: 24px;
          background: rgba(36,69,54,.10);
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
          color: #8b2d20;
          background: rgba(139,45,32,.10);
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

          .heroStats {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        @media (max-width: 760px) {
          .page {
            padding: 18px;
          }

          h1 {
            font-size: 38px;
          }

          .heroStats,
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
