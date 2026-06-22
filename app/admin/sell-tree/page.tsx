"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type SellRequest = Record<string, any>;
type Wallet = Record<string, any>;
type Tree = Record<string, any>;

function peso(value: number) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusClass(value: any) {
  const status = String(value || "").toUpperCase();

  if (["APPROVED", "PAID", "COMPLETED", "SOLD"].includes(status)) {
    return "bg-green-500/20 text-green-200";
  }

  if (["REJECTED", "CANCELLED", "FAILED"].includes(status)) {
    return "bg-red-500/20 text-red-200";
  }

  return "bg-yellow-500/20 text-yellow-200";
}

function isLockedStatus(value: any) {
  const status = String(value || "").toUpperCase();
  return ["APPROVED", "REJECTED", "PAID", "COMPLETED", "SOLD"].includes(status);
}

export default function AdminSellTreePage() {
  const [requests, setRequests] = useState<SellRequest[]>([]);
  const [trees, setTrees] = useState<Tree[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [message, setMessage] = useState("");

  const [adminValues, setAdminValues] = useState<Record<string, string>>({});
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

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

    setRequests(requestData || []);
    setTrees(treeData || []);

    const valueMap: Record<string, string> = {};
    const notesMap: Record<string, string> = {};

    (requestData || []).forEach((item) => {
      valueMap[item.id] = String(item.approved_value || item.tree_value || "");
      notesMap[item.id] = item.admin_notes || "";
    });

    setAdminValues(valueMap);
    setAdminNotes(notesMap);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const pendingRequests = useMemo(() => {
    return requests.filter((item) => !isLockedStatus(item.status));
  }, [requests]);

  const approvedRequests = useMemo(() => {
    return requests.filter((item) => String(item.status || "").toUpperCase() === "APPROVED");
  }, [requests]);

  const rejectedRequests = useMemo(() => {
    return requests.filter((item) => String(item.status || "").toUpperCase() === "REJECTED");
  }, [requests]);

  function findTree(request: SellRequest) {
    return (
      trees.find((tree) => {
        const requestTreeId = String(request.tree_id || "");

        return (
          requestTreeId === String(tree.id || "") ||
          requestTreeId === String(tree.tree_code || "") ||
          requestTreeId === String(tree.display_name || "")
        );
      }) || null
    );
  }

  async function approveRequest(request: SellRequest) {
    setMessage("");

    const adminValue = Number(adminValues[request.id] || 0);
    const notes = adminNotes[request.id] || "";

    if (!adminValue || adminValue <= 0) {
      setMessage("Admin valuation is required.");
      return;
    }

    if (!request.profile_id) {
      setMessage("Request has no profile_id.");
      return;
    }

    setWorkingId(request.id);

    const platformFee = adminValue * 0.02;
    const netReceive = adminValue - platformFee;

    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("*")
      .eq("profile_id", request.profile_id)
      .maybeSingle();

    if (walletError || !walletData) {
      setMessage(walletError?.message || "Customer wallet not found.");
      setWorkingId("");
      return;
    }

    const wallet = walletData as Wallet;

    const balanceKey =
      "available_balance" in wallet
        ? "available_balance"
        : "balance" in wallet
          ? "balance"
          : "wallet_balance" in wallet
            ? "wallet_balance"
            : "";

    if (!balanceKey) {
      setMessage("Wallet balance column not found. Check wallets table column name.");
      setWorkingId("");
      return;
    }

    const currentBalance = Number(wallet[balanceKey] || 0);
    const newBalance = currentBalance + netReceive;

    const { error: walletUpdateError } = await supabase
      .from("wallets")
      .update({
        [balanceKey]: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", wallet.id);

    if (walletUpdateError) {
      setMessage(walletUpdateError.message);
      setWorkingId("");
      return;
    }

    const { error: txError } = await supabase.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      profile_id: request.profile_id,
      amount: netReceive,
      transaction_type: "SELL_TREE_CREDIT",
      type: "CREDIT",
      status: "COMPLETED",
      description: `Sell Tree valuation approved for ${request.tree_id}. Admin valuation: ${peso(adminValue)}.`,
    });

    if (txError) {
      setMessage(`Wallet credited, but transaction log failed: ${txError.message}`);
      setWorkingId("");
      await loadData();
      return;
    }

    const { error: requestUpdateError } = await supabase
      .from("sell_tree_requests")
      .update({
        tree_value: adminValue,
        approved_value: adminValue,
        platform_fee: platformFee,
        net_receive: netReceive,
        admin_notes: notes || "Admin valuation approved.",
        status: "APPROVED",
        approved_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (requestUpdateError) {
      setMessage(`Wallet credited, but request update failed: ${requestUpdateError.message}`);
      setWorkingId("");
      await loadData();
      return;
    }

    const tree = findTree(request);

    if (tree?.id) {
      await supabase
        .from("trees")
        .update({
          ownership_status: "SOLD",
          status: "SOLD",
          updated_at: new Date().toISOString(),
        })
        .eq("id", tree.id);
    }

    setMessage("Sell Tree approved. Wallet credited, request updated, and tree marked SOLD.");
    setWorkingId("");
    await loadData();
  }

  async function rejectRequest(request: SellRequest) {
    setMessage("");

    const notes = adminNotes[request.id] || "";

    if (!notes.trim()) {
      setMessage("Admin notes are required when rejecting.");
      return;
    }

    setWorkingId(request.id);

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

    setMessage("Sell Tree valuation request rejected.");
    setWorkingId("");
    await loadData();
  }

  return (
    <main className="min-h-screen text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8 rounded-3xl bg-[#071f16]/75 p-8 backdrop-blur-md border border-white/10 shadow-2xl">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#d9b45f]/80">
              Admin Tree Center
            </p>

            <h1 className="mt-2 text-4xl font-bold text-[#d9b45f]">
              Sell Tree Settlement
            </h1>

            <p className="mt-2 text-white/70">
              Customers request tree valuation only. Admin sets the offered price,
              adds notes, approves payout, or rejects the request.
            </p>
          </div>

          <button
            onClick={loadData}
            className="rounded-2xl border border-[#d9b45f]/30 px-5 py-3 font-bold text-[#d9b45f] hover:bg-[#d9b45f]/10"
          >
            Refresh
          </button>
        </div>

        {message && (
          <div className="rounded-2xl border border-[#d9b45f]/20 bg-[#d9b45f]/10 p-4 font-bold text-[#ffe8a3]">
            {message}
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card label="Total Requests" value={String(requests.length)} />
          <Card label="Pending Valuation" value={String(pendingRequests.length)} />
          <Card label="Approved" value={String(approvedRequests.length)} />
          <Card label="Rejected" value={String(rejectedRequests.length)} />
        </section>

        {loading ? (
          <div className="rounded-2xl bg-white/5 p-6 text-white/70 font-bold">
            Loading sell tree valuation requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl bg-white/5 p-6 text-white/70 font-bold">
            No sell tree requests yet.
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const tree = findTree(request);
              const adminValue = Number(adminValues[request.id] || 0);
              const fee = adminValue * 0.02;
              const net = adminValue - fee;
              const status = String(request.status || "PENDING ADMIN VALUATION").toUpperCase();
              const locked = isLockedStatus(status);

              return (
                <div
                  key={request.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.06] p-6"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-bold text-[#ffe49a]">
                          {request.tree_id || "Unknown Tree"}
                        </h2>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(
                            status
                          )}`}
                        >
                          {status}
                        </span>
                      </div>

                      <p className="mt-2 text-white/65">
                        Customer Request:{" "}
                        <b className="text-white">Tree valuation inquiry</b>
                      </p>

                      <p className="mt-1 text-white/65">
                        Tree Match:{" "}
                        <b className="text-white">
                          {tree?.display_name || tree?.tree_code || "Not matched"}
                        </b>
                      </p>

                      <p className="mt-1 text-white/65">
                        Submitted: <b className="text-white">{formatDate(request.created_at)}</b>
                      </p>

                      <p className="mt-1 text-white/65">
                        Current Admin Valuation:{" "}
                        <b className="text-white">
                          {Number(request.approved_value || request.tree_value || 0) > 0
                            ? peso(Number(request.approved_value || request.tree_value || 0))
                            : "Not set"}
                        </b>
                      </p>

                      {request.admin_notes && (
                        <p className="mt-3 rounded-2xl bg-black/20 p-3 text-white/75">
                          Admin Notes: {request.admin_notes}
                        </p>
                      )}
                    </div>

                    <div className="grid min-w-[320px] gap-3 rounded-2xl bg-black/20 p-4">
                      <label className="grid gap-2 text-sm font-bold text-white/70">
                        Admin Valuation / Offered Price
                        <input
                          disabled={locked}
                          type="number"
                          value={adminValues[request.id] || ""}
                          onChange={(event) =>
                            setAdminValues((current) => ({
                              ...current,
                              [request.id]: event.target.value,
                            }))
                          }
                          className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none"
                          placeholder="Enter final valuation"
                        />
                      </label>

                      <label className="grid gap-2 text-sm font-bold text-white/70">
                        Admin Notes
                        <textarea
                          disabled={locked}
                          value={adminNotes[request.id] || ""}
                          onChange={(event) =>
                            setAdminNotes((current) => ({
                              ...current,
                              [request.id]: event.target.value,
                            }))
                          }
                          className="min-h-[90px] rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none"
                          placeholder="Explain valuation, offer, or rejection reason."
                        />
                      </label>

                      <div className="rounded-2xl bg-white/5 p-4 text-sm">
                        <div className="flex justify-between gap-3">
                          <span className="text-white/60">Platform Fee 2%</span>
                          <b>{peso(fee)}</b>
                        </div>

                        <div className="mt-2 flex justify-between gap-3">
                          <span className="text-white/60">Customer Net Receive</span>
                          <b className="text-[#ffe49a]">{peso(net > 0 ? net : 0)}</b>
                        </div>
                      </div>

                      {!locked && (
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => approveRequest(request)}
                            disabled={workingId === request.id}
                            className="rounded-xl bg-[#d9b45f] px-4 py-3 font-black text-[#071f16] disabled:opacity-50"
                          >
                            {workingId === request.id ? "Working..." : "Approve"}
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

                      {locked && (
                        <div className="rounded-xl bg-white/5 p-3 text-center text-sm font-bold text-white/60">
                          This request is already settled.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-white/50">
        {label}
      </p>
      <h3 className="mt-2 text-3xl font-black text-[#ffe49a]">{value}</h3>
    </div>
  );
}