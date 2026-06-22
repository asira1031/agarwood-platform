"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";

const sidebarItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "My Trees", href: "/dashboard/my-trees" },
  { label: "Tree Operations", href: "/dashboard/tree-operations" },
  { label: "Inventory", href: "/dashboard/inventory" },
  { label: "Marketplace", href: "/dashboard/marketplace" },
  { label: "Investments", href: "/dashboard/investments" },
  { label: "Earnings", href: "/dashboard/earnings" },
  { label: "Sell Tree", href: "/dashboard/sell-tree" },
  { label: "Wallet", href: "/dashboard/wallet" },
  { label: "Transactions", href: "/dashboard/transactions" },
  { label: "Referrals", href: "/dashboard/referrals" },
  { label: "Membership", href: "/dashboard/membership" },
  { label: "Profile", href: "/dashboard/profile" },
  { label: "Settings", href: "/dashboard/settings" },
  { label: "Support", href: "/dashboard/support" },
];

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [allowed, setAllowed] = useState(false);

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

      const { data: adminRow } = await supabase
        .from("admins")
        .select("id")
        .eq("email", userEmail)
        .eq("status", "ACTIVE")
        .maybeSingle();

      if (adminRow) {
        window.location.href = "/admin/dashboard";
        return;
      }

      const { data: caretakerRow } = await supabase
        .from("caretakers")
        .select("id")
        .eq("email", userEmail)
        .eq("status", "ACTIVE")
        .maybeSingle();

      if (caretakerRow) {
        window.location.href = "/gardener/dashboard";
        return;
      }

      setAllowed(true);
    }

    checkAccess();
  }, []);

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#071f16] text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f3e8] text-[#1f3b2c]">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-[#d8ccb0] bg-[#1f3b2c] text-white">
          <div className="p-6">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-lg">
              <p className="text-xs uppercase tracking-[0.3em] text-amber-200">
                ARGANWOOD
              </p>
              <h1 className="mt-2 text-2xl font-bold">Customer Portal</h1>
              <p className="mt-2 text-sm text-white/70">
                Manage trees, inventory, care services, earnings, and membership.
              </p>
            </div>

            <nav className="mt-6 space-y-2">
              {sidebarItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-2xl px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}