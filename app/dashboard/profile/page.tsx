"use client";

import Link from "next/link";
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
  status: string | null;
  review_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
};

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

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [latestKyc, setLatestKyc] = useState<KycRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
  });

  async function findProfile(userId: string, email: string) {
    const cleanEmail = String(email || "").trim();
    const lowerEmail = cleanEmail.toLowerCase();

    const { data: byId, error: byIdError } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, membership_status, kyc_status")
      .eq("id", userId)
      .maybeSingle();

    if (byIdError) throw byIdError;
    if (byId) return byId as Profile;

    const { data: byEmail, error: byEmailError } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, membership_status, kyc_status")
      .eq("email", lowerEmail)
      .maybeSingle();

    if (byEmailError) throw byEmailError;
    if (byEmail) return byEmail as Profile;

    const { data: fallback, error: fallbackError } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, membership_status, kyc_status")
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
    if (!user) throw new Error("No authenticated user found.");

    const currentProfile = await findProfile(user.id, user.email || "");

    if (!currentProfile) {
      throw new Error("Profile not found for current user.");
    }

    return currentProfile;
  }

  async function loadProfile() {
    setLoading(true);
    setMessage("");

    try {
      const currentProfile = await resolveCurrentProfile();

      setProfile(currentProfile);
      setForm({
        full_name: currentProfile.full_name || "",
        phone: currentProfile.phone || "",
      });

      const { data: kycData } = await supabase
        .from("kyc_records")
        .select("status, review_notes, submitted_at, reviewed_at")
        .eq("profile_id", currentProfile.id)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setLatestKyc((kycData as KycRecord) || null);
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

  const kycStatus = latestKyc?.status || profile?.kyc_status || "NOT_SUBMITTED";
  const membershipStatus = profile?.membership_status || "INACTIVE";

  const verified = normalize(kycStatus) === "APPROVED";
  const pending = normalize(kycStatus) === "PENDING";
  const rejected = normalize(kycStatus) === "REJECTED";

  const kycMessage = useMemo(() => {
    if (verified) return "Your KYC is approved. You are now a verified customer.";
    if (pending) return "Your KYC is under admin review.";
    if (rejected) return "Your KYC needs resubmission.";
    return "Submit your KYC documents to unlock withdrawals and sell tree access.";
  }, [verified, pending, rejected]);

  async function saveProfile() {
    setMessage("");

    if (!profile) return setMessage("Profile not found.");
    if (!form.full_name.trim()) return setMessage("Full name is required.");

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
      })
      .eq("id", profile.id);

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setMessage("Forest identity updated successfully.");
    setSaving(false);
    await loadProfile();
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Customer Account</p>
          <h1>Forest Identity Center</h1>
          <span>
            Manage your identity, membership, and verification standing for Arganwood services.
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
                  <span>Update your customer identity information.</span>
                </div>
              </div>

              <div className="formGrid">
                <label>
                  Full Name
                  <input
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="Full name"
                  />
                </label>

                <label>
                  Phone
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </label>

                <label>
                  Email
                  <input value={profile?.email || ""} disabled />
                </label>
              </div>

              <button onClick={saveProfile} disabled={saving}>
                {saving ? "Saving..." : "Save Forest Identity"}
              </button>
            </div>

            <aside className="panel">
              <div className="panelHead">
                <div>
                  <p className="eyebrow">Trust Status</p>
                  <h2>{verified ? "Verified Customer" : "Verification Status"}</h2>
                  <span>{kycMessage}</span>
                </div>
              </div>

              <div className="trustList">
                <Info label="Membership" value={statusLabel(membershipStatus)} />
                <Info label="KYC Status" value={statusLabel(kycStatus)} />
                <Info label="Withdraw Access" value={verified ? "UNLOCKED" : "LOCKED"} />
                <Info label="Sell Tree Access" value={verified ? "UNLOCKED" : "LOCKED"} />
                <Info label="Last Submitted" value={formatDate(latestKyc?.submitted_at)} />
                <Info label="Admin Notes" value={latestKyc?.review_notes || "—"} />
              </div>

              <Link className="kycButton" href="/dashboard/kyc">
                {rejected ? "Resubmit KYC" : pending ? "View KYC Status" : "Go to KYC Verification"}
              </Link>
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
          grid-template-columns: 1.2fr .8fr;
          gap: 18px;
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

        input {
          width: 100%;
          border: 1px solid rgba(214,178,94,.22);
          border-radius: 16px;
          padding: 13px 14px;
          background: rgba(0,0,0,.25);
          color: #fff8dc;
          outline: none;
        }

        input:disabled { opacity: .65; }

        button,
        .kycButton {
          display: inline-flex;
          justify-content: center;
          align-items: center;
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

        .kycButton {
          width: 100%;
          margin-top: 16px;
        }

        .message,
        .empty {
          padding: 18px;
          border-radius: 22px;
          margin-bottom: 18px;
          color: #fff8dc;
          font-weight: 900;
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

        .approved { border-color: rgba(95,220,140,.35); }
        .pending { border-color: rgba(214,178,94,.45); }
        .rejected { border-color: rgba(255,105,105,.4); }
        .notSubmitted { border-color: rgba(255,255,255,.16); }

        @media (max-width: 980px) {
          .hero,
          .grid {
            display: grid;
            grid-template-columns: 1fr;
          }

          .stats,
          .formGrid {
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