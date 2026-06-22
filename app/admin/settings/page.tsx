"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type SettingRow = Record<string, any>;

const DEFAULT_SETTINGS = [
  {
    key: "platform_fee_percent",
    label: "Platform Fee %",
    value: "2",
    description: "Default platform fee for sell tree, operations, and marketplace revenue.",
  },
  {
    key: "withdrawal_fee_percent",
    label: "Withdrawal Fee %",
    value: "2",
    description: "Default withdrawal processing fee.",
  },
  {
    key: "tree_sale_fee_percent",
    label: "Tree Sale Fee %",
    value: "2",
    description: "Fee deducted when customer sells a tree.",
  },
  {
    key: "auto_renew_enabled",
    label: "Auto Renew Enabled",
    value: "false",
    description: "Controls care program auto-renew display and future automation.",
  },
  {
    key: "support_email",
    label: "Support Email",
    value: "support@arganwood.com",
    description: "Primary customer support email.",
  },
  {
    key: "support_mobile",
    label: "Support Mobile",
    value: "",
    description: "Primary customer support mobile number.",
  },
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("admin_settings")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(
        "admin_settings table not found or not readable. Create the table first if needed."
      );
      setRows([]);
      const fallback: Record<string, string> = {};
      DEFAULT_SETTINGS.forEach((item) => {
        fallback[item.key] = item.value;
      });
      setSettings(fallback);
      setLoading(false);
      return;
    }

    const nextSettings: Record<string, string> = {};

    DEFAULT_SETTINGS.forEach((item) => {
      const found = (data || []).find(
        (row) =>
          row.setting_key === item.key ||
          row.key === item.key ||
          row.name === item.key
      );

      nextSettings[item.key] = String(
        found?.setting_value ?? found?.value ?? item.value
      );
    });

    setRows(data || []);
    setSettings(nextSettings);
    setLoading(false);
  }

  async function saveSetting(item: (typeof DEFAULT_SETTINGS)[number]) {
    setSavingKey(item.key);
    setMessage("");

    const value = settings[item.key] ?? "";

    const existing = rows.find(
      (row) =>
        row.setting_key === item.key ||
        row.key === item.key ||
        row.name === item.key
    );

    if (existing?.id) {
      const { error } = await supabase
        .from("admin_settings")
        .update({
          setting_value: value,
          value,
          description: item.description,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) {
        setMessage(error.message);
        setSavingKey("");
        return;
      }
    } else {
      const { error } = await supabase.from("admin_settings").insert({
        setting_key: item.key,
        setting_value: value,
        key: item.key,
        value,
        description: item.description,
      });

      if (error) {
        setMessage(error.message);
        setSavingKey("");
        return;
      }
    }

    setMessage(`${item.label} saved.`);
    setSavingKey("");
    await loadSettings();
  }

  async function saveAll() {
    setMessage("");

    for (const item of DEFAULT_SETTINGS) {
      await saveSetting(item);
    }

    setMessage("All settings saved.");
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
              Manage fee percentages, support contact info, and auto-renew controls.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadSettings}
              disabled={loading}
              className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-5 py-3 text-sm font-semibold text-[#f7d774] hover:bg-[#d9b45f]/25 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={saveAll}
              disabled={loading}
              className="rounded-2xl bg-[#d9b45f] px-5 py-3 text-sm font-black text-[#071f16] disabled:opacity-50"
            >
              Save All
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
            Loading settings...
          </div>
        ) : (
          <section className="grid gap-5 lg:grid-cols-2">
            {DEFAULT_SETTINGS.map((item) => {
              const isBoolean = item.key.includes("enabled");

              return (
                <div
                  key={item.key}
                  className="rounded-3xl border border-white/10 bg-white/[0.06] p-6"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-[#ffe49a]">
                        {item.label}
                      </h2>
                      <p className="mt-2 text-sm text-white/60">
                        {item.description}
                      </p>
                      <p className="mt-2 text-xs text-white/40">
                        Key: {item.key}
                      </p>
                    </div>

                    <button
                      onClick={() => saveSetting(item)}
                      disabled={savingKey === item.key}
                      className="rounded-xl bg-[#d9b45f] px-4 py-2 text-sm font-black text-[#071f16] disabled:opacity-50"
                    >
                      {savingKey === item.key ? "Saving..." : "Save"}
                    </button>
                  </div>

                  {isBoolean ? (
                    <select
                      value={settings[item.key] || item.value}
                      onChange={(e) =>
                        setSettings((current) => ({
                          ...current,
                          [item.key]: e.target.value,
                        }))
                      }
                      className="mt-5 w-full rounded-xl border border-white/10 bg-[#071f16] px-4 py-3 text-white outline-none"
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : (
                    <input
                      value={settings[item.key] || ""}
                      onChange={(e) =>
                        setSettings((current) => ({
                          ...current,
                          [item.key]: e.target.value,
                        }))
                      }
                      className="mt-5 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                      placeholder={item.value}
                    />
                  )}
                </div>
              );
            })}
          </section>
        )}

        <section className="rounded-3xl border border-[#d9b45f]/20 bg-[#d9b45f]/10 p-6">
          <h2 className="text-xl font-bold text-[#ffe49a]">
            SQL Note
          </h2>

          <p className="mt-2 text-sm text-white/70">
            If this page shows admin_settings table not found, create that table first.
          </p>

          <pre className="mt-4 overflow-auto rounded-2xl bg-black/30 p-4 text-xs text-white/70">
{`create table if not exists admin_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text unique,
  setting_value text,
  key text,
  value text,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);`}
          </pre>
        </section>
      </div>
    </main>
  );
}