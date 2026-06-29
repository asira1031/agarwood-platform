"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const gardenerLinks = [
  { label: "Dashboard", href: "/gardener/dashboard", icon: "🏠" },
  { label: "Assigned Trees", href: "/gardener/assigned-trees", icon: "🌳" },
  { label: "Tasks", href: "/gardener/tasks", icon: "🧾" },
  { label: "Photo Updates", href: "/gardener/photo-updates", icon: "📸" },
  { label: "GPS Updates", href: "/gardener/gps-updates", icon: "📍" },
  { label: "Health Reports", href: "/gardener/health-reports", icon: "🌿" },
  { label: "Concerns", href: "/gardener/concerns", icon: "⚠️" },
];

export default function GardenerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [gardenerEmail, setGardenerEmail] = useState("");

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
      setGardenerEmail(userEmail);

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

      const { data: caretakerByEmail, error: caretakerByEmailError } = userEmail
        ? await supabase
            .from("caretakers")
            .select("id,caretaker_profile_id,email,status")
            .ilike("email", userEmail)
            .eq("status", "ACTIVE")
            .maybeSingle()
        : { data: null, error: null };

      if (caretakerByEmailError) {
        window.location.href = "/dashboard";
        return;
      }

      const { data: caretakerByProfile, error: caretakerByProfileError } = profile?.id
        ? await supabase
            .from("caretakers")
            .select("id,caretaker_profile_id,email,status")
            .eq("caretaker_profile_id", profile.id)
            .eq("status", "ACTIVE")
            .maybeSingle()
        : { data: null, error: null };

      if (caretakerByProfileError || (!caretakerByEmail && !caretakerByProfile)) {
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
        Checking gardener access...
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
              Arganwood Gardener
            </div>
            <div className="mt-1 text-xs text-white/50">{gardenerEmail}</div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto pr-2 pb-8">
            {gardenerLinks.map((item) => {
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
            Arganwood Gardener
          </div>
        </header>

        <main className="min-h-screen p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}