"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  referral_code: string | null;
  referred_by_code: string | null;
  membership_status: string | null;
  created_at: string | null;
};

export default function AdminReferralLinksPage() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorText("");

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email, referral_code, referred_by_code, membership_status, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setErrorText(error.message);
      setProfiles([]);
      setLoading(false);
      return;
    }

    setProfiles((data || []) as ProfileRow[]);
    setLoading(false);
  }

  function formatDate(value: string | null) {
    if (!value) return "—";

    return new Date(value).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function badgeClass(value: string | null) {
    const status = String(value || "INACTIVE").toUpperCase();

    if (status === "ACTIVE") {
      return "border-emerald-400/30 bg-emerald-500/20 text-emerald-200";
    }

    if (status === "PENDING") {
      return "border-yellow-400/30 bg-yellow-500/20 text-yellow-200";
    }

    if (status === "INACTIVE" || status === "REJECTED") {
      return "border-red-400/30 bg-red-500/20 text-red-200";
    }

    return "border-white/10 bg-white/10 text-white/60";
  }

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLowerCase();

    return profiles.filter((profile) => {
      return (
        !query ||
        String(profile.full_name || "").toLowerCase().includes(query) ||
        String(profile.email || "").toLowerCase().includes(query) ||
        String(profile.referral_code || "").toLowerCase().includes(query) ||
        String(profile.referred_by_code || "").toLowerCase().includes(query)
      );
    });
  }, [profiles, search]);

  const totalCodes = profiles.filter((profile) => profile.referral_code).length;

  const referredUsers = profiles.filter(
    (profile) => profile.referred_by_code
  ).length;

  const activeMembers = profiles.filter(
    (profile) =>
      String(profile.membership_status || "").toUpperCase() === "ACTIVE"
  ).length;

  async function copyLink(code: string | null) {
    if (!code) return;

    const referralLink = `${window.location.origin}/login?mode=register&ref=${code}`;

    await navigator.clipboard.writeText(referralLink);

    alert("Referral link copied.");
  }

  return (
    <main className="min-h-screen p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8 rounded-3xl border border-white/10 bg-[#071f16]/80 p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
              Admin Referral Center
            </p>

            <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
              Referral Links
            </h1>

            <p className="mt-2 text-white/70">
              Monitor customer referral codes and copy the same registration
              route used by Customer Referrals.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-5 py-3 text-sm font-semibold text-[#f7d774] hover:bg-[#d9b45f]/25 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {errorText && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
            {errorText}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Profiles With Referral Code"
            value={String(totalCodes)}
          />

          <StatCard
            label="Referred Registrations"
            value={String(referredUsers)}
          />

          <StatCard label="Active Members" value={String(activeMembers)} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/10 p-5">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, referral code, referred by..."
            className="w-full rounded-xl border border-white/10 bg-[#071f16]/70 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/10">
          {loading ? (
            <div className="p-8 text-white/70">Loading referral records...</div>
          ) : filteredProfiles.length === 0 ? (
            <div className="p-8 text-white/70">No referral records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="bg-[#071f16]/80 text-white/70">
                  <tr>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Referral Code</th>
                    <th className="px-5 py-4">Referral Link</th>
                    <th className="px-5 py-4">Referred By</th>
                    <th className="px-5 py-4">Membership</th>
                    <th className="px-5 py-4">Created</th>
                    <th className="px-5 py-4">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProfiles.map((profile) => {
                    const referralLink = profile.referral_code
                      ? `${
                          typeof window !== "undefined"
                            ? window.location.origin
                            : ""
                        }/login?mode=register&ref=${profile.referral_code}`
                      : "—";

                    return (
                      <tr
                        key={profile.id}
                        className="border-t border-white/10 hover:bg-white/5"
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-white">
                            {profile.full_name || "Unknown Customer"}
                          </div>

                          <div className="mt-1 text-xs text-white/50">
                            {profile.email || "No email"}
                          </div>
                        </td>

                        <td className="px-5 py-4 font-bold text-[#f7d774]">
                          {profile.referral_code || "—"}
                        </td>

                        <td className="px-5 py-4 text-white/70">
                          <div className="max-w-[360px] truncate">
                            {referralLink}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-white/70">
                          {profile.referred_by_code || "—"}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(
                              profile.membership_status
                            )}`}
                          >
                            {String(
                              profile.membership_status || "INACTIVE"
                            ).toUpperCase()}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-white/70">
                          {formatDate(profile.created_at)}
                        </td>

                        <td className="px-5 py-4">
                          <button
                            onClick={() => copyLink(profile.referral_code)}
                            disabled={!profile.referral_code}
                            className="rounded-xl bg-[#d9b45f]/20 px-4 py-2 text-xs font-bold text-[#f7d774] hover:bg-[#d9b45f]/30 disabled:opacity-40"
                          >
                            Copy Link
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
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