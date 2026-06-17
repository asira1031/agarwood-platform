"use client";

import { useMemo, useState } from "react";

type TreeStatus = "Healthy" | "Growing" | "Monitoring" | "Ready Soon";

export default function DashboardPage() {
  const [activeNav, setActiveNav] = useState("Dashboard");

  const stats = useMemo(
    () => [
      { label: "Total Trees Owned", value: "128", sub: "+12 this month", icon: "🌳" },
      { label: "Total Investment", value: "₱128,000", sub: "Active portfolio", icon: "💰" },
      { label: "Current Tree Value", value: "₱156,800", sub: "+22.5% growth", icon: "📈" },
      { label: "Total Earnings", value: "₱28,800", sub: "Projected gains", icon: "🏆" },
    ],
    []
  );

  const trees: { id: string; farm: string; age: string; status: TreeStatus; harvest: string; progress: number }[] = [
    { id: "AGW-001", farm: "Bukidnon Forest Block A", age: "2.4 yrs", status: "Healthy", harvest: "2029", progress: 62 },
    { id: "AGW-014", farm: "Davao Managed Farm", age: "1.8 yrs", status: "Growing", harvest: "2030", progress: 48 },
    { id: "AGW-033", farm: "Agusan Nursery Zone", age: "3.1 yrs", status: "Ready Soon", harvest: "2028", progress: 78 },
    { id: "AGW-077", farm: "Palawan Reserve Plot", age: "1.2 yrs", status: "Monitoring", harvest: "2031", progress: 35 },
  ];

  const updates = [
    { title: "Monthly growth report uploaded", time: "Today, 9:30 AM", tag: "Report" },
    { title: "Watering schedule completed", time: "Yesterday", tag: "Farm" },
    { title: "Drone monitoring batch processed", time: "2 days ago", tag: "Drone" },
    { title: "New seedlings available for purchase", time: "3 days ago", tag: "Market" },
  ];

  const navItems = ["Dashboard", "My Trees", "Monitoring", "Buy Seedlings", "Wallet", "Marketplace"];

  return (
    <main className="page">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandIcon">🌿</div>
          <div>
            <h2>Agarwood</h2>
            <p>Forest Assets</p>
          </div>
        </div>

        <nav>
          {navItems.map((item) => (
            <button
              key={item}
              className={activeNav === item ? "active" : ""}
              onClick={() => setActiveNav(item)}
            >
              <span>{navIcon(item)}</span>
              {item}
            </button>
          ))}
        </nav>

        <div className="membership">
          <span>Premium Member</span>
          <strong>Active</strong>
          <p>Membership unlocks portfolio tracking, farm reports, and marketplace access.</p>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="kicker">CLIENT DASHBOARD</p>
            <h1>Forest Portfolio Overview</h1>
            <span>Track your agarwood trees, growth updates, wallet, and harvest forecast.</span>
          </div>

          <div className="profile">
            <button>🔔</button>
            <div className="avatar">TL</div>
          </div>
        </header>

        <section className="hero">
          <div>
            <p className="kicker">WELCOME BACK</p>
            <h2>Your digital forest is growing</h2>
            <p>
              Monitor your owned trees, farm activities, and projected value from one premium
              agarwood command center.
            </p>
          </div>

          <div className="heroTree">
            <div className="sun">☀️</div>
            <div className="tree">🌳</div>
            <div className="leaf one">🍃</div>
            <div className="leaf two">🍃</div>
          </div>
        </section>

        <section className="statsGrid">
          {stats.map((stat) => (
            <div className="statCard" key={stat.label}>
              <div className="statIcon">{stat.icon}</div>
              <p>{stat.label}</p>
              <h3>{stat.value}</h3>
              <span>{stat.sub}</span>
            </div>
          ))}
        </section>

        <section className="mainGrid">
          <div className="panel wide">
            <div className="panelHeader">
              <div>
                <p className="kicker">TREE ASSETS</p>
                <h2>My Trees</h2>
              </div>
              <button className="softBtn">View All</button>
            </div>

            <div className="treeList">
              {trees.map((tree) => (
                <div className="treeRow" key={tree.id}>
                  <div>
                    <strong>{tree.id}</strong>
                    <span>{tree.farm}</span>
                  </div>
                  <div>
                    <small>Age</small>
                    <b>{tree.age}</b>
                  </div>
                  <div>
                    <small>Status</small>
                    <em className={tree.status.replace(" ", "").toLowerCase()}>{tree.status}</em>
                  </div>
                  <div>
                    <small>Harvest</small>
                    <b>{tree.harvest}</b>
                  </div>
                  <div className="progressWrap">
                    <small>Growth</small>
                    <div className="bar">
                      <i style={{ width: `${tree.progress}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel wallet">
            <p className="kicker">WALLET</p>
            <h2>₱18,500</h2>
            <span>Available Balance</span>

            <div className="walletBox">
              <p>Pending Withdrawals</p>
              <strong>₱5,000</strong>
            </div>

            <button className="primary">Request Withdrawal</button>
          </div>

          <div className="panel">
            <p className="kicker">LIVE MONITORING</p>
            <h2>Farm Updates</h2>

            <div className="monitorGrid">
              <div>📸 Photos</div>
              <div>🛰 Drone</div>
              <div>📍 GPS</div>
              <div>📋 Reports</div>
            </div>
          </div>

          <div className="panel">
            <p className="kicker">ACTIVITY</p>
            <h2>Latest Updates</h2>

            <div className="updates">
              {updates.map((update) => (
                <div className="update" key={update.title}>
                  <div>
                    <strong>{update.title}</strong>
                    <span>{update.time}</span>
                  </div>
                  <em>{update.tag}</em>
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>

      <style>{`
        .page {
          min-height: 100vh;
          display: flex;
          background:
            radial-gradient(circle at 12% 12%, rgba(255, 232, 150, 0.45), transparent 30%),
            linear-gradient(135deg, #eef4d0 0%, #d5e8b2 48%, #8fbd68 100%);
          font-family: Arial, Helvetica, sans-serif;
          color: #173d1b;
          overflow-x: hidden;
        }

        .sidebar {
          width: 280px;
          min-height: 100vh;
          padding: 28px 22px;
          background: rgba(255, 255, 240, 0.72);
          backdrop-filter: blur(20px);
          border-right: 1px solid rgba(255, 255, 255, 0.7);
          box-shadow: 18px 0 60px rgba(42, 80, 30, 0.12);
        }

        .brand {
          display: flex;
          gap: 14px;
          align-items: center;
          margin-bottom: 36px;
        }

        .brandIcon {
          width: 54px;
          height: 54px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          background: #1f5b21;
          color: white;
          font-size: 25px;
          box-shadow: 0 14px 26px rgba(31, 91, 33, 0.24);
        }

        .brand h2 {
          margin: 0;
          font-size: 22px;
          letter-spacing: -1px;
        }

        .brand p {
          margin: 3px 0 0;
          font-size: 12px;
          font-weight: 900;
          color: #7b8d55;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        nav {
          display: grid;
          gap: 10px;
        }

        nav button {
          height: 50px;
          border: 0;
          border-radius: 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 16px;
          background: transparent;
          color: #49613f;
          font-weight: 900;
          cursor: pointer;
          text-align: left;
          transition: 220ms ease;
        }

        nav button:hover,
        nav button.active {
          background: #1f5b21;
          color: #fffde8;
          box-shadow: 0 12px 26px rgba(31, 91, 33, 0.22);
          transform: translateX(4px);
        }

        .membership {
          margin-top: 34px;
          padding: 20px;
          border-radius: 24px;
          background:
            radial-gradient(circle at top right, rgba(255, 216, 96, 0.6), transparent 45%),
            #eef7d7;
          border: 1px solid rgba(255, 255, 255, 0.8);
        }

        .membership span {
          font-size: 12px;
          color: #7b8d55;
          font-weight: 900;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .membership strong {
          display: block;
          font-size: 24px;
          margin-top: 8px;
          color: #1f5b21;
        }

        .membership p {
          color: #66785a;
          font-size: 13px;
          line-height: 1.5;
        }

        .content {
          flex: 1;
          padding: 28px;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .kicker {
          margin: 0 0 8px;
          color: #7f9252;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 4px;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          font-size: clamp(34px, 4vw, 48px);
          letter-spacing: -2px;
          color: #153f19;
        }

        .topbar span,
        .hero p,
        .statCard span,
        .treeRow span,
        .wallet span,
        .update span {
          color: #65775a;
          font-size: 14px;
        }

        .profile {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .profile button,
        .avatar {
          width: 46px;
          height: 46px;
          border: 0;
          border-radius: 16px;
          display: grid;
          place-items: center;
          background: rgba(255, 255, 243, 0.8);
          box-shadow: 0 10px 24px rgba(36, 84, 25, 0.12);
          font-weight: 900;
        }

        .avatar {
          background: #1f5b21;
          color: white;
        }

        .hero {
          position: relative;
          display: flex;
          justify-content: space-between;
          align-items: center;
          min-height: 220px;
          padding: 34px;
          border-radius: 34px;
          overflow: hidden;
          background:
            radial-gradient(circle at 78% 26%, rgba(255, 217, 89, 0.72), transparent 24%),
            linear-gradient(135deg, rgba(255,255,240,0.85), rgba(213,235,181,0.78));
          border: 1px solid rgba(255, 255, 255, 0.75);
          box-shadow: 0 24px 70px rgba(42, 90, 31, 0.18);
          margin-bottom: 22px;
        }

        .hero h2 {
          margin: 0;
          font-size: clamp(28px, 4vw, 44px);
          letter-spacing: -2px;
        }

        .hero p {
          max-width: 560px;
          line-height: 1.6;
        }

        .heroTree {
          position: relative;
          width: 210px;
          height: 160px;
          display: grid;
          place-items: center;
        }

        .sun {
          position: absolute;
          top: 0;
          right: 30px;
          font-size: 42px;
          animation: float 5s ease-in-out infinite;
        }

        .tree {
          font-size: 110px;
          filter: drop-shadow(0 18px 18px rgba(36, 84, 25, 0.18));
          animation: treePulse 4s ease-in-out infinite;
        }

        .leaf {
          position: absolute;
          font-size: 26px;
          animation: leaf 5s ease-in-out infinite;
        }

        .leaf.one { left: 10px; top: 48px; }
        .leaf.two { right: 5px; bottom: 34px; animation-delay: 1.3s; }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
          margin-bottom: 18px;
        }

        .statCard,
        .panel {
          background: rgba(255, 255, 243, 0.82);
          border: 1px solid rgba(255, 255, 255, 0.78);
          border-radius: 28px;
          box-shadow: 0 18px 45px rgba(42, 90, 31, 0.13);
          backdrop-filter: blur(18px);
        }

        .statCard {
          padding: 22px;
          transition: 220ms ease;
        }

        .statCard:hover {
          transform: translateY(-4px);
        }

        .statIcon {
          width: 48px;
          height: 48px;
          border-radius: 17px;
          display: grid;
          place-items: center;
          background: #eef7d7;
          font-size: 24px;
          margin-bottom: 14px;
        }

        .statCard p {
          margin: 0;
          color: #607254;
          font-size: 13px;
          font-weight: 900;
        }

        .statCard h3 {
          margin: 8px 0 6px;
          font-size: 27px;
          letter-spacing: -1px;
        }

        .mainGrid {
          display: grid;
          grid-template-columns: 1.5fr 0.8fr;
          gap: 18px;
        }

        .panel {
          padding: 24px;
        }

        .panel.wide {
          grid-row: span 2;
        }

        .panelHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }

        .panel h2 {
          margin: 0;
          font-size: 26px;
          letter-spacing: -1px;
        }

        .softBtn,
        .primary {
          border: 0;
          border-radius: 15px;
          font-weight: 900;
          cursor: pointer;
        }

        .softBtn {
          padding: 12px 16px;
          background: #eef7d7;
          color: #1f5b21;
        }

        .primary {
          width: 100%;
          height: 50px;
          background: #1f5b21;
          color: #fffde8;
          box-shadow: 0 12px 24px rgba(31, 91, 33, 0.22);
        }

        .treeList {
          display: grid;
          gap: 12px;
        }

        .treeRow {
          display: grid;
          grid-template-columns: 1.2fr 0.55fr 0.65fr 0.55fr 1fr;
          gap: 14px;
          align-items: center;
          padding: 16px;
          border-radius: 20px;
          background: rgba(238, 247, 215, 0.7);
        }

        .treeRow strong,
        .treeRow b {
          display: block;
          color: #173d1b;
        }

        .treeRow small {
          display: block;
          color: #7c8d60;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 5px;
        }

        .treeRow em {
          display: inline-flex;
          padding: 7px 10px;
          border-radius: 999px;
          font-style: normal;
          font-size: 12px;
          font-weight: 900;
          background: #e8f3d5;
          color: #1f5b21;
        }

        .treeRow em.monitoring {
          background: #fff1d0;
          color: #9a5d00;
        }

        .treeRow em.readysoon {
          background: #def7e6;
          color: #15703a;
        }

        .bar {
          width: 100%;
          height: 10px;
          border-radius: 999px;
          background: #d7e6c2;
          overflow: hidden;
        }

        .bar i {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #2e7d32, #b6c85f);
        }

        .wallet h2 {
          font-size: 40px;
          margin: 4px 0;
        }

        .walletBox {
          margin: 24px 0 16px;
          padding: 18px;
          border-radius: 22px;
          background: #eef7d7;
        }

        .walletBox p {
          margin: 0 0 7px;
          color: #607254;
          font-weight: 900;
          font-size: 13px;
        }

        .walletBox strong {
          font-size: 26px;
        }

        .monitorGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-top: 18px;
        }

        .monitorGrid div {
          min-height: 82px;
          display: grid;
          place-items: center;
          border-radius: 20px;
          background: #eef7d7;
          font-weight: 900;
          color: #305829;
        }

        .updates {
          display: grid;
          gap: 12px;
          margin-top: 18px;
        }

        .update {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 18px;
          background: #eef7d7;
        }

        .update strong {
          display: block;
          font-size: 14px;
        }

        .update em {
          font-style: normal;
          font-size: 11px;
          font-weight: 900;
          padding: 7px 9px;
          border-radius: 999px;
          background: white;
          color: #1f5b21;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @keyframes treePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }

        @keyframes leaf {
          0%, 100% { transform: translateY(0) rotate(-8deg); }
          50% { transform: translateY(-18px) rotate(10deg); }
        }

        @media (max-width: 1100px) {
          .page {
            flex-direction: column;
          }

          .sidebar {
            width: auto;
            min-height: auto;
          }

          nav {
            grid-template-columns: repeat(3, 1fr);
          }

          .statsGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .mainGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .content {
            padding: 18px;
          }

          .topbar,
          .hero {
            flex-direction: column;
            align-items: flex-start;
          }

          nav {
            grid-template-columns: 1fr;
          }

          .statsGrid {
            grid-template-columns: 1fr;
          }

          .treeRow {
            grid-template-columns: 1fr;
          }

          .heroTree {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}

function navIcon(item: string) {
  const icons: Record<string, string> = {
    Dashboard: "🏡",
    "My Trees": "🌳",
    Monitoring: "🛰",
    "Buy Seedlings": "🌱",
    Wallet: "💳",
    Marketplace: "🛒",
  };

  return icons[item] || "🌿";
}