    "use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type KYCRecord = {
  id: string;
  profile_id: string;
  id_type: string;
  id_number: string;
  id_front_url: string | null;
  id_back_url: string | null;
  selfie_url: string | null;
  proof_of_address_url: string | null;
  source_of_funds: string;
  investment_experience: string;
  risk_acknowledged: boolean;
  status: string;
  review_notes: string | null;
  submitted_at: string;
};

export default function AdminKYCPage() {
  const [records, setRecords] = useState<KYCRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function loadKYC() {
    setLoading(true);

    const { data, error } = await supabase
      .from("kyc_records")
      .select("*")
      .order("submitted_at", { ascending: false });

    if (error) {
      alert(error.message);
    } else {
      setRecords(data || []);
    }

    setLoading(false);
  }

  async function reviewKYC(id: string, profileId: string, status: "APPROVED" | "REJECTED") {
    const note = notes[id] || "";

    const { error: kycError } = await supabase
      .from("kyc_records")
      .update({
        status,
        review_notes: note,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (kycError) {
      alert(kycError.message);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ kyc_status: status })
      .eq("id", profileId);

    if (profileError) {
      alert(profileError.message);
      return;
    }

    alert(`KYC ${status}`);
    loadKYC();
  }

  useEffect(() => {
    loadKYC();
  }, []);

  return (
    <main className="min-h-screen bg-[#071f16] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm uppercase tracking-[0.35em] text-[#d9b45f]">
          Agarwood Admin Trust Desk
        </p>

        <h1 className="mt-3 text-4xl font-bold">KYC Review Queue</h1>

        <p className="mt-3 text-white/60">
          Review investor verification documents and approve or reject KYC status.
        </p>

        <div className="mt-8 rounded-[32px] border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          {loading ? (
            <p className="text-white/60">Loading KYC records...</p>
          ) : records.length === 0 ? (
            <p className="text-white/60">No KYC submissions yet.</p>
          ) : (
            <div className="space-y-6">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="rounded-3xl border border-white/10 bg-black/20 p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold">
                          {record.id_type || "Unknown ID"}
                        </h2>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            record.status === "APPROVED"
                              ? "bg-green-500/20 text-green-300"
                              : record.status === "REJECTED"
                              ? "bg-red-500/20 text-red-300"
                              : "bg-yellow-500/20 text-yellow-300"
                          }`}
                        >
                          {record.status}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-white/60">
                        ID Number: {record.id_number || "N/A"}
                      </p>

                      <p className="text-sm text-white/60">
                        Source of Funds: {record.source_of_funds || "N/A"}
                      </p>

                      <p className="text-sm text-white/60">
                        Experience: {record.investment_experience || "N/A"}
                      </p>

                      <p className="text-sm text-white/60">
                        Risk Acknowledged:{" "}
                        {record.risk_acknowledged ? "Yes" : "No"}
                      </p>

                      <p className="text-sm text-white/40">
                        Submitted:{" "}
                        {record.submitted_at
                          ? new Date(record.submitted_at).toLocaleString()
                          : "N/A"}
                      </p>
                    </div>

                    <div className="grid gap-2 text-sm md:grid-cols-2 lg:w-[420px]">
                      <DocLink label="ID Front" url={record.id_front_url} />
                      <DocLink label="ID Back" url={record.id_back_url} />
                      <DocLink label="Selfie" url={record.selfie_url} />
                      <DocLink
                        label="Proof of Address"
                        url={record.proof_of_address_url}
                      />
                    </div>
                  </div>

                  <textarea
                    className="mt-5 w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-sm outline-none"
                    placeholder="Admin review notes..."
                    value={notes[record.id] || record.review_notes || ""}
                    onChange={(e) =>
                      setNotes({ ...notes, [record.id]: e.target.value })
                    }
                  />

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() =>
                        reviewKYC(record.id, record.profile_id, "APPROVED")
                      }
                      className="rounded-2xl bg-green-500 px-5 py-3 font-bold text-white"
                    >
                      Approve
                    </button>

                    <button
                      onClick={() =>
                        reviewKYC(record.id, record.profile_id, "REJECTED")
                      }
                      className="rounded-2xl bg-red-500 px-5 py-3 font-bold text-white"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function DocLink({ label, url }: { label: string; url: string | null }) {
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
      className="rounded-2xl border border-[#d9b45f]/30 bg-[#d9b45f]/10 p-3 text-[#d9b45f] transition hover:bg-[#d9b45f]/20"
    >
      View {label}
    </a>
  );
}