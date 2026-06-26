"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  display_name?: string | null;
  email: string | null;
};

type TreeVerifyRow = {
  tree_id: string;
  customer_profile_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  group_id: string | null;
  forest_name: string | null;
  customer_tree_name: string | null;
  tree_code: string | null;
  tree_qr_url: string | null;
  care_status: string | null;
  care_expires_at: string | null;
  alert_status: string | null;
  alert_reason: string | null;
  valuation_status: string | null;
  official_valuation_amount: number | null;
  latest_photo_at: string | null;
  latest_gps_at: string | null;
  latest_health_at: string | null;
  latest_health_status: string | null;
  purchase_date?: string | null;
  created_at?: string | null;
  current_health_status?: string | null;
};

type TreeSupplementRow = {
  id: string;
  tree_code: string | null;
  tree_qr_url: string | null;
  purchase_date: string | null;
  created_at: string | null;
  health_status: string | null;
  last_health_status: string | null;
  care_status: string | null;
  valuation_status: string | null;
  valuation_amount: number | null;
};

type AdminRow = {
  id: string;
  admin_profile_id: string | null;
  status: string | null;
};

type CaretakerRow = {
  id: string;
  caretaker_profile_id: string | null;
  status: string | null;
};

type AssignmentRow = {
  id: string;
  caretaker_id: string | null;
  caretaker_profile_id: string | null;
  customer_profile_id: string | null;
  source_type: string | null;
  tree_id: string | null;
  group_id: string | null;
  status: string | null;
  assigned_at: string | null;
};

function normalizeStatus(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase();
}

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
  if (!value) return "Not available";

  try {
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "Not available";
  }
}

function alertClass(status: string | null | undefined) {
  const normalized = normalizeStatus(status);

  if (normalized === "PROTECTED") return "protected";
  if (normalized === "CRITICAL") return "critical";

  return "attention";
}

function alertIcon(status: string | null | undefined) {
  const normalized = normalizeStatus(status);

  if (normalized === "PROTECTED") return "🟢";
  if (normalized === "CRITICAL") return "🔴";

  return "🟡";
}

function alertLabel(status: string | null | undefined) {
  const normalized = normalizeStatus(status);

  if (normalized === "PROTECTED") return "Protected";
  if (normalized === "CRITICAL") return "Critical";

  return "Needs Attention";
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

  if (normalized === "APPROVED" && amount) return peso(amount);
  if (normalized === "APPROVED") return "Approved";

  if (
    normalized === "PENDING" ||
    normalized === "REQUESTED" ||
    normalized === "PENDING_ADMIN_VALUATION" ||
    normalized === "NEEDS_REVIEW"
  ) {
    return "Pending Admin Valuation";
  }

  if (normalized === "ASSIGNED") return "Assigned for Inspection";
  if (normalized === "INSPECTION_SUBMITTED") return "Inspection Submitted";

  return "Not Requested";
}

function treeName(tree: TreeVerifyRow | null) {
  return tree?.customer_tree_name || "Seedling";
}

function ownerName(tree: TreeVerifyRow | null) {
  return tree?.customer_name || tree?.customer_email || "Customer";
}

function forestName(tree: TreeVerifyRow | null) {
  return tree?.forest_name || "Unnamed Forest";
}

function currentHealthLabel(tree: TreeVerifyRow | null) {
  return (
    tree?.current_health_status ||
    tree?.latest_health_status ||
    "No health report yet"
  );
}

function latestHealthReportLabel(tree: TreeVerifyRow | null) {
  if (!tree?.latest_health_at && !tree?.latest_health_status) {
    return "No update yet";
  }

  if (tree.latest_health_status && tree.latest_health_at) {
    return `${tree.latest_health_status} • ${formatDate(tree.latest_health_at)}`;
  }

  return tree.latest_health_status || formatDate(tree.latest_health_at);
}

function purchaseDateLabel(tree: TreeVerifyRow | null) {
  return formatShortDate(tree?.purchase_date || tree?.created_at);
}

function verificationLabel(tree: TreeVerifyRow | null) {
  if (!tree) return "Not Verified";

  return `Verified • ${alertLabel(tree.alert_status)}`;
}

export default function TreeVerifyPage() {
  const params = useParams();
  const treeId = String(params?.id || "");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [tree, setTree] = useState<TreeVerifyRow | null>(null);
  const [admin, setAdmin] = useState<AdminRow | null>(null);
  const [caretaker, setCaretaker] = useState<CaretakerRow | null>(null);
  const [matchingAssignment, setMatchingAssignment] =
    useState<AssignmentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function resolveProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

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

  async function loadAdmin(profileId: string, email: string) {
    const { data: byProfile } = await supabase
      .from("admins")
      .select("id, admin_profile_id, status")
      .eq("admin_profile_id", profileId)
      .maybeSingle();

    if (byProfile) return byProfile as AdminRow;

    if (!email) return null;

    const { data: byEmail } = await supabase
      .from("admins")
      .select("id, admin_profile_id, status")
      .ilike("email", email)
      .maybeSingle();

    return (byEmail || null) as AdminRow | null;
  }

  async function loadCaretaker(profileId: string, email: string) {
    const { data: byProfile } = await supabase
      .from("caretakers")
      .select("id, caretaker_profile_id, status")
      .eq("caretaker_profile_id", profileId)
      .maybeSingle();

    if (byProfile) return byProfile as CaretakerRow;

    if (!email) return null;

    const { data: byEmail } = await supabase
      .from("caretakers")
      .select("id, caretaker_profile_id, status")
      .ilike("email", email)
      .maybeSingle();

    return (byEmail || null) as CaretakerRow | null;
  }

  async function loadVerifyPage() {
    setLoading(true);
    setMessage("");
    setTree(null);
    setAdmin(null);
    setCaretaker(null);
    setMatchingAssignment(null);

    const cleanTreeId = decodeURIComponent(treeId || "").trim();

    if (!cleanTreeId) {
      setMessage("Invalid tree verification link.");
      setLoading(false);
      return;
    }

    let { data: treeRow, error: treeError } = await supabase
      .from("v_tree_verify")
      .select("*")
      .eq("tree_id", cleanTreeId)
      .maybeSingle();

    if (treeError) {
      setMessage(`Tree verification failed: ${treeError.message}`);
      setLoading(false);
      return;
    }

    if (!treeRow) {
      const fallback = await supabase
        .from("v_tree_verify")
        .select("*")
        .eq("tree_code", cleanTreeId)
        .maybeSingle();

      if (fallback.error) {
        setMessage(`Tree verification fallback failed: ${fallback.error.message}`);
        setLoading(false);
        return;
      }

      treeRow = fallback.data;
    }

    if (!treeRow) {
      setMessage("Tree tag not found.");
      setLoading(false);
      return;
    }

    const baseTree = treeRow as TreeVerifyRow;

    const { data: supplementRow } = await supabase
      .from("trees")
      .select(
        "id, tree_code, tree_qr_url, purchase_date, created_at, health_status, last_health_status, care_status, valuation_status, valuation_amount",
      )
      .eq("id", baseTree.tree_id)
      .maybeSingle();

    const supplement = supplementRow as TreeSupplementRow | null;

    const currentTree: TreeVerifyRow = {
      ...baseTree,
      tree_code: baseTree.tree_code || supplement?.tree_code || null,
      tree_qr_url: baseTree.tree_qr_url || supplement?.tree_qr_url || null,
      purchase_date: supplement?.purchase_date || null,
      created_at: supplement?.created_at || null,
      current_health_status:
        supplement?.last_health_status ||
        supplement?.health_status ||
        baseTree.latest_health_status ||
        null,
      care_status: baseTree.care_status || supplement?.care_status || null,
      valuation_status:
        baseTree.valuation_status || supplement?.valuation_status || null,
      official_valuation_amount:
        baseTree.official_valuation_amount ??
        supplement?.valuation_amount ??
        null,
    };

    const currentProfile = await resolveProfile();

    setTree(currentTree);
    setProfile(currentProfile);

    if (currentProfile) {
      const email = currentProfile.email?.trim().toLowerCase() || "";
      const currentAdmin = await loadAdmin(currentProfile.id, email);
      const currentCaretaker = await loadCaretaker(currentProfile.id, email);

      setAdmin(currentAdmin);
      setCaretaker(currentCaretaker);

      if (currentCaretaker) {
        const { data: assignmentRowsById } = await supabase
          .from("caretaker_assignments")
          .select(
            "id, caretaker_id, caretaker_profile_id, customer_profile_id, source_type, tree_id, group_id, status, assigned_at",
          )
          .eq("caretaker_id", currentCaretaker.id)
          .in("status", [
            "ASSIGNED",
            "IN_PROGRESS",
            "SUBMITTED",
            "REWORK_REQUESTED",
          ])
          .limit(50);

        const { data: assignmentRowsByProfile } =
          currentCaretaker.caretaker_profile_id
            ? await supabase
                .from("caretaker_assignments")
                .select(
                  "id, caretaker_id, caretaker_profile_id, customer_profile_id, source_type, tree_id, group_id, status, assigned_at",
                )
                .eq(
                  "caretaker_profile_id",
                  currentCaretaker.caretaker_profile_id,
                )
                .in("status", [
                  "ASSIGNED",
                  "IN_PROGRESS",
                  "SUBMITTED",
                  "REWORK_REQUESTED",
                ])
                .limit(50)
            : { data: [] };

        const mergedAssignments = [
          ...((assignmentRowsById || []) as AssignmentRow[]),
          ...((assignmentRowsByProfile || []) as AssignmentRow[]),
        ];

        const uniqueAssignments = Array.from(
          new Map(
            mergedAssignments.map((assignment) => [assignment.id, assignment]),
          ).values(),
        );

        const activeAssignment =
          uniqueAssignments.find(
            (assignment) => assignment.tree_id === currentTree.tree_id,
          ) ||
          uniqueAssignments.find(
            (assignment) =>
              !!assignment.group_id &&
              assignment.group_id === currentTree.group_id,
          ) ||
          null;

        setMatchingAssignment(activeAssignment);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    loadVerifyPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeId]);

  const isOwner = useMemo(() => {
    return (
      !!profile?.id &&
      !!tree?.customer_profile_id &&
      profile.id === tree.customer_profile_id
    );
  }, [profile, tree]);

  const isAdmin = !!admin;
  const isCaretaker = !!caretaker;
  const canShowOwnerDetails = isOwner || isAdmin;
  const canUploadAsGardener = isCaretaker && !!matchingAssignment;

  if (loading) {
    return (
      <main className="page">
        <section className="loadingCard">Verifying tree tag...</section>
        <style>{styles}</style>
      </main>
    );
  }

  if (!tree) {
    return (
      <main className="page">
        <section className="errorCard">
          <p>ARGANWOOD TREE TAG</p>
          <h1>Tree Not Found</h1>
          <span>{message || "This QR tag could not be verified."}</span>
          <Link href="/dashboard">Go to Dashboard</Link>
        </section>
        <style>{styles}</style>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="verifyHero">
        <div>
          <p className="eyebrow">ARGANWOOD TREE TAG</p>
          <h1>Verified Tree</h1>
          <span>
            This QR confirms a real Arganwood tree record. The page shows tree
            identity, owner, care status, health updates, valuation, and
            verification status.
          </span>
        </div>

        <div className={`statusOrb ${alertClass(tree.alert_status)}`}>
          <strong>{alertIcon(tree.alert_status)}</strong>
          <b>{alertLabel(tree.alert_status)}</b>
          <small>{tree.alert_reason || "Verification complete"}</small>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      <section className="verifiedCard">
        <div className="treeBadge">🌳</div>

        <p className="eyebrow">Tree Identity</p>
        <h2>🌳 {treeName(tree)}</h2>
        <span className="forestLine">{forestName(tree)}</span>

        <div className="publicGrid">
          <InfoCard label="Owner" value={ownerName(tree)} />
          <InfoCard label="Forest" value={forestName(tree)} />
          <InfoCard label="Tree Code" value={tree.tree_code || "No code"} />
          <InfoCard label="Purchase Date" value={purchaseDateLabel(tree)} />
          <InfoCard
            label="Current Care Status"
            value={careLabel(tree.care_status)}
          />
          <InfoCard
            label="Current Health Status"
            value={currentHealthLabel(tree)}
          />
          <InfoCard label="Latest Photo" value={formatDate(tree.latest_photo_at)} />
          <InfoCard label="Latest GPS" value={formatDate(tree.latest_gps_at)} />
          <InfoCard
            label="Latest Health Report"
            value={latestHealthReportLabel(tree)}
          />
          <InfoCard
            label="Current Valuation"
            value={valuationLabel(
              tree.valuation_status,
              tree.official_valuation_amount,
            )}
          />
          <InfoCard label="Verification Status" value={verificationLabel(tree)} />
        </div>
      </section>

      {isOwner && (
        <section className="rolePanel customerPanel">
          <p className="eyebrow">Customer View</p>
          <h2>Your tree is verified</h2>
          <p>
            You can review your forest, request care, request valuation, and
            view approved updates from your My Trees dashboard.
          </p>
          <div className="buttonRow">
            <Link href="/dashboard/my-trees">Open My Trees</Link>
            <Link
              href={`/dashboard/tree-operations?tree_id=${tree.tree_id}${
                tree.group_id ? `&group_id=${tree.group_id}` : ""
              }`}
            >
              Request Care
            </Link>
          </div>
        </section>
      )}

      {isAdmin && (
        <section className="rolePanel adminPanel">
          <p className="eyebrow">Admin View</p>
          <h2>Internal Tree Verification</h2>
          <div className="adminGrid">
            <InfoCard label="Customer" value={tree.customer_name || "Customer"} />
            <InfoCard
              label="Email"
              value={tree.customer_email || "Not available"}
            />
            <InfoCard label="Forest" value={forestName(tree)} />
            <InfoCard
              label="Internal Tree Code"
              value={tree.tree_code || "No code"}
            />
            <InfoCard label="Tree UUID" value={tree.tree_id} />
            <InfoCard
              label="Customer Profile ID"
              value={tree.customer_profile_id || "No profile"}
            />
          </div>
          <div className="buttonRow">
            <Link href="/admin/forest-center">Forest Center</Link>
            <Link href="/admin/tree-alerts">Tree Alerts</Link>
            <Link href="/admin/operations">Assign Caretaker</Link>
          </div>
        </section>
      )}

      {isCaretaker && (
        <section
          className={
            canUploadAsGardener
              ? "rolePanel gardenerPanel allowed"
              : "rolePanel gardenerPanel blocked"
          }
        >
          <p className="eyebrow">Gardener View</p>
          <h2>
            {canUploadAsGardener ? "Assigned Tree Verified" : "Tree Verified"}
          </h2>
          <p>
            {canUploadAsGardener
              ? "You are assigned to this tree or forest. Open your task list to upload photo, GPS, and health evidence."
              : "This tree is verified, but no active assignment was found for your gardener account."}
          </p>

          {matchingAssignment && (
            <div className="assignmentBox">
              <small>Assignment</small>
              <b>{matchingAssignment.source_type || "TREE_OPERATION"}</b>
              <span>
                {matchingAssignment.status || "ASSIGNED"} •{" "}
                {formatDate(matchingAssignment.assigned_at)}
              </span>
            </div>
          )}

          <div className="buttonRow">
            <Link href={`/gardener/tasks?tree_id=${tree.tree_id}`}>
              Open Gardener Tasks
            </Link>
          </div>
        </section>
      )}

      {!profile && (
        <section className="rolePanel publicPanel">
          <p className="eyebrow">Public Verification</p>
          <h2>Tree tag is valid</h2>
          <p>
            Sign in as the customer, admin, or assigned gardener to see
            role-specific actions for this tree.
          </p>
          <div className="buttonRow">
            <Link href="/login">Sign In</Link>
          </div>
        </section>
      )}

      {!canShowOwnerDetails && profile && !isCaretaker && (
        <section className="rolePanel publicPanel">
          <p className="eyebrow">Limited View</p>
          <h2>Tree tag is valid</h2>
          <p>
            This account is not the owner, admin, or assigned gardener for this
            tree.
          </p>
          <div className="buttonRow">
            <Link href="/dashboard">Go to Dashboard</Link>
          </div>
        </section>
      )}

      <style>{styles}</style>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <small>{label}</small>
      <b>{value || "—"}</b>
    </div>
  );
}

const styles = `
  * {
    box-sizing: border-box;
  }

  .page {
    min-height: 100vh;
    padding: 30px;
    color: #fff7df;
    font-family: Arial, Helvetica, sans-serif;
    background:
      radial-gradient(circle at 15% 5%, rgba(220,176,88,.24), transparent 28%),
      radial-gradient(circle at 86% 0%, rgba(85,132,93,.20), transparent 30%),
      linear-gradient(180deg, #07130d 0%, #0b1f15 48%, #06100b 100%);
  }

  .loadingCard,
  .errorCard,
  .verifyHero,
  .verifiedCard,
  .rolePanel,
  .message {
    border: 1px solid rgba(232,190,103,.18);
    background:
      linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.03)),
      rgba(7, 24, 15, .84);
    box-shadow: 0 24px 70px rgba(0,0,0,.32);
    backdrop-filter: blur(10px);
  }

  .loadingCard,
  .message {
    border-radius: 26px;
    padding: 20px;
    color: #f4d58b;
    font-weight: 900;
  }

  .errorCard {
    min-height: calc(100vh - 60px);
    border-radius: 34px;
    padding: 40px;
    display: grid;
    place-items: center;
    text-align: center;
  }

  .errorCard p,
  .eyebrow {
    margin: 0 0 8px;
    color: #e8be67;
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .14em;
  }

  .errorCard h1 {
    margin: 0;
    color: #fff7df;
    font-size: 48px;
  }

  .errorCard span {
    color: rgba(255,247,223,.72);
    font-weight: 800;
  }

  .errorCard a,
  .buttonRow a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 16px;
    padding: 14px 18px;
    color: #08120d;
    background: linear-gradient(135deg, #f4d58b, #c99536);
    text-decoration: none;
    font-weight: 900;
  }

  .verifyHero {
    display: grid;
    grid-template-columns: 1fr 240px;
    gap: 18px;
    align-items: stretch;
    border-radius: 34px;
    padding: 28px;
    margin-bottom: 18px;
  }

  .verifyHero h1 {
    margin: 0;
    color: #fff7df;
    font-size: 56px;
    letter-spacing: -2px;
  }

  .verifyHero span {
    display: block;
    margin-top: 12px;
    max-width: 760px;
    color: rgba(255,247,223,.72);
    font-weight: 800;
    line-height: 1.6;
  }

  .statusOrb {
    border-radius: 30px;
    display: grid;
    place-items: center;
    text-align: center;
    padding: 20px;
    background: rgba(255,255,255,.07);
    border: 1px solid rgba(255,255,255,.08);
  }

  .statusOrb strong {
    display: block;
    font-size: 48px;
  }

  .statusOrb b {
    color: #fff7df;
    font-size: 22px;
  }

  .statusOrb small {
    color: rgba(255,247,223,.62);
    font-weight: 800;
    line-height: 1.35;
  }

  .statusOrb.protected {
    border-color: rgba(121,225,146,.24);
  }

  .statusOrb.attention {
    border-color: rgba(244,213,139,.24);
  }

  .statusOrb.critical {
    border-color: rgba(255,120,96,.26);
  }

  .verifiedCard,
  .rolePanel {
    border-radius: 34px;
    padding: 26px;
    margin-bottom: 18px;
  }

  .treeBadge {
    width: 74px;
    height: 74px;
    border-radius: 26px;
    display: grid;
    place-items: center;
    background: rgba(255,255,255,.08);
    font-size: 38px;
    margin-bottom: 18px;
  }

  .verifiedCard h2,
  .rolePanel h2 {
    margin: 0;
    color: #fff7df;
    font-size: 38px;
    letter-spacing: -1px;
  }

  .forestLine {
    display: block;
    margin-top: 8px;
    color: rgba(255,247,223,.68);
    font-weight: 900;
  }

  .publicGrid,
  .adminGrid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-top: 20px;
  }

  .publicGrid div,
  .adminGrid div,
  .assignmentBox {
    border-radius: 18px;
    padding: 14px;
    background: rgba(255,255,255,.07);
    border: 1px solid rgba(255,255,255,.08);
  }

  .publicGrid small,
  .adminGrid small,
  .assignmentBox small {
    display: block;
    color: #e8be67;
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .09em;
    margin-bottom: 5px;
  }

  .publicGrid b,
  .adminGrid b,
  .assignmentBox b {
    display: block;
    color: #fff7df;
    font-size: 15px;
    line-height: 1.35;
    word-break: break-word;
  }

  .rolePanel p {
    color: rgba(255,247,223,.72);
    font-weight: 800;
    line-height: 1.6;
  }

  .buttonRow {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 18px;
  }

  .buttonRow a:nth-child(even) {
    color: #fff7df;
    background: rgba(255,255,255,.10);
    border: 1px solid rgba(232,190,103,.22);
  }

  .customerPanel {
    border-color: rgba(121,225,146,.22);
  }

  .adminPanel {
    border-color: rgba(244,213,139,.24);
  }

  .gardenerPanel.allowed {
    border-color: rgba(121,225,146,.22);
  }

  .gardenerPanel.blocked {
    border-color: rgba(255,120,96,.24);
  }

  .publicPanel {
    border-color: rgba(255,255,255,.12);
  }

  .assignmentBox {
    margin-top: 14px;
  }

  .assignmentBox span {
    display: block;
    margin-top: 5px;
    color: rgba(255,247,223,.62);
    font-weight: 800;
  }

  @media (max-width: 900px) {
    .page {
      padding: 18px;
    }

    .verifyHero,
    .publicGrid,
    .adminGrid {
      grid-template-columns: 1fr;
    }

    .verifyHero h1 {
      font-size: 42px;
    }

    .verifiedCard h2,
    .rolePanel h2 {
      font-size: 30px;
    }
  }
`;