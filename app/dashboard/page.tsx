"use client";

import { useEffect, useMemo, useState } from "react";

const growthStages = [
  { name: "Seedling", period: "1 - 3 Months", progress: 12 },
  { name: "Sapling", period: "3 - 12 Months", progress: 28 },
  { name: "Young Tree", period: "1 - 3 Years", progress: 48 },
  { name: "Mature Tree", period: "3 - 7 Years", progress: 76 },
  { name: "Harvest Ready", period: "7+ Years", progress: 100 },
];

export default function DashboardPage() {
  const [stage, setStage] = useState(1);

  useEffect(() => {
    const t = setInterval(() => {
      setStage((s) => (s >= 5 ? 1 : s + 1));
    }, 2400);

    return () => clearInterval(t);
  }, []);

  const currentStage = useMemo(() => growthStages[stage - 1], [stage]);

  return (
    <main className="page">
      <aside className="sidebar">
        <div className="logo">
          <div className="logoMark">♧</div>
          <h1>AGARWOOD</h1>
          <p>INVESTMENTS</p>
        </div>

        <nav>
          {[
            ["🏠", "Dashboard"],
            ["🌳", "My Trees"],
            ["📈", "Investments"],
            ["💹", "Earnings"],
            ["💳", "Wallet"],
            ["🧾", "Transactions"],
            ["👥", "Referrals"],
            ["👤", "Profile"],
            ["⚙️", "Settings"],
            ["?", "Support"],
          ].map((item, i) => (
            <button className={i === 0 ? "active" : ""} key={item[1]}>
              <span>{item[0]}</span>
              {item[1]}
            </button>
          ))}
        </nav>

        <div className="promo">
          <h3>
            Grow Wealth.
            <br />
            Grow Legacy.
          </h3>
          <p>Sustainable future, lasting returns.</p>
          <div className="promoPlant">
            <span>🌱</span>
          </div>
        </div>

        <div className="userBox">
          <div className="avatar">DU</div>
          <div>
            <strong>Demo User</strong>
            <p>Client</p>
          </div>
          <span>⌄</span>
        </div>
      </aside>

      <section className="content">
        <header className="header">
          <div>
            <p>Welcome back,</p>
            <h2>
              Demo User <span>🍃</span>
            </h2>
            <small>Track your agarwood trees, care services, and wallet.</small>
          </div>

          <div className="headerActions">
            <button>
              🔔<i>8</i>
            </button>
            <button>
              ✉️<i>2</i>
            </button>
            <div className="topAvatar">DU</div>
          </div>
        </header>

        <section className="stats">
          <Card icon="🌳" title="Owned Trees" value="128" sub="Individual + package trees" />
          <Card icon="🧑‍🌾" title="Care Tasks Due" value="6" sub="Watering, fertilizer, photo update" />
          <Card icon="🛡️" title="Care Subscription" value="Active" sub="Managed care service" gold />
          <Card icon="💳" title="Wallet Balance" value="₱ 12,340" sub="Available balance" />
        </section>

        <section className="mainGrid">
          <div className="journey">
            <h3>Agarwood Growth Guide</h3>
            <h4>{currentStage.name} 🍃</h4>

            {growthStages.map((x, i) => (
              <div className={`step ${stage === i + 1 ? "current" : ""}`} key={x.name}>
                <span>{stage > i + 1 ? "✓" : stage === i + 1 ? "●" : "○"}</span>
                <div>
                  <strong>{x.name}</strong>
                  <p>{x.period}</p>
                </div>
                {stage === i + 1 && <b />}
              </div>
            ))}
          </div>

          <div className="growthCard">
            <div className="pill">🍃 {currentStage.name}</div>
            <p className="growthText">
              Live tree guide only — not actual owned tree data.
            </p>

            <div className="forestScene">
              <div className="glowCircle" />
              <div className="resinGlow r1" />
              <div className="resinGlow r2" />
              <div className="resinGlow r3" />

              <div className="leaf l1">🍃</div>
              <div className="leaf l2">🍃</div>
              <div className="leaf l3">🍃</div>

              <div className={`treeStage stage${stage}`}>
                <div className="soil" />
                <div className="trunk">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="branch b1" />
                <div className="branch b2" />
                <div className="branch b3" />
                <div className="branch b4" />
                <div className="crown c1" />
                <div className="crown c2" />
                <div className="crown c3" />
                <div className="crown c4" />
                <div className="crown c5" />
              </div>
            </div>

            <div className="progressGlass">
              <div>
                <strong>Growth Guide Progress</strong>
                <span>{currentStage.progress}%</span>
              </div>
              <div className="bar">
                <i style={{ width: `${currentStage.progress}%` }} />
              </div>
              <p>
                <b>Current Guide Stage</b>
                <span>{currentStage.name}</span>
              </p>
            </div>
          </div>

          <div className="portfolio">
            <div className="panelHead">
              <h3>My Trees Overview</h3>
              <button>View My Trees ›</button>
            </div>

            <div className="treeOverview">
              <Info label="Owned Trees" value="128" />
              <Info label="Individual Trees" value="58" />
              <Info label="Package Trees" value="70" />
              <Info label="Latest Photo Update" value="Today" />
              <Info label="GPS Verified" value="124 / 128" />
              <Info label="Care Subscription" value="Active" />
              <Info label="Trees Needing Attention" value="6" alert />
            </div>
          </div>

          <div className="actions darkPanel">
            <h3>Quick Actions</h3>
            <div>
              <button>🍃<span>Invest</span></button>
              <button>💼<span>Add Funds</span></button>
              <button>↑<span>Withdraw</span></button>
              <button>🌳<span>My Trees</span></button>
            </div>
          </div>

          <div className="inventory panel">
            <div className="panelHead">
              <h3>Inventory</h3>
              <button>Buy More ›</button>
            </div>

            {[
              ["Organic Fertilizer", "24 packs"],
              ["Growth Booster", "18 bottles"],
              ["Insecticide", "12 bottles"],
              ["Fungicide", "10 bottles"],
              ["GPS Tags", "40 tags"],
              ["Photo Credits", "85 credits"],
            ].map((x) => (
              <div className="listRow" key={x[0]}>
                <span>{x[0]}</span>
                <b>{x[1]}</b>
              </div>
            ))}
          </div>

          <div className="market panel">
            <div className="panelHead">
              <h3>Agarwood Market</h3>
              <button>Live Style</button>
            </div>

            <div className="marketGraph">
              <svg viewBox="0 0 500 150" preserveAspectRatio="none">
                <path className="oil" d="M0 100 C55 55, 90 120, 150 75 C210 25, 250 115, 310 65 C370 25, 430 85, 500 35" />
                <path className="chips" d="M0 120 C70 95, 110 100, 170 80 C235 58, 285 98, 350 62 C410 36, 455 65, 500 48" />
                <path className="resin" d="M0 135 C70 125, 120 82, 185 98 C260 118, 310 40, 380 52 C440 62, 465 30, 500 20" />
              </svg>
            </div>

            <div className="marketLegend">
              <span><i className="oilDot" /> Agarwood Oil</span>
              <span><i className="chipsDot" /> Agarwood Chips</span>
              <span><i className="resinDot" /> Premium Resin</span>
            </div>
          </div>

          <div className="notifications panel">
            <div className="panelHead">
              <h3>Notifications</h3>
              <button>View all ›</button>
            </div>

            {[
              "Watering missed",
              "Fertilizer due",
              "Photo update available",
              "GPS verified",
              "Subscription expiring",
              "Caretaker report uploaded",
              "Referral bonus",
              "Tree entered new stage",
            ].map((x) => (
              <div className="notice" key={x}>
                <span>•</span>
                <p>{x}</p>
              </div>
            ))}
          </div>

          <div className="referrals panel">
            <div className="panelHead">
              <h3>Referrals</h3>
              <button>Invite ›</button>
            </div>
            <h2>₱ 7,500</h2>
            <small>Total referral bonus earned</small>
            <div className="referralBox">Share your code: AGAR-DEMO-128</div>
          </div>
        </section>

        <footer>
          🍃 Membership fee = platform access. Tree care fee = maintenance service.{" "}
          <span>|</span> Agarwood Investments © 2026
        </footer>
      </section>

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }

        .page {
          min-height: 100vh;
          display: flex;
          background: #f8f2e6;
          color: #0c2118;
          font-family: Arial, Helvetica, sans-serif;
        }

        .sidebar {
          width: 280px;
          background:
            radial-gradient(circle at 70% 20%, rgba(74, 157, 74, .22), transparent 30%),
            linear-gradient(180deg, #06281d, #03180f);
          color: white;
          padding: 30px 18px;
          display: flex;
          flex-direction: column;
          gap: 22px;
          box-shadow: 24px 0 50px rgba(0,0,0,.16);
        }

        .logo {
          text-align: center;
          margin-bottom: 10px;
        }

        .logoMark {
          font-size: 58px;
          color: #f0c458;
          line-height: .8;
        }

        .logo h1 {
          font-size: 22px;
          letter-spacing: 5px;
          margin: 10px 0 0;
          color: #f3c75b;
        }

        .logo p {
          margin: 5px 0 0;
          font-size: 11px;
          letter-spacing: 4px;
          color: #e0b94f;
        }

        nav {
          display: grid;
          gap: 9px;
        }

        nav button {
          height: 54px;
          border: 0;
          border-radius: 13px;
          background: transparent;
          color: #f6fff5;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 0 20px;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          transition: .25s;
        }

        nav button span {
          width: 25px;
          text-align: center;
        }

        nav button.active,
        nav button:hover {
          background: linear-gradient(135deg, #2c8f41, #0e4d2e);
          box-shadow: inset 0 0 18px rgba(153, 255, 140, .35), 0 12px 24px rgba(0,0,0,.22);
          transform: translateX(4px);
        }

        .promo {
          margin-top: auto;
          border-radius: 18px;
          padding: 20px;
          min-height: 210px;
          background:
            linear-gradient(rgba(6, 40, 29, .25), rgba(6, 40, 29, .75)),
            radial-gradient(circle at 80% 70%, #6fd148, transparent 32%);
          border: 1px solid rgba(198, 255, 161, .25);
          overflow: hidden;
          position: relative;
        }

        .promo h3 {
          margin: 0;
          font-size: 20px;
          line-height: 1.35;
        }

        .promo p {
          font-size: 13px;
          line-height: 1.6;
        }

        .promoPlant {
          position: absolute;
          right: 18px;
          bottom: 14px;
          font-size: 70px;
          animation: floatPlant 4s ease-in-out infinite;
        }

        .userBox {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 5px;
        }

        .avatar,
        .topAvatar {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: #174c2f;
          border: 1px solid rgba(255,255,255,.24);
          display: grid;
          place-items: center;
          color: white;
          font-weight: 900;
        }

        .userBox p {
          margin: 3px 0 0;
          opacity: .8;
          font-size: 13px;
        }

        .content {
          flex: 1;
          padding: 28px 30px 18px;
          overflow-x: hidden;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 20px;
        }

        .header p {
          margin: 0;
          font-weight: 800;
        }

        .header h2 {
          margin: 4px 0 4px;
          font-size: 36px;
          line-height: 1;
          letter-spacing: -1px;
        }

        .header small {
          color: #536258;
          font-size: 16px;
        }

        .headerActions {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .headerActions button {
          position: relative;
          width: 52px;
          height: 52px;
          border: 0;
          border-radius: 15px;
          background: rgba(255,255,255,.65);
          box-shadow: 0 10px 28px rgba(16, 37, 25, .08);
          cursor: pointer;
          font-size: 20px;
        }

        .headerActions i {
          position: absolute;
          right: 8px;
          top: 5px;
          background: #28a848;
          color: white;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          font-size: 11px;
          display: grid;
          place-items: center;
          font-style: normal;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
        }

        .stat {
          min-height: 140px;
          border-radius: 18px;
          background: rgba(255, 253, 246, .8);
          border: 1px solid rgba(55, 45, 22, .08);
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 20px;
          box-shadow: 0 12px 35px rgba(22, 37, 20, .08);
        }

        .statIcon {
          width: 70px;
          height: 70px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: radial-gradient(circle, #dff4cb, #b8de9a);
          font-size: 31px;
          box-shadow: 0 10px 23px rgba(69, 132, 58, .18);
        }

        .statIcon.gold {
          background: radial-gradient(circle, #fff5c7, #efbd43);
        }

        .stat p {
          margin: 0 0 8px;
          font-size: 14px;
        }

        .stat h3 {
          margin: 0 0 8px;
          font-size: 30px;
          letter-spacing: -1px;
        }

        .stat small {
          color: #08782e;
          font-weight: 800;
        }

        .mainGrid {
          display: grid;
          grid-template-columns: 240px 1.4fr 1fr;
          gap: 16px;
        }

        .journey,
        .growthCard,
        .portfolio,
        .darkPanel,
        .panel {
          border-radius: 18px;
          box-shadow: 0 13px 38px rgba(20, 29, 18, .09);
          border: 1px solid rgba(45, 34, 13, .07);
        }

        .journey {
          background: rgba(255, 253, 246, .85);
          padding: 20px;
          min-height: 520px;
        }

        .journey h3,
        .journey h4 {
          margin: 0;
        }

        .journey h4 {
          margin-top: 12px;
          color: #108131;
        }

        .step {
          position: relative;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 10px;
          margin-top: 10px;
          border-radius: 14px;
        }

        .step:before {
          content: "";
          position: absolute;
          left: 21px;
          top: -12px;
          width: 2px;
          height: 24px;
          background: #c8d5bb;
        }

        .step:first-of-type:before {
          display: none;
        }

        .step.current {
          background: linear-gradient(90deg, #d9efc4, #c6e5ae);
        }

        .step span {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #2ba849;
          color: white;
          font-size: 12px;
          z-index: 2;
        }

        .step div strong {
          font-size: 14px;
        }

        .step div p {
          margin: 5px 0 0;
          font-size: 13px;
          color: #596056;
        }

        .step b {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #168734;
          margin-left: auto;
        }

        .growthCard {
          position: relative;
          overflow: hidden;
          min-height: 520px;
          background:
            linear-gradient(rgba(255, 249, 224, .30), rgba(6, 46, 22, .75)),
            radial-gradient(circle at 72% 30%, rgba(255, 225, 117, .65), transparent 25%),
            linear-gradient(135deg, #e6e2c6, #88a773 48%, #113a1f);
        }

        .pill {
          position: absolute;
          top: 28px;
          left: 50%;
          transform: translateX(-50%);
          padding: 10px 22px;
          border-radius: 999px;
          background: #0c5a30;
          color: white;
          font-weight: 900;
          z-index: 5;
          white-space: nowrap;
        }

        .growthText {
          position: absolute;
          top: 74px;
          left: 0;
          right: 0;
          text-align: center;
          color: white;
          z-index: 5;
          padding: 0 20px;
        }

        .forestScene {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          padding-top: 80px;
        }

        .glowCircle {
          position: absolute;
          width: 420px;
          height: 420px;
          border-radius: 50%;
          border: 4px solid rgba(110, 255, 123, .75);
          border-left-color: rgba(255,255,255,.25);
          border-bottom-color: rgba(255,255,255,.18);
          filter: drop-shadow(0 0 20px rgba(80, 255, 115, .6));
          animation: rotateGlow 7s linear infinite;
        }

        .treeStage {
          position: relative;
          width: 280px;
          height: 315px;
          transform-origin: bottom center;
          animation: treeBreath 3s ease-in-out infinite;
          z-index: 3;
          transition: transform .9s ease, opacity .9s ease;
        }

        .soil {
          position: absolute;
          left: 42px;
          bottom: 0;
          width: 195px;
          height: 38px;
          border-radius: 50%;
          background: #2b1b0c;
          box-shadow: 0 15px 28px rgba(0,0,0,.35);
        }

        .trunk {
          position: absolute;
          left: 121px;
          bottom: 22px;
          width: 38px;
          height: 172px;
          border-radius: 20px;
          background: linear-gradient(90deg, #4d260d, #b26a20, #5a2c0f);
          overflow: hidden;
          box-shadow: inset 8px 0 12px rgba(255, 199, 92, .12);
        }

        .trunk i {
          position: absolute;
          top: 14px;
          width: 4px;
          height: 140px;
          border-radius: 999px;
          background: rgba(41, 19, 5, .45);
        }

        .trunk i:nth-child(1) { left: 8px; }
        .trunk i:nth-child(2) { left: 18px; opacity: .7; }
        .trunk i:nth-child(3) { right: 8px; opacity: .55; }

        .branch {
          position: absolute;
          bottom: 135px;
          width: 94px;
          height: 14px;
          border-radius: 20px;
          background: #7b4418;
        }

        .b1 { left: 54px; transform: rotate(-30deg); }
        .b2 { right: 58px; transform: rotate(32deg); }
        .b3 { left: 43px; bottom: 176px; transform: rotate(-18deg); }
        .b4 { right: 50px; bottom: 184px; transform: rotate(18deg); }

        .crown {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #bce86c, #1f6c21 70%);
          box-shadow: inset -12px -16px 26px rgba(0,0,0,.12);
          transition: .9s ease;
        }

        .c1 { width: 122px; height: 122px; left: 78px; top: 18px; }
        .c2 { width: 145px; height: 145px; left: 28px; top: 75px; }
        .c3 { width: 155px; height: 155px; right: 15px; top: 72px; }
        .c4 { width: 198px; height: 130px; left: 42px; top: 135px; }
        .c5 { width: 125px; height: 105px; left: 78px; top: 0; }

        .stage1 {
          transform: scale(.30) translateY(80px);
        }

        .stage1 .branch,
        .stage1 .crown,
        .stage1 .trunk i,
        .stage1 .resinGlow {
          opacity: 0;
        }

        .stage2 {
          transform: scale(.52) translateY(52px);
        }

        .stage2 .b3,
        .stage2 .b4,
        .stage2 .c3,
        .stage2 .c4,
        .stage2 .c5 {
          opacity: 0;
        }

        .stage3 {
          transform: scale(.78) translateY(24px);
        }

        .stage3 .c5 {
          opacity: .2;
        }

        .stage4 {
          transform: scale(1.03) translateY(0);
        }

        .stage5 {
          transform: scale(1.18) translateY(-10px);
          filter: drop-shadow(0 0 18px rgba(255, 196, 67, .28));
        }

        .stage5 .crown {
          background: radial-gradient(circle at 35% 30%, #d5f283, #237a26 70%);
        }

        .resinGlow {
          position: absolute;
          width: 15px;
          height: 38px;
          border-radius: 999px;
          background: linear-gradient(#fff5a6, #d88915);
          box-shadow: 0 0 18px rgba(255, 189, 41, .9);
          z-index: 4;
          opacity: .75;
          animation: resinPulse 1.8s ease-in-out infinite;
        }

        .r1 { left: 48%; top: 49%; }
        .r2 { left: 52%; top: 57%; animation-delay: .45s; }
        .r3 { left: 45%; top: 61%; animation-delay: .9s; }

        .leaf {
          position: absolute;
          font-size: 24px;
          z-index: 2;
          animation: leafFloat 5s ease-in-out infinite;
        }

        .l1 { left: 18%; top: 30%; }
        .l2 { right: 17%; top: 23%; animation-delay: 1s; }
        .l3 { right: 25%; bottom: 38%; animation-delay: 1.8s; }

        .progressGlass {
          position: absolute;
          left: 26px;
          right: 26px;
          bottom: 24px;
          padding: 18px;
          border-radius: 17px;
          color: white;
          background: rgba(1, 31, 17, .55);
          border: 1px solid rgba(255,255,255,.16);
          backdrop-filter: blur(12px);
          z-index: 6;
        }

        .progressGlass div:first-child,
        .progressGlass p {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .progressGlass span {
          font-size: 34px;
          font-weight: 900;
        }

        .progressGlass p {
          margin: 9px 0 0;
          font-size: 14px;
        }

        .progressGlass p span {
          font-size: 14px;
        }

        .bar {
          margin-top: 12px;
          height: 12px;
          border-radius: 999px;
          background: rgba(255,255,255,.28);
          overflow: hidden;
        }

        .bar i {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #8cff7e, #ffe27a);
          transition: width .9s ease;
        }

        .portfolio,
        .darkPanel {
          background: linear-gradient(145deg, #07351f, #042317);
          color: white;
          padding: 24px;
        }

        .portfolio {
          min-height: 520px;
        }

        .panelHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .panelHead h3 {
          margin: 0;
        }

        .panelHead button {
          border: 0;
          background: transparent;
          color: inherit;
          cursor: pointer;
          font-weight: 800;
        }

        .treeOverview {
          display: grid;
          gap: 12px;
          margin-top: 22px;
        }

        .info {
          padding: 13px 14px;
          border-radius: 14px;
          background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.1);
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }

        .info span {
          opacity: .82;
          font-size: 13px;
        }

        .info b {
          font-size: 14px;
        }

        .info.alert b {
          color: #ffd166;
        }

        .actions {
          min-height: 210px;
          grid-column: 1 / -1;
        }

        .actions div {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 13px;
          margin-top: 22px;
        }

        .actions button {
          height: 110px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.13);
          background: rgba(255,255,255,.06);
          color: white;
          display: grid;
          place-items: center;
          cursor: pointer;
          font-weight: 900;
          font-size: 24px;
        }

        .actions button span {
          display: block;
          font-size: 13px;
        }

        .panel {
          background: rgba(255, 253, 246, .86);
          padding: 22px;
          min-height: 255px;
        }

        .inventory {
          grid-column: 1 / 2;
        }

        .market {
          grid-column: 2 / 3;
        }

        .notifications {
          grid-column: 3 / 4;
          grid-row: 3 / 5;
        }

        .referrals {
          grid-column: 1 / 3;
        }

        .listRow,
        .notice {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          padding: 12px 0;
          border-bottom: 1px solid rgba(0,0,0,.07);
          font-size: 14px;
        }

        .listRow b {
          color: #0b8d37;
        }

        .notice {
          justify-content: flex-start;
          padding: 10px 0;
        }

        .notice span {
          color: #0b8d37;
          font-size: 24px;
          line-height: 1;
        }

        .notice p {
          margin: 0;
          font-size: 14px;
        }

        .marketGraph {
          height: 150px;
          margin-top: 22px;
          border-radius: 16px;
          background: linear-gradient(180deg, rgba(12, 90, 48, .08), rgba(255, 255, 255, .2));
          overflow: hidden;
        }

        .marketGraph svg {
          width: 100%;
          height: 100%;
        }

        .marketGraph path {
          fill: none;
          stroke-width: 5;
          stroke-linecap: round;
          filter: drop-shadow(0 8px 10px rgba(31, 145, 54, .18));
          stroke-dasharray: 900;
          stroke-dashoffset: 900;
          animation: drawLine 4s ease-in-out infinite alternate;
        }

        .marketGraph .oil { stroke: #15903c; }
        .marketGraph .chips { stroke: #d39a23; animation-delay: .4s; }
        .marketGraph .resin { stroke: #7c4a16; animation-delay: .8s; }

        .marketLegend {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          margin-top: 15px;
          font-size: 13px;
          font-weight: 800;
        }

        .marketLegend span {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .marketLegend i {
          width: 11px;
          height: 11px;
          border-radius: 50%;
        }

        .oilDot { background: #15903c; }
        .chipsDot { background: #d39a23; }
        .resinDot { background: #7c4a16; }

        .referrals h2 {
          font-size: 34px;
          margin: 22px 0 6px;
        }

        .referrals small {
          color: #08782e;
          font-weight: 900;
        }

        .referralBox {
          margin-top: 24px;
          padding: 16px;
          border-radius: 16px;
          background: #e4f2d8;
          color: #0c5a30;
          font-weight: 900;
        }

        footer {
          text-align: center;
          color: #697067;
          padding: 20px 0 0;
          font-size: 14px;
        }

        footer span {
          margin: 0 24px;
        }

        @keyframes rotateGlow {
          to { transform: rotate(360deg); }
        }

        @keyframes treeBreath {
          0%, 100% { filter: saturate(1); }
          50% { filter: saturate(1.25) brightness(1.07); }
        }

        @keyframes resinPulse {
          0%, 100% { transform: scale(.9); opacity: .45; }
          50% { transform: scale(1.15); opacity: 1; }
        }

        @keyframes leafFloat {
          0%, 100% { transform: translateY(0) rotate(-10deg); opacity: .8; }
          50% { transform: translateY(-22px) rotate(15deg); opacity: 1; }
        }

        @keyframes floatPlant {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @keyframes drawLine {
          to { stroke-dashoffset: 0; }
        }

        @media (max-width: 1280px) {
          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .mainGrid {
            grid-template-columns: 220px 1fr;
          }

          .portfolio,
          .actions,
          .notifications,
          .referrals {
            grid-column: 1 / -1;
          }

          .inventory {
            grid-column: 1 / 2;
          }

          .market {
            grid-column: 2 / 3;
          }
        }

        @media (max-width: 900px) {
          .page {
            flex-direction: column;
          }

          .sidebar {
            width: 100%;
            min-height: auto;
          }

          nav {
            grid-template-columns: repeat(2, 1fr);
          }

          .mainGrid,
          .stats {
            grid-template-columns: 1fr;
          }

          .inventory,
          .market,
          .notifications,
          .referrals {
            grid-column: 1;
          }

          .header {
            flex-direction: column;
            gap: 20px;
          }

          .actions div {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </main>
  );
}

function Card({
  icon,
  title,
  value,
  sub,
  gold,
}: {
  icon: string;
  title: string;
  value: string;
  sub: string;
  gold?: boolean;
}) {
  return (
    <div className="stat">
      <div className={`statIcon ${gold ? "gold" : ""}`}>{icon}</div>
      <div>
        <p>{title}</p>
        <h3>{value}</h3>
        <small>{sub}</small>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className={`info ${alert ? "alert" : ""}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}