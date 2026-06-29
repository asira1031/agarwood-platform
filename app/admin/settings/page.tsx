"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type PlatformSettings = {
  id?: string | null;
  platform_fee_percent: number | string;
  withdrawal_fee_percent: number | string;
  tree_sale_fee_percent: number | string;
  auto_renew_enabled: boolean;
  support_email: string;
  support_mobile: string;
  updated_at?: string | null;
};

const DEFAULT_SETTINGS: PlatformSettings = {
  id: null,
  platform_fee_percent: 2,
  withdrawal_fee_percent: 2,
  tree_sale_fee_percent: 2,
  auto_renew_enabled: true,
  support_email: "support@arganwood.com",
  support_mobile: "",
  updated_at: null,
};

function formatDate(value?: string | null) {
  if (!value) return "Not synced yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not synced yet";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("platform_settings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      setMessage(`Settings read blocked or unavailable: ${error.message}. You can still save through RPC.`);
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }

    if (!data) {
      setMessage("No platform settings row found yet. Save once to create/update through RPC.");
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }

    setSettings({
      id: data.id,
      platform_fee_percent: data.platform_fee_percent ?? DEFAULT_SETTINGS.platform_fee_percent,
      withdrawal_fee_percent: data.withdrawal_fee_percent ?? DEFAULT_SETTINGS.withdrawal_fee_percent,
      tree_sale_fee_percent: data.tree_sale_fee_percent ?? DEFAULT_SETTINGS.tree_sale_fee_percent,
      auto_renew_enabled: Boolean(data.auto_renew_enabled),
      support_email: data.support_email || DEFAULT_SETTINGS.support_email,
      support_mobile: data.support_mobile || "",
      updated_at: data.updated_at || null,
    });

    setLoading(false);
  }

  function updateField<K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function saveSettings() {
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.rpc("update_platform_settings_rpc", {
        p_platform_fee_percent: Number(settings.platform_fee_percent || 0),
        p_withdrawal_fee_percent: Number(settings.withdrawal_fee_percent || 0),
        p_tree_sale_fee_percent: Number(settings.tree_sale_fee_percent || 0),
        p_auto_renew_enabled: Boolean(settings.auto_renew_enabled),
        p_support_email: settings.support_email || "support@arganwood.com",
        p_support_mobile: settings.support_mobile || "",
      });

      if (error) throw error;

      setMessage("Platform settings saved by RPC.");
      await loadSettings();
    } catch (error: any) {
      setMessage(error?.message || "Platform settings save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <section className="shell">
        <header className="hero">
          <div>
            <p className="eyebrow">Admin Control Center</p>
            <h1>Platform Settings</h1>
            <p>Manage platform fees, withdrawal fees, tree sale fees, auto-renew, and support contact details.</p>
          </div>

          <div className="headerActions">
            <button onClick={loadSettings} disabled={loading || saving}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button onClick={saveSettings} disabled={loading || saving}>
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </header>

        {message && <div className="message">{message}</div>}

        <section className="summary">
          <Stat label="Platform Fee" value={`${settings.platform_fee_percent || 0}%`} />
          <Stat label="Withdrawal Fee" value={`${settings.withdrawal_fee_percent || 0}%`} />
          <Stat label="Tree Sale Fee" value={`${settings.tree_sale_fee_percent || 0}%`} />
          <Stat label="Auto Renew" value={settings.auto_renew_enabled ? "Enabled" : "Disabled"} />
        </section>

        {loading ? (
          <div className="empty">Loading platform settings...</div>
        ) : (
          <section className="settingsGrid">
            <SettingCard title="Platform Fee %" text="Default platform fee for revenue-generating transactions.">
              <input
                type="number"
                min="0"
                step="0.01"
                value={settings.platform_fee_percent}
                onChange={(event) => updateField("platform_fee_percent", event.target.value)}
              />
            </SettingCard>

            <SettingCard title="Withdrawal Fee %" text="Processing fee deducted from withdrawal requests.">
              <input
                type="number"
                min="0"
                step="0.01"
                value={settings.withdrawal_fee_percent}
                onChange={(event) => updateField("withdrawal_fee_percent", event.target.value)}
              />
            </SettingCard>

            <SettingCard title="Tree Sale Fee %" text="Fee deducted when a customer sells a tree.">
              <input
                type="number"
                min="0"
                step="0.01"
                value={settings.tree_sale_fee_percent}
                onChange={(event) => updateField("tree_sale_fee_percent", event.target.value)}
              />
            </SettingCard>

            <SettingCard title="Auto Renew Enabled" text="Controls global care program auto-renew availability.">
              <select
                value={settings.auto_renew_enabled ? "true" : "false"}
                onChange={(event) => updateField("auto_renew_enabled", event.target.value === "true")}
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </SettingCard>

            <SettingCard title="Support Email" text="Primary customer support email.">
              <input
                value={settings.support_email || ""}
                onChange={(event) => updateField("support_email", event.target.value)}
                placeholder="support@arganwood.com"
              />
            </SettingCard>

            <SettingCard title="Support Mobile" text="Primary customer support mobile number.">
              <input
                value={settings.support_mobile || ""}
                onChange={(event) => updateField("support_mobile", event.target.value)}
                placeholder="+63..."
              />
            </SettingCard>

            <section className="syncCard">
              <p className="eyebrow">Sync Status</p>
              <h2>RPC Protected Settings</h2>
              <p>
                Saving uses update_platform_settings_rpc only. The frontend does not insert or update
                platform_settings directly.
              </p>
              <strong>Last Updated: {formatDate(settings.updated_at)}</strong>
            </section>
          </section>
        )}
      </section>

      <style>{styles}</style>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="stat">
      <p>{label}</p>
      <h3>{value}</h3>
    </article>
  );
}

function SettingCard({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="settingCard">
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="control">{children}</div>
    </section>
  );
}

const styles = `
* { box-sizing: border-box; }
.page { min-height: 100vh; padding: 28px; color: #f8f1d8; font-family: Arial, Helvetica, sans-serif; background: radial-gradient(circle at 18% 0%, rgba(214,178,94,.18), transparent 24%), linear-gradient(180deg, #06110d, #0b2117 52%, #06110d); }
.shell { max-width: 1350px; margin: 0 auto; border: 1px solid rgba(214,178,94,.18); background: rgba(255,255,255,.07); border-radius: 30px; padding: 24px; box-shadow: 0 26px 70px rgba(0,0,0,.32); }
.hero { display: flex; justify-content: space-between; gap: 18px; align-items: start; margin-bottom: 18px; }
.eyebrow { margin: 0 0 8px; color: #d6b25e; font-size: 12px; font-weight: 950; text-transform: uppercase; letter-spacing: .18em; }
h1, h2 { margin: 0; color: #fff8dc; }
h1 { font-size: 42px; color: #d6b25e; }
.hero p, .settingCard p, .syncCard p { color: rgba(248,241,216,.68); line-height: 1.55; }
.headerActions { display: flex; flex-wrap: wrap; gap: 10px; }
button, input, select { font-family: inherit; }
button { border: 0; border-radius: 999px; padding: 12px 16px; background: linear-gradient(135deg, #d6b25e, #8c6a3c); color: #07140f; font-weight: 950; cursor: pointer; }
button:disabled { opacity: .5; cursor: not-allowed; }
.message, .settingCard, .stat, .syncCard, .empty { border: 1px solid rgba(214,178,94,.16); background: rgba(0,0,0,.20); border-radius: 22px; }
.message, .empty { padding: 16px; margin-bottom: 16px; color: #ffe49a; font-weight: 900; }
.summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.stat { padding: 16px; }
.stat p { margin: 0; color: rgba(248,241,216,.58); font-size: 11px; font-weight: 950; text-transform: uppercase; letter-spacing: .12em; }
.stat h3 { margin-top: 8px; color: #d6b25e; font-size: 26px; }
.settingsGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.settingCard, .syncCard { padding: 20px; }
.settingCard h2 { color: #ffe49a; font-size: 22px; }
.control { margin-top: 16px; }
input, select { width: 100%; border: 1px solid rgba(214,178,94,.22); border-radius: 16px; padding: 13px 14px; background: rgba(0,0,0,.28); color: #fff8dc; outline: none; }
option { color: #07140f; }
.syncCard { grid-column: 1 / -1; background: radial-gradient(circle at 90% 10%, rgba(214,178,94,.15), transparent 30%), rgba(0,0,0,.24); }
.syncCard strong { display: block; margin-top: 12px; color: #d6b25e; }
@media (max-width: 900px) { .hero { display: grid; } .summary, .settingsGrid { grid-template-columns: 1fr; } }
`;
