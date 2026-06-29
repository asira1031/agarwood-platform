"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  membership_status: string | null;
  kyc_status: string | null;
};

type Wallet = {
  id: string;
  profile_id: string;
  balance: number | null;
  created_at?: string | null;
};

type CashInRequest = {
  id: string;
  amount: number | null;
  payment_method: string | null;
  reference_no: string | null;
  receipt_url: string | null;
  status: string | null;
  created_at: string | null;
};

type WithdrawalRequest = {
  id: string;
  amount: number | null;
  processing_fee: number | null;
  net_receive: number | null;
  status: string | null;
  created_at: string | null;
  payout_method?: string | null;
  payout_account_name?: string | null;
  payout_account_number?: string | null;
};

type WalletTransaction = {
  id: string;
  transaction_type: string | null;
  amount: number | null;
  status: string | null;
  reference_no: string | null;
  description: string | null;
  created_at: string | null;
};

type MembershipOrder = {
  id: string;
  amount: number | null;
  status: string | null;
  payment_status: string | null;
  created_at: string | null;
};

type SellTreeRequest = {
  id: string;
  expected_amount: number | null;
  selling_price: number | null;
  status: string | null;
  created_at: string | null;
};

type PendingItem = {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  status: string;
  date: string | null;
};

const PAYMENT_ACCOUNT_NAME = "JANICA MALDIVES";
const AMOUNTS = [500, 1000, 2000, 5000, 10000, 50000];
const CASH_IN_METHODS = ["GCASH", "MAYA", "BPI"];
const PAYOUT_METHODS = ["GCASH", "MAYA", "BANK_TRANSFER"];

export default function WalletPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [cashIns, setCashIns] = useState<CashInRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [membershipOrders, setMembershipOrders] = useState<MembershipOrder[]>([]);
  const [sellTreeRequests, setSellTreeRequests] = useState<SellTreeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeAction, setActiveAction] = useState<"NONE" | "CASHIN" | "WITHDRAW">("NONE");

  const [cashInAmount, setCashInAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [cashInReference, setCashInReference] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("");
  const [payoutName, setPayoutName] = useState("");
  const [payoutNumber, setPayoutNumber] = useState("");
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);

  async function getOrCreateWallet(profileId: string) {
    const { data: walletRows, error: walletLoadError } = await supabase
      .from("wallets")
      .select("id, profile_id, balance, created_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (walletLoadError) throw walletLoadError;

    if (walletRows && walletRows.length > 0) {
      return walletRows[0] as Wallet;
    }

    const { data: createdWallet, error: createWalletError } = await supabase
      .from("wallets")
      .insert({
        profile_id: profileId,
        balance: 0,
      })
      .select("id, profile_id, balance, created_at")
      .single();

    if (createWalletError) throw createWalletError;

    return createdWallet as Wallet;
  }

  async function loadWallet() {
    try {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const email = user.email?.trim().toLowerCase() || "";

      const { data: profileById } = await supabase
        .from("profiles")
        .select("id, full_name, email, membership_status, kyc_status")
        .eq("id", user.id)
        .maybeSingle();

      let currentProfile = profileById as Profile | null;

      if (!currentProfile && email) {
        const { data: profileByEmail } = await supabase
          .from("profiles")
          .select("id, full_name, email, membership_status, kyc_status")
          .eq("email", email)
          .maybeSingle();

        currentProfile = profileByEmail as Profile | null;
      }

      if (!currentProfile) {
        setMessage("Profile not found.");
        setLoading(false);
        return;
      }

      setProfile(currentProfile);

      const profileId = currentProfile.id;
      const walletData = await getOrCreateWallet(profileId);

      const { data: cashInData } = await supabase
        .from("cashin_requests")
        .select("id, amount, payment_method, reference_no, receipt_url, status, created_at")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });

      const { data: withdrawalData, error: withdrawalError } = await supabase
        .from("withdrawal_requests")
        .select(
          "id, amount, processing_fee, net_receive, status, created_at, payout_method, payout_account_name, payout_account_number"
        )
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });

      if (withdrawalError) {
        console.warn("withdrawal_requests load error:", withdrawalError.message);
      }

      const { data: transactionData } = await supabase
        .from("wallet_transactions")
        .select("id, transaction_type, amount, status, reference_no, description, created_at")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });

      const { data: orderData, error: orderError } = await supabase
        .from("membership_orders")
        .select("id, amount, status, payment_status, created_at")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });

      if (orderError) {
        console.warn("membership_orders load error:", orderError.message);
      }

      const { data: sellData, error: sellError } = await supabase
        .from("sell_tree_requests")
        .select("id, expected_amount, selling_price, status, created_at")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });

      if (sellError) {
        console.warn("sell_tree_requests load error:", sellError.message);
      }

      setWallet(walletData);
      setCashIns((cashInData as CashInRequest[]) || []);
      setWithdrawals(withdrawalError ? [] : ((withdrawalData as WithdrawalRequest[]) || []));
      setTransactions((transactionData as WalletTransaction[]) || []);
      setMembershipOrders(orderError ? [] : ((orderData as MembershipOrder[]) || []));
      setSellTreeRequests(sellError ? [] : ((sellData as SellTreeRequest[]) || []));
    } catch (error: any) {
      console.error("Wallet load error:", error);
      setMessage(error?.message || "Unable to load wallet.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWallet();
  }, []);

  const walletBalance = Number(wallet?.balance || 0);
  const membershipActive = profile?.membership_status === "ACTIVE";
  const kycApproved = profile?.kyc_status === "APPROVED";
  const canWithdraw = kycApproved;

  const withdrawNumber = Number(withdrawAmount || 0);
  const withdrawFee = withdrawNumber * 0.02;
  const withdrawNet = withdrawNumber - withdrawFee;
  const payoutReady = Boolean(payoutMethod && payoutName.trim() && payoutNumber.trim());
  const withdrawalBlockedReason = (() => {
    if (!withdrawAmount.trim()) return "";
    if (!Number.isFinite(withdrawNumber) || withdrawNumber <= 0) return "Enter a withdrawal amount greater than ₱0.";
    if (withdrawNumber < 100) return "Minimum withdrawal amount is ₱100.";
    if (withdrawNumber > walletBalance) return "Insufficient wallet balance. Please enter an amount within your available balance.";
    if (!canWithdraw) return "Withdrawal is locked until your KYC is approved.";
    if (!payoutReady) return "Complete payout method, account name, and account number before submitting.";
    return "";
  })();
  const canSubmitWithdrawal = !processing && !withdrawalBlockedReason && withdrawNumber > 0 && payoutReady && canWithdraw;

  const stats = useMemo(() => {
    const totalCashIn = transactions
      .filter((item) => ["CASH_IN", "CASHIN", "CASH_IN_APPROVED"].includes((item.transaction_type || "").toUpperCase()))
      .filter((item) => ["APPROVED", "COMPLETED", "SUCCESS"].includes((item.status || "").toUpperCase()))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const totalWithdrawn = transactions
      .filter((item) => ["WITHDRAW", "WITHDRAWAL", "CASH_OUT", "CASHOUT"].includes((item.transaction_type || "").toUpperCase()))
      .filter((item) => ["APPROVED", "COMPLETED", "SUCCESS", "PENDING"].includes((item.status || "").toUpperCase()))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return { totalCashIn, totalWithdrawn };
  }, [transactions]);

  const pendingItems = useMemo<PendingItem[]>(() => {
    const pendingStatuses = ["PENDING", "PROCESSING", "UNDER_REVIEW", "UNDER REVIEW"];

    const cashInPending = cashIns
      .filter((item) => pendingStatuses.includes((item.status || "PENDING").toUpperCase()))
      .map((item) => ({
        id: `cashin-${item.id}`,
        title: "Cash-In Request",
        subtitle: item.payment_method || "Payment verification",
        amount: Number(item.amount || 0),
        status: item.status || "PENDING",
        date: item.created_at,
      }));

    const withdrawalPending = withdrawals
      .filter((item) => pendingStatuses.includes((item.status || "PENDING").toUpperCase()))
      .map((item) => ({
        id: `withdraw-${item.id}`,
        title: "Withdrawal Request",
        subtitle: item.payout_method || "Payout approval",
        amount: Number(item.amount || 0),
        status: item.status || "PENDING",
        date: item.created_at,
      }));

    const membershipPending = membershipOrders
      .filter((item) => pendingStatuses.includes((item.status || "PENDING").toUpperCase()))
      .map((item) => ({
        id: `membership-${item.id}`,
        title: "Membership Order",
        subtitle: item.payment_status || "Admin approval",
        amount: Number(item.amount || 0),
        status: item.status || "PENDING",
        date: item.created_at,
      }));

    const sellTreePending = sellTreeRequests
      .filter((item) => pendingStatuses.includes((item.status || "PENDING").toUpperCase()))
      .map((item) => ({
        id: `sell-${item.id}`,
        title: "Sell Tree Request",
        subtitle: "Settlement review",
        amount: Number(item.expected_amount || item.selling_price || 0),
        status: item.status || "PENDING",
        date: item.created_at,
      }));

    return [...cashInPending, ...withdrawalPending, ...membershipPending, ...sellTreePending].sort(
      (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
    );
  }, [cashIns, withdrawals, membershipOrders, sellTreeRequests]);

  async function submitCashIn() {
    try {
      setMessage("");
      setProcessing(true);

      if (!profile) return setMessage("Profile not found.");
      if (!wallet) return setMessage("Wallet not found.");

      const amount = Number(cashInAmount);

      if (!amount || amount < 100) {
        return setMessage("Minimum cash-in amount is ₱100.");
      }

      if (!paymentMethod) {
        return setMessage("Please select payment method.");
      }

      if (!cashInReference.trim()) {
        return setMessage("Reference number is required after payment.");
      }

      const { error: cashInError } = await supabase.from("cashin_requests").insert({
        profile_id: profile.id,
        amount,
        payment_method: paymentMethod,
        account_name: PAYMENT_ACCOUNT_NAME,
        reference_no: cashInReference.trim(),
        receipt_url: receiptUrl.trim() || null,
        status: "PENDING",
      });

      if (cashInError) throw cashInError;

      setCashInAmount("");
      setPaymentMethod("");
      setCashInReference("");
      setReceiptUrl("");
      setActiveAction("NONE");
      setMessage("Cash-in request submitted. Wallet will be credited after admin approval.");
      await loadWallet();
    } catch (error: any) {
      console.error("Cash-in error:", error);
      setMessage(error?.message || "Cash-in failed.");
    } finally {
      setProcessing(false);
    }
  }

  async function submitWithdrawal() {
    try {
      setMessage("");
      setProcessing(true);

      if (!profile) return setMessage("Profile not found.");
      if (!wallet) return setMessage("Wallet not found.");

      if (!canWithdraw) {
        return setMessage("Withdrawal locked. KYC must be APPROVED.");
      }

      if (!Number.isFinite(withdrawNumber) || withdrawNumber <= 0) {
        return setMessage("Enter a withdrawal amount greater than ₱0.");
      }

      if (withdrawNumber < 100) {
        return setMessage("Minimum withdrawal amount is ₱100.");
      }

      if (withdrawNumber > walletBalance) {
        return setMessage("Insufficient wallet balance. Please enter an amount within your available balance.");
      }

      if (!payoutMethod) {
        return setMessage("Please select payout method.");
      }

      if (!payoutName.trim() || !payoutNumber.trim()) {
        return setMessage("Payout account name and number are required.");
      }

      const { error } = await supabase.rpc("submit_customer_withdrawal", {
        p_profile_id: profile.id,
        p_amount: withdrawNumber,
        p_payout_method: payoutMethod,
        p_payout_account_name: payoutName.trim(),
        p_payout_account_number: payoutNumber.trim(),
      });

      if (error) {
        throw error;
      }

      setWithdrawAmount("");
      setPayoutMethod("");
      setPayoutName("");
      setPayoutNumber("");
      setActiveAction("NONE");
      setMessage("Withdrawal request submitted. Wallet balance deducted successfully.");

      await loadWallet();
    } catch (error: any) {
      console.error("Withdrawal error:", error);
      setMessage(error?.message || "Withdrawal failed.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <main className="walletPage">
      <section className="hero">
        <div>
          <p className="eyebrow">Agarwood Wallet Command Center</p>
          <h1>Wallet</h1>
          <span>
            Manage cash-ins, withdrawals, wallet history, membership payments, and settlement approvals in one premium finance center.
          </span>
        </div>
      </section>

      {loading ? (
        <div className="loadingBox">Loading wallet data...</div>
      ) : (
        <>
          {message && <div className="messageBox">{message}</div>}

          <section className="topCards">
            <div className="balanceCard">
              <div>
                <p>Available Balance</p>
                <h2>{peso(walletBalance)}</h2>
              </div>
              <div className="balanceSeal">₱</div>
            </div>

            <MetricCard label="Total Cash-In" value={peso(stats.totalCashIn)} note="Completed cash-ins" />
            <MetricCard label="Total Withdrawn" value={peso(stats.totalWithdrawn)} note="Submitted withdrawals" />
          </section>

          <section className="actionCards">
            <button
              className={`actionCard ${activeAction === "CASHIN" ? "selected" : ""}`}
              onClick={() => {
                setActiveAction(activeAction === "CASHIN" ? "NONE" : "CASHIN");
                setMessage("");
              }}
            >
              <span>Cash In</span>
              <strong>Submit Funds for Approval</strong>
              <small>GCash, Maya, or BPI • credited after admin approval</small>
            </button>

            <button
              className={`actionCard ${activeAction === "WITHDRAW" ? "selected" : ""}`}
              onClick={() => {
                setActiveAction(activeAction === "WITHDRAW" ? "NONE" : "WITHDRAW");
                setMessage("");
              }}
            >
              <span>Withdraw</span>
              <strong>Request Secure Cash-Out</strong>
              <small>2% fee preview • approval tracked</small>
            </button>
          </section>

          {activeAction === "CASHIN" && (
            <section className="flowPanel">
              <PanelHeader
                title="Cash-In Request"
                text="Select amount first. After choosing an amount, select where you paid and submit the reference number."
                badge="Admin Approval Required"
              />

              <div className="stepBox">
                <StepTitle number="1" title="Select Cash-In Amount" />
                <div className="amountChips">
                  {AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      className={Number(cashInAmount) === amount ? "selected" : ""}
                      onClick={() => setCashInAmount(String(amount))}
                    >
                      {pesoNoDecimal(amount)}
                    </button>
                  ))}
                </div>

                <label className="customAmount">
                  Custom Amount
                  <input
                    value={cashInAmount}
                    onChange={(e) => setCashInAmount(e.target.value)}
                    type="number"
                    min="100"
                    placeholder="Minimum ₱100"
                  />
                </label>
              </div>

              {Number(cashInAmount) > 0 && (
                <div className="stepBox">
                  <StepTitle number="2" title="Choose Payment Method" />

                  <div className="methodGrid">
                    {CASH_IN_METHODS.map((method) => (
                      <button
                        key={method}
                        className={paymentMethod === method ? "selected" : ""}
                        onClick={() => setPaymentMethod(method)}
                      >
                        {cleanType(method)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {Number(cashInAmount) > 0 && paymentMethod && (
                <div className="stepBox">
                  <StepTitle number="3" title="Pay and Submit Reference" />

                  <div className="paymentNotice">
                    <div>
                      <strong>Receiver</strong>
                      <p>{PAYMENT_ACCOUNT_NAME}</p>
                      <small>Amount to send: {peso(Number(cashInAmount || 0))}</small>
                    </div>
                  </div>

                  {paymentMethod === "GCASH" && <QrPayment image="/payments/gcash.png" label="GCash QR" />}
                  {paymentMethod === "MAYA" && <QrPayment image="/payments/maya.png" label="Maya QR" />}
                  {paymentMethod === "BPI" && <QrPayment image="/payments/bpi.png" label="BPI QR" />}

                  <div className="formGrid">
                    <label>
                      Reference Number
                      <input
                        value={cashInReference}
                        onChange={(e) => setCashInReference(e.target.value)}
                        placeholder="Enter payment reference number"
                      />
                    </label>

                    <label>
                      Receipt URL optional
                      <input
                        value={receiptUrl}
                        onChange={(e) => setReceiptUrl(e.target.value)}
                        placeholder="Paste receipt image link if available"
                      />
                    </label>
                  </div>

                  <button className="primaryButton" onClick={submitCashIn} disabled={processing}>
                    {processing ? "Processing..." : "Submit Cash-In"}
                  </button>
                </div>
              )}
            </section>
          )}

          {activeAction === "WITHDRAW" && (
            <section className="flowPanel">
              <PanelHeader
                title="Withdrawal Request"
                text="Select amount first, then tell us where to send your cash-out. A 2% processing fee is applied."
                badge="Balance Deducted on Submit"
              />

              <div className="ruleGrid">
                <div className={`rule ${membershipActive ? "ok" : "locked"}`}>
                  <span>{membershipActive ? "✓" : "!"}</span>
                  <div>
                    <strong>Membership</strong>
                    <p>{profile?.membership_status || "UNKNOWN"}</p>
                  </div>
                </div>

                <div className={`rule ${kycApproved ? "ok" : "locked"}`}>
                  <span>{kycApproved ? "✓" : "!"}</span>
                  <div>
                    <strong>KYC Verification</strong>
                    <p>{profile?.kyc_status || "UNKNOWN"}</p>
                  </div>
                </div>
              </div>

              <div className="stepBox">
                <StepTitle number="1" title="Select Withdrawal Amount" />
                <div className="amountChips">
                  {AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      className={Number(withdrawAmount) === amount ? "selected" : ""}
                      onClick={() => setWithdrawAmount(String(amount))}
                    >
                      {pesoNoDecimal(amount)}
                    </button>
                  ))}
                </div>

                <label className="customAmount">
                  Custom Amount
                  <input
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    type="number"
                    min="100"
                    placeholder="Minimum ₱100"
                  />
                </label>
              </div>

              {Number(withdrawAmount) > 0 && (
                <div className="stepBox">
                  <StepTitle number="2" title="Where Should We Send Your Cash-Out?" />

                  <div className="methodGrid">
                    {PAYOUT_METHODS.map((method) => (
                      <button
                        key={method}
                        className={payoutMethod === method ? "selected" : ""}
                        onClick={() => setPayoutMethod(method)}
                      >
                        {cleanType(method)}
                      </button>
                    ))}
                  </div>

                  {payoutMethod && (
                    <>
                      <div className="formGrid">
                        <label>
                          Account Name
                          <input
                            value={payoutName}
                            onChange={(e) => setPayoutName(e.target.value)}
                            placeholder="Your payout account name"
                          />
                        </label>

                        <label>
                          Account Number
                          <input
                            value={payoutNumber}
                            onChange={(e) => setPayoutNumber(e.target.value)}
                            placeholder="GCash / Maya / Bank number"
                          />
                        </label>
                      </div>

                      <div className="withdrawPreview">
                        <div className="previewRow">
                          <span>Withdraw Amount</span>
                          <b>{peso(withdrawNumber)}</b>
                        </div>
                        <div className="previewRow">
                          <span>Processing Fee 2%</span>
                          <b>{peso(withdrawFee)}</b>
                        </div>
                        <div className="previewRow final">
                          <span>Net Receive</span>
                          <b>{peso(withdrawNet > 0 ? withdrawNet : 0)}</b>
                        </div>
                      </div>

                      {withdrawalBlockedReason && (
                        <small className="lockText">{withdrawalBlockedReason}</small>
                      )}

                      <button className="primaryButton" onClick={submitWithdrawal} disabled={!canSubmitWithdrawal}>
                        {processing ? "Processing..." : "Submit Withdrawal Request"}
                      </button>

                      {!canWithdraw && !withdrawalBlockedReason && (
                        <small className="lockText">
                          Withdrawal locked. Complete KYC verification first.
                        </small>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          )}

          <section className="bottomGrid">
            <div className="panel">
              <PanelHeader
                title="Transaction History"
                text="Completed and successful wallet movements."
                badge="Success Logs"
              />

              <div className="historyPanel">
                {transactions.length === 0 ? (
                  <div className="emptyState">No completed wallet activity yet.</div>
                ) : (
                  transactions.map((item) => (
                    <HistoryRow
                      key={item.id}
                      title={cleanType(item.transaction_type)}
                      subtitle={`${item.description || "Wallet transaction"} • ${
                        item.reference_no || "No Ref"
                      }`}
                      amount={peso(Number(item.amount || 0))}
                      status={item.status || "COMPLETED"}
                      date={formatDate(item.created_at)}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="panel">
              <PanelHeader
                title="Pending Requests"
                text="Requests waiting for admin review or settlement."
                badge={`${pendingItems.length} Pending`}
              />

              <div className="historyPanel">
                {pendingItems.length === 0 ? (
                  <div className="emptyState">No pending requests.</div>
                ) : (
                  pendingItems.map((item) => (
                    <HistoryRow
                      key={item.id}
                      title={item.title}
                      subtitle={item.subtitle}
                      amount={peso(item.amount)}
                      status={item.status}
                      date={formatDate(item.date)}
                    />
                  ))
                )}
              </div>
            </div>
          </section>
        </>
      )}

      <style>{`
        * { box-sizing: border-box; }

        .walletPage {
          width: 100%;
          min-width: 0;
          min-height: 100vh;
          padding: 32px;
          max-width: 100%;
          color: #f7f1df;
          font-family: Arial, Helvetica, sans-serif;
          background:
            radial-gradient(circle at 14% 8%, rgba(214, 178, 94, .24), transparent 28%),
            radial-gradient(circle at 86% 4%, rgba(86, 130, 92, .24), transparent 30%),
            radial-gradient(circle at 50% 110%, rgba(214, 178, 94, .16), transparent 36%),
            linear-gradient(135deg, #07130d 0%, #0d2117 45%, #03100a 100%);
          position: relative;
          overflow-x: hidden;
        }

        .walletPage:before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px);
          background-size: 46px 46px;
          mask-image: radial-gradient(circle at top, black, transparent 78%);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 22px;
          position: relative;
          z-index: 1;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #d9b45f;
          font-weight: 900;
          letter-spacing: .16em;
          text-transform: uppercase;
          font-size: 12px;
        }

        .hero h1 {
          margin: 0;
          font-size: 48px;
          letter-spacing: -1.8px;
          color: #fff8df;
          text-shadow: 0 14px 40px rgba(0,0,0,.32);
        }

        .hero span {
          display: block;
          margin-top: 10px;
          color: rgba(247,241,223,.74);
          font-size: 15px;
          max-width: 860px;
          line-height: 1.65;
        }

        .loadingBox,
        .messageBox,
        .panel,
        .flowPanel,
        .metricCard,
        .actionCard {
          border-radius: 28px;
          background: linear-gradient(180deg, rgba(255,255,255,.105), rgba(255,255,255,.055));
          border: 1px solid rgba(217,180,95,.26);
          box-shadow: 0 24px 70px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.10);
          backdrop-filter: blur(18px);
          position: relative;
          z-index: 1;
        }

        .loadingBox,
        .messageBox {
          padding: 20px;
          margin-bottom: 18px;
          color: #f8e6ad;
          font-weight: 900;
        }

        .topCards {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr;
          gap: 16px;
          margin-bottom: 18px;
          position: relative;
          z-index: 1;
        }

        .balanceCard {
          min-height: 196px;
          border-radius: 34px;
          padding: 30px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: white;
          background:
            radial-gradient(circle at 86% 14%, rgba(217,180,95,.44), transparent 34%),
            radial-gradient(circle at 8% 95%, rgba(83,128,90,.34), transparent 42%),
            linear-gradient(135deg, rgba(23,70,44,.96), rgba(5,24,15,.98));
          border: 1px solid rgba(217,180,95,.34);
          box-shadow: 0 28px 78px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.14);
        }

        .balanceCard p {
          margin: 0;
          color: rgba(255,248,223,.72);
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .16em;
          font-size: 12px;
        }

        .balanceCard h2 {
          margin: 12px 0 0;
          font-size: 50px;
          letter-spacing: -2px;
          color: #fff8df;
        }

        .balanceSeal {
          width: 90px;
          height: 90px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #f2d686, #b58a38);
          color: #06130d;
          font-size: 44px;
          font-weight: 900;
          box-shadow: 0 18px 42px rgba(0,0,0,.26), inset 0 2px 0 rgba(255,255,255,.34);
        }

        .metricCard {
          min-height: 196px;
          padding: 26px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .metricCard p,
        .panelHead p,
        .actionCard small,
        .historyRow p,
        .rule p,
        label,
        .previewRow span,
        .qrText p {
          color: rgba(247,241,223,.68);
        }

        .metricCard p {
          margin: 0;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .13em;
          font-size: 12px;
        }

        .metricCard h3 {
          margin: 12px 0 8px;
          font-size: 30px;
          letter-spacing: -1px;
          color: #fff8df;
        }

        .metricCard small {
          color: #d9b45f;
          font-weight: 900;
        }

        .actionCards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 18px;
          position: relative;
          z-index: 1;
        }

        .actionCard {
          border: 1px solid rgba(217,180,95,.18);
          padding: 28px;
          text-align: left;
          cursor: pointer;
          min-height: 160px;
          transition: .2s ease;
          color: inherit;
        }

        .actionCard:hover,
        .actionCard.selected {
          transform: translateY(-3px);
          border-color: rgba(242,214,134,.62);
          box-shadow: 0 30px 78px rgba(0,0,0,.42), 0 0 0 1px rgba(217,180,95,.14) inset;
          background: linear-gradient(180deg, rgba(217,180,95,.16), rgba(255,255,255,.06));
        }

        .actionCard span,
        .badge {
          display: inline-flex;
          border-radius: 999px;
          padding: 9px 14px;
          background: rgba(217,180,95,.16);
          border: 1px solid rgba(217,180,95,.26);
          color: #f2d686;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .actionCard strong {
          display: block;
          margin-top: 18px;
          color: #fff8df;
          font-size: 28px;
        }

        .flowPanel,
        .panel {
          padding: 24px;
          margin-bottom: 18px;
        }

        .panelHead {
          display: flex;
          justify-content: space-between;
          align-items: start;
          gap: 18px;
          margin-bottom: 18px;
        }

        .panelHead h2 {
          margin: 0;
          color: #fff8df;
          font-size: 24px;
        }

        .panelHead p {
          margin: 6px 0 0;
          font-size: 14px;
          line-height: 1.5;
        }

        .badge {
          white-space: nowrap;
        }

        .stepBox,
        .rule,
        .withdrawPreview,
        .historyRow {
          border-radius: 24px;
          background: rgba(4,18,11,.52);
          border: 1px solid rgba(217,180,95,.16);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
        }

        .stepBox {
          padding: 18px;
          margin-top: 14px;
        }

        .stepTitle {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
        }

        .stepTitle span {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #f2d686, #b58a38);
          color: #06130d;
          font-weight: 900;
        }

        .stepTitle strong,
        .historyRow strong,
        .rule strong,
        .previewRow b,
        .qrText h3 {
          color: #fff8df;
        }

        .amountChips,
        .methodGrid {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 14px;
        }

        .amountChips button,
        .methodGrid button {
          min-width: 110px;
          border: 1px solid rgba(217,180,95,.22);
          border-radius: 999px;
          padding: 13px 18px;
          background: rgba(255,255,255,.065);
          color: #f7f1df;
          font-weight: 900;
          cursor: pointer;
          transition: .2s ease;
        }

        .amountChips button:hover,
        .methodGrid button:hover,
        .amountChips button.selected,
        .methodGrid button.selected {
          background: linear-gradient(135deg, #f2d686, #b58a38);
          color: #06130d;
          border-color: transparent;
          box-shadow: 0 16px 34px rgba(181,138,56,.26);
        }

        label {
          display: grid;
          gap: 8px;
          font-weight: 900;
          font-size: 13px;
        }

        input,
        select {
          width: 100%;
          border: 1px solid rgba(217,180,95,.20);
          border-radius: 16px;
          padding: 13px 14px;
          background: rgba(2,12,7,.64);
          color: #fff8df;
          outline: none;
          font-weight: 800;
        }

        input::placeholder { color: rgba(247,241,223,.42); }
        input:focus { border-color: rgba(242,214,134,.72); box-shadow: 0 0 0 4px rgba(217,180,95,.10); }

        .paymentNotice {
          border-radius: 22px;
          padding: 18px;
          background:
            radial-gradient(circle at 90% 10%, rgba(217,180,95,.30), transparent 34%),
            linear-gradient(135deg, rgba(20,70,43,.92), rgba(2,14,8,.96));
          color: white;
          border: 1px solid rgba(217,180,95,.26);
          margin-bottom: 16px;
        }

        .paymentNotice strong {
          color: rgba(255,248,223,.72);
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: .12em;
        }

        .paymentNotice p {
          margin: 6px 0;
          font-size: 22px;
          font-weight: 900;
        }

        .paymentNotice small {
          color: rgba(255,248,223,.75);
          font-weight: 900;
        }

        .qrPayment {
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 18px;
          align-items: center;
          margin-bottom: 16px;
        }

        .qrBox {
          border-radius: 22px;
          padding: 14px;
          background: rgba(255,248,223,.96);
          text-align: center;
          box-shadow: 0 18px 45px rgba(0,0,0,.22);
        }

        .qrBox img {
          width: 100%;
          height: auto;
          border-radius: 14px;
        }

        .qrText h3 {
          margin: 0 0 8px;
          font-size: 24px;
        }

        .openQr {
          display: inline-flex;
          margin-top: 14px;
          border-radius: 999px;
          padding: 12px 18px;
          background: linear-gradient(135deg, #f2d686, #b58a38);
          color: #06130d;
          text-decoration: none;
          font-weight: 900;
          font-size: 13px;
          transition: .2s ease;
        }

        .openQr:hover { transform: translateY(-1px); opacity: .94; }

        .formGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        .primaryButton {
          margin-top: 16px;
          width: 100%;
          border: 0;
          border-radius: 18px;
          padding: 15px 18px;
          background: linear-gradient(135deg, #f2d686, #b58a38);
          color: #06130d;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 18px 40px rgba(181,138,56,.25);
        }

        .primaryButton:disabled { opacity: .52; cursor: not-allowed; }

        .ruleGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 16px;
        }

        .rule {
          display: grid;
          grid-template-columns: 42px 1fr;
          gap: 12px;
          padding: 14px;
        }

        .rule span {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-weight: 900;
        }

        .rule.ok span { background: rgba(112,189,124,.16); color: #a8f2ac; }
        .rule.locked span { background: rgba(217,180,95,.18); color: #f2d686; }
        .rule p { margin: 5px 0 0; font-size: 13px; }

        .withdrawPreview {
          margin-top: 18px;
          padding: 18px;
        }

        .previewRow {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(217,180,95,.14);
        }

        .previewRow:first-child { margin-top: 0; padding-top: 0; border-top: 0; }
        .previewRow.final b { color: #f2d686; font-size: 20px; }

        .lockText {
          display: block;
          margin-top: 12px;
          color: #f2d686;
          font-weight: 900;
        }

        .bottomGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          align-items: start;
          position: relative;
          z-index: 1;
        }

        .historyPanel {
          display: grid;
          gap: 12px;
          max-height: 620px;
          overflow: auto;
          padding-right: 4px;
        }

        .historyPanel::-webkit-scrollbar,
        .treeList::-webkit-scrollbar { width: 8px; }
        .historyPanel::-webkit-scrollbar-thumb,
        .treeList::-webkit-scrollbar-thumb { background: rgba(217,180,95,.35); border-radius: 999px; }

        .historyRow {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 14px;
          padding: 15px;
        }

        .historyRow p { margin: 5px 0 0; font-size: 13px; }

        .historyRight { text-align: right; }
        .historyRight b { display: block; color: #f2d686; }

        .statusTag {
          display: inline-flex;
          margin-top: 6px;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 900;
          background: rgba(217,180,95,.16);
          color: #f2d686;
          border: 1px solid rgba(217,180,95,.18);
        }

        .statusTag.approved,
        .statusTag.completed,
        .statusTag.success,
        .statusTag.paid { background: rgba(112,189,124,.15); color: #a8f2ac; border-color: rgba(112,189,124,.22); }
        .statusTag.rejected,
        .statusTag.failed,
        .statusTag.cancelled { background: rgba(255,112,92,.14); color: #ffb0a4; border-color: rgba(255,112,92,.20); }

        .emptyState {
          border-radius: 20px;
          padding: 18px;
          color: rgba(247,241,223,.68);
          background: rgba(4,18,11,.48);
          border: 1px solid rgba(217,180,95,.14);
          font-weight: 900;
        }

        @media (max-width: 1180px) {
          .topCards,
          .bottomGrid { grid-template-columns: 1fr; }
          .balanceCard h2 { font-size: 40px; }
        }

        @media (max-width: 820px) {
          .walletPage { padding: 18px; }
          .hero { display: block; }
          .hero h1 { font-size: 36px; }
          .actionCards,
          .ruleGrid,
          .formGrid,
          .qrPayment { grid-template-columns: 1fr; }
          .balanceCard { display: block; }
          .balanceSeal { margin-top: 22px; }
        }
`}</style>
    </main>
  );
}

function PanelHeader({
  title,
  text,
  badge,
}: {
  title: string;
  text: string;
  badge: string;
}) {
  return (
    <div className="panelHead">
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <span className="badge">{badge}</span>
    </div>
  );
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="metricCard">
      <p>{label}</p>
      <h3>{value}</h3>
      <small>{note}</small>
    </div>
  );
}

function StepTitle({ number, title }: { number: string; title: string }) {
  return (
    <div className="stepTitle">
      <span>{number}</span>
      <strong>{title}</strong>
    </div>
  );
}

function QrPayment({ image, label }: { image: string; label: string }) {
  return (
    <div className="qrPayment">
      <div className="qrBox">
        <Image src={image} alt={label} width={240} height={240} />
      </div>

      <div className="qrText">
        <h3>{label}</h3>
        <p>Scan this QR and send payment to JANICA MALDIVES.</p>

        <a className="openQr" href={image} target="_blank" rel="noopener noreferrer">
          Open Full QR
        </a>
      </div>
    </div>
  );
}

function HistoryRow({
  title,
  subtitle,
  amount,
  status,
  date,
}: {
  title: string;
  subtitle: string;
  amount: string;
  status: string;
  date: string;
}) {
  return (
    <div className="historyRow">
      <div>
        <strong>{title}</strong>
        <p>{subtitle}</p>
        <p>{date}</p>
      </div>
      <div className="historyRight">
        <span className={`status ${statusClass(status)}`}>{status}</span>
        <b>{amount}</b>
      </div>
    </div>
  );
}

function peso(value: number) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function pesoNoDecimal(value: number) {
  return `₱${Number(value || 0).toLocaleString("en-PH")}`;
}

function cleanType(value: string | null) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

function statusClass(value: string | null) {
  return (value || "pending").toLowerCase().replaceAll(" ", "_");
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}