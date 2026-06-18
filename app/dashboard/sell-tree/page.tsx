"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  membership_status: string | null;
  kyc_status: string | null;
};

type Tree = {
  id: string;
  profile_id: string;
  tree_code: string | null;
  display_name: string | null;
  farm_location: string | null;
  block_name: string | null;
  estimated_value: number | null;
  current_stage: string | null;
  ownership_status: string | null;
};

type SellTreeRequest = {
  id: string;
  tree_id: string | null;
  tree_value: number | null;
  platform_fee: number | null;
  net_receive: number | null;
  status: string | null;
  created_at: string | null;
};

export default function SellTreePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trees, setTrees] = useState<Tree[]>([]);
  const [requests, setRequests] = useState<SellTreeRequest[]>([]);
  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [manualValue, setManualValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const email = user.email?.trim().toLowerCase() || "";

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, full_name, email, membership_status, kyc_status")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, full_name, email, membership_status, kyc_status")
      .eq("email", email)
      .maybeSingle();

    const currentProfile = profileById || profileByEmail;

    if (!currentProfile) {
      setLoading(false);
      return;
    }

    setProfile(currentProfile);

    const { data: treeData } = await supabase
      .from("trees")
      .select(
        "id, profile_id, tree_code, display_name, farm_location, block_name, estimated_value, current_stage, ownership_status"
      )
      .eq("profile_id", currentProfile.id)
      .order("tree_code", { ascending: true });

    const { data: requestData } = await supabase
      .from("sell_tree_requests")
      .select("id, tree_id, tree_value, platform_fee, net_receive, status, created_at")
      .eq("profile_id", currentProfile.id)
      .order("created_at", { ascending: false });

    setTrees(treeData || []);
    setRequests(requestData || []);

    if ((treeData || []).length > 0 && !selectedTreeId) {
      setSelectedTreeId((treeData || [])[0].id);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedTree = useMemo(() => {
    return trees.find((tree) => tree.id === selectedTreeId) || null;
  }, [trees, selectedTreeId]);

  const treeValue = Number(manualValue || selectedTree?.estimated_value || 0);
  const platformFee = treeValue * 0.02;
  const netReceive = treeValue - platformFee;

  const membershipActive = profile?.membership_status === "ACTIVE";
  const kycApproved = profile?.kyc_status === "APPROVED";
  const canSubmit = membershipActive && kycApproved;

  async function submitSellRequest() {
    setMessage("");

    if (!profile) {
      setMessage("Profile not found.");
      return;
    }

    if (!selectedTree) {
      setMessage("Select a tree first.");
      return;
    }

    if (!canSubmit) {
      setMessage("Sell request locked. Membership must be ACTIVE and KYC must be APPROVED.");
      return;
    }

    if (!treeValue || treeValue <= 0) {
      setMessage("Tree value is required.");
      return;
    }

    const treeCode = selectedTree.tree_code || selectedTree.display_name || selectedTree.id;

    const { error } = await supabase.from("sell_tree_requests").insert({
      profile_id: profile.id,
      tree_id: treeCode,
      tree_value: treeValue,
      platform_fee: platformFee,
      net_receive: netReceive,
      status: "PENDING",
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Sell tree request submitted. Waiting for admin approval.");
    setManualValue("");
    await loadData();
  }

  return (
    <main className="sellPage">
      <section className="hero">
        <div>
          <p className="eyebrow">Agarwood Exit Request</p>
          <h1>Sell Tree</h1>
          <span>
            Submit a tree sale request for admin review. Platform fee is automatically
            calculated at 2%.
          </span>
        </div>

        <div className="heroCard">
          <p>Net Receive Preview</p>
          <strong>{peso(netReceive > 0 ? netReceive : 0)}</strong>
          <small>After 2% platform fee</small>
        </div>
      </section>

      {loading ? (
        <div className="loadingBox">Loading trees and sell requests...</div>
      ) : (
        <>
          {message && <div className="messageBox">{message}</div>}

          <section className="cards">
            <SummaryCard icon="🌳" label="Owned Trees" value={String(trees.length)} note="From trees table" />
            <SummaryCard icon="🎖️" label="Membership" value={profile?.membership_status || "UNKNOWN"} note="Required to sell" gold />
            <SummaryCard icon="🛡️" label="KYC Status" value={profile?.kyc_status || "UNKNOWN"} note="Required for payout" />
            <SummaryCard icon="🏛️" label="Platform Fee" value="2%" note="Deducted from sale value" gold />
          </section>

          <section className="grid">
            <div className="panel">
              <div className="panelHead">
                <div>
                  <h2>Select Tree to Sell</h2>
                  <p>Only real trees assigned to your profile will appear here.</p>
                </div>
              </div>

              {trees.length === 0 ? (
                <div className="emptyState">
                  No owned trees found. Add or seed records in the trees table first.
                </div>
              ) : (
                <>
                  <div className="treeList">
                    {trees.map((tree) => (
                      <button
                        key={tree.id}
                        className={selectedTreeId === tree.id ? "treeCard selected" : "treeCard"}
                        onClick={() => {
                          setSelectedTreeId(tree.id);
                          setManualValue("");
                        }}
                      >
                        <div>
                          <strong>{tree.tree_code || tree.display_name || "Unnamed Tree"}</strong>
                          <p>{tree.display_name || "Agarwood Tree"}</p>
                          <small>
                            {tree.farm_location || "No farm"} • {tree.block_name || "No block"}
                          </small>
                        </div>

                        <div>
                          <span>{tree.current_stage || "Unknown Stage"}</span>
                          <b>{peso(Number(tree.estimated_value || 0))}</b>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="valueBox">
                    <label>
                      Tree Value
                      <input
                        value={manualValue}
                        onChange={(e) => setManualValue(e.target.value)}
                        type="number"
                        placeholder={`Default: ${peso(Number(selectedTree?.estimated_value || 0))}`}
                      />
                    </label>

                    <div className="notice">
                      If tree value is empty, the system uses the selected tree&apos;s
                      estimated value from the database.
                    </div>
                  </div>
                </>
              )}
            </div>

            <aside className="panel">
              <div className="panelHead">
                <div>
                  <h2>Sale Preview</h2>
                  <p>Review fees before submitting.</p>
                </div>
              </div>

              <div className={`rule ${membershipActive ? "ok" : "locked"}`}>
                <span>{membershipActive ? "✓" : "!"}</span>
                <div>
                  <strong>Membership</strong>
                  <p>{profile?.membership_status || "UNKNOWN"}</p>
                </div>
              </div>

              <div className={`rule ${kycApproved ? "ok" : "locked"}`}>
                <span>{kycApproved ? "✓" : "!"}</span>
                <div>
                  <strong>KYC Verification</strong>
                  <p>{profile?.kyc_status || "UNKNOWN"}</p>
                </div>
              </div>

              <div className="previewBox">
                <div className="previewRow">
                  <span>Selected Tree</span>
                  <b>{selectedTree?.tree_code || "None"}</b>
                </div>

                <div className="previewRow">
                  <span>Tree Value</span>
                  <b>{peso(treeValue)}</b>
                </div>

                <div className="previewRow">
                  <span>Platform Fee 2%</span>
                  <b>{peso(platformFee)}</b>
                </div>

                <div className="previewRow final">
                  <span>Net Receive</span>
                  <b>{peso(netReceive > 0 ? netReceive : 0)}</b>
                </div>
              </div>

              <button className="primaryButton" onClick={submitSellRequest} disabled={!canSubmit || trees.length === 0}>
                Submit Sell Request
              </button>

              {!canSubmit && (
                <small className="lockText">
                  Selling locked. Membership must be ACTIVE and KYC must be APPROVED.
                </small>
              )}
            </aside>
          </section>

          <section className="panel requestsPanel">
            <div className="panelHead">
              <div>
                <h2>Sell Tree Requests</h2>
                <p>Real records from sell_tree_requests.</p>
              </div>
            </div>

            {requests.length === 0 ? (
              <div className="emptyState">No sell tree requests yet.</div>
            ) : (
              <div className="requestList">
                {requests.map((item) => (
                  <div className="requestCard" key={item.id}>
                    <div>
                      <strong>{item.tree_id || "No Tree ID"}</strong>
                      <p>Tree Value: {peso(Number(item.tree_value || 0))}</p>
                      <p>Platform Fee: {peso(Number(item.platform_fee || 0))}</p>
                    </div>

                    <div>
                      <span className={`status ${statusClass(item.status)}`}>
                        {item.status || "PENDING"}
                      </span>
                      <b>Net: {peso(Number(item.net_receive || 0))}</b>
                      <small>{formatDate(item.created_at)}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <style>{`
        * { box-sizing: border-box; }

        .sellPage {
          min-height: 100vh;
          padding: 28px;
          color: #18261d;
          font-family: Arial, Helvetica, sans-serif;
          background:
            radial-gradient(circle at 18% 5%, rgba(255, 226, 154, .55), transparent 22%),
            radial-gradient(circle at 90% 12%, rgba(255,255,255,.72), transparent 28%),
            linear-gradient(180deg, #f8f4eb 0%, #f3eadb 52%, #eadcc3 100%);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 22px;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #8c6a3c;
          font-weight: 900;
          letter-spacing: .5px;
          text-transform: uppercase;
          font-size: 12px;
        }

        .hero h1 {
          margin: 0;
          font-size: 42px;
          letter-spacing: -1.4px;
          color: #101a14;
        }

        .hero span {
          display: block;
          margin-top: 8px;
          color: #5f665e;
          font-size: 15px;
          max-width: 760px;
        }

        .heroCard {
          min-width: 290px;
          border-radius: 24px;
          padding: 22px;
          color: white;
          background:
            radial-gradient(circle at 80% 18%, rgba(214,178,94,.44), transparent 30%),
            linear-gradient(135deg, #244536, #10281f);
          box-shadow: 0 18px 42px rgba(36,69,54,.22);
        }

        .heroCard p {
          margin: 0;
          color: rgba(255,255,255,.75);
          font-weight: 900;
        }

        .heroCard strong {
          display: block;
          margin-top: 8px;
          font-size: 32px;
          letter-spacing: -1px;
        }

        .heroCard small {
          color: rgba(255,255,255,.72);
          font-weight: 900;
        }

        .cards {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
        }

        .summaryCard,
        .panel,
        .loadingBox,
        .messageBox {
          border-radius: 22px;
          background: rgba(255,253,246,.86);
          border: 1px solid rgba(92,70,35,.08);
          box-shadow: 0 18px 42px rgba(82,60,27,.09);
        }

        .summaryCard {
          min-height: 145px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .summaryIcon {
          width: 66px;
          height: 66px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 28px;
          background: radial-gradient(circle, #f5e8c9, #d9ccb0);
        }

        .summaryIcon.gold {
          background: radial-gradient(circle, #fff2bc, #c9a34d);
        }

        .summaryCard p {
          margin: 0 0 8px;
          font-size: 13px;
          color: #5f665e;
          font-weight: 900;
        }

        .summaryCard h3 {
          margin: 0 0 8px;
          font-size: 25px;
          letter-spacing: -1px;
          color: #101a14;
        }

        .summaryCard small {
          color: #8c6a3c;
          font-weight: 900;
        }

        .loadingBox,
        .messageBox {
          padding: 20px;
          margin-bottom: 16px;
          color: #31553d;
          font-weight: 900;
        }

        .grid {
          display: grid;
          grid-template-columns: 1.45fr 420px;
          gap: 16px;
          margin-bottom: 16px;
        }

        .panel {
          padding: 22px;
        }

        .panelHead {
          display: flex;
          justify-content: space-between;
          align-items: start;
          gap: 18px;
          margin-bottom: 18px;
        }

        .panelHead h2 {
          margin: 0;
          color: #101a14;
          font-size: 24px;
        }

        .panelHead p {
          margin: 6px 0 0;
          color: #6b6b62;
          font-size: 14px;
        }

        .treeList {
          display: grid;
          gap: 12px;
        }

        .treeCard {
          width: 100%;
          border: 2px solid transparent;
          border-radius: 20px;
          padding: 16px;
          background: #f3ead8;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          text-align: left;
          cursor: pointer;
        }

        .treeCard.selected {
          border-color: #8c6a3c;
          box-shadow: 0 14px 30px rgba(140,106,60,.16);
        }

        .treeCard strong {
          color: #101a14;
          font-size: 18px;
        }

        .treeCard p {
          margin: 6px 0 0;
          color: #6b6b62;
          font-weight: 800;
        }

        .treeCard small {
          display: block;
          margin-top: 4px;
          color: #8c6a3c;
          font-weight: 900;
        }

        .treeCard div:last-child {
          display: grid;
          justify-items: end;
          gap: 8px;
        }

        .treeCard span {
          border-radius: 999px;
          padding: 8px 11px;
          background: rgba(49,85,61,.12);
          color: #31553d;
          font-size: 12px;
          font-weight: 900;
        }

        .treeCard b {
          color: #101a14;
          font-size: 18px;
        }

        .valueBox {
          margin-top: 16px;
          border-radius: 20px;
          padding: 16px;
          background: rgba(255,253,246,.72);
          border: 1px solid rgba(92,70,35,.10);
        }

        label {
          display: grid;
          gap: 8px;
          color: #5f665e;
          font-weight: 900;
          font-size: 13px;
        }

        input {
          width: 100%;
          border: 1px solid rgba(92,70,35,.14);
          border-radius: 14px;
          padding: 13px 14px;
          background: rgba(255,253,246,.92);
          color: #101a14;
          outline: none;
          font-weight: 800;
        }

        .notice {
          margin-top: 12px;
          color: #8c6a3c;
          font-size: 13px;
          font-weight: 900;
        }

        .rule {
          margin-bottom: 14px;
          display: grid;
          grid-template-columns: 42px 1fr;
          gap: 12px;
          padding: 14px;
          border-radius: 18px;
          background: #f3ead8;
          border: 1px solid rgba(92,70,35,.08);
        }

        .rule span {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-weight: 900;
        }

        .rule.ok span {
          background: rgba(49,85,61,.14);
          color: #31553d;
        }

        .rule.locked span {
          background: rgba(214,178,94,.25);
          color: #8c6a3c;
        }

        .rule strong {
          color: #101a14;
        }

        .rule p {
          margin: 5px 0 0;
          color: #6b6b62;
          font-size: 13px;
        }

        .previewBox {
          margin-top: 18px;
          border-radius: 20px;
          padding: 18px;
          background: rgba(255,253,246,.72);
          border: 1px solid rgba(92,70,35,.10);
        }

        .previewRow {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(92,70,35,.10);
        }

        .previewRow:first-child {
          margin-top: 0;
          padding-top: 0;
          border-top: 0;
        }

        .previewRow span {
          color: #6b6b62;
          font-weight: 900;
        }

        .previewRow b {
          color: #101a14;
          text-align: right;
        }

        .previewRow.final b {
          color: #31553d;
          font-size: 20px;
        }

        .primaryButton {
          margin-top: 16px;
          width: 100%;
          border: 0;
          border-radius: 16px;
          padding: 15px 18px;
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 14px 30px rgba(36,69,54,.18);
        }

        .primaryButton:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .lockText {
          display: block;
          margin-top: 12px;
          color: #8c6a3c;
          font-weight: 900;
        }

        .emptyState {
          padding: 18px;
          border-radius: 18px;
          background: #f3ead8;
          color: #6b6b62;
          font-weight: 900;
        }

        .requestsPanel {
          margin-top: 16px;
        }

        .requestList {
          display: grid;
          gap: 12px;
        }

        .requestCard {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          padding: 16px;
          border-radius: 18px;
          background: #f3ead8;
          border: 1px solid rgba(92,70,35,.08);
        }

        .requestCard strong {
          color: #101a14;
          font-size: 16px;
        }

        .requestCard p {
          margin: 5px 0 0;
          color: #6b6b62;
          font-size: 13px;
        }

        .requestCard div:last-child {
          display: grid;
          justify-items: end;
          gap: 8px;
        }

        .requestCard b {
          color: #31553d;
        }

        .requestCard small {
          color: #6b6b62;
          font-weight: 800;
        }

        .status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 92px;
          padding: 8px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
        }

        .status.completed,
        .status.approved,
        .status.paid {
          background: rgba(49,85,61,.12);
          color: #31553d;
        }

        .status.pending,
        .status.processing {
          background: rgba(214,178,94,.20);
          color: #8c6a3c;
        }

        .status.rejected,
        .status.failed {
          background: rgba(163,60,42,.12);
          color: #a33c2a;
        }

        @media (max-width: 1200px) {
          .cards {
            grid-template-columns: repeat(2, 1fr);
          }

          .grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .sellPage {
            padding: 18px;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
          }

          .heroCard {
            width: 100%;
          }

          .cards {
            grid-template-columns: 1fr;
          }

          .hero h1 {
            font-size: 34px;
          }

          .treeCard,
          .requestCard {
            flex-direction: column;
            align-items: flex-start;
          }

          .treeCard div:last-child,
          .requestCard div:last-child {
            justify-items: start;
          }
        }
      `}</style>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  note,
  icon,
  gold,
}: {
  label: string;
  value: string;
  note: string;
  icon: string;
  gold?: boolean;
}) {
  return (
    <div className="summaryCard">
      <div className={`summaryIcon ${gold ? "gold" : ""}`}>{icon}</div>
      <div>
        <p>{label}</p>
        <h3>{value}</h3>
        <small>{note}</small>
      </div>
    </div>
  );
}

function peso(value: number) {
  return `₱ ${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusClass(value: string | null) {
  return (value || "pending").toLowerCase();
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}