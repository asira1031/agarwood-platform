"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.replace("/login");
        return;
      }

      const email = user.email?.trim().toLowerCase() || "";

      const { data: profileById } = await supabase
        .from("profiles")
        .select("role,email,membership_status")
        .eq("id", user.id)
        .maybeSingle();

      const { data: profileByEmail } = await supabase
        .from("profiles")
        .select("role,email,membership_status")
        .eq("email", email)
        .maybeSingle();

      const profile = profileById || profileByEmail;

      if (profile?.role?.toUpperCase() === "ADMIN") {
        window.location.replace("/admin/dashboard");
        return;
      }

      const isMembershipPage = pathname === "/dashboard/membership";
      const membershipStatus = profile?.membership_status?.toUpperCase();

      if (!isMembershipPage && membershipStatus !== "ACTIVE") {
        window.location.replace("/dashboard/membership");
        return;
      }

      setAllowed(true);
    }

    checkAccess();
  }, [pathname]);

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#071f16] text-white">
        Checking access...
      </div>
    );
  }

  return <>{children}</>;
}
