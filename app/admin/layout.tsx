"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminLayout({
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
        window.location.href = "/login";
        return;
      }

      const userEmail = user.email?.trim().toLowerCase() || "";
      const adminEmails = ["demo@gmail.com", "admin@test.com"];

      if (adminEmails.includes(userEmail)) {
        setAllowed(true);
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
        .eq("email", userEmail)
        .maybeSingle();

      const profile = profileById || profileByEmail;

      if (profile?.role?.trim().toUpperCase() !== "ADMIN") {
        window.location.href = "/dashboard";
        return;
      }

      setAllowed(true);
    }

    checkAccess();
  }, []);

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#071f16] text-white">
        Checking admin access...
      </div>
    );
  }

  return <>{children}</>;
}