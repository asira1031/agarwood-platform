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

type FeedItem = {
  id: string;
  title: string;
  detail: string;
  date: string | null;
  href: string;
  icon: ReactNode;
  amount?: string;
};

const referenceTreeImages = [
  "/images/arganwood-reference/tree-card-reference-1.png",
  "/images/arganwood-reference/tree-card-reference-2.png",
  "/images/arganwood-reference/tree-card-reference-3.png",
  "/images/arganwood-reference/tree-card-reference-4.png",
];

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

function formatDateTime(value: any) {
  if (!value) return "No date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "No date";

  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
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
          "wallet_transactions",
          supabase
            .from("wallet_transactions")
            .select("id, transaction_type, amount, status, description, created_at")
            .eq("profile_id", activeProfile.id)
            .order("created_at", { ascending: false })
            .limit(8),
        ),
        safeRows(
          "membership_orders",
          supabase
            .from("membership_orders")
            .select("*")
            .eq("profile_id", activeProfile.id)
            .order("created_at", { ascending: false })
            .limit(6),
        ),
        safeRows(
          "sell_tree_requests",
          supabase
            .from("sell_tree_requests")
            .select("*")
            .or(profileFilter)
            .order("created_at", { ascending: false })
            .limit(6),
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
  const initials = getInitials(displayName);
  const membershipStatus = normalize(profile?.membership_status || "INACTIVE");
  const kycStatus = normalize(profile?.kyc_status || "PENDING");
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
  const latestTransaction = walletTransactions[0] || null;
  const latestMembership = membershipOrders[0] || null;
  const latestSellTree = sellTreeRequests[0] || null;

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

  const totalMissions =
    missionSummary.pending + missionSummary.assigned + missionSummary.active + missionSummary.completed;

  const completedMissionRate =
    totalMissions > 0 ? Math.round((missionSummary.completed / totalMissions) * 100) : 0;

  const recentMissionLogs = useMemo(() => {
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

  const pendingMembershipOrders = membershipOrders.filter(
    (order) => normalize(order.status || order.payment_status) === "PENDING",
  ).length;

  const activeSellTreeRequests = sellTreeRequests.filter((request) =>
    ["PENDING", "OFFER_SENT", "ACCEPTED", "PROCESSING"].includes(
      normalize(request.status || request.offer_status),
    ),
  ).length;

  const activityFeed = useMemo<FeedItem[]>(() => {
    const walletRows = walletTransactions.slice(0, 4).map((tx) => ({
      id: `wallet-${tx.id}`,
      title: cleanLabel(tx.transaction_type || "Wallet Transaction"),
      detail: tx.description || normalize(tx.status || "COMPLETED").replaceAll("_", " "),
      date: tx.created_at,
      href: "/dashboard/wallet",
      icon: <WalletIcon />,
      amount: peso(Number(tx.amount || 0)),
    }));

    const missionRows = recentMissionLogs.slice(0, 3).map((log) => ({
      id: `mission-${log.id}`,
      title: log.mission,
      detail: `${log.tree} • ${cleanLabel(log.status)}`,
      date: log.date,
      href: "/dashboard/tree-operations",
      icon: <ServiceIcon />,
    }));

    const membershipRows = membershipOrders.slice(0, 2).map((order) => ({
      id: `membership-${order.id}`,
      title: "Membership Activity",
      detail: `${cleanLabel(order.status || "Pending")} • ${peso(Number(order.amount || order.annual_fee || 0))}`,
      date: order.created_at || order.submitted_at,
      href: "/dashboard/membership",
      icon: <MembershipIcon />,
    }));

    const sellRows = sellTreeRequests.slice(0, 2).map((request) => ({
      id: `sell-${request.id}`,
      title: "Sell Tree Activity",
      detail: cleanLabel(request.status || request.offer_status || "Pending"),
      date: request.created_at || request.updated_at,
      href: "/dashboard/sell-tree",
      icon: <SellIcon />,
      amount:
        request.net_receive || request.tree_value || request.offer_price
          ? peso(Number(request.net_receive || request.tree_value || request.offer_price || 0))
          : undefined,
    }));

    return [...walletRows, ...missionRows, ...membershipRows, ...sellRows]
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, 10);
  }, [walletTransactions, recentMissionLogs, membershipOrders, sellTreeRequests]);

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
        title: "Tree Operations",
        text: "Request GPS, photos, health checks, and field care.",
        href: "/dashboard/tree-operations",
        image: "/images/arganwood-reference/explore-tree-services.png",
        icon: <ServiceIcon />,
      },
      {
        title: "My Trees",
        text: "View your owned forest portfolio and proof updates.",
        href: "/dashboard/my-trees",
        image: "/images/arganwood-reference/explore-my-trees.png",
        icon: <TreeIcon />,
      },
      {
        title: "Membership",
        text: "Manage annual access and platform status.",
        href: "/dashboard/membership",
        image: "/images/arganwood-reference/explore-membership.png",
        icon: <MembershipIcon />,
      },
      {
        title: "Wallet",
        text: "Cash-in, withdraw, and review transactions.",
        href: "/dashboard/wallet",
        image: "/images/arganwood-reference/explore-wallet.png",
        icon: <WalletIcon />,
      },
      {
        title: "Support",
        text: "Chat with support about account concerns.",
        href: "/dashboard/support",
        image: "/images/arganwood-reference/explore-support.png",
        icon: <SupportIcon />,
      },
    ],
    [],
  );

  if (loading) {
    return (
      <main className="appPage">
        <div className="loadingCard">
          <div className="loadingMark">A</div>
          <strong>Loading your Arganwood app...</strong>
          <span>Syncing wallet, trees, missions, and activity.</span>
        </div>
        <style>{styles}</style>
      </main>
    );
  }

  return (
    <main className="appPage">
      <section className="appShell">
        <header className="topBar">
          <div className="greetingBlock">
            <span className="miniEyebrow">{getHourGreeting()}</span>
            <h1>Hi, {firstName}</h1>
            <p>Your Arganwood home is live, synced, and ready.</p>
          </div>

          <div className="topActions">
            <Link className="walletMini" href="/dashboard/wallet">
              <span>Wallet</span>
              <strong>{peso(walletBalance)}</strong>
            </Link>

            <Link className="topIcon" href="/dashboard/transactions" aria-label="Notifications and transactions">
              <BellIcon />
            </Link>

            <Link className="profilePill" href="/dashboard/profile">
              <span>{initials}</span>
              <div>
                <strong>{displayName}</strong>
                <small>KYC {cleanLabel(kycStatus)}</small>
              </div>
            </Link>
          </div>
        </header>

        {errorMessage && <div className="alert">{errorMessage}</div>}

        <section className="walletHero">
          <div className="walletGlow" />
          <div className="walletPattern" />

          <div className="walletInfo">
            <p>Available Balance</p>
            <h2>{peso(walletBalance)}</h2>
            <span>
              {membershipStatus === "ACTIVE"
                ? "Membership active • Your forest wallet is ready"
                : "Membership needs attention • Tap Membership to continue"}
            </span>
          </div>

          <div className="walletStatusStack">
            <div>
              <small>Membership</small>
              <strong>{cleanLabel(membershipStatus)}</strong>
            </div>
            <div>
              <small>KYC</small>
              <strong>{cleanLabel(kycStatus)}</strong>
            </div>
          </div>
        </section>

        <section className="quickActions" aria-label="Quick actions">
          <Link href="/dashboard/wallet">
            <span><WalletIcon /></span>
            <strong>Add Funds</strong>
          </Link>

          <Link href="/dashboard/wallet">
            <span><SellIcon /></span>
            <strong>Withdraw</strong>
          </Link>

          <Link href="/dashboard/wallet">
            <span><BellIcon /></span>
            <strong>Transactions</strong>
          </Link>

          <Link href="/dashboard/marketplace">
            <span><MarketIcon /></span>
            <strong>Marketplace</strong>
          </Link>
        </section>

        <section className="missionSpotlight">
          <div className="missionCopy">
            <p className="miniEyebrow">Mission Progress</p>
            <h2>{completedMissionRate}% complete</h2>
            <span>
              {totalMissions > 0
                ? `${missionSummary.completed} of ${totalMissions} care mission(s) completed.`
                : "No care missions yet. Start a care request from Tree Operations."}
            </span>
          </div>

          <div className="missionTrack">
            <span style={{ width: `${completedMissionRate}%` }} />
          </div>

          <div className="missionStats">
            <InfoChip label="Pending" value={String(missionSummary.pending)} />
            <InfoChip label="Assigned" value={String(missionSummary.assigned)} />
            <InfoChip label="Active" value={String(missionSummary.active)} />
            <InfoChip label="Done" value={String(missionSummary.completed)} />
          </div>

          <Link className="missionCta" href="/dashboard/tree-operations">
            Open Tree Operations
          </Link>
        </section>

        <section className="metricGrid">
          <MetricCard
            title="Trees"
            value={String(trees.length)}
            note={`${groups.length || uniqueGroupCount(trees)} forest group(s)`}
            href="/dashboard/my-trees"
            icon={<TreeIcon />}
          />

          <MetricCard
            title="Missions"
            value={String(totalMissions)}
            note={`${completedMissionRate}% completed`}
            href="/dashboard/tree-operations"
            icon={<ServiceIcon />}
          />

          <MetricCard
            title="Earnings"
            value={latestTransaction ? peso(Number(latestTransaction.amount || 0)) : peso(0)}
            note={latestTransaction ? cleanLabel(latestTransaction.transaction_type) : "No transaction yet"}
            href="/dashboard/wallet"
            icon={<WalletIcon />}
          />

          <MetricCard
            title="Membership"
            value={cleanLabel(membershipStatus)}
            note={`${pendingMembershipOrders} pending order(s)`}
            href="/dashboard/membership"
            icon={<MembershipIcon />}
          />
        </section>

        <section className="contentGrid">
          <section className="feedPanel">
            <div className="sectionHead">
              <div>
                <p className="miniEyebrow">Live Feed</p>
                <h2>What changed recently</h2>
              </div>
              <Link href="/dashboard/wallet">View wallet</Link>
            </div>

            {activityFeed.length === 0 ? (
              <EmptyState text="No activity yet. Wallet transactions, missions, membership, and sell tree updates will appear here." />
            ) : (
              <div className="feedList">
                {activityFeed.map((item) => (
                  <Link className="feedItem" href={item.href} key={item.id}>
                    <span className="feedIcon">{item.icon}</span>

                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                      <small>{formatDateTime(item.date)}</small>
                    </div>

                    {item.amount && <b>{item.amount}</b>}
                  </Link>
                ))}
              </div>
            )}
          </section>

          <aside className="sideStack">
            <section className="statusCard">
              <p className="miniEyebrow">Account Health</p>
              <h2>{cleanLabel(membershipStatus)}</h2>
              <p>Your account status controls withdrawals, sell tree access, and platform privileges.</p>

              <div className="statusRows">
                <InfoChip label="KYC" value={cleanLabel(kycStatus)} />
                <InfoChip label="Latest proof" value={formatDate(latestEvidenceDate)} />
                <InfoChip
                  label="Sell requests"
                  value={activeSellTreeRequests > 0 ? `${activeSellTreeRequests} active` : "None active"}
                />
              </div>

              <Link href="/dashboard/profile">Manage profile</Link>
            </section>

            <section className="miniMissionLog">
              <div className="sectionHead compact">
                <div>
                  <p className="miniEyebrow">Mission Logs</p>
                  <h2>Field updates</h2>
                </div>
                <Link href="/dashboard/tree-operations">Open</Link>
              </div>

              <div className="missionMiniList">
                {recentMissionLogs.slice(0, 4).map((log) => (
                  <Link href="/dashboard/tree-operations" key={log.id}>
                    <strong>{log.mission}</strong>
                    <span>{cleanLabel(log.status)} • {formatDate(log.date)}</span>
                  </Link>
                ))}

                {recentMissionLogs.length === 0 && (
                  <div className="softEmpty">No mission logs yet.</div>
                )}
              </div>
            </section>
          </aside>
        </section>

        <section className="treePreviewPanel">
          <div className="sectionHead">
            <div>
              <p className="miniEyebrow">Forest Preview</p>
              <h2>Your living portfolio</h2>
            </div>
            <Link href="/dashboard/my-trees">View all trees</Link>
          </div>

          {trees.length === 0 ? (
            <EmptyState text="No trees yet. Start from Marketplace to activate your forest portfolio." />
          ) : (
            <div className="treeScroller">
              {trees.slice(0, 6).map((tree, index) => {
                const latestTreePhoto = photoEvidence.find((row) => String(row.tree_id || "") === String(tree.id));
                const treeImageUrl = getTreeImageUrl(tree, latestTreePhoto) || referenceTreeImages[index % referenceTreeImages.length];

                return (
                  <Link className="treeCard" href="/dashboard/my-trees" key={tree.id}>
                    <div className="treeImage">
                      <img src={treeImageUrl} alt={treeLabel(tree)} />
                    </div>

                    <div>
                      <small>{tree.tree_code || "Tree Code Pending"}</small>
                      <strong>{treeLabel(tree)}</strong>
                      <span>{forestName(tree, groupMap)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="explorePanel">
          <div className="sectionHead">
            <div>
              <p className="miniEyebrow">Explore Arganwood</p>
              <h2>Everything you can do next</h2>
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

function MetricCard({
  title,
  value,
  note,
  href,
  icon,
}: {
  title: string;
  value: string;
  note: string;
  href: string;
  icon: ReactNode;
}) {
  return (
    <Link className="metricCard" href={href}>
      <span>{icon}</span>
      <div>
        <p>{title}</p>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </Link>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="infoChip">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="emptyState">{text}</div>;
}

function IconShell({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24">{children}</svg>;
}

function BellIcon() {
  return <IconShell><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></IconShell>;
}

function TreeIcon() {
  return <IconShell><path d="M12 3c-3 3-5 6-5 9a5 5 0 0 0 10 0c0-3-2-6-5-9Z" /><path d="M12 14v7M8 21h8" /></IconShell>;
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

function findTree(treeId: any, trees: TreeRow[]) {
  if (!treeId) return null;
  return trees.find((tree) => String(tree.id) === String(treeId)) || null;
}

function treeLabel(tree: TreeRow | null | undefined) {
  if (!tree) return "Selected tree";
  return tree.custom_name || tree.display_name || tree.tree_code || "Arganwood Seedling";
}

function getTreeImageUrl(tree: TreeRow, latestPhoto?: EvidenceRow | null): string | undefined {
  if (typeof latestPhoto?.photo_url === "string" && latestPhoto.photo_url.trim().length > 0) return latestPhoto.photo_url;
  if (typeof latestPhoto?.image_url === "string" && latestPhoto.image_url.trim().length > 0) return latestPhoto.image_url;
  if (typeof tree.image_url === "string" && tree.image_url.trim().length > 0) return tree.image_url;
  if (typeof tree.photo_url === "string" && tree.photo_url.trim().length > 0) return tree.photo_url;
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

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const styles = `
  * {
    box-sizing: border-box;
  }

  .appPage {
    min-height: 100vh;
    padding: 16px;
    color: #15291e;
    font-family: Arial, Helvetica, sans-serif;
    background:
      radial-gradient(circle at 12% -4%, rgba(214, 178, 94, .22), transparent 28%),
      radial-gradient(circle at 92% 0%, rgba(34, 113, 70, .16), transparent 30%),
      linear-gradient(180deg, #fffaf0 0%, #f7f0df 42%, #eef5e9 100%);
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

  .appShell {
    max-width: 1380px;
    margin: 0 auto;
    display: grid;
    gap: 18px;
  }

  .topBar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 12px 0 6px;
    background: linear-gradient(180deg, rgba(255,250,240,.92), rgba(255,250,240,.54));
    backdrop-filter: blur(18px);
  }

  .greetingBlock h1 {
    margin: 0;
    color: #10251a;
    font-size: clamp(30px, 4vw, 48px);
    line-height: .98;
    letter-spacing: -1.6px;
  }

  .greetingBlock p {
    margin: 6px 0 0;
    color: #647166;
    font-weight: 780;
  }

  .miniEyebrow {
    display: block;
    color: #9a7738;
    font-size: 11px;
    font-weight: 950;
    letter-spacing: .14em;
    text-transform: uppercase;
  }

  .topActions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .walletMini,
  .topIcon,
  .profilePill {
    color: #173225;
    text-decoration: none;
    border: 1px solid rgba(32, 71, 50, .10);
    background: rgba(255, 255, 255, .78);
    box-shadow: 0 14px 34px rgba(31, 57, 38, .09);
    backdrop-filter: blur(12px);
  }

  .walletMini {
    display: grid;
    gap: 3px;
    border-radius: 20px;
    padding: 9px 13px;
    min-width: 150px;
  }

  .walletMini span {
    color: #768073;
    font-size: 11px;
    font-weight: 950;
    letter-spacing: .10em;
    text-transform: uppercase;
  }

  .walletMini strong {
    color: #173f2a;
    font-size: 15px;
  }

  .topIcon {
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    border-radius: 18px;
  }

  .profilePill {
    min-width: 220px;
    display: flex;
    gap: 10px;
    align-items: center;
    border-radius: 22px;
    padding: 8px 11px;
  }

  .profilePill > span {
    width: 38px;
    height: 38px;
    border-radius: 15px;
    display: grid;
    place-items: center;
    color: #fff8dc;
    background: linear-gradient(135deg, #214c34, #0d2b1b);
    font-weight: 950;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.22);
  }

  .profilePill strong,
  .profilePill small {
    display: block;
    max-width: 145px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .profilePill strong {
    font-size: 13px;
  }

  .profilePill small {
    color: #778272;
    font-size: 11px;
    font-weight: 850;
  }

  .alert {
    border-radius: 22px;
    padding: 15px 17px;
    color: #7a241c;
    background: #ffe8df;
    border: 1px solid rgba(145, 42, 28, .12);
    font-weight: 900;
  }

  .walletHero {
    position: relative;
    min-height: 330px;
    overflow: hidden;
    border-radius: 38px;
    padding: clamp(26px, 5vw, 46px);
    color: white;
    background:
      radial-gradient(circle at 84% 12%, rgba(255, 225, 150, .44), transparent 28%),
      radial-gradient(circle at 6% 100%, rgba(97, 202, 136, .22), transparent 32%),
      linear-gradient(135deg, #194b31 0%, #0a2417 56%, #06150e 100%);
    box-shadow:
      0 36px 90px rgba(24, 67, 42, .28),
      inset 0 1px 0 rgba(255,255,255,.12);
    display: grid;
    grid-template-columns: minmax(0, 1fr) 260px;
    align-items: end;
    gap: 18px;
  }

  .walletHero:before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      linear-gradient(120deg, rgba(255,255,255,.10), transparent 34%),
      repeating-linear-gradient(115deg, rgba(255,255,255,.035) 0 1px, transparent 1px 13px);
    pointer-events: none;
  }

  .walletGlow {
    position: absolute;
    right: -120px;
    top: -160px;
    width: 480px;
    height: 480px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(214,178,94,.34), transparent 62%);
    filter: blur(2px);
  }

  .walletPattern {
    position: absolute;
    right: 24px;
    bottom: -120px;
    width: 340px;
    height: 340px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,.12);
    background: radial-gradient(circle, rgba(255,255,255,.08), transparent 63%);
  }

  .walletInfo,
  .walletStatusStack {
    position: relative;
    z-index: 1;
  }

  .walletInfo p {
    margin: 0;
    color: rgba(255,255,255,.72);
    font-size: 12px;
    font-weight: 950;
    letter-spacing: .16em;
    text-transform: uppercase;
  }

  .walletInfo h2 {
    margin: 12px 0 8px;
    font-size: clamp(48px, 10vw, 86px);
    line-height: .9;
    letter-spacing: -3.2px;
  }

  .walletInfo span {
    color: #ffe49a;
    font-weight: 900;
  }

  .walletStatusStack {
    display: grid;
    gap: 10px;
    align-self: stretch;
    align-content: end;
  }

  .walletStatusStack div {
    border-radius: 22px;
    padding: 16px;
    background: rgba(255,255,255,.10);
    border: 1px solid rgba(255,255,255,.14);
    backdrop-filter: blur(14px);
  }

  .walletStatusStack small {
    display: block;
    color: rgba(255,255,255,.62);
    font-size: 11px;
    font-weight: 950;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  .walletStatusStack strong {
    display: block;
    margin-top: 6px;
    color: #fff8dc;
  }

  .quickActions {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .quickActions a {
    min-height: 92px;
    color: #173225;
    text-decoration: none;
    border-radius: 28px;
    padding: 16px;
    background: rgba(255,255,255,.86);
    border: 1px solid rgba(32,71,50,.10);
    box-shadow: 0 18px 45px rgba(31,57,38,.10);
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .quickActions a:first-child {
    background: linear-gradient(135deg, #fff8dc, #f2dfae);
  }

  .quickActions span {
    width: 48px;
    height: 48px;
    flex: 0 0 auto;
    border-radius: 18px;
    display: grid;
    place-items: center;
    color: #fff8dc;
    background: linear-gradient(135deg, #214c34, #0d2b1b);
  }

  .quickActions strong {
    font-size: 15px;
  }

  .missionSpotlight {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 280px auto;
    gap: 18px;
    align-items: center;
    border-radius: 32px;
    padding: 22px;
    background: rgba(255,255,255,.84);
    border: 1px solid rgba(32,71,50,.10);
    box-shadow: 0 18px 45px rgba(31,57,38,.10);
  }

  .missionCopy h2 {
    margin: 2px 0 6px;
    color: #10251a;
    font-size: 34px;
    letter-spacing: -1px;
  }

  .missionCopy span {
    color: #647166;
    font-weight: 800;
  }

  .missionTrack {
    height: 14px;
    overflow: hidden;
    border-radius: 999px;
    background: #dfe8d7;
  }

  .missionTrack span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #1f6b43, #d6b25e);
  }

  .missionStats {
    display: grid;
    grid-template-columns: repeat(4, minmax(74px, 1fr));
    gap: 10px;
  }

  .missionCta {
    grid-column: 1 / -1;
    justify-self: start;
    color: #173f2a;
    text-decoration: none;
    border-radius: 999px;
    padding: 11px 15px;
    background: #ecf5e8;
    border: 1px solid rgba(23,63,42,.10);
    font-weight: 950;
  }

  .metricGrid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }

  .metricCard,
  .feedPanel,
  .statusCard,
  .miniMissionLog,
  .treePreviewPanel,
  .explorePanel,
  .emptyState,
  .loadingCard {
    border: 1px solid rgba(32, 71, 50, .10);
    background: rgba(255, 255, 255, .82);
    box-shadow: 0 18px 45px rgba(31, 57, 38, .10);
    backdrop-filter: blur(18px);
  }

  .metricCard {
    position: relative;
    overflow: hidden;
    min-height: 150px;
    border-radius: 30px;
    padding: 19px;
    color: inherit;
    text-decoration: none;
    display: grid;
    align-content: space-between;
  }

  .metricCard:after {
    content: "";
    position: absolute;
    left: 19px;
    right: 19px;
    bottom: 15px;
    height: 5px;
    border-radius: 999px;
    background: linear-gradient(90deg, #1f6b43, #d6b25e);
    opacity: .85;
  }

  .metricCard > span {
    width: 46px;
    height: 46px;
    display: grid;
    place-items: center;
    border-radius: 18px;
    color: #173f2a;
    background: #ecf5e8;
    border: 1px solid rgba(23, 63, 42, .10);
    margin-bottom: 14px;
  }

  .metricCard p {
    margin: 0;
    color: #6c756c;
    font-size: 12px;
    font-weight: 950;
    letter-spacing: .10em;
    text-transform: uppercase;
  }

  .metricCard strong {
    display: block;
    margin-top: 8px;
    color: #11251a;
    font-size: 30px;
    line-height: 1.05;
    word-break: break-word;
  }

  .metricCard small {
    display: block;
    margin-top: 8px;
    padding-bottom: 10px;
    color: #9a7738;
    font-weight: 850;
  }

  .contentGrid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 420px;
    gap: 16px;
    align-items: start;
  }

  .feedPanel,
  .statusCard,
  .miniMissionLog,
  .treePreviewPanel,
  .explorePanel {
    border-radius: 32px;
    padding: 22px;
  }

  .sideStack {
    display: grid;
    gap: 16px;
  }

  .sectionHead {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: flex-start;
    margin-bottom: 16px;
  }

  .sectionHead.compact {
    margin-bottom: 12px;
  }

  .sectionHead h2,
  .statusCard h2 {
    margin: 0;
    color: #11251a;
    font-size: 27px;
    letter-spacing: -.7px;
  }

  .sectionHead p,
  .exploreCard p,
  .feedItem p,
  .statusCard p {
    color: #637165;
  }

  .sectionHead a,
  .statusCard a {
    text-decoration: none;
    border-radius: 999px;
    padding: 10px 13px;
    color: #173f2a;
    background: #ecf5e8;
    border: 1px solid rgba(23,63,42,.10);
    font-weight: 950;
    white-space: nowrap;
  }

  .feedList {
    display: grid;
    gap: 12px;
  }

  .feedItem {
    display: grid;
    grid-template-columns: 50px minmax(0, 1fr) auto;
    gap: 13px;
    align-items: center;
    color: inherit;
    text-decoration: none;
    border-radius: 26px;
    padding: 14px;
    background: #fffaf0;
    border: 1px solid rgba(32, 71, 50, .08);
  }

  .feedIcon {
    width: 50px;
    height: 50px;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    border-radius: 20px;
    color: #173f2a;
    background: #ecf5e8;
    border: 1px solid rgba(23, 63, 42, .10);
  }

  .feedItem strong {
    color: #11251a;
    font-size: 15px;
  }

  .feedItem p {
    margin: 4px 0 0;
    line-height: 1.35;
    font-size: 13px;
  }

  .feedItem small {
    display: block;
    margin-top: 5px;
    color: #8a9686;
    font-weight: 800;
  }

  .feedItem b {
    color: #173f2a;
    font-size: 14px;
    border-radius: 999px;
    padding: 8px 10px;
    background: #edf5e9;
  }

  .statusRows {
    display: grid;
    gap: 10px;
    margin-top: 15px;
  }

  .infoChip {
    border-radius: 19px;
    padding: 13px;
    background: #fffaf0;
    border: 1px solid rgba(32, 71, 50, .08);
  }

  .infoChip span {
    display: block;
    color: #748071;
    font-size: 11px;
    font-weight: 950;
    letter-spacing: .10em;
    text-transform: uppercase;
  }

  .infoChip strong {
    display: block;
    margin-top: 6px;
    color: #11251a;
  }

  .statusCard a {
    display: flex;
    justify-content: center;
    margin-top: 14px;
  }

  .missionMiniList {
    display: grid;
    gap: 10px;
  }

  .missionMiniList a {
    color: inherit;
    text-decoration: none;
    border-radius: 20px;
    padding: 13px;
    background: #fffaf0;
    border: 1px solid rgba(32,71,50,.07);
  }

  .missionMiniList strong,
  .missionMiniList span {
    display: block;
  }

  .missionMiniList strong {
    color: #11251a;
  }

  .missionMiniList span {
    margin-top: 4px;
    color: #6c756c;
    font-size: 12px;
    font-weight: 850;
  }

  .softEmpty {
    border-radius: 20px;
    padding: 14px;
    color: #748071;
    background: #fffaf0;
    font-weight: 850;
  }

  .treeScroller {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(246px, 1fr);
    gap: 13px;
    overflow-x: auto;
    padding-bottom: 4px;
    scroll-snap-type: x mandatory;
  }

  .treeCard {
    color: inherit;
    text-decoration: none;
    border-radius: 28px;
    padding: 13px;
    background: #fffaf0;
    border: 1px solid rgba(32, 71, 50, .08);
    scroll-snap-align: start;
  }

  .treeImage {
    height: 176px;
    border-radius: 24px;
    overflow: hidden;
    background: #edf5e9;
    display: grid;
    place-items: center;
    margin-bottom: 12px;
  }

  .treeImage img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .treeCard small,
  .treeCard span {
    display: block;
    color: #758072;
    font-weight: 850;
  }

  .treeCard strong {
    display: block;
    margin: 5px 0;
    color: #11251a;
    font-size: 19px;
  }

  .exploreGrid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }

  .exploreCard {
    color: inherit;
    text-decoration: none;
    border-radius: 30px;
    padding: 13px;
    background: #fffaf0;
    border: 1px solid rgba(32, 71, 50, .08);
    box-shadow: 0 10px 25px rgba(31,57,38,.05);
  }

  .exploreImage {
    position: relative;
    height: 150px;
    border-radius: 25px;
    overflow: hidden;
    background: #f8f4e8;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
    margin-bottom: 13px;
  }

  .exploreImage img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center;
    display: block;
  }

  .exploreImage span {
    position: absolute;
    right: 13px;
    bottom: 13px;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border-radius: 17px;
    color: #fff8dc;
    background: rgba(23, 63, 42, .88);
    border: 1px solid rgba(255,255,255,.18);
  }

  .exploreCard strong {
    display: block;
    color: #11251a;
    text-align: center;
    font-size: 17px;
  }

  .exploreCard p {
    margin: 7px 0 0;
    text-align: center;
    font-size: 13px;
    line-height: 1.45;
  }

  .emptyState {
    border-radius: 24px;
    padding: 20px;
    color: #6c756c;
    background: #fffaf0;
    font-weight: 850;
  }

  .loadingCard {
    min-height: 76vh;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 10px;
    border-radius: 34px;
    text-align: center;
    color: #173225;
  }

  .loadingMark {
    width: 62px;
    height: 62px;
    display: grid;
    place-items: center;
    border-radius: 22px;
    color: #fff8dc;
    background: linear-gradient(135deg, #214c34, #0d2b1b);
    font-size: 30px;
    font-weight: 950;
  }

  .loadingCard strong {
    font-size: 20px;
  }

  .loadingCard span {
    color: #6c756c;
  }

  @media (max-width: 1160px) {
    .quickActions,
    .metricGrid,
    .exploreGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .missionSpotlight {
      grid-template-columns: 1fr;
    }

    .missionStats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .contentGrid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 760px) {
    .appPage {
      padding: 12px;
    }

    .topBar {
      position: static;
      display: grid;
    }

    .topActions {
      width: 100%;
      justify-content: space-between;
      align-items: stretch;
    }

    .walletMini {
      display: none;
    }

    .profilePill {
      flex: 1;
      min-width: 0;
    }

    .walletHero {
      min-height: 360px;
      grid-template-columns: 1fr;
      border-radius: 32px;
      padding: 26px;
    }

    .walletStatusStack {
      grid-template-columns: 1fr 1fr;
    }

    .quickActions,
    .metricGrid,
    .missionStats,
    .exploreGrid {
      grid-template-columns: 1fr;
    }

    .quickActions a {
      min-height: 76px;
    }

    .sectionHead {
      display: grid;
      grid-template-columns: 1fr;
    }

    .sectionHead a {
      text-align: center;
    }

    .feedItem {
      grid-template-columns: 50px minmax(0, 1fr);
    }

    .feedItem b {
      grid-column: 2;
      justify-self: start;
    }

    .treeScroller {
      grid-auto-columns: 86%;
    }

    .exploreImage {
      height: 132px;
    }
  }
`;

