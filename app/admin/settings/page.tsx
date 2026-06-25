"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type PlatformSettings = {
  id: string;
  platform_fee_percent: number | string;
  withdrawal_fee_percent: number | string;
  tree_sale_fee_percent: number | string;
  auto_renew_enabled: boolean;
  support_email: string;
  support_mobile: string;
  updated_at?: string | null;
};

const DEFAULT_SETTINGS = {
  platform_fee_percent: 2,
  withdrawal_fee_percent: 2,
  tree_sale_fee_percent: 2,
  auto_renew_enabled: true,
  support_email: "support@arganwood.com",
  support_mobile: "",
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
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
      .order("updated_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (!data) {
      const { data: inserted, error: insertError } = await supabase
        .from("platform_settings")
        .insert({
          ...DEFAULT_SETTINGS,
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (insertError) {
        setMessage(insertError.message);
        setLoading(false);
        return;
      }

      setSettings(inserted);
      setLoading(false);
      return;
    }

    setSettings(data);
    setLoading(false);
  }

  function updateField<K extends keyof PlatformSettings>(
    key: K,
    value: PlatformSettings[K]
  ) {
    setSettings((current) => {
      if (!current) return current;
      return {
        ...current,
        [key]: value,
      };
    });
  }

  async function saveSettings() {
    if (!settings?.id) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("platform_settings")
      .update({
        platform_fee_percent: Number(settings.platform_fee_percent || 0),
        withdrawal_fee_percent: Number(settings.withdrawal_fee_percent || 0),
        tree_sale_fee_percent: Number(settings.tree_sale_fee_percent || 0),
        auto_renew_enabled: Boolean(settings.auto_renew_enabled),
        support_email: settings.support_email || "support@arganwood.com",
        support_mobile: settings.support_mobile || "",
        updated_at: new Date().toISOString(),
      })
      .eq("id", settings.id);

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setMessage("Platform settings saved.");
    setSaving(false);
    await loadSettings();
  }

  return (
    <main className="min-h-screen p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8 rounded-3xl border border-white/10 bg-[#071f16]/80 p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
              Admin Control Center
            </p>

            <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
              Platform Settings
            </h1>

            <p className="mt-2 text-white/70">
              Manage platform fees, withdrawal fees, tree sale fees, auto-renew,
              and support contact details.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadSettings}
              disabled={loading || saving}
              className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-5 py-3 text-sm font-semibold text-[#f7d774] hover:bg-[#d9b45f]/25 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={saveSettings}
              disabled={loading || saving || !settings}
              className="rounded-2xl bg-[#d9b45f] px-5 py-3 text-sm font-black text-[#071f16] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>

        {message && (
          <div className="rounded-2xl border border-[#d9b45f]/20 bg-[#d9b45f]/10 p-4 text-sm font-semibold text-[#ffe8a3]">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-white/70">
            Loading platform settings...
          </div>
        ) : !settings ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-8 text-red-100">
            Unable to load platform settings.
          </div>
        ) : (
          <section className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-xl font-bold text-[#ffe49a]">
                Platform Fee %
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Default platform fee for revenue-generating transactions.
              </p>
              <input
                type="number"
                min="0"
                step="0.01"
                value={settings.platform_fee_percent}
                onChange={(e) =>
                  updateField("platform_fee_percent", e.target.value)
                }
                className="mt-5 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
              />
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-xl font-bold text-[#ffe49a]">
                Withdrawal Fee %
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Processing fee deducted from withdrawal requests.
              </p>
              <input
                type="number"
                min="0"
                step="0.01"
                value={settings.withdrawal_fee_percent}
                onChange={(e) =>
                  updateField("withdrawal_fee_percent", e.target.value)
                }
                className="mt-5 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
              />
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-xl font-bold text-[#ffe49a]">
                Tree Sale Fee %
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Fee deducted when a customer sells a tree.
              </p>
              <input
                type="number"
                min="0"
                step="0.01"
                value={settings.tree_sale_fee_percent}
                onChange={(e) =>
                  updateField("tree_sale_fee_percent", e.target.value)
                }
                className="mt-5 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
              />
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-xl font-bold text-[#ffe49a]">
                Auto Renew Enabled
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Controls global care program auto-renew availability.
              </p>
              <select
                value={settings.auto_renew_enabled ? "true" : "false"}
                onChange={(e) =>
                  updateField("auto_renew_enabled", e.target.value === "true")
                }
                className="mt-5 w-full rounded-xl border border-white/10 bg-[#071f16] px-4 py-3 text-white outline-none"
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-xl font-bold text-[#ffe49a]">
                Support Email
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Primary customer support email.
              </p>
              <input
                value={settings.support_email || ""}
                onChange={(e) => updateField("support_email", e.target.value)}
                className="mt-5 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                placeholder="support@arganwood.com"
              />
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-xl font-bold text-[#ffe49a]">
                Support Mobile
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Primary customer support mobile number.
              </p>
              <input
                value={settings.support_mobile || ""}
                onChange={(e) => updateField("support_mobile", e.target.value)}
                className="mt-5 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                placeholder="+63..."
              />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}