"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function KYCPage() {
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    id_type: "",
    id_number: "",
    source_of_funds: "",
    investment_experience: "",
    risk_acknowledged: false,
  });

  const [files, setFiles] = useState({
    id_front: null as File | null,
    id_back: null as File | null,
    selfie: null as File | null,
    proof: null as File | null,
  });

  async function uploadFile(file: File | null, folder: string, profileId: string) {
    if (!file) return null;

    const filePath = `${profileId}/${folder}/${Date.now()}-${file.name}`;

    const { error } = await supabase.storage
      .from("kyc-documents")
      .upload(filePath, file, { upsert: true });

    if (error) throw error;

    const { data } = supabase.storage
      .from("kyc-documents")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function submitKYC() {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        alert("Please login first.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", user.email)
        .single();

      if (profileError || !profile) {
        throw new Error("Profile not found. Please login again.");
      }

      const profileId = profile.id;

      if (!form.id_type || !form.id_number) {
        alert("Please complete ID type and ID number.");
        return;
      }

      if (!form.risk_acknowledged) {
        alert("Please acknowledge the investment risk.");
        return;
      }

      const idFrontUrl = await uploadFile(files.id_front, "id-front", profileId);
      const idBackUrl = await uploadFile(files.id_back, "id-back", profileId);
      const selfieUrl = await uploadFile(files.selfie, "selfie", profileId);
      const proofUrl = await uploadFile(files.proof, "proof-address", profileId);

      const { error: insertError } = await supabase.from("kyc_records").insert({
        profile_id: profileId,
        id_type: form.id_type,
        id_number: form.id_number,
        id_front_url: idFrontUrl,
        id_back_url: idBackUrl,
        selfie_url: selfieUrl,
        proof_of_address_url: proofUrl,
        source_of_funds: form.source_of_funds,
        investment_experience: form.investment_experience,
        risk_acknowledged: form.risk_acknowledged,
        status: "PENDING",
        submitted_at: new Date().toISOString(),
      });

      if (insertError) throw insertError;

      await supabase
        .from("profiles")
        .update({ kyc_status: "PENDING" })
        .eq("id", profileId);

      alert("KYC submitted successfully. Status: PENDING");
    } catch (error: any) {
      alert(error.message || "KYC submission failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#071f16] px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm uppercase tracking-[0.35em] text-[#d9b45f]">
          Agarwood Investor Trust Layer
        </p>

        <h1 className="mt-3 text-4xl font-bold">KYC Verification</h1>

        <p className="mt-3 max-w-2xl text-white/60">
          Submit your identity documents before activating membership and
          agarwood ownership access.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[32px] border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            <h2 className="mb-6 text-2xl font-semibold">Verification Form</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <select
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
                value={form.id_type}
                onChange={(e) => setForm({ ...form, id_type: e.target.value })}
              >
                <option value="">Select ID Type</option>
                <option value="Passport">Passport</option>
                <option value="National ID">National ID</option>
                <option value="Driver License">Driver License</option>
                <option value="UMID">UMID</option>
                <option value="PRC">PRC</option>
              </select>

              <input
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
                placeholder="ID Number"
                value={form.id_number}
                onChange={(e) =>
                  setForm({ ...form, id_number: e.target.value })
                }
              />

              <select
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
                value={form.source_of_funds}
                onChange={(e) =>
                  setForm({ ...form, source_of_funds: e.target.value })
                }
              >
                <option value="">Source of Funds</option>
                <option value="Employment">Employment</option>
                <option value="Business">Business</option>
                <option value="Investments">Investments</option>
                <option value="Savings">Savings</option>
                <option value="Inheritance">Inheritance</option>
                <option value="Other">Other</option>
              </select>

              <select
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
                value={form.investment_experience}
                onChange={(e) =>
                  setForm({
                    ...form,
                    investment_experience: e.target.value,
                  })
                }
              >
                <option value="">Investment Experience</option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
                <option value="Professional">Professional</option>
              </select>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <UploadBox
                label="Front of ID"
                onChange={(file) => setFiles({ ...files, id_front: file })}
              />
              <UploadBox
                label="Back of ID"
                onChange={(file) => setFiles({ ...files, id_back: file })}
              />
              <UploadBox
                label="Selfie Holding ID"
                onChange={(file) => setFiles({ ...files, selfie: file })}
              />
              <UploadBox
                label="Proof of Address"
                onChange={(file) => setFiles({ ...files, proof: file })}
              />
            </div>

            <label className="mt-8 flex gap-3 rounded-2xl border border-[#d9b45f]/20 bg-black/20 p-4 text-sm text-white/70">
              <input
                type="checkbox"
                checked={form.risk_acknowledged}
                onChange={(e) =>
                  setForm({
                    ...form,
                    risk_acknowledged: e.target.checked,
                  })
                }
              />
              I understand that agarwood ownership involves long-term
              agricultural risk and document-based verification.
            </label>

            <button
              onClick={submitKYC}
              disabled={loading}
              className="mt-8 w-full rounded-2xl bg-[#d9b45f] px-6 py-4 font-bold text-[#071f16] transition hover:scale-[1.01] disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit KYC Verification"}
            </button>
          </section>

          <aside className="rounded-[32px] border border-[#d9b45f]/30 bg-[#102d20] p-6 shadow-2xl">
            <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]">
              Trust Status
            </p>

            <h3 className="mt-3 text-2xl font-bold">Pending Review</h3>

            <p className="mt-3 text-sm text-white/60">
              After submission, the admin team can approve or reject your KYC
              documents.
            </p>

            <div className="mt-6 space-y-3 text-sm text-white/70">
              <div className="rounded-2xl bg-white/[0.05] p-4">
                ✓ Required before membership
              </div>
              <div className="rounded-2xl bg-white/[0.05] p-4">
                ✓ Required before forest ownership
              </div>
              <div className="rounded-2xl bg-white/[0.05] p-4">
                ✓ Stored in document vault
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function UploadBox({
  label,
  onChange,
}: {
  label: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="cursor-pointer rounded-3xl border border-dashed border-[#d9b45f]/40 bg-black/20 p-5 transition hover:border-[#d9b45f]">
      <p className="font-semibold">{label}</p>
      <p className="mt-1 text-xs text-white/50">Upload image or PDF</p>

      <input
        type="file"
        accept="image/*,.pdf"
        className="mt-4 block w-full text-sm text-white/60"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
    </label>
  );
}