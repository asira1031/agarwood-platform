"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [adminInviteCode, setAdminInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get("mode");
    const ref = params.get("ref");
    const adminInvite = params.get("admin_invite");

    if (urlMode === "register" || ref || adminInvite) {
      setMode("register");
    }

    if (ref) {
      setReferralCode(ref.trim());
    }

    if (adminInvite) {
      setAdminInviteCode(adminInvite.trim());
    }
  }, []);

  const inviteLabel = useMemo(() => {
    if (referralCode) return "Customer Referral Code";
    if (adminInviteCode) return "Admin Invite Code";
    return "";
  }, [referralCode, adminInviteCode]);

  const inviteValue = useMemo(() => {
    if (referralCode) return referralCode;
    if (adminInviteCode) return adminInviteCode;
    return "";
  }, [referralCode, adminInviteCode]);

  async function handleLogin() {
    setLoading(true);
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const user = data.user;
    const userEmail = user.email?.trim().toLowerCase() || cleanEmail;

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, role, email")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, role, email")
      .eq("email", userEmail)
      .maybeSingle();

    const profile = profileById || profileByEmail;
    const role = profile?.role?.trim().toUpperCase();

    if (role === "ADMIN") {
      window.location.href = "/admin/dashboard";
      return;
    }

    window.location.href = "/dashboard";
  }

  async function handleRegister() {
    setLoading(true);
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim() || "Agarwood Investor";
    const cleanReferralCode = referralCode.trim();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setMessage("Please enter a valid email address.");
      setLoading(false);
      return;
    }

    if (!password || password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const userId = data.user?.id;

    if (!userId) {
      setMessage("Account created. Please check your email before logging in.");
      setMode("login");
      setLoading(false);
      return;
    }

    const { data: existingProfileById } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    const { data: existingProfileByEmail } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    const existingProfile = existingProfileById || existingProfileByEmail;

    const newUserReferralCode = generateReferralCode(cleanEmail);

    if (!existingProfile) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        full_name: cleanName,
        email: cleanEmail,
        referral_code: newUserReferralCode,
        role: "CUSTOMER",
        account_status: "ACTIVE",
        verification_status: "PENDING",
      });

      if (profileError) {
        setMessage(profileError.message);
        setLoading(false);
        return;
      }
    }

    if (cleanReferralCode) {
      const { data: referrerProfile } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("referral_code", cleanReferralCode)
        .maybeSingle();

      if (referrerProfile?.id && referrerProfile.email?.toLowerCase() !== cleanEmail) {
        const { data: existingReferral } = await supabase
          .from("referrals")
          .select("id")
          .eq("referral_code", cleanReferralCode)
          .eq("referred_email", cleanEmail)
          .maybeSingle();

        if (!existingReferral) {
          await supabase.from("referrals").insert({
            referrer_profile_id: referrerProfile.id,
            referred_email: cleanEmail,
            referral_code: cleanReferralCode,
            qualified: false,
            reward_amount: 0,
            status: "PENDING",
          });
        }
      }
    }

    setMessage("Account created. Please login.");
    setMode("login");
    setLoading(false);
  }

  return (
    <main
      className="min-h-screen overflow-hidden bg-[#06180f] text-white"
      style={{
        backgroundImage:
          "linear-gradient(rgba(2, 24, 13, 0.35), rgba(2, 24, 13, 0.75)), url('/images/admin-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="min-h-screen backdrop-blur-[1px]">
        <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] border border-white/15 bg-[#062415]/55 p-8 shadow-2xl backdrop-blur-md lg:p-12">
            <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-bold tracking-wide">
              🌿 AGARWOOD PLATFORM
            </div>

            <h1 className="mt-14 max-w-2xl text-6xl font-black leading-tight text-white lg:text-7xl">
              Grow your
              <span className="block text-[#a8e063]">digital forest</span>
            </h1>

            <p className="mt-8 max-w-2xl text-xl leading-relaxed text-white/85">
              A premium agarwood ownership platform built around trust,
              verification, and milestone-based transparency.
            </p>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              <Feature icon="🛡️" title="Secure & Verified" text="Identity-verified ownership" />
              <Feature icon="🌱" title="Milestone Based" text="Track growth and updates" />
              <Feature icon="🔒" title="Built on Trust" text="Transparent secure platform" />
            </div>

            <div className="mt-12 rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur">
              <h3 className="text-lg font-bold text-[#bde986]">🌿 Our Mission</h3>
              <p className="mt-3 max-w-xl leading-relaxed text-white/85">
                To empower agarwood owners with digital tools that ensure
                transparency, growth, and lasting value for generations to come.
              </p>
            </div>
          </section>

          <section className="rounded-[2rem] bg-white/95 p-8 text-[#12351f] shadow-2xl backdrop-blur-md lg:p-12">
            <p className="text-sm font-black uppercase tracking-[0.35em] text-[#2d6b35]">
              🔒 Secure Access
            </p>

            <h2 className="mt-8 text-5xl font-black">
              {mode === "login" ? "Welcome back" : "Create account"}
            </h2>

            <p className="mt-4 text-[#667366]">
              {mode === "login"
                ? "Login to enter your agarwood ownership portal."
                : "Create your agarwood customer account."}
            </p>

            <div className="mt-10 space-y-5">
              {mode === "register" && inviteValue && (
                <div className="rounded-2xl border border-[#d7c69a] bg-[#fff7df] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-[#8a6a24]">
                    {inviteLabel}
                  </p>
                  <p className="mt-2 break-all text-lg font-black text-[#12351f]">
                    {inviteValue}
                  </p>
                </div>
              )}

              {mode === "register" && (
                <label className="block">
                  <span className="font-bold">Full name</span>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-[#cbd8c7] bg-white px-5 py-4 outline-none"
                    placeholder="Your full name"
                  />
                </label>
              )}

              <label className="block">
                <span className="font-bold">Email address</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#cbd8c7] bg-white px-5 py-4 outline-none"
                  placeholder="email@example.com"
                />
              </label>

              <label className="block">
                <span className="font-bold">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#cbd8c7] bg-white px-5 py-4 outline-none"
                  placeholder="••••••••"
                />
              </label>

              {message && (
                <div className="rounded-2xl bg-[#f4ead0] p-4 text-sm font-bold text-[#38513b]">
                  {message}
                </div>
              )}

              <button
                onClick={mode === "login" ? handleLogin : handleRegister}
                disabled={loading}
                className="w-full rounded-2xl bg-[#176326] py-5 text-lg font-black text-white shadow-xl hover:bg-[#0f4f1c] disabled:opacity-50"
              >
                🌿 {loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
              </button>
            </div>

            <div className="mt-8 flex items-center justify-between font-bold text-[#315f32]">
              <button
                onClick={() => {
                  setMessage("");
                  setMode(mode === "login" ? "register" : "login");
                }}
              >
                {mode === "login" ? "Create account" : "Back to login"}
              </button>

              <button>Need help?</button>
            </div>

            <div className="mt-10 rounded-3xl bg-[#f4f8ec] p-6">
              <h3 className="font-black tracking-[0.25em] text-[#2d6b35]">
                TRUST FIRST
              </h3>
              <p className="mt-3 leading-relaxed text-[#667366]">
                Ownership access requires verified identity and active membership
                before portfolio actions are enabled.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-white/15 bg-white/10 p-5 text-center backdrop-blur">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/15 text-3xl">
        {icon}
      </div>
      <h3 className="mt-4 font-black">{title}</h3>
      <p className="mt-2 text-sm text-white/75">{text}</p>
    </div>
  );
}

function generateReferralCode(email: string) {
  const clean = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${clean.slice(0, 6)}-${suffix}`;
}