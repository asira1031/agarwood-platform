"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type SellRequest = Record<string, any>;
type Tree = Record<string, any>;

type TabKey = "EVALUATION" | "OFFER_SENT" | "ACCEPTED" | "REJECTED" | "ALL";

function peso(value: number) {
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

function normalizeStatus(value: any) {
  return String(value || "PENDING_EVALUATION").toUpperCase();
}

function badgeClass(value: any) {
  const status = normalizeStatus(value);

  if (["OFFER_SENT", "ACCEPTED", "CUSTOMER_ACCEPTED"].includes(status)) {
    return "border-emerald-400/30 bg-emerald-500/20 text-emerald-200";
  }

  if (["REJECTED", "CANCELLED", "CUSTOMER_DECLINED"].includes(status)) {
    return "border-red-400/30 bg-red-500/20 text-red-200";
  }

  return "border-yellow-400/30 bg-yellow-500/20 text-yellow-200";
}

export default function AdminSellTreePage() {
  const [requests, setRequests] = useState<SellRequest[]>([]);
  const [trees, setTrees] = useState<Tree[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<TabKey>("EVALUATION");

  const [adminValues, setAdminValues] = useState<Record<string, string>>({});
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const { data: requestData, error: requestError } = await supabase
      .from("sell_tree_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (requestError) {
      setMessage(requestError.message);
      setLoading(false);
      return;
    }

    const { data: treeData, error: treeError } = await supabase
      .from("trees")
      .select("*");

    if (treeError) {
      setMessage(treeError.message);
      setLoading(false);
      return;
    }

    const valueMap: Record<string, string> = {};
    const notesMap: Record<string, string> = {};

    (requestData || []).forEach((item) => {
      valueMap[item.id] = String(item.approved_value || item.tree_value || "");
      notesMap[item.id] = item.admin_notes || "";
    });

    setRequests(requestData || []);
    setTrees(treeData || []);
    setAdminValues(valueMap);
    setAdminNotes(notesMap);
    setLoading(false);
  }

  function findTree(request: SellRequest) {
    const requestTreeId = String(request.tree_id || "");

    return (
      trees.find((tree) => {
        return (
          requestTreeId === String(tree.id || "") ||
          requestTreeId === String(tree.tree_code || "") ||
          requestTreeId === String(tree.display_name || "") ||
          requestTreeId === String(tree.custom_name || "")
        );
      }) || null
    );
  }

  const evaluationRequests = useMemo(() => {
    return requests.filter((item) =>
      ["PENDING", "PENDING_EVALUATION", "EVALUATION"].includes(
        normalizeStatus(item.status)
      )
    );
  }, [requests]);

  const offerSentRequests = useMemo(() => {
    return requests.filter((item) => normalizeStatus(item.status) === "OFFER_SENT");
  }, [requests]);

  const acceptedRequests = useMemo(() => {
    return requests.filter((item) =>
      ["ACCEPTED", "CUSTOMER_ACCEPTED"].includes(normalizeStatus(item.status))
    );
  }, [requests]);

  const rejectedRequests = useMemo(() => {
    return requests.filter((item) =>
      ["REJECTED", "CUSTOMER_DECLINED", "CANCELLED"].includes(
        normalizeStatus(item.status)
      )
    );
  }, [requests]);

  const activeRequests = useMemo(() => {
    if (tab === "EVALUATION") return evaluationRequests;
    if (tab === "OFFER_SENT") return offerSentRequests;
    if (tab === "ACCEPTED") return acceptedRequests;
    if (tab === "REJECTED") return rejectedRequests;
    return requests;
  }, [tab, requests, evaluationRequests, offerSentRequests, acceptedRequests, rejectedRequests]);

  async function sendOffer(request: SellRequest) {
    const adminValue = Number(adminValues[request.id] || 0);
    const notes = adminNotes[request.id] || "";

    if (!adminValue || adminValue <= 0) {
      setMessage("Admin valuation price is required.");
      return;
    }

    if (!request.profile_id) {
      setMessage("Request has no profile_id.");
      return;
    }

    const confirmed = window.confirm(
      `Send tree valuation offer of ${peso(adminValue)} to customer?`
    );

    if (!confirmed) return;

    setWorkingId(request.id);
    setMessage("");

    const platformFee = adminValue * 0.02;
    const netReceive = adminValue - platformFee;

    const { error: updateError } = await supabase
      .from("sell_tree_requests")
      .update({
        tree_value: adminValue,
        approved_value: adminValue,
        platform_fee: platformFee,
        net_receive: netReceive,
        admin_notes:
          notes ||
          `Admin evaluated this tree at ${peso(adminValue)}. Waiting for customer approval.`,
        status: "OFFER_SENT",
        approved_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (updateError) {
      setMessage(updateError.message);
      setWorkingId("");
      return;
    }

    await supabase.from("wallet_transactions").insert({
      profile_id: request.profile_id,
      transaction_type: "TREE_VALUATION_OFFER_SENT",
      amount: 0,
      reference_no: request.id,
      status: "OFFER_SENT",
      description: `Tree valuation offer sent. Gross: ${peso(
        adminValue
      )}. Platform fee: ${peso(platformFee)}. Customer net: ${peso(netReceive)}.`,
    });

    setMessage("Offer sent. No wallet credit yet; payout happens after customer acceptance.");
    setWorkingId("");
    await loadData();
    setTab("OFFER_SENT");
  }

  async function createPayoutRequest(request: SellRequest) {
    const amount = Number(request.net_receive || 0);

    if (!request.id || !request.profile_id) {
      setMessage("Missing request ID or profile ID.");
      return;
    }

    if (amount <= 0) {
      setMessage("Net payout amount is missing. Send offer first.");
      return;
    }

    const confirmed = window.confirm(
      `Create payout request for ${peso(amount)}?`
    );

    if (!confirmed) return;

    setWorkingId(request.id);
    setMessage("");

    const { error: withdrawalError } = await supabase
      .from("withdrawal_requests")
      .insert({
        profile_id: request.profile_id,
        amount,
        payout_method: "TO BE CONFIRMED",
        account_name: null,
        account_number: null,
        status: "PENDING",
        notes: `Sell Tree payout request from sell_tree_requests ${request.id}.`,
      });

    if (withdrawalError) {
      setMessage(withdrawalError.message);
      setWorkingId("");
      return;
    }

    const { error: updateError } = await supabase
      .from("sell_tree_requests")
      .update({
        status: "CUSTOMER_ACCEPTED",
      })
      .eq("id", request.id);

    if (updateError) {
      setMessage(updateError.message);
      setWorkingId("");
      return;
    }

    await supabase.from("wallet_transactions").insert({
      profile_id: request.profile_id,
      transaction_type: "SELL_TREE_PAYOUT_QUEUED",
      amount: 0,
      reference_no: request.id,
      status: "PENDING",
      description: `Sell Tree payout queued. Net payout: ${peso(amount)}.`,
    });

    setMessage("Payout request created. Check Payout Queue / Withdrawals.");
    setWorkingId("");
    await loadData();
    setTab("ACCEPTED");
  }

  async function rejectRequest(request: SellRequest) {
    const notes = adminNotes[request.id] || "";

    if (!notes.trim()) {
      setMessage("Admin notes are required when rejecting.");
      return;
    }

    const confirmed = window.confirm("Reject this sell tree evaluation request?");
    if (!confirmed) return;

    setWorkingId(request.id);
    setMessage("");

    const { error } = await supabase
      .from("sell_tree_requests")
      .update({
        admin_notes: notes,
        status: "REJECTED",
        rejected_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (error) {
      setMessage(error.message);
      setWorkingId("");
      return;
    }

    await supabase.from("wallet_transactions").insert({
      profile_id: request.profile_id,
      transaction_type: "TREE_VALUATION_REJECTED",
      amount: 0,
      reference_no: request.id,
      status: "REJECTED",
      description: `Tree valuation request rejected. ${notes}`,
    });

    setMessage("Sell tree evaluation request rejected.");
    setWorkingId("");
    await loadData();
    setTab("REJECTED");
  }

  return (
    <main className="min-h-screen p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8 rounded-3xl border border-white/10 bg-[#071f16]/80 p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
              Admin Tree Center
            </p>

            <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
              Sell Tree Evaluation
            </h1>

            <p className="mt-2 text-white/70">
              Evaluate trees, send offer to customer, then create payout request only after acceptance.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="rounded-2xl border border-[#d9b45f]/40 bg-[#d9b45f]/15 px-5 py-3 text-sm font-semibold text-[#f7d774] hover:bg-[#d9b45f]/25 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {message && (
          <div className="rounded-2xl border border-[#d9b45f]/20 bg-[#d9b45f]/10 p-4 text-sm font-semibold text-[#ffe8a3]">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-5">
          <Card label="Pending Evaluation" value={String(evaluationRequests.length)} />
          <Card label="Offer Sent" value={String(offerSentRequests.length)} />
          <Card label="Accepted" value={String(acceptedRequests.length)} />
          <Card label="Rejected" value={String(rejectedRequests.length)} />
          <Card label="Total" value={String(requests.length)} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/10 p-5">
          <div className="flex flex-wrap gap-3">
            {[
              ["EVALUATION", "Evaluation Queue"],
              ["OFFER_SENT", "Offer Sent"],
              ["ACCEPTED", "Accepted / Payout"],
              ["REJECTED", "Rejected"],
              ["ALL", "All Records"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key as TabKey)}
                className={`rounded-full px-5 py-3 text-sm font-bold transition ${
                  tab === key
                    ? "bg-[#f7d774] text-[#071f16]"
                    : "bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-white/70">
            Loading sell tree requests...
          </div>
        ) : activeRequests.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-white/70">
            No records in this tab.
          </div>
        ) : (
          <section className="space-y-5">
            {activeRequests.map((request) => {
              const tree = findTree(request);
              const status = normalizeStatus(request.status);

              const editable = ["PENDING", "PENDING_EVALUATION", "EVALUATION"].includes(status);
              const canCreatePayout = ["ACCEPTED", "CUSTOMER_ACCEPTED"].includes(status);

              const adminValue = Number(adminValues[request.id] || 0);
              const fee = adminValue * 0.02;
              const net = adminValue - fee;

              return (
                <div
                  key={request.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.06] p-6"
                >
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-black text-[#ffe49a]">
                          {request.tree_id || "Unknown Tree"}
                        </h2>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(status)}`}
                        >
                          {status}
                        </span>
                      </div>

                      <p className="text-sm text-white/65">
                        Request Type: <b className="text-white">Tree Evaluation / Sell Inquiry</b>
                      </p>

                      <p className="text-sm text-white/65">
                        Tree Match:{" "}
                        <b className="text-white">
                          {tree?.display_name || tree?.tree_code || tree?.custom_name || "Not matched"}
                        </b>
                      </p>

                      <p className="text-sm text-white/65">
                        Tree Stage:{" "}
                        <b className="text-white">
                          {tree?.current_stage || tree?.growth_stage || tree?.stage || "—"}
                        </b>
                      </p>

                      <p className="text-sm text-white/65">
                        Submitted: <b className="text-white">{formatDate(request.created_at)}</b>
                      </p>

                      <p className="text-sm text-white/65">
                        Current Offer:{" "}
                        <b className="text-white">
                          {Number(request.approved_value || request.tree_value || 0) > 0
                            ? peso(Number(request.approved_value || request.tree_value || 0))
                            : "Not set"}
                        </b>
                      </p>

                      {request.admin_notes && (
                        <div className="mt-3 rounded-2xl bg-black/20 p-4 text-sm text-white/75">
                          {request.admin_notes}
                        </div>
                      )}
                    </div>

                    <div className="grid w-full gap-3 rounded-2xl bg-black/20 p-4 lg:w-[390px]">
                      <label className="grid gap-2 text-sm font-bold text-white/70">
                        Admin Valuation / Offer Price
                        <input
                          disabled={!editable}
                          type="number"
                          value={adminValues[request.id] || ""}
                          onChange={(event) =>
                            setAdminValues((current) => ({
                              ...current,
                              [request.id]: event.target.value,
                            }))
                          }
                          className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none disabled:opacity-60"
                          placeholder="Enter evaluated price"
                        />
                      </label>

                      <label className="grid gap-2 text-sm font-bold text-white/70">
                        Admin Evaluation Notes
                        <textarea
                          disabled={!editable}
                          value={adminNotes[request.id] || ""}
                          onChange={(event) =>
                            setAdminNotes((current) => ({
                              ...current,
                              [request.id]: event.target.value,
                            }))
                          }
                          className="min-h-[100px] rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none disabled:opacity-60"
                          placeholder="Evaluation notes, smoke test, quality, age, or rejection reason."
                        />
                      </label>

                      <div className="rounded-2xl bg-white/5 p-4 text-sm">
                        <div className="flex justify-between gap-3">
                          <span className="text-white/60">Gross Offer</span>
                          <b>{peso(adminValue)}</b>
                        </div>

                        <div className="mt-2 flex justify-between gap-3">
                          <span className="text-white/60">Platform Fee 2%</span>
                          <b>{peso(fee)}</b>
                        </div>

                        <div className="mt-2 flex justify-between gap-3">
                          <span className="text-white/60">Customer Net</span>
                          <b className="text-[#ffe49a]">{peso(net > 0 ? net : 0)}</b>
                        </div>
                      </div>

                      {editable && (
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => sendOffer(request)}
                            disabled={workingId === request.id}
                            className="rounded-xl bg-[#d9b45f] px-4 py-3 font-black text-[#071f16] disabled:opacity-50"
                          >
                            {workingId === request.id ? "Working..." : "Send Offer"}
                          </button>

                          <button
                            onClick={() => rejectRequest(request)}
                            disabled={workingId === request.id}
                            className="rounded-xl border border-red-300/30 bg-red-500/10 px-4 py-3 font-black text-red-100 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}

                      {canCreatePayout && (
                        <button
                          onClick={() => createPayoutRequest(request)}
                          disabled={workingId === request.id}
                          className="rounded-xl bg-emerald-500/20 px-4 py-3 font-black text-emerald-100 disabled:opacity-50"
                        >
                          {workingId === request.id ? "Working..." : "Create Payout Queue"}
                        </button>
                      )}

                      {!editable && !canCreatePayout && (
                        <div className="rounded-xl bg-white/5 p-3 text-center text-sm font-bold text-white/60">
                          Locked. Waiting for customer or payout action.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
      <p className="text-sm text-white/70">{label}</p>
      <p className="mt-3 text-2xl font-black text-[#d9b45f]">{value}</p>
    </div>
  );
}