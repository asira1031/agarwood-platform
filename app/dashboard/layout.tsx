// app/dashboard/layout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";

type NavItem = {
  label: string;
  href: string;
  shortLabel?: string;
  icon: string;
};

const DESKTOP_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "⌂" },
  { label: "My Trees", href: "/dashboard/my-trees", icon: "🌳" },
  { label: "Tree Operations", href: "/dashboard/tree-operations", icon: "🛠" },
  { label: "Marketplace", href: "/dashboard/marketplace", icon: "🛒" },
  { label: "Investments", href: "/dashboard/investments", icon: "📈" },
  { label: "Earnings", href: "/dashboard/earnings", icon: "💰" },
  { label: "Sell Tree", href: "/dashboard/sell-tree", icon: "🌿" },
  { label: "Wallet", href: "/dashboard/wallet", icon: "💳" },
  { label: "Transactions", href: "/dashboard/transactions", icon: "🧾" },
  { label: "Referrals", href: "/dashboard/referrals", icon: "🤝" },
  { label: "Membership", href: "/dashboard/membership", icon: "✦" },
  { label: "Profile", href: "/dashboard/profile", icon: "👤" },
  { label: "Settings", href: "/dashboard/settings", icon: "⚙" },
  { label: "Support", href: "/dashboard/support", icon: "💬" },
];

const MOBILE_NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: "⌂" },
  { label: "Trees", href: "/dashboard/my-trees", icon: "🌳" },
  { label: "Market", href: "/dashboard/marketplace", icon: "🛒" },
  { label: "Wallet", href: "/dashboard/wallet", icon: "💳" },
  { label: "Support", href: "/dashboard/support", icon: "💬" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    async function checkAccess() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const userEmail = user.email?.trim().toLowerCase() || "";

      const { data: profileById } = await supabase
        .from("profiles")
        .select("id,email")
        .eq("id", user.id)
        .maybeSingle();

      const { data: profileByEmail } = userEmail
        ? await supabase
            .from("profiles")
            .select("id,email")
            .ilike("email", userEmail)
            .maybeSingle()
        : { data: null };

      const profile = profileById || profileByEmail;

      const { data: adminByEmail } = userEmail
        ? await supabase.from("admins").select("id").ilike("email", userEmail).eq("status", "ACTIVE").maybeSingle()
        : { data: null };
      const { data: adminByProfile } = profile?.id
        ? await supabase.from("admins").select("id").eq("admin_profile_id", profile.id).eq("status", "ACTIVE").maybeSingle()
        : { data: null };

      if (adminByEmail || adminByProfile) {
        window.location.href = "/admin/dashboard";
        return;
      }

      const { data: caretakerByEmail } = userEmail
        ? await supabase.from("caretakers").select("id").ilike("email", userEmail).eq("status", "ACTIVE").maybeSingle()
        : { data: null };
      const { data: caretakerByProfile } = profile?.id
        ? await supabase.from("caretakers").select("id").eq("caretaker_profile_id", profile.id).eq("status", "ACTIVE").maybeSingle()
        : { data: null };

      if (caretakerByEmail || caretakerByProfile) {
        window.location.href = "/gardener/dashboard";
        return;
      }

      setAllowed(true);
    }

    checkAccess();
  }, []);

  const activeLabel = useMemo(() => {
    const match =
      DESKTOP_NAV_ITEMS.find((item) => isActivePath(pathname || "/dashboard", item.href)) ||
      DESKTOP_NAV_ITEMS[0];

    return match.label;
  }, [pathname]);

  if (!allowed) {
    return (
      <main className="customerLoading">
        <section className="loadingCard">
          <div className="loadingLogo">A</div>
          <p>Arganwood Customer App</p>
          <h1>Preparing your forest home...</h1>
          <span>Checking secure customer access.</span>
        </section>

        <style>{styles}</style>
      </main>
    );
  }

  return (
    <main className="customerShell">
      <aside className="desktopSidebar">
        <div className="brandCard">
          <div className="brandMark">A</div>
          <div>
            <strong>Arganwood</strong>
            <span>Customer App</span>
          </div>
        </div>

        <nav className="desktopNav" aria-label="Customer dashboard navigation">
          {DESKTOP_NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname || "/dashboard", item.href);

            return (
              <Link key={item.href} href={item.href} className={active ? "active" : ""}>
                <span className="navIcon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebarFooter">
          <span>Live portfolio</span>
          <strong>Forest synced</strong>
        </div>
      </aside>

      <section className="customerFrame">
        <header className="shellHeader">
          <div>
            <p>Customer Portal</p>
            <h2>{activeLabel}</h2>
          </div>

          <div className="headerPills">
            <Link href="/dashboard/wallet">Wallet</Link>
            <Link href="/dashboard/support">Support</Link>
          </div>
        </header>

        <section className="contentFrame">{children}</section>
      </section>

      <nav className="mobileBottomNav" aria-label="Mobile customer navigation">
        {MOBILE_NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname || "/dashboard", item.href);

          return (
            <Link key={item.href} href={item.href} className={active ? "active" : ""}>
              <span>{item.icon}</span>
              <small>{item.label}</small>
            </Link>
          );
        })}
      </nav>

      <style>{styles}</style>
    </main>
  );
}

const styles = `
  * {
    box-sizing: border-box;
  }

  .customerLoading {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
    color: #fff8dc;
    font-family: Arial, Helvetica, sans-serif;
    background:
      radial-gradient(circle at 18% 4%, rgba(214, 178, 94, .26), transparent 28%),
      radial-gradient(circle at 90% 12%, rgba(58, 141, 88, .20), transparent 28%),
      linear-gradient(180deg, #06110d 0%, #0b2117 55%, #030b07 100%);
  }

  .loadingCard {
    width: min(440px, 100%);
    border-radius: 34px;
    padding: 34px;
    text-align: center;
    border: 1px solid rgba(214, 178, 94, .22);
    background: rgba(255, 255, 255, .08);
    box-shadow: 0 32px 90px rgba(0, 0, 0, .34);
    backdrop-filter: blur(18px);
  }

  .loadingLogo {
    width: 70px;
    height: 70px;
    display: grid;
    place-items: center;
    margin: 0 auto 16px;
    border-radius: 24px;
    color: #07140f;
    background: linear-gradient(135deg, #d6b25e, #8c6a3c);
    font-size: 34px;
    font-weight: 950;
    box-shadow: 0 18px 40px rgba(0, 0, 0, .24);
  }

  .loadingCard p {
    margin: 0 0 8px;
    color: #d6b25e;
    font-size: 12px;
    font-weight: 950;
    letter-spacing: .18em;
    text-transform: uppercase;
  }

  .loadingCard h1 {
    margin: 0;
    color: #fff8dc;
    font-size: 30px;
    letter-spacing: -.9px;
  }

  .loadingCard span {
    display: block;
    margin-top: 10px;
    color: rgba(248, 241, 216, .68);
    font-weight: 800;
  }

  .customerShell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 292px minmax(0, 1fr);
    color: #15291e;
    font-family: Arial, Helvetica, sans-serif;
    background:
      radial-gradient(circle at 12% -4%, rgba(214, 178, 94, .18), transparent 28%),
      radial-gradient(circle at 96% 4%, rgba(34, 113, 70, .12), transparent 30%),
      linear-gradient(180deg, #fffaf0 0%, #f7f0df 46%, #eef5e9 100%);
  }

  .desktopSidebar {
    position: sticky;
    top: 0;
    height: 100vh;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 18px;
    padding: 20px;
    overflow: hidden;
    color: #fff8dc;
    background:
      radial-gradient(circle at 18% 0%, rgba(214,178,94,.22), transparent 28%),
      linear-gradient(180deg, #071f16 0%, #07140f 100%);
    border-right: 1px solid rgba(214, 178, 94, .20);
    box-shadow: 24px 0 70px rgba(22, 48, 32, .12);
  }

  .desktopSidebar:before {
    content: "";
    position: absolute;
    inset: 0;
    opacity: .30;
    background:
      radial-gradient(circle at 20% 88%, rgba(214,178,94,.18), transparent 24%),
      repeating-linear-gradient(120deg, rgba(255,255,255,.045) 0 1px, transparent 1px 12px);
    pointer-events: none;
  }

  .brandCard,
  .desktopNav,
  .sidebarFooter {
    position: relative;
    z-index: 1;
  }

  .brandCard {
    display: flex;
    align-items: center;
    gap: 12px;
    border-radius: 26px;
    padding: 13px;
    background: rgba(255,255,255,.08);
    border: 1px solid rgba(214, 178, 94, .18);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
  }

  .brandMark {
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    border-radius: 18px;
    color: #07140f;
    background: linear-gradient(135deg, #d6b25e, #8c6a3c);
    font-size: 24px;
    font-weight: 950;
  }

  .brandCard strong,
  .brandCard span {
    display: block;
  }

  .brandCard strong {
    color: #fff8dc;
    font-size: 18px;
  }

  .brandCard span {
    margin-top: 2px;
    color: rgba(248, 241, 216, .62);
    font-size: 12px;
    font-weight: 850;
  }

  .desktopNav {
    display: grid;
    gap: 6px;
    align-content: start;
    overflow-y: auto;
    padding-right: 2px;
  }

  .desktopNav::-webkit-scrollbar {
    width: 4px;
  }

  .desktopNav::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: rgba(214,178,94,.28);
  }

  .desktopNav a {
    position: relative;
    display: flex;
    align-items: center;
    gap: 11px;
    min-height: 44px;
    border-radius: 18px;
    padding: 10px 12px;
    color: rgba(248, 241, 216, .72);
    text-decoration: none;
    font-size: 14px;
    font-weight: 900;
    transition: transform .16s ease, background .16s ease, color .16s ease;
  }

  .desktopNav a:hover {
    transform: translateX(2px);
    color: #fff8dc;
    background: rgba(255,255,255,.07);
  }

  .desktopNav a.active {
    color: #07140f;
    background: linear-gradient(135deg, #d6b25e, #8c6a3c);
    box-shadow: 0 16px 34px rgba(0,0,0,.22);
  }

  .navIcon {
    width: 29px;
    height: 29px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    border-radius: 12px;
    background: rgba(255,255,255,.08);
    font-size: 14px;
  }

  .desktopNav a.active .navIcon {
    background: rgba(255,255,255,.30);
  }

  .sidebarFooter {
    border-radius: 24px;
    padding: 15px;
    background:
      radial-gradient(circle at 88% 10%, rgba(214,178,94,.22), transparent 32%),
      rgba(255,255,255,.08);
    border: 1px solid rgba(214,178,94,.16);
  }

  .sidebarFooter span,
  .sidebarFooter strong {
    display: block;
  }

  .sidebarFooter span {
    color: rgba(248,241,216,.60);
    font-size: 11px;
    font-weight: 950;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  .sidebarFooter strong {
    margin-top: 6px;
    color: #d6b25e;
    font-size: 18px;
  }

  .customerFrame {
    min-width: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .shellHeader {
    position: sticky;
    top: 0;
    z-index: 15;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    min-height: 74px;
    padding: 16px 22px 8px;
    background: linear-gradient(180deg, rgba(255,250,240,.92), rgba(255,250,240,.58));
    backdrop-filter: blur(18px);
  }

  .shellHeader p {
    margin: 0 0 3px;
    color: #9a7738;
    font-size: 11px;
    font-weight: 950;
    letter-spacing: .14em;
    text-transform: uppercase;
  }

  .shellHeader h2 {
    margin: 0;
    color: #10251a;
    font-size: 24px;
    letter-spacing: -.5px;
  }

  .headerPills {
    display: flex;
    gap: 9px;
  }

  .headerPills a {
    border-radius: 999px;
    padding: 10px 13px;
    color: #173f2a;
    text-decoration: none;
    background: rgba(255,255,255,.80);
    border: 1px solid rgba(32,71,50,.10);
    box-shadow: 0 12px 25px rgba(31,57,38,.08);
    font-size: 13px;
    font-weight: 950;
  }

  .contentFrame {
    min-width: 0;
  }

  .contentFrame > * {
    min-width: 0;
  }

  .mobileBottomNav {
    display: none;
  }

  @media (max-width: 1180px) {
    .customerShell {
      grid-template-columns: 248px minmax(0, 1fr);
    }

    .desktopSidebar {
      padding: 16px;
    }

    .desktopNav a {
      font-size: 13px;
      padding-inline: 10px;
    }
  }

  @media (max-width: 920px) {
    .customerShell {
      display: block;
      padding-bottom: 92px;
    }

    .desktopSidebar {
      display: none;
    }

    .shellHeader {
      min-height: 68px;
      padding: 14px 16px 8px;
    }

    .shellHeader h2 {
      font-size: 22px;
    }

    .headerPills a {
      padding: 9px 11px;
    }

    .mobileBottomNav {
      position: fixed;
      left: 12px;
      right: 12px;
      bottom: 12px;
      z-index: 50;
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 6px;
      padding: 8px;
      border-radius: 28px;
      background: rgba(7, 31, 22, .92);
      border: 1px solid rgba(214,178,94,.20);
      box-shadow: 0 24px 60px rgba(0,0,0,.28);
      backdrop-filter: blur(18px);
    }

    .mobileBottomNav a {
      min-width: 0;
      display: grid;
      place-items: center;
      gap: 3px;
      padding: 8px 4px;
      border-radius: 20px;
      color: rgba(248,241,216,.72);
      text-decoration: none;
      font-weight: 900;
    }

    .mobileBottomNav a.active {
      color: #07140f;
      background: linear-gradient(135deg, #d6b25e, #8c6a3c);
    }

    .mobileBottomNav span {
      font-size: 17px;
      line-height: 1;
    }

    .mobileBottomNav small {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 10px;
    }
  }

  @media (max-width: 640px) {
    .shellHeader {
      align-items: flex-start;
    }

    .headerPills {
      display: none;
    }
  }
`;
