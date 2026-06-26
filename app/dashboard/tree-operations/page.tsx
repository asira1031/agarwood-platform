"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Row = Record<string, any>;

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  membership_status: string | null;
  kyc_status: string | null;
  account_status: string | null;
  [key: string]: any;
};

type Wallet = {
  id: string;
  profile_id: string;
  balance: number | null;
  created_at: string | null;
};

type TreeRow = Row & {
  id: string;
  profile_id?: string | null;
  customer_profile_id?: string | null;
  group_id?: string | null;
  display_name?: string | null;
  custom_name?: string | null;
  tree_code?: string | null;
  tree_qr_url?: string | null;
  qr_tag_status?: string | null;
  status?: string | null;
  stage?: string | null;
  health_status?: string | null;
  tree_group_name?: string | null;
  image_url?: string | null;
  photo_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type TreeOperationRequest = Row & {
  id: string;
  profile_id?: string | null;
  customer_profile_id?: string | null;
  tree_id?: string | null;
  group_id?: string | null;
  operation_type?: string | null;
  request_type?: string | null;
  service_name?: string | null;
  service_type?: string | null;
  item_name?: string | null;
  status?: string | null;
  assignment_status?: string | null;
  notes?: string | null;
  created_at?: string | null;
  requested_at?: string | null;
  completed_at?: string | null;
};

type EvidenceRow = Row & {
  id: string;
  tree_id?: string | null;
  group_id?: string | null;
  status?: string | null;
  photo_url?: string | null;
  image_url?: string | null;
  health_status?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type TimelineItem = {
  id: string;
  title: string;
  description: string;
  date: string | null;
  href: string;
  type: string;
};

function peso(value: number) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalize(value: any) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase();
}

function cleanLabel(value: any) {
  return String(value || "Record")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: any) {
  if (!value) return "No update yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No update yet";

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getHourGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [groups, setGroups] = useState<Row[]>([]);
  const [operationRequests, setOperationRequests] = useState<
    TreeOperationRequest[]
  >([]);
  const [photoEvidence, setPhotoEvidence] = useState<EvidenceRow[]>([]);
  const [gpsEvidence, setGpsEvidence] = useState<EvidenceRow[]>([]);
  const [healthEvidence, setHealthEvidence] = useState<EvidenceRow[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function safeRows(label: string, query: PromiseLike<any>) {
    const { data, error } = await query;

    if (error) {
      console.warn(`${label} dashboard load skipped:`, error.message);
      return [];
    }

    return data || [];
  }

  async function loadDashboard() {
    try {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const email = user.email?.trim().toLowerCase() || "";

      const { data: profileById } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .limit(1)
        .maybeSingle();

      const { data: profileByEmail } = email
        ? await supabase
            .from("profiles")
            .select("*")
            .eq("email", email)
            .limit(1)
            .maybeSingle()
        : { data: null };

      const activeProfile = (profileById || profileByEmail) as Profile | null;

      if (!activeProfile) {
        setErrorMessage("Profile not found. Please contact support.");
        return;
      }

      setProfile(activeProfile);

      const profileFilter = `profile_id.eq.${activeProfile.id},customer_profile_id.eq.${activeProfile.id}`;

      const [
        walletRows,
        treeRows,
        groupRows,
        operationRows,
        photoRows,
        gpsRows,
        healthRows,
      ] = await Promise.all([
        safeRows(
          "wallets",
          supabase
            .from("wallets")
            .select("id, profile_id, balance, created_at")
            .eq("profile_id", activeProfile.id)
            .order("created_at", { ascending: false })
            .limit(1),
        ),

        safeRows(
          "trees",
          supabase
            .from("trees")
            .select("*")
            .or(profileFilter)
            .order("created_at", { ascending: false }),
        ),

        safeRows(
          "tree_groups",
          supabase
            .from("tree_groups")
            .select("*")
            .or(profileFilter)
            .order("created_at", { ascending: false }),
        ),

        safeRows(
          "tree_operation_requests",
          supabase
            .from("tree_operation_requests")
            .select("*")
            .or(profileFilter)
            .order("created_at", { ascending: false })
            .limit(20),
        ),

        safeRows(
          "tree_photo_updates",
          supabase
            .from("tree_photo_updates")
            .select("*")
            .eq("customer_profile_id", activeProfile.id)
            .in("status", ["APPROVED", "COMPLETED"])
            .order("created_at", { ascending: false })
            .limit(10),
        ),

        safeRows(
          "tree_gps_logs",
          supabase
            .from("tree_gps_logs")
            .select("*")
            .eq("customer_profile_id", activeProfile.id)
            .in("status", ["APPROVED", "COMPLETED"])
            .order("created_at", { ascending: false })
            .limit(10),
        ),

        safeRows(
          "tree_health_reports",
          supabase
            .from("tree_health_reports")
            .select("*")
            .eq("customer_profile_id", activeProfile.id)
            .in("status", ["APPROVED", "COMPLETED"])
            .order("created_at", { ascending: false })
            .limit(10),
        ),
      ]);

      setWallet((walletRows?.[0] as Wallet) || null);
      setTrees((treeRows || []) as TreeRow[]);
      setGroups(groupRows || []);
      setOperationRequests((operationRows || []) as TreeOperationRequest[]);
      setPhotoEvidence((photoRows || []) as EvidenceRow[]);
      setGpsEvidence((gpsRows || []) as EvidenceRow[]);
      setHealthEvidence((healthRows || []) as EvidenceRow[]);
    } catch (error: any) {
      console.error("Dashboard load error:", error);
      setErrorMessage(error?.message || "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  const displayName =
    profile?.full_name || profile?.email || "Arganwood Investor";
  const firstName = displayName.split(" ").filter(Boolean)[0] || "Investor";
  const membershipStatus = normalize(profile?.membership_status || "INACTIVE");
  const walletBalance = Number(wallet?.balance || 0);

  const groupMap = useMemo(() => {
    const map = new Map<string, Row>();
    groups.forEach((group) => {
      if (group.id) map.set(String(group.id), group);
    });
    return map;
  }, [groups]);

  const latestHealth = healthEvidence[0] || null;
  const latestPhoto = photoEvidence[0] || null;
  const latestGps = gpsEvidence[0] || null;
  const latestOperation = operationRequests[0] || null;

  const latestEvidenceDate = latestDate([
    latestHealth?.created_at,
    latestHealth?.updated_at,
    latestPhoto?.created_at,
    latestPhoto?.updated_at,
    latestGps?.created_at,
    latestGps?.updated_at,
    latestOperation?.completed_at,
    latestOperation?.created_at,
  ]);

  const overallStatus = useMemo(() => {
    const hasEvidence =
      photoEvidence.length > 0 ||
      gpsEvidence.length > 0 ||
      healthEvidence.length > 0;
    if (!hasEvidence) return "Pending Evidence";

    const health = normalize(
      latestHealth?.health_status ||
        latestHealth?.issue_severity ||
        latestHealth?.issue_summary,
    );
    if (
      health.includes("CRITICAL") ||
      health.includes("MONITOR") ||
      health.includes("TREATMENT") ||
      health.includes("DISEASE") ||
      health.includes("PEST") ||
      health.includes("NEEDS")
    ) {
      return "Needs Attention";
    }

    return "Healthy";
  }, [
    photoEvidence.length,
    gpsEvidence.length,
    healthEvidence.length,
    latestHealth,
  ]);

  const selectedTree = trees[0] || null;
  const activeOperation = operationRequests.find((operation) =>
    [
      "PENDING",
      "ASSIGNED",
      "IN_PROGRESS",
      "REQUESTED",
      "PAID",
      "PROCESSING",
    ].includes(normalize(operation.status || operation.assignment_status)),
  );

  const treeCarePlan = useMemo(() => {
    if (!selectedTree) {
      return {
        stage: "No tree selected yet",
        condition: "No condition report yet",
        recommendedAction: "Buy Tree",
        reason:
          "Start by buying or selecting a tree to activate its care plan.",
        hasTree: false,
      };
    }

    const stage = selectedTree.stage || "Early Establishment";
    const condition =
      latestHealth?.health_status ||
      latestHealth?.issue_summary ||
      "No condition report yet";

    let recommendedAction = "Regular Watering / Care Check";

    if (activeOperation) {
      recommendedAction =
        activeOperation.service_name ||
        activeOperation.operation_type ||
        activeOperation.service_type ||
        activeOperation.request_type ||
        "Track Service";
    } else if (gpsEvidence.length === 0) {
      recommendedAction = "GPS Verification";
    } else if (photoEvidence.length === 0) {
      recommendedAction = "Photo Update";
    }

    return {
      stage,
      condition,
      recommendedAction,
      reason: careReason(recommendedAction),
      hasTree: true,
    };
  }, [
    selectedTree,
    latestHealth,
    activeOperation,
    gpsEvidence.length,
    photoEvidence.length,
  ]);

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const photos = photoEvidence.map((row) => ({
      id: `photo-${row.id}`,
      title: "Photo Update approved",
      description: treeLabel(findTree(row.tree_id, trees)),
      date: row.created_at || row.updated_at || null,
      href: "/dashboard/my-trees",
      type: "PHOTO",
    }));

    const gps = gpsEvidence.map((row) => ({
      id: `gps-${row.id}`,
      title: "GPS Verification completed",
      description: treeLabel(findTree(row.tree_id, trees)),
      date: row.created_at || row.updated_at || null,
      href: "/dashboard/my-trees",
      type: "GPS",
    }));

    const health = healthEvidence.map((row) => ({
      id: `health-${row.id}`,
      title: "Health Check completed",
      description:
        row.health_status ||
        row.issue_summary ||
        treeLabel(findTree(row.tree_id, trees)),
      date: row.created_at || row.updated_at || null,
      href: "/dashboard/my-trees",
      type: "HEALTH",
    }));

    const completedOperations = operationRequests
      .filter((row) => normalize(row.status) === "COMPLETED")
      .map((row) => ({
        id: `operation-${row.id}`,
        title: `${cleanLabel(row.service_name || row.operation_type || row.service_type || row.request_type)} completed`,
        description: row.notes || "Tree operation approved by Admin",
        date: row.completed_at || row.created_at || null,
        href: "/dashboard/tree-operations",
        type: "OPERATION",
      }));

    const qrItems = trees
      .filter((tree) =>
        ["INSTALLED", "VERIFIED"].includes(normalize(tree.qr_tag_status)),
      )
      .map((tree) => ({
        id: `qr-${tree.id}`,
        title: `QR Tag ${cleanLabel(tree.qr_tag_status)}`,
        description: treeLabel(tree),
        date: tree.updated_at || tree.created_at || null,
        href: "/dashboard/my-trees",
        type: "QR",
      }));

    return [...photos, ...gps, ...health, ...completedOperations, ...qrItems]
      .sort(
        (a, b) =>
          new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
      )
      .slice(0, 7);
  }, [photoEvidence, gpsEvidence, healthEvidence, operationRequests, trees]);

  const smartActions = useMemo(() => {
    const actions: {
      title: string;
      text: string;
      href: string;
      icon: ReactNode;
      priority: number;
    }[] = [
      {
        title: "View My Trees",
        text: "Open your owned tree portfolio.",
        href: "/dashboard/my-trees",
        icon: <TreeIcon />,
        priority: 5,
      },
      {
        title: "Request Tree Service",
        text: "Book care, GPS, photo, or health updates.",
        href: "/dashboard/tree-operations",
        icon: <ServiceIcon />,
        priority: trees.length > 0 && !activeOperation ? 3 : 7,
      },
      {
        title: "Buy More Trees",
        text: "Expand your Arganwood portfolio.",
        href: "/dashboard/marketplace",
        icon: <MarketIcon />,
        priority: trees.length === 0 ? 1 : 6,
      },
      {
        title: "Sell Tree",
        text: "Request sale review for eligible trees.",
        href: "/dashboard/sell-tree",
        icon: <SellIcon />,
        priority: 8,
      },
      {
        title: walletBalance <= 0 ? "Add Funds / Wallet" : "Open Wallet",
        text: "Manage investment balance and wallet records.",
        href: "/dashboard/wallet",
        icon: <WalletIcon />,
        priority: walletBalance <= 0 ? 2 : 9,
      },
      {
        title: "Manage Membership",
        text: "Keep annual customer access active.",
        href: "/dashboard/membership",
        icon: <MembershipIcon />,
        priority: membershipStatus !== "ACTIVE" ? 0 : 10,
      },
      {
        title: "Contact Support",
        text: "Get help with your account or plantation records.",
        href: "/dashboard/support",
        icon: <SupportIcon />,
        priority: 11,
      },
    ];

    if (activeOperation) {
      actions.push({
        title: "Track Service",
        text: cleanLabel(
          activeOperation.service_name ||
            activeOperation.operation_type ||
            "Active request",
        ),
        href: "/dashboard/tree-operations",
        icon: <TrackIcon />,
        priority: 1,
      });
    } else if (trees.length > 0 && gpsEvidence.length === 0) {
      actions.push({
        title: "Request GPS Verification",
        text: "Protect ownership with verified tree location.",
        href: "/dashboard/tree-operations",
        icon: <PinIcon />,
        priority: 1,
      });
    } else if (trees.length > 0 && photoEvidence.length === 0) {
      actions.push({
        title: "Request Photo Update",
        text: "Get visual proof from the plantation.",
        href: "/dashboard/tree-operations",
        icon: <CameraIcon />,
        priority: 1,
      });
    }

    return actions.sort((a, b) => a.priority - b.priority).slice(0, 7);
  }, [
    trees.length,
    activeOperation,
    walletBalance,
    membershipStatus,
    gpsEvidence.length,
    photoEvidence.length,
  ]);

  const missionStats = useMemo(() => {
    const total = operationRequests.length;

    const pending = operationRequests.filter((mission) =>
      ["PENDING", "REQUESTED", "PAID", "PROCESSING"].includes(
        normalize(mission.status || mission.assignment_status),
      ),
    ).length;

    const active = operationRequests.filter((mission) =>
      ["ASSIGNED", "IN_PROGRESS"].includes(
        normalize(mission.status || mission.assignment_status),
      ),
    ).length;

    const completed = operationRequests.filter((mission) =>
      ["COMPLETED", "APPROVED", "DONE"].includes(
        normalize(mission.status || mission.assignment_status),
      ),
    ).length;

    return { total, pending, active, completed };
  }, [operationRequests]);

  const missionLogs = useMemo(() => {
    return operationRequests
      .map((mission) => ({
        id: `mission-log-${mission.id}`,
        title: cleanLabel(
          mission.service_name ||
            mission.operation_type ||
            mission.service_type ||
            mission.request_type ||
            "Tree Mission",
        ),
        detail: normalize(
          mission.status || mission.assignment_status || "PENDING",
        ).replaceAll("_", " "),
        date:
          mission.completed_at ||
          mission.created_at ||
          mission.requested_at ||
          null,
        href: "/dashboard/tree-operations",
      }))
      .sort(
        (a, b) =>
          new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
      )
      .slice(0, 8);
  }, [operationRequests]);

  if (loading) {
    return (
      <main className="dashboardPage">
        <div className="loadingBox">Loading customer dashboard...</div>
        <style>{styles}</style>
      </main>
    );
  }

  return (
    <main className="dashboardPage">
      <section className="contentShell">
        <header className="hero">
          <div>
            <p className="eyebrow">{getHourGreeting()}</p>
            <h1>
              Welcome back, <span>{firstName}</span>
            </h1>
            <p>
              Your Arganwood portfolio connects you to the plantation from
              anywhere.
            </p>
            {errorMessage && <div className="errorBox">{errorMessage}</div>}
          </div>

          <div className="heroCards">
            <MiniCard
              label="Membership"
              value={membershipStatus.replaceAll("_", " ")}
            />
            <MiniCard label="Investment Balance" value={peso(walletBalance)} />
          </div>
        </header>

        <section className="overviewGrid">
          <OverviewCard
            label="Mission Total"
            value={String(missionStats.total)}
            note="All service missions"
            icon={<ServiceIcon />}
          />
          <OverviewCard
            label="Pending Missions"
            value={String(missionStats.pending)}
            note="Awaiting admin action"
            icon={<ClockIcon />}
          />
          <OverviewCard
            label="Active Missions"
            value={String(missionStats.active)}
            note="Assigned or in progress"
            icon={<TrackIcon />}
          />
          <OverviewCard
            label="Completed Missions"
            value={String(missionStats.completed)}
            note="Approved field work"
            icon={<PulseIcon />}
          />
        </section>

        <section className="mainGrid">
          <article className="carePlanPanel">
            <div className="panelTop">
              <div>
                <p className="eyebrow">Tree Care Plan</p>
                <h2>Next Care Action</h2>
              </div>
              <StatusPill
                value={
                  treeCarePlan.hasTree
                    ? treeCarePlan.recommendedAction
                    : "Portfolio Setup"
                }
              />
            </div>

            <div className="carePlanBody">
              <CareInfo label="Current Stage" value={treeCarePlan.stage} />
              <CareInfo
                label="Current Condition"
                value={treeCarePlan.condition}
              />
              <CareInfo
                label="Next Recommended Action"
                value={treeCarePlan.recommendedAction}
                highlight
              />
            </div>

            <div className="whyBox">
              <strong>Why this matters</strong>
              <p>{treeCarePlan.reason}</p>
            </div>

            <div className="buttonRow">
              <Link href="/dashboard/my-trees">View Care Plan</Link>
              <Link href="/dashboard/tree-operations">
                Request Tree Service
              </Link>
            </div>
          </article>

          <article className="plantationPanel">
            <div className="panelTop">
              <div>
                <p className="eyebrow">Plantation Overview</p>
                <h2>Remote Forest Connection</h2>
              </div>
            </div>

            <div className="plantationPhoto">
              <div className="visualCard">
                <small>Owned Trees</small>
                <strong>{trees.length}</strong>
                <p>{overallStatus}</p>
              </div>
            </div>
          </article>
        </section>

        <section className="splitGrid">
          <article className="panel treesPanel">
            <div className="panelTop">
              <div>
                <p className="eyebrow">Your Trees</p>
                <h2>Portfolio Preview</h2>
              </div>
              <Link className="smallLink" href="/dashboard/my-trees">
                View All Trees
              </Link>
            </div>

            {trees.length === 0 ? (
              <EmptyState text="No trees in your portfolio yet. Start by buying a tree from the marketplace." />
            ) : (
              <div className="treePhotoGrid">
                {trees.slice(0, 4).map((tree) => {
                  const treeImageUrl = getTreeImageUrl(tree);

                  return (
                    <Link
                      className="treePhotoCard"
                      href="/dashboard/my-trees"
                      key={tree.id}
                    >
                      <div className="treePhoto">
                        {treeImageUrl ? (
                          <img src={treeImageUrl} alt={treeLabel(tree)} />
                        ) : (
                          <TreeIcon />
                        )}
                      </div>
                      <div className="treePhotoInfo">
                        <span>{tree.tree_code || "Tree Code Pending"}</span>
                        <h3>{treeLabel(tree)}</h3>
                        <p>{treeStatus(tree, healthEvidence)}</p>
                        <small>
                          {formatDate(
                            latestTreeUpdate(
                              tree,
                              photoEvidence,
                              gpsEvidence,
                              healthEvidence,
                            ),
                          )}
                        </small>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </article>

          <article className="panel logsPanel">
            <div className="panelTop">
              <div>
                <p className="eyebrow">Mission Logs</p>
                <h2>Operation History</h2>
              </div>
              <StatusPill
                value={`${missionStats.completed}/${missionStats.total} Complete`}
              />
            </div>

            {missionLogs.length === 0 ? (
              <EmptyState text="No mission logs yet. Requested tree services will appear here." />
            ) : (
              <div className="recentList compactLogs">
                {missionLogs.slice(0, 5).map((item) => (
                  <Link href={item.href} className="recentRow" key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <span>{formatDate(item.date)}</span>
                  </Link>
                ))}
              </div>
            )}
          </article>
        </section>

        <section className="panel explorePanel fullExplore">
          <div className="panelTop">
            <div>
              <p className="eyebrow">Explore</p>
              <h2>Discover everything you can do with your plantation.</h2>
            </div>
          </div>

          <div className="actionGrid centeredExplore">
            {smartActions.map((action) => (
              <Link
                className="actionCard exploreCard"
                href={action.href}
                key={`${action.title}-${action.href}`}
              >
                <span>{action.icon}</span>
                <div>
                  <strong>{action.title}</strong>
                  <p>{action.text}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </section>

      <style>{styles}</style>
    </main>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="miniCard">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function OverviewCard({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: ReactNode;
}) {
  return (
    <article className="overviewCard">
      <span>{icon}</span>
      <div>
        <p>{label}</p>
        <h3>{value}</h3>
        <small>{note}</small>
      </div>
    </article>
  );
}

function CareInfo({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`careInfo ${highlight ? "highlight" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  return <span className="statusPill">{value}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="emptyState">{text}</div>;
}

function IconShell({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24">{children}</svg>;
}

function TreeIcon() {
  return (
    <IconShell>
      <path d="M12 3c-3 3-5 6-5 9a5 5 0 0 0 10 0c0-3-2-6-5-9Z" />
      <path d="M12 14v7M8 21h8" />
    </IconShell>
  );
}

function MarketIcon() {
  return (
    <IconShell>
      <path d="M5 8h14l-1.5 12h-11L5 8Z" />
      <path d="M8 8a4 4 0 0 1 8 0" />
    </IconShell>
  );
}

function ServiceIcon() {
  return (
    <IconShell>
      <path d="M12 3v4" />
      <path d="M7 7h10l-1 13H8L7 7Z" />
      <path d="M9 11h6M9 15h6" />
    </IconShell>
  );
}

function SellIcon() {
  return (
    <IconShell>
      <path d="M4 12h14" />
      <path d="m13 7 5 5-5 5" />
      <path d="M5 5h6M5 19h6" />
    </IconShell>
  );
}

function WalletIcon() {
  return (
    <IconShell>
      <path d="M4 7h16v12H4V7Z" />
      <path d="M16 12h4v4h-4a2 2 0 0 1 0-4Z" />
      <path d="M6 7V5h12v2" />
    </IconShell>
  );
}

function MembershipIcon() {
  return (
    <IconShell>
      <path d="M12 3 4 7l8 4 8-4-8-4Z" />
      <path d="M4 12l8 4 8-4" />
      <path d="M4 17l8 4 8-4" />
    </IconShell>
  );
}

function SupportIcon() {
  return (
    <IconShell>
      <path d="M5 12a7 7 0 0 1 14 0v5a2 2 0 0 1-2 2h-3" />
      <path d="M7 13v-2M17 13v-2" />
      <path d="M10 19h4" />
    </IconShell>
  );
}

function PulseIcon() {
  return (
    <IconShell>
      <path d="M4 13h4l2-6 4 10 2-4h4" />
    </IconShell>
  );
}

function ClockIcon() {
  return (
    <IconShell>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </IconShell>
  );
}

function PinIcon() {
  return (
    <IconShell>
      <path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </IconShell>
  );
}

function CameraIcon() {
  return (
    <IconShell>
      <path d="M4 7h4l1.5-2h5L16 7h4v12H4V7Z" />
      <circle cx="12" cy="13" r="3.5" />
    </IconShell>
  );
}

function TrackIcon() {
  return (
    <IconShell>
      <path d="M4 18V6" />
      <path d="M4 6h8l1 3h7v8h-8l-1-3H4" />
    </IconShell>
  );
}

function findTree(treeId: any, trees: TreeRow[]) {
  if (!treeId) return null;
  return trees.find((tree) => String(tree.id) === String(treeId)) || null;
}

function treeLabel(tree: TreeRow | null | undefined) {
  if (!tree) return "Selected tree";
  return (
    tree.custom_name ||
    tree.display_name ||
    tree.tree_code ||
    "Arganwood Seedling"
  );
}

function getTreeImageUrl(tree: TreeRow): string | undefined {
  if (typeof tree.image_url === "string" && tree.image_url.trim().length > 0) {
    return tree.image_url;
  }

  if (typeof tree.photo_url === "string" && tree.photo_url.trim().length > 0) {
    return tree.photo_url;
  }

  return undefined;
}

function treeStatus(tree: TreeRow, healthRows: EvidenceRow[]) {
  const relatedHealth = healthRows.find(
    (row) => row.tree_id && String(row.tree_id) === String(tree.id),
  );
  const health = normalize(
    relatedHealth?.health_status || tree.health_status || tree.status,
  );

  if (!relatedHealth && !tree.health_status) return "Pending Evidence";
  if (
    health.includes("CRITICAL") ||
    health.includes("TREATMENT") ||
    health.includes("MONITOR") ||
    health.includes("NEEDS")
  ) {
    return "Needs Attention";
  }
  if (health.includes("PENDING")) return "Monitoring";
  return "Healthy";
}

function latestTreeUpdate(
  tree: TreeRow,
  photos: EvidenceRow[],
  gps: EvidenceRow[],
  health: EvidenceRow[],
) {
  const values = [
    tree.updated_at,
    tree.created_at,
    ...photos
      .filter((row) => String(row.tree_id || "") === String(tree.id))
      .map((row) => row.created_at || row.updated_at),
    ...gps
      .filter((row) => String(row.tree_id || "") === String(tree.id))
      .map((row) => row.created_at || row.updated_at),
    ...health
      .filter((row) => String(row.tree_id || "") === String(tree.id))
      .map((row) => row.created_at || row.updated_at),
  ];

  return latestDate(values);
}

function latestDate(values: any[]) {
  const dates = values
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (dates.length === 0) return null;
  return dates.sort((a, b) => b.getTime() - a.getTime())[0].toISOString();
}

function careReason(action: string) {
  const text = normalize(action);

  if (text.includes("GPS")) {
    return "Verifies the physical tree location and protects the customer’s ownership record.";
  }

  if (text.includes("PHOTO")) {
    return "Creates visual proof of the tree’s current condition.";
  }

  if (text.includes("WATER")) {
    return "Supports healthy establishment and reduces stress during early growth.";
  }

  if (text.includes("FERTILIZER")) {
    return "Supports root development and long-term growth.";
  }

  if (text.includes("HEALTH")) {
    return "Detects early signs of stress, disease, or treatment needs.";
  }

  if (text.includes("BUY")) {
    return "Start by buying or selecting a tree to activate its care plan.";
  }

  return "Keeps your plantation record current and helps Admin coordinate the next field action.";
}

const styles = `
  * { box-sizing: border-box; }

  .dashboardPage {
    min-height: 100vh;
    display: block;
    background:
      radial-gradient(circle at 20% 0%, rgba(214,178,94,.18), transparent 28%),
      radial-gradient(circle at 92% 8%, rgba(64,130,86,.18), transparent 34%),
      linear-gradient(180deg, #06110d 0%, #0b1f17 48%, #04100b 100%);
    color: #f8f1d8;
    font-family: Arial, Helvetica, sans-serif;
    overflow-x: hidden;
  }

  svg {
    width: 21px;
    height: 21px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .sideNav {
    min-height: 100vh;
    padding: 22px;
    border-right: 1px solid rgba(214,178,94,.16);
    background: rgba(0,0,0,.22);
    backdrop-filter: blur(18px);
    position: sticky;
    top: 0;
  }

  .brandBlock {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }

  .brandMark,
  .avatarMark {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: 14px;
    background: linear-gradient(135deg, #d6b25e, #8c6a3c);
    color: #07140f;
    font-weight: 950;
  }

  .brandBlock strong {
    display: block;
    color: #fff8dc;
  }

  .brandBlock span {
    display: block;
    margin-top: 2px;
    color: rgba(248,241,216,.52);
    font-size: 12px;
    font-weight: 800;
  }

  .sideNav nav {
    display: grid;
    gap: 8px;
  }

  .sideLink,
  .logoutButton {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    border: 1px solid transparent;
    border-radius: 16px;
    padding: 12px 13px;
    color: rgba(248,241,216,.70);
    text-decoration: none;
    background: transparent;
    font-weight: 850;
    cursor: pointer;
  }

  .sideLink:hover,
  .sideLink.active {
    color: #fff8dc;
    border-color: rgba(214,178,94,.20);
    background: rgba(214,178,94,.10);
  }

  .logoutButton {
    margin-top: 22px;
    border-color: rgba(214,178,94,.12);
  }

  .contentShell {
    min-width: 0;
    padding: 24px;
    max-width: 1240px;
    width: 100%;
    margin: 0 auto;
  }

  .loadingBox {
    grid-column: 1 / -1;
    margin: 28px;
    min-height: 70vh;
    display: grid;
    place-items: center;
    border-radius: 28px;
    border: 1px solid rgba(214,178,94,.20);
    background: rgba(255,255,255,.075);
    color: #fff8dc;
    font-weight: 950;
  }

  .hero,
  .overviewCard,
  .carePlanPanel,
  .plantationPanel,
  .panel,
  .miniCard,
  .errorBox,
  .emptyState {
    border: 1px solid rgba(214,178,94,.18);
    background: rgba(255,255,255,.075);
    backdrop-filter: blur(18px);
    box-shadow: 0 24px 70px rgba(0,0,0,.30);
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 420px;
    gap: 18px;
    align-items: stretch;
    border-radius: 30px;
    padding: 28px;
    margin-bottom: 18px;
    background:
      linear-gradient(rgba(2,20,12,.72), rgba(2,20,12,.88)),
      url('/images/agarwood-real-tree.jpg');
    background-size: cover;
    background-position: center;
  }

  .eyebrow {
    margin: 0 0 10px;
    color: #d6b25e;
    font-weight: 950;
    text-transform: uppercase;
    letter-spacing: .16em;
    font-size: 12px;
  }

  .hero h1 {
    margin: 0;
    color: #fff8dc;
    font-size: clamp(36px, 5vw, 58px);
    line-height: .95;
    letter-spacing: -2px;
  }

  .hero h1 span {
    color: #d6b25e;
  }

  .hero p {
    max-width: 760px;
    margin: 16px 0 0;
    color: rgba(248,241,216,.76);
    line-height: 1.65;
    font-weight: 750;
  }

  .heroCards {
    display: grid;
    gap: 12px;
  }

  .miniCard {
    border-radius: 22px;
    padding: 18px;
    background: rgba(0,0,0,.24);
  }

  .miniCard p {
    margin: 0;
    color: rgba(248,241,216,.55);
    font-size: 11px;
    font-weight: 950;
    text-transform: uppercase;
    letter-spacing: .14em;
  }

  .miniCard strong {
    display: block;
    margin-top: 10px;
    color: #fff8dc;
    font-size: clamp(20px, 3vw, 27px);
    overflow-wrap: anywhere;
  }

  .errorBox {
    margin-top: 14px;
    border-radius: 16px;
    padding: 14px;
    color: #ffd5cd;
    background: rgba(125,35,25,.26);
  }

  .overviewGrid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 18px;
  }

  .overviewCard {
    min-width: 0;
    border-radius: 24px;
    padding: 18px;
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }

  .overviewCard > span,
  .actionCard > span,
  .timelineItem > span {
    width: 42px;
    height: 42px;
    border-radius: 15px;
    display: grid;
    place-items: center;
    color: #d6b25e;
    background: rgba(214,178,94,.13);
    border: 1px solid rgba(214,178,94,.16);
    flex: 0 0 auto;
  }

  .overviewCard p {
    margin: 0;
    color: rgba(248,241,216,.54);
    font-size: 11px;
    font-weight: 950;
    text-transform: uppercase;
    letter-spacing: .12em;
  }

  .overviewCard h3 {
    margin: 8px 0 4px;
    color: #fff8dc;
    font-size: 25px;
    overflow-wrap: anywhere;
  }

  .overviewCard small {
    color: #d6b25e;
    font-weight: 850;
  }

  .mainGrid,
  .splitGrid {
    display: grid;
    grid-template-columns: minmax(0, 1.08fr) minmax(0, .92fr);
    gap: 18px;
    margin-bottom: 18px;
  }

  .splitGrid.bottom {
    align-items: start;
  }

  .carePlanPanel,
  .plantationPanel,
  .panel {
    border-radius: 30px;
    padding: 22px;
    min-width: 0;
    overflow: hidden;
  }

  .panelTop {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 14px;
    margin-bottom: 18px;
  }

  .panelTop h2 {
    margin: 0;
    color: #fff8dc;
    font-size: clamp(24px, 3vw, 34px);
    letter-spacing: -.8px;
  }

  .smallLink,
  .buttonRow a {
    border-radius: 999px;
    padding: 11px 14px;
    color: #07140f;
    background: linear-gradient(135deg, #d6b25e, #8c6a3c);
    text-decoration: none;
    font-weight: 950;
    white-space: nowrap;
  }

  .statusPill {
    border-radius: 999px;
    padding: 9px 12px;
    color: #ffe49a;
    background: rgba(214,178,94,.12);
    border: 1px solid rgba(214,178,94,.22);
    font-size: 12px;
    font-weight: 950;
  }

  .carePlanBody {
    display: grid;
    gap: 12px;
  }

  .careInfo,
  .whyBox,
  .treeCard,
  .timelineItem,
  .actionCard,
  .recentRow {
    border-radius: 18px;
    background: rgba(0,0,0,.22);
    border: 1px solid rgba(214,178,94,.12);
  }

  .careInfo {
    padding: 15px;
  }

  .careInfo span {
    display: block;
    color: rgba(248,241,216,.55);
    font-size: 11px;
    font-weight: 950;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  .careInfo strong {
    display: block;
    margin-top: 7px;
    color: #fff8dc;
    font-size: 18px;
  }

  .careInfo.highlight strong {
    color: #d6b25e;
  }

  .whyBox {
    padding: 16px;
    margin-top: 14px;
  }

  .whyBox strong {
    color: #fff8dc;
  }

  .whyBox p {
    margin: 6px 0 0;
    color: rgba(248,241,216,.67);
    line-height: 1.55;
  }

  .buttonRow {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 16px;
  }

  .buttonRow a:nth-child(2) {
    background: rgba(255,255,255,.09);
    color: #fff8dc;
    border: 1px solid rgba(214,178,94,.20);
  }

  .plantationPhoto {
    position: relative;
    min-height: 360px;
    overflow: hidden;
    border-radius: 24px;
    background:
      linear-gradient(180deg, rgba(3,18,11,.15), rgba(3,18,11,.86)),
      url('/images/agarwood-real-tree.jpg');
    background-size: cover;
    background-position: center;
    border: 1px solid rgba(214,178,94,.18);
  }

  .visualCard {
    position: absolute;
    left: 18px;
    bottom: 18px;
    border-radius: 20px;
    padding: 16px;
    min-width: 170px;
    background: rgba(3,20,13,.72);
    border: 1px solid rgba(214,178,94,.24);
    backdrop-filter: blur(12px);
  }

  .visualCard small {
    color: rgba(248,241,216,.55);
    font-weight: 950;
    text-transform: uppercase;
    letter-spacing: .12em;
  }

  .visualCard strong {
    display: block;
    color: #fff8dc;
    font-size: 44px;
    line-height: 1;
    margin-top: 8px;
  }

  .visualCard p {
    margin: 8px 0 0;
    color: #d6b25e;
    font-weight: 950;
  }

  .treePhotoGrid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }

  .treePhotoCard {
    min-width: 0;
    overflow: hidden;
    border-radius: 22px;
    background: rgba(0,0,0,.22);
    border: 1px solid rgba(214,178,94,.18);
    color: inherit;
    text-decoration: none;
  }

  .treePhoto {
    height: 150px;
    display: grid;
    place-items: center;
    color: #d6b25e;
    background: rgba(214,178,94,.12);
  }

  .treePhoto img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .treePhotoInfo {
    padding: 14px;
  }

  .treePhotoInfo span {
    color: #d6b25e;
    font-size: 12px;
    font-weight: 950;
  }

  .treePhotoInfo h3 {
    margin: 5px 0;
    color: #fff8dc;
    font-size: 17px;
  }

  .treePhotoInfo p {
    display: inline-block;
    margin: 4px 0 8px;
    padding: 5px 9px;
    border-radius: 999px;
    background: rgba(85,160,75,.22);
    color: #caff94;
    font-size: 12px;
    font-weight: 950;
  }

  .treePhotoInfo small {
    display: block;
    color: rgba(248,241,216,.62);
    font-weight: 800;
  }

  .treeGrid,
  .actionGrid,
  .timelineList,
  .recentList {
    display: grid;
    gap: 12px;
  }

  .treeCard {
    color: inherit;
    text-decoration: none;
    padding: 14px;
    display: grid;
    grid-template-columns: 78px minmax(0, 1fr) auto;
    gap: 14px;
    align-items: center;
  }

  .treeImage {
    width: 78px;
    height: 78px;
    border-radius: 18px;
    display: grid;
    place-items: center;
    color: #d6b25e;
    background: rgba(214,178,94,.12);
    overflow: hidden;
  }

  .treeImage img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .treeCard span {
    color: #d6b25e;
    font-size: 12px;
    font-weight: 950;
  }

  .treeCard h3 {
    margin: 4px 0;
    color: #fff8dc;
    font-size: 18px;
  }

  .treeCard p,
  .treeMeta small,
  .timelineItem p,
  .timelineItem small,
  .actionCard p,
  .recentRow p,
  .recentRow span {
    color: rgba(248,241,216,.58);
  }

  .treeCard p {
    margin: 0;
    font-size: 13px;
  }

  .treeMeta {
    text-align: right;
  }

  .treeMeta b {
    display: block;
    color: #fff8dc;
    margin-bottom: 5px;
  }

  .treeMeta small {
    display: block;
    font-size: 12px;
    margin-top: 3px;
  }

  .timelineItem,
  .actionCard,
  .recentRow {
    color: inherit;
    text-decoration: none;
  }

  .timelineItem,
  .actionCard {
    display: grid;
    grid-template-columns: 46px minmax(0, 1fr);
    gap: 12px;
    padding: 14px;
  }

  .timelineItem strong,
  .actionCard strong,
  .recentRow strong {
    color: #fff8dc;
  }

  .timelineItem p,
  .actionCard p,
  .recentRow p {
    margin: 5px 0 0;
    line-height: 1.45;
    font-size: 13px;
  }

  .timelineItem small {
    display: block;
    margin-top: 5px;
    font-weight: 800;
  }

  .actionGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .recentRow {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    padding: 14px;
  }

  .recentRow span {
    white-space: nowrap;
    font-size: 12px;
    font-weight: 850;
  }

  .emptyState {
    border-radius: 20px;
    padding: 22px;
    color: rgba(248,241,216,.65);
    font-weight: 850;
    background: rgba(0,0,0,.22);
  }



  .centeredExplore {
    align-items: stretch;
  }

  .exploreCard {
    min-height: 150px;
    place-items: center;
    text-align: center;
  }

  .exploreCard > span {
    margin: 0 auto;
    width: 58px;
    height: 58px;
    border-radius: 22px;
  }

  .exploreCard p {
    max-width: 230px;
    margin-left: auto;
    margin-right: auto;
  }


  .fullExplore {
    margin-bottom: 24px;
  }

  .compactLogs .recentRow:nth-child(n+6) {
    display: none;
  }

  @media (max-width: 1220px) {
    .dashboardPage {
      grid-template-columns: 1fr;
    }

    .sideNav {
      position: static;
      min-height: auto;
      border-right: 0;
      border-bottom: 1px solid rgba(214,178,94,.14);
    }

    .sideNav nav {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .logoutButton {
      max-width: 220px;
    }

    .hero,
    .mainGrid,
    .splitGrid {
      grid-template-columns: 1fr;
    }

    .treePhotoGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .overviewGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 720px) {
    .contentShell {
      padding: 16px;
    }

    .sideNav {
      padding: 16px;
    }

    .sideNav nav,
    .overviewGrid,
    .actionGrid,
    .treePhotoGrid {
      grid-template-columns: 1fr;
    }

    .hero {
      padding: 22px;
    }

    .panelTop,
    .recentRow {
      flex-direction: column;
    }

    .treeCard {
      grid-template-columns: 70px minmax(0, 1fr);
    }

    .treeMeta {
      grid-column: 1 / -1;
      text-align: left;
    }

    .buttonRow a,
    .smallLink {
      width: 100%;
      text-align: center;
    }
  }
`;
