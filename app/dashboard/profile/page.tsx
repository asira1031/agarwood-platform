"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  membership_status: string | null;
  kyc_status: string | null;
};

type KycRecord = {
  id: string;
  profile_id: string;
  id_type: string | null;
  id_number: string | null;
  id_front_url: string | null;
  id_back_url: string | null;
  selfie_url: string | null;
  proof_of_address_url: string | null;
  source_of_funds: string | null;
  investment_experience: string | null;
  risk_acknowledged: boolean | null;
  status: string | null;
  review_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [kycRecords, setKycRecords] = useState<KycRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [submittingKyc, setSubmittingKyc] = useState(false);
  const [message, setMessage] = useState("");

  const [profileForm, setProfileForm] = useState({
    full_name: "",
    phone: "",
  });

  const [kycForm, setKycForm] = useState({
    id_type: "",
    id_number: "",
    source_of_funds: "",
    investment_experience: "",
    risk_acknowledged: false,
  });

  const [files, setFiles] = useState({
    id_front: null as File | null,
    id_back: null as File | null,
    selfie: null as File | null,
    proof: null as File | null,
  });

  async function loadProfile() {
    setLoading(true);
    setMessage("");

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
      .select("id, full_name, email, phone, membership_status, kyc_status")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, membership_status, kyc_status")
      .eq("email", email)
      .maybeSingle();

    const currentProfile = profileById || profileByEmail;

    if (!currentProfile) {
      setLoading(false);
      setMessage("Profile not found. Please login again.");
      return;
    }

    setProfile(currentProfile);
    setProfileForm({
      full_name: currentProfile.full_name || "",
      phone: currentProfile.phone || "",
    });

    const { data: kycData } = await supabase
      .from("kyc_records")
      .select(
        "id, profile_id, id_type, id_number, id_front_url, id_back_url, selfie_url, proof_of_address_url, source_of_funds, investment_experience, risk_acknowledged, status, review_notes, submitted_at, reviewed_at"
      )
      .eq("profile_id", currentProfile.id)
      .order("submitted_at", { ascending: false });

    setKycRecords(kycData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadProfile();
  }, []);

  const latestKyc = useMemo(() => {
    return kycRecords.length > 0 ? kycRecords[0] : null;
  }, [kycRecords]);

  const kycStatus = profile?.kyc_status || latestKyc?.status || "NOT_SUBMITTED";
  const membershipStatus = profile?.membership_status || "UNKNOWN";
  const isVerified = kycStatus === "APPROVED";
  const isPending = kycStatus === "PENDING";
  const isRejected = kycStatus === "REJECTED";
  const canSubmitKyc = !isVerified && !isPending;

  async function saveProfile() {
    setMessage("");

    if (!profile) {
      setMessage("Profile not found.");
      return;
    }

    if (!profileForm.full_name.trim()) {
      setMessage("Full name is required.");
      return;
    }

    setSavingProfile(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profileForm.full_name.trim(),
        phone: profileForm.phone.trim() || null,
      })
      .eq("id", profile.id);

    if (error) {
      setMessage(error.message);
      setSavingProfile(false);
      return;
    }

    setMessage("Profile updated successfully.");
    setSavingProfile(false);
    await loadProfile();
  }

  async function uploadFile(file: File | null, folder: string, profileId: string) {
    if (!file) return null;

    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `${profileId}/${folder}/${Date.now()}-${cleanName}`;

    const { error } = await supabase.storage
      .from("kyc-documents")
      .upload(filePath, file, { upsert: true });

    if (error) throw error;

    const { data } = supabase.storage.from("kyc-documents").getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function submitKyc() {
    setMessage("");

    if (!profile) {
      setMessage("Profile not found.");
      return;
    }

    if (!canSubmitKyc) {
      setMessage("KYC cannot be submitted while it is pending or already approved.");
      return;
    }

    if (!kycForm.id_type || !kycForm.id_number.trim()) {
      setMessage("Please complete ID type and ID number.");
      return;
    }

    if (!kycForm.source_of_funds || !kycForm.investment_experience) {
      setMessage("Please complete source of funds and investment experience.");
      return;
    }

    if (!files.id_front || !files.id_back || !files.selfie || !files.proof) {
      setMessage("Please upload all required KYC documents.");
      return;
    }

    if (!kycForm.risk_acknowledged) {
      setMessage("Please acknowledge the agarwood investment risk.");
      return;
    }

    try {
      setSubmittingKyc(true);

      const idFrontUrl = await uploadFile(files.id_front, "id-front", profile.id);
      const idBackUrl = await uploadFile(files.id_back, "id-back", profile.id);
      const selfieUrl = await uploadFile(files.selfie, "selfie", profile.id);
      const proofUrl = await uploadFile(files.proof, "proof-address", profile.id);

      const { error: insertError } = await supabase.from("kyc_records").insert({
        profile_id: profile.id,
        id_type: kycForm.id_type,
        id_number: kycForm.id_number.trim(),
        id_front_url: idFrontUrl,
        id_back_url: idBackUrl,
        selfie_url: selfieUrl,
        proof_of_address_url: proofUrl,
        source_of_funds: kycForm.source_of_funds,
        investment_experience: kycForm.investment_experience,
        risk_acknowledged: kycForm.risk_acknowledged,
        status: "PENDING",
        submitted_at: new Date().toISOString(),
      });

      if (insertError) throw insertError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ kyc_status: "PENDING" })
        .eq("id", profile.id);

      if (profileError) throw profileError;

      setKycForm({
        id_type: "",
        id_number: "",
        source_of_funds: "",
        investment_experience: "",
        risk_acknowledged: false,
      });

      setFiles({
        id_front: null,
        id_back: null,
        selfie: null,
        proof: null,
      });

      setMessage("KYC submitted successfully. Status: PENDING admin review.");
      await loadProfile();
    } catch (error: any) {
      setMessage(error.message || "KYC submission failed.");
    } finally {
      setSubmittingKyc(false);
    }
  }

  return (
    <main className="profilePage">
      <section className="hero">
        <div>
          <p className="eyebrow">Agarwood Trust Profile</p>
          <h1>Profile & KYC</h1>
          <span>
            Manage your customer profile and submit identity documents for admin
            review. Verified KYC unlocks withdrawal and sell tree requests.
          </span>
        </div>

        <div className={`heroBadge ${statusClass(kycStatus)}`}>
          <p>KYC Status</p>
          <strong>{statusLabel(kycStatus)}</strong>
          <small>{isVerified ? "Verified customer" : "Admin review required"}</small>
        </div>
      </section>

      {loading ? (
        <div className="loadingBox">Loading profile...</div>
      ) : (
        <>
          {message && <div className="messageBox">{message}</div>}

          <section className="cards">
            <SummaryCard icon="👤" label="Customer" value={profile?.full_name || "Unnamed"} note={profile?.email || "No email"} />
            <SummaryCard icon="🎖️" label="Membership" value={membershipStatus} note="Required for system access" gold />
            <SummaryCard icon="🛡️" label="Verification" value={statusLabel(kycStatus)} note="Required for payouts" />
            <SummaryCard icon="📄" label="KYC Records" value={String(kycRecords.length)} note="Real records from kyc_records" gold />
          </section>

          <section className="grid">
            <div className="panel">
              <div className="panelHead">
                <div>
                  <h2>Profile Details</h2>
                  <p>Basic customer information from profiles table.</p>
                </div>
              </div>

              <div className="formGrid">
                <label>
                  Full Name
                  <input
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    placeholder="Full name"
                  />
                </label>

                <label>
                  Phone
                  <input
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </label>

                <label>
                  Email
                  <input value={profile?.email || ""} disabled />
                </label>

                <label>
                  Profile ID
                  <input value={profile?.id || ""} disabled />
                </label>
              </div>

              <button className="primaryButton" onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? "Saving..." : "Save Profile"}
              </button>
            </div>

            <aside className="panel trustPanel">
              <p className="eyebrow">Trust Status</p>
              <h2>{trustTitle(kycStatus)}</h2>
              <p>{trustDescription(kycStatus)}</p>

              <div className="trustList">
                <StatusLine label="Membership" value={membershipStatus} ok={membershipStatus === "ACTIVE"} />
                <StatusLine label="KYC" value={statusLabel(kycStatus)} ok={isVerified} />
                <StatusLine label="Withdraw Access" value={isVerified ? "UNLOCKED" : "LOCKED"} ok={isVerified} />
                <StatusLine label="Sell Tree Access" value={isVerified ? "UNLOCKED" : "LOCKED"} ok={isVerified} />
              </div>
            </aside>
          </section>

          <section className="grid kycGrid">
            <div className="panel">
              <div className="panelHead">
                <div>
                  <h2>KYC Verification Form</h2>
                  <p>Upload documents like GCash-style admin verification.</p>
                </div>
                <span className={`statusPill ${statusClass(kycStatus)}`}>
                  {statusLabel(kycStatus)}
                </span>
              </div>

              {!canSubmitKyc ? (
                <div className="lockedBox">
                  <strong>{isVerified ? "KYC already approved." : "KYC is pending review."}</strong>
                  <p>
                    {isVerified
                      ? "Your profile is verified. Withdraw and sell tree requests are unlocked."
                      : "Please wait for admin review. You can submit again only if your KYC is rejected."}
                  </p>
                </div>
              ) : (
                <>
                  {isRejected && (
                    <div className="rejectedBox">
                      <strong>Previous KYC was rejected.</strong>
                      <p>{latestKyc?.review_notes || "Please review your documents and submit again."}</p>
                    </div>
                  )}

                  <div className="formGrid">
                    <label>
                      ID Type
                      <select
                        value={kycForm.id_type}
                        onChange={(e) => setKycForm({ ...kycForm, id_type: e.target.value })}
                      >
                        <option value="">Select ID Type</option>
                        <option value="Passport">Passport</option>
                        <option value="National ID">National ID</option>
                        <option value="Driver License">Driver License</option>
                        <option value="UMID">UMID</option>
                        <option value="PRC">PRC</option>
                      </select>
                    </label>

                    <label>
                      ID Number
                      <input
                        value={kycForm.id_number}
                        onChange={(e) => setKycForm({ ...kycForm, id_number: e.target.value })}
                        placeholder="Enter ID number"
                      />
                    </label>

                    <label>
                      Source of Funds
                      <select
                        value={kycForm.source_of_funds}
                        onChange={(e) => setKycForm({ ...kycForm, source_of_funds: e.target.value })}
                      >
                        <option value="">Select Source of Funds</option>
                        <option value="Employment">Employment</option>
                        <option value="Business">Business</option>
                        <option value="Investments">Investments</option>
                        <option value="Savings">Savings</option>
                        <option value="Inheritance">Inheritance</option>
                        <option value="Other">Other</option>
                      </select>
                    </label>

                    <label>
                      Investment Experience
                      <select
                        value={kycForm.investment_experience}
                        onChange={(e) => setKycForm({ ...kycForm, investment_experience: e.target.value })}
                      >
                        <option value="">Select Experience</option>
                        <option value="Beginner">Beginner</option>
                        <option value="Intermediate">Intermediate</option>
                        <option value="Advanced">Advanced</option>
                        <option value="Professional">Professional</option>
                      </select>
                    </label>
                  </div>

                  <div className="uploadGrid">
                    <UploadBox label="Front of ID" file={files.id_front} onChange={(file) => setFiles({ ...files, id_front: file })} />
                    <UploadBox label="Back of ID" file={files.id_back} onChange={(file) => setFiles({ ...files, id_back: file })} />
                    <UploadBox label="Selfie Holding ID" file={files.selfie} onChange={(file) => setFiles({ ...files, selfie: file })} />
                    <UploadBox label="Proof of Address" file={files.proof} onChange={(file) => setFiles({ ...files, proof: file })} />
                  </div>

                  <label className="riskBox">
                    <input
                      type="checkbox"
                      checked={kycForm.risk_acknowledged}
                      onChange={(e) => setKycForm({ ...kycForm, risk_acknowledged: e.target.checked })}
                    />
                    <span>
                      I understand that agarwood ownership involves long-term agricultural,
                      market, and document-based verification risk.
                    </span>
                  </label>

                  <button className="primaryButton" onClick={submitKyc} disabled={submittingKyc}>
                    {submittingKyc ? "Submitting KYC..." : "Submit KYC for Admin Review"}
                  </button>
                </>
              )}
            </div>

            <aside className="panel">
              <div className="panelHead">
                <div>
                  <h2>Latest KYC Record</h2>
                  <p>Real latest record from kyc_records.</p>
                </div>
              </div>

              {!latestKyc ? (
                <div className="emptyState">No KYC record submitted yet.</div>
              ) : (
                <div className="kycRecord">
                  <Info label="Status" value={latestKyc.status || "PENDING"} />
                  <Info label="ID Type" value={latestKyc.id_type || "—"} />
                  <Info label="ID Number" value={latestKyc.id_number || "—"} />
                  <Info label="Submitted" value={formatDate(latestKyc.submitted_at)} />
                  <Info label="Reviewed" value={formatDate(latestKyc.reviewed_at)} />
                  <Info label="Review Notes" value={latestKyc.review_notes || "—"} />

                  <div className="docLinks">
                    <DocumentLink title="Front ID" url={latestKyc.id_front_url} />
                    <DocumentLink title="Back ID" url={latestKyc.id_back_url} />
                    <DocumentLink title="Selfie" url={latestKyc.selfie_url} />
                    <DocumentLink title="Proof" url={latestKyc.proof_of_address_url} />
                  </div>
                </div>
              )}
            </aside>
          </section>
        </>
      )}

      <style>{`
        * { box-sizing: border-box; }

        .profilePage {
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

        .heroBadge {
          min-width: 290px;
          border-radius: 24px;
          padding: 22px;
          color: white;
          box-shadow: 0 18px 42px rgba(36,69,54,.22);
        }

        .heroBadge.approved {
          background:
            radial-gradient(circle at 80% 18%, rgba(214,178,94,.44), transparent 30%),
            linear-gradient(135deg, #244536, #10281f);
        }

        .heroBadge.pending,
        .heroBadge.not_submitted {
          background:
            radial-gradient(circle at 80% 18%, rgba(255,226,154,.45), transparent 30%),
            linear-gradient(135deg, #8c6a3c, #4d351b);
        }

        .heroBadge.rejected {
          background:
            radial-gradient(circle at 80% 18%, rgba(255,180,150,.35), transparent 30%),
            linear-gradient(135deg, #7a2d22, #38120d);
        }

        .heroBadge p {
          margin: 0;
          color: rgba(255,255,255,.75);
          font-weight: 900;
        }

        .heroBadge strong {
          display: block;
          margin-top: 8px;
          font-size: 30px;
          letter-spacing: -1px;
        }

        .heroBadge small {
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
          font-size: 23px;
          letter-spacing: -1px;
          color: #101a14;
          word-break: break-word;
        }

        .summaryCard small {
          color: #8c6a3c;
          font-weight: 900;
          word-break: break-word;
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
          grid-template-columns: 1.35fr 420px;
          gap: 16px;
          margin-bottom: 16px;
        }

        .kycGrid {
          align-items: start;
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

        .panelHead h2,
        .trustPanel h2 {
          margin: 0;
          color: #101a14;
          font-size: 24px;
        }

        .panelHead p,
        .trustPanel p {
          margin: 6px 0 0;
          color: #6b6b62;
          font-size: 14px;
          line-height: 1.6;
        }

        .formGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        label {
          display: grid;
          gap: 8px;
          color: #5f665e;
          font-weight: 900;
          font-size: 13px;
        }

        input,
        select {
          width: 100%;
          border: 1px solid rgba(92,70,35,.14);
          border-radius: 14px;
          padding: 13px 14px;
          background: rgba(255,253,246,.92);
          color: #101a14;
          outline: none;
          font-weight: 800;
        }

        input:disabled {
          opacity: .65;
          cursor: not-allowed;
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

        .trustPanel {
          background:
            radial-gradient(circle at 90% 8%, rgba(214,178,94,.22), transparent 30%),
            linear-gradient(135deg, rgba(255,253,246,.92), rgba(243,234,216,.92));
        }

        .trustList {
          margin-top: 18px;
          display: grid;
          gap: 12px;
        }

        .statusLine {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,253,246,.72);
          border: 1px solid rgba(92,70,35,.10);
        }

        .statusLine span {
          color: #6b6b62;
          font-weight: 900;
          font-size: 13px;
        }

        .statusLine b {
          color: #101a14;
          text-align: right;
          font-size: 13px;
        }

        .statusLine.ok b {
          color: #31553d;
        }

        .statusLine.locked b {
          color: #8c6a3c;
        }

        .statusPill {
          border-radius: 999px;
          padding: 10px 14px;
          color: white;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .statusPill.approved { background: #31553d; }
        .statusPill.pending,
        .statusPill.not_submitted { background: #8c6a3c; }
        .statusPill.rejected { background: #a33c2a; }

        .lockedBox,
        .rejectedBox,
        .emptyState {
          padding: 18px;
          border-radius: 18px;
          background: #f3ead8;
          color: #6b6b62;
          font-weight: 900;
        }

        .lockedBox strong,
        .rejectedBox strong {
          display: block;
          color: #101a14;
          margin-bottom: 8px;
        }

        .lockedBox p,
        .rejectedBox p {
          margin: 0;
          line-height: 1.6;
        }

        .rejectedBox {
          margin-bottom: 16px;
          background: rgba(163,60,42,.10);
          color: #7a2d22;
        }

        .uploadGrid {
          margin-top: 18px;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        .uploadBox {
          cursor: pointer;
          border-radius: 22px;
          border: 2px dashed rgba(140,106,60,.28);
          background: #f3ead8;
          padding: 18px;
          transition: .2s ease;
        }

        .uploadBox:hover {
          border-color: #8c6a3c;
        }

        .uploadBox strong {
          display: block;
          color: #101a14;
        }

        .uploadBox span {
          display: block;
          margin-top: 6px;
          color: #6b6b62;
          font-size: 13px;
          font-weight: 800;
        }

        .uploadBox input {
          margin-top: 12px;
          background: rgba(255,253,246,.78);
        }

        .riskBox {
          margin-top: 18px;
          display: grid;
          grid-template-columns: 22px 1fr;
          gap: 12px;
          border-radius: 18px;
          background: rgba(214,178,94,.16);
          border: 1px solid rgba(140,106,60,.14);
          padding: 16px;
          color: #6b6b62;
          line-height: 1.6;
        }

        .riskBox input {
          width: 18px;
          margin-top: 3px;
        }

        .kycRecord {
          display: grid;
          gap: 12px;
        }

        .infoBox {
          border-radius: 16px;
          padding: 14px;
          background: #f3ead8;
          border: 1px solid rgba(92,70,35,.08);
        }

        .infoBox p {
          margin: 0;
          color: #6b6b62;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .infoBox strong {
          display: block;
          margin-top: 6px;
          color: #101a14;
          word-break: break-word;
        }

        .docLinks {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-top: 6px;
        }

        .docLink {
          display: inline-flex;
          justify-content: center;
          border-radius: 999px;
          padding: 12px 14px;
          background: #244536;
          color: white;
          text-decoration: none;
          font-size: 12px;
          font-weight: 900;
        }

        .docLink.disabled {
          background: #d9ccb0;
          color: #6b6b62;
          pointer-events: none;
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
          .profilePage {
            padding: 18px;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
          }

          .heroBadge {
            width: 100%;
          }

          .cards,
          .formGrid,
          .uploadGrid,
          .docLinks {
            grid-template-columns: 1fr;
          }

          .hero h1 {
            font-size: 34px;
          }

          .panelHead {
            flex-direction: column;
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

function StatusLine({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className={`statusLine ${ok ? "ok" : "locked"}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function UploadBox({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="uploadBox">
      <strong>{label}</strong>
      <span>{file ? file.name : "Upload image or PDF"}</span>
      <input
        type="file"
        accept="image/*,.pdf"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="infoBox">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function DocumentLink({ title, url }: { title: string; url: string | null }) {
  if (!url) {
    return <span className="docLink disabled">{title}: Missing</span>;
  }

  return (
    <a className="docLink" href={url} target="_blank" rel="noopener noreferrer">
      Open {title}
    </a>
  );
}

function statusClass(status: string | null) {
  return (status || "NOT_SUBMITTED").toLowerCase();
}

function statusLabel(status: string | null) {
  const value = status || "NOT_SUBMITTED";

  if (value === "APPROVED") return "VERIFIED";
  if (value === "PENDING") return "PENDING REVIEW";
  if (value === "REJECTED") return "REJECTED";
  return "NOT SUBMITTED";
}

function trustTitle(status: string | null) {
  if (status === "APPROVED") return "Verified Profile";
  if (status === "PENDING") return "Pending Admin Review";
  if (status === "REJECTED") return "KYC Needs Resubmission";
  return "Verification Required";
}

function trustDescription(status: string | null) {
  if (status === "APPROVED") {
    return "Your profile is verified. Withdrawals and sell tree requests are unlocked.";
  }

  if (status === "PENDING") {
    return "Your KYC has been submitted and is waiting for admin review.";
  }

  if (status === "REJECTED") {
    return "Your previous KYC was rejected. Please submit corrected documents.";
  }

  return "Submit your identity documents to unlock financial and tree sale features.";
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}