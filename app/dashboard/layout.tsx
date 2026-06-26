// app/dashboard/layout.tsx
"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export default function DashboardLayout({ children }: { children: ReactNode }) {
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
    <main className="min-h-screen w-full overflow-x-hidden bg-[#07140f] text-[#f8f1d8]">
      {children}
    </main>
  );
}
