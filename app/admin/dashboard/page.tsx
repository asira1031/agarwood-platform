"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id?: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  kyc_status?: string | null;
  membership_status?: string | null;
  created_at?: string | null;
};

export default function AdminDashboard() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadProfiles() {
    setLoading(true);

    const { data, error } = await supabase.from("profiles").select("*");

    console.log("PROFILES DATA:", data);
    console.log("PROFILES ERROR:", error);

    if (error) {
      alert("Profiles query failed. Check Console.");
      setProfiles([]);
    } else {
      setProfiles(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadProfiles();
  }, []);

  const totalUsers = profiles.length;

  const pendingKyc = profiles.filter(
    (p) => p.kyc_status?.toUpperCase() === "PENDING"
  ).length;

  const pendingMembership = profiles.filter(
    (p) => p.membership_status?.toUpperCase() === "PENDING"
  );

  const activeMembers = profiles.filter(
    (p) => p.membership_status?.toUpperCase() === "APPROVED"
  ).length;

  return (
    <main className="min-h-screen bg-[#071f16] text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-[#d9b45f]">
            Agarwood Admin Dashboard
          </h1>
          <p className="text-white/70 mt-2">
            Manage KYC, memberships, and investor accounts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <Card title="Total Users" value={totalUsers} />
          <Card title="Pending KYC" value={pendingKyc} />
          <Card title="Pending Memberships" value={pendingMembership.length} />
          <Card title="Active Members" value={activeMembers} />
        </div>

        <section className="bg-white/10 border border-white/10 rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-[#d9b45f] mb-4">
            Profiles Debug Table
          </h2>

          {loading ? (
            <p className="text-white/70">Loading profiles...</p>
          ) : profiles.length === 0 ? (
            <p className="text-white/70">
              No profiles visible. Check Console for PROFILES ERROR.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/70">
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">KYC</th>
                    <th className="py-3 px-3">Membership</th>
                    <th className="py-3 px-3">Created</th>
                  </tr>
                </thead>

                <tbody>
                  {profiles.map((profile, index) => (
                    <tr
                      key={profile.id || index}
                      className="border-b border-white/10"
                    >
                      <td className="py-4 px-3">{profile.email || "NO EMAIL"}</td>
                      <td className="py-4 px-3">{profile.role || "NO ROLE"}</td>
                      <td className="py-4 px-3">
                        {profile.kyc_status || "NO KYC COLUMN/VALUE"}
                      </td>
                      <td className="py-4 px-3">
                        {profile.membership_status ||
                          "NO MEMBERSHIP COLUMN/VALUE"}
                      </td>
                      <td className="py-4 px-3">
                        {profile.created_at || "NO CREATED_AT"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-white/10 border border-white/10 rounded-2xl p-6">
      <p className="text-white/70">{title}</p>
      <h3 className="text-4xl font-bold text-[#d9b45f] mt-2">{value}</h3>
    </div>
  );
}