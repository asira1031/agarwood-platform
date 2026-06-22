"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const adminLinks = [
  { label: "Dashboard", href: "/admin/dashboard", icon: "🏠" },
  { label: "Customers", href: "/admin/customers", icon: "👥" },
  { label: "KYC Review", href: "/admin/kyc", icon: "🪪" },
  { label: "Membership", href: "/admin/membership", icon: "💳" },
  { label: "Wallet", href: "/admin/wallet", icon: "💰" },
  { label: "Cash-In Approval", href: "/admin/cash-in", icon: "⬇️" },
  { label: "Withdrawal Approval", href: "/admin/withdrawals", icon: "⬆️" },
  { label: "Referrals", href: "/admin/referral-links", icon: "🔗" },
  { label: "Tree Purchases", href: "/admin/tree-purchases", icon: "🌳" },
  { label: "Sell Tree", href: "/admin/sell-tree", icon: "🤝" },
  { label: "Tree Valuation", href: "/admin/tree-valuation", icon: "📈" },
  { label: "Operations Queue", href: "/admin/operations", icon: "🧾" },
  { label: "Inventory", href: "/admin/inventory", icon: "📦" },
  { label: "Support Tickets", href: "/admin/support", icon: "🎧" },
  { label: "Reports", href: "/admin/reports", icon: "📊" },
  { label: "Settings", href: "/admin/settings", icon: "⚙️" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [adminEmail, setAdminEmail] = useState("");

  useEffect(() => {
    async function checkAccess() {
      setChecking(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        window.location.href = "/login";
        return;
      }

      const userEmail = user.email?.trim().toLowerCase() || "";
      setAdminEmail(userEmail);

      const { data: adminRow, error: adminError } = await supabase
        .from("admins")
        .select("id,email,status")
        .eq("email", userEmail)
        .eq("status", "ACTIVE")
        .maybeSingle();

      if (adminError || !adminRow) {
        window.location.href = "/dashboard";
        return;
      }

      setAllowed(true);
      setChecking(false);
    }

    checkAccess();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (checking || !allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#071f16] text-white">
        Checking admin access...
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-white"
      style={{
        backgroundImage: "url('/images/agarwood-real-tree.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <aside className="fixed left-0 top-0 hidden h-screen w-72 border-r border-white/10 bg-[#08291d]/85 backdrop-blur-md lg:block">
        <div className="flex h-full flex-col p-5">
          <div className="mb-6 shrink-0">
            <div className="text-2xl font-bold text-[#f7d774]">
              Arganwood Admin
            </div>
            <div className="mt-1 text-xs text-white/50">{adminEmail}</div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto pr-2 pb-8">
            {adminLinks.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                    active
                      ? "bg-[#f7d774] text-[#08291d] font-semibold"
                      : "text-white/75 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="w-6 text-center">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <button
            onClick={handleLogout}
            className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm text-white/70 hover:bg-white/10 hover:text-white"
          >
            Logout
          </button>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#071f16]/95 px-4 py-4 backdrop-blur lg:hidden">
          <div className="text-lg font-bold text-[#f7d774]">
            Arganwood Admin
          </div>
        </header>

        <main className="min-h-screen p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}