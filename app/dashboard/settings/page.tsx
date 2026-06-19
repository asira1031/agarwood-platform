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
  membership_expiry: string | null;
  auto_renew: boolean | null;
  email_alerts: boolean | null;
  sms_alerts: boolean | null;
  task_alerts: boolean | null;
  gps_alerts: boolean | null;
};

type Wallet = {
  id: string;
  profile_id: string;
  balance: number | null;
};

const MEMBERSHIP_FEE = 999;

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [autoRenew, setAutoRenew] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [taskAlerts, setTaskAlerts] = useState(true);
  const [gpsAlerts, setGpsAlerts] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingRenew, setSavingRenew] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [processingRenewal, setProcessingRenewal] = useState(false);
  const [notice, setNotice] = useState("");

  async function loadSettings() {
    setLoading(true);
    setNotice("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      setNotice(userError.message);
      setLoading(false);
      return;
    }

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const email = user.email?.trim().toLowerCase() || "";

    const { data: profileById } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email, phone, membership_status, membership_expiry, auto_renew, email_alerts, sms_alerts, task_alerts, gps_alerts"
      )
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email, phone, membership_status, membership_expiry, auto_renew, email_alerts, sms_alerts, task_alerts, gps_alerts"
      )
      .eq("email", email)
      .maybeSingle();

    const currentProfile = profileById || profileByEmail;

    if (!currentProfile) {
      setNotice("Profile not found.");
      setLoading(false);
      return;
    }

    const { data: walletRows } = await supabase
      .from("wallets")
      .select("id, profile_id, balance, created_at")
      .eq("profile_id", currentProfile.id)
      .order("created_at", { ascending: false })
      .limit(1);

    setProfile(currentProfile);
    setWallet(walletRows?.[0] || null);

    setFullName(currentProfile.full_name || "");
    setPhone(currentProfile.phone || "");
    setAutoRenew(Boolean(currentProfile.auto_renew));
    setEmailAlerts(currentProfile.email_alerts ?? true);
    setSmsAlerts(currentProfile.sms_alerts ?? false);
    setTaskAlerts(currentProfile.task_alerts ?? true);
    setGpsAlerts(currentProfile.gps_alerts ?? true);

    setLoading(false);
  }

  useEffect(() => {
    loadSettings();
  }, []);

  const walletBalance = useMemo(() => Number(wallet?.balance || 0), [wallet]);

  const membershipExpiryLabel = useMemo(() => {
    if (!profile?.membership_expiry) return "Not set";

    return new Date(profile.membership_expiry).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [profile]);

  async function saveAccount() {
    if (!profile || savingProfile) return;

    setSavingProfile(true);
    setNotice("");

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone: phone.trim(),
      })
      .eq("id", profile.id);

    if (error) {
      setNotice(error.message);
      setSavingProfile(false);
      return;
    }

    setNotice("Account details saved successfully.");
    await loadSettings();
    setSavingProfile(false);
  }

  async function saveAutoRenew(nextValue: boolean) {
    if (!profile || savingRenew) return;

    setSavingRenew(true);
    setNotice("");
    setAutoRenew(nextValue);

    const { error } = await supabase
      .from("profiles")
      .update({ auto_renew: nextValue })
      .eq("id", profile.id);

    if (error) {
      setNotice(error.message);
      setAutoRenew(!nextValue);
      setSavingRenew(false);
      return;
    }

    setNotice(nextValue ? "Auto Renew enabled. Renewal will use wallet balance." : "Auto Renew disabled.");
    await loadSettings();
    setSavingRenew(false);
  }

  async function saveNotifications() {
    if (!profile || savingAlerts) return;

    setSavingAlerts(true);
    setNotice("");

    const { error } = await supabase
      .from("profiles")
      .update({
        email_alerts: emailAlerts,
        sms_alerts: smsAlerts,
        task_alerts: taskAlerts,
        gps_alerts: gpsAlerts,
      })
      .eq("id", profile.id);

    if (error) {
      setNotice(error.message);
      setSavingAlerts(false);
      return;
    }

    setNotice("Notification preferences saved.");
    await loadSettings();
    setSavingAlerts(false);
  }

  async function changePassword() {
    if (changingPassword) return;

    setNotice("");

    if (!newPassword || !confirmPassword) {
      setNotice("Enter your new password and confirmation.");
      return;
    }

    if (newPassword.length < 6) {
      setNotice("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setNotice("New password and confirm password do not match.");
      return;
    }

    setChangingPassword(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setNotice(error.message);
      setChangingPassword(false);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setNotice("Password updated successfully.");
    setChangingPassword(false);
  }

  async function renewMembershipNow() {
    if (!profile || !wallet || processingRenewal) return;

    setProcessingRenewal(true);
    setNotice("");

    if (walletBalance < MEMBERSHIP_FEE) {
      setNotice("Renewal failed. Your wallet balance is not enough for ₱999 membership renewal.");
      setProcessingRenewal(false);
      return;
    }

    const nextExpiry = getNextMembershipExpiry(profile.membership_expiry);

    const { error: walletError } = await supabase
      .from("wallets")
      .update({ balance: walletBalance - MEMBERSHIP_FEE })
      .eq("id", wallet.id);

    if (walletError) {
      setNotice(walletError.message);
      setProcessingRenewal(false);
      return;
    }

    const { error: txError } = await supabase.from("wallet_transactions").insert({
      profile_id: profile.id,
      wallet_id: wallet.id,
      transaction_type: "MEMBERSHIP_RENEWAL",
      amount: MEMBERSHIP_FEE,
      status: "COMPLETED",
      reference_no: `RENEW-${Date.now()}`,
      description: "Annual membership renewal deducted from wallet",
    });

    if (txError) {
      setNotice(txError.message);
      setProcessingRenewal(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        membership_status: "ACTIVE",
        membership_expiry: nextExpiry,
        auto_renew: true,
      })
      .eq("id", profile.id);

    if (profileError) {
      setNotice(profileError.message);
      setProcessingRenewal(false);
      return;
    }

    setNotice("Membership renewed successfully. ₱999 was deducted from your wallet.");
    await loadSettings();
    setProcessingRenewal(false);
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Customer Settings</p>
          <h1>Settings</h1>
          <span>
            Manage your account, wallet auto-renewal, security, and notification preferences.
          </span>
        </div>

        <div className="heroActions">
          <button onClick={loadSettings}>Refresh</button>
          <Link href="/dashboard/wallet">Wallet</Link>
          <Link href="/dashboard">Dashboard</Link>
        </div>
      </section>

      {notice && <div className="notice">{notice}</div>}

      {loading ? (
        <div className="empty">Loading settings...</div>
      ) : (
        <section className="settingsGrid">
          <div className="panel accountPanel">
            <div className="panelHead">
              <div>
                <p className="sectionLabel">Account</p>
                <h2>Profile Information</h2>
              </div>
              <span>Editable</span>
            </div>

            <label>
              Full Name
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </label>

            <label>
              Email
              <input value={profile?.email || ""} disabled />
            </label>

            <label>
              Phone
              <input value={phone} onChange={(event) => setPhone(event.target.value)} />
            </label>

            <button className="primaryButton" onClick={saveAccount} disabled={savingProfile}>
              {savingProfile ? "Saving..." : "Save Account Changes"}
            </button>
          </div>

          <div className="panel membershipPanel">
            <div className="panelHead">
              <div>
                <p className="sectionLabel">Membership</p>
                <h2>Auto Renew</h2>
              </div>
              <span>{profile?.membership_status || "UNKNOWN"}</span>
            </div>

            <div className="balanceCard">
              <p>Wallet Balance</p>
              <h3>{peso(walletBalance)}</h3>
              <small>Membership renewal fee: {peso(MEMBERSHIP_FEE)}</small>
            </div>

            <div className="infoRows">
              <div>
                <span>Status</span>
                <strong>{profile?.membership_status || "UNKNOWN"}</strong>
              </div>
              <div>
                <span>Expiry</span>
                <strong>{membershipExpiryLabel}</strong>
              </div>
            </div>

            <div className="toggleRow">
              <div>
                <strong>Auto Renew from Wallet</strong>
                <p>
                  When enabled, renewal should deduct membership fee from your wallet balance.
                </p>
              </div>

              <button
                className={`toggle ${autoRenew ? "on" : ""}`}
                onClick={() => saveAutoRenew(!autoRenew)}
                disabled={savingRenew}
              >
                <span />
              </button>
            </div>

            <button
              className="goldButton"
              onClick={renewMembershipNow}
              disabled={!wallet || processingRenewal}
            >
              {processingRenewal ? "Processing..." : "Renew Now from Wallet"}
            </button>
          </div>

          <div className="panel securityPanel">
            <div className="panelHead">
              <div>
                <p className="sectionLabel">Security</p>
                <h2>Change Password</h2>
              </div>
              <span>Protected</span>
            </div>

            <label>
              Current Password
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Optional for Supabase session update"
              />
            </label>

            <label>
              New Password
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>

            <label>
              Confirm New Password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>

            <button className="primaryButton" onClick={changePassword} disabled={changingPassword}>
              {changingPassword ? "Updating..." : "Update Password"}
            </button>
          </div>

          <div className="panel notificationsPanel">
            <div className="panelHead">
              <div>
                <p className="sectionLabel">Notifications</p>
                <h2>Alert Preferences</h2>
              </div>
              <span>Customer</span>
            </div>

            <SwitchRow
              title="Email Alerts"
              note="Membership, wallet, tree, and support email updates."
              value={emailAlerts}
              onChange={setEmailAlerts}
            />

            <SwitchRow
              title="SMS Alerts"
              note="Important wallet and account updates by SMS."
              value={smsAlerts}
              onChange={setSmsAlerts}
            />

            <SwitchRow
              title="Task Alerts"
              note="Task order status and farm operation updates."
              value={taskAlerts}
              onChange={setTaskAlerts}
            />

            <SwitchRow
              title="GPS Alerts"
              note="GPS verification and tree location status updates."
              value={gpsAlerts}
              onChange={setGpsAlerts}
            />

            <button className="primaryButton" onClick={saveNotifications} disabled={savingAlerts}>
              {savingAlerts ? "Saving..." : "Save Notification Settings"}
            </button>
          </div>
        </section>
      )}

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          padding: 30px;
          color: #fff8dd;
          font-family: Arial, Helvetica, sans-serif;
          background:
            radial-gradient(circle at 15% 8%, rgba(224, 176, 58, .24), transparent 25%),
            radial-gradient(circle at 82% 5%, rgba(255, 246, 184, .12), transparent 24%),
            linear-gradient(180deg, #0b2618 0%, #071b12 100%);
        }

        .hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .eyebrow,
        .sectionLabel {
          margin: 0 0 8px;
          color: #d9a52e;
          font-weight: 900;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .14em;
        }

        .hero h1 {
          margin: 0;
          color: #ffe49a;
          font-size: 44px;
          letter-spacing: -1.5px;
        }

        .hero span {
          display: block;
          max-width: 720px;
          margin-top: 8px;
          color: rgba(255, 248, 221, .74);
          line-height: 1.6;
        }

        .heroActions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .heroActions button,
        .heroActions a {
          border: 1px solid rgba(223, 171, 61, .34);
          border-radius: 14px;
          padding: 12px 16px;
          background: rgba(255,255,255,.06);
          color: #ffe49a;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
        }

        .notice,
        .empty,
        .panel {
          border-radius: 26px;
          border: 1px solid rgba(223, 171, 61, .24);
          background:
            linear-gradient(180deg, rgba(255,255,255,.075), rgba(255,255,255,.035)),
            rgba(10, 42, 27, .92);
          box-shadow: 0 24px 70px rgba(0,0,0,.30);
        }

        .notice,
        .empty {
          padding: 18px 20px;
          margin-bottom: 18px;
          color: #ffe49a;
          font-weight: 900;
        }

        .settingsGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }

        .panel {
          padding: 24px;
        }

        .panelHead {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 20px;
        }

        .panelHead h2 {
          margin: 0;
          color: #fff5c3;
          font-size: 25px;
        }

        .panelHead span {
          border-radius: 999px;
          padding: 8px 12px;
          background: rgba(217, 165, 46, .14);
          color: #ffe49a;
          font-size: 11px;
          font-weight: 1000;
        }

        label {
          display: grid;
          gap: 8px;
          margin-bottom: 14px;
          color: rgba(255, 248, 221, .75);
          font-weight: 900;
        }

        input {
          width: 100%;
          outline: none;
          border: 1px solid rgba(223, 171, 61, .22);
          border-radius: 16px;
          padding: 14px 15px;
          background: rgba(255,255,255,.07);
          color: #fff8dd;
          font-weight: 900;
        }

        input:disabled {
          opacity: .62;
          cursor: not-allowed;
        }

        .primaryButton,
        .goldButton {
          width: 100%;
          border: 0;
          border-radius: 17px;
          padding: 15px 16px;
          font-weight: 1000;
          cursor: pointer;
        }

        .primaryButton {
          margin-top: 8px;
          background: rgba(255,255,255,.08);
          color: #ffe49a;
          border: 1px solid rgba(223, 171, 61, .24);
        }

        .goldButton {
          margin-top: 16px;
          background: linear-gradient(135deg, #e5ad34, #c58b25);
          color: #06170f;
        }

        .primaryButton:hover,
        .heroActions button:hover,
        .heroActions a:hover {
          background: rgba(217, 165, 46, .18);
        }

        button:disabled {
          opacity: .48;
          cursor: not-allowed;
        }

        .balanceCard {
          border-radius: 22px;
          padding: 18px;
          margin-bottom: 16px;
          background: linear-gradient(135deg, rgba(229, 173, 52, .22), rgba(255,255,255,.06));
          border: 1px solid rgba(223, 171, 61, .22);
        }

        .balanceCard p {
          margin: 0 0 8px;
          color: rgba(255, 248, 221, .70);
          font-weight: 900;
        }

        .balanceCard h3 {
          margin: 0 0 8px;
          color: #ffe49a;
          font-size: 34px;
          letter-spacing: -1px;
        }

        .balanceCard small {
          color: rgba(255, 248, 221, .64);
          font-weight: 900;
        }

        .infoRows {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }

        .infoRows div {
          border-radius: 17px;
          padding: 14px;
          background: rgba(255,255,255,.055);
          border: 1px solid rgba(223, 171, 61, .14);
        }

        .infoRows span {
          display: block;
          margin-bottom: 7px;
          color: rgba(255, 248, 221, .55);
          font-size: 12px;
          font-weight: 900;
        }

        .infoRows strong {
          color: #fff5c3;
        }

        .toggleRow,
        .switchRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 16px;
          border-radius: 18px;
          background: rgba(255,255,255,.055);
          border: 1px solid rgba(223, 171, 61, .14);
          margin-bottom: 12px;
        }

        .toggleRow strong,
        .switchRow strong {
          display: block;
          margin-bottom: 5px;
          color: #fff5c3;
        }

        .toggleRow p,
        .switchRow p {
          margin: 0;
          color: rgba(255, 248, 221, .62);
          line-height: 1.5;
          font-size: 13px;
          font-weight: 800;
        }

        .toggle {
          flex: 0 0 auto;
          position: relative;
          width: 64px;
          height: 36px;
          border: 1px solid rgba(223, 171, 61, .24);
          border-radius: 999px;
          background: rgba(255,255,255,.08);
          cursor: pointer;
          padding: 3px;
        }

        .toggle span {
          display: block;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(255, 248, 221, .78);
          transition: .18s ease;
        }

        .toggle.on {
          background: linear-gradient(135deg, #e5ad34, #c58b25);
        }

        .toggle.on span {
          transform: translateX(27px);
          background: #06170f;
        }

        @media (max-width: 1000px) {
          .settingsGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .page {
            padding: 18px;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
          }

          .hero h1 {
            font-size: 34px;
          }

          .infoRows {
            grid-template-columns: 1fr;
          }

          .toggleRow,
          .switchRow {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}

function SwitchRow({
  title,
  note,
  value,
  onChange,
}: {
  title: string;
  note: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="switchRow">
      <div>
        <strong>{title}</strong>
        <p>{note}</p>
      </div>

      <button className={`toggle ${value ? "on" : ""}`} onClick={() => onChange(!value)}>
        <span />
      </button>
    </div>
  );
}

function peso(value: number) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getNextMembershipExpiry(currentExpiry: string | null) {
  const today = new Date();
  const base =
    currentExpiry && new Date(currentExpiry).getTime() > today.getTime()
      ? new Date(currentExpiry)
      : today;

  base.setFullYear(base.getFullYear() + 1);
  return base.toISOString();
}
