"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Row = Record<string, any>;

type TabKey =
  | "PENDING"
  | "INSPECTION_REQUESTED"
  | "INSPECTION_SUBMITTED"
  | "OFFER_SENT"
  | "CUSTOMER_ACCEPTED"
  | "PAYOUT_QUEUED"
  | "PAID"
  | "REJECTED"
  | "ALL";

function normalizeStatus(value: any) {
  return String(value || "PENDING").toUpperCase();
}

function peso(value: any) {
  return Number(value || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function makeMap(rows: Row[]) {
  const map = new Map<string, Row>();
  rows.forEach((row) => map.set(String(row.id), row));
  return map;
}

export default function AdminSellTreePage() {
  const [requests, setRequests] = useState<Row[]>([]);
  const [trees, setTrees] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [caretakers, setCaretakers] = useState<Row[]>([]);
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [tasks, setTasks] = useState<Row[]>([]);
  const [selectedCaretaker, setSelectedCaretaker] = useState<Record<string, string>>({});
  const [offerValue, setOfferValue] = useState<Record<string, string>>({});
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [adminProfileId, setAdminProfileId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("PENDING");
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/login";
      return;
    }

    const email = user.email?.trim().toLowerCase() || "";

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", email)
      .maybeSingle();

    const profile = profileById || profileByEmail;

    if (!profile) {
      setMessage("Admin profile not found.");
      setLoading(false);
      return;
    }

    const { data: adminRow, error: adminError } = await supabase
      .from("admins")
      .select("id, admin_profile_id, email, status")
      .eq("admin_profile_id", profile.id)
      .maybeSingle();

    if (adminError) {
      setMessage(adminError.message);
      setLoading(false);
      return;
    }

    const fallbackAdmin = String(profile.email || "").toLowerCase() === "admin@test.com";

    if (!adminRow && !fallbackAdmin) {
      setMessage("Admin access not found.");
      setLoading(false);
      return;
    }

    setAdminProfileId(profile.id);

    const [
      requestResult,
      treeResult,
      profileResult,
      caretakerResult,
      assignmentResult,
      taskResult,
    ] = await Promise.all([
      supabase.from("sell_tree_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("trees").select("*"),
      supabase.from("profiles").select("id, full_name, email, phone"),
      supabase
        .from("caretakers")
        .select("id, caretaker_profile_id, full_name, email, phone, status")
        .eq("status", "ACTIVE")
        .order("full_name", { ascending: true }),
      supabase
        .from("caretaker_assignments")
        .select("*")
        .eq("source_type", "SELL_TREE_INSPECTION")
        .order("created_at", { ascending: false }),
      supabase
        .from("caretaker_task_logs")
        .select("*")
        .eq("source_type", "SELL_TREE_INSPECTION")
        .order("created_at", { ascending: false }),
    ]);

    if (requestResult.error) return fail(requestResult.error.message);
    if (treeResult.error) return fail(treeResult.error.message);
    if (profileResult.error) return fail(profileResult.error.message);
    if (caretakerResult.error) return fail(caretakerResult.error.message);
    if (assignmentResult.error) return fail(assignmentResult.error.message);
    if (taskResult.error) return fail(taskResult.error.message);

    const offerMap: Record<string, string> = {};
    const notesMap: Record<string, string> = {};

    (requestResult.data || []).forEach((row) => {
      offerMap[row.id] = String(row.approved_value || row.tree_value || "");
      notesMap[row.id] = row.admin_notes || "";
    });

    setRequests(requestResult.data || []);
    setTrees(treeResult.data || []);
    setProfiles(profileResult.data || []);
    setCaretakers(caretakerResult.data || []);
    setAssignments(assignmentResult.data || []);
    setTasks(taskResult.data || []);
    setOfferValue(offerMap);
    setAdminNotes(notesMap);
    setLoading(false);
  }

  function fail(text: string) {
    setMessage(text);
    setLoading(false);
  }

  const treeMap = useMemo(() => makeMap(trees), [trees]);
  const profileMap = useMemo(() => makeMap(profiles), [profiles]);

  const items = useMemo(() => {
    return requests.map((request) => {
      const tree = request.tree_id ? treeMap.get(String(request.tree_id)) || null : null;
      const customer = request.profile_id ? profileMap.get(String(request.profile_id)) || null : null;

      const assignment =
        assignments.find((row) => String(row.operation_request_id) === String(request.id)) ||
        null;

      const task =
        tasks.find((row) => String(row.assignment_id || "") === String(assignment?.id || "")) ||
        tasks.find((row) => String(row.operation_request_id || "") === String(request.id)) ||
        null;

      const taskStatus = normalizeStatus(task?.status || assignment?.status || "");
      const baseStatus = normalizeStatus(request.status);

      const status = taskStatus === "SUBMITTED" ? "INSPECTION_SUBMITTED" : baseStatus;

      return { request, tree, customer, assignment, task, status };
    });
  }, [requests, treeMap, profileMap, assignments, tasks]);

  const filteredItems = useMemo(() => {
    if (tab === "ALL") return items;
    return items.filter((item) => item.status === tab);
  }, [items, tab]);

  const stats = useMemo(() => {
    return {
      pending: items.filter((item) => item.status === "PENDING").length,
      inspectionRequested: items.filter((item) => item.status === "INSPECTION_REQUESTED").length,
      inspectionSubmitted: items.filter((item) => item.status === "INSPECTION_SUBMITTED").length,
      offerSent: items.filter((item) => item.status === "OFFER_SENT").length,
      accepted: items.filter((item) => item.status === "CUSTOMER_ACCEPTED").length,
      payoutQueued: items.filter((item) => item.status === "PAYOUT_QUEUED").length,
      paid: items.filter((item) => item.status === "PAID").length,
      rejected: items.filter((item) => item.status === "REJECTED").length,
    };
  }, [items]);

  async function rollbackAssignment(assignmentId: string) {
    await supabase.from("caretaker_task_logs").delete().eq("assignment_id", assignmentId);
    await supabase.from("caretaker_assignments").delete().eq("id", assignmentId);
  }

  async function assignInspection(item: any) {
    setMessage("");

    if (item.assignment) {
      setMessage("This sell tree request already has an inspection assignment.");
      return;
    }

    const caretakerId = selectedCaretaker[item.request.id];

    if (!caretakerId) {
      setMessage("Select a gardener first.");
      return;
    }

    const caretaker = caretakers.find((row) => String(row.id) === String(caretakerId));

    if (!caretaker) {
      setMessage("Selected gardener not found.");
      return;
    }

    const now = new Date().toISOString();
    setProcessingId(item.request.id);

    const assignmentPayload = {
      caretaker_id: caretaker.id,
      caretaker_profile_id: caretaker.caretaker_profile_id || null,
      admin_profile_id: adminProfileId,
      customer_profile_id: item.request.profile_id || item.tree?.profile_id || null,
      group_id: item.tree?.group_id || null,
      tree_id: item.tree?.id || null,
      operation_request_id: item.request.id,
      assignment_type: "SELL_TREE_INSPECTION",
      source_type: "SELL_TREE_INSPECTION",
      status: "ASSIGNED",
      assigned_at: now,
      notes: item.request.admin_notes || "Sell tree inspection assigned.",
      created_at: now,
      updated_at: now,
    };

    const { data: createdAssignment, error: assignmentError } = await supabase
      .from("caretaker_assignments")
      .insert(assignmentPayload)
      .select("id")
      .single();

    if (assignmentError || !createdAssignment) {
      setMessage(assignmentError?.message || "Failed to create assignment.");
      setProcessingId("");
      return;
    }

    const taskPayload = {
      assignment_id: createdAssignment.id,
      caretaker_id: caretaker.id,
      caretaker_profile_id: caretaker.caretaker_profile_id || null,
      customer_profile_id: item.request.profile_id || item.tree?.profile_id || null,
      group_id: item.tree?.group_id || null,
      tree_id: item.tree?.id || null,
      operation_request_id: item.request.id,
      task_type: "SELL_TREE_INSPECTION",
      source_type: "SELL_TREE_INSPECTION",
      evidence_status: "PENDING",
      status: "ASSIGNED",
      notes: "Gardener sell tree inspection task created by Admin.",
      created_at: now,
      updated_at: now,
    };

    const { error: taskError } = await supabase.from("caretaker_task_logs").insert(taskPayload);

    if (taskError) {
      await rollbackAssignment(createdAssignment.id);
      setMessage(taskError.message);
      setProcessingId("");
      return;
    }

    const { error: requestError } = await supabase
      .from("sell_tree_requests")
      .update({
        status: "INSPECTION_REQUESTED",
        admin_notes: adminNotes[item.request.id] || item.request.admin_notes || "Inspection requested.",
      })
      .eq("id", item.request.id);

    if (requestError) {
      await rollbackAssignment(createdAssignment.id);
      setMessage(requestError.message);
      setProcessingId("");
      return;
    }

    setMessage("Sell tree inspection assigned to gardener.");
    setProcessingId("");
    await loadData();
    setTab("INSPECTION_REQUESTED");
  }

  async function sendOffer(item: any) {
    setMessage("");

    const value = Number(offerValue[item.request.id] || 0);

    if (!value || value <= 0) {
      setMessage("Offer amount is required.");
      return;
    }

    const currentStatus = normalizeStatus(item.status);

    if (
      item.assignment &&
      !["INSPECTION_SUBMITTED", "OFFER_SENT", "CUSTOMER_ACCEPTED"].includes(currentStatus)
    ) {
      setMessage("Gardener inspection evidence must be submitted before sending offer.");
      return;
    }

    const confirmed = window.confirm(`Send customer offer of ${peso(value)}?`);
    if (!confirmed) return;

    const platformFee = value * 0.02;
    const netReceive = value - platformFee;
    const now = new Date().toISOString();

    setProcessingId(item.request.id);

    if (item.assignment?.id) {
      await supabase
        .from("caretaker_assignments")
        .update({
          status: "COMPLETED",
          completed_at: now,
          updated_at: now,
        })
        .eq("id", item.assignment.id);
    }

    if (item.task?.id) {
      await supabase
        .from("caretaker_task_logs")
        .update({
          status: "COMPLETED",
          evidence_status: "APPROVED",
          completed_at: now,
          updated_at: now,
        })
        .eq("id", item.task.id);
    }

    const { error } = await supabase
      .from("sell_tree_requests")
      .update({
        tree_value: value,
        approved_value: value,
        platform_fee: platformFee,
        net_receive: netReceive,
        admin_notes:
          adminNotes[item.request.id] ||
          `Admin offer: ${peso(value)}. Platform fee: ${peso(platformFee)}. Net receive: ${peso(netReceive)}.`,
        approved_at: now,
        status: "OFFER_SENT",
      })
      .eq("id", item.request.id);

    if (error) {
      setMessage(error.message);
      setProcessingId("");
      return;
    }

    setMessage("Offer sent. No wallet credit created.");
    setProcessingId("");
    await loadData();
    setTab("OFFER_SENT");
  }

  async function queuePayout(item: any) {
    setMessage("");

    if (normalizeStatus(item.request.status) !== "CUSTOMER_ACCEPTED") {
      setMessage("Customer must accept offer before payout queue.");
      return;
    }

    const amount = Number(item.request.net_receive || 0);
    const fee = Number(item.request.platform_fee || 0);

    if (!item.request.profile_id) {
      setMessage("Missing customer profile.");
      return;
    }

    if (!amount || amount <= 0) {
      setMessage("Net receive amount missing.");
      return;
    }

    const confirmed = window.confirm(`Create withdrawal request for ${peso(amount)}?`);
    if (!confirmed) return;

    const now = new Date().toISOString();
    let createdWithdrawalId = "";

    setProcessingId(item.request.id);

    const { data: createdWithdrawal, error: withdrawalError } = await supabase
      .from("withdrawal_requests")
      .insert({
        profile_id: item.request.profile_id,
        amount,
        processing_fee: 0,
        net_receive: amount,
        status: "PENDING",
        payout_method: "TO BE CONFIRMED",
        payout_account_name: null,
        payout_account_number: null,
        created_at: now,
      })
      .select("id")
      .single();

    if (withdrawalError || !createdWithdrawal) {
      setMessage(withdrawalError?.message || "Withdrawal request creation failed.");
      setProcessingId("");
      return;
    }

    createdWithdrawalId = createdWithdrawal.id;

    if (fee > 0) {
      const { error: treasuryError } = await supabase.from("platform_treasury").insert({
        profile_id: item.request.profile_id,
        source: "SELL_TREE",
        amount: fee,
        reference_no: `SELLTREE-${Date.now()}`,
        description: "Platform fee from Sell Tree offer.",
        status: "POSTED",
        created_at: now,
      });

      if (treasuryError) {
        await supabase.from("withdrawal_requests").delete().eq("id", createdWithdrawalId);
        setMessage(`Treasury posting failed. Withdrawal rollback applied: ${treasuryError.message}`);
        setProcessingId("");
        return;
      }
    }

    const { error: updateError } = await supabase
      .from("sell_tree_requests")
      .update({
        status: "PAYOUT_QUEUED",
        admin_notes:
          adminNotes[item.request.id] ||
          item.request.admin_notes ||
          "Customer accepted. Payout queued.",
      })
      .eq("id", item.request.id);

    if (updateError) {
      await supabase.from("withdrawal_requests").delete().eq("id", createdWithdrawalId);
      setMessage(`Sell Tree status update failed. Withdrawal rollback applied: ${updateError.message}`);
      setProcessingId("");
      return;
    }

    setMessage("Payout queued through withdrawal_requests. Wallet was not credited.");
    setProcessingId("");
    await loadData();
    setTab("PAYOUT_QUEUED");
  }

  async function rejectRequest(item: any) {
    const notes = adminNotes[item.request.id] || "";

    if (!notes.trim()) {
      setMessage("Admin notes are required before rejecting.");
      return;
    }

    const confirmed = window.confirm("Reject this sell tree request?");
    if (!confirmed) return;

    setProcessingId(item.request.id);

    const { error } = await supabase
      .from("sell_tree_requests")
      .update({
        status: "REJECTED",
        admin_notes: notes,
        rejected_at: new Date().toISOString(),
      })
      .eq("id", item.request.id);

    if (error) {
      setMessage(error.message);
      setProcessingId("");
      return;
    }

    setMessage("Sell tree request rejected.");
    setProcessingId("");
    await loadData();
    setTab("REJECTED");
  }

  return (
    <main className="min-h-screen bg-[#03130d] p-6 text-white md:p-8">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(217,180,95,0.20),transparent_32%),radial-gradient(circle_at_top_right,rgba(52,120,77,0.28),transparent_30%),linear-gradient(180deg,#082015,#03130d_48%,#010805)]" />

      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-7 shadow-2xl backdrop-blur-xl md:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-[#d9b45f]">
                Admin Sell Tree Center
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                Sell Tree Inspection & Offers
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/65">
                Assign optional gardener inspection, review evidence, send offer, and queue payout
                only after customer acceptance. No wallet credit.
              </p>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-6 py-4 font-black text-[#f7d774] transition hover:bg-[#d9b45f]/25 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh Sell Tree"}
            </button>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl border border-[#d9b45f]/25 bg-[#d9b45f]/10 p-4 text-sm font-bold text-[#ffe49a]">
              {message}
            </div>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-4 xl:grid-cols-8">
          <StatCard label="Pending" value={stats.pending} />
          <StatCard label="Inspection" value={stats.inspectionRequested} />
          <StatCard label="Submitted" value={stats.inspectionSubmitted} />
          <StatCard label="Offer Sent" value={stats.offerSent} />
          <StatCard label="Accepted" value={stats.accepted} />
          <StatCard label="Payout" value={stats.payoutQueued} />
          <StatCard label="Paid" value={stats.paid} />
          <StatCard label="Rejected" value={stats.rejected} />
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-wrap gap-3">
            {([
              "PENDING",
              "INSPECTION_REQUESTED",
              "INSPECTION_SUBMITTED",
              "OFFER_SENT",
              "CUSTOMER_ACCEPTED",
              "PAYOUT_QUEUED",
              "PAID",
              "REJECTED",
              "ALL",
            ] as TabKey[]).map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`rounded-full px-5 py-3 text-sm font-black transition ${
                  tab === item
                    ? "bg-[#d9b45f] text-[#071f16]"
                    : "border border-white/10 bg-white/10 text-white/70 hover:bg-white/15"
                }`}
              >
                {item.replaceAll("_", " ")}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          {loading ? (
            <EmptyCard text="Loading sell tree requests..." />
          ) : filteredItems.length === 0 ? (
            <EmptyCard text="No sell tree records in this view." />
          ) : (
            filteredItems.map((item) => (
              <article
                key={item.request.id}
                className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl"
              >
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <StatusBadge status={item.status} />
                      <span className="rounded-full border border-[#d9b45f]/30 bg-[#d9b45f]/10 px-3 py-1 text-xs font-black text-[#ffe49a]">
                        SELL TREE
                      </span>
                    </div>

                    <div>
                      <h2 className="text-2xl font-black text-[#ffe49a]">
                        {item.tree?.display_name ||
                          item.tree?.custom_name ||
                          "Customer Tree Sale Request"}
                      </h2>
                      <p className="mt-2 text-sm text-white/60">
                        Customer:{" "}
                        <b className="text-white">
                          {item.customer?.full_name || item.customer?.email || "Unknown Customer"}
                        </b>
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                      <Info label="Requested" value={formatDate(item.request.created_at)} />
                      <Info label="Customer Ask" value={peso(item.request.tree_value)} />
                      <Info label="Offer" value={peso(item.request.approved_value)} />
                      <Info label="Net Receive" value={peso(item.request.net_receive)} />
                    </div>

                    <textarea
                      value={adminNotes[item.request.id] || ""}
                      onChange={(e) =>
                        setAdminNotes((current) => ({
                          ...current,
                          [item.request.id]: e.target.value,
                        }))
                      }
                      placeholder="Admin notes..."
                      className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white outline-none placeholder:text-white/35"
                    />
                  </div>

                  <div className="w-full space-y-3 xl:w-96">
                    {!item.assignment && normalizeStatus(item.request.status) === "PENDING" && (
                      <>
                        <select
                          value={selectedCaretaker[item.request.id] || ""}
                          onChange={(e) =>
                            setSelectedCaretaker((current) => ({
                              ...current,
                              [item.request.id]: e.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border border-white/10 bg-[#071f16] px-4 py-3 text-sm text-white outline-none"
                        >
                          <option value="">Optional gardener inspection</option>
                          {caretakers.map((caretaker) => (
                            <option key={caretaker.id} value={caretaker.id}>
                              {caretaker.full_name || caretaker.email}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() => assignInspection(item)}
                          disabled={processingId === item.request.id}
                          className="w-full rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-5 py-4 text-sm font-black text-[#ffe49a] hover:bg-[#d9b45f]/25 disabled:opacity-50"
                        >
                          Assign Sell Tree Inspection
                        </button>
                      </>
                    )}

                    {item.assignment && (
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                        Inspection assigned. Evidence:{" "}
                        <b className="text-white">{item.task?.evidence_status || "PENDING"}</b>
                      </div>
                    )}

                    <input
                      value={offerValue[item.request.id] || ""}
                      onChange={(e) =>
                        setOfferValue((current) => ({
                          ...current,
                          [item.request.id]: e.target.value,
                        }))
                      }
                      type="number"
                      min="0"
                      placeholder="Offer amount"
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
                    />

                    {["PENDING", "INSPECTION_SUBMITTED"].includes(item.status) && (
                      <button
                        onClick={() => sendOffer(item)}
                        disabled={processingId === item.request.id}
                        className="w-full rounded-2xl bg-[#d9b45f] px-5 py-4 text-sm font-black text-[#071f16] hover:bg-[#f7d774] disabled:opacity-50"
                      >
                        Send Offer
                      </button>
                    )}

                    {normalizeStatus(item.request.status) === "CUSTOMER_ACCEPTED" && (
                      <button
                        onClick={() => queuePayout(item)}
                        disabled={processingId === item.request.id}
                        className="w-full rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-[#03130d] hover:bg-emerald-400 disabled:opacity-50"
                      >
                        Queue Payout
                      </button>
                    )}

                    {normalizeStatus(item.request.status) === "PENDING" && (
                      <button
                        onClick={() => rejectRequest(item)}
                        disabled={processingId === item.request.id}
                        className="w-full rounded-2xl border border-red-400/30 bg-red-500/15 px-5 py-4 text-sm font-black text-red-200 hover:bg-red-500/25 disabled:opacity-50"
                      >
                        Reject Request
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-white/45">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black text-[#ffe49a]">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-white/80">{value}</p>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-white/65 shadow-2xl backdrop-blur-xl">
      {text}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const value = normalizeStatus(status);

  let classes = "border-yellow-400/30 bg-yellow-500/15 text-yellow-200";

  if (["OFFER_SENT", "CUSTOMER_ACCEPTED", "PAYOUT_QUEUED", "PAID"].includes(value)) {
    classes = "border-emerald-400/30 bg-emerald-500/15 text-emerald-200";
  }

  if (["INSPECTION_REQUESTED", "INSPECTION_SUBMITTED"].includes(value)) {
    classes = "border-blue-400/30 bg-blue-500/15 text-blue-200";
  }

  if (value === "REJECTED") {
    classes = "border-red-400/30 bg-red-500/15 text-red-200";
  }

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-black ${classes}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}