"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  membership_status: string | null;
  kyc_status: string | null;
};

type TreeRow = Record<string, any>;

type SellTreeRequest = {
  id: string;
  profile_id: string | null;
  tree_id: string | null;
  tree_value: number | null;
  platform_fee: number | null;
  net_receive: number | null;
  approved_value: number | null;
  status: string | null;
  admin_notes: string | null;
  withdrawal_request_id?: string | null;
  platform_treasury_id?: string | null;
  payout_status?: string | null;
  payout_method?: string | null;
  payout_account_name?: string | null;
  payout_account_number?: string | null;
  payout_queued_at?: string | null;
  created_at?: string | null;
};

type WithdrawalRequest = {
  id: string;
  profile_id: string | null;
  amount: number | null;
  processing_fee: number | null;
  net_receive: number | null;
  status: string | null;
  payout_method: string | null;
  payout_account_name: string | null;
  payout_account_number: string | null;
  created_at?: string | null;
};

type PhotoUpdate = {
  id: string;
  tree_id: string | null;
  photo_url?: string | null;
  image_url?: string | null;
  status?: string | null;
  created_at?: string | null;
};

const forestBg =
  "/images/arganwood-reference/premium-background.png";

const PLATFORM_FEE_RATE = 0.02;

const statusText: Record<string, string> = {
  PENDING: "Your sell request is waiting for Admin review.",
  INSPECTION_REQUESTED: "Admin requested field inspection.",
  INSPECTION_SUBMITTED: "Gardener submitted inspection evidence.",
  OFFER_SENT: "Admin sent you an offer. You can accept or wait.",
  CUSTOMER_ACCEPTED: "You accepted the offer. Admin will queue your payout.",
  PAYOUT_QUEUED:
    "Admin queued your payout. Withdrawal is waiting for payout processing.",
  PAID: "Payout completed.",
  REJECTED: "Admin rejected the sell request.",
};

export default function CustomerSellTreePageV6() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [requests, setRequests] = useState<SellTreeRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [photoUpdates, setPhotoUpdates] = useState<PhotoUpdate[]>([]);

  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("BANK_TRANSFER");
  const [payoutAccountName, setPayoutAccountName] = useState("");
  const [payoutAccountNumber, setPayoutAccountNumber] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSellTreeCenter();
  }, []);

  const selectedTree = useMemo(() => {
    return trees.find((tree) => tree.id === selectedTreeId) || null;
  }, [trees, selectedTreeId]);

  const previewValue = useMemo(() => {
    if (!selectedTree) return 0;
    return getTreeValue(selectedTree);
  }, [selectedTree]);

  const previewFee = useMemo(() => {
    return Math.round(previewValue * PLATFORM_FEE_RATE);
  }, [previewValue]);

  const previewNet = useMemo(() => {
    return Math.max(previewValue - previewFee, 0);
  }, [previewValue, previewFee]);

  const payoutComplete = Boolean(payoutMethod.trim() && payoutAccountName.trim() && payoutAccountNumber.trim());

  const membershipActive =
    String(profile?.membership_status || "").toUpperCase() === "ACTIVE";

  const kycApproved =
    String(profile?.kyc_status || "").toUpperCase() === "APPROVED";

  const latestPhotoByTreeId = useMemo(() => {
    const map = new Map<string, PhotoUpdate>();
    photoUpdates.forEach((photo) => {
      if (!photo.tree_id) return;
      const current = map.get(String(photo.tree_id));
      if (!current || new Date(photo.created_at || 0).getTime() >= new Date(current.created_at || 0).getTime()) {
        map.set(String(photo.tree_id), photo);
      }
    });
    return map;
  }, [photoUpdates]);

  async function resolveProfile() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      throw new Error("Please login first.");
    }

    const user = authData.user;
    const email = user.email?.trim().toLowerCase() || "";

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, full_name, email, membership_status, kyc_status")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, full_name, email, membership_status, kyc_status")
      .eq("email", email)
      .maybeSingle();

    const resolved = profileById || profileByEmail;

    if (!resolved) {
      throw new Error("Customer profile not found.");
    }

    return resolved as Profile;
  }

  async function loadCustomerTrees(profileId: string) {
    const { data: bothRows, error: bothError } = await supabase
      .from("trees")
      .select("*")
      .or(`customer_profile_id.eq.${profileId},profile_id.eq.${profileId}`)
      .order("created_at", { ascending: false });

    if (!bothError) return (bothRows || []) as TreeRow[];

    const { data: customerRows, error: customerError } = await supabase
      .from("trees")
      .select("*")
      .eq("customer_profile_id", profileId)
      .order("created_at", { ascending: false });

    if (!customerError) return (customerRows || []) as TreeRow[];

    const { data: profileRows, error: profileError } = await supabase
      .from("trees")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    if (profileError) throw profileError;

    return (profileRows || []) as TreeRow[];
  }

  async function loadSellTreeCenter() {
    try {
      setLoading(true);

      const resolvedProfile = await resolveProfile();
      setProfile(resolvedProfile);

      const treeRows = await loadCustomerTrees(resolvedProfile.id);
      setTrees(treeRows);

      const treeIds = treeRows.map((tree) => tree.id).filter(Boolean);
      if (treeIds.length > 0) {
        const { data: photoRows, error: photoError } = await supabase
          .from("tree_photo_updates")
          .select("id, tree_id, photo_url, image_url, status, created_at")
          .in("tree_id", treeIds)
          .in("status", ["APPROVED", "COMPLETED"])
          .order("created_at", { ascending: false });
        if (!photoError) setPhotoUpdates((photoRows || []) as PhotoUpdate[]);
        else setPhotoUpdates([]);
      } else {
        setPhotoUpdates([]);
      }

      const { data: requestRows, error: requestError } = await supabase
        .from("sell_tree_requests")
        .select("*")
        .eq("profile_id", resolvedProfile.id)
        .order("created_at", { ascending: false });

      if (requestError) throw requestError;

      setRequests((requestRows || []) as SellTreeRequest[]);

      const { data: withdrawalRows, error: withdrawalError } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("profile_id", resolvedProfile.id)
        .order("created_at", { ascending: false });

      if (withdrawalError) throw withdrawalError;

      setWithdrawals((withdrawalRows || []) as WithdrawalRequest[]);
    } catch (error: any) {
      alert(error.message || "Failed to load Sell Tree Center.");
    } finally {
      setLoading(false);
    }
  }

  async function createSellRequest() {
    if (!profile) return alert("Profile not found.");

    if (!membershipActive) {
      return alert(
        "Annual Membership Required. Please activate membership first."
      );
    }

    if (!selectedTree) return alert("Please select a seedling to sell.");
    if (!payoutMethod.trim()) return alert("Please select payout method.");
    if (!payoutAccountName.trim()) return alert("Please enter payout account name.");
    if (!payoutAccountNumber.trim()) return alert("Please enter payout account number or mobile number.");

    const existingActive = requests.find(
      (request) =>
        request.tree_id === selectedTree.id &&
        !["PAID", "REJECTED"].includes(request.status || "PENDING")
    );

    if (existingActive) {
      return alert("This seedling already has an active sell request.");
    }

    try {
      setSaving(true);

      const treeValue = getTreeValue(selectedTree);
      const platformFee = Math.round(treeValue * PLATFORM_FEE_RATE);
      const netReceive = Math.max(treeValue - platformFee, 0);

      const primaryPayload: Record<string, any> = {
        profile_id: profile.id,
        tree_id: selectedTree.id,
        tree_value: treeValue,
        platform_fee: platformFee,
        net_receive: netReceive,
        payout_method: payoutMethod,
        payout_account_name: payoutAccountName.trim(),
        payout_account_number: payoutAccountNumber.trim(),
        latest_photo_id: latestPhotoByTreeId.get(String(selectedTree.id))?.id || null,
        payout_status: "NOT_QUEUED",
        status: "PENDING",
        admin_notes: null,
      };

      const { error } = await supabase.from("sell_tree_requests").insert(primaryPayload);
      if (error) {
        const fallbackPayload = { ...primaryPayload };
        delete fallbackPayload.latest_photo_id;
        const { error: fallbackError } = await supabase.from("sell_tree_requests").insert(fallbackPayload);
        if (fallbackError) throw fallbackError;
      }

      setSelectedTreeId("");
      await loadSellTreeCenter();
      alert("Sell request created. Waiting for Admin review.");
    } catch (error: any) {
      alert(error.message || "Failed to create sell request.");
    } finally {
      setSaving(false);
    }
  }

  async function acceptOffer(request: SellTreeRequest) {
    if (!profile) return alert("Profile not found.");

    if (!kycApproved) {
      return alert(
        "KYC Verification Required. Cashout and sell tree payouts require approved KYC."
      );
    }

    if (request.status !== "OFFER_SENT") {
      return alert("This offer is not available for acceptance.");
    }

    if (!payoutMethod.trim()) return alert("Please select payout method.");
    if (!payoutAccountName.trim())
      return alert("Please enter payout account name.");
    if (!payoutAccountNumber.trim())
      return alert("Please enter payout account number.");

    const confirmed = window.confirm(
      "Accept this offer? Admin will queue the payout after review. No withdrawal will be created from customer side."
    );

    if (!confirmed) return;

    try {
      setSaving(true);

      const { error: acceptError } = await supabase
        .from("sell_tree_requests")
        .update({
          status: "CUSTOMER_ACCEPTED",
          payout_method: payoutMethod,
          payout_account_name: payoutAccountName.trim(),
          payout_account_number: payoutAccountNumber.trim(),
          payout_status: "NOT_QUEUED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id)
        .eq("profile_id", profile.id)
        .eq("status", "OFFER_SENT");

      if (acceptError) throw acceptError;

      setPayoutAccountName("");
      setPayoutAccountNumber("");

      await loadSellTreeCenter();
      alert("Offer accepted. Waiting for Admin payout queue.");
    } catch (error: any) {
      alert(error.message || "Failed to accept offer.");
    } finally {
      setSaving(false);
    }
  }

  function getForestName(tree: TreeRow | null | undefined) {
    if (!tree) return "Unnamed Forest";

    return (
      tree.tree_group_name ||
      tree.plantation_block ||
      tree.block_name ||
      tree.farm_location ||
      "Unnamed Forest"
    );
  }

  function getSeedlingName(tree: TreeRow | null | undefined) {
    if (!tree) return "Seedling";

    return tree.display_name || tree.custom_name || tree.customer_tree_name || "Seedling";
  }

  function getTreeCode(tree: TreeRow | null | undefined) {
    if (!tree) return "Code pending";
    return tree.tree_code || tree.code || "Code pending";
  }

  function getLatestPhoto(tree: TreeRow | null | undefined) {
    if (!tree?.id) return null;
    return latestPhotoByTreeId.get(String(tree.id)) || null;
  }

  function getTreeImage(tree: TreeRow | null | undefined) {
    const latest = getLatestPhoto(tree);
    return latest?.photo_url || latest?.image_url || tree?.latest_photo_url || tree?.latest_image_url || tree?.image_url || tree?.photo_url || tree?.default_image_url || "/images/arganwood-reference/young-agarwood-tree.png";
  }

  function getTreeValue(tree: TreeRow | null | undefined) {
    if (!tree) return 0;

    return Number(
      tree.valuation_amount ||
        tree.current_value ||
        tree.tree_value ||
        tree.purchase_price ||
        tree.price ||
        0
    );
  }

  function findTree(treeId?: string | null) {
    if (!treeId) return null;
    return trees.find((tree) => tree.id === treeId) || null;
  }

  function findWithdrawalForRequest(request: SellTreeRequest) {
    if (request.withdrawal_request_id) {
      return (
        withdrawals.find(
          (withdrawal) =>
            String(withdrawal.id) === String(request.withdrawal_request_id)
        ) || null
      );
    }

    return null;
  }

  function money(value?: number | null) {
    return `₱${Number(value || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function statusBadge(status?: string | null) {
    const s = status || "PENDING";

    if (s === "PAID")
      return "border-emerald-400/40 bg-emerald-500/15 text-emerald-300";
    if (s === "REJECTED")
      return "border-red-400/40 bg-red-500/15 text-red-300";
    if (s === "OFFER_SENT")
      return "border-amber-400/40 bg-amber-500/15 text-amber-300";
    if (s === "PAYOUT_QUEUED" || s === "CUSTOMER_ACCEPTED") {
      return "border-blue-400/40 bg-blue-500/15 text-blue-300";
    }

    return "border-white/15 bg-white/10 text-white/75";
  }

  function formatDate(date?: string | null) {
    if (!date) return "";
    return new Date(date).toLocaleString();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#020b06] text-white flex items-center justify-center">
        <div className="rounded-3xl border border-amber-400/20 bg-white/5 px-8 py-6 text-amber-200">
          Loading Sell Tree Center...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020b06] text-white p-4 md:p-6">
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-emerald-400/20 bg-[#03110b]/95 p-4 md:p-6 shadow-2xl">
        <section
          className="relative overflow-hidden rounded-[2rem] border border-emerald-300/20 bg-cover bg-center p-8 md:p-12"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(2,11,6,.98), rgba(2,11,6,.70), rgba(2,11,6,.30)), url(${forestBg})`,
          }}
        >
          <div className="relative z-10 max-w-3xl">
            <p className="text-amber-300 text-sm font-bold tracking-[0.25em] uppercase">
              Arganwood Sell Tree
            </p>
            <h1 className="mt-4 text-4xl md:text-5xl font-serif font-bold">
              Sell Tree Center V6
            </h1>
            <p className="mt-4 text-white/85 max-w-xl">
              Create a sell request, wait for Admin offer, accept offer, then
              track payout queue.
            </p>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Owned Seedlings" value={trees.length} icon="🌱" />
          <StatCard title="Sell Requests" value={requests.length} icon="📄" />
          <StatCard
            title="Offers Sent"
            value={requests.filter((r) => r.status === "OFFER_SENT").length}
            icon="🤝"
          />
          <StatCard
            title="Payout Queue"
            value={requests.filter((r) => r.status === "PAYOUT_QUEUED").length}
            icon="🏦"
          />
        </section>

        <section className="mt-5 grid grid-cols-1 lg:grid-cols-[430px_1fr] gap-5">
          <div className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <StepHeader
                step="1"
                title="CREATE SELL REQUEST"
                subtitle="Select your owned seedling."
              />

              {!membershipActive && (
                <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5">
                  <p className="text-amber-300 font-bold">
                    Annual Membership Required
                  </p>
                  <p className="mt-2 text-sm text-white/75">
                    Only active members can request Sell Tree review. Membership
                    keeps tree ownership, care history, and payout processing
                    protected.
                  </p>
                  <a
                    href="/dashboard/membership"
                    className="mt-4 inline-flex rounded-xl bg-gradient-to-r from-amber-400 to-yellow-600 px-5 py-3 text-sm font-bold text-black"
                  >
                    Go to Membership
                  </a>
                </div>
              )}

              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-sm font-semibold">Choose Seedling</span>
                  <select
                    className="mt-2 w-full rounded-xl bg-black/25 border border-white/10 px-4 py-3 outline-none focus:border-amber-400"
                    value={selectedTreeId}
                    onChange={(e) => setSelectedTreeId(e.target.value)}
                  >
                    <option value="">Select seedling</option>
                    {trees.map((tree) => (
                      <option key={tree.id} value={tree.id}>
                        {getForestName(tree)} — {getSeedlingName(tree)}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedTree ? (
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5 space-y-3">
                    <img src={getTreeImage(selectedTree)} alt={getSeedlingName(selectedTree)} className="h-44 w-full rounded-2xl border border-white/10 object-cover" />
                    <InfoRow
                      label="Forest Name"
                      value={getForestName(selectedTree)}
                    />
                    <InfoRow
                      label="Seedling Name"
                      value={getSeedlingName(selectedTree)}
                    />
                    <InfoRow
                      label="Estimated Value"
                      value={money(previewValue)}
                    />
                    <InfoRow label="Preview Fee" value={money(previewFee)} />
                    <InfoRow
                      label="Preview Net Receive"
                      value={money(previewNet)}
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-white/60">
                    Choose a seedling to preview estimated sell value.
                  </div>
                )}

                <button
                  onClick={createSellRequest}
                  disabled={saving || !selectedTree || !membershipActive || !payoutComplete}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-yellow-600 text-black font-bold py-3 hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Create Sell Request"}
                </button>
                {!payoutComplete && (
                  <p className="text-center text-xs font-semibold text-amber-200/80">Add payout method, account name, and account/mobile number before creating a sell request.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <StepHeader
                step="2"
                title="PAYOUT DETAILS"
                subtitle="Required before creating or accepting a sell request."
              />

              {!kycApproved && (
                <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5">
                  <p className="text-amber-300 font-bold">
                    KYC Verification Required
                  </p>
                  <p className="mt-2 text-sm text-white/75">
                    Cashout and sell tree payouts require approved KYC.
                  </p>
                  <a
                    href="/dashboard/kyc"
                    className="mt-4 inline-flex rounded-xl bg-gradient-to-r from-amber-400 to-yellow-600 px-5 py-3 text-sm font-bold text-black"
                  >
                    Go to KYC
                  </a>
                </div>
              )}

              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-sm font-semibold">Payout Method</span>
                  <select
                    className="mt-2 w-full rounded-xl bg-black/25 border border-white/10 px-4 py-3 outline-none focus:border-amber-400"
                    value={payoutMethod}
                    onChange={(e) => setPayoutMethod(e.target.value)}
                  >
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="GCASH">GCash</option>
                    <option value="MAYA">Maya</option>
                    <option value="MANUAL_PAYOUT">Manual Payout</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold">Account Name</span>
                  <input
                    className="mt-2 w-full rounded-xl bg-black/25 border border-white/10 px-4 py-3 outline-none focus:border-amber-400"
                    value={payoutAccountName}
                    onChange={(e) => setPayoutAccountName(e.target.value)}
                    placeholder="Account holder name"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold">Account Number</span>
                  <input
                    className="mt-2 w-full rounded-xl bg-black/25 border border-white/10 px-4 py-3 outline-none focus:border-amber-400"
                    value={payoutAccountNumber}
                    onChange={(e) => setPayoutAccountNumber(e.target.value)}
                    placeholder="Bank / wallet number"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <StepHeader
              step="3"
              title="SELL REQUEST HISTORY"
              subtitle="View Admin offer and payout status."
            />

            <div className="mt-6 space-y-4">
              {requests.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-black/20 p-8 text-white/60">
                  No sell requests yet.
                </div>
              ) : (
                requests.map((request) => {
                  const tree = findTree(request.tree_id);
                  const withdrawal = findWithdrawalForRequest(request);
                  const status = request.status || "PENDING";

                  return (
                    <div
                      key={request.id}
                      className="rounded-3xl border border-white/10 bg-black/20 p-5"
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div>
                          <p className="text-amber-300 text-xs font-bold tracking-[0.2em] uppercase">
                            Sell Request
                          </p>
                          <h3 className="mt-2 text-2xl font-serif font-bold">
                            {getSeedlingName(tree)}
                          </h3>
                          <p className="text-white/60">{getForestName(tree)}</p>
                          <p className="mt-1 text-xs text-white/45">
                            {formatDate(request.created_at)}
                          </p>
                        </div>

                        <span
                          className={`w-fit rounded-xl border px-4 py-2 text-xs font-bold ${statusBadge(
                            status
                          )}`}
                        >
                          {status}
                        </span>
                      </div>

                      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <MiniBox
                          label="Tree Value"
                          value={money(request.tree_value)}
                        />
                        <MiniBox
                          label="Admin Offer"
                          value={money(request.approved_value)}
                        />
                        <MiniBox
                          label="Net Receive"
                          value={money(request.net_receive)}
                        />
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <InfoRow
                          label="Platform Fee"
                          value={money(request.platform_fee)}
                        />
                        <InfoRow
                          label="Payout Status"
                          value={
                            request.payout_status ||
                            (status === "PAYOUT_QUEUED"
                              ? "QUEUED"
                              : "Not queued yet")
                          }
                        />
                        <InfoRow
                          label="Withdrawal Status"
                          value={
                            withdrawal?.status ||
                            (status === "PAYOUT_QUEUED"
                              ? "PENDING"
                              : "Not created yet")
                          }
                        />
                        {withdrawal ? (
                          <InfoRow
                            label="Paid Amount"
                            value={money(withdrawal.net_receive)}
                          />
                        ) : null}
                      </div>

                      {request.admin_notes ? (
                        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
                          <p className="text-amber-300 font-bold text-sm">
                            Admin Notes
                          </p>
                          <p className="mt-2 text-white/85">
                            {request.admin_notes}
                          </p>
                        </div>
                      ) : null}

                      <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                        <p className="text-emerald-300 font-bold text-sm">
                          Status Meaning
                        </p>
                        <p className="mt-2 text-white/80">
                          {statusText[status] ||
                            "Your sell request is being processed."}
                        </p>
                      </div>

                      {status === "OFFER_SENT" ? (
                        <div className="mt-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5">
                          <div>
                            <p className="text-amber-300 font-bold">
                              Admin Offer Ready
                            </p>
                            <p className="text-white/70 text-sm">
                              Accepting saves your payout details only. Admin is
                              the only one who can queue payout.
                            </p>
                          </div>

                          <button
                            onClick={() => acceptOffer(request)}
                            disabled={saving || !kycApproved}
                            className="rounded-xl bg-gradient-to-r from-amber-400 to-yellow-600 px-6 py-3 text-black font-bold hover:opacity-90 disabled:opacity-50"
                          >
                            Accept Offer
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-6">
          <h3 className="text-xl font-bold">Important Sell Tree Rule</h3>
          <p className="mt-2 text-white/75">
            Sell Tree does not credit your wallet. Customer acceptance only
            saves payout details. Admin queue payout creates the withdrawal
            request and records the platform fee.
          </p>
        </section>

        <footer className="py-8 text-center">
          <p className="text-amber-300 font-serif text-xl font-bold">
            ARGANWOOD
          </p>
          <p className="text-xs text-white/45">Growing a Greener Tomorrow 🌿</p>
        </footer>
      </div>
    </main>
  );
}

function StepHeader({
  step,
  title,
  subtitle,
}: {
  step: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-full border border-amber-400 text-amber-300 flex items-center justify-center font-bold">
        {step}
      </div>
      <div>
        <h2 className="font-bold text-lg">{title}</h2>
        <p className="text-white/60 text-sm">{subtitle}</p>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-emerald-500/15 flex items-center justify-center text-xl">
          {icon}
        </div>
        <p className="text-sm font-semibold text-white/85">{title}</p>
      </div>
      <p className="mt-4 text-4xl font-bold">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 py-2 last:border-b-0">
      <span className="text-white/55 text-sm">{label}</span>
      <span className="font-semibold text-white text-right">{value}</span>
    </div>
  );
}

function MiniBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-white/50 text-xs">{label}</p>
      <p className="mt-2 text-lg font-bold text-amber-200">{value}</p>
    </div>
  );
}