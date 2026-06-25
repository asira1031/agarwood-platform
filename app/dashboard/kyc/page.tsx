"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  kyc_status: string | null;
};

type KycRecord = {
  id: string;
  status: string | null;
  review_notes: string | null;
  id_type: string | null;
  id_number: string | null;
  id_front_url: string | null;
  id_back_url: string | null;
  selfie_url: string | null;
  source_of_funds: string | null;
  investment_experience: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
};

const KYC_BUCKET = "kyc-documents";

const ID_TYPES = [
  "Government ID",
  "Passport",
  "Driver License",
  "National ID",
  "UMID",
  "PRC",
  "Other",
];

function normalize(value: any) {
  return String(value || "").trim().toUpperCase();
}

function safeFileName(value: string) {
  return String(value || "document")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function formatDate(value: string | null | undefined) {
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

function maskId(value: string | null | undefined) {
  if (!value) return "—";
  const clean = String(value).trim();
  if (clean.length <= 4) return "****";
  return `${"*".repeat(Math.max(clean.length - 4, 4))}${clean.slice(-4)}`;
}

export default function KYCPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [latestKyc, setLatestKyc] = useState<KycRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null);
  const [selfiePreview, setSelfiePreview] = useState("");

  const [form, setForm] = useState({
    id_type: "",
    id_number: "",
    source_of_funds: "",
    investment_experience: "",
    notes: "",
    risk_acknowledged: false,
  });

  const [files, setFiles] = useState({
    id_front: null as File | null,
    id_back: null as File | null,
  });

  async function findProfile(userId: string, email: string) {
    const cleanEmail = String(email || "").trim();
    const lowerEmail = cleanEmail.toLowerCase();

    const { data: byId, error: byIdError } = await supabase
      .from("profiles")
      .select("id, full_name, email, kyc_status")
      .eq("id", userId)
      .maybeSingle();

    if (byIdError) throw byIdError;
    if (byId) return byId as Profile;

    const { data: byEmail, error: byEmailError } = await supabase
      .from("profiles")
      .select("id, full_name, email, kyc_status")
      .eq("email", lowerEmail)
      .maybeSingle();

    if (byEmailError) throw byEmailError;
    if (byEmail) return byEmail as Profile;

    const { data: fallback, error: fallbackError } = await supabase
      .from("profiles")
      .select("id, full_name, email, kyc_status")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (fallbackError) throw fallbackError;
    return fallback as Profile | null;
  }

  async function resolveCurrentProfile() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) throw error;
    if (!user) throw new Error("Please login first.");

    const currentProfile = await findProfile(user.id, user.email || "");
    if (!currentProfile) throw new Error("Profile not found. Please login again.");

    return currentProfile;
  }

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const currentProfile = await resolveCurrentProfile();
      setProfile(currentProfile);

      const { data: kycData } = await supabase
        .from("kyc_records")
        .select(
          "id, status, review_notes, id_type, id_number, id_front_url, id_back_url, selfie_url, source_of_funds, investment_experience, submitted_at, reviewed_at"
        )
        .eq("profile_id", currentProfile.id)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setLatestKyc((kycData as KycRecord) || null);
    } catch (error: any) {
      if (String(error?.message || "").toLowerCase().includes("login")) {
        window.location.href = "/login";
        return;
      }

      setMessage(error?.message || "KYC page failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    return () => {
      stopCamera();
      if (selfiePreview) URL.revokeObjectURL(selfiePreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentStatus = latestKyc?.status || profile?.kyc_status || "NOT_SUBMITTED";
  const normalizedStatus = normalize(currentStatus);
  const isPending = normalizedStatus === "PENDING";
  const isApproved = normalizedStatus === "APPROVED";
  const isRejected = normalizedStatus === "REJECTED";
  const canSubmit = !isPending && !isApproved;

  const statusTitle = useMemo(() => {
    if (isApproved) return "Your KYC is approved.";
    if (isPending) return "Your KYC is under admin review.";
    if (isRejected) return "Your KYC needs resubmission.";
    return "Submit your KYC verification.";
  }, [isApproved, isPending, isRejected]);

  async function startCamera() {
    setMessage("");

    try {
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;
      setCameraOpen(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (error: any) {
      setMessage(error?.message || "Unable to open camera. Please allow camera access.");
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setCameraOpen(false);
  }

  function captureSelfie() {
    if (!videoRef.current || !canvasRef.current) {
      setMessage("Camera is not ready.");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const context = canvas.getContext("2d");
    if (!context) {
      setMessage("Unable to capture selfie.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setMessage("Unable to save selfie photo.");
          return;
        }

        if (selfiePreview) URL.revokeObjectURL(selfiePreview);

        setSelfieBlob(blob);
        setSelfiePreview(URL.createObjectURL(blob));
        stopCamera();
      },
      "image/jpeg",
      0.92
    );
  }

  function retakeSelfie() {
    if (selfiePreview) URL.revokeObjectURL(selfiePreview);
    setSelfieBlob(null);
    setSelfiePreview("");
    startCamera();
  }

  async function uploadKycFile(
    fileOrBlob: File | Blob | null,
    folder: string,
    profileId: string,
    fallbackName: string
  ) {
    if (!fileOrBlob) return null;

    const name =
      fileOrBlob instanceof File
        ? safeFileName(fileOrBlob.name)
        : safeFileName(fallbackName);

    const filePath = `${profileId}/${folder}/${Date.now()}-${name}`;

    const { error: uploadError } = await supabase.storage
      .from(KYC_BUCKET)
      .upload(filePath, fileOrBlob, {
        upsert: false,
        cacheControl: "3600",
        contentType:
          fileOrBlob instanceof File ? fileOrBlob.type || undefined : "image/jpeg",
      });

    if (uploadError) {
      throw new Error(`KYC upload failed (${folder}): ${uploadError.message}`);
    }

    const { data } = supabase.storage.from(KYC_BUCKET).getPublicUrl(filePath);

    if (!data?.publicUrl) {
      throw new Error(`Unable to get public URL for ${folder}.`);
    }

    return data.publicUrl;
  }

  async function submitKYC() {
    setMessage("");

    if (!canSubmit) {
      setMessage("KYC cannot be submitted while pending or already approved.");
      return;
    }

    if (!form.id_type) return setMessage("Please select ID type.");
    if (!form.id_number.trim()) return setMessage("Please enter ID number.");
    if (!files.id_front) return setMessage("Please upload the front of your ID.");
    if (!files.id_back) return setMessage("Please upload the back of your ID.");
    if (!selfieBlob) return setMessage("Please take a live selfie using the camera.");
    if (!form.risk_acknowledged) {
      return setMessage("Please certify that the documents belong to you.");
    }

    try {
      setSubmitting(true);

      const currentProfile = await resolveCurrentProfile();
      const now = new Date().toISOString();

      const idFrontUrl = await uploadKycFile(
        files.id_front,
        "id-front",
        currentProfile.id,
        "front-id.jpg"
      );

      const idBackUrl = await uploadKycFile(
        files.id_back,
        "id-back",
        currentProfile.id,
        "back-id.jpg"
      );

      const selfieUrl = await uploadKycFile(
        selfieBlob,
        "selfie",
        currentProfile.id,
        "live-selfie.jpg"
      );

      const { error: insertError } = await supabase.from("kyc_records").insert({
        profile_id: currentProfile.id,
        id_type: form.id_type,
        id_number: form.id_number.trim(),
        id_front_url: idFrontUrl,
        id_back_url: idBackUrl,
        selfie_url: selfieUrl,
        proof_of_address_url: null,
        source_of_funds: form.source_of_funds || null,
        investment_experience: form.investment_experience || null,
        risk_acknowledged: form.risk_acknowledged,
        status: "PENDING",
        review_notes: form.notes.trim() || null,
        submitted_at: now,
        reviewed_at: null,
      });

      if (insertError) throw insertError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ kyc_status: "PENDING" })
        .eq("id", currentProfile.id);

      if (profileError) throw profileError;

      setForm({
        id_type: "",
        id_number: "",
        source_of_funds: "",
        investment_experience: "",
        notes: "",
        risk_acknowledged: false,
      });

      setFiles({
        id_front: null,
        id_back: null,
      });

      if (selfiePreview) URL.revokeObjectURL(selfiePreview);
      setSelfieBlob(null);
      setSelfiePreview("");

      setMessage("KYC submitted successfully. Your KYC is under admin review.");
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || "KYC submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Customer Trust Layer</p>
          <h1>KYC Verification</h1>
          <span>
            Submit your ID front, ID back, and live selfie for admin verification.
          </span>
        </div>

        <Link className="backLink" href="/dashboard/profile">
          Back to Profile
        </Link>
      </section>

      {message && <div className="message">{message}</div>}

      {loading ? (
        <div className="empty">Loading KYC Verification...</div>
      ) : (
        <section className="layout">
          <section className="panel">
            <div className="panelHead">
              <div>
                <p className="eyebrow">Verification Form</p>
                <h2>{statusTitle}</h2>
                <span>
                  {isPending
                    ? "We received your verification details. Please wait while the admin team reviews your submission."
                    : isApproved
                    ? "Your account is verified. You may use payout and sell tree features."
                    : "Complete the fields below to submit your KYC for admin review."}
                </span>
              </div>
              <b className={`pill ${normalizedStatus.toLowerCase()}`}>
                {normalizedStatus === "NOT_SUBMITTED" ? "NOT SUBMITTED" : normalizedStatus}
              </b>
            </div>

            {!canSubmit ? (
              <div className="lockedBox">
                <strong>{statusTitle}</strong>
                <p>
                  Submitted: {formatDate(latestKyc?.submitted_at)}
                  <br />
                  Reviewed: {formatDate(latestKyc?.reviewed_at)}
                  <br />
                  Admin Notes: {latestKyc?.review_notes || "—"}
                </p>
              </div>
            ) : (
              <>
                {isRejected && (
                  <div className="rejectedBox">
                    <strong>Your KYC needs resubmission.</strong>
                    <p>{latestKyc?.review_notes || "Please review your documents and submit again."}</p>
                  </div>
                )}

                <div className="formGrid">
                  <label>
                    ID Type
                    <select
                      value={form.id_type}
                      onChange={(e) => setForm({ ...form, id_type: e.target.value })}
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
                      value={form.id_number}
                      onChange={(e) => setForm({ ...form, id_number: e.target.value })}
                      placeholder="Enter ID number"
                    />
                  </label>

                  <label>
                    Source of Funds Optional
                    <select
                      value={form.source_of_funds}
                      onChange={(e) =>
                        setForm({ ...form, source_of_funds: e.target.value })
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
                      value={form.investment_experience}
                      onChange={(e) =>
                        setForm({ ...form, investment_experience: e.target.value })
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
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Add notes for admin review"
                  />
                </label>

                <div className="uploadGrid">
                  <UploadBox
                    label="Front of ID Required"
                    file={files.id_front}
                    onChange={(file) => setFiles({ ...files, id_front: file })}
                  />
                  <UploadBox
                    label="Back of ID Required"
                    file={files.id_back}
                    onChange={(file) => setFiles({ ...files, id_back: file })}
                  />
                </div>

                <div className="cameraBox">
                  <div>
                    <p className="eyebrow">Live Selfie Verification</p>
                    <h3>Take Selfie</h3>
                    <span>
                      Use good lighting. Face the camera clearly. This photo must be captured live.
                    </span>
                  </div>

                  {cameraOpen && (
                    <div className="cameraPreview">
                      <video ref={videoRef} playsInline muted />
                      <div className="buttonRow">
                        <button type="button" onClick={captureSelfie}>
                          Capture Selfie
                        </button>
                        <button type="button" onClick={stopCamera} className="ghostBtn">
                          Close Camera
                        </button>
                      </div>
                    </div>
                  )}

                  {!cameraOpen && selfiePreview && (
                    <div className="selfiePreview">
                      <img src={selfiePreview} alt="Selfie preview" />
                      <button type="button" onClick={retakeSelfie}>
                        Retake Selfie
                      </button>
                    </div>
                  )}

                  {!cameraOpen && !selfiePreview && (
                    <button type="button" onClick={startCamera}>
                      Open Camera
                    </button>
                  )}

                  <canvas ref={canvasRef} className="hiddenCanvas" />
                </div>

                <label className="riskBox">
                  <input
                    type="checkbox"
                    checked={form.risk_acknowledged}
                    onChange={(e) =>
                      setForm({ ...form, risk_acknowledged: e.target.checked })
                    }
                  />
                  <span>
                    I certify that these documents belong to me and I understand that
                    agarwood ownership involves long-term agricultural, market, and
                    verification risk.
                  </span>
                </label>

                <button onClick={submitKYC} disabled={submitting} className="submitBtn">
                  {submitting ? "Submitting..." : "Submit KYC for Review"}
                </button>
              </>
            )}
          </section>

          <aside className="panel sidePanel">
            <p className="eyebrow">Current Status</p>
            <h2>{profile?.full_name || "Customer"}</h2>
            <span>{profile?.email || "No email"}</span>

            <div className="infoList">
              <Info label="KYC Status" value={normalizedStatus} />
              <Info label="ID Type" value={latestKyc?.id_type || "—"} />
              <Info label="ID Number" value={maskId(latestKyc?.id_number)} />
              <Info label="Submitted" value={formatDate(latestKyc?.submitted_at)} />
              <Info label="Reviewed" value={formatDate(latestKyc?.reviewed_at)} />
              <Info label="Admin Notes" value={latestKyc?.review_notes || "—"} />
            </div>

            {latestKyc && (
              <div className="docLinks">
                <DocumentLink title="Front ID" url={latestKyc.id_front_url} />
                <DocumentLink title="Back ID" url={latestKyc.id_back_url} />
                <DocumentLink title="Selfie" url={latestKyc.selfie_url} />
              </div>
            )}
          </aside>
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
            radial-gradient(circle at 15% 5%, rgba(214,178,94,.22), transparent 28%),
            radial-gradient(circle at 90% 10%, rgba(65,120,82,.22), transparent 30%),
            linear-gradient(180deg, #07140f 0%, #0d2118 48%, #07120d 100%);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: start;
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

        h2, h3 {
          margin: 0;
          color: #fff8dc;
        }

        .hero span,
        .panelHead span,
        .sidePanel span,
        .cameraBox span {
          display: block;
          margin-top: 8px;
          color: rgba(248,241,216,.68);
          line-height: 1.6;
        }

        .backLink,
        button,
        .submitBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 999px;
          padding: 12px 18px;
          background: linear-gradient(135deg, #d6b25e, #8c6a3c);
          color: #07140f;
          font-weight: 950;
          cursor: pointer;
          text-decoration: none;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: .55;
        }

        .message,
        .empty,
        .panel,
        .cameraBox {
          border: 1px solid rgba(214,178,94,.22);
          background: rgba(255,255,255,.07);
          backdrop-filter: blur(18px);
          box-shadow: 0 24px 60px rgba(0,0,0,.28);
        }

        .message,
        .empty {
          padding: 18px;
          border-radius: 22px;
          margin-bottom: 18px;
          color: #fff8dc;
          font-weight: 900;
        }

        .layout {
          display: grid;
          grid-template-columns: 1.25fr .75fr;
          gap: 18px;
          align-items: start;
        }

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

        .pill {
          border-radius: 999px;
          padding: 9px 12px;
          font-size: 12px;
          white-space: nowrap;
          border: 1px solid rgba(214,178,94,.25);
          background: rgba(214,178,94,.12);
          color: #d6b25e;
        }

        .pending { color: #f7d774; }
        .approved { color: #b7f7c8; }
        .rejected { color: #ffb6b6; }

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
        .rejectedBox strong {
          color: #fff8dc;
        }

        .lockedBox p,
        .rejectedBox p {
          color: rgba(248,241,216,.68);
          line-height: 1.6;
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

        option { color: #07140f; }

        textarea {
          min-height: 100px;
          resize: vertical;
          font-family: inherit;
        }

        .notesLabel { margin-bottom: 16px; }

        .uploadGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
          margin-bottom: 16px;
        }

        .uploadBox {
          margin-bottom: 0;
        }

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

        .cameraBox {
          display: grid;
          gap: 16px;
          border-radius: 22px;
          padding: 18px;
          margin-bottom: 16px;
        }

        .cameraPreview,
        .selfiePreview {
          display: grid;
          gap: 12px;
        }

        .cameraPreview video,
        .selfiePreview img {
          width: 100%;
          max-height: 420px;
          object-fit: contain;
          border-radius: 20px;
          background: rgba(0,0,0,.35);
          border: 1px solid rgba(214,178,94,.16);
        }

        .buttonRow {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .ghostBtn {
          background: rgba(255,255,255,.12);
          color: #fff8dc;
        }

        .hiddenCanvas {
          display: none;
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

        .submitBtn {
          width: 100%;
          margin-top: 6px;
        }

        .sidePanel {
          position: sticky;
          top: 24px;
        }

        .infoList {
          display: grid;
          gap: 12px;
          margin-top: 18px;
        }

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

        .docLinks {
          display: grid;
          gap: 10px;
          margin-top: 18px;
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

        .docLinks span {
          color: rgba(248,241,216,.45);
        }

        @media (max-width: 980px) {
          .hero,
          .layout {
            display: grid;
            grid-template-columns: 1fr;
          }

          .formGrid,
          .uploadGrid {
            grid-template-columns: 1fr;
          }

          .sidePanel {
            position: static;
          }

          h1 {
            font-size: 36px;
          }
        }
      `}</style>
    </main>
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
      <p>{label}</p>
      <input
        type="file"
        accept="image/*,.pdf"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
      <small>{file ? file.name : "No file selected"}</small>
    </label>
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