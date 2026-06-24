"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type AuthMode = "login" | "register";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [adminInviteCode, setAdminInviteCode] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
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

    if (ref) setReferralCode(ref.trim());
    if (adminInvite) setAdminInviteCode(adminInvite.trim());
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

  async function routeLoggedInUser(cleanEmail: string) {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      setMessage("Login successful, but user session was not found.");
      setLoading(false);
      return;
    }

    const authUser = authData.user;
    const userEmail = authUser.email?.trim().toLowerCase() || cleanEmail;

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id,email,full_name")
      .eq("id", authUser.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id,email,full_name")
      .eq("email", userEmail)
      .maybeSingle();

    const profile = profileById || profileByEmail;

    if (!profile) {
      setMessage("Profile not found. Please contact support.");
      setLoading(false);
      return;
    }

    const { data: adminRow } = await supabase
      .from("admins")
      .select("id,admin_profile_id,email,status")
      .eq("email", userEmail)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (adminRow) {
      window.location.href = "/admin/dashboard";
      return;
    }

    const { data: caretakerRow } = await supabase
      .from("caretakers")
      .select("id,caretaker_profile_id,email,status")
      .eq("email", userEmail)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (caretakerRow) {
      window.location.href = "/gardener/dashboard";
      return;
    }

    window.location.href = "/dashboard";
  }

  async function handleLogin() {
    setLoading(true);
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setMessage("Please enter your email and password.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    await routeLoggedInUser(cleanEmail);
  }

  async function handleRegister() {
    setLoading(true);
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();
    const cleanReferralCode = referralCode.trim();

    if (!cleanName) {
      setMessage("Please enter your full name.");
      setLoading(false);
      return;
    }

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
        referred_by_code: cleanReferralCode || null,
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
        .select("id,email")
        .eq("referral_code", cleanReferralCode)
        .maybeSingle();

      if (
        referrerProfile?.id &&
        referrerProfile.email?.toLowerCase() !== cleanEmail
      ) {
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

  function switchMode(nextMode: AuthMode) {
    setMessage("");
    setMode(nextMode);
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#06180f] text-white"
      style={{
        backgroundImage:
          "linear-gradient(rgba(2,24,13,.18), rgba(2,24,13,.72)), url('/images/agarwood-real-tree.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-black/15 via-[#042412]/20 to-black/65" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        <div className="grid flex-1 items-center gap-8 lg:grid-cols-[1fr_0.98fr]">
          <section className="rounded-[1.75rem] border border-[#9bd346]/55 bg-[#062414]/60 p-6 shadow-[0_30px_80px_rgba(0,0,0,.35)] backdrop-blur-md sm:p-10 lg:p-12">
            <div className="mx-auto flex w-fit items-center gap-3 rounded-full border border-[#9bd346]/60 bg-[#061e11]/60 px-8 py-4 text-sm font-black tracking-wide text-white shadow-inner">
              <span className="text-[#a8e063]">🌿</span>
              ARGANWOOD PLATFORM
            </div>

            <div className="mt-14 text-center">
              <h1 className="font-serif text-6xl font-black leading-[0.95] text-white sm:text-7xl lg:text-8xl">
                Grow your
                <span className="block text-[#a8e063]">digital forest</span>
              </h1>

              <div className="mx-auto mt-9 flex max-w-md items-center justify-center gap-6 text-[#a8e063]">
                <div className="h-px flex-1 bg-[#a8e063]/70" />
                <span className="text-3xl">🌿</span>
                <div className="h-px flex-1 bg-[#a8e063]/70" />
              </div>

              <p className="mx-auto mt-9 max-w-xl text-xl leading-relaxed text-white/90">
                A premium tree ownership platform built around trust,
                verification, and milestone-based transparency.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              <Feature icon="🛡️" title="Secure & Verified" text="Identity-verified ownership" />
              <Feature icon="🌱" title="Milestone Based" text="Track growth and updates" />
              <Feature icon="🔒" title="Built on Trust" text="Transparent secure platform" />
            </div>

            <div className="mt-8 rounded-3xl border border-[#9bd346]/45 bg-[#061e11]/40 p-7 backdrop-blur">
              <h3 className="font-serif text-3xl font-black text-[#a8e063]">
                🌿 Our Mission
              </h3>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/90">
                To empower tree owners with digital tools that ensure
                transparency, growth, and lasting value for generations to come.
              </p>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/40 bg-white/95 p-7 text-[#0f2c1b] shadow-[0_30px_90px_rgba(0,0,0,.40)] backdrop-blur-md sm:p-10 lg:p-12">
            <div className="text-center">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#3f7d2a]">
                🔒 Secure Access
              </p>

              <h2 className="mt-8 font-serif text-5xl font-black text-[#10351f] sm:text-6xl">
                {mode === "login" ? "Welcome back" : "Create account"}
              </h2>

              <p className="mt-5 text-lg text-[#5e6d67]">
                {mode === "login"
                  ? "Login to enter your Arganwood portal."
                  : "Create your Arganwood customer account."}
              </p>
            </div>

            <div className="mt-10 grid grid-cols-2 overflow-hidden rounded-xl border border-[#d1d7d5] bg-white shadow-sm">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`py-4 text-base font-black transition ${
                  mode === "login"
                    ? "bg-[#005726] text-white"
                    : "bg-white text-[#0f2c1b] hover:bg-[#f2f7ef]"
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => switchMode("register")}
                className={`py-4 text-base font-black transition ${
                  mode === "register"
                    ? "bg-[#005726] text-white"
                    : "bg-white text-[#0f2c1b] hover:bg-[#f2f7ef]"
                }`}
              >
                Create Account
              </button>
            </div>

            <div className="mt-10 space-y-6">
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
                  <span className="font-black text-[#0f2c1b]">Full name</span>
                  <div className="mt-3 flex items-center gap-4 rounded-xl border border-[#d1d7d5] bg-white px-5 py-4 shadow-sm">
                    <span className="text-2xl text-[#77838a]">👤</span>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-transparent text-lg text-[#0f2c1b] outline-none placeholder:text-[#7b8790]"
                      placeholder="Your full name"
                    />
                  </div>
                </label>
              )}

              {mode === "register" && (
                <label className="block">
                  <span className="font-black text-[#0f2c1b]">Referral code optional</span>
                  <div className="mt-3 flex items-center gap-4 rounded-xl border border-[#d1d7d5] bg-white px-5 py-4 shadow-sm">
                    <span className="text-2xl text-[#77838a]">🎁</span>
                    <input
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.trim())}
                      className="w-full bg-transparent text-lg text-[#0f2c1b] outline-none placeholder:text-[#7b8790] disabled:cursor-not-allowed disabled:text-[#4f5b55]"
                      placeholder="Enter referral code if you have one"
                    />
                  </div>
                  <p className="mt-2 text-sm font-bold text-[#53645d]">
                    Referral links automatically fill this field. Manual code entry is also allowed.
                  </p>
                </label>
              )}

              <label className="block">
                <span className="font-black text-[#0f2c1b]">Email address</span>
                <div className="mt-3 flex items-center gap-4 rounded-xl border border-[#d1d7d5] bg-white px-5 py-4 shadow-sm">
                  <span className="text-2xl text-[#77838a]">✉️</span>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent text-lg text-[#0f2c1b] outline-none placeholder:text-[#7b8790]"
                    placeholder="email@example.com"
                  />
                </div>
              </label>

              <label className="block">
                <span className="font-black text-[#0f2c1b]">Password</span>
                <div className="mt-3 flex items-center gap-4 rounded-xl border border-[#d1d7d5] bg-white px-5 py-4 shadow-sm">
                  <span className="text-2xl text-[#77838a]">🔒</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent text-lg text-[#0f2c1b] outline-none placeholder:text-[#7b8790]"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="text-xl text-[#77838a]"
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </label>

              {mode === "login" && (
                <div className="flex items-center justify-between text-[#53645d]">
                  <label className="flex items-center gap-3">
                    <input
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      type="checkbox"
                      className="h-5 w-5 rounded border-[#aeb8b3]"
                    />
                    <span>Remember me</span>
                  </label>

                  <button type="button" className="font-bold text-[#176326]">
                    Need help?
                  </button>
                </div>
              )}

              {message && (
                <div className="rounded-2xl border border-[#dcc89c] bg-[#fff7df] p-4 text-sm font-bold text-[#38513b]">
                  {message}
                </div>
              )}

              <button
                onClick={mode === "login" ? handleLogin : handleRegister}
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-[#4b9f20] to-[#005726] py-5 text-lg font-black text-white shadow-xl transition hover:scale-[1.01] disabled:opacity-50"
              >
                🌿{" "}
                {loading
                  ? "Please wait..."
                  : mode === "login"
                    ? "Login"
                    : "Create account"}
              </button>
            </div>

            <div className="mt-9 flex gap-5 rounded-2xl border border-[#d9dfdc] bg-[#f8faf6] p-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#4b9f20] text-2xl">
                🛡️
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-[0.18em] text-[#3f7d2a]">
                  Trust First
                </h3>
                <p className="mt-3 leading-relaxed text-[#53645d]">
                  Ownership access requires verified identity and active
                  membership before portfolio actions are enabled.
                </p>
              </div>
            </div>

            <p className="mt-9 text-center text-[#53645d]">
              {mode === "login"
                ? "Don’t have an account?"
                : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => switchMode(mode === "login" ? "register" : "login")}
                className="font-black text-[#176326]"
              >
                {mode === "login" ? "Create account" : "Login"}
              </button>
            </p>
          </section>
        </div>

        <footer className="pt-8 text-center text-white/90">
          © 2025 Arganwood Platform. All rights reserved.
        </footer>
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
    <div className="rounded-2xl border border-[#9bd346]/45 bg-[#061e11]/35 p-5 text-center backdrop-blur">
      <div className="mx-auto flex h-20 w-20 items-center justify-center text-5xl text-[#a8e063]">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-black text-white">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-white/85">{text}</p>
    </div>
  );
}

function generateReferralCode(email: string) {
  const clean = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${clean.slice(0, 6)}-${suffix}`;
}