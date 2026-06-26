"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "@/lib/supabase";

type Row = Record<string, any>;

type QrTagRow = {
  tree_id: string;
  customer_profile_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  group_id: string | null;
  forest_name: string | null;
  seedling_name: string | null;
  tree_code: string | null;
  tree_qr_code: string | null;
  tree_qr_url: string | null;
  purchase_date: string | null;
  created_at: string | null;
  qr_tag_status: string | null;
  qr_tag_status_label: string | null;
  qr_tag_printed_at: string | null;
  qr_tag_installed_at: string | null;
  qr_tag_installed_by: string | null;
  qr_tag_installed_by_name: string | null;
  qr_tag_install_photo_url: string | null;
};

type Filter = "ALL" | "PENDING_TAG" | "PRINTED" | "INSTALLED" | "VERIFIED";

function normalize(value: any) {
  return String(value || "").trim().replace(/\s+/g, "_").toUpperCase();
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function qrUrl(row: QrTagRow) {
  return row.tree_qr_url || `/tree/verify/${row.tree_id}`;
}

function qrValue(row: QrTagRow) {
  if (typeof window === "undefined") return qrUrl(row);
  return `${window.location.origin}${qrUrl(row)}`;
}

function qrTagLabel(status: string | null | undefined) {
  const value = normalize(status || "PENDING_TAG");

  if (value === "PENDING_TAG") return "QR tag pending installation";
  if (value === "PRINTED") return "QR tag printed, waiting installation";
  if (value === "INSTALLED") return "QR tag installed on tree";
  if (value === "VERIFIED") return "QR tag installed and verified";

  return "QR tag pending installation";
}

function statusClass(status: string | null | undefined) {
  const value = normalize(status || "PENDING_TAG");

  if (value === "VERIFIED") return "border-emerald-300/40 bg-emerald-500/20 text-emerald-100";
  if (value === "INSTALLED") return "border-blue-300/40 bg-blue-500/20 text-blue-100";
  if (value === "PRINTED") return "border-purple-300/40 bg-purple-500/20 text-purple-100";

  return "border-[#d9b45f]/40 bg-[#d9b45f]/15 text-[#ffe49a]";
}

export default function AdminQrTagsPage() {
  const [profile, setProfile] = useState<Row | null>(null);
  const [rows, setRows] = useState<QrTagRow[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [processingTreeId, setProcessingTreeId] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function resolveProfile() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      window.location.href = "/login";
      return null;
    }

    const email = user.email?.trim().toLowerCase() || "";

    const { data: byId } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const { data: byEmail } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", email)
      .maybeSingle();

    return byId || byEmail || null;
  }

  async function assertAdmin(currentProfile: Row) {
    const email = String(currentProfile.email || "").trim().toLowerCase();

    const { data: byProfile } = await supabase
      .from("admins")
      .select("id, admin_profile_id, status, email")
      .eq("admin_profile_id", currentProfile.id)
      .maybeSingle();

    if (byProfile && normalize(byProfile.status || "ACTIVE") === "ACTIVE") return true;

    const { data: byEmail } = await supabase
      .from("admins")
      .select("id, admin_profile_id, status, email")
      .ilike("email", email)
      .maybeSingle();

    return Boolean(byEmail && normalize(byEmail.status || "ACTIVE") === "ACTIVE");
  }

  async function loadData() {
    setLoading(true);
    setMessage("");

    const currentProfile = await resolveProfile();

    if (!currentProfile) {
      setLoading(false);
      setMessage("Profile not found.");
      return;
    }

    const isAdmin = await assertAdmin(currentProfile);

    if (!isAdmin) {
      setLoading(false);
      setMessage("Admin access not found.");
      return;
    }

    setProfile(currentProfile);

    const { data, error } = await supabase
      .from("v_tree_qr_tag_lifecycle")
      .select("*")
      .in("qr_tag_status", ["PENDING_TAG", "PRINTED", "INSTALLED", "VERIFIED"])
      .order("created_at", { ascending: true });

    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }

    setRows((data || []) as QrTagRow[]);
    setLoading(false);
  }

  const filteredRows = useMemo(() => {
    if (filter === "ALL") return rows.filter((row) => normalize(row.qr_tag_status) !== "VERIFIED");
    return rows.filter((row) => normalize(row.qr_tag_status || "PENDING_TAG") === filter);
  }, [rows, filter]);

  const stats = useMemo(() => {
    return {
      pending: rows.filter((row) => normalize(row.qr_tag_status) === "PENDING_TAG").length,
      printed: rows.filter((row) => normalize(row.qr_tag_status) === "PRINTED").length,
      installed: rows.filter((row) => normalize(row.qr_tag_status) === "INSTALLED").length,
      verified: rows.filter((row) => normalize(row.qr_tag_status) === "VERIFIED").length,
    };
  }, [rows]);

  async function updateTreeTagStatus(row: QrTagRow, status: "PRINTED" | "VERIFIED") {
    if (!profile || processingTreeId) return;

    setProcessingTreeId(row.tree_id);
    setMessage("");

    try {
      if (status === "PRINTED") {
        const { error } = await supabase.rpc("mark_tree_qr_tag_printed", {
          p_tree_id: row.tree_id,
          p_admin_profile_id: profile.id,
        });

        if (error) throw error;
      }

      if (status === "VERIFIED") {
        const { error } = await supabase.rpc("verify_tree_qr_tag_installed", {
          p_tree_id: row.tree_id,
          p_admin_profile_id: profile.id,
        });

        if (error) throw error;
      }

      setMessage(`${row.seedling_name || "Tree"} updated to ${status.replaceAll("_", " ")} via secure RPC.`);
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || "QR tag status update failed.");
    } finally {
      setProcessingTreeId("");
    }
  }

  return (
    <main className="min-h-screen bg-[#03130d] p-6 text-white md:p-8">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(217,180,95,0.20),transparent_32%),radial-gradient(circle_at_top_right,rgba(52,120,77,0.25),transparent_30%),linear-gradient(180deg,#082015,#03130d_48%,#010805)]" />

      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-7 shadow-2xl backdrop-blur-xl md:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-[#d9b45f]">Admin QR Tagging</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                Physical QR Tag Lifecycle
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/65">
                Print physical QR labels, track installation, and verify that each purchased tree has its QR tag installed in the field.
              </p>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-6 py-4 font-black text-[#f7d774] disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh QR Queue"}
            </button>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl border border-[#d9b45f]/25 bg-[#d9b45f]/10 p-4 text-sm font-bold text-[#ffe49a]">
              {message}
            </div>
          )}

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <Stat label="Pending Tag" value={stats.pending} />
            <Stat label="Printed" value={stats.printed} />
            <Stat label="Installed" value={stats.installed} />
            <Stat label="Verified" value={stats.verified} />
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-wrap gap-3">
            {([
              ["ALL", "Open Queue"],
              ["PENDING_TAG", "Pending Tag"],
              ["PRINTED", "Printed"],
              ["INSTALLED", "Installed"],
              ["VERIFIED", "Verified"],
            ] as Array<[Filter, string]>).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-full px-5 py-3 text-sm font-black transition ${
                  filter === key
                    ? "bg-[#d9b45f] text-[#071f16]"
                    : "border border-white/10 bg-white/10 text-white/70 hover:bg-white/15"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          {loading ? (
            <EmptyCard text="Loading QR tag lifecycle queue..." />
          ) : filteredRows.length === 0 ? (
            <EmptyCard text="No trees found in this QR tag view." />
          ) : (
            filteredRows.map((row) => (
              <article key={row.tree_id} className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
                <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(row.qr_tag_status)}`}>
                        {normalize(row.qr_tag_status || "PENDING_TAG").replaceAll("_", " ")}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-black text-white/55">
                        {qrTagLabel(row.qr_tag_status)}
                      </span>
                    </div>

                    <h2 className="mt-4 text-3xl font-black text-white">{row.seedling_name || "Seedling"}</h2>
                    <p className="mt-2 text-sm font-bold text-[#ffe49a]">{row.tree_code || "No tree code"}</p>

                    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <Info label="Owner" value={row.owner_name || row.owner_email || "Customer"} />
                      <Info label="Forest" value={row.forest_name || "Unnamed Forest"} />
                      <Info label="Purchase Date" value={formatDate(row.purchase_date || row.created_at)} />
                      <Info label="QR URL" value={qrUrl(row)} />
                      <Info label="Printed At" value={formatDate(row.qr_tag_printed_at)} />
                      <Info label="Installed At" value={formatDate(row.qr_tag_installed_at)} />
                      <Info label="Installed By" value={row.qr_tag_installed_by_name || "—"} />
                    </div>

                    {row.qr_tag_install_photo_url && (
                      <a
                        href={row.qr_tag_install_photo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-5 inline-flex rounded-2xl border border-[#d9b45f]/25 bg-[#d9b45f]/10 px-4 py-3 text-sm font-black text-[#ffe49a]"
                      >
                        Open Installation Proof Photo
                      </a>
                    )}
                  </div>

                  <aside className="rounded-3xl border border-white/10 bg-black/20 p-5">
                    <div className="grid place-items-center rounded-2xl bg-white p-4">
                      <QRCodeCanvas value={qrValue(row)} size={172} includeMargin />
                    </div>

                    <div className="mt-5 grid gap-3">
                      <Link
                        href={`/tree/qr-label/${row.tree_id}`}
                        target="_blank"
                        className="rounded-2xl bg-[#d9b45f] px-5 py-4 text-center text-sm font-black text-[#071f16]"
                      >
                        Print QR Label
                      </Link>

                      <button
                        type="button"
                        onClick={() => updateTreeTagStatus(row, "PRINTED")}
                        disabled={processingTreeId === row.tree_id || normalize(row.qr_tag_status) !== "PENDING_TAG"}
                        className="rounded-2xl border border-blue-300/25 bg-blue-500/10 px-5 py-4 text-sm font-black text-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Mark as Printed
                      </button>

                      <button
                        type="button"
                        onClick={() => updateTreeTagStatus(row, "VERIFIED")}
                        disabled={processingTreeId === row.tree_id || normalize(row.qr_tag_status) !== "INSTALLED"}
                        className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-5 py-4 text-sm font-black text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Verify Installed
                      </button>

                      <Link
                        href="/admin/operations"
                        className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-center text-sm font-black text-white/75"
                      >
                        Assign / Notify Gardener
                      </Link>
                    </div>
                  </aside>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-3 text-3xl font-black text-[#ffe49a]">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className="mt-2 break-words text-sm font-bold text-white/80">{value || "—"}</p>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-sm font-bold text-white/60 shadow-2xl backdrop-blur-xl">
      {text}
    </div>
  );
}
