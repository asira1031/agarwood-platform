"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  membership_status: string | null;
  kyc_status: string | null;
  account_status: string | null;
};

export default function DashboardPage() {
  const [stage, setStage] = useState(3);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setStage((s) => (s >= 5 ? 1 : s + 1));
    }, 2400);

    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const email = user.email?.trim().toLowerCase() || "";

      const { data: profileById } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, membership_status, kyc_status, account_status"
        )
        .eq("id", user.id)
        .maybeSingle();

      const { data: profileByEmail } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, membership_status, kyc_status, account_status"
        )
        .eq("email", email)
        .maybeSingle();

      setProfile(profileById || profileByEmail);
    }

    loadProfile();
  }, []);

  const displayName = profile?.full_name || "Agarwood Investor";
  const initials = getInitials(displayName);
  const careSubscription = "ACTIVE";

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
            ["🛠️", "Tree Operations"],
            ["🛒", "Marketplace"],
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
          <div className="avatar">{initials}</div>
          <div>
            <strong>{displayName}</strong>
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
              {displayName} <span>🍃</span>
            </h2>
            <small>
              Monitor your agarwood ownership, task orders, care subscription,
              and tree updates.
            </small>
          </div>

          <div className="headerActions">
            <button>
              🔔<i>5</i>
            </button>
            <button>
              ✉️<i>2</i>
            </button>
            <div className="topAvatar">{initials}</div>
          </div>
        </header>

        <section className="stats">
          <Card
            icon="🌳"
            title="Owned Trees"
            value="128"
            sub="78 individual • 50 package"
          />
          <Card
            icon="📋"
            title="Care Tasks Due"
            value="5"
            sub="Task orders scheduled"
          />
          <Card
            icon="🛡️"
            title="Care Subscription"
            value={careSubscription}
            sub="Covered until Jul 18"
            gold
          />
          <Card
            icon="💳"
            title="Wallet Balance"
            value="₱ 12,340"
            sub="Available balance"
          />
        </section>

        <section className="mainGrid">
          <div className="journey">
            <h3>Agarwood Growth Guide</h3>
            <h4>How agarwood develops 🍃</h4>

            {[
              [
                "Seedling",
                "0 - 6 Months",
                "Early root stage; photo may be limited",
                true,
              ],
              [
                "Sapling",
                "6 - 18 Months",
                "Visible stem and leaves begin",
                true,
              ],
              [
                "Young Tree",
                "1.5 - 3 Years",
                "Active growth and care monitoring",
                true,
              ],
              [
                "Mature Tree",
                "3 - 7 Years",
                "Trunk mass and value development",
                false,
              ],
              [
                "Harvest Ready",
                "7+ Years",
                "Eligible for sell or harvest review",
                false,
              ],
            ].map((x, i) => (
              <div
                className={`step ${i === 2 ? "current" : ""}`}
                key={x[0] as string}
              >
                <span>{x[3] ? "✓" : "🔒"}</span>
                <div>
                  <strong>{x[0]}</strong>
                  <p>{x[1]}</p>
                  <small>{x[2]}</small>
                </div>
                {i === 2 && <b />}
              </div>
            ))}
          </div>

          <div className="growthCard">
            <div className="pill">🍃 Agarwood Tree Visualization</div>
            <p className="growthText">
              Demo growth cycle: seedling to harvest-ready agarwood.
            </p>

            <div className="forestScene">
              <div className="glowCircle" />
              <div className="leaf l1">🍃</div>
              <div className="leaf l2">🍃</div>
              <div className="leaf l3">🍃</div>

              <div className={`treeStage stage${stage}`}>
                <div className="soil" />
                <div className="trunk">
                  <i />
                  <em />
                </div>
                <div className="branch b1" />
                <div className="branch b2" />
                <div className="branch b3" />
                <div className="branch b4" />
                <div className="crown c1" />
                <div className="crown c2" />
                <div className="crown c3" />
                <div className="crown c4" />
                <div className="resinGlow" />
              </div>
            </div>

            <div className="progressGlass">
              <div>
                <strong>Growth Progress</strong>
                <span>42%</span>
              </div>
              <div className="bar">
                <i />
              </div>
              <p>
                <b>Estimated Harvest</b>
                <span>1 Year, 8 Months</span>
              </p>
            </div>
          </div>

          <div className="portfolio">
            <div className="panelHead">
              <h3>My Trees Overview</h3>
              <button>View My Trees ›</button>
            </div>

            <div className="treeOverviewHero">
              <div>
                <strong>128</strong>
                <span>Owned Trees</span>
              </div>
            </div>

            <div className="overviewRows">
              <OverviewRow label="Individual Trees" value="78" />
              <OverviewRow label="Package Trees" value="50" />
              <OverviewRow label="Latest Photo Update" value="Jun 18" />
              <OverviewRow label="GPS Verification" value="Verified" />
              <OverviewRow label="Care Subscription" value="Active" />
              <OverviewRow label="Trees Needing Attention" value="5" alert />
            </div>
          </div>

          <div className="inventory panel">
            <div className="panelHead">
              <h3>Inventory</h3>
              <button>Buy More ›</button>
            </div>

            <div className="inventoryList">
              <InventoryRow icon="🌱" name="Organic Fertilizer" qty="18 Bags" />
              <InventoryRow icon="🧪" name="Growth Booster" qty="12 Bottles" />
              <InventoryRow icon="🪲" name="Insecticide" qty="6 Bottles" warning />
              <InventoryRow icon="🌿" name="Fungicide" qty="8 Bottles" />
              <InventoryRow icon="🪴" name="Soil Conditioner" qty="10 Bags" />
            </div>

            <small>
              ⚠ Insecticide is near low stock. Buy supplies from Marketplace
              when needed.
            </small>
          </div>

          <div className="taskOrders panel">
            <div className="panelHead">
              <h3>Task Orders</h3>
              <button>Open Operations ›</button>
            </div>

            <p className="taskIntro">
              Scheduled care requirements for your trees. If subscribed, required
              items and service handling are covered by your care plan.
            </p>

            <div className="taskList">
              <TaskOrder
                code="TO-001"
                icon="🌱"
                title="Organic Fertilizer"
                tree="Tree AG-003"
                date="Jun 20"
                status="Covered by Care Plan"
                covered
              />
              <TaskOrder
                code="TO-002"
                icon="🧪"
                title="Growth Booster"
                tree="Tree AG-008"
                date="Jun 25"
                status="Covered by Care Plan"
                covered
              />
              <TaskOrder
                code="TO-003"
                icon="🪲"
                title="Insecticide"
                tree="Tree AG-011"
                date="Jul 01"
                status="Awaiting Schedule"
              />
              <TaskOrder
                code="TO-004"
                icon="🌿"
                title="Fungicide"
                tree="Tree AG-014"
                date="Jul 08"
                status="Awaiting Schedule"
              />
            </div>

            <div className="subscriptionBox">
              <div>
                <strong>Managed Care Subscription</strong>
                <p>Care service status: {careSubscription}</p>
              </div>
              <button>{careSubscription === "ACTIVE" ? "Renew" : "Subscribe"}</button>
            </div>
          </div>

          <div className="activity panel">
            <div className="panelHead">
              <h3>Notifications</h3>
              <button>View all ›</button>
            </div>

            {[
              ["💧", "Tree AG-001", "Watering missed", "2 days ago"],
              ["🌱", "Tree AG-003", "Fertilizer scheduled", "Jun 20"],
              ["👨‍🌾", "Caretaker Report", "Care report uploaded", "Today"],
              ["📍", "Tree AG-002", "GPS verified", "Completed"],
              ["🛡️", "Care Subscription", "Expires in 3 days", "Renew soon"],
              ["👥", "Referral Bonus", "Referral reward credited", "+ ₱ 750"],
            ].map((a) => (
              <div className="activityRow" key={`${a[1]}-${a[2]}`}>
                <span>{a[0]}</span>
                <div>
                  <strong>{a[1]}</strong>
                  <p>{a[2]}</p>
                </div>
                <b>{a[3]}</b>
              </div>
            ))}
          </div>
        </section>

        <footer>
          🍃 Thank you for being part of a greener tomorrow. <span>|</span>{" "}
          Agarwood Investments © 2026
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
          min-height: 50px;
          border: 0;
          border-radius: 13px;
          background: transparent;
          color: #f6fff5;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 0 20px;
          font-size: 15px;
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
          min-height: 190px;
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

        .journey, .growthCard, .portfolio, .panel {
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
          padding: 13px 10px;
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
          flex: 0 0 auto;
        }
        .step div strong {
          font-size: 14px;
        }
        .step div p {
          margin: 5px 0 0;
          font-size: 13px;
          color: #596056;
        }
        .step div small {
          display: block;
          margin-top: 3px;
          font-size: 11px;
          color: #7c8378;
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
          width: 440px;
          height: 440px;
          border-radius: 50%;
          border: 4px solid rgba(110, 255, 123, .75);
          border-left-color: rgba(255,255,255,.25);
          border-bottom-color: rgba(255,255,255,.18);
          filter: drop-shadow(0 0 20px rgba(80, 255, 115, .6));
          animation: rotateGlow 7s linear infinite;
        }

        .treeStage {
          position: relative;
          width: 260px;
          height: 315px;
          transform-origin: bottom center;
          animation: treeBreath 3s ease-in-out infinite;
          z-index: 3;
        }
        .soil {
          position: absolute;
          left: 32px;
          bottom: 0;
          width: 196px;
          height: 38px;
          border-radius: 50%;
          background: #2b1b0c;
          box-shadow: 0 15px 28px rgba(0,0,0,.35);
        }
        .trunk {
          position: absolute;
          left: 112px;
          bottom: 22px;
          width: 35px;
          height: 190px;
          border-radius: 20px;
          background: linear-gradient(90deg, #5a2c0f, #b26a20 45%, #6a3d15);
          overflow: hidden;
          box-shadow: inset -7px 0 10px rgba(0,0,0,.18);
        }
        .trunk i,
        .trunk em {
          position: absolute;
          display: block;
          width: 7px;
          border-radius: 999px;
          background: rgba(54, 22, 7, .55);
        }
        .trunk i {
          height: 150px;
          left: 9px;
          top: 24px;
          transform: rotate(4deg);
        }
        .trunk em {
          height: 105px;
          right: 7px;
          top: 62px;
          transform: rotate(-5deg);
        }

        .resinGlow {
          position: absolute;
          left: 122px;
          bottom: 98px;
          width: 16px;
          height: 70px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(255, 220, 99, .8), rgba(129, 75, 23, .1));
          filter: blur(.2px);
          opacity: .82;
          animation: resinPulse 3.5s ease-in-out infinite;
        }

        .branch {
          position: absolute;
          height: 13px;
          border-radius: 20px;
          background: #7b4418;
        }
        .b1 { left: 52px; bottom: 145px; width: 90px; transform: rotate(-32deg); }
        .b2 { right: 54px; bottom: 148px; width: 92px; transform: rotate(34deg); }
        .b3 { left: 72px; bottom: 192px; width: 70px; transform: rotate(-24deg); }
        .b4 { right: 75px; bottom: 197px; width: 72px; transform: rotate(25deg); }

        .crown {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #a4d85d, #1f6c21 70%);
          box-shadow: inset -12px -16px 26px rgba(0,0,0,.12);
          transition: opacity .6s ease, transform .6s ease;
        }
        .c1 { width: 120px; height: 118px; left: 68px; top: 0; }
        .c2 { width: 140px; height: 136px; left: 13px; top: 74px; }
        .c3 { width: 148px; height: 142px; right: 5px; top: 70px; }
        .c4 { width: 190px; height: 128px; left: 34px; top: 126px; }

        .stage1 { transform: scale(.42); }
        .stage1 .branch,
        .stage1 .crown,
        .stage1 .resinGlow {
          opacity: 0;
        }
        .stage1 .trunk {
          height: 75px;
          bottom: 18px;
        }

        .stage2 { transform: scale(.62); }
        .stage2 .b3,
        .stage2 .b4,
        .stage2 .c2,
        .stage2 .c3,
        .stage2 .c4,
        .stage2 .resinGlow {
          opacity: 0;
        }
        .stage2 .trunk {
          height: 115px;
        }

        .stage3 { transform: scale(.84); }
        .stage3 .resinGlow {
          opacity: .25;
        }

        .stage4 { transform: scale(1); }
        .stage5 { transform: scale(1.12); }

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

        .portfolio {
          background: linear-gradient(145deg, #07351f, #042317);
          color: white;
          padding: 24px;
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

        .treeOverviewHero {
          margin: 26px auto 20px;
          width: 170px;
          height: 170px;
          border-radius: 50%;
          background:
            radial-gradient(circle at 35% 35%, #a7ef84, #2a8d37 70%);
          display: grid;
          place-items: center;
          box-shadow: inset -20px -25px 35px rgba(0,0,0,.18), 0 20px 50px rgba(0,0,0,.22);
        }
        .treeOverviewHero div {
          text-align: center;
        }
        .treeOverviewHero strong {
          display: block;
          font-size: 38px;
        }
        .treeOverviewHero span {
          font-size: 13px;
        }

        .overviewRows {
          display: grid;
          gap: 12px;
        }
        .overviewRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid rgba(255,255,255,.12);
        }
        .overviewRow p {
          margin: 0;
          color: rgba(255,255,255,.75);
        }
        .overviewRow b {
          color: white;
        }
        .overviewRow.alert b {
          color: #ffd166;
        }

        .panel {
          background: rgba(255, 253, 246, .86);
          padding: 22px;
          min-height: 255px;
        }
        .inventory {
          grid-column: 1 / 2;
        }
        .taskOrders {
          grid-column: 2 / 3;
        }
        .activity {
          grid-column: 3 / 4;
        }

        .inventoryList {
          margin-top: 18px;
          display: grid;
          gap: 10px;
        }
        .inventoryRow {
          display: grid;
          grid-template-columns: 36px 1fr auto;
          align-items: center;
          gap: 10px;
          padding: 9px 0;
          border-bottom: 1px solid rgba(0,0,0,.08);
        }
        .inventoryRow .icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #e3f1d6;
        }
        .inventoryRow strong {
          font-size: 13px;
        }
        .inventoryRow p {
          margin: 3px 0 0;
          font-size: 11px;
          color: #666;
        }
        .inventoryRow.warn b {
          color: #c56a00;
        }
        .inventory small {
          display: block;
          color: #08782e;
          margin-top: 15px;
          font-weight: 800;
          line-height: 1.4;
        }

        .taskIntro {
          margin: 12px 0 0;
          color: #5c6259;
          font-size: 13px;
          line-height: 1.5;
        }
        .taskList {
          margin-top: 15px;
          display: grid;
          gap: 10px;
        }
        .taskOrder {
          display: grid;
          grid-template-columns: 38px 1fr auto;
          align-items: center;
          gap: 10px;
          padding: 11px;
          border-radius: 14px;
          background: #f3ead8;
          border: 1px solid rgba(0,0,0,.04);
        }
        .taskOrder .taskIcon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #e3f1d6;
          display: grid;
          place-items: center;
        }
        .taskOrder strong {
          display: block;
          font-size: 13px;
        }
        .taskOrder p {
          margin: 3px 0 0;
          font-size: 12px;
          color: #6b6b62;
        }
        .taskOrder b {
          font-size: 11px;
          color: #6b6b62;
          text-align: right;
        }
        .taskOrder.covered b {
          color: #08782e;
        }
        .taskCode {
          display: inline-block;
          margin-bottom: 3px;
          font-size: 10px;
          font-weight: 900;
          color: #08782e;
          letter-spacing: .6px;
        }
        .subscriptionBox {
          margin-top: 14px;
          border-radius: 16px;
          background: linear-gradient(135deg, #07351f, #0e4d2e);
          color: white;
          padding: 15px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .subscriptionBox p {
          margin: 4px 0 0;
          font-size: 12px;
          color: rgba(255,255,255,.72);
        }
        .subscriptionBox button {
          border: 0;
          border-radius: 12px;
          background: #f0c458;
          color: #07351f;
          padding: 10px 14px;
          font-weight: 900;
          cursor: pointer;
          white-space: nowrap;
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
          text-align: right;
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
          0%, 100% { opacity: .45; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-4px); }
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
          .portfolio, .activity { grid-column: 1 / -1; }
          .inventory { grid-column: 1 / 2; }
          .taskOrders { grid-column: 2 / 3; }
        }

        @media (max-width: 900px) {
          .page { flex-direction: column; }
          .sidebar { width: 100%; min-height: auto; }
          nav { grid-template-columns: repeat(2, 1fr); }
          .mainGrid, .stats { grid-template-columns: 1fr; }
          .inventory, .taskOrders, .activity { grid-column: 1; }
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

function OverviewRow({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className={`overviewRow ${alert ? "alert" : ""}`}>
      <p>{label}</p>
      <b>{value}</b>
    </div>
  );
}

function InventoryRow({
  icon,
  name,
  qty,
  warning,
}: {
  icon: string;
  name: string;
  qty: string;
  warning?: boolean;
}) {
  return (
    <div className={`inventoryRow ${warning ? "warn" : ""}`}>
      <span className="icon">{icon}</span>
      <div>
        <strong>{name}</strong>
        <p>Marketplace supply</p>
      </div>
      <b>{qty}</b>
    </div>
  );
}

function TaskOrder({
  code,
  icon,
  title,
  tree,
  date,
  status,
  covered,
}: {
  code: string;
  icon: string;
  title: string;
  tree: string;
  date: string;
  status: string;
  covered?: boolean;
}) {
  return (
    <div className={`taskOrder ${covered ? "covered" : ""}`}>
      <span className="taskIcon">{icon}</span>
      <div>
        <span className="taskCode">{code}</span>
        <strong>{title}</strong>
        <p>
          {tree} • Scheduled {date}
        </p>
      </div>
      <b>{status}</b>
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
