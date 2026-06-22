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
};

type TreeRow = Record<string, any>;
type SubscriptionRow = Record<string, any>;

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAutoRenew, setSavingAutoRenew] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
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

    const { data: profileById, error: profileByIdError } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, membership_status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileByIdError) {
      setNotice(profileByIdError.message);
      setLoading(false);
      return;
    }

    const { data: profileByEmail, error: profileByEmailError } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, membership_status")
      .ilike("email", email)
      .maybeSingle();

    if (profileByEmailError) {
      setNotice(profileByEmailError.message);
      setLoading(false);
      return;
    }

    const currentProfile = profileById || profileByEmail;

    if (!currentProfile) {
      setNotice("Profile not found.");
      setLoading(false);
      return;
    }

    setProfile(currentProfile);
    setFullName(currentProfile.full_name || "");
    setPhone(currentProfile.phone || "");

    const { data: treeData, error: treeError } = await supabase
      .from("trees")
      .select("*")
      .eq("profile_id", currentProfile.id)
      .order("created_at", { ascending: false });

    if (treeError) {
      setNotice(treeError.message);
      setLoading(false);
      return;
    }

    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from("care_program_subscriptions")
      .select("*")
      .eq("profile_id", currentProfile.id)
      .order("created_at", { ascending: false });

    if (subscriptionError) {
      setNotice(subscriptionError.message);
      setLoading(false);
      return;
    }

    setTrees(treeData || []);
    setSubscriptions(subscriptionData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadSettings();
  }, []);

  const autoRenewOn = useMemo(() => {
    return (
      trees.some((tree) => Boolean(tree.auto_renew_enabled)) ||
      subscriptions.some((item) => Boolean(item.auto_renew_enabled))
    );
  }, [trees, subscriptions]);

  const treeAutoRenewCount = useMemo(() => {
    return trees.filter((tree) => Boolean(tree.auto_renew_enabled)).length;
  }, [trees]);

  const subscriptionAutoRenewCount = useMemo(() => {
    return subscriptions.filter((item) => Boolean(item.auto_renew_enabled)).length;
  }, [subscriptions]);

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

    setNotice("Account details saved.");
    await loadSettings();
    setSavingProfile(false);
  }

  async function updateAutoRenew(value: boolean) {
    if (!profile || savingAutoRenew) return;

    setSavingAutoRenew(true);
    setNotice("");

    const { error: treeError } = await supabase
      .from("trees")
      .update({
        auto_renew_enabled: value,
      })
      .eq("profile_id", profile.id);

    if (treeError) {
      setNotice(treeError.message);
      setSavingAutoRenew(false);
      return;
    }

    const { error: subscriptionError } = await supabase
      .from("care_program_subscriptions")
      .update({
        auto_renew_enabled: value,
      })
      .eq("profile_id", profile.id);

    if (subscriptionError) {
      setNotice(subscriptionError.message);
      setSavingAutoRenew(false);
      return;
    }

    setNotice(value ? "Auto Renew turned ON for all tree operations." : "Auto Renew turned OFF for all tree operations.");
    await loadSettings();
    setSavingAutoRenew(false);
  }

  async function changePassword() {
    if (changingPassword) return;

    setNotice("");

    if (!newPassword || !confirmPassword) {
      setNotice("Enter new password and confirmation.");
      return;
    }

    if (newPassword.length < 6) {
      setNotice("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setNotice("Passwords do not match.");
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

    setNewPassword("");
    setConfirmPassword("");
    setNotice("Password updated.");
    setChangingPassword(false);
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Customer Settings</p>
          <h1>Settings</h1>
          <span>
            Manage account details and control Tree Operations Auto Renew. Turning OFF disables
            auto renew for all trees and care program subscriptions.
          </span>
        </div>

        <div className="heroActions">
          <button onClick={loadSettings}>Refresh</button>
          <Link href="/dashboard/tree-operations">Tree Operations</Link>
          <Link href="/dashboard/investments">Investments</Link>
        </div>
      </section>

      {notice && <div className="notice">{notice}</div>}

      {loading ? (
        <div className="empty">Loading settings...</div>
      ) : (
        <section className="settingsGrid">
          <div className="panel">
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

          <div className="panel">
            <div className="panelHead">
              <div>
                <p className="sectionLabel">Auto Renew Master Switch</p>
                <h2>Tree Operations Auto Renew</h2>
              </div>
              <span>{autoRenewOn ? "ON" : "OFF"}</span>
            </div>

            <div className={`statusCard ${autoRenewOn ? "on" : "off"}`}>
              <p>Current Auto Renew Status</p>
              <h3>{autoRenewOn ? "ON" : "OFF"}</h3>
              <small>Connected to trees and care program subscriptions.</small>
            </div>

            <div className="autoButtons">
              <button onClick={() => updateAutoRenew(true)} disabled={savingAutoRenew}>
                Turn ON All
              </button>
              <button onClick={() => updateAutoRenew(false)} disabled={savingAutoRenew}>
                Turn OFF All
              </button>
            </div>

            <div className="infoRows">
              <div>
                <span>Trees Auto Renew ON</span>
                <strong>{treeAutoRenewCount}</strong>
              </div>
              <div>
                <span>Subscriptions Auto Renew ON</span>
                <strong>{subscriptionAutoRenewCount}</strong>
              </div>
              <div>
                <span>Total Trees</span>
                <strong>{trees.length}</strong>
              </div>
              <div>
                <span>Total Subscriptions</span>
                <strong>{subscriptions.length}</strong>
              </div>
            </div>

            <div className="syncBox">
              <strong>Connection Rule</strong>
              <p>
                Settings controls the master switch. Tree Operations must only renew records where
                auto_renew_enabled is ON.
              </p>
            </div>
          </div>

          <div className="panel">
            <div className="panelHead">
              <div>
                <p className="sectionLabel">Security</p>
                <h2>Change Password</h2>
              </div>
              <span>Protected</span>
            </div>

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

          <div className="panel">
            <div className="panelHead">
              <div>
                <p className="sectionLabel">Live Records</p>
                <h2>Auto Renew Coverage</h2>
              </div>
              <span>Supabase</span>
            </div>

            <div className="recordList">
              {trees.length === 0 && subscriptions.length === 0 ? (
                <div className="emptyMini">No tree or subscription records found.</div>
              ) : (
                <>
                  {trees.slice(0, 6).map((tree) => (
                    <RecordRow
                      key={tree.id}
                      title={tree.tree_code || tree.display_name || "Tree"}
                      subtitle={tree.care_plan || tree.current_stage || "Tree record"}
                      active={Boolean(tree.auto_renew_enabled)}
                    />
                  ))}

                  {subscriptions.slice(0, 6).map((item) => (
                    <RecordRow
                      key={item.id}
                      title={item.care_program_name || item.plan_name || "Care Program"}
                      subtitle={item.tree_id || item.tree_code || "Subscription record"}
                      active={Boolean(item.auto_renew_enabled)}
                    />
                  ))}
                </>
              )}
            </div>
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
          max-width: 760px;
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
        .autoButtons button {
          width: 100%;
          border: 1px solid rgba(223, 171, 61, .24);
          border-radius: 17px;
          padding: 15px 16px;
          margin-top: 8px;
          background: rgba(255,255,255,.08);
          color: #ffe49a;
          font-weight: 1000;
          cursor: pointer;
        }

        .primaryButton:hover,
        .autoButtons button:hover,
        .heroActions button:hover,
        .heroActions a:hover {
          background: rgba(217, 165, 46, .18);
        }

        button:disabled {
          opacity: .48;
          cursor: not-allowed;
        }

        .statusCard {
          border-radius: 24px;
          padding: 20px;
          margin-bottom: 16px;
          border: 1px solid rgba(223, 171, 61, .22);
          background: linear-gradient(135deg, rgba(229, 173, 52, .22), rgba(255,255,255,.06));
        }

        .statusCard.off {
          background: linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.035));
        }

        .statusCard p {
          margin: 0 0 8px;
          color: rgba(255, 248, 221, .70);
          font-weight: 900;
        }

        .statusCard h3 {
          margin: 0 0 8px;
          color: #ffe49a;
          font-size: 42px;
          letter-spacing: -1px;
        }

        .statusCard small {
          color: rgba(255, 248, 221, .64);
          font-weight: 900;
        }

        .autoButtons,
        .infoRows {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }

        .infoRows div,
        .syncBox,
        .recordRow,
        .emptyMini {
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

        .infoRows strong,
        .syncBox strong,
        .recordRow strong {
          color: #fff5c3;
        }

        .syncBox p,
        .recordRow p,
        .emptyMini {
          margin: 7px 0 0;
          color: rgba(255, 248, 221, .62);
          line-height: 1.5;
          font-size: 13px;
          font-weight: 800;
        }

        .recordList {
          display: grid;
          gap: 10px;
        }

        .recordRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .recordRow span {
          border-radius: 999px;
          padding: 8px 11px;
          background: rgba(255,255,255,.08);
          color: rgba(255,248,221,.72);
          font-size: 11px;
          font-weight: 1000;
        }

        .recordRow span.on {
          background: rgba(217, 165, 46, .18);
          color: #ffe49a;
        }

        @media (max-width: 950px) {
          .hero {
            flex-direction: column;
            align-items: stretch;
          }

          .settingsGrid,
          .autoButtons,
          .infoRows {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function RecordRow({
  title,
  subtitle,
  active,
}: {
  title: string;
  subtitle: string;
  active: boolean;
}) {
  return (
    <div className="recordRow">
      <div>
        <strong>{title}</strong>
        <p>{subtitle}</p>
      </div>
      <span className={active ? "on" : ""}>{active ? "ON" : "OFF"}</span>
    </div>
  );
}