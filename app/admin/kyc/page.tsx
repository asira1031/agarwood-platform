"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type KYCRecord = {
  id: string;
  profile_id: string | null;
  id_type: string | null;
  id_number: string | null;
  id_front_url: string | null;
  id_back_url: string | null;
  selfie_url: string | null;
  source_of_funds: string | null;
  investment_experience: string | null;
  risk_acknowledged: boolean | null;
  status: string | null;
  review_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  kyc_status: string | null;
};

type TabKey = "PENDING" | "HISTORY";

function normalize(value: any) {
  return String(value || "").trim().toUpperCase();
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function maskId(value: string | null | undefined) {
  if (!value) return "N/A";
  const clean = String(value).trim();
  if (clean.length <= 4) return "****";
  return `${"*".repeat(Math.max(clean.length - 4, 4))}${clean.slice(-4)}`;
}

function statusBadge(statusValue: string | null | undefined) {
  const status = normalize(statusValue || "PENDING");
  if (status === "APPROVED") return "badge approved";
  if (status === "REJECTED") return "badge rejected";
  return "badge pending";
}

export default function AdminKYCPage() {
  const [records, setRecords] = useState<KYCRecord[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<TabKey>("PENDING");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<KYCRecord | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [checks, setChecks] = useState({
    idNumberMatches: false,
    frontBackMatch: false,
    selfieMatches: false,
    readable: false,
  });

  useEffect(() => {
    loadKYC();
  }, []);

  async function loadKYC() {
    setLoading(true);
    setMessage("");

    const { data: kycRows, error: kycError } = await supabase
      .from("kyc_records")
      .select(
        "id, profile_id, id_type, id_number, id_front_url, id_back_url, selfie_url, source_of_funds, investment_experience, risk_acknowledged, status, review_notes, submitted_at, reviewed_at"
      )
      .order("submitted_at", { ascending: false });

    if (kycError) {
      setMessage(kycError.message);
      setRecords([]);
      setProfiles([]);
      setLoading(false);
      return;
    }

    const rows = (kycRows || []) as KYCRecord[];
    const profileIds = Array.from(
      new Set(rows.map((item) => item.profile_id).filter(Boolean))
    ) as string[];

    let profileRows: ProfileRow[] = [];

    if (profileIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, kyc_status")
        .in("id", profileIds);

      if (profileError) {
        setMessage(profileError.message);
      } else {
        profileRows = (profileData || []) as ProfileRow[];
      }
    }

    setRecords(rows);
    setProfiles(profileRows);
    setLoading(false);
  }

  function getProfile(profileId: string | null | undefined) {
    return profiles.find((profile) => profile.id === profileId) || null;
  }

  function openReview(record: KYCRecord) {
    setSelected(record);
    setReviewNotes(record.review_notes || "");
    setChecks({
      idNumberMatches: false,
      frontBackMatch: false,
      selfieMatches: false,
      readable: false,
    });
    setPreviewUrl(null);
  }

  function closeReview() {
    setSelected(null);
    setReviewNotes("");
    setPreviewUrl(null);
  }

  const pendingRecords = useMemo(
    () => records.filter((record) => normalize(record.status || "PENDING") === "PENDING"),
    [records]
  );

  const historyRecords = useMemo(
    () =>
      records.filter((record) =>
        ["APPROVED", "REJECTED"].includes(normalize(record.status))
      ),
    [records]
  );

  const approvedCount = records.filter(
    (record) => normalize(record.status) === "APPROVED"
  ).length;

  const rejectedCount = records.filter(
    (record) => normalize(record.status) === "REJECTED"
  ).length;

  const activeRecords = tab === "PENDING" ? pendingRecords : historyRecords;

  const filteredRecords = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return activeRecords;

    return activeRecords.filter((record) => {
      const profile = getProfile(record.profile_id);
      return [
        profile?.full_name,
        profile?.email,
        record.id_type,
        record.id_number,
        record.status,
      ]
        .filter(Boolean)
        .some((item) => String(item).toLowerCase().includes(search));
    });
  }, [activeRecords, query, profiles]);

  const allChecksPassed =
    checks.idNumberMatches &&
    checks.frontBackMatch &&
    checks.selfieMatches &&
    checks.readable;

  async function reviewKYC(record: KYCRecord, nextStatus: "APPROVED" | "REJECTED") {
    if (!record.id || !record.profile_id) {
      setMessage("Missing KYC record ID or profile ID.");
      return;
    }

    if (nextStatus === "APPROVED" && !allChecksPassed) {
      setMessage("Complete the admin review checklist before approving.");
      return;
    }

    if (nextStatus === "REJECTED" && !reviewNotes.trim()) {
      setMessage("Review notes are required when rejecting KYC.");
      return;
    }

    const confirmed = window.confirm(
      nextStatus === "APPROVED"
        ? "Approve this KYC submission?"
        : "Reject this KYC submission?"
    );

    if (!confirmed) return;

    setWorkingId(record.id);
    setMessage("");

    const reviewedAt = new Date().toISOString();
    const finalNote =
      reviewNotes.trim() ||
      (nextStatus === "APPROVED"
        ? "KYC approved by admin after document and selfie review."
        : "KYC rejected by admin.");

    const { error: kycError } = await supabase
      .from("kyc_records")
      .update({
        status: nextStatus,
        review_notes: finalNote,
        reviewed_at: reviewedAt,
      })
      .eq("id", record.id);

    if (kycError) {
      setMessage(kycError.message);
      setWorkingId("");
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        kyc_status: nextStatus,
      })
      .eq("id", record.profile_id);

    if (profileError) {
      setMessage(profileError.message);
      setWorkingId("");
      return;
    }

    setMessage(`KYC ${nextStatus}. Record moved to KYC History.`);
    setWorkingId("");
    closeReview();
    await loadKYC();
    setTab("PENDING");
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Admin Trust Desk</p>
          <h1>KYC Review Center</h1>
          <span>
            Review submitted ID documents and live selfie evidence before approval.
            Approve or reject only inside the detailed review panel.
          </span>
        </div>

        <button onClick={loadKYC} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh KYC"}
        </button>
      </section>

      {message && <div className="message">{message}</div>}

      <section className="stats">
        <StatCard label="Pending Review" value={String(pendingRecords.length)} />
        <StatCard label="Approved" value={String(approvedCount)} />
        <StatCard label="Rejected" value={String(rejectedCount)} />
        <StatCard label="Total Records" value={String(records.length)} />
      </section>

      <section className="toolbar">
        <div className="tabs">
          <button
            onClick={() => setTab("PENDING")}
            className={tab === "PENDING" ? "activeTab" : ""}
          >
            Pending Queue
          </button>
          <button
            onClick={() => setTab("HISTORY")}
            className={tab === "HISTORY" ? "activeTab" : ""}
          >
            KYC History
          </button>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, ID number..."
        />
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">{tab === "PENDING" ? "Review Queue" : "History"}</p>
            <h2>{tab === "PENDING" ? "Pending KYC Requests" : "Reviewed KYC Records"}</h2>
            <span>
              Showing {filteredRecords.length} of {activeRecords.length} records.
            </span>
          </div>
        </div>

        {loading ? (
          <div className="empty">Loading KYC records...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="empty">
            {tab === "PENDING"
              ? "No pending KYC submissions."
              : "No reviewed KYC history yet."}
          </div>
        ) : (
          <div className="queue">
            {filteredRecords.map((record) => {
              const profile = getProfile(record.profile_id);
              const status = normalize(record.status || "PENDING");

              return (
                <article key={record.id} className="queueCard">
                  <div className="customerBlock">
                    <strong>{profile?.full_name || "Unknown Customer"}</strong>
                    <span>{profile?.email || "No email"}</span>
                    <small>Submitted: {formatDate(record.submitted_at)}</small>
                  </div>

                  <div className="metaBlock">
                    <p>ID Type</p>
                    <strong>{record.id_type || "N/A"}</strong>
                  </div>

                  <div className="metaBlock">
                    <p>ID Number</p>
                    <strong>{maskId(record.id_number)}</strong>
                  </div>

                  <div className="metaBlock">
                    <p>Files</p>
                    <strong>
                      {[record.id_front_url, record.id_back_url, record.selfie_url].filter(Boolean).length}/3
                    </strong>
                  </div>

                  <span className={statusBadge(status)}>{status}</span>

                  <button className="openBtn" onClick={() => openReview(record)}>
                    Open Review
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selected && (
        <section className="drawerBackdrop">
          <div className="drawer">
            <div className="drawerHead">
              <div>
                <p className="eyebrow">KYC Request Review</p>
                <h2>{getProfile(selected.profile_id)?.full_name || "Unknown Customer"}</h2>
                <span>{getProfile(selected.profile_id)?.email || "No email"}</span>
              </div>

              <button onClick={closeReview}>Close</button>
            </div>

            <div className="reviewGrid">
              <div className="detailsPanel">
                <h3>Submitted Details</h3>

                <Info label="Status" value={normalize(selected.status || "PENDING")} />
                <Info label="ID Type" value={selected.id_type || "N/A"} />
                <Info label="Submitted ID Number" value={selected.id_number || "N/A"} />
                <Info label="Source of Funds" value={selected.source_of_funds || "N/A"} />
                <Info
                  label="Investment Experience"
                  value={selected.investment_experience || "N/A"}
                />
                <Info
                  label="Risk Acknowledged"
                  value={selected.risk_acknowledged ? "YES" : "NO"}
                />
                <Info label="Submitted" value={formatDate(selected.submitted_at)} />
                <Info label="Reviewed" value={formatDate(selected.reviewed_at)} />

                <div className="idCompare">
                  <p>Compare this submitted number against the ID image:</p>
                  <strong>{selected.id_number || "N/A"}</strong>
                </div>
              </div>

              <div className="evidencePanel">
                <h3>Document Evidence</h3>

                <div className="docButtons">
                  <DocButton
                    label="Open Front ID"
                    url={selected.id_front_url}
                    onOpen={setPreviewUrl}
                  />
                  <DocButton
                    label="Open Back ID"
                    url={selected.id_back_url}
                    onOpen={setPreviewUrl}
                  />
                  <DocButton
                    label="Open Selfie"
                    url={selected.selfie_url}
                    onOpen={setPreviewUrl}
                  />
                </div>

                <div className="previewBox">
                  {previewUrl ? (
                    <img src={previewUrl} alt="KYC preview" />
                  ) : (
                    <div className="empty small">
                      Open Front ID, Back ID, or Selfie to review.
                    </div>
                  )}
                </div>
              </div>

              <div className="checkPanel">
                <h3>Admin Review Checklist</h3>

                <CheckItem
                  label="Submitted ID number matches the uploaded ID."
                  checked={checks.idNumberMatches}
                  onChange={(checked) =>
                    setChecks({ ...checks, idNumberMatches: checked })
                  }
                />

                <CheckItem
                  label="Front and back ID belong to the same person."
                  checked={checks.frontBackMatch}
                  onChange={(checked) =>
                    setChecks({ ...checks, frontBackMatch: checked })
                  }
                />

                <CheckItem
                  label="Selfie matches the ID photo."
                  checked={checks.selfieMatches}
                  onChange={(checked) =>
                    setChecks({ ...checks, selfieMatches: checked })
                  }
                />

                <CheckItem
                  label="All documents are readable and not blurry."
                  checked={checks.readable}
                  onChange={(checked) => setChecks({ ...checks, readable: checked })}
                />

                <label className="notesLabel">
                  Admin Review Notes
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Write approval note or rejection reason..."
                  />
                </label>

                {normalize(selected.status || "PENDING") === "PENDING" ? (
                  <div className="actions">
                    <button
                      className="approveBtn"
                      onClick={() => reviewKYC(selected, "APPROVED")}
                      disabled={workingId === selected.id || !allChecksPassed}
                    >
                      {workingId === selected.id ? "Working..." : "Approve KYC"}
                    </button>

                    <button
                      className="rejectBtn"
                      onClick={() => reviewKYC(selected, "REJECTED")}
                      disabled={workingId === selected.id}
                    >
                      {workingId === selected.id ? "Working..." : "Reject KYC"}
                    </button>
                  </div>
                ) : (
                  <div className="empty small">
                    This record is already reviewed and stored in history.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          padding: 30px;
          color: #f8f1d8;
          font-family: Arial, Helvetica, sans-serif;
          background:
            radial-gradient(circle at 15% 5%, rgba(214,178,94,.2), transparent 28%),
            radial-gradient(circle at 90% 10%, rgba(65,120,82,.18), transparent 30%),
            linear-gradient(180deg, #07140f 0%, #0d2118 48%, #07120d 100%);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 20px;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #d6b25e;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .14em;
        }

        h1 {
          margin: 0;
          color: #fff8dc;
          font-size: 44px;
          letter-spacing: -1.5px;
        }

        h2, h3 { color: #fff8dc; margin: 0; }

        .hero span,
        .panelHead span,
        .drawerHead span {
          display: block;
          margin-top: 8px;
          color: rgba(248,241,216,.68);
          line-height: 1.5;
        }

        button {
          border: 0;
          border-radius: 999px;
          padding: 12px 18px;
          background: linear-gradient(135deg, #d6b25e, #8c6a3c);
          color: #07140f;
          font-weight: 950;
          cursor: pointer;
        }

        button:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        input, textarea {
          width: 100%;
          border: 1px solid rgba(214,178,94,.22);
          border-radius: 16px;
          padding: 13px 14px;
          background: rgba(0,0,0,.25);
          color: #fff8dc;
          outline: none;
        }

        textarea {
          min-height: 120px;
          resize: vertical;
          font-family: inherit;
        }

        .message,
        .panel,
        .toolbar,
        .queueCard,
        .drawer,
        .empty,
        .statsCard,
        .detailsPanel,
        .evidencePanel,
        .checkPanel {
          border: 1px solid rgba(214,178,94,.18);
          background: rgba(255,255,255,.07);
          backdrop-filter: blur(18px);
          box-shadow: 0 24px 60px rgba(0,0,0,.26);
        }

        .message,
        .empty {
          padding: 18px;
          border-radius: 22px;
          margin-bottom: 18px;
          font-weight: 900;
        }

        .small {
          margin: 0;
          background: rgba(0,0,0,.22);
          box-shadow: none;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 18px;
        }

        .statsCard {
          border-radius: 24px;
          padding: 20px;
        }

        .statsCard p {
          margin: 0;
          color: rgba(248,241,216,.62);
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .statsCard h3 {
          margin-top: 10px;
          font-size: 30px;
          color: #d6b25e;
        }

        .toolbar {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
          border-radius: 24px;
          padding: 16px;
          margin-bottom: 18px;
        }

        .tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .tabs button {
          background: rgba(255,255,255,.08);
          color: #f8f1d8;
        }

        .tabs .activeTab {
          background: linear-gradient(135deg, #d6b25e, #8c6a3c);
          color: #07140f;
        }

        .toolbar input {
          max-width: 420px;
        }

        .panel {
          border-radius: 28px;
          padding: 22px;
        }

        .panelHead {
          display: flex;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .queue {
          display: grid;
          gap: 14px;
        }

        .queueCard {
          display: grid;
          grid-template-columns: 1.5fr .8fr .8fr .5fr auto auto;
          gap: 14px;
          align-items: center;
          border-radius: 22px;
          padding: 16px;
        }

        .customerBlock {
          display: grid;
          gap: 5px;
        }

        .customerBlock strong {
          color: #fff8dc;
          font-size: 17px;
        }

        .customerBlock span,
        .customerBlock small {
          color: rgba(248,241,216,.62);
        }

        .metaBlock p {
          margin: 0 0 5px;
          color: rgba(248,241,216,.5);
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .metaBlock strong {
          color: #fff8dc;
        }

        .badge {
          border-radius: 999px;
          border: 1px solid;
          padding: 8px 11px;
          font-size: 11px;
          font-weight: 950;
          text-align: center;
        }

        .pending {
          border-color: rgba(214,178,94,.35);
          background: rgba(214,178,94,.15);
          color: #f7d774;
        }

        .approved {
          border-color: rgba(90,220,140,.35);
          background: rgba(90,220,140,.15);
          color: #b7f7c8;
        }

        .rejected {
          border-color: rgba(255,105,105,.35);
          background: rgba(255,105,105,.15);
          color: #ffb6b6;
        }

        .openBtn {
          white-space: nowrap;
        }

        .drawerBackdrop {
          position: fixed;
          inset: 0;
          z-index: 50;
          padding: 24px;
          background: rgba(0,0,0,.72);
          overflow: auto;
        }

        .drawer {
          max-width: 1320px;
          margin: 0 auto;
          border-radius: 30px;
          padding: 24px;
        }

        .drawerHead {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 20px;
        }

        .reviewGrid {
          display: grid;
          grid-template-columns: .85fr 1.2fr .95fr;
          gap: 18px;
          align-items: start;
        }

        .detailsPanel,
        .evidencePanel,
        .checkPanel {
          border-radius: 24px;
          padding: 18px;
        }

        .detailsPanel,
        .checkPanel {
          display: grid;
          gap: 12px;
        }

        .info {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 12px;
          border-radius: 16px;
          background: rgba(0,0,0,.22);
          border: 1px solid rgba(214,178,94,.12);
        }

        .info p {
          margin: 0;
          color: rgba(248,241,216,.55);
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .info strong {
          color: #fff8dc;
          text-align: right;
          word-break: break-word;
        }

        .idCompare {
          padding: 16px;
          border-radius: 18px;
          background: rgba(214,178,94,.12);
          border: 1px solid rgba(214,178,94,.22);
        }

        .idCompare p {
          margin: 0 0 8px;
          color: rgba(248,241,216,.68);
          font-weight: 900;
        }

        .idCompare strong {
          color: #d6b25e;
          font-size: 24px;
          word-break: break-word;
        }

        .docButtons {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin: 14px 0;
        }

        .missingDoc {
          border-radius: 999px;
          padding: 12px;
          background: rgba(255,255,255,.06);
          color: rgba(248,241,216,.4);
          text-align: center;
          font-weight: 900;
        }

        .previewBox {
          min-height: 520px;
          border-radius: 22px;
          background: rgba(0,0,0,.28);
          border: 1px solid rgba(214,178,94,.12);
          display: grid;
          place-items: center;
          overflow: hidden;
        }

        .previewBox img {
          width: 100%;
          height: 100%;
          max-height: 720px;
          object-fit: contain;
        }

        .checkItem {
          display: flex;
          gap: 12px;
          align-items: start;
          padding: 12px;
          border-radius: 16px;
          background: rgba(0,0,0,.22);
          border: 1px solid rgba(214,178,94,.12);
          color: rgba(248,241,216,.82);
          font-weight: 800;
          line-height: 1.4;
        }

        .checkItem input {
          width: auto;
          margin-top: 3px;
        }

        .notesLabel {
          display: grid;
          gap: 8px;
          color: rgba(248,241,216,.7);
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .approveBtn {
          background: linear-gradient(135deg, #2ecc71, #168a48);
          color: white;
        }

        .rejectBtn {
          background: linear-gradient(135deg, #ff6b6b, #a83232);
          color: white;
        }

        @media (max-width: 1100px) {
          .queueCard {
            grid-template-columns: 1fr;
          }

          .reviewGrid {
            grid-template-columns: 1fr;
          }

          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .toolbar {
            display: grid;
          }

          .toolbar input {
            max-width: none;
          }
        }

        @media (max-width: 700px) {
          .page {
            padding: 18px;
          }

          .hero,
          .drawerHead {
            display: grid;
          }

          .stats {
            grid-template-columns: 1fr;
          }

          .docButtons,
          .actions {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 34px;
          }
        }
      `}</style>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="statsCard">
      <p>{label}</p>
      <h3>{value}</h3>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function DocButton({
  label,
  url,
  onOpen,
}: {
  label: string;
  url: string | null | undefined;
  onOpen: (url: string) => void;
}) {
  if (!url) return <div className="missingDoc">{label}: Missing</div>;

  return <button onClick={() => onOpen(url)}>{label}</button>;
}

function CheckItem({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="checkItem">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}