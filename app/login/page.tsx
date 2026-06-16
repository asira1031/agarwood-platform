"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Mode = "login" | "register" | "registerOtp" | "forgot" | "forgotOtp" | "reset";
type Notice = { type: "success" | "error" | "info"; text: string } | null;

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registerOtp, setRegisterOtp] = useState("");

  const [forgotIdentity, setForgotIdentity] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);

  const eyeMove = useMemo(() => {
    const x = Math.max(-4, Math.min(4, mouse.x / 95));
    const y = Math.max(-3, Math.min(3, mouse.y / 95));
    return { transform: `translate(${x}px, ${y}px)` };
  }, [mouse]);

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setTimeout(() => {
      setCooldown((current) => current - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [cooldown]);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();

    setMouse({
      x: e.clientX - rect.left - rect.width / 2,
      y: e.clientY - rect.top - rect.height / 2,
    });
  }

  function go(nextMode: Mode) {
    setNotice(null);
    setLoading(false);
    setMode(nextMode);
  }

  function maskEmail(email: string) {
    const [name, domain] = email.split("@");
    if (!name || !domain) return email;
    return `${name.slice(0, 1)}***@${domain}`;
  }

  async function sendRegisterOtp() {
    setNotice(null);

    const email = registerEmail.trim().toLowerCase();
    const phone = registerPhone.trim();

    if (!fullName.trim() || !email || !phone || !registerPassword || !confirmPassword) {
      setNotice({ type: "error", text: "Please complete all registration fields." });
      return;
    }

    if (!email.includes("@") || !email.includes(".")) {
      setNotice({ type: "error", text: "Please enter a valid email address." });
      return;
    }

    if (registerPassword.length < 6) {
      setNotice({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }

    if (registerPassword !== confirmPassword) {
      setNotice({ type: "error", text: "Passwords do not match." });
      return;
    }

    setLoading(true);

    const { data: emailExists } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (emailExists) {
      setLoading(false);
      setNotice({ type: "error", text: "Email address is already registered." });
      return;
    }

    const { data: phoneExists } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (phoneExists) {
      setLoading(false);
      setNotice({ type: "error", text: "Phone number is already registered." });
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    setLoading(false);

    if (error) {
      setNotice({ type: "error", text: error.message });
      return;
    }

    setCooldown(10);
    setNotice({ type: "success", text: "OTP sent to your email." });
    setMode("registerOtp");
  }

  async function verifyRegisterOtp() {
    setNotice(null);

    const email = registerEmail.trim().toLowerCase();

    if (!registerOtp.trim()) {
      setNotice({ type: "error", text: "Please enter the OTP code." });
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: registerOtp.trim(),
      type: "email",
    });

    if (error || !data.user) {
      setLoading(false);
      setNotice({ type: "error", text: "Invalid OTP. Please try again." });
      return;
    }

    const passwordResult = await supabase.auth.updateUser({
      password: registerPassword,
    });

    if (passwordResult.error) {
      setLoading(false);
      setNotice({ type: "error", text: passwordResult.error.message });
      return;
    }

    const profileResult = await supabase.from("profiles").insert({
      id: data.user.id,
      full_name: fullName.trim(),
      email,
      phone: registerPhone.trim(),
      phone_verified: false,
    });

    setLoading(false);

    if (profileResult.error) {
      setNotice({ type: "error", text: profileResult.error.message });
      return;
    }

    setNotice({ type: "success", text: "Account created successfully. You may now login." });
    setMode("login");
  }

  async function resendRegisterOtp() {
    if (cooldown > 0) return;
    await sendRegisterOtp();
  }

  async function login() {
    setNotice(null);

    if (!loginEmail.trim() || !loginPassword) {
      setNotice({ type: "error", text: "Please enter your email and password." });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim().toLowerCase(),
      password: loginPassword,
    });

    setLoading(false);

    if (error) {
      setNotice({ type: "error", text: "Invalid email or password." });
      return;
    }

    setNotice({ type: "success", text: "Login successful." });
  }

  async function sendForgotOtp() {
    setNotice(null);
    setOtpVerified(false);

    const value = forgotIdentity.trim().toLowerCase();

    if (!value) {
      setNotice({ type: "error", text: "Please enter your email or phone number." });
      return;
    }

    const isEmail = value.includes("@");
    const isPhone = /^[0-9+ ]+$/.test(value);

    setLoading(true);

    if (isEmail) {
      const { data } = await supabase
        .from("profiles")
        .select("email")
        .eq("email", value)
        .maybeSingle();

      if (!data?.email) {
        setLoading(false);
        setNotice({ type: "error", text: "Email address is not registered." });
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: data.email,
        options: {
          shouldCreateUser: false,
        },
      });

      setLoading(false);

      if (error) {
        setNotice({ type: "error", text: error.message });
        return;
      }

      setForgotEmail(data.email);
      setCooldown(10);
      setNotice({ type: "success", text: "OTP sent to your registered email." });
      setMode("forgotOtp");
      return;
    }

    if (isPhone) {
      const { data } = await supabase
        .from("profiles")
        .select("email, phone_verified")
        .eq("phone", value)
        .maybeSingle();

      if (!data) {
        setLoading(false);
        setNotice({ type: "error", text: "Phone number is not registered." });
        return;
      }

      if (!data.phone_verified) {
        setLoading(false);
        setNotice({
          type: "error",
          text: "Phone number is not verified. Please use your registered email.",
        });
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: data.email,
        options: {
          shouldCreateUser: false,
        },
      });

      setLoading(false);

      if (error) {
        setNotice({ type: "error", text: error.message });
        return;
      }

      setForgotEmail(data.email);
      setCooldown(10);
      setNotice({ type: "success", text: "OTP sent to your verified recovery account." });
      setMode("forgotOtp");
      return;
    }

    setLoading(false);
    setNotice({ type: "error", text: "Email or phone number is not registered." });
  }

  async function verifyForgotOtp() {
    setNotice(null);

    if (!forgotEmail || !forgotOtp.trim()) {
      setNotice({ type: "error", text: "Please enter the OTP code." });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.verifyOtp({
      email: forgotEmail,
      token: forgotOtp.trim(),
      type: "email",
    });

    setLoading(false);

    if (error) {
      setNotice({ type: "error", text: "Invalid OTP. Please try again." });
      return;
    }

    setOtpVerified(true);
    setNotice({ type: "success", text: "OTP verified. You may now reset your password." });
    setMode("reset");
  }

  async function resendForgotOtp() {
    if (cooldown > 0 || !forgotEmail) return;

    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: forgotEmail,
      options: {
        shouldCreateUser: false,
      },
    });

    setLoading(false);

    if (error) {
      setNotice({ type: "error", text: error.message });
      return;
    }

    setCooldown(10);
    setNotice({ type: "success", text: "New OTP sent." });
  }

  async function resetPassword() {
    setNotice(null);

    if (!otpVerified) {
      setNotice({ type: "error", text: "OTP verification is required first." });
      return;
    }

    if (!newPassword || !confirmNewPassword) {
      setNotice({ type: "error", text: "Please complete the password fields." });
      return;
    }

    if (newPassword.length < 6) {
      setNotice({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setNotice({ type: "error", text: "Passwords do not match." });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setLoading(false);

    if (error) {
      setNotice({ type: "error", text: error.message });
      return;
    }

    setNotice({ type: "success", text: "Password updated successfully. Please login." });
    setNewPassword("");
    setConfirmNewPassword("");
    setForgotOtp("");
    setOtpVerified(false);
    setMode("login");
  }

  const isRightMode = mode !== "login";

  return (
    <main className="page" onMouseMove={handleMouseMove}>
      <section className={`shell ${isRightMode ? "registerMode" : ""}`}>
        <div className="world">
          <div className="badge">🌿 AGARWOOD PLATFORM</div>

          <div className="sun">
            <div className="eye eyeLeft">
              <span style={eyeMove} />
            </div>
            <div className="eye eyeRight">
              <span style={eyeMove} />
            </div>
            <div className="smile" />
          </div>

          <div className="leaf leafOne">🍃</div>
          <div className="leaf leafTwo">🍃</div>
          <div className="leaf leafThree">🍃</div>
          <div className="spark">✦</div>

          <div className="copy">
            <h1>
              Grow your
              <br />
              digital forest
            </h1>
            <p>
              A premium agarwood ownership platform built around trust,
              verification, and milestone-based transparency.
            </p>
          </div>

          <div className="forest">
            <div className="hill hillBack" />
            <div className="hill hillMid" />
            <div className="hill hillFront" />

            <div className="smallTree smallTreeOne">
              <span />
              <span />
              <i />
            </div>

            <div className="smallTree smallTreeTwo">
              <span />
              <span />
              <i />
            </div>

            <div className="mainTree">
              <div className="trunk" />
              <div className="crown crownOne" />
              <div className="crown crownTwo" />
              <div className="crown crownThree" />
              <div className="crown crownFour" />
            </div>
          </div>
        </div>

        <div className="cards">
          {mode === "login" && (
            <div className="card show">
              <p className="kicker">SECURE ACCESS</p>
              <h2>Welcome back</h2>
              <p className="sub">Login to enter your agarwood ownership portal.</p>

              <label>Email address</label>
              <input
                type="email"
                placeholder="you@email.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />

              <label>Password</label>
              <input
                type="password"
                placeholder="Your password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />

              {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

              <button className="primary" onClick={login} disabled={loading}>
                {loading ? "Checking..." : "Login"}
              </button>

              <div className="cardLinks">
                <button onClick={() => go("register")}>Create account</button>
                <button onClick={() => go("forgot")}>Forgot password?</button>
              </div>

              <div className="trustBox">
                <strong>TRUST FIRST</strong>
                <p>
                  Ownership access requires verified identity and active membership
                  before portfolio actions are enabled.
                </p>
              </div>
            </div>
          )}

          {mode === "register" && (
            <div className="card show">
              <p className="kicker">JOIN THE FOREST</p>
              <h2>Create account</h2>
              <p className="sub">Email verification is required before account access.</p>

              <label>Full name</label>
              <input
                type="text"
                placeholder="Your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />

              <label>Email address</label>
              <input
                type="email"
                placeholder="you@email.com"
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
              />

              <label>Phone number</label>
              <input
                type="text"
                placeholder="+63 phone number"
                value={registerPhone}
                onChange={(e) => setRegisterPhone(e.target.value)}
              />

              <label>Password</label>
              <input
                type="password"
                placeholder="Create password"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
              />

              <label>Confirm password</label>
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />

              {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

              <button className="primary" onClick={sendRegisterOtp} disabled={loading}>
                {loading ? "Checking..." : "Send Email OTP"}
              </button>

              <button className="backButton" onClick={() => go("login")}>
                Back to Login
              </button>
            </div>
          )}

          {mode === "registerOtp" && (
            <div className="card show">
              <p className="kicker">EMAIL OTP</p>
              <h2>Verify email</h2>
              <p className="sub">Enter the OTP sent to your email to continue registration.</p>

              <div className="notice info">{maskEmail(registerEmail)}</div>

              <label>OTP Code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit OTP"
                value={registerOtp}
                onChange={(e) => setRegisterOtp(e.target.value)}
              />

              {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

              <button className="primary" onClick={verifyRegisterOtp} disabled={loading}>
                {loading ? "Verifying..." : "Verify & Create Account"}
              </button>

              <button className="backButton" onClick={resendRegisterOtp} disabled={cooldown > 0}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend Code"}
              </button>

              <button className="backButton" onClick={() => go("register")}>
                Back to Register
              </button>
            </div>
          )}

          {mode === "forgot" && (
            <div className="card show">
              <p className="kicker">ACCOUNT RECOVERY</p>
              <h2>Forgot password</h2>
              <p className="sub">
                Enter your registered email or verified phone number to receive an OTP.
              </p>

              <label>Email or phone number</label>
              <input
                type="text"
                placeholder="you@email.com or +63 phone number"
                value={forgotIdentity}
                onChange={(e) => setForgotIdentity(e.target.value)}
              />

              {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

              <button className="primary" onClick={sendForgotOtp} disabled={loading}>
                {loading ? "Checking..." : "Send Reset OTP"}
              </button>

              <button className="backButton" onClick={() => go("login")}>
                Back to Login
              </button>

              <div className="trustBox small">
                <strong>TRUST & SECURITY</strong>
                <p>
                  Your ownership portfolio, memberships, and tree records are protected
                  through multi-step account verification.
                </p>
                <p>
                  Recovery options become available based on your verified account information.
                </p>
              </div>
            </div>
          )}

          {mode === "forgotOtp" && (
            <div className="card show">
              <p className="kicker">RESET OTP</p>
              <h2>Verify reset</h2>
              <p className="sub">Enter the OTP sent to your registered recovery method.</p>

              <div className="notice info">{maskEmail(forgotEmail)}</div>

              <label>OTP Code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit OTP"
                value={forgotOtp}
                onChange={(e) => setForgotOtp(e.target.value)}
              />

              {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

              <button className="primary" onClick={verifyForgotOtp} disabled={loading}>
                {loading ? "Verifying..." : "Verify OTP"}
              </button>

              <button className="backButton" onClick={resendForgotOtp} disabled={cooldown > 0}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend Code"}
              </button>

              <button className="backButton" onClick={() => go("forgot")}>
                Back
              </button>
            </div>
          )}

          {mode === "reset" && (
            <div className="card show">
              <p className="kicker">NEW PASSWORD</p>
              <h2>Reset password</h2>
              <p className="sub">Create a new password for your account.</p>

              <label>New password</label>
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />

              <label>Confirm new password</label>
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
              />

              {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

              <button className="primary" onClick={resetPassword} disabled={loading}>
                {loading ? "Saving..." : "Save New Password"}
              </button>

              <button className="backButton" onClick={() => go("login")}>
                Back to Login
              </button>
            </div>
          )}
        </div>
      </section>

      <style>{`
        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at 15% 10%, #fbf7c9 0%, transparent 32%),
            radial-gradient(circle at 85% 85%, #b6db8c 0%, transparent 35%),
            linear-gradient(135deg, #eef4ce 0%, #dbeeb8 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 26px;
          overflow: hidden;
          font-family: Arial, Helvetica, sans-serif;
        }

        .shell {
          position: relative;
          width: min(1160px, 100%);
          min-height: 730px;
          border-radius: 34px;
          overflow: hidden;
          background:
            radial-gradient(circle at 22% 22%, rgba(255, 249, 177, 0.95), transparent 30%),
            linear-gradient(135deg, #edf8c9 0%, #cbe5a0 48%, #75b957 100%);
          border: 1px solid rgba(255, 255, 255, 0.75);
          box-shadow: 0 28px 80px rgba(34, 86, 27, 0.25);
        }

        .world {
          position: absolute;
          inset: 0 auto 0 0;
          width: 62%;
          padding: 42px 58px;
          transition:
            transform 900ms cubic-bezier(0.22, 1, 0.36, 1),
            filter 900ms ease;
        }

        .registerMode .world {
          transform: translateX(-54px) scale(1.025);
          filter: saturate(1.05);
        }

        .badge {
          display: inline-flex;
          align-items: center;
          padding: 11px 24px;
          border-radius: 999px;
          background: rgba(255, 255, 238, 0.78);
          color: #1d4b1d;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.5px;
          box-shadow: 0 10px 25px rgba(67, 94, 34, 0.12);
        }

        .copy {
          position: relative;
          z-index: 5;
          margin-top: 38px;
          max-width: 530px;
        }

        h1 {
          margin: 0;
          color: #143d19;
          font-size: clamp(48px, 6vw, 76px);
          line-height: 0.92;
          letter-spacing: -4px;
        }

        .copy p {
          color: #55714c;
          font-size: 18px;
          line-height: 1.65;
          max-width: 520px;
          margin-top: 24px;
        }

        .sun {
          position: absolute;
          top: 92px;
          left: 430px;
          width: 92px;
          height: 92px;
          border-radius: 50%;
          background: linear-gradient(145deg, #ffe071 0%, #f6b23e 100%);
          box-shadow: 0 0 48px rgba(255, 195, 66, 0.55);
          animation: sunFloat 5.5s ease-in-out infinite;
          z-index: 2;
        }

        .sun:before {
          content: "";
          position: absolute;
          inset: -13px;
          border-radius: 50%;
          background: repeating-conic-gradient(
            from 10deg,
            rgba(242, 173, 45, 0.55) 0deg 9deg,
            transparent 9deg 23deg
          );
          z-index: -1;
        }

        .eye {
          position: absolute;
          top: 32px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #fff8d8;
          overflow: hidden;
          display: grid;
          place-items: center;
        }

        .eyeLeft { left: 24px; }
        .eyeRight { right: 24px; }

        .eye span {
          display: block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #23441f;
          transition: transform 160ms ease-out;
        }

        .smile {
          position: absolute;
          left: 35px;
          top: 56px;
          width: 23px;
          height: 11px;
          border-bottom: 3px solid #7c561c;
          border-radius: 0 0 20px 20px;
        }

        .leaf {
          position: absolute;
          font-size: 29px;
          z-index: 4;
          filter: drop-shadow(0 8px 8px rgba(28, 90, 27, 0.14));
          animation: leafFloat 6.5s ease-in-out infinite;
        }

        .leafOne { left: 145px; top: 338px; }
        .leafTwo { left: 405px; top: 315px; animation-delay: 1.2s; }
        .leafThree { left: 520px; top: 250px; font-size: 23px; animation-delay: 2.1s; }

        .spark {
          position: absolute;
          left: 330px;
          top: 470px;
          color: #f8be3b;
          font-size: 34px;
          animation: twinkle 3.2s ease-in-out infinite;
        }

        .forest {
          position: absolute;
          left: 58px;
          bottom: 58px;
          width: 560px;
          height: 285px;
        }

        .hill {
          position: absolute;
          bottom: 0;
          border-radius: 180px 180px 0 0;
        }

        .hillBack { left: 0; width: 300px; height: 190px; background: #bddd7b; }
        .hillMid { left: 50px; width: 510px; height: 106px; background: #78aa4c; }
        .hillFront { left: 128px; width: 280px; height: 64px; background: #608e3f; }

        .mainTree {
          position: absolute;
          left: 300px;
          bottom: 70px;
          width: 190px;
          height: 190px;
        }

        .trunk {
          position: absolute;
          left: 86px;
          bottom: 0;
          width: 31px;
          height: 98px;
          background: #80502e;
          border-radius: 8px;
          z-index: 1;
        }

        .crown {
          position: absolute;
          background: #3d951f;
          border-radius: 50%;
          z-index: 2;
        }

        .crownOne { width: 88px; height: 88px; left: 56px; top: 0; }
        .crownTwo { width: 114px; height: 114px; left: 20px; top: 50px; }
        .crownThree { width: 116px; height: 116px; right: 0; top: 50px; }
        .crownFour { width: 155px; height: 105px; left: 18px; top: 86px; }

        .smallTree {
          position: absolute;
          bottom: 64px;
          width: 60px;
          height: 90px;
        }

        .smallTreeOne { left: 72px; }
        .smallTreeTwo { left: 180px; transform: scale(0.78); opacity: 0.85; }

        .smallTree span {
          position: absolute;
          background: #579f32;
          border-radius: 50%;
          width: 54px;
          height: 54px;
          left: 3px;
        }

        .smallTree span:nth-child(2) {
          top: 25px;
          background: #468c2c;
        }

        .smallTree i {
          position: absolute;
          bottom: 0;
          left: 26px;
          width: 10px;
          height: 48px;
          background: #81512e;
          border-radius: 6px;
        }

        .cards {
          position: absolute;
          right: 54px;
          top: 50%;
          transform: translateY(-50%);
          width: 430px;
          height: 650px;
          z-index: 20;
        }

        .card {
          position: absolute;
          inset: 0;
          border-radius: 32px;
          background: rgba(254, 255, 244, 0.9);
          backdrop-filter: blur(18px);
          border: 1px solid rgba(255, 255, 255, 0.8);
          box-shadow: 0 28px 70px rgba(24, 75, 26, 0.22);
          padding: 34px 36px;
          overflow: hidden;
          animation: cardIn 520ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .kicker {
          margin: 0 0 12px;
          color: #789947;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 5px;
          overflow-wrap: break-word;
        }

        h2 {
          margin: 0;
          color: #153f19;
          font-size: 34px;
          letter-spacing: -1px;
        }

        .sub {
          color: #6d7b61;
          font-size: 14px;
          margin: 12px 0 24px;
          line-height: 1.5;
          overflow-wrap: break-word;
        }

        label {
          display: block;
          color: #2c4f25;
          font-size: 13px;
          font-weight: 900;
          margin: 10px 0 7px;
        }

        input {
          width: 100%;
          height: 46px;
          border-radius: 16px;
          border: 1px solid #c6d7b9;
          background: #edf4ff;
          padding: 0 17px;
          color: #183c19;
          font-size: 14px;
          outline: none;
          min-width: 0;
          text-overflow: ellipsis;
        }

        input:focus {
          border-color: #6fa24d;
          box-shadow: 0 0 0 4px rgba(111, 162, 77, 0.14);
        }

        .primary {
          width: 100%;
          min-height: 52px;
          margin-top: 18px;
          border: 0;
          border-radius: 16px;
          background: #1f5b21;
          color: #fffef0;
          font-size: 15px;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 12px 22px rgba(22, 75, 25, 0.24);
          transition: 250ms ease;
          padding: 0 14px;
        }

        .primary:disabled,
        .backButton:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .primary:hover:not(:disabled) {
          transform: translateY(-2px);
          background: #174919;
        }

        .cardLinks {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 18px 0 26px;
        }

        .cardLinks button,
        .backButton {
          border: 0;
          background: transparent;
          color: #54733a;
          font-weight: 900;
          cursor: pointer;
          overflow-wrap: break-word;
        }

        .backButton {
          width: 100%;
          min-height: 38px;
          margin-top: 10px;
        }

        .trustBox,
        .notice {
          background: rgba(255, 250, 230, 0.84);
          border-radius: 22px;
          padding: 16px;
          color: #69775f;
          font-size: 13px;
          overflow-wrap: break-word;
          word-break: break-word;
        }

        .trustBox.small {
          margin-top: 16px;
        }

        .trustBox strong {
          color: #8d9c4e;
          letter-spacing: 3px;
          font-size: 13px;
        }

        .trustBox p {
          margin: 8px 0 0;
          line-height: 1.5;
        }

        .notice {
          margin: 14px 0 0;
          font-weight: 900;
        }

        .notice.info {
          background: rgba(255, 250, 230, 0.84);
          color: #264b22;
        }

        .notice.success {
          background: rgba(224, 244, 214, 0.92);
          color: #1f5b21;
        }

        .notice.error {
          background: rgba(255, 233, 225, 0.92);
          color: #9a3412;
        }

        @keyframes cardIn {
          from { opacity: 0; transform: translateX(60px) scale(0.97); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }

        @keyframes sunFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @keyframes leafFloat {
          0%, 100% { transform: translateY(0) rotate(-8deg); }
          50% { transform: translateY(-17px) rotate(8deg); }
        }

        @keyframes twinkle {
          0%, 100% { opacity: 0.35; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        @media (max-width: 980px) {
          .shell { min-height: 980px; }

          .world {
            width: 100%;
            height: 460px;
            padding: 30px;
          }

          .registerMode .world {
            transform: translateX(-25px) scale(1.02);
          }

          .copy h1 {
            font-size: 48px;
            letter-spacing: -2px;
          }

          .copy p {
            font-size: 15px;
            max-width: 390px;
          }

          .sun {
            left: auto;
            right: 68px;
            top: 76px;
            width: 78px;
            height: 78px;
          }

          .eye {
            top: 27px;
            width: 16px;
            height: 16px;
          }

          .eyeLeft { left: 20px; }
          .eyeRight { right: 20px; }

          .smile {
            left: 29px;
            top: 48px;
          }

          .forest {
            transform: scale(0.72);
            transform-origin: left bottom;
            left: 24px;
            bottom: 500px;
          }

          .cards {
            left: 24px;
            right: 24px;
            top: auto;
            bottom: 24px;
            width: auto;
            height: 650px;
            transform: none;
          }
        }

        @media (max-width: 560px) {
          .page { padding: 14px; }

          .shell {
            border-radius: 24px;
            min-height: 1010px;
          }

          .world { padding: 22px; }

          .badge {
            font-size: 11px;
            padding: 9px 16px;
          }

          .copy { margin-top: 34px; }

          .copy h1 { font-size: 42px; }

          .sun {
            right: 30px;
            top: 88px;
            transform: scale(0.88);
          }

          .cards {
            left: 14px;
            right: 14px;
            bottom: 14px;
            height: 665px;
          }

          .card {
            padding: 28px 22px;
            border-radius: 26px;
          }

          h2 { font-size: 30px; }

          input { height: 44px; }

          .cardLinks {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}