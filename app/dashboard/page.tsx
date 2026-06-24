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
      setStage((s) => (s >= 7 ? 1 : s + 1));
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
  const careSubscription = cleanStatus(profile?.care_subscription_status || profile?.care_status);

  const latestTreeDate = trees
    .map((tree) => tree.created_at)
    .filter(Boolean)
    .sort((a, b) => new Date(String(b)).getTime() - new Date(String(a)).getTime())[0];

  const gpsVerifiedCount = trees.filter((tree) => tree.gps_verified === true).length;

  const pendingOperations = operationRequests.filter(
    (op) => cleanStatus(op.status) === "PENDING" || cleanStatus(op.status) === "ASSIGNED"
  ).length;

  const recentActivity = useMemo(() => {
    const walletRows = walletTransactions.map((tx) => ({
      id: `wallet-${tx.id}`,
      icon: "₱",
      title: cleanLabel(tx.transaction_type || "Wallet Transaction"),
      description: tx.description || `${peso(Number(tx.amount || 0))} wallet activity`,
      amount: peso(Number(tx.amount || 0)),
      date: formatDate(tx.created_at),
      status: cleanStatus(tx.status),
      kind: "wallet",
    }));

    const operationRows = operationRequests.map((op) => ({
      id: `operation-${op.id}`,
      icon: "🌿",
      title: cleanLabel(op.operation_type || op.service_type || op.item_name || "Tree Operation"),
      description: op.notes || `${peso(Number(op.total_amount || op.amount || 0))} operation request`,
      amount: peso(Number(op.total_amount || op.amount || 0)),
      date: formatDate(op.created_at),
      status: cleanStatus(op.status),
      kind: "operation",
    }));

    return [...walletRows, ...operationRows].slice(0, 6);
  }, [walletTransactions, operationRequests]);

  if (loading) {
    return (
      <main className="dashboardPage">
        <div className="pageShell">
          <div className="loadingBox">Loading customer dashboard...</div>
        </div>

        <style>{baseStyles}</style>
      </main>
    );
  }

  return (
    <main className="dashboardPage">
      <div className="pageShell">
        <header className="hero">
          <div className="heroText">
            <p className="eyebrow">Customer Buyer Portal</p>
            <h1>
              Welcome back, <span>{displayName}</span>
            </h1>
            <p>
              Your live agarwood investment dashboard. Cash in, activate membership,
              complete KYC, buy trees, monitor care, and prepare for resale.
            </p>
            {errorMessage && <div className="errorBox">{errorMessage}</div>}

            <div className="heroActions">
              <Link href="/dashboard/wallet">Cash In</Link>
              <Link href="/dashboard/marketplace">Buy Tree</Link>
              <Link href="/dashboard/my-trees">Track Trees</Link>
            </div>
          </div>

          <div className="accountGlass">
            <div className="avatar">{initials}</div>
            <div>
              <small>Active Account</small>
              <strong>{profile?.email || "Verified customer"}</strong>
            </div>
            <button type="button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <section className="metricGrid">
          <MetricCard label="Wallet Balance" value={peso(walletBalance)} note="Available buying power" />
          <MetricCard label="Membership Status" value={membershipStatus} note="Required before full access" />
          <MetricCard label="KYC Status" value={kycStatus} note="Required for withdrawals" />
          <MetricCard label="Owned Trees" value={String(trees.length)} note={`${individualTrees} individual • ${packageTrees} package`} />
          <MetricCard label="Pending Operations" value={String(pendingOperations)} note="Care requests in progress" />
          <MetricCard label="Latest Transactions" value={String(walletTransactions.length)} note="Recent wallet movements" />
        </section>

        <section className="mainGrid">
          <div className="plantationPanel">
            <div className="panelTop">
              <div>
                <p className="eyebrow">Realistic Plantation View</p>
                <h2>Agarwood Estate Monitor</h2>
                <span>Live portfolio counts shown over a premium plantation-style field.</span>
              </div>

              <div className="stageBadge">
                <strong>{stage}/7</strong>
                <small>Buyer Journey</small>
              </div>
            </div>

            <div className="plantationVisual">
              <div className="moonGlow" />
              <div className="mountain m1" />
              <div className="mountain m2" />
              <div className="mist mist1" />
              <div className="mist mist2" />

              <div className="treeLine back">
                {Array.from({ length: 12 }).map((_, index) => (
                  <i key={`back-${index}`} />
                ))}
              </div>

              <div className="treeLine mid">
                {Array.from({ length: 10 }).map((_, index) => (
                  <i key={`mid-${index}`} />
                ))}
              </div>

              <div className="fieldRows">
                <span />
                <span />
                <span />
                <span />
              </div>

              <div className="treeLine front">
                {Array.from({ length: 8 }).map((_, index) => (
                  <i key={`front-${index}`} />
                ))}
              </div>

              <div className="estateCard">
                <small>Owned Trees</small>
                <strong>{trees.length}</strong>
                <span>GPS verified: {trees.length === 0 ? "0/0" : `${gpsVerifiedCount}/${trees.length}`}</span>
              </div>
            </div>

            <div className="plantationStats">
              <Mini label="Latest Tree Added" value={formatDate(latestTreeDate)} />
              <Mini label="Care Status" value={careSubscription} />
              <Mini label="Inventory Alerts" value={String(lowStockItems.length)} />
            </div>
          </div>

          <div className="journeyPanel">
            <div className="panelTop compact">
              <div>
                <p className="eyebrow">Buyer Journey</p>
                <h2>From Funding to Resale</h2>
              </div>
            </div>

            <div className="journeyList">
              <JourneyStep number="1" label="Cash-In" href="/dashboard/wallet" done={walletBalance > 0} />
              <JourneyStep number="2" label="Membership" href="/dashboard/membership" done={membershipStatus === "ACTIVE"} />
              <JourneyStep number="3" label="KYC" href="/dashboard/profile" done={kycStatus === "APPROVED"} />
              <JourneyStep number="4" label="Buy Tree" href="/dashboard/marketplace" done={trees.length > 0} />
              <JourneyStep number="5" label="Track Tree" href="/dashboard/my-trees" done={trees.length > 0} />
              <JourneyStep number="6" label="Request Care" href="/dashboard/tree-operations" done={operationRequests.length > 0} />
              <JourneyStep number="7" label="Sell Tree" href="/dashboard/sell-tree" done={false} />
            </div>
          </div>

          <div className="quickPanel">
            <div className="panelTop compact">
              <div>
                <p className="eyebrow">Quick Actions</p>
                <h2>Next Move</h2>
              </div>
            </div>

            <div className="quickGrid">
              <QuickAction href="/dashboard/wallet" icon="₱" label="Wallet" />
              <QuickAction href="/dashboard/membership" icon="◆" label="Membership" />
              <QuickAction href="/dashboard/profile" icon="✓" label="Profile / KYC" />
              <QuickAction href="/dashboard/marketplace" icon="🌳" label="Marketplace" />
              <QuickAction href="/dashboard/my-trees" icon="🌿" label="My Trees" />
              <QuickAction href="/dashboard/tree-operations" icon="🛠" label="Tree Operations" />
              <QuickAction href="/dashboard/sell-tree" icon="↗" label="Sell Tree" />
              <QuickAction href="/dashboard/support" icon="?" label="Support" />
            </div>
          </div>

          <div className="latestPanel">
            <div className="panelTop compact">
              <div>
                <p className="eyebrow">Activity</p>
                <h2>Latest Transactions</h2>
              </div>
              <Link href="/dashboard/transactions">View all</Link>
            </div>

            <div className="activityList">
              {recentActivity.length === 0 ? (
                <div className="emptyState">No recent wallet or tree-operation activity yet.</div>
              ) : (
                recentActivity.map((item) => (
                  <div className="activityRow" key={item.id}>
                    <span>{item.icon}</span>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                      <small>{item.date}</small>
                    </div>
                    <b>{item.status}</b>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="portfolioPanel">
            <div className="panelTop compact">
              <div>
                <p className="eyebrow">Portfolio Snapshot</p>
                <h2>Tree Ownership</h2>
              </div>
              <Link href="/dashboard/my-trees">Open</Link>
            </div>

            <div className="portfolioRows">
              <OverviewRow label="Individual Trees" value={String(individualTrees)} />
              <OverviewRow label="Package Trees" value={String(packageTrees)} />
              <OverviewRow label="GPS Verified" value={trees.length === 0 ? "0/0" : `${gpsVerifiedCount}/${trees.length}`} />
              <OverviewRow label="Latest Added" value={formatDate(latestTreeDate)} />
              <OverviewRow label="Care Subscription" value={careSubscription} />
              <OverviewRow label="Low Stock Items" value={String(lowStockItems.length)} alert={lowStockItems.length > 0} />
            </div>
          </div>

          <div className="operationsPanel">
            <div className="panelTop compact">
              <div>
                <p className="eyebrow">Care Requests</p>
                <h2>Pending Operations</h2>
              </div>
              <Link href="/dashboard/tree-operations">Request care</Link>
            </div>

            <div className="operationList">
              {operationRequests.length === 0 ? (
                <div className="emptyState">No tree operation requests yet.</div>
              ) : (
                operationRequests.slice(0, 5).map((op) => (
                  <div className="operationRow" key={op.id}>
                    <div>
                      <strong>{cleanLabel(op.operation_type || op.service_type || op.item_name || "Tree Operation")}</strong>
                      <p>{op.tree_id ? `Tree ${String(op.tree_id).slice(0, 8)}` : "Customer tree"} • {formatDate(op.scheduled_date || op.created_at)}</p>
                    </div>
                    <span>{cleanStatus(op.status)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <footer>
          Sustainable agarwood ownership with real wallet, tree, inventory, and care-operation records.
        </footer>
      </div>

      <style>{baseStyles}</style>
    </main>
  );
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="metricCard">
      <p>{label}</p>
      <h3>{value}</h3>
      <span>{note}</span>
    </article>
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

function JourneyStep({
  number,
  label,
  href,
  done,
}: {
  number: string;
  label: string;
  href: string;
  done: boolean;
}) {
  return (
    <Link className={`journeyStep ${done ? "done" : ""}`} href={href}>
      <span>{done ? "✓" : number}</span>
      <strong>{label}</strong>
      <small>{done ? "Completed" : "Next step"}</small>
    </Link>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link className="quickAction" href={href}>
      <span>{icon}</span>
      <strong>{label}</strong>
    </Link>
  );
}

function OverviewRow({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`overviewRow ${alert ? "alert" : ""}`}>
      <p>{label}</p>
      <b>{value}</b>
    </div>
  );
}

function cleanLabel(value: string) {
  return String(value || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

const baseStyles = `
  * { box-sizing: border-box; }

  .dashboardPage {
    min-height: 100vh;
    width: 100%;
    min-width: 0;
    overflow-x: hidden;
    color: #f8f1d8;
    font-family: Arial, Helvetica, sans-serif;
    background:
      radial-gradient(circle at 16% 8%, rgba(214,178,94,.22), transparent 28%),
      radial-gradient(circle at 86% 12%, rgba(65,120,82,.18), transparent 34%),
      linear-gradient(180deg, #06110d 0%, #0b1f17 44%, #07120d 100%);
  }

  .pageShell {
    width: 100%;
    max-width: 1480px;
    min-width: 0;
    margin: 0 auto;
    padding: 28px;
    overflow-x: hidden;
  }

  .loadingBox,
  .errorBox,
  .emptyState,
  .metricCard,
  .plantationPanel,
  .journeyPanel,
  .quickPanel,
  .latestPanel,
  .portfolioPanel,
  .operationsPanel,
  .accountGlass {
    border: 1px solid rgba(214,178,94,.20);
    background: rgba(255,255,255,.075);
    backdrop-filter: blur(18px);
    box-shadow: 0 24px 70px rgba(0,0,0,.30);
  }

  .loadingBox {
    min-height: 72vh;
    border-radius: 28px;
    display: grid;
    place-items: center;
    color: #fff8dc;
    font-weight: 900;
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 18px;
    align-items: stretch;
    margin-bottom: 18px;
  }

  .heroText {
    min-width: 0;
    border-radius: 32px;
    padding: 28px;
    background:
      linear-gradient(rgba(2,20,12,.62), rgba(2,20,12,.82)),
      url('/images/agarwood-real-tree.jpg');
    background-size: cover;
    background-position: center;
    border: 1px solid rgba(214,178,94,.22);
    box-shadow: 0 24px 70px rgba(0,0,0,.35);
    overflow: hidden;
  }

  .eyebrow {
    margin: 0 0 10px;
    color: #d6b25e;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .16em;
    font-size: 12px;
  }

  .hero h1 {
    margin: 0;
    color: #fff8dc;
    font-size: clamp(34px, 5vw, 56px);
    line-height: .98;
    letter-spacing: -2px;
  }

  .hero h1 span {
    color: #d6b25e;
  }

  .hero p {
    max-width: 860px;
    margin: 16px 0 0;
    color: rgba(248,241,216,.78);
    line-height: 1.7;
    font-weight: 700;
  }

  .heroActions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 22px;
  }

  .heroActions a,
  .accountGlass button,
  .panelTop a {
    border: 0;
    border-radius: 999px;
    padding: 12px 16px;
    background: linear-gradient(135deg, #d6b25e, #8c6a3c);
    color: #07140f;
    text-decoration: none;
    font-weight: 950;
    cursor: pointer;
  }

  .accountGlass {
    width: 330px;
    border-radius: 32px;
    padding: 22px;
    display: grid;
    align-content: space-between;
    gap: 18px;
    min-width: 0;
  }

  .avatar {
    width: 68px;
    height: 68px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #d6b25e, #8c6a3c);
    color: #07140f;
    font-weight: 950;
    font-size: 24px;
  }

  .accountGlass small {
    color: rgba(248,241,216,.62);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .12em;
  }

  .accountGlass strong {
    display: block;
    margin-top: 8px;
    color: #fff8dc;
    overflow-wrap: anywhere;
  }

  .errorBox {
    margin-top: 16px;
    border-radius: 18px;
    padding: 14px;
    color: #ffd7ce;
    background: rgba(130,40,24,.28);
  }

  .metricGrid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 18px;
  }

  .metricCard {
    min-width: 0;
    border-radius: 24px;
    padding: 18px;
  }

  .metricCard p {
    margin: 0;
    color: rgba(248,241,216,.62);
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .11em;
  }

  .metricCard h3 {
    margin: 10px 0 6px;
    color: #fff8dc;
    font-size: clamp(21px, 2.2vw, 30px);
    overflow-wrap: anywhere;
  }

  .metricCard span {
    color: #d6b25e;
    font-weight: 800;
    font-size: 12px;
    line-height: 1.4;
  }

  .mainGrid {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(320px, .65fr);
    gap: 18px;
    min-width: 0;
  }

  .plantationPanel,
  .journeyPanel,
  .quickPanel,
  .latestPanel,
  .portfolioPanel,
  .operationsPanel {
    min-width: 0;
    border-radius: 30px;
    padding: 22px;
    overflow: hidden;
  }

  .plantationPanel {
    grid-row: span 2;
  }

  .panelTop {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 18px;
    min-width: 0;
  }

  .panelTop.compact {
    margin-bottom: 14px;
  }

  .panelTop h2 {
    margin: 0;
    color: #fff8dc;
    font-size: clamp(24px, 3vw, 34px);
    letter-spacing: -.8px;
  }

  .panelTop span {
    display: block;
    margin-top: 8px;
    color: rgba(248,241,216,.66);
    line-height: 1.5;
  }

  .stageBadge {
    flex: 0 0 auto;
    width: 96px;
    height: 96px;
    border-radius: 24px;
    display: grid;
    place-items: center;
    text-align: center;
    background: rgba(0,0,0,.28);
    border: 1px solid rgba(214,178,94,.18);
  }

  .stageBadge strong {
    display: block;
    color: #d6b25e;
    font-size: 28px;
  }

  .stageBadge small {
    display: block;
    margin-top: -18px;
    color: rgba(248,241,216,.58);
    font-weight: 900;
    font-size: 10px;
    text-transform: uppercase;
  }

  .plantationVisual {
    position: relative;
    height: 430px;
    border-radius: 28px;
    overflow: hidden;
    background:
      linear-gradient(180deg, rgba(3,19,19,.24) 0%, rgba(7,26,20,.45) 45%, rgba(5,22,12,.96) 100%),
      radial-gradient(circle at 48% 18%, rgba(214,178,94,.28), transparent 18%),
      linear-gradient(180deg, #102923 0%, #18372a 45%, #0a1f13 100%);
    border: 1px solid rgba(214,178,94,.18);
  }

  .moonGlow {
    position: absolute;
    top: 44px;
    left: 50%;
    width: 150px;
    height: 150px;
    transform: translateX(-50%);
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,237,173,.70), rgba(214,178,94,.20) 42%, transparent 70%);
    filter: blur(.2px);
  }

  .mountain {
    position: absolute;
    bottom: 154px;
    width: 58%;
    height: 170px;
    background: linear-gradient(135deg, rgba(8,40,27,.96), rgba(2,16,11,.98));
    clip-path: polygon(0 100%, 48% 8%, 100% 100%);
    opacity: .78;
  }

  .m1 { left: -10%; }
  .m2 { right: -8%; height: 135px; opacity: .66; }

  .mist {
    position: absolute;
    left: -10%;
    right: -10%;
    height: 54px;
    border-radius: 999px;
    background: linear-gradient(90deg, transparent, rgba(235,245,219,.18), transparent);
    filter: blur(11px);
  }

  .mist1 { top: 170px; }
  .mist2 { top: 235px; opacity: .7; }

  .treeLine {
    position: absolute;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-around;
    align-items: flex-end;
  }

  .treeLine i {
    display: block;
    position: relative;
    width: 11px;
    border-radius: 999px 999px 0 0;
    background: linear-gradient(180deg, #5a3b1d, #24170d);
  }

  .treeLine i:before,
  .treeLine i:after {
    content: "";
    position: absolute;
    left: 50%;
    border-radius: 50% 50% 46% 46%;
    transform: translateX(-50%);
    background:
      radial-gradient(circle at 35% 28%, rgba(158,198,118,.55), transparent 20%),
      linear-gradient(145deg, #2f6b3e, #0d2f20);
    box-shadow: 0 8px 20px rgba(0,0,0,.22);
  }

  .treeLine i:before {
    top: -42px;
    width: 58px;
    height: 54px;
  }

  .treeLine i:after {
    top: -70px;
    width: 44px;
    height: 44px;
  }

  .treeLine.back {
    bottom: 150px;
    opacity: .54;
  }

  .treeLine.back i {
    height: 48px;
    transform: scale(.68);
  }

  .treeLine.mid {
    bottom: 104px;
    opacity: .8;
  }

  .treeLine.mid i {
    height: 72px;
    transform: scale(.86);
  }

  .treeLine.front {
    bottom: 38px;
  }

  .treeLine.front i {
    height: 98px;
  }

  .fieldRows {
    position: absolute;
    inset: auto -20% 0 -20%;
    height: 190px;
    transform: perspective(400px) rotateX(58deg);
    transform-origin: bottom;
  }

  .fieldRows span {
    position: absolute;
    left: 0;
    right: 0;
    height: 18px;
    border-radius: 50%;
    border-top: 2px solid rgba(214,178,94,.22);
    background: linear-gradient(90deg, transparent, rgba(90,120,53,.26), transparent);
  }

  .fieldRows span:nth-child(1) { bottom: 24px; }
  .fieldRows span:nth-child(2) { bottom: 64px; }
  .fieldRows span:nth-child(3) { bottom: 108px; }
  .fieldRows span:nth-child(4) { bottom: 154px; }

  .estateCard {
    position: absolute;
    left: 22px;
    bottom: 22px;
    min-width: 190px;
    border-radius: 22px;
    padding: 18px;
    background: rgba(3,20,13,.74);
    border: 1px solid rgba(214,178,94,.28);
    backdrop-filter: blur(12px);
  }

  .estateCard small {
    color: rgba(248,241,216,.66);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .12em;
  }

  .estateCard strong {
    display: block;
    color: #fff8dc;
    font-size: 48px;
    line-height: 1;
    margin-top: 8px;
  }

  .estateCard span {
    display: block;
    color: #d6b25e;
    font-weight: 900;
    margin-top: 8px;
  }

  .plantationStats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-top: 14px;
  }

  .mini {
    min-width: 0;
    border-radius: 18px;
    padding: 14px;
    background: rgba(0,0,0,.24);
    border: 1px solid rgba(214,178,94,.14);
  }

  .mini span {
    display: block;
    color: rgba(248,241,216,.58);
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .08em;
  }

  .mini b {
    display: block;
    margin-top: 8px;
    color: #fff8dc;
    overflow-wrap: anywhere;
  }

  .journeyList {
    display: grid;
    gap: 10px;
  }

  .journeyStep {
    display: grid;
    grid-template-columns: 42px 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 13px;
    border-radius: 18px;
    background: rgba(0,0,0,.24);
    border: 1px solid rgba(214,178,94,.12);
    text-decoration: none;
    color: inherit;
  }

  .journeyStep span {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(214,178,94,.18);
    color: #d6b25e;
    font-weight: 950;
  }

  .journeyStep.done span {
    background: linear-gradient(135deg, #d6b25e, #8c6a3c);
    color: #07140f;
  }

  .journeyStep strong {
    color: #fff8dc;
  }

  .journeyStep small {
    color: rgba(248,241,216,.56);
    font-weight: 900;
  }

  .quickGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .quickAction {
    min-width: 0;
    display: grid;
    grid-template-columns: 38px 1fr;
    align-items: center;
    gap: 10px;
    padding: 13px;
    border-radius: 18px;
    background: rgba(0,0,0,.24);
    border: 1px solid rgba(214,178,94,.12);
    color: #fff8dc;
    text-decoration: none;
    font-weight: 900;
  }

  .quickAction span {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(214,178,94,.16);
    color: #d6b25e;
  }

  .latestPanel,
  .portfolioPanel,
  .operationsPanel {
    grid-column: auto;
  }

  .activityList,
  .portfolioRows,
  .operationList {
    display: grid;
    gap: 10px;
  }

  .activityRow,
  .operationRow,
  .overviewRow {
    min-width: 0;
    border-radius: 18px;
    padding: 13px;
    background: rgba(0,0,0,.22);
    border: 1px solid rgba(214,178,94,.12);
  }

  .activityRow {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
  }

  .activityRow > span {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(214,178,94,.14);
    color: #d6b25e;
    font-weight: 950;
  }

  .activityRow strong,
  .operationRow strong {
    color: #fff8dc;
    overflow-wrap: anywhere;
  }

  .activityRow p,
  .operationRow p {
    margin: 4px 0 0;
    color: rgba(248,241,216,.58);
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .activityRow small {
    display: block;
    margin-top: 4px;
    color: rgba(248,241,216,.45);
    font-weight: 800;
  }

  .activityRow b,
  .operationRow span,
  .overviewRow b {
    color: #d6b25e;
    font-weight: 950;
    white-space: nowrap;
  }

  .overviewRow,
  .operationRow {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
  }

  .overviewRow p {
    margin: 0;
    color: rgba(248,241,216,.65);
    font-weight: 800;
  }

  .overviewRow.alert b {
    color: #ffcf8c;
  }

  footer {
    padding: 22px 0 0;
    text-align: center;
    color: rgba(248,241,216,.58);
    font-weight: 800;
  }

  @media (max-width: 1280px) {
    .metricGrid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .mainGrid {
      grid-template-columns: 1fr;
    }

    .plantationPanel {
      grid-row: auto;
    }
  }

  @media (max-width: 860px) {
    .pageShell {
      padding: 18px;
    }

    .hero {
      grid-template-columns: 1fr;
    }

    .accountGlass {
      width: 100%;
    }

    .metricGrid,
    .plantationStats,
    .quickGrid {
      grid-template-columns: 1fr;
    }

    .panelTop {
      flex-direction: column;
    }

    .stageBadge {
      width: 100%;
      height: auto;
      padding: 16px;
    }

    .stageBadge small {
      margin-top: 2px;
    }

    .plantationVisual {
      height: 360px;
    }

    .activityRow {
      grid-template-columns: 42px minmax(0, 1fr);
    }

    .activityRow b {
      grid-column: 2;
      white-space: normal;
    }
  }
`;