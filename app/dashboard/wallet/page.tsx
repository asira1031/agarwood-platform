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

export default function WalletPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [cashIns, setCashIns] = useState<CashInRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [cashInAmount, setCashInAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("GCASH");
  const [cashInReference, setCashInReference] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");

  const [withdrawAmount, setWithdrawAmount] = useState("");
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
      .select("id, amount, processing_fee, net_receive, status, created_at")
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

    return {
      totalCashIn,
      pendingCashIn,
      totalWithdrawn,
      pendingWithdrawals,
    };
  }, [cashIns, withdrawals]);

  async function submitCashIn() {
    setMessage("");

    if (!profile) {
      setMessage("Profile not found.");
      return;
    }

    const amount = Number(cashInAmount);

    if (!amount || amount <= 0) {
      setMessage("Enter a valid cash-in amount.");
      return;
    }

    if (!cashInReference.trim()) {
      setMessage("Reference number is required.");
      return;
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

    if (error) {
      setMessage(error.message);
      return;
    }

    setCashInAmount("");
    setCashInReference("");
    setReceiptUrl("");
    setMessage("Cash-in request submitted. Waiting for admin approval.");
    await loadWallet();
  }

  async function submitWithdrawal() {
    setMessage("");

    if (!profile) {
      setMessage("Profile not found.");
      return;
    }

    if (!canWithdraw) {
      setMessage("Withdrawal locked. Membership must be ACTIVE and KYC must be APPROVED.");
      return;
    }

    if (!withdrawNumber || withdrawNumber <= 0) {
      setMessage("Enter a valid withdrawal amount.");
      return;
    }

    if (withdrawNumber > walletBalance) {
      setMessage("Insufficient wallet balance.");
      return;
    }

    const { error } = await supabase.from("withdrawal_requests").insert({
      profile_id: profile.id,
      amount: withdrawNumber,
      processing_fee: withdrawFee,
      net_receive: withdrawNet,
      status: "PENDING",
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setWithdrawAmount("");
    setMessage("Withdrawal request submitted. Waiting for admin approval.");
    await loadWallet();
  }

  return (
    <main className="walletPage">
      <section className="hero">
        <div>
          <p className="eyebrow">Real Wallet Center</p>
          <h1>Wallet</h1>
          <span>
            Cash in using GCash, Maya, or bank transfer. Submit your reference number for admin approval.
          </span>
        </div>
      </section>

      {loading ? (
        <div className="loadingBox">Loading wallet data...</div>
      ) : (
        <>
          <section className="cards">
            <SummaryCard icon="💰" label="Wallet Balance" value={peso(walletBalance)} note="Current app wallet balance" gold />
            <SummaryCard icon="⬆️" label="Approved Cash-In" value={peso(stats.totalCashIn)} note="Approved by admin" />
            <SummaryCard icon="⬇️" label="Total Withdrawn" value={peso(stats.totalWithdrawn)} note="Completed withdrawals" />
            <SummaryCard icon="⏳" label="Pending Requests" value={peso(stats.pendingCashIn + stats.pendingWithdrawals)} note="Cash-in + withdrawal pending" gold />
          </section>

          {message && <div className="messageBox">{message}</div>}

          <section className="grid">
            <div className="panel">
              <div className="panelHead">
                <div>
                  <h2>Cash-In Request</h2>
                  <p>Scan QR or transfer manually, then submit payment details.</p>
                </div>
              </div>

              <div className="paymentNotice">
                <strong>Temporary Payment Receiver</strong>
                <p>{PAYMENT_ACCOUNT_NAME}</p>
                <small>
                  This account is temporarily used for Agarwood Platform cash-in transactions.
                </small>
              </div>

              <div className="qrGrid">
                <div className={`qrCard ${paymentMethod === "GCASH" ? "selected" : ""}`} onClick={() => setPaymentMethod("GCASH")}>
                  <h3>GCash</h3>
                  <Image src="/payments/gcash.png" alt="GCash QR" width={260} height={260} />
                  <p>Account Name: {PAYMENT_ACCOUNT_NAME}</p>
                </div>

                <div className={`qrCard ${paymentMethod === "MAYA" ? "selected" : ""}`} onClick={() => setPaymentMethod("MAYA")}>
                  <h3>Maya</h3>
                  <Image src="/payments/maya.png" alt="Maya QR" width={260} height={260} />
                  <p>Account Name: {PAYMENT_ACCOUNT_NAME}</p>
                </div>

                <div className={`qrCard bank ${paymentMethod === "BANK_TRANSFER" ? "selected" : ""}`} onClick={() => setPaymentMethod("BANK_TRANSFER")}>
                  <h3>Bank Transfer</h3>
                  <div className="bankBox">
                    <strong>BPI / Bank Transfer</strong>
                    <p>Account Name: {PAYMENT_ACCOUNT_NAME}</p>
                    <small>Account number can be added later.</small>
                  </div>
                </div>
              </div>

              <div className="formGrid">
                <label>
                  Amount
                  <input value={cashInAmount} onChange={(e) => setCashInAmount(e.target.value)} type="number" placeholder="Enter cash-in amount" />
                </label>

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
                  <input value={cashInReference} onChange={(e) => setCashInReference(e.target.value)} placeholder="Enter payment reference number" />
                </label>

                <label>
                  Receipt URL optional
                  <input value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)} placeholder="Paste receipt image link if available" />
                </label>
              </div>

              <button className="primaryButton" onClick={submitCashIn}>
                Submit Cash-In Request
              </button>
            </div>

            <aside className="panel">
              <div className="panelHead">
                <div>
                  <h2>Withdraw Request</h2>
                  <p>Processing fee is 2% of withdrawal amount.</p>
                </div>
              </div>

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

              <div className="withdrawPreview">
                <label>
                  Withdraw Amount
                  <input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} type="number" placeholder="Enter amount" />
                </label>

                <div className="previewRow">
                  <span>Processing Fee 2%</span>
                  <b>{peso(withdrawFee)}</b>
                </div>

                <div className="previewRow">
                  <span>Net Receive</span>
                  <b>{peso(withdrawNet > 0 ? withdrawNet : 0)}</b>
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
            </aside>
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
                  title="WITHDRAWAL"
                  subtitle={`Fee: ${peso(Number(item.processing_fee || 0))} • Net: ${peso(Number(item.net_receive || 0))}`}
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

        .grid {
          display: grid;
          grid-template-columns: 1.45fr 420px;
          gap: 16px;
          margin-bottom: 16px;
        }

        .lowerGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .fullWidth {
          grid-column: 1 / -1;
        }

        .panel {
          padding: 22px;
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
          font-size: 22px;
        }

        .panelHead p {
          margin: 6px 0 0;
          color: #6b6b62;
          font-size: 14px;
        }

        .loadingBox,
        .messageBox {
          padding: 20px;
          margin-bottom: 16px;
          color: #6b6b62;
          font-weight: 900;
        }

        .messageBox {
          color: #31553d;
          background: rgba(255,253,246,.95);
        }

        .paymentNotice {
          border-radius: 18px;
          padding: 16px;
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
          margin-bottom: 18px;
        }

        .paymentNotice p {
          margin: 6px 0;
          font-size: 22px;
          font-weight: 900;
        }

        .paymentNotice small {
          color: rgba(255,255,255,.75);
        }

        .qrGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-bottom: 18px;
        }

        .qrCard {
          border-radius: 20px;
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
          max-width: 260px;
          height: auto;
          border-radius: 14px;
          background: white;
        }

        .qrCard p {
          color: #6b6b62;
          font-size: 13px;
          font-weight: 900;
        }

        .bankBox {
          min-height: 260px;
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

        label {
          display: grid;
          gap: 8px;
          color: #5f665e;
          font-weight: 900;
          font-size: 13px;
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

        .primaryButton {
          margin-top: 16px;
          width: 100%;
          border: 0;
          border-radius: 15px;
          padding: 14px 18px;
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .primaryButton:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .rule {
          margin-top: 14px;
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
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid rgba(92,70,35,.10);
        }

        .previewRow span {
          color: #6b6b62;
          font-weight: 900;
        }

        .previewRow b {
          color: #101a14;
        }

        .lockText {
          display: block;
          margin-top: 12px;
          color: #8c6a3c;
          font-weight: 900;
        }

        .historyPanel {
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

        .activityList {
          display: grid;
          gap: 12px;
        }

        @media (max-width: 1250px) {
          .cards,
          .qrGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .grid,
          .lowerGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .walletPage {
            padding: 18px;
          }

          .cards,
          .formGrid,
          .qrGrid {
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
        }
      `}</style>
    </main>
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