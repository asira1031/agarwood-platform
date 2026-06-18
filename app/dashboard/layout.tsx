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
        error: userError,
      } = await supabase.auth.getUser();

      console.log("USER ERROR:", userError);
      console.log("USER EMAIL:", user?.email);
      console.log("USER ID:", user?.id);

      if (!user) {
        console.log("NO USER - REDIRECT LOGIN");
        window.location.href = "/login";
        return;
      }

      const userEmail = user.email?.trim().toLowerCase() || "";
      const adminEmails = ["demo@gmail.com", "admin@test.com"];

      if (adminEmails.includes(userEmail)) {
        console.log("ADMIN EMAIL MATCHED - REDIRECT ADMIN");
        window.location.href = "/admin/dashboard";
        return;
      }

      const { data: profileById, error: idError } = await supabase
        .from("profiles")
        .select("role,email")
        .eq("id", user.id)
        .maybeSingle();

      console.log("PROFILE BY ID:", profileById);
      console.log("PROFILE BY ID ERROR:", idError);

      const { data: profileByEmail, error: emailError } = await supabase
        .from("profiles")
        .select("role,email")
        .eq("email", userEmail)
        .maybeSingle();

      console.log("PROFILE BY EMAIL:", profileByEmail);
      console.log("PROFILE BY EMAIL ERROR:", emailError);

      const profile = profileById || profileByEmail;

      console.log("PROFILE DATA:", profile);

      if (profile?.role?.trim().toUpperCase() === "ADMIN") {
        console.log("ADMIN ROLE DETECTED - REDIRECT ADMIN");
        window.location.href = "/admin/dashboard";
        return;
      }

      console.log("ALLOWING CUSTOMER DASHBOARD");
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