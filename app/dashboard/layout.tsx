"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

      const adminEmails = ["demo@gmail.com", "admin@test.com"];

      if (adminEmails.includes(user.email?.toLowerCase() || "")) {
        window.location.replace("/admin/dashboard");
        return;
      }

      const { data: profileById } = await supabase
        .from("profiles")
        .select("role,email")
        .eq("id", user.id)
        .maybeSingle();

      const { data: profileByEmail } = await supabase
        .from("profiles")
        .select("role,email")
        .eq("email", user.email?.toLowerCase())
        .maybeSingle();

      const profile = profileById || profileByEmail;

      if (profile?.role?.toUpperCase() === "ADMIN") {
        window.location.replace("/admin/dashboard");
        return;
      }

      setAllowed(true);
    }

    checkAccess();
  }, []);

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#071f16] text-white">
        Checking access...
      </div>
    );
  }

  return <>{children}</>;
}