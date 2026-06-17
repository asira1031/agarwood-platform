"use client";

import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [stage, setStage] = useState(2);

  useEffect(() => {
    const t = setInterval(() => {
      setStage((s) => (s >= 4 ? 1 : s + 1));
    }, 2400);
    return () => clearInterval(t);
  }, []);

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
          <h3>Grow Wealth.<br />Grow Legacy.</h3>
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
            <h2>Demo User <span>🍃</span></h2>
            <small>Let's grow your future together.</small>
          </div>

          <div className="headerActions">
            <button>🔔<i>3</i></button>
            <button>✉️<i>2</i></button>
            <div className="topAvatar">DU</div>
          </div>
        </header>

        <section className="stats">
          <Card icon="🌳" title="Total Trees" value="128" sub="↑ 12 this month" />
          <Card icon="💰" title="Active Investments" value="₱ 285,000" sub="↑ 8.6% vs last month" />
          <Card icon="🏆" title="Total Earnings" value="₱ 48,750" sub="↑ 15.4% vs last month" gold />
          <Card icon="💳" title="Wallet Balance" value="₱ 12,340" sub="Available Balance" />
        </section>

        <section className="mainGrid">
          <div className="journey">
            <h3>Tree Growth Journey</h3>
            <h4>Agarwood Tree 🍃</h4>

            {[
              ["Seedling", "1 - 3 Months", true],
              ["Sapling", "3 - 12 Months", true],
              ["Young Tree", "1 - 3 Years", true],
              ["Mature Tree", "3 - 7 Years", false],
              ["Harvest Ready", "7+ Years", false],
            ].map((x, i) => (
              <div className={`step ${i === 2 ? "current" : ""}`} key={x[0] as string}>
                <span>{x[2] ? "✓" : "🔒"}</span>
                <div>
                  <strong>{x[0]}</strong>
                  <p>{x[1]}</p>
                </div>
                {i === 2 && <b />}
              </div>
            ))}
          </div>

          <div className="growthCard">
            <div className="pill">🍃 Young Tree Stage</div>
            <p className="growthText">You're growing! Keep going.</p>

            <div className="forestScene">
              <div className="glowCircle" />
              <div className="leaf l1">🍃</div>
              <div className="leaf l2">🍃</div>
              <div className="leaf l3">🍃</div>

              <div className={`treeStage stage${stage}`}>
                <div className="soil" />
                <div className="trunk" />
                <div className="branch b1" />
                <div className="branch b2" />
                <div className="crown c1" />
                <div className="crown c2" />
                <div className="crown c3" />
                <div className="crown c4" />
              </div>
            </div>

            <div className="progressGlass">
              <div>
                <strong>Growth Progress</strong>
                <span>42%</span>
              </div>
              <div className="bar"><i /></div>
              <p><b>Time Remaining</b><span>1 Year, 8 Months</span></p>
            </div>
          </div>

          <div className="portfolio">
            <div className="panelHead">
              <h3>Your Portfolio</h3>
              <button>View all ›</button>
            </div>

            <div className="donut">
              <div>
                <strong>128</strong>
                <span>Total Trees</span>
              </div>
            </div>

            <ul>
              <li><i className="green" /> Mature Trees <b>35 (27%)</b></li>
              <li><i className="lime" /> Young Trees <b>63 (49%)</b></li>
              <li><i className="gold" /> Saplings <b>20 (16%)</b></li>
              <li><i className="cream" /> Seedlings <b>10 (8%)</b></li>
            </ul>
          </div>

          <div className="actions darkPanel">
            <h3>Quick Actions</h3>
            <div>
              <button>🍃<span>Invest Now</span></button>
              <button>💼<span>Add Funds</span></button>
              <button>↑<span>Withdraw</span></button>
              <button>🌳<span>My Trees</span></button>
            </div>
          </div>

          <div className="summary panel">
            <div className="panelHead">
              <h3>Investment Summary</h3>
              <button>This Month⌄</button>
            </div>
            <p>Total Invested</p>
            <h2>₱ 285,000</h2>
            <div className="miniChart">
              <span /><span /><span /><span /><span /><span />
            </div>
            <small>↑ 8.6% vs last month</small>
          </div>

          <div className="earnings panel">
            <div className="panelHead">
              <h3>Earnings Overview</h3>
              <button>This Month⌄</button>
            </div>
            <h2>₱ 48,750</h2>
            <small>↑ 15.4% vs last month</small>
            <div className="lineChart">
              <svg viewBox="0 0 400 130" preserveAspectRatio="none">
                <path d="M0 95 C40 40, 80 110, 120 70 C170 20, 200 110, 250 55 C300 5, 330 65, 400 20" />
              </svg>
            </div>
          </div>

          <div className="activity panel">
            <div className="panelHead">
              <h3>Recent Activity</h3>
              <button>View all ›</button>
            </div>

            {[
              ["🎁", "Investment Package Purchased", "Premium Bundle", "+ ₱ 50,000"],
              ["🌳", "Earnings Credited", "Tree #AG-1287", "+ ₱ 1,250"],
              ["👥", "Referral Bonus", "From Juan D.", "+ ₱ 750"],
              ["⬇", "Withdrawal", "To GCash **** 1234", "- ₱ 2,000"],
            ].map((a) => (
              <div className="activityRow" key={a[1]}>
                <span>{a[0]}</span>
                <div>
                  <strong>{a[1]}</strong>
                  <p>{a[2]}</p>
                </div>
                <b className={a[3].includes("-") ? "red" : ""}>{a[3]}</b>
              </div>
            ))}
          </div>
        </section>

        <footer>🍃 Thank you for being part of a greener tomorrow. <span>|</span> Agarwood Investments © 2026</footer>
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
        .avatar, .topAvatar {
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

        .journey, .growthCard, .portfolio, .darkPanel, .panel {
          border-radius: 18px;
          box-shadow: 0 13px 38px rgba(20, 29, 18, .09);
          border: 1px solid rgba(45, 34, 13, .07);
        }

        .journey {
          background: rgba(255, 253, 246, .85);
          padding: 20px;
          min-height: 520px;
        }
        .journey h3, .journey h4 {
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
        .step:first-of-type:before { display: none; }
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
        }
        .growthText {
          position: absolute;
          top: 74px;
          left: 0;
          right: 0;
          text-align: center;
          color: white;
          z-index: 5;
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
          width: 240px;
          height: 270px;
          transform-origin: bottom center;
          animation: treeBreath 3s ease-in-out infinite;
          z-index: 3;
        }
        .soil {
          position: absolute;
          left: 35px;
          bottom: 0;
          width: 170px;
          height: 35px;
          border-radius: 50%;
          background: #2b1b0c;
          box-shadow: 0 15px 28px rgba(0,0,0,.35);
        }
        .trunk {
          position: absolute;
          left: 105px;
          bottom: 20px;
          width: 30px;
          height: 150px;
          border-radius: 18px;
          background: linear-gradient(90deg, #6a3d15, #b26a20, #5a2c0f);
        }
        .branch {
          position: absolute;
          bottom: 120px;
          width: 85px;
          height: 13px;
          border-radius: 20px;
          background: #7b4418;
        }
        .b1 { left: 50px; transform: rotate(-30deg); }
        .b2 { right: 52px; transform: rotate(32deg); }

        .crown {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #a4d85d, #1f6c21 70%);
          box-shadow: inset -12px -16px 26px rgba(0,0,0,.12);
        }
        .c1 { width: 110px; height: 110px; left: 65px; top: 20px; }
        .c2 { width: 125px; height: 125px; left: 15px; top: 70px; }
        .c3 { width: 135px; height: 135px; right: 5px; top: 67px; }
        .c4 { width: 170px; height: 115px; left: 35px; top: 116px; }

        .stage1 { transform: scale(.45); }
        .stage2 { transform: scale(.65); }
        .stage3 { transform: scale(.86); }
        .stage4 { transform: scale(1); }

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
          width: 42%;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #8cff7e, #60d95a);
          animation: loadBar 2.4s ease-out infinite alternate;
        }

        .portfolio, .darkPanel {
          background: linear-gradient(145deg, #07351f, #042317);
          color: white;
          padding: 24px;
        }
        .portfolio {
          min-height: 300px;
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

        .donut {
          margin: 26px auto 0;
          width: 170px;
          height: 170px;
          border-radius: 50%;
          background: conic-gradient(#4cc35c 0 49%, #ffd166 49% 65%, #edf3ca 65% 73%, #9bd67e 73% 100%);
          display: grid;
          place-items: center;
          position: relative;
        }
        .donut:before {
          content: "";
          position: absolute;
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: #07351f;
        }
        .donut div {
          position: relative;
          text-align: center;
        }
        .donut strong {
          display: block;
          font-size: 28px;
        }
        .donut span {
          font-size: 13px;
        }
        .portfolio ul {
          list-style: none;
          padding: 0;
          margin: 22px 0 0;
          display: grid;
          gap: 14px;
        }
        .portfolio li {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .portfolio li b {
          margin-left: auto;
        }
        .portfolio li i {
          width: 13px;
          height: 13px;
          border-radius: 50%;
        }
        .green { background: #4cc35c; }
        .lime { background: #9bd67e; }
        .gold { background: #ffd166; }
        .cream { background: #edf3ca; }

        .actions {
          min-height: 210px;
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
        }
        .actions button:first-line {
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
        .summary {
          grid-column: 1 / 2;
        }
        .earnings {
          grid-column: 2 / 3;
        }
        .activity {
          grid-column: 3 / 4;
          grid-row: 3 / 5;
        }
        .panel h2 {
          font-size: 29px;
          margin: 12px 0;
        }
        .summary p {
          margin: 24px 0 6px;
          color: #5c6259;
        }
        .summary small,
        .earnings small {
          color: #08782e;
          font-weight: 900;
        }

        .miniChart {
          height: 105px;
          display: flex;
          align-items: end;
          gap: 7px;
          margin: 12px 0;
        }
        .miniChart span {
          flex: 1;
          border-radius: 999px 999px 0 0;
          background: linear-gradient(#42b955, rgba(66,185,85,.05));
        }
        .miniChart span:nth-child(1) { height: 45%; }
        .miniChart span:nth-child(2) { height: 55%; }
        .miniChart span:nth-child(3) { height: 64%; }
        .miniChart span:nth-child(4) { height: 58%; }
        .miniChart span:nth-child(5) { height: 72%; }
        .miniChart span:nth-child(6) { height: 88%; }

        .lineChart {
          height: 125px;
          margin-top: 18px;
        }
        .lineChart svg {
          width: 100%;
          height: 100%;
        }
        .lineChart path {
          fill: none;
          stroke: #15903c;
          stroke-width: 5;
          stroke-linecap: round;
          filter: drop-shadow(0 8px 10px rgba(31, 145, 54, .18));
        }

        .activityRow {
          display: grid;
          grid-template-columns: 42px 1fr auto;
          align-items: center;
          gap: 12px;
          padding: 13px 0;
          border-bottom: 1px solid rgba(0,0,0,.08);
        }
        .activityRow span {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #e3f1d6;
        }
        .activityRow strong {
          font-size: 13px;
        }
        .activityRow p {
          margin: 4px 0 0;
          font-size: 12px;
          color: #6b6b62;
        }
        .activityRow b {
          color: #0b8d37;
          font-size: 13px;
        }
        .activityRow b.red {
          color: #d62121;
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
        @keyframes leafFloat {
          0%, 100% { transform: translateY(0) rotate(-10deg); opacity: .8; }
          50% { transform: translateY(-22px) rotate(15deg); opacity: 1; }
        }
        @keyframes loadBar {
          from { width: 35%; }
          to { width: 42%; }
        }
        @keyframes floatPlant {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @media (max-width: 1280px) {
          .stats { grid-template-columns: repeat(2, 1fr); }
          .mainGrid { grid-template-columns: 220px 1fr; }
          .portfolio, .actions, .activity { grid-column: 1 / -1; }
          .summary { grid-column: 1 / 2; }
          .earnings { grid-column: 2 / 3; }
        }

        @media (max-width: 900px) {
          .page { flex-direction: column; }
          .sidebar { width: 100%; min-height: auto; }
          nav { grid-template-columns: repeat(2, 1fr); }
          .mainGrid, .stats { grid-template-columns: 1fr; }
          .summary, .earnings, .activity { grid-column: 1; }
          .header { flex-direction: column; gap: 20px; }
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