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

type WalletTransaction = {
  id: string;
  transaction_type: string | null;
  amount: number | null;
  status: string | null;
  description: string | null;
  created_at: string | null;
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


function peso(value: number) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalize(value: any) {
  return String(value || "").trim().replace(/\s+/g, "_").toUpperCase();
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


const referenceTreeImages = [
  "/images/arganwood-reference/tree-card-reference-1.png",
  "/images/arganwood-reference/tree-card-reference-2.png",
  "/images/arganwood-reference/tree-card-reference-3.png",
  "/images/arganwood-reference/tree-card-reference-4.png",
];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [groups, setGroups] = useState<Row[]>([]);
  const [operationRequests, setOperationRequests] = useState<TreeOperationRequest[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [membershipOrders, setMembershipOrders] = useState<Row[]>([]);
  const [sellTreeRequests, setSellTreeRequests] = useState<Row[]>([]);
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
        ? await supabase.from("profiles").select("*").eq("email", email).limit(1).maybeSingle()
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
        transactionRows,
        membershipRows,
        sellRows,
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
            .limit(1)
        ),

        safeRows(
          "trees",
          supabase
            .from("trees")
            .select("*")
            .or(profileFilter)
            .order("created_at", { ascending: false })
        ),

        safeRows(
          "tree_groups",
          supabase
            .from("tree_groups")
            .select("*")
            .or(profileFilter)
            .order("created_at", { ascending: false })
        ),

        safeRows(
          "tree_operation_requests",
          supabase
            .from("tree_operation_requests")
            .select("*")
            .or(profileFilter)
            .order("created_at", { ascending: false })
            .limit(20)
        ),

        safeRows(
          "wallet_transactions",
          supabase
            .from("wallet_transactions")
            .select("id, transaction_type, amount, status, description, created_at")
            .eq("profile_id", activeProfile.id)
            .order("created_at", { ascending: false })
            .limit(8)
        ),

        safeRows(
          "membership_orders",
          supabase
            .from("membership_orders")
            .select("*")
            .eq("profile_id", activeProfile.id)
            .order("created_at", { ascending: false })
            .limit(6)
        ),

        safeRows(
          "sell_tree_requests",
          supabase
            .from("sell_tree_requests")
            .select("*")
            .or(profileFilter)
            .order("created_at", { ascending: false })
            .limit(6)
        ),

        safeRows(
          "tree_photo_updates",
          supabase
            .from("tree_photo_updates")
            .select("*")
            .eq("customer_profile_id", activeProfile.id)
            .in("status", ["APPROVED", "COMPLETED"])
            .order("created_at", { ascending: false })
            .limit(10)
        ),

        safeRows(
          "tree_gps_logs",
          supabase
            .from("tree_gps_logs")
            .select("*")
            .eq("customer_profile_id", activeProfile.id)
            .in("status", ["APPROVED", "COMPLETED"])
            .order("created_at", { ascending: false })
            .limit(10)
        ),

        safeRows(
          "tree_health_reports",
          supabase
            .from("tree_health_reports")
            .select("*")
            .eq("customer_profile_id", activeProfile.id)
            .in("status", ["APPROVED", "COMPLETED"])
            .order("created_at", { ascending: false })
            .limit(10)
        ),
      ]);

      setWallet((walletRows?.[0] as Wallet) || null);
      setTrees((treeRows || []) as TreeRow[]);
      setGroups(groupRows || []);
      setOperationRequests((operationRows || []) as TreeOperationRequest[]);
      setWalletTransactions((transactionRows || []) as WalletTransaction[]);
      setMembershipOrders(membershipRows || []);
      setSellTreeRequests(sellRows || []);
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

  const displayName = profile?.full_name || profile?.email || "Arganwood Investor";
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
    const hasEvidence = photoEvidence.length > 0 || gpsEvidence.length > 0 || healthEvidence.length > 0;
    if (!hasEvidence) return "Pending Evidence";

    const health = normalize(latestHealth?.health_status || latestHealth?.issue_severity || latestHealth?.issue_summary);
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
  }, [photoEvidence.length, gpsEvidence.length, healthEvidence.length, latestHealth]);

  const missionSummary = useMemo(() => {
    const counts = {
      pending: 0,
      assigned: 0,
      active: 0,
      completed: 0,
    };

    operationRequests.forEach((operation) => {
      const status = missionStatus(operation);

      if (status === "COMPLETED") {
        counts.completed += 1;
      } else if (status === "ASSIGNED") {
        counts.assigned += 1;
      } else if (status === "IN_PROGRESS") {
        counts.active += 1;
      } else {
        counts.pending += 1;
      }
    });

    return counts;
  }, [operationRequests]);

  const missionLogs = useMemo(() => {
    return operationRequests
      .map((operation) => {
        const tree = findTree(operation.tree_id, trees);

        return {
          id: operation.id,
          mission: cleanLabel(
            operation.service_name ||
              operation.operation_type ||
              operation.service_type ||
              operation.request_type ||
              operation.item_name ||
              "Tree Mission",
          ),
          tree: treeLabel(tree) || operation.group_id || "Forest Mission",
          status: missionStatus(operation),
          date: operation.completed_at || operation.created_at || operation.requested_at || null,
        };
      })
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, 5);
  }, [operationRequests, trees]);

  const exploreActions = useMemo(
    () => [
      {
        title: "Marketplace",
        text: "Buy trees, packages, and care supplies.",
        href: "/dashboard/marketplace",
        image: "/images/arganwood-reference/explore-marketplace.png",
        icon: <MarketIcon />,
      },
      {
        title: "My Trees",
        text: "Open your owned plantation portfolio.",
        href: "/dashboard/my-trees",
        image: "/images/arganwood-reference/explore-my-trees.png",
        icon: <TreeIcon />,
      },
      {
        title: "Tree Services",
        text: "Request GPS, photo, health, or field work.",
        href: "/dashboard/tree-operations",
        image: "/images/arganwood-reference/explore-tree-services.png",
        icon: <ServiceIcon />,
      },
      {
        title: "Membership",
        text: "Manage customer access and renewals.",
        href: "/dashboard/membership",
        image: "/images/arganwood-reference/explore-membership.png",
        icon: <MembershipIcon />,
      },
      {
        title: "Wallet",
        text: "Manage balance, cash-in, and withdrawals.",
        href: "/dashboard/wallet",
        image: "/images/arganwood-reference/explore-wallet.png",
        icon: <WalletIcon />,
      },
      {
        title: "Investments",
        text: "Track investment balance and portfolio value.",
        href: "/dashboard/investments",
        image: "/images/arganwood-reference/explore-investments.png",
        icon: <PulseIcon />,
      },
      {
        title: "Support",
        text: "Contact support for account help.",
        href: "/dashboard/support",
        image: "/images/arganwood-reference/explore-support.png",
        icon: <SupportIcon />,
      },
      {
        title: "Sell Tree",
        text: "Request review for eligible tree sale.",
        href: "/dashboard/sell-tree",
        image: "/images/arganwood-reference/explore-sell-tree.png",
        icon: <SellIcon />,
      },
    ],
    [],
  );

  const recentActivity = useMemo(() => {
    return walletTransactions
      .map((tx) => ({
        id: `wallet-${tx.id}`,
        title: cleanLabel(tx.transaction_type || "Wallet Transaction"),
        detail: `${peso(Number(tx.amount || 0))} • ${normalize(tx.status || "COMPLETED")}`,
        date: tx.created_at,
        href: "/dashboard/wallet",
      }))
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, 6);
  }, [walletTransactions]);


  const latestMembershipOrder = useMemo(() => {
    return [...membershipOrders].sort(
      (a, b) => new Date(b.created_at || b.submitted_at || 0).getTime() - new Date(a.created_at || a.submitted_at || 0).getTime(),
    )[0] || null;
  }, [membershipOrders]);

  const latestSellTreeRequest = useMemo(() => {
    return [...sellTreeRequests].sort(
      (a, b) => new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime(),
    )[0] || null;
  }, [sellTreeRequests]);

  const pendingMembershipOrdersCount = useMemo(() => {
    return membershipOrders.filter((order) => normalize(order.status || "PENDING") === "PENDING").length;
  }, [membershipOrders]);

  const activeSellTreeRequestsCount = useMemo(() => {
    return sellTreeRequests.filter((request) => {
      const status = normalize(request.status || request.offer_status || "PENDING");
      return !["PAID", "COMPLETED", "CANCELLED", "CANCELED", "REJECTED"].includes(status);
    }).length;
  }, [sellTreeRequests]);

  const latestWalletTransaction = walletTransactions[0] || null;
  const latestWalletTransactionText = latestWalletTransaction
    ? `${cleanLabel(latestWalletTransaction.transaction_type || "Wallet Transaction")} • ${peso(Number(latestWalletTransaction.amount || 0))}`
    : "No transaction yet";
  const latestMembershipOrderStatus = cleanLabel(latestMembershipOrder?.status || "No membership order yet");
  const latestMembershipOrderDate = latestMembershipOrder?.created_at || latestMembershipOrder?.submitted_at || null;
  const latestSellTreeRequestStatus = cleanLabel(latestSellTreeRequest?.status || latestSellTreeRequest?.offer_status || "No sell tree request yet");
  const latestSellTreeAmount = Number(latestSellTreeRequest?.net_receive || latestSellTreeRequest?.tree_value || 0);
  const latestSellTreeAmountText = latestSellTreeAmount > 0 ? peso(latestSellTreeAmount) : "No amount yet";

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
            <p>Your Arganwood portfolio connects you to the plantation from anywhere.</p>
            {errorMessage && <div className="errorBox">{errorMessage}</div>}
          </div>

          <div className="heroCards">
            <MiniCard label="Membership" value={membershipStatus.replaceAll("_", " ")} />
            <MiniCard label="Investment Balance" value={peso(walletBalance)} />
          </div>
        </header>

        <section className="overviewGrid">
          <OverviewCard label="Total Trees" value={String(trees.length)} note="Owned seedlings" icon={<TreeIcon />} />
          <OverviewCard label="Plantations" value={String(groups.length || uniqueGroupCount(trees))} note="Forest groups" icon={<PlantationIcon />} />
          <OverviewCard label="Overall Status" value={overallStatus} note="Based on approved evidence" icon={<PulseIcon />} />
          <OverviewCard label="Latest Update" value={formatDate(latestEvidenceDate)} note="Farm proof or operation" icon={<ClockIcon />} />
        </section>

        <section className="panel financeSummaryPanel">
          <div className="panelTop">
            <div>
              <p className="eyebrow">Finance Summary</p>
              <h2>Live Wallet Snapshot</h2>
            </div>
            <Link className="smallLink" href="/dashboard/wallet">Open Wallet</Link>
          </div>

          <div className="missionSummaryGrid">
            <OverviewCard label="Wallet Balance" value={peso(walletBalance)} note="From wallets.balance" icon={<WalletIcon />} />
            <OverviewCard label="Latest Transaction" value={latestWalletTransactionText} note={latestWalletTransaction ? formatDate(latestWalletTransaction.created_at) : "No wallet activity"} icon={<PulseIcon />} />
            <OverviewCard label="Pending Membership Orders" value={String(pendingMembershipOrdersCount)} note="From membership_orders" icon={<MembershipIcon />} />
            <OverviewCard label="Active Sell Tree Requests" value={String(activeSellTreeRequestsCount)} note="From sell_tree_requests" icon={<SellIcon />} />
          </div>
        </section>

        <section className="splitGrid statusSplitGrid">
          <article className="panel">
            <div className="panelTop">
              <div>
                <p className="eyebrow">Latest Membership Activity</p>
                <h2>Membership Status</h2>
              </div>
              <Link className="smallLink" href="/dashboard/membership">View Membership</Link>
            </div>

            {!latestMembershipOrder ? (
              <EmptyState text="No membership order yet" />
            ) : (
              <Link className="recentRow" href="/dashboard/membership">
                <div>
                  <strong>{latestMembershipOrderStatus}</strong>
                  <p>{peso(Number(latestMembershipOrder.amount || latestMembershipOrder.annual_fee || 0))}</p>
                </div>
                <span>{formatDate(latestMembershipOrderDate)}</span>
              </Link>
            )}
          </article>

          <article className="panel">
            <div className="panelTop">
              <div>
                <p className="eyebrow">Sell Tree Status</p>
                <h2>Latest Sell Request</h2>
              </div>
              <Link className="smallLink" href="/dashboard/sell-tree">View Sell Tree</Link>
            </div>

            {!latestSellTreeRequest ? (
              <EmptyState text="No sell tree request yet" />
            ) : (
              <Link className="recentRow" href="/dashboard/sell-tree">
                <div>
                  <strong>{latestSellTreeRequestStatus}</strong>
                  <p>{latestSellTreeAmountText}</p>
                </div>
                <span>{formatDate(latestSellTreeRequest.created_at || latestSellTreeRequest.updated_at)}</span>
              </Link>
            )}
          </article>
        </section>

        <section className="panel missionSummaryPanel">
          <div className="panelTop">
            <div>
              <p className="eyebrow">Mission Summary</p>
              <h2>Mission Engine</h2>
            </div>
            <Link className="smallLink" href="/dashboard/tree-operations">View All Missions</Link>
          </div>

          <div className="missionSummaryGrid">
            <OverviewCard label="Pending Missions" value={String(missionSummary.pending)} note="Awaiting admin action" icon={<ServiceIcon />} />
            <OverviewCard label="Assigned Missions" value={String(missionSummary.assigned)} note="Assigned to gardener" icon={<SupportIcon />} />
            <OverviewCard label="Active Missions" value={String(missionSummary.active)} note="In progress field work" icon={<TrackIcon />} />
            <OverviewCard label="Completed Missions" value={String(missionSummary.completed)} note="Approved field work" icon={<PulseIcon />} />
          </div>
        </section>

        <section className="splitGrid">
          <article className="panel">
            <div className="panelTop">
              <div>
                <p className="eyebrow">Your Trees</p>
                <h2>Portfolio Preview</h2>
              </div>
              <Link className="smallLink" href="/dashboard/my-trees">View All Trees</Link>
            </div>

            {trees.length === 0 ? (
              <EmptyState text="No trees in your portfolio yet. Start by buying a tree from the marketplace." />
            ) : (
              <div className="treeGrid">
                {trees.slice(0, 4).map((tree, index) => {
                  const treeImageUrl = getTreeImageUrl(tree) || referenceTreeImages[index % referenceTreeImages.length];

                  return (
                    <Link className="treeCard" href="/dashboard/my-trees" key={tree.id}>
                      <div className="treeImage">
                        <img src={treeImageUrl} alt={treeLabel(tree)} />
                      </div>
                      <div>
                        <span>{tree.tree_code || "Tree Code Pending"}</span>
                        <h3>{treeLabel(tree)}</h3>
                        <p>{forestName(tree, groupMap)}</p>
                      </div>
                      <div className="treeMeta">
                        <b>{treeStatus(tree, healthEvidence)}</b>
                        <small>{formatDate(latestTreeUpdate(tree, photoEvidence, gpsEvidence, healthEvidence))}</small>
                        <small>QR: {cleanLabel(tree.qr_tag_status || (tree.tree_qr_url ? "Available" : "Pending"))}</small>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </article>

          <article className="panel missionLogsPanel">
            <div className="panelTop">
              <div>
                <p className="eyebrow">Mission Logs</p>
                <h2>Operation History</h2>
              </div>
              <Link className="smallLink" href="/dashboard/tree-operations">View All Logs</Link>
            </div>

            {missionLogs.length === 0 ? (
              <EmptyState text="No mission logs yet. Requested tree services will appear here." />
            ) : (
              <div className="missionLogTable">
                <div className="missionLogHeader">
                  <span>Mission</span>
                  <span>Tree / Plantation</span>
                  <span>Status</span>
                  <span>Date</span>
                  <span>Action</span>
                </div>

                {missionLogs.map((log) => (
                  <Link className="missionRow" href="/dashboard/tree-operations" key={log.id}>
                    <strong>{log.mission}</strong>
                    <span>{log.tree}</span>
                    <MissionStatusPill value={log.status} />
                    <span>{formatDate(log.date)}</span>
                    <span className="viewMission">View</span>
                  </Link>
                ))}
              </div>
            )}
          </article>
        </section>

        <section className="panel recentFinancePanel">
          <div className="panelTop">
            <div>
              <p className="eyebrow">Finance Sync</p>
              <h2>Recent Finance Activity</h2>
            </div>
            <Link className="smallLink" href="/dashboard/wallet">Open Wallet</Link>
          </div>

          {recentActivity.length === 0 ? (
            <EmptyState text="No wallet transactions yet. Cash-in approvals, purchases, and withdrawals will appear here." />
          ) : (
            <div className="recentList">
              {recentActivity.map((activity) => (
                <Link className="recentRow" href={activity.href} key={activity.id}>
                  <div>
                    <strong>{activity.title}</strong>
                    <p>{activity.detail}</p>
                  </div>
                  <span>{formatDate(activity.date)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="panel explorePanel">
          <div className="panelTop">
            <div>
              <p className="eyebrow">Explore</p>
              <h2>Discover Your Arganwood Tools</h2>
            </div>
          </div>

          <div className="exploreGrid">
            {exploreActions.map((action) => (
              <Link className="exploreCard" href={action.href} key={action.href}>
                <div className="exploreImage">
                  <img src={action.image} alt={action.title} />
                  <span>{action.icon}</span>
                </div>
                <strong>{action.title}</strong>
                <p>{action.text}</p>
              </Link>
            ))}
          </div>
        </section>
      </section>

      <style>{styles}</style>
    </main>
  );
}

function SideLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link className={`sideLink ${active ? "active" : ""}`} href={href}>
      {icon}
      <span>{label}</span>
    </Link>
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



function MissionStatusPill({ value }: { value: string }) {
  return <span className={`missionStatus ${normalize(value).toLowerCase()}`}>{cleanLabel(value)}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="emptyState">{text}</div>;
}


function IconShell({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24">{children}</svg>;
}

function GridIcon() {
  return <IconShell><path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" /></IconShell>;
}

function TreeIcon() {
  return <IconShell><path d="M12 3c-3 3-5 6-5 9a5 5 0 0 0 10 0c0-3-2-6-5-9Z" /><path d="M12 14v7M8 21h8" /></IconShell>;
}

function PlantationIcon() {
  return <IconShell><path d="M4 18c4-5 12-5 16 0" /><path d="M7 15c3-4 7-4 10 0" /><path d="M12 3v12" /><path d="M8 7c2-3 6-3 8 0" /></IconShell>;
}

function MarketIcon() {
  return <IconShell><path d="M5 8h14l-1.5 12h-11L5 8Z" /><path d="M8 8a4 4 0 0 1 8 0" /></IconShell>;
}

function ServiceIcon() {
  return <IconShell><path d="M12 3v4" /><path d="M7 7h10l-1 13H8L7 7Z" /><path d="M9 11h6M9 15h6" /></IconShell>;
}

function SellIcon() {
  return <IconShell><path d="M4 12h14" /><path d="m13 7 5 5-5 5" /><path d="M5 5h6M5 19h6" /></IconShell>;
}

function WalletIcon() {
  return <IconShell><path d="M4 7h16v12H4V7Z" /><path d="M16 12h4v4h-4a2 2 0 0 1 0-4Z" /><path d="M6 7V5h12v2" /></IconShell>;
}

function MembershipIcon() {
  return <IconShell><path d="M12 3 4 7l8 4 8-4-8-4Z" /><path d="M4 12l8 4 8-4" /><path d="M4 17l8 4 8-4" /></IconShell>;
}

function SupportIcon() {
  return <IconShell><path d="M5 12a7 7 0 0 1 14 0v5a2 2 0 0 1-2 2h-3" /><path d="M7 13v-2M17 13v-2" /><path d="M10 19h4" /></IconShell>;
}

function SettingsIcon() {
  return <IconShell><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.8-1L14.4 3h-4.8l-.3 3.1a7 7 0 0 0-1.8 1l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.8 1l.3 3.1h4.8l.3-3.1a7 7 0 0 0 1.8-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z" /></IconShell>;
}

function LogoutIcon() {
  return <IconShell><path d="M10 4H5v16h5" /><path d="M14 8l4 4-4 4" /><path d="M18 12H9" /></IconShell>;
}

function PulseIcon() {
  return <IconShell><path d="M4 13h4l2-6 4 10 2-4h4" /></IconShell>;
}

function ClockIcon() {
  return <IconShell><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></IconShell>;
}

function PinIcon() {
  return <IconShell><path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12Z" /><circle cx="12" cy="9" r="2.5" /></IconShell>;
}

function CameraIcon() {
  return <IconShell><path d="M4 7h4l1.5-2h5L16 7h4v12H4V7Z" /><circle cx="12" cy="13" r="3.5" /></IconShell>;
}

function QrIcon() {
  return <IconShell><path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Z" /><path d="M14 14h2v2h-2v-2Zm4 0h2v6h-2v-6Zm-4 4h2v2h-2v-2Z" /></IconShell>;
}

function TrackIcon() {
  return <IconShell><path d="M4 18V6" /><path d="M4 6h8l1 3h7v8h-8l-1-3H4" /></IconShell>;
}

function findTree(treeId: any, trees: TreeRow[]) {
  if (!treeId) return null;
  return trees.find((tree) => String(tree.id) === String(treeId)) || null;
}

function treeLabel(tree: TreeRow | null | undefined) {
  if (!tree) return "Selected tree";
  return tree.custom_name || tree.display_name || tree.tree_code || "Arganwood Seedling";
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

function missionStatus(operation: TreeOperationRequest) {
  const status = normalize(operation.status || operation.assignment_status);

  if (status.includes("COMPLETE") || status.includes("APPROVED") || status.includes("DONE")) {
    return "COMPLETED";
  }

  if (status.includes("PROGRESS") || status.includes("STARTED") || status.includes("WORKING")) {
    return "IN_PROGRESS";
  }

  if (status.includes("ASSIGNED")) {
    return "ASSIGNED";
  }

  if (status.includes("CANCEL") || status.includes("REJECT")) {
    return "CANCELLED";
  }

  return "PENDING";
}

function forestName(tree: TreeRow, groupMap: Map<string, Row>) {
  const group = tree.group_id ? groupMap.get(String(tree.group_id)) : null;
  return group?.forest_name || group?.group_name || group?.block_name || tree.tree_group_name || "Customer Plantation";
}

function treeStatus(tree: TreeRow, healthRows: EvidenceRow[]) {
  const relatedHealth = healthRows.find((row) => row.tree_id && String(row.tree_id) === String(tree.id));
  const health = normalize(relatedHealth?.health_status || tree.health_status || tree.status);

  if (!relatedHealth && !tree.health_status) return "Pending Evidence";
  if (health.includes("CRITICAL") || health.includes("TREATMENT") || health.includes("MONITOR") || health.includes("NEEDS")) {
    return "Needs Attention";
  }
  if (health.includes("PENDING")) return "Monitoring";
  return "Healthy";
}

function latestTreeUpdate(tree: TreeRow, photos: EvidenceRow[], gps: EvidenceRow[], health: EvidenceRow[]) {
  const values = [
    tree.updated_at,
    tree.created_at,
    ...photos.filter((row) => String(row.tree_id || "") === String(tree.id)).map((row) => row.created_at || row.updated_at),
    ...gps.filter((row) => String(row.tree_id || "") === String(tree.id)).map((row) => row.created_at || row.updated_at),
    ...health.filter((row) => String(row.tree_id || "") === String(tree.id)).map((row) => row.created_at || row.updated_at),
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

function uniqueGroupCount(trees: TreeRow[]) {
  return new Set(trees.map((tree) => tree.group_id).filter(Boolean)).size;
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
    display: grid;
    grid-template-columns: 1fr;
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
    max-width: 1500px;
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
      url('/images/arganwood-reference/hero-forest-reference.jpg');
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

  .forestVisual {
    position: relative;
    min-height: 360px;
    overflow: hidden;
    border-radius: 24px;
    background:
      linear-gradient(180deg, rgba(7,31,24,.15), rgba(5,22,12,.96)),
      radial-gradient(circle at 50% 20%, rgba(214,178,94,.25), transparent 18%),
      linear-gradient(180deg, #143026, #0b2418);
    border: 1px solid rgba(214,178,94,.14);
  }

  .orb {
    position: absolute;
    top: 42px;
    left: 50%;
    width: 130px;
    height: 130px;
    transform: translateX(-50%);
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,235,180,.68), rgba(214,178,94,.17) 55%, transparent 70%);
  }

  .hill {
    position: absolute;
    bottom: 92px;
    width: 70%;
    height: 180px;
    background: linear-gradient(135deg, rgba(8,45,30,.92), rgba(3,16,11,.98));
    clip-path: polygon(0 100%, 50% 12%, 100% 100%);
  }

  .h1 { left: -14%; }
  .h2 { right: -18%; height: 140px; opacity: .74; }

  .forestRows {
    position: absolute;
    inset: auto 0 0;
    height: 170px;
    display: flex;
    align-items: flex-end;
    justify-content: space-around;
  }

  .forestRows span {
    position: relative;
    width: 10px;
    height: 70px;
    border-radius: 999px 999px 0 0;
    background: #4b2f17;
  }

  .forestRows span:before,
  .forestRows span:after {
    content: "";
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 50%;
    background: linear-gradient(145deg, #3d7a43, #11351f);
  }

  .forestRows span:before {
    top: -38px;
    width: 50px;
    height: 48px;
  }

  .forestRows span:after {
    top: -62px;
    width: 38px;
    height: 38px;
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


  .missionSummaryPanel,
  .financeSummaryPanel,
  .statusSplitGrid {
    margin-bottom: 18px;
  }

  .missionSummaryGrid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }

  .missionLogsPanel {
    min-height: 100%;
  }

  .missionLogTable {
    display: grid;
    gap: 0;
    overflow: hidden;
    border-radius: 20px;
    border: 1px solid rgba(214,178,94,.12);
    background: rgba(0,0,0,.18);
  }

  .missionLogHeader,
  .missionRow {
    display: grid;
    grid-template-columns: 1.25fr 1.2fr .8fr .9fr .55fr;
    gap: 12px;
    align-items: center;
    padding: 13px 14px;
  }

  .missionLogHeader {
    color: rgba(248,241,216,.58);
    font-size: 11px;
    font-weight: 950;
    letter-spacing: .12em;
    text-transform: uppercase;
    border-bottom: 1px solid rgba(214,178,94,.13);
  }

  .missionRow {
    color: inherit;
    text-decoration: none;
    border-bottom: 1px solid rgba(214,178,94,.10);
  }

  .missionRow:last-child {
    border-bottom: 0;
  }

  .missionRow strong {
    color: #fff8dc;
  }

  .missionRow span {
    color: rgba(248,241,216,.68);
    font-size: 13px;
    font-weight: 800;
  }

  .missionStatus {
    width: fit-content;
    border-radius: 999px;
    padding: 6px 9px;
    color: #ffe49a !important;
    border: 1px solid rgba(214,178,94,.24);
    background: rgba(214,178,94,.12);
    font-size: 11px !important;
    font-weight: 950 !important;
  }

  .missionStatus.completed {
    color: #b7ff8a !important;
    border-color: rgba(111,214,94,.24);
    background: rgba(111,214,94,.12);
  }

  .missionStatus.assigned,
  .missionStatus.in_progress {
    color: #9edcff !important;
    border-color: rgba(94,171,214,.24);
    background: rgba(94,171,214,.12);
  }

  .missionStatus.cancelled {
    color: #ffb2a4 !important;
    border-color: rgba(214,94,94,.24);
    background: rgba(214,94,94,.12);
  }

  .viewMission {
    color: #d6b25e !important;
    text-align: right;
  }

  .explorePanel {
    margin-bottom: 18px;
  }

  .exploreGrid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }

  .exploreCard {
    display: grid;
    min-height: 190px;
    align-content: start;
    gap: 10px;
    color: inherit;
    text-decoration: none;
    border-radius: 22px;
    padding: 12px;
    border: 1px solid rgba(214,178,94,.14);
    background: rgba(0,0,0,.22);
  }

  .exploreImage {
    position: relative;
    min-height: 98px;
    display: grid;
    place-items: center;
    overflow: hidden;
    border-radius: 17px;
    background: rgba(214,178,94,.10);
  }

  .exploreImage img {
    display: block;
    width: 100%;
    height: 118px;
    object-fit: cover;
    opacity: .92;
  }

  .exploreImage span {
    position: absolute;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border-radius: 16px;
    color: #d6b25e;
    background: rgba(3,20,13,.72);
    border: 1px solid rgba(214,178,94,.22);
    backdrop-filter: blur(10px);
  }

  .exploreCard strong {
    color: #fff8dc;
    text-align: center;
  }

  .exploreCard p {
    margin: 0;
    color: rgba(248,241,216,.62);
    text-align: center;
    font-size: 12px;
    line-height: 1.45;
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

    .overviewGrid,
    .missionSummaryGrid,
    .exploreGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .missionLogHeader {
      display: none;
    }

    .missionRow {
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .viewMission {
      text-align: left;
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
    .missionSummaryGrid,
    .exploreGrid,
    .actionGrid {
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