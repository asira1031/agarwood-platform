"use client";

export default function AdminOperationsPage() {
  return (
    <main className="min-h-screen text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8 rounded-3xl bg-[#071f16]/75 p-8 backdrop-blur-md border border-white/10 shadow-2xl">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
            Admin Operations Center
          </p>

          <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
            Operations Queue
          </h1>

          <p className="mt-2 text-white/70">
            Review tree operation requests, inventory usage, care program
            actions, and pending operational tasks.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
            <p className="text-sm text-white/70">Pending Operations</p>
            <p className="mt-3 text-3xl font-bold text-[#d9b45f]">0</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
            <p className="text-sm text-white/70">Approved Today</p>
            <p className="mt-3 text-3xl font-bold text-[#d9b45f]">0</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
            <p className="text-sm text-white/70">Inventory Requests</p>
            <p className="mt-3 text-3xl font-bold text-[#d9b45f]">0</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
            <p className="text-sm text-white/70">Care Program Tasks</p>
            <p className="mt-3 text-3xl font-bold text-[#d9b45f]">0</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/10 p-8">
          <h2 className="text-2xl font-bold text-[#d9b45f]">
            Operations Queue
          </h2>

          <p className="mt-4 text-white/70">
            No operation requests found.
          </p>

          <div className="mt-6 rounded-xl border border-dashed border-white/20 p-6 text-white/50">
            Future modules:
            <ul className="mt-4 space-y-2">
              <li>• Tree Operation Approval</li>
              <li>• Inventory Usage Approval</li>
              <li>• Care Program Scheduling</li>
              <li>• Caretaker Assignment Queue</li>
              <li>• Tree Maintenance Requests</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}