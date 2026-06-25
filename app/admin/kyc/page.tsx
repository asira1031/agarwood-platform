"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type KYCRecord = {
  id: string;
  profile_id: string | null;
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

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  kyc_status: string | null;
};

type TabKey = "PENDING" | "HISTORY";

function normalize(value: any) {
  return String(value || "").trim().toUpperCase();
}

function badgeClass(value: string | null | undefined) {
  const status = normalize(value);

  if (status === "APPROVED") {
    return "border-emerald-400/30 bg-emerald-500/20 text-emerald-200";
  }

  if (status === "REJECTED") {
    return "border-red-400/30 bg-red-500/20 text-red-200";
  }

  return "border-yellow-400/30 bg-yellow-500/20 text-yellow-200";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function maskId(value: string | null | undefined) {
  if (!value) return "N/A";
  const clean = String(value).trim();
  if (clean.length <= 4) return "****";
  return `${"*".repeat(Math.max(clean.length - 4, 4))}${clean.slice(-4)}`;
}

export default function AdminKYCPage() {
  const [records, setRecords] = useState<KYCRecord[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<TabKey>("PENDING");
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    loadKYC();
  }, []);

  async function loadKYC() {
    setLoading(true);
    setMessage("");

    const { data: kycRows, error: kycError } = await supabase
      .from("kyc_records")
      .select(
        "id, profile_id, id_type, id_number, id_front_url, id_back_url, selfie_url, proof_of_address_url, source_of_funds, investment_experience, risk_acknowledged, status, review_notes, submitted_at, reviewed_at"
      )
      .order("submitted_at", { ascending: false });

    if (kycError) {
      setMessage(kycError.message);
      setRecords([]);
      setProfiles([]);
      setLoading(false);
      return;
    }

    const rows = (kycRows || []) as KYCRecord[];

    const profileIds = Array.from(
      new Set(rows.map((item) => item.profile_id).filter(Boolean))
    ) as string[];

    let profileRows: ProfileRow[] = [];

    if (profileIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, kyc_status")
        .in("id", profileIds);

      if (profileError) {
        setMessage(profileError.message);
      } else {
        profileRows = (profileData || []) as ProfileRow[];
      }
    }

    const nextNotes: Record<string, string> = {};
    rows.forEach((record) => {
      nextNotes[record.id] = record.review_notes || "";
    });

    setRecords(rows);
    setProfiles(profileRows);
    setNotes(nextNotes);
    setLoading(false);
  }

  const pendingRecords = useMemo(() => {
    return records.filter((record) => normalize(record.status || "PENDING") === "PENDING");
  }, [records]);

  const historyRecords = useMemo(() => {
    return records.filter((record) =>
      ["APPROVED", "REJECTED"].includes(normalize(record.status))
    );
  }, [records]);

  const approvedCount = records.filter((record) => normalize(record.status) === "APPROVED").length;
  const rejectedCount = records.filter((record) => normalize(record.status) === "REJECTED").length;

  function getProfile(profileId: string | null | undefined) {
    return profiles.find((profile) => profile.id === profileId) || null;
  }

  async function reviewKYC(record: KYCRecord, nextStatus: "APPROVED" | "REJECTED") {
    if (!record.id || !record.profile_id) {
      setMessage("Missing KYC record ID or profile ID.");
      return;
    }

    const note = notes[record.id] || "";

    if (nextStatus === "REJECTED" && !note.trim()) {
      setMessage("Review notes are required when rejecting KYC.");
      return;
    }

    const confirmed = window.confirm(
      nextStatus === "APPROVED"
        ? "Approve this KYC submission?"
        : "Reject this KYC submission?"
    );

    if (!confirmed) return;

    setWorkingId(record.id);
    setMessage("");

    const reviewedAt = new Date().toISOString();
    const finalNote =
      note.trim() ||
      (nextStatus === "APPROVED"
        ? "KYC approved by admin."
        : "KYC rejected by admin.");

    const { error: kycError } = await supabase
      .from("kyc_records")
      .update({
        status: nextStatus,
        review_notes: finalNote,
        reviewed_at: reviewedAt,
      })
      .eq("id", record.id);

    if (kycError) {
      setMessage(kycError.message);
      setWorkingId("");
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        kyc_status: nextStatus,
      })
      .eq("id", record.profile_id);

    if (profileError) {
      setMessage(profileError.message);
      setWorkingId("");
      return;
    }

    setMessage(`KYC ${nextStatus}. Record moved to KYC History.`);
    setWorkingId("");
    await loadKYC();
    setTab("PENDING");
  }

  const activeRecords = tab === "PENDING" ? pendingRecords : historyRecords;

  return (
    <main className="min-h-screen p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8 rounded-3xl border border-white/10 bg-[#071f16]/80 p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
              Agarwood Admin Trust Desk
            </p>

            <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
              KYC Review Center
            </h1>

            <p className="mt-2 text-white/70">
              Review customer KYC submissions from kyc_records. Approved and rejected
              records are retained in KYC History.
            </p>
          </div>

          <button
            onClick={loadKYC}
            disabled={loading}
            className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-5 py-3 text-sm font-semibold text-[#f7d774] hover:bg-[#d9b45f]/25 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh KYC"}
          </button>
        </div>

        {message && (
          <div className="rounded-2xl border border-[#d9b45f]/20 bg-[#d9b45f]/10 p-4 text-sm font-semibold text-[#ffe8a3]">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard label="Pending Review" value={String(pendingRecords.length)} />
          <StatCard label="Approved" value={String(approvedCount)} />
          <StatCard label="Rejected" value={String(rejectedCount)} />
          <StatCard label="Total Records" value={String(records.length)} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/10 p-5">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setTab("PENDING")}
              className={`rounded-full px-5 py-3 text-sm font-bold transition ${
                tab === "PENDING"
                  ? "bg-[#f7d774] text-[#071f16]"
                  : "bg-white/10 text-white hover:bg-white/15"
              }`}
            >
              Pending Review
            </button>

            <button
              onClick={() => setTab("HISTORY")}
              className={`rounded-full px-5 py-3 text-sm font-bold transition ${
                tab === "HISTORY"
                  ? "bg-[#f7d774] text-[#071f16]"
                  : "bg-white/10 text-white hover:bg-white/15"
              }`}
            >
              KYC History / Logs
            </button>
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-white/70">
            Loading KYC records...
          </div>
        ) : activeRecords.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-white/70">
            {tab === "PENDING"
              ? "No pending KYC submissions."
              : "No approved or rejected KYC history yet."}
          </div>
        ) : (
          <section className="space-y-5">
            {activeRecords.map((record) => {
              const profile = getProfile(record.profile_id);
              const status = normalize(record.status || "PENDING");
              const isPending = status === "PENDING";

              return (
                <div
                  key={record.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.06] p-6"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-bold text-[#ffe49a]">
                          {profile?.full_name || "Unknown Customer"}
                        </h2>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(
                            status
                          )}`}
                        >
                          {status}
                        </span>
                      </div>

                      <div className="text-sm text-white/65">
                        <p>
                          Email:{" "}
                          <b className="text-white">
                            {profile?.email || "No email"}
                          </b>
                        </p>

                        <p>
                          Profile ID:{" "}
                          <b className="text-white">
                            {record.profile_id || "Missing profile id"}
                          </b>
                        </p>

                        <p>
                          ID Type:{" "}
                          <b className="text-white">{record.id_type || "N/A"}</b>
                        </p>

                        <p>
                          ID Number:{" "}
                          <b className="text-white">{maskId(record.id_number)}</b>
                        </p>

                        <p>
                          Source of Funds:{" "}
                          <b className="text-white">
                            {record.source_of_funds || "N/A"}
                          </b>
                        </p>

                        <p>
                          Investment Experience:{" "}
                          <b className="text-white">
                            {record.investment_experience || "N/A"}
                          </b>
                        </p>

                        <p>
                          Risk Acknowledged:{" "}
                          <b className="text-white">
                            {record.risk_acknowledged ? "Yes" : "No"}
                          </b>
                        </p>

                        <p>
                          Submitted:{" "}
                          <b className="text-white">
                            {formatDate(record.submitted_at)}
                          </b>
                        </p>

                        {!isPending && (
                          <>
                            <p>
                              Reviewed:{" "}
                              <b className="text-white">
                                {formatDate(record.reviewed_at)}
                              </b>
                            </p>

                            <p>
                              Admin Notes:{" "}
                              <b className="text-white">
                                {record.review_notes || "N/A"}
                              </b>
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm md:grid-cols-2 lg:w-[520px]">
                      <DocLink label="ID Front" url={record.id_front_url} />
                      <DocLink label="ID Back" url={record.id_back_url} />
                      <DocLink label="Selfie" url={record.selfie_url} />
                      <DocLink
                        label="Proof of Address"
                        url={record.proof_of_address_url}
                      />
                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="text-sm font-bold text-white/70">
                      Admin Review Notes
                    </label>

                    <textarea
                      disabled={!isPending}
                      className="mt-2 min-h-[100px] w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white outline-none placeholder:text-white/40 disabled:opacity-70"
                      placeholder={
                        isPending
                          ? "Admin review notes..."
                          : "No notes recorded."
                      }
                      value={notes[record.id] || ""}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [record.id]: event.target.value,
                        }))
                      }
                    />
                  </div>

                  {isPending ? (
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={() => reviewKYC(record, "APPROVED")}
                        disabled={workingId === record.id}
                        className="rounded-2xl bg-emerald-500 px-5 py-3 font-bold text-white hover:bg-emerald-400 disabled:opacity-50"
                      >
                        {workingId === record.id ? "Working..." : "Approve"}
                      </button>

                      <button
                        onClick={() => reviewKYC(record, "REJECTED")}
                        disabled={workingId === record.id}
                        className="rounded-2xl bg-red-500 px-5 py-3 font-bold text-white hover:bg-red-400 disabled:opacity-50"
                      >
                        {workingId === record.id ? "Working..." : "Reject"}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl bg-black/20 p-4 text-sm text-white/65">
                      This record is already reviewed and stored in KYC History.
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

function DocLink({
  label,
  url,
}: {
  label: string;
  url: string | null | undefined;
}) {
  if (!url) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-white/40">
        {label}: Not uploaded
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="rounded-2xl border border-[#d9b45f]/30 bg-[#d9b45f]/10 p-3 text-[#d9b45f] transition hover:bg-[#d9b45f]/20"
    >
      View {label}
    </a>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
      <p className="text-sm text-white/70">{label}</p>
      <p className="mt-3 text-3xl font-bold text-[#d9b45f]">{value}</p>
    </div>
  );
}