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

type KycRecord = Record<string, any>;

const ID_TYPES = [
  "Government ID",
  "Passport",
  "Driver License",
  "National ID",
  "Other",
];

function normalize(value: any) {
  return String(value || "").trim().toUpperCase();
}

function statusLabel(value: string | null | undefined) {
  const status = normalize(value);
  if (status === "APPROVED") return "APPROVED";
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "PENDING") return "PENDING";
  if (status === "REJECTED") return "REJECTED";
  if (status === "INACTIVE") return "INACTIVE";
  return "NOT SUBMITTED";
}

function statusClass(value: string | null | undefined) {
  const status = normalize(value);
  if (status === "APPROVED" || status === "ACTIVE") return "approved";
  if (status === "PENDING") return "pending";
  if (status === "REJECTED") return "rejected";
  return "notSubmitted";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function maskIdNumber(value: string | null | undefined) {
  if (!value) return "—";
  const clean = String(value).trim();
  if (clean.length <= 4) return "****";
  return `${"*".repeat(Math.max(clean.length - 4, 4))}${clean.slice(-4)}`;
}

function getSubmittedValue(record: KycRecord | null | undefined) {
  if (!record) return null;
  return record.submitted_at || record.reviewed_at || null;
}

function getAdminNotes(record: KycRecord | null | undefined) {
  if (!record) return "—";
  return record.review_notes || "—";
}

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
    notes: "",
    risk_acknowledged: false,
  });

  const [files, setFiles] = useState({
    id_document: null as File | null,
    id_front: null as File | null,
    id_back: null as File | null,
    selfie: null as File | null,
    proof: null as File | null,
  });

  async function findProfile(userId: string, email: string) {
    const cleanEmail = String(email || "").trim();
    const lowerEmail = cleanEmail.toLowerCase();

    const { data: profileById, error: byIdError } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, membership_status, kyc_status")
      .eq("id", userId)
      .maybeSingle();

    if (byIdError) throw byIdError;
    if (profileById) return profileById as Profile;

    if (!cleanEmail) return null;

    const { data: profileByEmail, error: byEmailError } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, membership_status, kyc_status")
      .eq("email", lowerEmail)
      .maybeSingle();

    if (byEmailError) throw byEmailError;
    if (profileByEmail) return profileByEmail as Profile;

    const { data: profileByEmailFallback, error: fallbackError } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, membership_status, kyc_status")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (fallbackError) throw fallbackError;

    return profileByEmailFallback as Profile | null;
  }

  async function resolveCurrentProfile() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) throw error;
    if (!user) throw new Error("No authenticated user found.");

    const currentProfile = await findProfile(user.id, user.email || "");

    if (!currentProfile) {
      throw new Error("Profile not found for current user.");
    }

    return currentProfile;
  }

  async function loadKycRecords(profileId: string) {
    const { data, error } = await supabase
      .from("kyc_records")
      .select("*")
      .eq("profile_id", profileId)
      .order("submitted_at", { ascending: false });

    if (error) {
      setKycRecords([]);
      return;
    }

    setKycRecords((data || []) as KycRecord[]);
  }

  async function loadProfile() {
    setLoading(true);
    setMessage("");

    try {
      const currentProfile = await resolveCurrentProfile();

      setProfile(currentProfile);
      setProfileForm({
        full_name: currentProfile.full_name || "",
        phone: currentProfile.phone || "",
      });

      await loadKycRecords(currentProfile.id);
    } catch (error: any) {
      if (String(error?.message || "").toLowerCase().includes("authenticated")) {
        window.location.href = "/login";
        return;
      }

      setMessage(error?.message || "Profile failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  const latestKyc = useMemo(() => {
    return kycRecords.length > 0 ? kycRecords[0] : null;
  }, [kycRecords]);

  const kycStatus = latestKyc?.status || profile?.kyc_status || "NOT_SUBMITTED";
  const membershipStatus = profile?.membership_status || "INACTIVE";

  const normalizedKyc = normalize(kycStatus);
  const isVerified = normalizedKyc === "APPROVED";
  const isPending = normalizedKyc === "PENDING";
  const isRejected = normalizedKyc === "REJECTED";
  const canSubmitKyc = !isVerified && !isPending;

  async function saveProfile() {
    setMessage("");

    if (!profile) return setMessage("Profile not found.");
    if (!profileForm.full_name.trim()) return setMessage("Full name is required.");

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

    setMessage("Forest identity updated successfully.");
    setSavingProfile(false);
    await loadProfile();
  }

  async function submitKyc() {
    setMessage("");

    if (!canSubmitKyc) {
      setMessage("KYC cannot be submitted while pending or already approved.");
      return;
    }

    if (!kycForm.id_type) return setMessage("Please select ID type.");
    if (!kycForm.id_number.trim()) return setMessage("Please enter ID number.");

    try {
      setSubmittingKyc(true);

      const currentProfile = await resolveCurrentProfile();
      const now = new Date().toISOString();

      // TEMP UAT:
      // Supabase Storage upload is currently blocked by storage.objects ownership/policy.
      // Submit KYC record first with null document URLs so Admin queue can be tested.
      const { error: insertError } = await supabase.from("kyc_records").insert({
        profile_id: currentProfile.id,
        id_type: kycForm.id_type,
        id_number: kycForm.id_number.trim(),
        id_front_url: null,
        id_back_url: null,
        selfie_url: null,
        proof_of_address_url: null,
        source_of_funds: kycForm.source_of_funds || null,
        investment_experience: kycForm.investment_experience || null,
        risk_acknowledged: kycForm.risk_acknowledged || false,
        status: "PENDING",
        review_notes: kycForm.notes.trim() || null,
        submitted_at: now,
        reviewed_at: null,
      });

      if (insertError) throw insertError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          kyc_status: "PENDING",
        })
        .eq("id", currentProfile.id);

      if (profileError) throw profileError;

      setKycForm({
        id_type: "",
        id_number: "",
        source_of_funds: "",
        investment_experience: "",
        notes: "",
        risk_acknowledged: false,
      });

      setFiles({
        id_document: null,
        id_front: null,
        id_back: null,
        selfie: null,
        proof: null,
      });

      setMessage(
        "KYC submitted for admin review. TEMP UAT: photo upload is disabled until Storage policy is fixed."
      );

      await loadProfile();
    } catch (error: any) {
      setMessage(error?.message || "KYC submission failed.");
    } finally {
      setSubmittingKyc(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Customer Account</p>
          <h1>Forest Identity Center</h1>
          <span>
            Manage your customer identity, membership standing, and KYC
            verification for Arganwood services.
          </span>
        </div>

        <div className={`identityCard ${statusClass(kycStatus)}`}>
          <p>Forest Member ID</p>
          <strong>{profile?.full_name || "Customer"}</strong>
          <small>{profile?.email || "No email"}</small>
        </div>
      </section>

      {loading ? (
        <div className="empty">Loading Forest Identity...</div>
      ) : (
        <>
          {message && <div className="message">{message}</div>}

          <section className="stats">
            <SummaryCard label="Name" value={profile?.full_name || "Unnamed"} />
            <SummaryCard label="Email" value={profile?.email || "No email"} />
            <SummaryCard label="Membership" value={statusLabel(membershipStatus)} />
            <SummaryCard label="KYC" value={statusLabel(kycStatus)} />
          </section>

          <section className="grid">
            <div className="panel">
              <div className="panelHead">
                <div>
                  <p className="eyebrow">Profile</p>
                  <h2>Identity Details</h2>
                  <span>Friendly customer information from the profiles table.</span>
                </div>
              </div>

              <div className="formGrid">
                <label>
                  Full Name
                  <input
                    value={profileForm.full_name}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, full_name: e.target.value })
                    }
                    placeholder="Full name"
                  />
                </label>

                <label>
                  Phone
                  <input
                    value={profileForm.phone}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, phone: e.target.value })
                    }
                    placeholder="Phone number"
                  />
                </label>

                <label>
                  Email
                  <input value={profile?.email || ""} disabled />
                </label>
              </div>

              <button onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? "Saving..." : "Save Forest Identity"}
              </button>
            </div>

            <aside className="panel">
              <div className="panelHead">
                <div>
                  <p className="eyebrow">Trust Status</p>
                  <h2>{isVerified ? "Verified Customer" : "Verification Needed"}</h2>
                  <span>KYC approval unlocks withdrawal and sell tree access.</span>
                </div>
              </div>

              <div className="trustList">
                <Info label="Membership" value={statusLabel(membershipStatus)} />
                <Info label="KYC Status" value={statusLabel(kycStatus)} />
                <Info label="Withdraw Access" value={isVerified ? "UNLOCKED" : "LOCKED"} />
                <Info label="Sell Tree Access" value={isVerified ? "UNLOCKED" : "LOCKED"} />
              </div>
            </aside>
          </section>

          <section className="grid kycGrid">
            <div className="panel">
              <div className="panelHead">
                <div>
                  <p className="eyebrow">Verification</p>
                  <h2>KYC Documents</h2>
                  <span>
                    Upload identity documents for admin verification. TEMP UAT:
                    files are displayed here but upload is temporarily bypassed.
                  </span>
                </div>
                <b className={`pill ${statusClass(kycStatus)}`}>
                  {statusLabel(kycStatus)}
                </b>
              </div>

              {!canSubmitKyc ? (
                <div className="lockedBox">
                  <strong>
                    {isVerified ? "KYC already approved." : "KYC is pending review."}
                  </strong>
                  <p>
                    {isVerified
                      ? "Your account is verified. You may use payout and sell tree features."
                      : "Please wait for admin review. You can submit again only if rejected."}
                  </p>
                </div>
              ) : (
                <>
                  {isRejected && (
                    <div className="rejectedBox">
                      <strong>Previous KYC was rejected.</strong>
                      <p>
                        {getAdminNotes(latestKyc) ||
                          "Please review your documents and submit again."}
                      </p>
                    </div>
                  )}

                  <div className="formGrid">
                    <label>
                      ID Type
                      <select
                        value={kycForm.id_type}
                        onChange={(e) =>
                          setKycForm({ ...kycForm, id_type: e.target.value })
                        }
                      >
                        <option value="">Select ID Type</option>
                        {ID_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      ID Number
                      <input
                        value={kycForm.id_number}
                        onChange={(e) =>
                          setKycForm({ ...kycForm, id_number: e.target.value })
                        }
                        placeholder="Enter ID number"
                      />
                    </label>

                    <label>
                      Source of Funds Optional
                      <select
                        value={kycForm.source_of_funds}
                        onChange={(e) =>
                          setKycForm({
                            ...kycForm,
                            source_of_funds: e.target.value,
                          })
                        }
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
                      Investment Experience Optional
                      <select
                        value={kycForm.investment_experience}
                        onChange={(e) =>
                          setKycForm({
                            ...kycForm,
                            investment_experience: e.target.value,
                          })
                        }
                      >
                        <option value="">Select Experience</option>
                        <option value="Beginner">Beginner</option>
                        <option value="Intermediate">Intermediate</option>
                        <option value="Advanced">Advanced</option>
                        <option value="Professional">Professional</option>
                      </select>
                    </label>
                  </div>

                  <label className="notesLabel">
                    Notes Optional
                    <textarea
                      value={kycForm.notes}
                      onChange={(e) =>
                        setKycForm({ ...kycForm, notes: e.target.value })
                      }
                      placeholder="Add notes for admin review"
                    />
                  </label>

                  <div className="uploadGrid">
                    <UploadBox
                      label="ID Document / Image Optional During UAT"
                      file={files.id_document}
                      onChange={(file) =>
                        setFiles({ ...files, id_document: file })
                      }
                    />
                    <UploadBox
                      label="Front of ID Optional"
                      file={files.id_front}
                      onChange={(file) => setFiles({ ...files, id_front: file })}
                    />
                    <UploadBox
                      label="Back of ID Optional"
                      file={files.id_back}
                      onChange={(file) => setFiles({ ...files, id_back: file })}
                    />
                    <UploadBox
                      label="Selfie Holding ID Optional"
                      file={files.selfie}
                      onChange={(file) => setFiles({ ...files, selfie: file })}
                    />
                    <UploadBox
                      label="Proof of Address Optional"
                      file={files.proof}
                      onChange={(file) => setFiles({ ...files, proof: file })}
                    />
                  </div>

                  <label className="riskBox">
                    <input
                      type="checkbox"
                      checked={kycForm.risk_acknowledged}
                      onChange={(e) =>
                        setKycForm({
                          ...kycForm,
                          risk_acknowledged: e.target.checked,
                        })
                      }
                    />
                    <span>
                      I understand that agarwood ownership involves long-term
                      agricultural, market, and verification risk.
                    </span>
                  </label>

                  <button onClick={submitKyc} disabled={submittingKyc}>
                    {submittingKyc ? "Submitting..." : "Submit KYC for Review"}
                  </button>
                </>
              )}
            </div>

            <aside className="panel">
              <div className="panelHead">
                <div>
                  <p className="eyebrow">Latest Record</p>
                  <h2>KYC History / Latest Submission</h2>
                  <span>Latest real record from kyc_records.</span>
                </div>
              </div>

              {!latestKyc ? (
                <div className="empty small">No KYC record submitted yet.</div>
              ) : (
                <div className="trustList">
                  <Info label="Status" value={statusLabel(latestKyc.status)} />
                  <Info label="ID Type" value={latestKyc.id_type || "—"} />
                  <Info
                    label="ID Number"
                    value={maskIdNumber(latestKyc.id_number)}
                  />
                  <Info
                    label="Submitted"
                    value={formatDateTime(getSubmittedValue(latestKyc))}
                  />
                  <Info
                    label="Reviewed"
                    value={formatDateTime(latestKyc.reviewed_at)}
                  />
                  <Info
                    label="Admin Notes / Rejection Reason"
                    value={getAdminNotes(latestKyc)}
                  />

                  <div className="docLinks">
                    <DocumentLink title="Front ID" url={latestKyc.id_front_url} />
                    <DocumentLink title="Back ID" url={latestKyc.id_back_url} />
                    <DocumentLink title="Selfie" url={latestKyc.selfie_url} />
                    <DocumentLink
                      title="Proof"
                      url={latestKyc.proof_of_address_url}
                    />
                  </div>
                </div>
              )}
            </aside>
          </section>
        </>
      )}

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          padding: 30px;
          color: #f8f1d8;
          font-family: Arial, Helvetica, sans-serif;
          background:
            radial-gradient(circle at 15% 5%, rgba(214,178,94,.22), transparent 28%),
            radial-gradient(circle at 90% 10%, rgba(65,120,82,.22), transparent 30%),
            linear-gradient(180deg, #07140f 0%, #0d2118 48%, #07120d 100%);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 22px;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #d6b25e;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .14em;
          font-size: 12px;
        }

        h1 {
          margin: 0;
          color: #fff8dc;
          font-size: 46px;
          letter-spacing: -1.6px;
        }

        .hero span,
        .panelHead span {
          display: block;
          margin-top: 8px;
          color: rgba(248,241,216,.68);
          line-height: 1.6;
        }

        .identityCard,
        .summaryCard,
        .panel,
        .message,
        .empty {
          border: 1px solid rgba(214,178,94,.22);
          background: rgba(255,255,255,.07);
          backdrop-filter: blur(18px);
          box-shadow: 0 24px 60px rgba(0,0,0,.28);
        }

        .identityCard {
          min-width: 320px;
          border-radius: 28px;
          padding: 24px;
        }

        .identityCard p,
        .identityCard small {
          margin: 0;
          color: rgba(248,241,216,.68);
          font-weight: 900;
        }

        .identityCard strong {
          display: block;
          margin: 10px 0;
          color: #d6b25e;
          font-size: 28px;
          word-break: break-word;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 18px;
        }

        .summaryCard {
          border-radius: 24px;
          padding: 20px;
        }

        .summaryCard p {
          margin: 0;
          color: rgba(248,241,216,.6);
          font-weight: 900;
          font-size: 12px;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .summaryCard h3 {
          margin: 10px 0 0;
          color: #fff8dc;
          font-size: 23px;
          word-break: break-word;
        }

        .grid {
          display: grid;
          grid-template-columns: 1.25fr .85fr;
          gap: 18px;
          margin-bottom: 18px;
        }

        .kycGrid { align-items: start; }

        .panel {
          border-radius: 28px;
          padding: 22px;
        }

        .panelHead {
          display: flex;
          justify-content: space-between;
          align-items: start;
          gap: 14px;
          margin-bottom: 18px;
        }

        .panelHead h2 {
          margin: 0;
          color: #fff8dc;
          font-size: 26px;
        }

        .formGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
          margin-bottom: 16px;
        }

        label {
          display: grid;
          gap: 8px;
          color: rgba(248,241,216,.64);
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .notesLabel { margin-bottom: 16px; }

        input,
        select,
        textarea {
          width: 100%;
          border: 1px solid rgba(214,178,94,.22);
          border-radius: 16px;
          padding: 13px 14px;
          background: rgba(0,0,0,.25);
          color: #fff8dc;
          outline: none;
        }

        textarea {
          min-height: 100px;
          resize: vertical;
          font-family: inherit;
        }

        input:disabled { opacity: .65; }
        option { color: #07140f; }

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
          cursor: not-allowed;
          opacity: .55;
        }

        .message,
        .empty {
          padding: 18px;
          border-radius: 22px;
          margin-bottom: 18px;
          color: #fff8dc;
          font-weight: 900;
        }

        .small {
          box-shadow: none;
          margin: 0;
          background: rgba(0,0,0,.22);
        }

        .trustList { display: grid; gap: 12px; }

        .info {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          padding: 14px;
          border-radius: 18px;
          background: rgba(0,0,0,.22);
          border: 1px solid rgba(214,178,94,.12);
        }

        .info p {
          margin: 0;
          color: rgba(248,241,216,.58);
          font-weight: 900;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .info strong {
          color: #fff8dc;
          text-align: right;
          word-break: break-word;
        }

        .pill {
          border-radius: 999px;
          padding: 9px 12px;
          font-size: 12px;
          white-space: nowrap;
        }

        .approved { border-color: rgba(95,220,140,.35); }
        .pending { border-color: rgba(214,178,94,.45); }
        .rejected { border-color: rgba(255,105,105,.4); }
        .notSubmitted { border-color: rgba(255,255,255,.16); }

        .lockedBox,
        .rejectedBox,
        .riskBox,
        .uploadBox {
          border-radius: 18px;
          padding: 16px;
          background: rgba(0,0,0,.22);
          border: 1px solid rgba(214,178,94,.14);
          margin-bottom: 16px;
        }

        .lockedBox strong,
        .rejectedBox strong { color: #fff8dc; }

        .lockedBox p,
        .rejectedBox p {
          color: rgba(248,241,216,.68);
          margin: 8px 0 0;
          line-height: 1.6;
        }

        .uploadGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
          margin-bottom: 16px;
        }

        .uploadBox { margin-bottom: 0; }

        .uploadBox p {
          margin: 0 0 10px;
          color: #d6b25e;
          font-weight: 900;
        }

        .uploadBox small {
          display: block;
          margin-top: 8px;
          color: rgba(248,241,216,.62);
          word-break: break-word;
        }

        .riskBox {
          display: flex;
          align-items: start;
          gap: 12px;
          text-transform: none;
          letter-spacing: 0;
          line-height: 1.5;
        }

        .riskBox input {
          width: auto;
          margin-top: 3px;
        }

        .docLinks {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-top: 4px;
        }

        .docLinks a,
        .docLinks span {
          border-radius: 14px;
          padding: 12px;
          text-align: center;
          text-decoration: none;
          font-weight: 900;
          border: 1px solid rgba(214,178,94,.14);
          color: #d6b25e;
          background: rgba(0,0,0,.22);
        }

        .docLinks span { color: rgba(248,241,216,.45); }

        @media (max-width: 980px) {
          .hero,
          .grid {
            display: grid;
            grid-template-columns: 1fr;
          }

          .stats,
          .formGrid,
          .uploadGrid {
            grid-template-columns: 1fr;
          }

          .identityCard { min-width: 0; }
          h1 { font-size: 36px; }
        }
      `}</style>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="summaryCard">
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
    <div className="uploadBox">
      <p>{label}</p>
      <input
        type="file"
        accept="image/*,.pdf"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
      <small>{file ? file.name : "No file selected"}</small>
    </div>
  );
}

function DocumentLink({
  title,
  url,
}: {
  title: string;
  url: string | null | undefined;
}) {
  if (!url) return <span>{title}: Missing</span>;

  return (
    <a href={url} target="_blank" rel="noreferrer">
      View {title}
    </a>
  );
}