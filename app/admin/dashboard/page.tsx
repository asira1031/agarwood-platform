"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id?: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  account_status?: string | null;
  kyc_status?: string | null;
  membership_status?: string | null;
  created_at?: string | null;
};

export default function AdminDashboard() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function loadProfiles() {
    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

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

  async function updateMembership(id: string | undefined, status: "ACTIVE" | "REJECTED") {
    if (!id) return;

    setUpdatingId(id);

    const { error } = await supabase
      .from("profiles")
      .update({
        membership_status: status,
        account_status: status === "ACTIVE" ? "ACTIVE" : "REJECTED",
      })
      .eq("id", id);

    if (error) {
      alert("Failed to update membership. Check Console.");
      console.error("UPDATE MEMBERSHIP ERROR:", error);
      setUpdatingId(null);
      return;
    }

    await loadProfiles();
    setUpdatingId(null);
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
    (p) => p.membership_status?.toUpperCase() === "ACTIVE"
  ).length;

  const approvedKyc = profiles.filter(
    (p) => p.kyc_status?.toUpperCase() === "APPROVED"
  ).length;

  return (
   <main className="min-h-screen text-white p-8">
     <div className="max-w-7xl mx-auto space-y-8 rounded-3xl bg-[#071f16]/75 p-8 backdrop-blur-md border border-white/10 shadow-2xl">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <SmallCard title="Approved KYC" value={approvedKyc} />
          <SmallCard title="System Status" value="Admin Online" />
        </div>

        <section className="bg-white/10 border border-white/10 rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-[#d9b45f] mb-4">
            Pending Membership Approval
          </h2>

          {loading ? (
            <p className="text-white/70">Loading memberships...</p>
          ) : pendingMembership.length === 0 ? (
            <p className="text-white/70">No pending membership requests.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/70">
                    <th className="py-3 px-3">Name</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">KYC</th>
                    <th className="py-3 px-3">Membership</th>
                    <th className="py-3 px-3">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {pendingMembership.map((profile, index) => (
                    <tr
                      key={profile.id || index}
                      className="border-b border-white/10"
                    >
                      <td className="py-4 px-3">
                        {profile.full_name || "No name"}
                      </td>
                      <td className="py-4 px-3">{profile.email || "No email"}</td>
                      <td className="py-4 px-3">{profile.phone || "No phone"}</td>
                      <td className="py-4 px-3">
                        {profile.kyc_status || "NONE"}
                      </td>
                      <td className="py-4 px-3">
                        {profile.membership_status || "NONE"}
                      </td>
                      <td className="py-4 px-3">
                        <div className="flex gap-2">
                          <button
                            disabled={updatingId === profile.id}
                            onClick={() =>
                              updateMembership(profile.id, "ACTIVE")
                            }
                            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold"
                          >
                            Approve
                          </button>

                          <button
                            disabled={updatingId === profile.id}
                            onClick={() =>
                              updateMembership(profile.id, "REJECTED")
                            }
                            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="bg-white/10 border border-white/10 rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-[#d9b45f] mb-4">
            Investor Accounts
          </h2>

          {loading ? (
            <p className="text-white/70">Loading profiles...</p>
          ) : profiles.length === 0 ? (
            <p className="text-white/70">No profiles visible.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/70">
                    <th className="py-3 px-3">Name</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Account</th>
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
                      <td className="py-4 px-3">
                        {profile.full_name || "No name"}
                      </td>
                      <td className="py-4 px-3">{profile.email || "No email"}</td>
                      <td className="py-4 px-3">{profile.role || "USER"}</td>
                      <td className="py-4 px-3">
                        <Badge value={profile.account_status || "NONE"} />
                      </td>
                      <td className="py-4 px-3">
                        <Badge value={profile.kyc_status || "NONE"} />
                      </td>
                      <td className="py-4 px-3">
                        <Badge value={profile.membership_status || "NONE"} />
                      </td>
                      <td className="py-4 px-3">
                        {profile.created_at
                          ? new Date(profile.created_at).toLocaleDateString()
                          : "No date"}
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

function SmallCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-white/10 border border-white/10 rounded-2xl p-5">
      <p className="text-white/70">{title}</p>
      <h3 className="text-2xl font-bold text-[#d9b45f] mt-2">{value}</h3>
    </div>
  );
}

function Badge({ value }: { value: string }) {
  const status = value.toUpperCase();

  const color =
    status === "ACTIVE" || status === "APPROVED"
      ? "bg-green-500/20 text-green-300 border-green-500/30"
      : status === "PENDING"
      ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
      : status === "REJECTED"
      ? "bg-red-500/20 text-red-300 border-red-500/30"
      : "bg-white/10 text-white/70 border-white/10";

  return (
    <span className={`px-3 py-1 rounded-full border text-xs font-semibold ${color}`}>
      {status}
    </span>
  );
}