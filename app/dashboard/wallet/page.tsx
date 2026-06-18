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

const PAYMENT_ACCOUNT_NAME = "JANICA MALDIVES";
const AMOUNTS = [100, 200, 500, 1000, 2000, 5000, 10000];

export default function WalletPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [cashIns, setCashIns] = useState<CashInRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"CASHIN" | "WITHDRAW">("CASHIN");

  const [cashInAmount, setCashInAmount] = useState("100");
  const [paymentMethod, setPaymentMethod] = useState("GCASH");
  const [cashInReference, setCashInReference] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");

  const [withdrawAmount, setWithdrawAmount] = useState("100");
  const [payoutMethod, setPayoutMethod] = useState("GCASH");
  const [payoutName, setPayoutName] = useState("");
  const [payoutNumber, setPayoutNumber] = useState("");
  const [message, setMessage] = useState("");

  async function loadWallet() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, full_name, email, membership_status, kyc_status")
      .eq("email", email)
      .maybeSingle();

    const currentProfile = profileById || profileByEmail;

    if (!currentProfile) {
      setLoading(false);
      return;
    }

    setProfile(currentProfile);

    const profileId = currentProfile.id;

    const { data: walletData } = await supabase
      .from("wallets")
      .select("id, profile_id, balance")
      .eq("profile_id", profileId)
      .maybeSingle();

    const { data: cashInData } = await supabase
      .from("cashin_requests")
      .select("id, amount, payment_method, reference_no, receipt_url, status, created_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    const { data: withdrawalData } = await supabase
      .from("withdrawal_requests")
      .select(
        "id, amount, processing_fee, net_receive, status, created_at, payout_method, payout_account_name, payout_account_number"
      )
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    const { data: transactionData } = await supabase
      .from("wallet_transactions")
      .select("id, transaction_type, amount, status, reference_no, description, created_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    setWallet(walletData || null);
    setCashIns(cashInData || []);
    setWithdrawals(withdrawalData || []);
    setTransactions(transactionData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadWallet();
  }, []);

  const walletBalance = Number(wallet?.balance || 0);
  const membershipActive = profile?.membership_status === "ACTIVE";
  const kycApproved = profile?.kyc_status === "APPROVED";
  const canWithdraw = membershipActive && kycApproved;

  const withdrawNumber = Number(withdrawAmount || 0);
  const withdrawFee = withdrawNumber * 0.02;
  const withdrawNet = withdrawNumber - withdrawFee;

  const stats = useMemo(() => {
    const totalCashIn = cashIns
      .filter((item) => item.status === "APPROVED")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const pendingCashIn = cashIns
      .filter((item) => item.status === "PENDING")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const totalWithdrawn = withdrawals
      .filter((item) => item.status === "COMPLETED")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const pendingWithdrawals = withdrawals
      .filter((item) => item.status === "PENDING")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return { totalCashIn, pendingCashIn, totalWithdrawn, pendingWithdrawals };
  }, [cashIns, withdrawals]);

  async function submitCashIn() {
    setMessage("");

    if (!profile) return setMessage("Profile not found.");

    const amount = Number(cashInAmount);

    if (!amount || amount < 100) {
      return setMessage("Minimum cash-in amount is ₱100.");
    }

    if (!cashInReference.trim()) {
      return setMessage("Reference number is required after payment.");
    }

    const { error } = await supabase.from("cashin_requests").insert({
      profile_id: profile.id,
      amount,
      payment_method: paymentMethod,
      account_name: PAYMENT_ACCOUNT_NAME,
      reference_no: cashInReference.trim(),
      receipt_url: receiptUrl.trim() || null,
      status: "PENDING",
    });

    if (error) return setMessage(error.message);

    setCashInReference("");
    setReceiptUrl("");
    setMessage("Payment received. Cash-in request is pending admin verification.");
    await loadWallet();
  }

  async function submitWithdrawal() {
    setMessage("");

    if (!profile) return setMessage("Profile not found.");

    if (!canWithdraw) {
      return setMessage("Withdrawal locked. Membership must be ACTIVE and KYC must be APPROVED.");
    }

    if (!withdrawNumber || withdrawNumber < 100) {
      return setMessage("Minimum withdrawal amount is ₱100.");
    }

    if (withdrawNumber > walletBalance) {
      return setMessage("Insufficient wallet balance.");
    }

    if (!payoutName.trim() || !payoutNumber.trim()) {
      return setMessage("Payout account name and number are required.");
    }

    const { error } = await supabase.from("withdrawal_requests").insert({
      profile_id: profile.id,
      amount: withdrawNumber,
      processing_fee: withdrawFee,
      net_receive: withdrawNet,
      payout_method: payoutMethod,
      payout_account_name: payoutName.trim(),
      payout_account_number: payoutNumber.trim(),
      status: "PENDING",
    });

    if (error) return setMessage(error.message);

    setPayoutName("");
    setPayoutNumber("");
    setMessage("Withdrawal request submitted. Waiting for admin approval.");
    await loadWallet();
  }

  return (
    <main className="walletPage">
      <section className="hero">
        <div>
          <p className="eyebrow">Agarwood Financial Center</p>
          <h1>Wallet</h1>
          <span>
            Cash in through GCash, Maya, or bank transfer, then submit your payment
            reference for admin verification.
          </span>
        </div>

        <div className="heroBalance">
          <p>Available Balance</p>
          <strong>{peso(walletBalance)}</strong>
        </div>
      </section>

      {loading ? (
        <div className="loadingBox">Loading wallet data...</div>
      ) : (
        <>
          <section className="cards">
            <SummaryCard icon="💰" label="Wallet Balance" value={peso(walletBalance)} note="Current balance" gold />
            <SummaryCard icon="⬆️" label="Approved Cash-In" value={peso(stats.totalCashIn)} note="Approved by admin" />
            <SummaryCard icon="⬇️" label="Total Withdrawn" value={peso(stats.totalWithdrawn)} note="Completed withdrawals" />
            <SummaryCard icon="⏳" label="Pending Requests" value={peso(stats.pendingCashIn + stats.pendingWithdrawals)} note="Awaiting verification" gold />
          </section>

          {message && <div className="messageBox">{message}</div>}

          <section className="actionShell">
            <div className="modeSwitch">
              <button className={mode === "CASHIN" ? "active" : ""} onClick={() => setMode("CASHIN")}>
                Cash In
              </button>
              <button className={mode === "WITHDRAW" ? "active" : ""} onClick={() => setMode("WITHDRAW")}>
                Withdraw
              </button>
            </div>

            {mode === "CASHIN" ? (
              <div className="panel actionPanel">
                <div className="panelHead">
                  <div>
                    <h2>Cash-In Request</h2>
                    <p>Select amount, pay using QR, then submit your reference number.</p>
                  </div>
                  <span className="badge">Payment Received → Pending Verification</span>
                </div>

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
                  Custom Cash-In Amount
                  <input
                    value={cashInAmount}
                    onChange={(e) => setCashInAmount(e.target.value)}
                    type="number"
                    min="100"
                    placeholder="Minimum ₱100"
                  />
                </label>

                <div className="paymentNotice">
                  <div>
                    <strong>Temporary Payment Receiver</strong>
                    <p>{PAYMENT_ACCOUNT_NAME}</p>
                    <small>Used temporarily for Agarwood Platform cash-in transactions.</small>
                  </div>
                  <div className="sendBox">
                    <span>Amount to Send</span>
                    <b>{peso(Number(cashInAmount || 0))}</b>
                  </div>
                </div>

                <div className="qrGrid">
                  <PaymentCard
                    title="GCash"
                    image="/payments/gcash.png"
                    selected={paymentMethod === "GCASH"}
                    onClick={() => setPaymentMethod("GCASH")}
                    openLabel="Open GCash QR"
                  />

                  <PaymentCard
                    title="Maya"
                    image="/payments/maya.png"
                    selected={paymentMethod === "MAYA"}
                    onClick={() => setPaymentMethod("MAYA")}
                    openLabel="Open Maya QR"
                  />

                  <div
                    className={`qrCard bank ${paymentMethod === "BANK_TRANSFER" ? "selected" : ""}`}
                    onClick={() => setPaymentMethod("BANK_TRANSFER")}
                  >
                    <h3>Bank Transfer</h3>
                    <div className="bankBox">
                      <strong>BPI / Bank</strong>
                      <p>Account Name: {PAYMENT_ACCOUNT_NAME}</p>
                      <small>Bank account number can be added later.</small>
                    </div>
                  </div>
                </div>

                <div className="formGrid">
                  <label>
                    Payment Method
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                      <option value="GCASH">GCash</option>
                      <option value="MAYA">Maya</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                    </select>
                  </label>

                  <label>
                    Reference Number
                    <input
                      value={cashInReference}
                      onChange={(e) => setCashInReference(e.target.value)}
                      placeholder="Enter payment reference number"
                    />
                  </label>

                  <label className="wide">
                    Receipt URL optional
                    <input
                      value={receiptUrl}
                      onChange={(e) => setReceiptUrl(e.target.value)}
                      placeholder="Paste receipt image link if available"
                    />
                  </label>
                </div>

                <button className="primaryButton" onClick={submitCashIn}>
                  I Have Paid — Submit Cash-In Request
                </button>
              </div>
            ) : (
              <div className="panel actionPanel">
                <div className="panelHead">
                  <div>
                    <h2>Withdraw Request</h2>
                    <p>Link your payout account and preview the 2% processing fee.</p>
                  </div>
                  <span className="badge">Admin Approval Required</span>
                </div>

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

                <div className="formGrid">
                  <label>
                    Withdraw Amount
                    <input
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      type="number"
                      min="100"
                      placeholder="Minimum ₱100"
                    />
                  </label>

                  <label>
                    Payout Method
                    <select value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value)}>
                      <option value="GCASH">GCash</option>
                      <option value="MAYA">Maya</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                    </select>
                  </label>

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

                <button className="primaryButton" onClick={submitWithdrawal} disabled={!canWithdraw}>
                  Submit Withdrawal Request
                </button>

                {!canWithdraw && (
                  <small className="lockText">
                    Withdrawal locked. Complete KYC and keep membership ACTIVE.
                  </small>
                )}
              </div>
            )}
          </section>

          <section className="lowerGrid">
            <HistoryPanel title="Cash-In Requests" empty="No cash-in requests yet.">
              {cashIns.map((item) => (
                <HistoryRow
                  key={item.id}
                  title={item.payment_method || "CASH_IN"}
                  subtitle={`Ref: ${item.reference_no || "—"}`}
                  amount={peso(Number(item.amount || 0))}
                  status={item.status || "PENDING"}
                  date={formatDate(item.created_at)}
                />
              ))}
            </HistoryPanel>

            <HistoryPanel title="Withdrawal Requests" empty="No withdrawal requests yet.">
              {withdrawals.map((item) => (
                <HistoryRow
                  key={item.id}
                  title={item.payout_method || "WITHDRAWAL"}
                  subtitle={`${item.payout_account_name || "No account"} • ${item.payout_account_number || "No number"}`}
                  amount={peso(Number(item.amount || 0))}
                  status={item.status || "PENDING"}
                  date={formatDate(item.created_at)}
                />
              ))}
            </HistoryPanel>

            <div className="panel fullWidth">
              <div className="panelHead">
                <div>
                  <h2>Wallet Activity</h2>
                  <p>Real records from wallet_transactions.</p>
                </div>
              </div>

              {transactions.length === 0 ? (
                <div className="emptyState">No wallet activity yet.</div>
              ) : (
                <div className="activityList">
                  {transactions.map((item) => (
                    <HistoryRow
                      key={item.id}
                      title={cleanType(item.transaction_type)}
                      subtitle={`${item.description || "—"} • ${item.reference_no || "No Ref"}`}
                      amount={peso(Number(item.amount || 0))}
                      status={item.status || "PENDING"}
                      date={formatDate(item.created_at)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <style>{`
        * { box-sizing: border-box; }

        .walletPage {
          min-height: 100vh;
          padding: 28px;
          color: #18261d;
          font-family: Arial, Helvetica, sans-serif;
          background:
            radial-gradient(circle at 18% 5%, rgba(255, 226, 154, .55), transparent 22%),
            radial-gradient(circle at 90% 12%, rgba(255,255,255,.72), transparent 28%),
            linear-gradient(180deg, #f8f4eb 0%, #f3eadb 52%, #eadcc3 100%);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 22px;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #8c6a3c;
          font-weight: 900;
          letter-spacing: .5px;
          text-transform: uppercase;
          font-size: 12px;
        }

        .hero h1 {
          margin: 0;
          font-size: 42px;
          letter-spacing: -1.4px;
          color: #101a14;
        }

        .hero span {
          display: block;
          margin-top: 8px;
          color: #5f665e;
          font-size: 15px;
          max-width: 760px;
        }

        .heroBalance {
          min-width: 270px;
          border-radius: 24px;
          padding: 22px;
          color: white;
          background:
            radial-gradient(circle at 80% 18%, rgba(214,178,94,.44), transparent 30%),
            linear-gradient(135deg, #244536, #10281f);
          box-shadow: 0 18px 42px rgba(36,69,54,.22);
        }

        .heroBalance p {
          margin: 0;
          color: rgba(255,255,255,.75);
          font-weight: 900;
        }

        .heroBalance strong {
          display: block;
          margin-top: 8px;
          font-size: 32px;
          letter-spacing: -1px;
        }

        .cards {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
        }

        .summaryCard,
        .panel,
        .loadingBox,
        .messageBox {
          border-radius: 22px;
          background: rgba(255,253,246,.86);
          border: 1px solid rgba(92,70,35,.08);
          box-shadow: 0 18px 42px rgba(82,60,27,.09);
        }

        .summaryCard {
          min-height: 145px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .summaryIcon {
          width: 66px;
          height: 66px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 28px;
          background: radial-gradient(circle, #f5e8c9, #d9ccb0);
        }

        .summaryIcon.gold {
          background: radial-gradient(circle, #fff2bc, #c9a34d);
        }

        .summaryCard p {
          margin: 0 0 8px;
          font-size: 13px;
          color: #5f665e;
          font-weight: 900;
        }

        .summaryCard h3 {
          margin: 0 0 8px;
          font-size: 27px;
          letter-spacing: -1px;
          color: #101a14;
        }

        .summaryCard small {
          color: #8c6a3c;
          font-weight: 900;
        }

        .loadingBox,
        .messageBox {
          padding: 20px;
          margin-bottom: 16px;
          color: #31553d;
          font-weight: 900;
        }

        .actionShell {
          margin-bottom: 16px;
        }

        .modeSwitch {
          display: inline-flex;
          padding: 8px;
          border-radius: 999px;
          background: rgba(255,253,246,.78);
          border: 1px solid rgba(92,70,35,.08);
          box-shadow: 0 14px 30px rgba(82,60,27,.08);
          margin-bottom: 14px;
        }

        .modeSwitch button {
          border: 0;
          border-radius: 999px;
          padding: 14px 30px;
          background: transparent;
          color: #244536;
          font-weight: 900;
          cursor: pointer;
        }

        .modeSwitch button.active {
          color: white;
          background: linear-gradient(135deg, #244536, #10281f);
          box-shadow: 0 10px 24px rgba(36,69,54,.22);
        }

        .panel {
          padding: 22px;
        }

        .actionPanel {
          overflow: hidden;
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
          color: #101a14;
          font-size: 24px;
        }

        .panelHead p {
          margin: 6px 0 0;
          color: #6b6b62;
          font-size: 14px;
        }

        .badge {
          border-radius: 999px;
          padding: 10px 14px;
          color: #8c6a3c;
          background: rgba(214,178,94,.20);
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .amountChips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 16px;
        }

        .amountChips button {
          min-width: 96px;
          border: 1px solid rgba(92,70,35,.12);
          border-radius: 999px;
          padding: 13px 18px;
          background: #f3ead8;
          color: #244536;
          font-weight: 900;
          cursor: pointer;
        }

        .amountChips button.selected {
          background: linear-gradient(135deg, #d6b25e, #b99242);
          color: #10281f;
          border-color: transparent;
          box-shadow: 0 12px 26px rgba(185,146,66,.22);
        }

        label {
          display: grid;
          gap: 8px;
          color: #5f665e;
          font-weight: 900;
          font-size: 13px;
        }

        .customAmount {
          margin-bottom: 16px;
        }

        input,
        select {
          width: 100%;
          border: 1px solid rgba(92,70,35,.14);
          border-radius: 14px;
          padding: 13px 14px;
          background: rgba(255,253,246,.92);
          color: #101a14;
          outline: none;
          font-weight: 800;
        }

        .paymentNotice {
          border-radius: 22px;
          padding: 18px;
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
          margin-bottom: 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
        }

        .paymentNotice p {
          margin: 6px 0;
          font-size: 22px;
          font-weight: 900;
        }

        .paymentNotice small {
          color: rgba(255,255,255,.75);
        }

        .sendBox {
          min-width: 220px;
          padding: 16px;
          border-radius: 18px;
          background: rgba(255,255,255,.10);
          border: 1px solid rgba(255,255,255,.14);
          text-align: right;
        }

        .sendBox span {
          display: block;
          color: rgba(255,255,255,.72);
          font-weight: 900;
          font-size: 12px;
        }

        .sendBox b {
          display: block;
          margin-top: 6px;
          font-size: 28px;
        }

        .qrGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-bottom: 18px;
        }

        .qrCard {
          border-radius: 22px;
          padding: 16px;
          background: #f3ead8;
          border: 2px solid transparent;
          cursor: pointer;
          text-align: center;
        }

        .qrCard.selected {
          border-color: #8c6a3c;
          box-shadow: 0 12px 28px rgba(140,106,60,.16);
        }

        .qrCard h3 {
          margin: 0 0 12px;
        }

        .qrCard img {
          width: 100%;
          max-width: 240px;
          height: auto;
          border-radius: 14px;
          background: white;
        }

        .qrCard p {
          color: #6b6b62;
          font-size: 13px;
          font-weight: 900;
        }

        .openQr {
          display: inline-flex;
          margin-top: 10px;
          border-radius: 999px;
          padding: 11px 16px;
          background: #244536;
          color: white;
          text-decoration: none;
          font-weight: 900;
          font-size: 13px;
        }

        .bankBox {
          min-height: 270px;
          display: grid;
          place-content: center;
          gap: 10px;
          border-radius: 14px;
          background: rgba(255,253,246,.68);
          padding: 18px;
        }

        .formGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        .wide {
          grid-column: 1 / -1;
        }

        .primaryButton {
          margin-top: 16px;
          width: 100%;
          border: 0;
          border-radius: 16px;
          padding: 15px 18px;
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 14px 30px rgba(36,69,54,.18);
        }

        .primaryButton:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

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
          border-radius: 18px;
          background: #f3ead8;
          border: 1px solid rgba(92,70,35,.08);
        }

        .rule span {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-weight: 900;
        }

        .rule.ok span {
          background: rgba(49,85,61,.14);
          color: #31553d;
        }

        .rule.locked span {
          background: rgba(214,178,94,.25);
          color: #8c6a3c;
        }

        .rule strong {
          color: #101a14;
        }

        .rule p {
          margin: 5px 0 0;
          color: #6b6b62;
          font-size: 13px;
        }

        .withdrawPreview {
          margin-top: 18px;
          border-radius: 20px;
          padding: 18px;
          background: rgba(255,253,246,.72);
          border: 1px solid rgba(92,70,35,.10);
        }

        .previewRow {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(92,70,35,.10);
        }

        .previewRow:first-child {
          margin-top: 0;
          padding-top: 0;
          border-top: 0;
        }

        .previewRow span {
          color: #6b6b62;
          font-weight: 900;
        }

        .previewRow b {
          color: #101a14;
        }

        .previewRow.final b {
          color: #31553d;
          font-size: 20px;
        }

        .lockText {
          display: block;
          margin-top: 12px;
          color: #8c6a3c;
          font-weight: 900;
        }

        .lowerGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .fullWidth {
          grid-column: 1 / -1;
        }

        .historyPanel,
        .activityList {
          display: grid;
          gap: 12px;
        }

        .historyRow {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 14px;
          padding: 15px;
          border-radius: 18px;
          background: #f3ead8;
          border: 1px solid rgba(92,70,35,.08);
        }

        .historyRow strong {
          color: #101a14;
        }

        .historyRow p {
          margin: 5px 0 0;
          color: #6b6b62;
          font-size: 13px;
        }

        .historyRight {
          display: grid;
          justify-items: end;
          gap: 8px;
        }

        .historyRight b {
          color: #31553d;
        }

        .status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 92px;
          padding: 8px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
        }

        .status.completed,
        .status.approved,
        .status.paid {
          background: rgba(49,85,61,.12);
          color: #31553d;
        }

        .status.pending,
        .status.processing {
          background: rgba(214,178,94,.20);
          color: #8c6a3c;
        }

        .status.rejected,
        .status.failed {
          background: rgba(163,60,42,.12);
          color: #a33c2a;
        }

        .emptyState {
          padding: 18px;
          border-radius: 18px;
          background: #f3ead8;
          color: #6b6b62;
          font-weight: 900;
        }

        @media (max-width: 1250px) {
          .cards,
          .qrGrid,
          .ruleGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .lowerGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .walletPage {
            padding: 18px;
          }

          .hero,
          .paymentNotice {
            flex-direction: column;
            align-items: flex-start;
          }

          .heroBalance,
          .sendBox {
            width: 100%;
            text-align: left;
          }

          .cards,
          .formGrid,
          .qrGrid,
          .ruleGrid {
            grid-template-columns: 1fr;
          }

          .hero h1 {
            font-size: 34px;
          }

          .historyRow {
            grid-template-columns: 1fr;
          }

          .historyRight {
            justify-items: start;
          }

          .modeSwitch {
            display: grid;
            grid-template-columns: 1fr 1fr;
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}

function PaymentCard({
  title,
  image,
  selected,
  onClick,
  openLabel,
}: {
  title: string;
  image: string;
  selected: boolean;
  onClick: () => void;
  openLabel: string;
}) {
  return (
    <div className={`qrCard ${selected ? "selected" : ""}`} onClick={onClick}>
      <h3>{title}</h3>
      <Image src={image} alt={`${title} QR`} width={240} height={240} />
      <p>Account Name: {PAYMENT_ACCOUNT_NAME}</p>
      <a
        className="openQr"
        href={image}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        {openLabel}
      </a>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  note,
  icon,
  gold,
}: {
  label: string;
  value: string;
  note: string;
  icon: string;
  gold?: boolean;
}) {
  return (
    <div className="summaryCard">
      <div className={`summaryIcon ${gold ? "gold" : ""}`}>{icon}</div>
      <div>
        <p>{label}</p>
        <h3>{value}</h3>
        <small>{note}</small>
      </div>
    </div>
  );
}

function HistoryPanel({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <div className="panel">
      <div className="panelHead">
        <div>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="historyPanel">
        {hasItems ? children : <div className="emptyState">{empty}</div>}
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
  return `₱ ${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function pesoNoDecimal(value: number) {
  return `₱${value.toLocaleString("en-PH")}`;
}

function cleanType(value: string | null) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

function statusClass(value: string | null) {
  return (value || "pending").toLowerCase();
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}