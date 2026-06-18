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
      console.log("DASHBOARD LAYOUT RUNNING");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      console.log("CURRENT USER:", user?.email, user?.id);

      if (!user) {
        window.location.replace("/login");
        return;
      }

      const { data: profileById, error: idError } = await supabase
        .from("profiles")
        .select("role,email")
        .eq("id", user.id)
        .maybeSingle();

      console.log("PROFILE BY ID:", profileById, idError);

      const { data: profileByEmail, error: emailError } = await supabase
        .from("profiles")
        .select("role,email")
        .eq("email", user.email?.toLowerCase())
        .maybeSingle();

      console.log("PROFILE BY EMAIL:", profileByEmail, emailError);

      const profile = profileById || profileByEmail;

      console.log("PROFILE DATA:", profile);

      if (profile?.role?.toUpperCase() === "ADMIN") {
        console.log("ADMIN DETECTED");
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