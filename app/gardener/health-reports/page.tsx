"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function GardenerHealthReportsPage() {
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get("assignment_id") || "";
  const taskHref = assignmentId ? `/gardener/tasks?assignment_id=${assignmentId}` : "/gardener/tasks";

  return (
    <main className="min-h-screen bg-[#03130d] p-6 text-white md:p-8">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(217,180,95,0.20),transparent_32%),radial-gradient(circle_at_top_right,rgba(52,120,77,0.28),transparent_30%),linear-gradient(180deg,#082015,#03130d_48%,#010805)]" />
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-white/[0.07] p-8 shadow-2xl backdrop-blur-xl">
        <p className="text-xs font-black uppercase tracking-[0.35em] text-[#d9b45f]">Gardener Evidence Center</p>
        <h1 className="mt-4 text-4xl font-black text-white">🌿 Health Reports</h1>
        <p className="mt-4 text-sm font-semibold leading-relaxed text-white/65">Health reports are now submitted together with Photo and GPS in the Work Center so Admin approval unlocks the completed customer view.</p>
        <div className="mt-6 rounded-2xl border border-[#d9b45f]/25 bg-[#d9b45f]/10 p-5 text-sm font-bold text-[#ffe49a]">
          Use the Work Center for the final production workflow: Start Work → Scan QR → Upload Photo + GPS + Health → Submit Work → Admin Review.
        </div>
        <Link href={taskHref} className="mt-6 inline-flex rounded-2xl bg-[#d9b45f] px-6 py-4 text-sm font-black text-[#071f16] hover:bg-[#f7d774]">
          Open Work Center
        </Link>
      </section>
    </main>
  );
}
