"use client";

import Link from "next/link";
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
    }, 2600);

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
  const membershipStatus = profile?.membership_status || "ACTIVE";
  const careSubscription = "ACTIVE";

  return (
    <main className="dashboardPage">
      <section className="content">
        <header className="header">
          <div>
            <p className="eyebrow">Welcome back,</p>
            <h2>
              {displayName} <span>🌿</span>
            </h2>
            <small>
              Manage your agarwood investments, membership access, care services,
              wallet activity, and tree updates.
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
            icon="🎖️"
            title="Membership"
            value={membershipStatus}
            sub="184 days remaining"
            gold
          />
          <Card
            icon="🛡️"
            title="Care Subscription"
            value={careSubscription}
            sub="Covered until Jul 18"
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
            <h4>Educational development stages</h4>

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
                <span>{x[3] ? "✓" : "•"}</span>
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
            <div className="sun" />
            <div className="mist mistOne" />
            <div className="mist mistTwo" />
            <div className="hill hillOne" />
            <div className="hill hillTwo" />

            <div className="pill">☀️ Agarwood Tree Visualization</div>
            <p className="growthText">
              Morning growth guide only — not actual customer tree data.
            </p>

            <div className="forestScene">
              <div className="glowCircle" />
              <div className="leaf l1">🍃</div>
              <div className="leaf l2">🍂</div>
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
                <strong>Guide Progress</strong>
                <span>42%</span>
              </div>
              <div className="bar">
                <i />
              </div>
              <p>
                <b>Estimated Harvest Stage</b>
                <span>1 Year, 8 Months</span>
              </p>
            </div>
          </div>

          <div className="portfolio">
            <div className="panelHead">
              <h3>My Trees Overview</h3>
              <Link href="/dashboard/my-trees">View My Trees ›</Link>
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
              <Link href="/dashboard/marketplace">Buy More ›</Link>
            </div>

            <div className="inventoryList">
              <InventoryRow icon="🌱" name="Organic Fertilizer" qty="18 Bags" />
              <InventoryRow icon="🧪" name="Growth Booster" qty="12 Bottles" />
              <InventoryRow icon="🪲" name="Insecticide" qty="6 Bottles" warning />
              <InventoryRow icon="🌿" name="Fungicide" qty="8 Bottles" />
              <InventoryRow icon="🪴" name="Soil Conditioner" qty="10 Bags" />
            </div>

            <small>
              Insecticide is near low stock. Buy supplies from Marketplace when
              needed.
            </small>
          </div>

          <div className="taskOrders panel">
            <div className="panelHead">
              <h3>Task Orders</h3>
              <Link href="/dashboard/tree-operations">Open Operations ›</Link>
            </div>

            <p className="taskIntro">
              Scheduled care requirements for your trees. If subscribed,
              required items and service handling may be covered by your care
              plan.
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
              <Link href="/dashboard/tree-operations">
                {careSubscription === "ACTIVE" ? "Renew" : "Subscribe"}
              </Link>
            </div>
          </div>

          <div className="activity panel">
            <div className="panelHead">
              <h3>Notifications</h3>
              <Link href="/dashboard/transactions">View all ›</Link>
            </div>

            {[
              ["💧", "Tree AG-001", "Watering missed", "2 days ago", "danger"],
              ["🌱", "Tree AG-003", "Fertilizer scheduled", "Jun 20", "warning"],
              ["👨‍🌾", "Caretaker Report", "Care report uploaded", "Today", "ok"],
              ["📍", "Tree AG-002", "GPS verified", "Completed", "ok"],
              ["🎖️", "Membership", "Active membership access", "184 days", "ok"],
              ["👥", "Referral Bonus", "Referral reward credited", "+ ₱ 750", "ok"],
            ].map((a) => (
              <div className={`activityRow ${a[4]}`} key={`${a[1]}-${a[2]}`}>
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
          ☀️ Sustainable agarwood ownership with premium care operations.{" "}
          <span>|</span> Agarwood Investments © 2026
        </footer>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .dashboardPage {
          min-height: 100vh;
          color: #18261d;
          font-family: Arial, Helvetica, sans-serif;
        }

        .content {
          min-height: 100vh;
          padding: 26px 28px 18px;
          overflow-x: hidden;
          background:
            radial-gradient(circle at 20% 4%, rgba(255, 226, 154, .55), transparent 24%),
            radial-gradient(circle at 88% 12%, rgba(255, 255, 255, .72), transparent 28%),
            linear-gradient(180deg, #f8f4eb 0%, #f3eadb 52%, #eadcc3 100%);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 20px;
        }

        .eyebrow {
          margin: 0;
          font-weight: 900;
          color: #6e552d;
          letter-spacing: .3px;
        }

        .header h2 {
          margin: 4px 0 5px;
          font-size: 34px;
          line-height: 1;
          letter-spacing: -1px;
          color: #101a14;
        }

        .header small {
          color: #5f665e;
          font-size: 15px;
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
          border: 1px solid rgba(92, 70, 35, .08);
          border-radius: 16px;
          background: rgba(255, 253, 246, .72);
          box-shadow: 0 14px 32px rgba(82, 60, 27, .08);
          cursor: pointer;
          font-size: 20px;
        }

        .headerActions i {
          position: absolute;
          right: 8px;
          top: 5px;
          background: #8a6a2f;
          color: white;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          font-size: 11px;
          display: grid;
          place-items: center;
          font-style: normal;
        }

        .topAvatar {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: linear-gradient(135deg, #244536, #10281f);
          border: 2px solid rgba(189, 167, 123, .55);
          display: grid;
          place-items: center;
          color: white;
          font-weight: 900;
          box-shadow: 0 12px 28px rgba(33, 54, 39, .18);
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
        }

        .stat {
          min-height: 138px;
          border-radius: 20px;
          background: rgba(255, 253, 246, .82);
          border: 1px solid rgba(92, 70, 35, .08);
          display: flex;
          align-items: center;
          gap: 19px;
          padding: 20px;
          box-shadow: 0 18px 40px rgba(82, 60, 27, .08);
        }

        .statIcon {
          width: 68px;
          height: 68px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: radial-gradient(circle, #f5e8c9, #d9ccb0);
          font-size: 29px;
          box-shadow: inset -10px -12px 20px rgba(103, 78, 35, .12);
        }

        .statIcon.gold {
          background: radial-gradient(circle, #fff2bc, #c9a34d);
        }

        .stat p {
          margin: 0 0 8px;
          font-size: 13px;
          color: #5f665e;
          font-weight: 800;
        }

        .stat h3 {
          margin: 0 0 8px;
          font-size: 29px;
          letter-spacing: -1px;
          color: #101a14;
        }

        .stat small {
          color: #6e552d;
          font-weight: 900;
        }

        .mainGrid {
          display: grid;
          grid-template-columns: 240px 1.4fr 1fr;
          gap: 16px;
        }

        .journey, .growthCard, .portfolio, .panel {
          border-radius: 20px;
          box-shadow: 0 18px 42px rgba(82, 60, 27, .09);
          border: 1px solid rgba(92, 70, 35, .08);
        }

        .journey {
          background: rgba(255, 253, 246, .82);
          padding: 20px;
          min-height: 520px;
        }

        .journey h3, .journey h4 {
          margin: 0;
        }

        .journey h3 {
          color: #17271d;
        }

        .journey h4 {
          margin-top: 12px;
          color: #8c6a3c;
          font-size: 14px;
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
          background: #d9ccb0;
        }

        .step:first-of-type:before { display: none; }

        .step.current {
          background: linear-gradient(90deg, #f2e4c6, #e0cfaa);
          box-shadow: inset 0 0 0 1px rgba(140, 106, 60, .12);
        }

        .step span {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #31553d;
          color: white;
          font-size: 12px;
          z-index: 2;
          flex: 0 0 auto;
        }

        .step div strong {
          font-size: 14px;
          color: #17271d;
        }

        .step div p {
          margin: 5px 0 0;
          font-size: 13px;
          color: #6c675b;
        }

        .step div small {
          display: block;
          margin-top: 3px;
          font-size: 11px;
          color: #817866;
        }

        .step b {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #8c6a3c;
          margin-left: auto;
        }

        .growthCard {
          position: relative;
          overflow: hidden;
          min-height: 520px;
          background:
            radial-gradient(circle at 16% 12%, rgba(255, 232, 161, .95), transparent 18%),
            radial-gradient(circle at 30% 18%, rgba(255, 205, 94, .35), transparent 28%),
            radial-gradient(circle at 78% 36%, rgba(255,255,255,.30), transparent 34%),
            linear-gradient(180deg, #f6e3bb 0%, #e1d6ba 34%, #b9bea3 68%, #798b72 100%);
        }

        .sun {
          position: absolute;
          width: 150px;
          height: 150px;
          left: 36px;
          top: 24px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255, 241, 184, .9), rgba(255, 197, 79, .35), transparent 70%);
          filter: blur(2px);
          z-index: 1;
        }

        .mist {
          position: absolute;
          left: -8%;
          right: -8%;
          height: 72px;
          border-radius: 999px;
          background: rgba(255,255,255,.22);
          filter: blur(18px);
          z-index: 1;
        }

        .mistOne { top: 180px; animation: driftMist 9s ease-in-out infinite; }
        .mistTwo { top: 250px; opacity: .7; animation: driftMist 12s ease-in-out infinite reverse; }

        .hill {
          position: absolute;
          bottom: 0;
          border-radius: 50% 50% 0 0;
          background: rgba(49, 85, 61, .28);
          z-index: 1;
        }

        .hillOne {
          width: 78%;
          height: 190px;
          left: -12%;
        }

        .hillTwo {
          width: 82%;
          height: 230px;
          right: -20%;
          background: rgba(74, 93, 61, .22);
        }

        .pill {
          position: absolute;
          top: 28px;
          left: 50%;
          transform: translateX(-50%);
          padding: 10px 22px;
          border-radius: 999px;
          background: rgba(49, 85, 61, .92);
          color: #fff7df;
          font-weight: 900;
          z-index: 5;
          white-space: nowrap;
          box-shadow: 0 14px 30px rgba(46, 53, 31, .18);
        }

        .growthText {
          position: absolute;
          top: 74px;
          left: 0;
          right: 0;
          text-align: center;
          color: #fffaf0;
          z-index: 5;
          font-weight: 800;
          text-shadow: 0 2px 8px rgba(80, 55, 24, .28);
        }

        .forestScene {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          padding-top: 80px;
          z-index: 3;
        }

        .glowCircle {
          position: absolute;
          width: 430px;
          height: 430px;
          border-radius: 50%;
          border: 3px solid rgba(255, 236, 178, .52);
          border-left-color: rgba(255,255,255,.20);
          border-bottom-color: rgba(255,255,255,.12);
          filter: drop-shadow(0 0 18px rgba(255, 213, 119, .38));
          animation: rotateGlow 9s linear infinite;
        }

        .treeStage {
          position: relative;
          width: 260px;
          height: 315px;
          transform-origin: bottom center;
          animation: treeBreath 3.5s ease-in-out infinite;
          z-index: 3;
        }

        .soil {
          position: absolute;
          left: 30px;
          bottom: 0;
          width: 200px;
          height: 38px;
          border-radius: 50%;
          background: #2b1b0c;
          box-shadow: 0 15px 28px rgba(0,0,0,.28);
        }

        .trunk {
          position: absolute;
          left: 108px;
          bottom: 22px;
          width: 44px;
          height: 195px;
          border-radius: 24px;
          background:
            linear-gradient(90deg, #3c1e0d, #8b5620 42%, #4f2b12),
            repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0 2px, transparent 2px 7px);
          overflow: hidden;
          box-shadow: inset -9px 0 12px rgba(0,0,0,.22);
        }

        .trunk i,
        .trunk em {
          position: absolute;
          display: block;
          width: 7px;
          border-radius: 999px;
          background: rgba(38, 18, 8, .62);
        }

        .trunk i {
          height: 155px;
          left: 10px;
          top: 24px;
          transform: rotate(4deg);
        }

        .trunk em {
          height: 112px;
          right: 8px;
          top: 60px;
          transform: rotate(-5deg);
        }

        .resinGlow {
          position: absolute;
          left: 124px;
          bottom: 100px;
          width: 15px;
          height: 78px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(255, 204, 76, .95), rgba(133, 75, 24, .12));
          filter: drop-shadow(0 0 10px rgba(255, 190, 65, .7));
          opacity: .86;
          animation: resinPulse 3.5s ease-in-out infinite;
        }

        .branch {
          position: absolute;
          height: 13px;
          border-radius: 20px;
          background: #5c3216;
        }

        .b1 { left: 52px; bottom: 145px; width: 90px; transform: rotate(-32deg); }
        .b2 { right: 54px; bottom: 148px; width: 92px; transform: rotate(34deg); }
        .b3 { left: 72px; bottom: 192px; width: 70px; transform: rotate(-24deg); }
        .b4 { right: 75px; bottom: 197px; width: 72px; transform: rotate(25deg); }

        .crown {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #9ab268, #31553d 72%);
          box-shadow: inset -14px -18px 30px rgba(0,0,0,.16);
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
          opacity: .35;
        }

        .stage4 { transform: scale(1); }
        .stage5 { transform: scale(1.12); }

        .leaf {
          position: absolute;
          font-size: 22px;
          z-index: 2;
          animation: leafFloat 5.5s ease-in-out infinite;
          opacity: .72;
        }

        .l1 { left: 18%; top: 32%; }
        .l2 { right: 17%; top: 25%; animation-delay: 1s; }
        .l3 { right: 25%; bottom: 39%; animation-delay: 1.8s; }

        .progressGlass {
          position: absolute;
          left: 26px;
          right: 26px;
          bottom: 24px;
          padding: 18px;
          border-radius: 18px;
          color: #fff8e6;
          background: rgba(36, 69, 54, .62);
          border: 1px solid rgba(255,255,255,.18);
          backdrop-filter: blur(13px);
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
          background: linear-gradient(90deg, #f4d37a, #bda77b);
          animation: loadBar 2.4s ease-out infinite alternate;
        }

        .portfolio {
          background: linear-gradient(145deg, #244536, #10281f);
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

        .panelHead a {
          color: inherit;
          text-decoration: none;
          font-weight: 900;
        }

        .treeOverviewHero {
          margin: 26px auto 20px;
          width: 170px;
          height: 170px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, #d6c28c, #31553d 72%);
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
          border-bottom: 1px solid rgba(255,255,255,.13);
        }

        .overviewRow p {
          margin: 0;
          color: rgba(255,255,255,.76);
        }

        .overviewRow b {
          color: white;
        }

        .overviewRow.alert b {
          color: #f4d37a;
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
          border-bottom: 1px solid rgba(92, 70, 35, .10);
        }

        .inventoryRow .icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #efe3cc;
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
          color: #a66c22;
        }

        .inventory small {
          display: block;
          color: #6e552d;
          margin-top: 15px;
          font-weight: 900;
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
          border: 1px solid rgba(92, 70, 35, .06);
        }

        .taskOrder .taskIcon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #efe3cc;
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
          color: #31553d;
        }

        .taskCode {
          display: inline-block;
          margin-bottom: 3px;
          font-size: 10px;
          font-weight: 900;
          color: #8c6a3c;
          letter-spacing: .6px;
        }

        .subscriptionBox {
          margin-top: 14px;
          border-radius: 16px;
          background: linear-gradient(135deg, #244536, #10281f);
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

        .subscriptionBox a {
          border-radius: 12px;
          background: #d6b25e;
          color: #10281f;
          padding: 10px 14px;
          font-weight: 900;
          text-decoration: none;
          white-space: nowrap;
        }

        .activityRow {
          display: grid;
          grid-template-columns: 42px 1fr auto;
          align-items: center;
          gap: 12px;
          padding: 13px 0;
          border-bottom: 1px solid rgba(92, 70, 35, .10);
        }

        .activityRow span {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #efe3cc;
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
          color: #31553d;
          font-size: 13px;
          text-align: right;
        }

        .activityRow.danger b {
          color: #a33c2a;
        }

        .activityRow.warning b {
          color: #a66c22;
        }

        footer {
          text-align: center;
          color: #776e5f;
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
          0%, 100% { filter: saturate(.95); }
          50% { filter: saturate(1.08) brightness(1.04); }
        }

        @keyframes resinPulse {
          0%, 100% { opacity: .48; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-4px); }
        }

        @keyframes leafFloat {
          0%, 100% { transform: translateY(0) rotate(-10deg); opacity: .62; }
          50% { transform: translateY(-22px) rotate(15deg); opacity: .9; }
        }

        @keyframes loadBar {
          from { width: 35%; }
          to { width: 42%; }
        }

        @keyframes driftMist {
          0%, 100% { transform: translateX(-22px); }
          50% { transform: translateX(28px); }
        }

        @media (max-width: 1280px) {
          .stats { grid-template-columns: repeat(2, 1fr); }
          .mainGrid { grid-template-columns: 220px 1fr; }
          .portfolio, .activity { grid-column: 1 / -1; }
          .inventory { grid-column: 1 / 2; }
          .taskOrders { grid-column: 2 / 3; }
        }

        @media (max-width: 900px) {
          .content { padding: 18px; }
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