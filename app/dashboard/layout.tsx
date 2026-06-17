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

      const { data: profileById } = await supabase
        .from("profiles")
        .select("role,email")
        .eq("id", user.id)
        .maybeSingle();

      const profile =
        profileById ||
        (
          await supabase
            .from("profiles")
            .select("role,email")
            .eq("email", user.email?.toLowerCase())
            .maybeSingle()
        ).data;

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