"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  membership_status: string | null;
  kyc_status: string | null;
  account_status: string | null;
  care_subscription_status?: string | null;
  care_status?: string | null;
  [key: string]: any;
};

type Wallet = {
  id: string;
  profile_id: string;
  balance: number | null;
  created_at: string | null;
};

type TreeRow = {
  id: string;
  profile_id: string;
  package_id?: string | null;
  tree_type?: string | null;
  status?: string | null;
  species?: string | null;
  code?: string | null;
  tree_code?: string | null;
  gps_verified?: boolean | null;
  created_at?: string | null;
  [key: string]: any;
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

type WalletTransaction = {
  id: string;
  transaction_type: string | null;
  amount: number | null;
  status: string | null;
  description: string | null;
  created_at: string | null;
};

type TreeOperationRequest = {
  id: string;
  profile_id?: string | null;
  tree_id?: string | null;
  operation_type?: string | null;
  service_type?: string | null;
  item_name?: string | null;
  total_amount?: number | null;
  amount?: number | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
  scheduled_date?: string | null;
  [key: string]: any;
};

function peso(value: number) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function cleanStatus(value: string | null | undefined) {
  return value ? String(value).toUpperCase() : "PENDING";
}

export default function DashboardPage() {
  const [stage, setStage] = useState(3);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [operationRequests, setOperationRequests] = useState<TreeOperationRequest[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const t = setInterval(() => {
      setStage((s) => (s >= 5 ? 1 : s + 1));
    }, 2600);

    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, []);

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
      let activeProfile: Profile | null = null;

      const { data: profileById } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .limit(1)
        .maybeSingle();

      if (profileById) {
        activeProfile = profileById as Profile;
      } else if (email) {
        const { data: profileByEmail } = await supabase
          .from("profiles")
          .select("*")
          .eq("email", email)
          .limit(1)
          .maybeSingle();

        activeProfile = (profileByEmail as Profile) || null;
      }

      if (!activeProfile) {
        setErrorMessage("Profile not found. Please contact support.");
        return;
      }

      setProfile(activeProfile);

      const walletResult = await supabase
        .from("wallets")
        .select("id, profile_id, balance, created_at")
        .eq("profile_id", activeProfile.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const treesResult = await supabase
        .from("trees")
        .select("*")
        .eq("profile_id", activeProfile.id);

      const inventoryResult = await supabase
        .from("inventory")
        .select("*")
        .eq("profile_id", activeProfile.id)
        .order("created_at", { ascending: false });

      const transactionsResult = await supabase
        .from("wallet_transactions")
        .select("id, transaction_type, amount, status, description, created_at")
        .eq("profile_id", activeProfile.id)
        .order("created_at", { ascending: false })
        .limit(6);

      const operationsResult = await supabase
        .from("tree_operation_requests")
        .select("*")
        .eq("profile_id", activeProfile.id)
        .order("created_at", { ascending: false })
        .limit(6);

      if (walletResult.error) console.warn("Wallet load error:", walletResult.error.message);
      if (treesResult.error) console.warn("Trees load error:", treesResult.error.message);
      if (inventoryResult.error) console.warn("Inventory load error:", inventoryResult.error.message);
      if (transactionsResult.error) console.warn("Transactions load error:", transactionsResult.error.message);
      if (operationsResult.error) console.warn("Operations load error:", operationsResult.error.message);

      setWallet((walletResult.data?.[0] as Wallet) || null);
      setTrees(treesResult.error ? [] : ((treesResult.data as TreeRow[]) || []));
      setInventory(inventoryResult.error ? [] : ((inventoryResult.data as InventoryItem[]) || []));
      setWalletTransactions(
        transactionsResult.error ? [] : ((transactionsResult.data as WalletTransaction[]) || [])
      );
      setOperationRequests(
        operationsResult.error ? [] : ((operationsResult.data as TreeOperationRequest[]) || [])
      );
    } catch (error: any) {
      console.error("Dashboard load error:", error);
      setErrorMessage(error?.message || "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const displayName = profile?.full_name || profile?.email || "Agarwood Investor";
  const initials = getInitials(displayName);

  const individualTrees = useMemo(() => {
    return trees.filter((tree) => {
      const hasPackageId = Boolean(tree.package_id);
      const treeType = String(tree.tree_type || "").toUpperCase();
      return !hasPackageId && treeType !== "PACKAGE";
    }).length;
  }, [trees]);

  const packageTrees = Math.max(trees.length - individualTrees, 0);

  const lowStockItems = useMemo(() => {
    return inventory.filter((item) => {
      const remaining = Number(item.remaining_qty || 0);
      const lowLevel = Number(item.low_stock_level || 0);
      return remaining <= lowLevel;
    });
  }, [inventory]);

  const walletBalance = Number(wallet?.balance || 0);
  const membershipStatus = cleanStatus(profile?.membership_status);
  const kycStatus = cleanStatus(profile?.kyc_status || profile?.account_status);
  const careSubscription = cleanStatus(
    profile?.care_subscription_status || profile?.care_status
  );

  const latestTreeDate = trees
    .map((tree) => tree.created_at)
    .filter(Boolean)
    .sort((a, b) => new Date(String(b)).getTime() - new Date(String(a)).getTime())[0];

  const gpsVerifiedCount = trees.filter((tree) => tree.gps_verified === true).length;

  const recentActivity = useMemo(() => {
    const walletRows = walletTransactions.map((tx) => ({
      id: `wallet-${tx.id}`,
      icon: "💳",
      title: tx.transaction_type || "Wallet Transaction",
      description: tx.description || `${peso(Number(tx.amount || 0))} wallet activity`,
      date: formatDate(tx.created_at),
      status: cleanStatus(tx.status),
      kind: "ok",
    }));

    const operationRows = operationRequests.map((op) => ({
      id: `operation-${op.id}`,
      icon: "🌿",
      title: op.operation_type || op.service_type || op.item_name || "Tree Operation",
      description: op.notes || `${peso(Number(op.total_amount || op.amount || 0))} operation request`,
      date: formatDate(op.created_at),
      status: cleanStatus(op.status),
      kind:
        String(op.status || "").toUpperCase() === "PENDING"
          ? "warning"
          : String(op.status || "").toUpperCase() === "REJECTED"
          ? "danger"
          : "ok",
    }));

    return [...walletRows, ...operationRows].slice(0, 6);
  }, [walletTransactions, operationRequests]);

  if (loading) {
    return (
      <main className="dashboardPage">
        <section className="content">
          <div className="loadingBox">Loading dashboard...</div>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboardPage">
      <section className="content">
        <header className="header">
          <div>
            <p className="eyebrow">Welcome back,</p>
            <h2>
              {displayName} <span>🌿</span>
            </h2>
            <small>
              Manage your agarwood investments, membership access, care services,
              wallet activity, and tree updates.
            </small>
            {errorMessage && <div className="errorBox">{errorMessage}</div>}
          </div>

          <div className="headerActions">
            <Link
              href="/dashboard/transactions"
              className="headerIconButton"
              title="Open transactions and notifications"
            >
              🔔<i>{recentActivity.length}</i>
            </Link>

            <Link
              href="/dashboard/tree-operations"
              className="headerIconButton"
              title="Open tree operation messages"
            >
              ✉️<i>{operationRequests.length}</i>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="logoutButton"
              title="Logout"
            >
              🚪 Logout
            </button>

            <div className="topAvatar">{initials}</div>
          </div>
        </header>

        <section className="stats">
          <Card
            icon="🌳"
            title="Owned Trees"
            value={String(trees.length)}
            sub={`${individualTrees} individual • ${packageTrees} package`}
          />
          <Card
            icon="🎖️"
            title="Membership"
            value={membershipStatus}
            sub={`KYC: ${kycStatus}`}
            gold
          />
          <Card
            icon="🛡️"
            title="Care Subscription"
            value={careSubscription}
            sub="Real profile care status"
          />
          <Card
            icon="💳"
            title="Wallet Balance"
            value={peso(walletBalance)}
            sub="Available balance"
          />
        </section>

        <section className="mainGrid">
          <div className="journey">
            <h3>Agarwood Growth Guide</h3>
            <h4>Educational development stages</h4>

            {[
              ["Seedling", "0 - 6 Months", "Early root stage; photo may be limited", true],
              ["Sapling", "6 - 18 Months", "Visible stem and leaves begin", true],
              ["Young Tree", "1.5 - 3 Years", "Active growth and care monitoring", true],
              ["Mature Tree", "3 - 7 Years", "Trunk mass and value development", false],
              ["Harvest Ready", "7+ Years", "Eligible for sell or harvest review", false],
            ].map((x, i) => (
              <div className={`step ${i === 2 ? "current" : ""}`} key={x[0] as string}>
                <span>{x[3] ? "✓" : "•"}</span>
                <div>
                  <strong>{x[0]}</strong>
                  <p>{x[1]}</p>
                  <small>{x[2]}</small>
                </div>
                {i === 2 && <b />}
              </div>
            ))}
          </div>

          <div className="treeVisualCard">
            <div className="visualTop">
              <div>
                <p className="visualEyebrow">🌿 Agarwood Growth Monitor</p>
                <h3>Tree Portfolio Snapshot</h3>
                <small>
                  Premium dashboard visualization based on live Supabase records.
                </small>
              </div>

              <div className="visualBadge">
                <strong>{stage}/5</strong>
                <span>Guide Stage</span>
              </div>
            </div>

            <div className="forestOrb">
              <div className="orbRing">
                <div className="orbCore">
                  <strong>{trees.length}</strong>
                  <span>Owned Trees</span>
                </div>
              </div>
            </div>

            <div className="visualStats">
              <div>
                <span>GPS Verified</span>
                <strong>
                  {trees.length === 0 ? "No Trees" : `${gpsVerifiedCount}/${trees.length}`}
                </strong>
              </div>
              <div>
                <span>Care Status</span>
                <strong>{careSubscription}</strong>
              </div>
              <div>
                <span>Latest Added</span>
                <strong>{formatDate(latestTreeDate)}</strong>
              </div>
            </div>

            <div className="progressGlass">
              <div>
                <strong>Educational Growth Guide</strong>
                <span>{stage * 20}%</span>
              </div>

              <div className="bar">
                <i style={{ width: `${stage * 20}%` }} />
              </div>

              <p>
                <b>Live portfolio data</b>
                <span>Guide only</span>
              </p>
            </div>
          </div>

          <div className="portfolio">
            <div className="panelHead">
              <h3>My Trees Overview</h3>
              <Link href="/dashboard/my-trees">View My Trees ›</Link>
            </div>

            <div className="treeOverviewHero">
              <div>
                <strong>{trees.length}</strong>
                <span>Owned Trees</span>
              </div>
            </div>

            <div className="overviewRows">
              <OverviewRow label="Individual Trees" value={String(individualTrees)} />
              <OverviewRow label="Package Trees" value={String(packageTrees)} />
              <OverviewRow label="Latest Tree Added" value={formatDate(latestTreeDate)} />
              <OverviewRow
                label="GPS Verification"
                value={
                  trees.length === 0
                    ? "No Trees"
                    : gpsVerifiedCount === trees.length
                    ? "Verified"
                    : `${gpsVerifiedCount}/${trees.length}`
                }
              />
              <OverviewRow label="Care Subscription" value={careSubscription} />
              <OverviewRow
                label="Low Stock Items"
                value={String(lowStockItems.length)}
                alert={lowStockItems.length > 0}
              />
            </div>
          </div>

          <div className="inventory panel">
            <div className="panelHead">
              <h3>Inventory</h3>
              <Link href="/dashboard/inventory">Open Inventory ›</Link>
            </div>

            <div className="inventoryList">
              {inventory.length === 0 ? (
                <div className="emptyState">No inventory records yet.</div>
              ) : (
                inventory.slice(0, 5).map((item) => {
                  const remaining = Number(item.remaining_qty || 0);
                  const lowLevel = Number(item.low_stock_level || 0);
                  const isLow = remaining <= lowLevel;

                  return (
                    <InventoryRow
                      key={item.id}
                      icon={getInventoryIcon(item.category)}
                      name={item.item_name || "Unnamed Item"}
                      qty={`${remaining.toLocaleString("en-PH")} ${item.unit || ""}`}
                      category={item.category || "Inventory item"}
                      warning={isLow}
                    />
                  );
                })
              )}
            </div>

            <small>
              {inventory.length === 0
                ? "Inventory data will appear here once records are added."
                : lowStockItems.length > 0
                ? `${lowStockItems.length} item(s) are near or below low stock level.`
                : "All visible inventory items are above low stock level."}
            </small>
          </div>

          <div className="taskOrders panel">
            <div className="panelHead">
              <h3>Task Orders</h3>
              <Link href="/dashboard/tree-operations">Open Operations ›</Link>
            </div>

            <p className="taskIntro">
              Recent tree operation requests connected to your Supabase records.
            </p>

            <div className="taskList">
              {operationRequests.length === 0 ? (
                <div className="emptyState">No tree operation requests yet.</div>
              ) : (
                operationRequests.slice(0, 4).map((op) => (
                  <TaskOrder
                    key={op.id}
                    code={String(op.id).slice(0, 8).toUpperCase()}
                    icon="🌿"
                    title={op.operation_type || op.service_type || op.item_name || "Tree Operation"}
                    tree={op.tree_id ? `Tree ${String(op.tree_id).slice(0, 8)}` : "Customer Tree"}
                    date={formatDate(op.scheduled_date || op.created_at)}
                    status={cleanStatus(op.status)}
                    covered={String(op.status || "").toUpperCase() === "APPROVED"}
                  />
                ))
              )}
            </div>

            <div className="subscriptionBox">
              <div>
                <strong>Managed Care Subscription</strong>
                <p>Care service status: {careSubscription}</p>
              </div>
              <Link href="/dashboard/tree-operations">
                {careSubscription === "ACTIVE" ? "Renew" : "Subscribe"}
              </Link>
            </div>
          </div>

          <div className="activity panel">
            <div className="panelHead">
              <h3>Notifications</h3>
              <Link href="/dashboard/transactions">View all ›</Link>
            </div>

            {recentActivity.length === 0 ? (
              <div className="emptyState">No recent activity yet.</div>
            ) : (
              recentActivity.map((a) => (
                <div className={`activityRow ${a.kind}`} key={a.id}>
                  <span>{a.icon}</span>
                  <div>
                    <strong>{a.title}</strong>
                    <p>{a.description}</p>
                  </div>
                  <b>{a.status || a.date}</b>
                </div>
              ))
            )}
          </div>
        </section>

        <footer>
          ☀️ Sustainable agarwood ownership with premium care operations.{" "}
          <span>|</span> Agarwood Investments © 2026
        </footer>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .dashboardPage {
          min-height: 100vh;
          color: #18261d;
          font-family: Arial, Helvetica, sans-serif;
        }

        .content {
          min-height: 100vh;
          padding: 26px 28px 18px;
          overflow-x: hidden;
          background-image:
            linear-gradient(rgba(2,24,13,.35), rgba(2,24,13,.70)),
            url('/images/agarwood-real-tree.jpg');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          background-attachment: fixed;
        }

        .loadingBox, .errorBox, .emptyState {
          border-radius: 16px;
          background: rgba(255, 253, 246, .88);
          border: 1px solid rgba(92, 70, 35, .10);
          padding: 16px;
          color: #6b6255;
          font-weight: 800;
        }

        .loadingBox {
          min-height: 70vh;
          display: grid;
          place-items: center;
          font-size: 18px;
        }

        .errorBox {
          margin-top: 12px;
          color: #a33c2a;
          background: rgba(255, 235, 230, .82);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 20px;
          padding: 20px;
          border-radius: 24px;
          background: rgba(255, 253, 246, .82);
          border: 1px solid rgba(255,255,255,.30);
          box-shadow: 0 18px 42px rgba(0,0,0,.16);
          backdrop-filter: blur(8px);
        }

        .eyebrow {
          margin: 0;
          font-weight: 900;
          color: #6e552d;
          letter-spacing: .3px;
        }

        .header h2 {
          margin: 4px 0 5px;
          font-size: 34px;
          line-height: 1;
          letter-spacing: -1px;
          color: #101a14;
        }

        .header small {
          color: #5f665e;
          font-size: 15px;
        }

        .headerActions {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .headerActions .headerIconButton {
          position: relative;
          width: 52px;
          height: 52px;
          border: 1px solid rgba(92, 70, 35, .08);
          border-radius: 16px;
          background: rgba(255, 253, 246, .72);
          box-shadow: 0 14px 32px rgba(82, 60, 27, .08);
          cursor: pointer;
          font-size: 20px;
          display: grid;
          place-items: center;
          text-decoration: none;
        }

        .logoutButton {
          height: 52px;
          border: 1px solid rgba(92, 70, 35, .08);
          border-radius: 16px;
          background: linear-gradient(135deg, #d9b45f, #8a6a2f);
          color: #10281f;
          box-shadow: 0 14px 32px rgba(82, 60, 27, .12);
          cursor: pointer;
          font-size: 14px;
          font-weight: 900;
          padding: 0 18px;
          white-space: nowrap;
        }

        .logoutButton:hover,
        .headerActions .headerIconButton:hover {
          transform: translateY(-1px);
          filter: brightness(1.04);
        }

        .headerActions i {
          position: absolute;
          right: 8px;
          top: 5px;
          background: #8a6a2f;
          color: white;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          font-size: 11px;
          display: grid;
          place-items: center;
          font-style: normal;
        }

        .topAvatar {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: linear-gradient(135deg, #244536, #10281f);
          border: 2px solid rgba(189, 167, 123, .55);
          display: grid;
          place-items: center;
          color: white;
          font-weight: 900;
          box-shadow: 0 12px 28px rgba(33, 54, 39, .18);
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
        }

        .stat {
          min-height: 138px;
          border-radius: 20px;
          background: rgba(255, 253, 246, .88);
          border: 1px solid rgba(255,255,255,.30);
          display: flex;
          align-items: center;
          gap: 19px;
          padding: 20px;
          box-shadow: 0 18px 40px rgba(0,0,0,.16);
          backdrop-filter: blur(8px);
        }

        .statIcon {
          width: 68px;
          height: 68px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: radial-gradient(circle, #f5e8c9, #d9ccb0);
          font-size: 29px;
          box-shadow: inset -10px -12px 20px rgba(103, 78, 35, .12);
        }

        .statIcon.gold {
          background: radial-gradient(circle, #fff2bc, #c9a34d);
        }

        .stat p {
          margin: 0 0 8px;
          font-size: 13px;
          color: #5f665e;
          font-weight: 800;
        }

        .stat h3 {
          margin: 0 0 8px;
          font-size: 29px;
          letter-spacing: -1px;
          color: #101a14;
        }

        .stat small {
          color: #6e552d;
          font-weight: 900;
        }

        .mainGrid {
          display: grid;
          grid-template-columns: 240px 1.4fr 1fr;
          gap: 16px;
        }

        .journey, .treeVisualCard, .portfolio, .panel {
          border-radius: 20px;
          box-shadow: 0 18px 42px rgba(0,0,0,.16);
          border: 1px solid rgba(255,255,255,.24);
        }

        .journey {
          background: rgba(255, 253, 246, .88);
          padding: 20px;
          min-height: 520px;
          backdrop-filter: blur(8px);
        }

        .journey h3, .journey h4 {
          margin: 0;
        }

        .journey h3 {
          color: #17271d;
        }

        .journey h4 {
          margin-top: 12px;
          color: #8c6a3c;
          font-size: 14px;
        }

        .step {
          position: relative;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 13px 10px;
          margin-top: 10px;
          border-radius: 14px;
        }

        .step:before {
          content: "";
          position: absolute;
          left: 21px;
          top: -12px;
          width: 2px;
          height: 24px;
          background: #d9ccb0;
        }

        .step:first-of-type:before { display: none; }

        .step.current {
          background: linear-gradient(90deg, #f2e4c6, #e0cfaa);
          box-shadow: inset 0 0 0 1px rgba(140, 106, 60, .12);
        }

        .step span {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #31553d;
          color: white;
          font-size: 12px;
          z-index: 2;
          flex: 0 0 auto;
        }

        .step div strong {
          font-size: 14px;
          color: #17271d;
        }

        .step div p {
          margin: 5px 0 0;
          font-size: 13px;
          color: #6c675b;
        }

        .step div small {
          display: block;
          margin-top: 3px;
          font-size: 11px;
          color: #817866;
        }

        .step b {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #8c6a3c;
          margin-left: auto;
        }

        .treeVisualCard {
          position: relative;
          overflow: hidden;
          min-height: 520px;
          padding: 24px;
          background:
            radial-gradient(circle at 50% 38%, rgba(217,180,95,.30), transparent 18%),
            radial-gradient(circle at 50% 50%, rgba(103,178,70,.22), transparent 36%),
            linear-gradient(145deg, rgba(7,31,22,.94), rgba(16,40,31,.96));
          color: white;
        }

        .treeVisualCard:before {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
          background-size: 34px 34px;
          opacity: .38;
          pointer-events: none;
        }

        .visualTop {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
        }

        .visualEyebrow {
          margin: 0 0 8px;
          color: #d9b45f;
          font-size: 13px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .7px;
        }

        .visualTop h3 {
          margin: 0;
          font-size: 30px;
          letter-spacing: -.8px;
        }

        .visualTop small {
          display: block;
          margin-top: 8px;
          max-width: 430px;
          color: rgba(255,255,255,.72);
          line-height: 1.5;
        }

        .visualBadge {
          width: 104px;
          height: 104px;
          border-radius: 26px;
          background: rgba(255,255,255,.12);
          border: 1px solid rgba(255,255,255,.18);
          display: grid;
          place-items: center;
          text-align: center;
          box-shadow: inset 0 0 32px rgba(255,255,255,.06);
          flex: 0 0 auto;
        }

        .visualBadge strong {
          display: block;
          font-size: 30px;
          color: #d9b45f;
        }

        .visualBadge span {
          display: block;
          margin-top: -18px;
          font-size: 11px;
          color: rgba(255,255,255,.70);
          font-weight: 900;
          text-transform: uppercase;
        }

        .forestOrb {
          position: relative;
          z-index: 2;
          min-height: 210px;
          display: grid;
          place-items: center;
          margin: 10px 0 18px;
        }

        .orbRing {
          width: 220px;
          height: 220px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background:
            conic-gradient(from 180deg, #d9b45f, #8bc34a, #244536, #d9b45f);
          box-shadow:
            0 0 80px rgba(139,195,74,.22),
            inset 0 0 40px rgba(0,0,0,.22);
          padding: 12px;
        }

        .orbCore {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          display: grid;
          place-items: center;
          text-align: center;
          background:
            radial-gradient(circle at 35% 30%, rgba(255,255,255,.18), transparent 28%),
            linear-gradient(145deg, #244536, #10281f);
          border: 1px solid rgba(255,255,255,.22);
        }

        .orbCore strong {
          display: block;
          font-size: 52px;
          line-height: 1;
          color: #fff8e6;
        }

        .orbCore span {
          display: block;
          margin-top: -44px;
          color: rgba(255,255,255,.72);
          font-size: 13px;
          font-weight: 900;
        }

        .visualStats {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .visualStats div {
          border-radius: 16px;
          background: rgba(255,255,255,.10);
          border: 1px solid rgba(255,255,255,.16);
          padding: 14px;
        }

        .visualStats span {
          display: block;
          color: rgba(255,255,255,.64);
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .4px;
        }

        .visualStats strong {
          display: block;
          margin-top: 7px;
          color: #fff8e6;
          font-size: 15px;
        }

        .progressGlass {
          position: relative;
          z-index: 2;
          padding: 18px;
          border-radius: 18px;
          color: #fff8e6;
          background: rgba(5, 44, 24, .82);
          border: 1px solid rgba(255,255,255,.18);
          backdrop-filter: blur(13px);
        }

        .progressGlass div:first-child,
        .progressGlass p {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .progressGlass span {
          font-size: 26px;
          font-weight: 900;
        }

        .progressGlass p {
          margin: 9px 0 0;
          font-size: 14px;
        }

        .progressGlass p span {
          font-size: 14px;
        }

        .bar {
          margin-top: 12px;
          height: 12px;
          border-radius: 999px;
          background: rgba(255,255,255,.28);
          overflow: hidden;
        }

        .bar i {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #8bc34a, #f4d37a);
          transition: width .4s ease;
        }

        .portfolio {
          background: linear-gradient(145deg, rgba(36,69,54,.94), rgba(16,40,31,.94));
          color: white;
          padding: 24px;
          min-height: 520px;
          backdrop-filter: blur(8px);
        }

        .panelHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .panelHead h3 {
          margin: 0;
        }

        .panelHead a {
          color: inherit;
          text-decoration: none;
          font-weight: 900;
        }

        .treeOverviewHero {
          margin: 26px auto 20px;
          width: 170px;
          height: 170px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, #d6c28c, #31553d 72%);
          display: grid;
          place-items: center;
          box-shadow: inset -20px -25px 35px rgba(0,0,0,.18), 0 20px 50px rgba(0,0,0,.22);
        }

        .treeOverviewHero div {
          text-align: center;
        }

        .treeOverviewHero strong {
          display: block;
          font-size: 38px;
        }

        .treeOverviewHero span {
          font-size: 13px;
        }

        .overviewRows {
          display: grid;
          gap: 12px;
        }

        .overviewRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid rgba(255,255,255,.13);
        }

        .overviewRow p {
          margin: 0;
          color: rgba(255,255,255,.76);
        }

        .overviewRow b {
          color: white;
        }

        .overviewRow.alert b {
          color: #f4d37a;
        }

        .panel {
          background: rgba(255, 253, 246, .88);
          padding: 22px;
          min-height: 255px;
          backdrop-filter: blur(8px);
        }

        .inventory {
          grid-column: 1 / 2;
        }

        .taskOrders {
          grid-column: 2 / 3;
        }

        .activity {
          grid-column: 3 / 4;
        }

        .inventoryList {
          margin-top: 18px;
          display: grid;
          gap: 10px;
        }

        .inventoryRow {
          display: grid;
          grid-template-columns: 36px 1fr auto;
          align-items: center;
          gap: 10px;
          padding: 9px 0;
          border-bottom: 1px solid rgba(92, 70, 35, .10);
        }

        .inventoryRow .icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #efe3cc;
        }

        .inventoryRow strong {
          font-size: 13px;
        }

        .inventoryRow p {
          margin: 3px 0 0;
          font-size: 11px;
          color: #666;
        }

        .inventoryRow.warn b {
          color: #a66c22;
        }

        .inventory small {
          display: block;
          color: #6e552d;
          margin-top: 15px;
          font-weight: 900;
          line-height: 1.4;
        }

        .taskIntro {
          margin: 12px 0 0;
          color: #5c6259;
          font-size: 13px;
          line-height: 1.5;
        }

        .taskList {
          margin-top: 15px;
          display: grid;
          gap: 10px;
        }

        .taskOrder {
          display: grid;
          grid-template-columns: 38px 1fr auto;
          align-items: center;
          gap: 10px;
          padding: 11px;
          border-radius: 14px;
          background: #f3ead8;
          border: 1px solid rgba(92, 70, 35, .06);
        }

        .taskOrder .taskIcon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #efe3cc;
          display: grid;
          place-items: center;
        }

        .taskOrder strong {
          display: block;
          font-size: 13px;
        }

        .taskOrder p {
          margin: 3px 0 0;
          font-size: 12px;
          color: #6b6b62;
        }

        .taskOrder b {
          font-size: 11px;
          color: #6b6b62;
          text-align: right;
        }

        .taskOrder.covered b {
          color: #31553d;
        }

        .taskCode {
          display: inline-block;
          margin-bottom: 3px;
          font-size: 10px;
          font-weight: 900;
          color: #8c6a3c;
          letter-spacing: .6px;
        }

        .subscriptionBox {
          margin-top: 14px;
          border-radius: 16px;
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
          padding: 15px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .subscriptionBox p {
          margin: 4px 0 0;
          font-size: 12px;
          color: rgba(255,255,255,.72);
        }

        .subscriptionBox a {
          border-radius: 12px;
          background: #d6b25e;
          color: #10281f;
          padding: 10px 14px;
          font-weight: 900;
          text-decoration: none;
          white-space: nowrap;
        }

        .activityRow {
          display: grid;
          grid-template-columns: 42px 1fr auto;
          align-items: center;
          gap: 12px;
          padding: 13px 0;
          border-bottom: 1px solid rgba(92, 70, 35, .10);
        }

        .activityRow span {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #efe3cc;
        }

        .activityRow strong {
          font-size: 13px;
        }

        .activityRow p {
          margin: 4px 0 0;
          font-size: 12px;
          color: #6b6b62;
        }

        .activityRow b {
          color: #31553d;
          font-size: 13px;
          text-align: right;
        }

        .activityRow.danger b {
          color: #a33c2a;
        }

        .activityRow.warning b {
          color: #a66c22;
        }

        footer {
          text-align: center;
          color: rgba(255,255,255,.82);
          padding: 20px 0 0;
          font-size: 14px;
          font-weight: 800;
          text-shadow: 0 2px 12px rgba(0,0,0,.45);
        }

        footer span {
          margin: 0 24px;
        }

        @media (max-width: 1280px) {
          .stats { grid-template-columns: repeat(2, 1fr); }
          .mainGrid { grid-template-columns: 220px 1fr; }
          .portfolio, .activity { grid-column: 1 / -1; }
          .inventory { grid-column: 1 / 2; }
          .taskOrders { grid-column: 2 / 3; }
        }

        @media (max-width: 900px) {
          .content { padding: 18px; }
          .mainGrid, .stats { grid-template-columns: 1fr; }
          .inventory, .taskOrders, .activity { grid-column: 1; }
          .header { flex-direction: column; gap: 20px; }
          .headerActions { flex-wrap: wrap; }
          .logoutButton { width: auto; }
          .visualStats { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}

function Card({
  icon,
  title,
  value,
  sub,
  gold,
}: {
  icon: string;
  title: string;
  value: string;
  sub: string;
  gold?: boolean;
}) {
  return (
    <div className="stat">
      <div className={`statIcon ${gold ? "gold" : ""}`}>{icon}</div>
      <div>
        <p>{title}</p>
        <h3>{value}</h3>
        <small>{sub}</small>
      </div>
    </div>
  );
}

function OverviewRow({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className={`overviewRow ${alert ? "alert" : ""}`}>
      <p>{label}</p>
      <b>{value}</b>
    </div>
  );
}

function InventoryRow({
  icon,
  name,
  qty,
  category,
  warning,
}: {
  icon: string;
  name: string;
  qty: string;
  category: string;
  warning?: boolean;
}) {
  return (
    <div className={`inventoryRow ${warning ? "warn" : ""}`}>
      <span className="icon">{icon}</span>
      <div>
        <strong>{name}</strong>
        <p>{category}</p>
      </div>
      <b>{qty}</b>
    </div>
  );
}

function TaskOrder({
  code,
  icon,
  title,
  tree,
  date,
  status,
  covered,
}: {
  code: string;
  icon: string;
  title: string;
  tree: string;
  date: string;
  status: string;
  covered?: boolean;
}) {
  return (
    <div className={`taskOrder ${covered ? "covered" : ""}`}>
      <span className="taskIcon">{icon}</span>
      <div>
        <span className="taskCode">{code}</span>
        <strong>{title}</strong>
        <p>
          {tree} • {date}
        </p>
      </div>
      <b>{status}</b>
    </div>
  );
}

function getInventoryIcon(category: string | null | undefined) {
  const value = String(category || "").toLowerCase();

  if (value.includes("fertilizer")) return "🌱";
  if (value.includes("booster")) return "🧪";
  if (value.includes("insect")) return "🪲";
  if (value.includes("fung")) return "🌿";
  if (value.includes("soil")) return "🪴";

  return "📦";
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