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

type SellTreeRequest = Record<string, any>;

function peso(value: number) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function normalizeStatus(value: any) {
  return String(value || "PENDING").trim().toUpperCase();
}

function statusClass(value: any) {
  const status = normalizeStatus(value);
  if (["APPROVED", "COMPLETED", "PAID", "SOLD"].includes(status)) return "good";
  if (["PENDING", "PENDING ADMIN VALUATION", "PROCESSING", "WAITING"].includes(status)) return "warning";
  if (["REJECTED", "CANCELLED", "FAILED"].includes(status)) return "bad";
  return "neutral";
}

function getTreeKey(tree: Tree) {
  return tree.tree_code || tree.display_name || tree.id;
}

function requestMatchesTree(request: SellTreeRequest, tree: Tree) {
  const requestTreeId = String(request.tree_id || "");
  return (
    requestTreeId === tree.id ||
    requestTreeId === tree.tree_code ||
    requestTreeId === tree.display_name
  );
}

function isPendingRequest(request: SellTreeRequest) {
  const status = normalizeStatus(request.status);
  return ["PENDING", "PENDING ADMIN VALUATION", "PROCESSING", "WAITING"].includes(status);
}

export default function SellTreePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trees, setTrees] = useState<Tree[]>([]);
  const [requests, setRequests] = useState<SellTreeRequest[]>([]);
  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function findProfile() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw new Error(userError.message);

    if (!user) {
      window.location.href = "/login";
      return null;
    }

    const email = user.email?.trim().toLowerCase() || "";

    const { data: profileById, error: profileByIdError } = await supabase
      .from("profiles")
      .select("id, full_name, email, membership_status, kyc_status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileByIdError) throw new Error(profileByIdError.message);

    const { data: profileByEmail, error: profileByEmailError } = await supabase
      .from("profiles")
      .select("id, full_name, email, membership_status, kyc_status")
      .ilike("email", email)
      .maybeSingle();

    if (profileByEmailError) throw new Error(profileByEmailError.message);

    return profileById || profileByEmail;
  }

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const currentProfile = await findProfile();

      if (!currentProfile) {
        setLoading(false);
        return;
      }

      setProfile(currentProfile);

      const { data: treeData, error: treeError } = await supabase
        .from("trees")
        .select(
          "id, profile_id, tree_code, display_name, farm_location, block_name, estimated_value, current_stage, ownership_status"
        )
        .eq("profile_id", currentProfile.id)
        .order("tree_code", { ascending: true });

      if (treeError) throw new Error(treeError.message);

      const { data: requestData, error: requestError } = await supabase
        .from("sell_tree_requests")
        .select("*")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false });

      if (requestError) throw new Error(requestError.message);

      const activeTrees = (treeData || []).filter((tree) => {
        const status = normalizeStatus(tree.ownership_status);
        return !["SOLD", "EXITED", "TRANSFERRED", "CANCELLED"].includes(status);
      });

      setTrees(activeTrees);
      setRequests(requestData || []);

      if (activeTrees.length > 0 && !selectedTreeId) {
        setSelectedTreeId(activeTrees[0].id);
      }
    } catch (error: any) {
      setMessage(error.message || "Failed to load sell tree data.");
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedTree = useMemo(() => {
    return trees.find((tree) => tree.id === selectedTreeId) || null;
  }, [trees, selectedTreeId]);

  const pendingRequests = useMemo(() => {
    return requests.filter(isPendingRequest);
  }, [requests]);

  const selectedTreePendingRequest = useMemo(() => {
    if (!selectedTree) return null;
    return pendingRequests.find((request) => requestMatchesTree(request, selectedTree)) || null;
  }, [pendingRequests, selectedTree]);

  const membershipActive = normalizeStatus(profile?.membership_status) === "ACTIVE";
  const kycApproved = normalizeStatus(profile?.kyc_status) === "APPROVED";

  const canSubmit =
    membershipActive &&
    kycApproved &&
    Boolean(selectedTree) &&
    !selectedTreePendingRequest &&
    !submitting;

  async function submitValuationRequest() {
    setMessage("");

    if (!profile) {
      setMessage("Profile not found.");
      return;
    }

    if (!selectedTree) {
      setMessage("Select a tree first.");
      return;
    }

    if (!membershipActive || !kycApproved) {
      setMessage("Sell Tree is locked. Membership must be ACTIVE and KYC must be APPROVED.");
      return;
    }

    if (selectedTreePendingRequest) {
      setMessage("This tree already has a pending admin valuation request.");
      return;
    }

    setSubmitting(true);

    const treeCode = getTreeKey(selectedTree);

    const { error } = await supabase.from("sell_tree_requests").insert({
      profile_id: profile.id,
      tree_id: treeCode,
      tree_value: 0,
      platform_fee: 0,
      net_receive: 0,
      status: "PENDING ADMIN VALUATION",
    });

    if (error) {
      setMessage(error.message);
      setSubmitting(false);
      return;
    }

    setMessage("Tree valuation request submitted. Waiting for admin valuation.");
    await loadData();
    setSubmitting(false);
  }

  return (
    <main className="sellPage">
      <section className="hero">
        <div>
          <p className="eyebrow">Agarwood Sell Tree</p>
          <h1>Sell Tree</h1>
          <span>
            Request admin valuation for your selected tree. Admin will set the offered price,
            add notes, and approve or reject the sale.
          </span>
        </div>

        <div className="heroCard">
          <p>Admin Valuation</p>
          <strong>Pending</strong>
          <small>Price is set by admin review</small>
        </div>
      </section>

      {loading ? (
        <div className="loadingBox">Loading trees and sell tree requests...</div>
      ) : (
        <>
          {message && <div className="messageBox">{message}</div>}

          <section className="cards">
            <SummaryCard
              icon="🌳"
              label="Available Trees"
              value={String(trees.length)}
              note="Can request valuation"
            />
            <SummaryCard
              icon="⏳"
              label="Pending Valuation"
              value={String(pendingRequests.length)}
              note="Waiting for admin"
              gold
            />
            <SummaryCard
              icon="🎖️"
              label="Membership"
              value={profile?.membership_status || "UNKNOWN"}
              note="Required to sell"
            />
            <SummaryCard
              icon="🛡️"
              label="KYC Status"
              value={profile?.kyc_status || "UNKNOWN"}
              note="Required for payout"
              gold
            />
          </section>

          <section className="grid">
            <div className="panel">
              <div className="panelHead">
                <div>
                  <h2>Select Tree</h2>
                  <p>
                    Choose the tree you want admin to evaluate. Trees with pending valuation
                    requests are locked from duplicate requests.
                  </p>
                </div>
              </div>

              {trees.length === 0 ? (
                <div className="emptyState">No active owned trees found.</div>
              ) : (
                <div className="treeList">
                  {trees.map((tree) => {
                    const pending = pendingRequests.find((request) =>
                      requestMatchesTree(request, tree)
                    );
                    const selected = selectedTreeId === tree.id;

                    return (
                      <button
                        key={tree.id}
                        className={selected ? "treeCard selected" : "treeCard"}
                        onClick={() => setSelectedTreeId(tree.id)}
                      >
                        <div>
                          <strong>{tree.tree_code || tree.display_name || "Unnamed Tree"}</strong>
                          <p>{tree.display_name || "Agarwood Tree"}</p>
                          <small>
                            {tree.farm_location || "No farm"} • {tree.block_name || "No block"}
                          </small>
                        </div>

                        <div>
                          <span className={pending ? "pendingBadge" : ""}>
                            {pending ? "Pending Admin Valuation" : tree.current_stage || "Unknown Stage"}
                          </span>
                          <b>{tree.ownership_status || "ACTIVE"}</b>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <aside className="panel">
              <div className="panelHead">
                <div>
                  <h2>Valuation Request</h2>
                  <p>Customer does not set the price. Admin will decide the tree value.</p>
                </div>
              </div>

              <Rule ok={membershipActive} title="Membership" value={profile?.membership_status || "UNKNOWN"} />
              <Rule ok={kycApproved} title="KYC Verification" value={profile?.kyc_status || "UNKNOWN"} />

              <div className="previewBox">
                <Preview
                  label="Selected Tree"
                  value={selectedTree?.tree_code || selectedTree?.display_name || "None"}
                />
                <Preview label="Admin Valuation" value="Waiting for admin review" />
                <Preview label="Platform Fee" value="Calculated after approval" />
                <Preview label="Net Receive" value="Available after approval" final />
              </div>

              <button className="primaryButton" onClick={submitValuationRequest} disabled={!canSubmit}>
                {submitting
                  ? "Submitting..."
                  : selectedTreePendingRequest
                    ? "Already Pending Valuation"
                    : "Request Tree Valuation"}
              </button>

              {!canSubmit && (
                <small className="lockText">
                  Sell Tree requires ACTIVE membership, APPROVED KYC, selected tree,
                  and no duplicate pending valuation request.
                </small>
              )}
            </aside>
          </section>

          <section className="panel requestsPanel">
            <div className="panelHead">
              <div>
                <h2>Sell Tree Requests</h2>
                <p>Live request log from sell_tree_requests.</p>
              </div>
            </div>

            {requests.length === 0 ? (
              <div className="emptyState">No sell tree requests yet.</div>
            ) : (
              <div className="requestList">
                {requests.map((item) => {
                  const adminValue = Number(item.approved_value || item.final_value || item.tree_value || 0);
                  const fee = Number(item.platform_fee || 0);
                  const net = Number(item.net_receive || 0);

                  return (
                    <div className="requestCard" key={item.id}>
                      <div>
                        <strong>{item.tree_id || "No Tree ID"}</strong>
                        <p>
                          Admin Valuation:{" "}
                          {adminValue > 0 ? peso(adminValue) : "Waiting for admin review"}
                        </p>
                        <p>
                          Platform Fee: {fee > 0 ? peso(fee) : "Pending approval"}
                        </p>
                        <small>{item.admin_notes || "Admin Notes: Waiting for review"}</small>
                      </div>

                      <div>
                        <span className={`status ${statusClass(item.status)}`}>
                          {item.status || "PENDING ADMIN VALUATION"}
                        </span>
                        <b>{net > 0 ? `Net Receive: ${peso(net)}` : "Net Receive: Pending"}</b>
                        <small>{formatDate(item.created_at)}</small>
                      </div>
                    </div>
                  );
                })}
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
          line-height: 1.5;
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
          line-height: 1.45;
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

        .treeCard span.pendingBadge {
          background: rgba(214,178,94,.25);
          color: #8c6a3c;
        }

        .treeCard b {
          color: #101a14;
          font-size: 14px;
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
          font-size: 18px;
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
          font-weight: 800;
        }

        .requestCard small {
          display: block;
          margin-top: 5px;
          color: #8c6a3c;
          font-weight: 900;
        }

        .requestCard div:last-child {
          display: grid;
          justify-items: end;
          gap: 8px;
        }

        .requestCard b {
          color: #31553d;
        }

        .status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 92px;
          padding: 8px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
        }

        .status.good {
          background: rgba(49,85,61,.14);
          color: #31553d;
        }

        .status.warning {
          background: rgba(214,178,94,.25);
          color: #8c6a3c;
        }

        .status.bad {
          background: rgba(163,60,42,.14);
          color: #a33c2a;
        }

        .status.neutral {
          background: rgba(95,102,94,.12);
          color: #5f665e;
        }

        @media (max-width: 1050px) {
          .hero,
          .requestCard {
            flex-direction: column;
            align-items: stretch;
          }

          .cards,
          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  note,
  gold,
}: {
  icon: string;
  label: string;
  value: string;
  note: string;
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

function Rule({ ok, title, value }: { ok: boolean; title: string; value: string }) {
  return (
    <div className={`rule ${ok ? "ok" : "locked"}`}>
      <span>{ok ? "✓" : "!"}</span>
      <div>
        <strong>{title}</strong>
        <p>{value}</p>
      </div>
    </div>
  );
}

function Preview({ label, value, final }: { label: string; value: string; final?: boolean }) {
  return (
    <div className={`previewRow ${final ? "final" : ""}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}