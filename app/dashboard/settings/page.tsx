"use client";

import { useMemo, useState } from "react";

type ToggleKey =
  | "membershipAutoRenew"
  | "careAutoRenew"
  | "taskReminder"
  | "careReminder"
  | "membershipReminder"
  | "walletAlert"
  | "referralAlert"
  | "gpsAlert"
  | "photoAlert"
  | "emailAlert";

export default function SettingsPage() {
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({
    membershipAutoRenew: true,
    careAutoRenew: true,
    taskReminder: true,
    careReminder: true,
    membershipReminder: true,
    walletAlert: true,
    referralAlert: true,
    gpsAlert: true,
    photoAlert: true,
    emailAlert: false,
  });

  const walletBalance = 25430;
  const membershipRenewal = 999;
  const careRenewal = 2500;

  const projectedDeduction = useMemo(() => {
    let total = 0;
    if (toggles.membershipAutoRenew) total += membershipRenewal;
    if (toggles.careAutoRenew) total += careRenewal;
    return total;
  }, [toggles.membershipAutoRenew, toggles.careAutoRenew]);

  const enoughBalance = walletBalance >= projectedDeduction;

  function toggle(key: ToggleKey) {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <main className="page">
      <section className="shell">
        <aside className="sideQuote">
          <div>
            <p>Grow Wealth</p>
            <p>Through</p>
            <p>Sustainable</p>
            <p>Agarwood</p>
            <p>Ownership</p>
          </div>
          <span>🌿</span>
        </aside>

        <section className="content">
          <header className="header">
            <div>
              <h1>Settings</h1>
              <p>Manage your account, renewal preferences, alerts, and security.</p>
            </div>

            <div className="walletCard">
              <span>WALLET BALANCE</span>
              <strong>₱ {walletBalance.toLocaleString()}.00</strong>
              <b>💼</b>
            </div>
          </header>

          <section className="grid">
            <Card title="Account Settings" icon="👤">
              <div className="profileBlock">
                <div className="avatar">AI</div>
                <div>
                  <h3>Agarwood Investor</h3>
                  <p>Client Account</p>
                </div>
              </div>

              <Field label="Full Name" value="Agarwood Investor" />
              <Field label="Email Address" value="client@agarwood.demo" />
              <Field label="Phone Number" value="+63 900 000 0000" />

              <button className="goldBtn">Update Profile</button>
            </Card>

            <Card title="Membership Settings" icon="🏛️">
              <StatusRow label="Plan" value="Investor Membership" />
              <StatusRow label="Platform Access" value="ACTIVE" active />
              <StatusRow label="Renewal Date" value="July 18, 2026" />

              <RenewBox
                title="Auto Renew Membership"
                text="Wallet will automatically deduct platform access fee."
                active={toggles.membershipAutoRenew}
                onClick={() => toggle("membershipAutoRenew")}
              />

              <button className="outlineBtn">Renew Membership</button>
            </Card>

            <Card title="Care Subscription" icon="🛡️">
              <StatusRow label="Care Status" value="ACTIVE" active />
              <StatusRow label="Renewal Date" value="July 18, 2026" />
              <StatusRow label="Coverage" value="Managed Tree Care" />

              <div className="coverage">
                <span>✓ Watering</span>
                <span>✓ Fertilizer</span>
                <span>✓ Photo Updates</span>
                <span>✓ GPS Verification</span>
              </div>

              <RenewBox
                title="Auto Renew Care Plan"
                text="Automatically renews tree maintenance service."
                active={toggles.careAutoRenew}
                onClick={() => toggle("careAutoRenew")}
              />
            </Card>

            <Card title="Auto Renew Protection" icon="💳" wide>
              <div className="walletGrid">
                <MiniStat label="Wallet Balance" value={`₱${walletBalance.toLocaleString()}`} />
                <MiniStat label="Membership Renewal" value={`₱${membershipRenewal.toLocaleString()}`} />
                <MiniStat label="Care Renewal" value={`₱${careRenewal.toLocaleString()}`} />
                <MiniStat label="Projected Deduction" value={`₱${projectedDeduction.toLocaleString()}`} />
              </div>

              <div className={enoughBalance ? "protection good" : "protection bad"}>
                <strong>{enoughBalance ? "✓ Sufficient Balance" : "⚠ Insufficient Balance"}</strong>
                <p>
                  {enoughBalance
                    ? "Your wallet can cover the next enabled auto-renew payments."
                    : "Please add funds before renewal to avoid service interruption."}
                </p>
              </div>
            </Card>

            <Card title="Notification Preferences" icon="🔔" wide>
              <div className="toggleGrid">
                <ToggleRow label="Email Alerts" active={toggles.emailAlert} onClick={() => toggle("emailAlert")} />
                <ToggleRow label="Task Order Alerts" active={toggles.taskReminder} onClick={() => toggle("taskReminder")} />
                <ToggleRow label="Care Plan Reminders" active={toggles.careReminder} onClick={() => toggle("careReminder")} />
                <ToggleRow label="Membership Reminders" active={toggles.membershipReminder} onClick={() => toggle("membershipReminder")} />
                <ToggleRow label="Wallet Alerts" active={toggles.walletAlert} onClick={() => toggle("walletAlert")} />
                <ToggleRow label="Referral Alerts" active={toggles.referralAlert} onClick={() => toggle("referralAlert")} />
                <ToggleRow label="GPS Verification Alerts" active={toggles.gpsAlert} onClick={() => toggle("gpsAlert")} />
                <ToggleRow label="Photo Update Alerts" active={toggles.photoAlert} onClick={() => toggle("photoAlert")} />
              </div>
            </Card>

            <Card title="Care Preferences" icon="🌳">
              <SelectRow label="Default Care Mode" value="Manual Approval" />
              <SelectRow label="Photo Update Frequency" value="Monthly" />
              <SelectRow label="GPS Verification" value="Quarterly" />
              <SelectRow label="Task Scheduling" value="Notify Before Action" />
            </Card>

            <Card title="Security" icon="🔐">
              <StatusRow label="Password" value="Protected" active />
              <StatusRow label="Two-Factor Auth" value="Not Enabled" />
              <StatusRow label="Login History" value="Available" />

              <button className="goldBtn">Change Password</button>
              <button className="outlineBtn">Enable 2FA</button>
            </Card>

            <Card title="Wallet & Fee Rules" icon="📜" wide>
              <div className="feeGrid">
                <FeeItem title="Membership Fee" desc="Platform / app access only" />
                <FeeItem title="Care Fee" desc="Tree maintenance and operations service" />
                <FeeItem title="Sell Tree Fee" desc="2% platform fee before net receive" />
                <FeeItem title="Withdraw Fee" desc="2% processing fee before net receive" />
              </div>
            </Card>

            <Card title="Danger Zone" icon="🚪" wide danger>
              <div className="dangerRow">
                <div>
                  <strong>Sign Out</strong>
                  <p>End your current session on this device.</p>
                </div>
                <button className="dangerBtn">Sign Out</button>
              </div>
            </Card>
          </section>
        </section>
      </section>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #f5f1e8;
          padding: 0;
          font-family: Arial, Helvetica, sans-serif;
        }

        .shell {
          min-height: 100vh;
          max-width: 1440px;
          margin: auto;
          display: grid;
          grid-template-columns: 150px 1fr;
          background:
            radial-gradient(circle at 92% 8%, rgba(205, 164, 75, .2), transparent 28%),
            linear-gradient(135deg, #03170f, #062819 48%, #021108);
          border-left: 8px solid #062819;
          border-right: 8px solid #062819;
          color: #fff8dd;
        }

        .sideQuote {
          min-height: 100vh;
          padding: 24px 14px;
          border-right: 1px solid rgba(217, 176, 83, .35);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          background:
            radial-gradient(circle at bottom, rgba(80, 135, 65, .35), transparent 32%),
            rgba(0, 0, 0, .12);
        }

        .sideQuote div {
          border: 1px solid rgba(217, 176, 83, .45);
          border-radius: 12px;
          padding: 18px 10px;
          text-align: center;
          color: #d9b053;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 13px;
          line-height: 1.4;
        }

        .sideQuote p {
          margin: 4px 0;
        }

        .sideQuote span {
          margin-top: 18px;
          font-size: 44px;
          text-align: center;
          display: block;
        }

        .content {
          padding: 34px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .header h1 {
          margin: 0;
          font-size: 42px;
          color: #e7c76c;
          font-family: Georgia, "Times New Roman", serif;
        }

        .header p {
          margin: 8px 0 0;
          color: rgba(255, 248, 221, .72);
          font-style: italic;
        }

        .walletCard {
          min-width: 250px;
          padding: 18px 22px;
          border-radius: 15px;
          background: rgba(255, 255, 255, .055);
          border: 1px solid rgba(217, 176, 83, .38);
          box-shadow: inset 0 0 25px rgba(217, 176, 83, .08);
          position: relative;
        }

        .walletCard span {
          display: block;
          font-size: 10px;
          color: #d9b053;
          font-weight: 900;
        }

        .walletCard strong {
          display: block;
          margin-top: 7px;
          font-size: 22px;
          color: #fff8dd;
        }

        .walletCard b {
          position: absolute;
          right: 18px;
          top: 22px;
          color: #d9b053;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .card {
          border-radius: 16px;
          padding: 20px;
          min-height: 260px;
          background:
            linear-gradient(145deg, rgba(255, 255, 255, .075), rgba(255, 255, 255, .025));
          border: 1px solid rgba(217, 176, 83, .32);
          box-shadow: 0 18px 40px rgba(0, 0, 0, .22);
        }

        .card.wide {
          grid-column: span 2;
        }

        .card.danger {
          border-color: rgba(255, 118, 91, .4);
        }

        .cardHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 14px;
          margin-bottom: 16px;
          border-bottom: 1px solid rgba(217, 176, 83, .22);
        }

        .cardHead h2 {
          margin: 0;
          color: #e7c76c;
          font-size: 19px;
          font-family: Georgia, "Times New Roman", serif;
        }

        .cardIcon {
          width: 40px;
          height: 40px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(217, 176, 83, .38);
          background: rgba(217, 176, 83, .08);
        }

        .profileBlock {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 16px;
        }

        .avatar {
          width: 62px;
          height: 62px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          color: #062819;
          font-weight: 900;
          background: linear-gradient(135deg, #f4d57a, #b98222);
        }

        .profileBlock h3 {
          margin: 0;
        }

        .profileBlock p {
          margin: 5px 0 0;
          color: rgba(255, 248, 221, .6);
        }

        .field,
        .statusRow,
        .selectRow {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
          padding: 11px 0;
          border-bottom: 1px solid rgba(255, 255, 255, .08);
        }

        .field span,
        .statusRow span,
        .selectRow span {
          color: rgba(255, 248, 221, .62);
          font-size: 13px;
        }

        .field strong,
        .statusRow strong,
        .selectRow strong {
          font-size: 13px;
          text-align: right;
        }

        .activeText {
          color: #85ef91;
        }

        .goldBtn,
        .outlineBtn,
        .dangerBtn {
          width: 100%;
          margin-top: 15px;
          border: 0;
          border-radius: 10px;
          padding: 12px 15px;
          font-weight: 900;
          cursor: pointer;
        }

        .goldBtn {
          color: #062819;
          background: linear-gradient(135deg, #f3d376, #b98222);
        }

        .outlineBtn {
          color: #e7c76c;
          background: rgba(255,255,255,.03);
          border: 1px solid rgba(217, 176, 83, .38);
        }

        .dangerBtn {
          width: auto;
          color: white;
          background: linear-gradient(135deg, #c8442e, #7b1f16);
          margin-top: 0;
        }

        .renewBox {
          margin-top: 15px;
          padding: 14px;
          border-radius: 14px;
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
          background: rgba(255, 255, 255, .055);
          border: 1px solid rgba(217, 176, 83, .18);
        }

        .renewBox strong {
          color: #e7c76c;
        }

        .renewBox p {
          margin: 5px 0 0;
          font-size: 12px;
          color: rgba(255, 248, 221, .62);
          line-height: 1.4;
        }

        .switch {
          width: 58px;
          height: 32px;
          border-radius: 999px;
          padding: 4px;
          border: 1px solid rgba(255,255,255,.16);
          background: rgba(255,255,255,.13);
          cursor: pointer;
          flex: 0 0 auto;
        }

        .switch i {
          display: block;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(255,255,255,.86);
          transition: .25s;
        }

        .switch.on {
          background: linear-gradient(135deg, #48c760, #1d7d36);
        }

        .switch.on i {
          transform: translateX(25px);
          background: #fff8dd;
        }

        .coverage {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 9px;
          margin-top: 14px;
        }

        .coverage span {
          padding: 9px;
          border-radius: 10px;
          color: #dfffd9;
          background: rgba(87, 206, 100, .1);
          border: 1px solid rgba(87, 206, 100, .18);
          font-size: 12px;
          font-weight: 800;
        }

        .walletGrid,
        .feeGrid,
        .toggleGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .miniStat,
        .feeItem,
        .toggleRow {
          padding: 14px;
          border-radius: 13px;
          background: rgba(255, 255, 255, .05);
          border: 1px solid rgba(217, 176, 83, .16);
        }

        .miniStat span,
        .feeItem p {
          color: rgba(255, 248, 221, .62);
          font-size: 12px;
        }

        .miniStat strong {
          display: block;
          margin-top: 7px;
          font-size: 22px;
          color: #e7c76c;
        }

        .protection {
          margin-top: 14px;
          padding: 15px;
          border-radius: 14px;
        }

        .protection p {
          margin: 6px 0 0;
          color: rgba(255, 248, 221, .7);
        }

        .protection.good {
          background: rgba(69, 199, 87, .12);
          border: 1px solid rgba(69, 199, 87, .25);
        }

        .protection.bad {
          background: rgba(255, 150, 66, .12);
          border: 1px solid rgba(255, 150, 66, .25);
        }

        .toggleRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .toggleRow span {
          font-weight: 800;
          font-size: 13px;
        }

        .feeItem h3 {
          margin: 0 0 7px;
          color: #e7c76c;
          font-size: 16px;
        }

        .feeItem p {
          margin: 0;
          line-height: 1.5;
        }

        .dangerRow {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: center;
        }

        .dangerRow p {
          margin: 6px 0 0;
          color: rgba(255, 248, 221, .62);
        }

        @media (max-width: 1100px) {
          .shell {
            grid-template-columns: 1fr;
          }

          .sideQuote {
            display: none;
          }

          .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .card.wide {
            grid-column: span 2;
          }
        }

        @media (max-width: 760px) {
          .content {
            padding: 20px;
          }

          .header {
            flex-direction: column;
          }

          .walletCard {
            width: 100%;
          }

          .grid,
          .walletGrid,
          .feeGrid,
          .toggleGrid {
            grid-template-columns: 1fr;
          }

          .card,
          .card.wide {
            grid-column: span 1;
          }

          .coverage {
            grid-template-columns: 1fr;
          }

          .dangerRow {
            flex-direction: column;
            align-items: stretch;
          }

          .dangerBtn {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}

function Card({
  title,
  icon,
  children,
  wide,
  danger,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  wide?: boolean;
  danger?: boolean;
}) {
  return (
    <section className={`card ${wide ? "wide" : ""} ${danger ? "danger" : ""}`}>
      <div className="cardHead">
        <h2>{title}</h2>
        <div className="cardIcon">{icon}</div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusRow({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div className="statusRow">
      <span>{label}</span>
      <strong className={active ? "activeText" : ""}>{value}</strong>
    </div>
  );
}

function SelectRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="selectRow">
      <span>{label}</span>
      <strong>{value} ▾</strong>
    </div>
  );
}

function RenewBox({
  title,
  text,
  active,
  onClick,
}: {
  title: string;
  text: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div className="renewBox">
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
      <Switch active={active} onClick={onClick} />
    </div>
  );
}

function Switch({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`switch ${active ? "on" : ""}`} onClick={onClick}>
      <i />
    </button>
  );
}

function ToggleRow({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div className="toggleRow">
      <span>{label}</span>
      <Switch active={active} onClick={onClick} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="miniStat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FeeItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="feeItem">
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}