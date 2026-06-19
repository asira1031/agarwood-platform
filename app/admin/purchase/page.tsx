"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type TableStatus = {
  table: string;
  status: "PASS" | "FAIL" | "CHECKING";
  message: string;
  count?: number;
};

type DebugRow = Record<string, any>;

const TABLES_TO_CHECK = [
  "profiles",
  "wallets",
  "wallet_transactions",
  "trees",
  "inventory",
  "marketplace_products",
  "tree_purchase_requests",
  "tree_operation_requests",
  "care_program_subscriptions",
  "sell_tree_requests",
];

function safeText(value: any) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function peso(value: any) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function AdminPurchasesPage() {
  const [loading, setLoading] = useState(true);
  const [tableStatuses, setTableStatuses] = useState<TableStatus[]>([]);
  const [selectedTable, setSelectedTable] = useState("tree_purchase_requests");
  const [debugRows, setDebugRows] = useState<DebugRow[]>([]);
  const [debugError, setDebugError] = useState("");
  const [profileEmail, setProfileEmail] = useState("customer@test.com");
  const [profileResult, setProfileResult] = useState<DebugRow | null>(null);
  const [profileError, setProfileError] = useState("");
  const [recentWalletTransactions, setRecentWalletTransactions] = useState<DebugRow[]>([]);
  const [recentTrees, setRecentTrees] = useState<DebugRow[]>([]);
  const [recentInventory, setRecentInventory] = useState<DebugRow[]>([]);
  const [message, setMessage] = useState("");

  async function checkAdminAccess() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      window.location.href = "/login";
      return false;
    }

    return true;
  }

  async function checkTables() {
    const results: TableStatus[] = [];

    for (const table of TABLES_TO_CHECK) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });

        if (error) {
          results.push({
            table,
            status: "FAIL",
            message: error.message,
          });
        } else {
          results.push({
            table,
            status: "PASS",
            message: "Connected",
            count: count || 0,
          });
        }
      } catch (error: any) {
        results.push({
          table,
          status: "FAIL",
          message: error?.message || "Unknown error",
        });
      }
    }

    setTableStatuses(results);
  }

  async function loadDebugTable(tableName = selectedTable) {
    setDebugError("");
    setDebugRows([]);

    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .limit(25);

    if (error) {
      setDebugError(error.message);
      return;
    }

    setDebugRows((data || []) as DebugRow[]);
  }

  async function auditProfile() {
    setProfileError("");
    setProfileResult(null);

    const email = profileEmail.trim().toLowerCase();

    if (!email) {
      setProfileError("Enter customer email.");
      return;
    }

    const { data: byEmail, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      setProfileError(error.message);
      return;
    }

    if (!byEmail) {
      setProfileError("No profile found for this email.");
      return;
    }

    setProfileResult(byEmail as DebugRow);
  }

  async function loadPurchaseTrace() {
    setMessage("");

    const email = profileEmail.trim().toLowerCase();

    const { data: profile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (profileLookupError) {
      setMessage(profileLookupError.message);
      return;
    }

    if (!profile?.id) {
      setMessage("Profile not found. Cannot trace purchases.");
      return;
    }

    const profileId = profile.id;

    const { data: transactions } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: trees } = await supabase
      .from("trees")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: inventory } = await supabase
      .from("inventory")
      .select("*")
      .eq("profile_id", profileId)
      .limit(10);

    setRecentWalletTransactions((transactions || []) as DebugRow[]);
    setRecentTrees((trees || []) as DebugRow[]);
    setRecentInventory((inventory || []) as DebugRow[]);
    setMessage(`Trace loaded for ${email}. Profile ID: ${profileId}`);
  }

  async function loadPage() {
    setLoading(true);

    const allowed = await checkAdminAccess();

    if (!allowed) return;

    await checkTables();
    await loadDebugTable("tree_purchase_requests");
    await auditProfile();
    await loadPurchaseTrace();

    setLoading(false);
  }

  useEffect(() => {
    loadPage();
  }, []);

  const healthStats = useMemo(() => {
    const pass = tableStatuses.filter((item) => item.status === "PASS").length;
    const fail = tableStatuses.filter((item) => item.status === "FAIL").length;

    return { pass, fail, total: tableStatuses.length };
  }, [tableStatuses]);

  const debugColumns = useMemo(() => {
    if (!debugRows.length) return [];
    return Object.keys(debugRows[0]);
  }, [debugRows]);

  const transactionColumns = useMemo(() => {
    if (!recentWalletTransactions.length) return [];
    return Object.keys(recentWalletTransactions[0]);
  }, [recentWalletTransactions]);

  const treeColumns = useMemo(() => {
    if (!recentTrees.length) return [];
    return Object.keys(recentTrees[0]);
  }, [recentTrees]);

  const inventoryColumns = useMemo(() => {
    if (!recentInventory.length) return [];
    return Object.keys(recentInventory[0]);
  }, [recentInventory]);

  if (loading) {
    return (
      <main className="page">
        <div className="loadingBox">Loading Admin Purchase Center...</div>

        <style>{`
          .page {
            min-height: 100vh;
            padding: 30px;
            font-family: Arial, Helvetica, sans-serif;
            background: linear-gradient(180deg, #f8f4eb 0%, #eadcc3 100%);
            color: #10281f;
          }

          .loadingBox {
            padding: 24px;
            border-radius: 24px;
            background: white;
            font-weight: 900;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <Link href="/admin/dashboard" className="back">
            ← Back to Admin Dashboard
          </Link>
          <p className="eyebrow">Agarwood Admin V5</p>
          <h1>Purchase Center Troubleshooter</h1>
          <p className="sub">
            Admin audit console for purchase flow, wallet deduction, tree creation,
            inventory stock, and database table health. Live Supabase only.
          </p>
        </div>

        <div className="healthCard">
          <small>Database Health</small>
          <strong>{healthStats.pass}/{healthStats.total}</strong>
          <span>{healthStats.fail} issue(s)</span>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      <section className="statsGrid">
        <div className="statCard">
          <small>Connected Tables</small>
          <strong>{healthStats.pass}</strong>
        </div>

        <div className="statCard danger">
          <small>Failed Tables</small>
          <strong>{healthStats.fail}</strong>
        </div>

        <div className="statCard">
          <small>Debug Rows</small>
          <strong>{debugRows.length}</strong>
        </div>

        <div className="statCard">
          <small>Profile Trace</small>
          <strong>{profileResult?.id ? "READY" : "CHECK"}</strong>
        </div>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow small">Table Health</p>
            <h2>Supabase Connection Check</h2>
          </div>

          <button onClick={checkTables}>Refresh Tables</button>
        </div>

        <div className="tableHealthGrid">
          {tableStatuses.map((item) => (
            <div
              key={item.table}
              className={item.status === "PASS" ? "tableHealth pass" : "tableHealth fail"}
            >
              <small>{item.status}</small>
              <b>{item.table}</b>
              <span>
                {item.status === "PASS"
                  ? `${item.count || 0} row(s)`
                  : item.message}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow small">Profile Audit</p>
            <h2>Customer Purchase Trace</h2>
          </div>

          <div className="actions">
            <input
              value={profileEmail}
              onChange={(event) => setProfileEmail(event.target.value)}
              placeholder="customer@test.com"
            />
            <button onClick={auditProfile}>Find Profile</button>
            <button onClick={loadPurchaseTrace}>Trace Purchases</button>
          </div>
        </div>

        {profileError && <div className="errorBox">{profileError}</div>}

        {profileResult && (
          <div className="profileBox">
            <div>
              <small>Profile ID</small>
              <b>{profileResult.id}</b>
            </div>
            <div>
              <small>Email</small>
              <b>{profileResult.email}</b>
            </div>
            <div>
              <small>Name</small>
              <b>{profileResult.full_name || "—"}</b>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow small">Raw Table Debugger</p>
            <h2>Admin Table Inspector</h2>
          </div>

          <div className="actions">
            <select
              value={selectedTable}
              onChange={(event) => {
                setSelectedTable(event.target.value);
                loadDebugTable(event.target.value);
              }}
            >
              {TABLES_TO_CHECK.map((table) => (
                <option key={table} value={table}>
                  {table}
                </option>
              ))}
            </select>
            <button onClick={() => loadDebugTable(selectedTable)}>Load</button>
          </div>
        </div>

        {debugError && <div className="errorBox">{debugError}</div>}

        {debugRows.length === 0 ? (
          <div className="empty">No rows found or table unavailable.</div>
        ) : (
          <div className="scrollTable">
            <table>
              <thead>
                <tr>
                  {debugColumns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {debugRows.map((row, index) => (
                  <tr key={row.id || index}>
                    {debugColumns.map((column) => (
                      <td key={column}>{safeText(row[column])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="traceGrid">
        <div className="panel">
          <div className="panelHead compact">
            <div>
              <p className="eyebrow small">Wallet</p>
              <h2>Recent Wallet Transactions</h2>
            </div>
          </div>

          {recentWalletTransactions.length === 0 ? (
            <div className="empty">No wallet transactions found.</div>
          ) : (
            <div className="scrollTable smallTable">
              <table>
                <thead>
                  <tr>
                    {transactionColumns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentWalletTransactions.map((row, index) => (
                    <tr key={row.id || index}>
                      {transactionColumns.map((column) => (
                        <td key={column}>
                          {column.includes("amount") ? peso(row[column]) : safeText(row[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panelHead compact">
            <div>
              <p className="eyebrow small">Trees</p>
              <h2>Recent Trees</h2>
            </div>
          </div>

          {recentTrees.length === 0 ? (
            <div className="empty">No trees found.</div>
          ) : (
            <div className="scrollTable smallTable">
              <table>
                <thead>
                  <tr>
                    {treeColumns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentTrees.map((row, index) => (
                    <tr key={row.id || index}>
                      {treeColumns.map((column) => (
                        <td key={column}>{safeText(row[column])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel full">
          <div className="panelHead compact">
            <div>
              <p className="eyebrow small">Inventory</p>
              <h2>Recent Inventory Stock</h2>
            </div>
          </div>

          {recentInventory.length === 0 ? (
            <div className="empty">No inventory found.</div>
          ) : (
            <div className="scrollTable smallTable">
              <table>
                <thead>
                  <tr>
                    {inventoryColumns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentInventory.map((row, index) => (
                    <tr key={row.id || index}>
                      {inventoryColumns.map((column) => (
                        <td key={column}>{safeText(row[column])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          padding: 30px;
          color: #18261d;
          font-family: Arial, Helvetica, sans-serif;
          background:
            radial-gradient(circle at 18% 5%, rgba(255, 226, 154, .55), transparent 24%),
            radial-gradient(circle at 92% 8%, rgba(255,255,255,.72), transparent 28%),
            linear-gradient(180deg, #f8f4eb 0%, #f3eadb 52%, #eadcc3 100%);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: stretch;
          gap: 18px;
          margin-bottom: 20px;
        }

        .back {
          display: inline-block;
          margin-bottom: 12px;
          color: #8c6a3c;
          font-weight: 900;
          text-decoration: none;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #8c6a3c;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
          font-size: 12px;
        }

        .eyebrow.small {
          font-size: 11px;
          margin-bottom: 4px;
        }

        h1 {
          margin: 0;
          font-size: 44px;
          color: #101a14;
          letter-spacing: -1.5px;
        }

        h2 {
          margin: 0;
          color: #101a14;
          font-size: 24px;
        }

        .sub {
          max-width: 850px;
          color: #5f665e;
          font-weight: 800;
          line-height: 1.6;
          margin: 10px 0 0;
        }

        .healthCard {
          min-width: 230px;
          border-radius: 28px;
          padding: 22px;
          color: white;
          background:
            radial-gradient(circle at 80% 18%, rgba(214,178,94,.44), transparent 34%),
            linear-gradient(135deg, #244536, #10281f);
          box-shadow: 0 24px 56px rgba(36,69,54,.24);
        }

        .healthCard small {
          display: block;
          color: rgba(255,255,255,.72);
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .14em;
          font-size: 12px;
        }

        .healthCard strong {
          display: block;
          margin-top: 8px;
          font-size: 38px;
        }

        .healthCard span {
          color: rgba(255,255,255,.75);
          font-weight: 900;
        }

        .message,
        .errorBox,
        .empty,
        .panel,
        .statCard {
          border-radius: 26px;
          background: rgba(255,253,246,.9);
          border: 1px solid rgba(92,70,35,.08);
          box-shadow: 0 18px 42px rgba(82,60,27,.09);
        }

        .message {
          padding: 16px 18px;
          margin-bottom: 18px;
          color: #244536;
          font-weight: 900;
        }

        .errorBox {
          padding: 16px;
          color: #7a2e1f;
          background: #fff0ea;
          font-weight: 900;
          margin-top: 14px;
        }

        .empty {
          padding: 16px;
          color: #6b6b62;
          font-weight: 900;
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .statCard {
          padding: 18px;
        }

        .statCard small {
          display: block;
          color: #8c6a3c;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .1em;
          font-size: 11px;
          margin-bottom: 8px;
        }

        .statCard strong {
          display: block;
          color: #244536;
          font-size: 30px;
        }

        .statCard.danger strong {
          color: #8a3a24;
        }

        .panel {
          padding: 18px;
          margin-bottom: 18px;
        }

        .panelHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          margin-bottom: 16px;
        }

        .panelHead.compact {
          margin-bottom: 12px;
        }

        .actions {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        button,
        input,
        select {
          border: 0;
          border-radius: 14px;
          padding: 12px 14px;
          font-weight: 900;
          font-family: inherit;
        }

        button {
          background: #244536;
          color: white;
          cursor: pointer;
        }

        input,
        select {
          background: #f3ead8;
          color: #244536;
          min-width: 220px;
        }

        .tableHealthGrid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
        }

        .tableHealth {
          border-radius: 18px;
          padding: 14px;
          background: #f3ead8;
          min-height: 110px;
        }

        .tableHealth.pass {
          background:
            radial-gradient(circle at 92% 10%, rgba(255,255,255,.55), transparent 28%),
            #e7efe1;
        }

        .tableHealth.fail {
          background:
            radial-gradient(circle at 92% 10%, rgba(255,255,255,.55), transparent 28%),
            #fff0ea;
        }

        .tableHealth small {
          display: block;
          font-size: 10px;
          color: #8c6a3c;
          font-weight: 900;
          letter-spacing: .1em;
        }

        .tableHealth b {
          display: block;
          margin: 8px 0;
          color: #10281f;
          word-break: break-word;
        }

        .tableHealth span {
          display: block;
          color: #5f665e;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.35;
          word-break: break-word;
        }

        .profileBox {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .profileBox div {
          border-radius: 18px;
          padding: 14px;
          background: #f3ead8;
        }

        .profileBox small {
          display: block;
          color: #8c6a3c;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .08em;
          margin-bottom: 6px;
        }

        .profileBox b {
          color: #10281f;
          word-break: break-word;
        }

        .scrollTable {
          width: 100%;
          overflow: auto;
          border-radius: 18px;
          border: 1px solid rgba(92,70,35,.08);
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 900px;
          background: white;
        }

        th {
          position: sticky;
          top: 0;
          background: #244536;
          color: white;
          padding: 12px;
          text-align: left;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .08em;
          white-space: nowrap;
        }

        td {
          padding: 12px;
          border-bottom: 1px solid #eee2c9;
          color: #2a332d;
          font-weight: 700;
          font-size: 13px;
          max-width: 280px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .traceGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .traceGrid .panel {
          margin-bottom: 0;
        }

        .traceGrid .panel.full {
          grid-column: 1 / -1;
        }

        .smallTable {
          max-height: 420px;
        }

        @media (max-width: 1100px) {
          .tableHealthGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .statsGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .traceGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .page {
            padding: 18px;
          }

          .hero,
          .panelHead,
          .statsGrid,
          .tableHealthGrid,
          .profileBox {
            display: grid;
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 34px;
          }

          .healthCard {
            min-width: 0;
          }

          .actions {
            justify-content: stretch;
          }

          input,
          select,
          button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}