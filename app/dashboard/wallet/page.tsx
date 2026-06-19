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
const AMOUNTS = [500, 1000, 5000, 10000, 50000];

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

  async function loadWallet() {
    setLoading(true);
    setMessage("");

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
      setMessage("Profile not found.");
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

    const { data: orderData } = await supabase
      .from("membership_orders")
      .select("id, amount, status, payment_status, created_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    const { data: sellData } = await supabase
      .from("sell_tree_requests")
      .select("id, expected_amount, selling_price, status, created_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    setWallet(walletData || null);
    setCashIns(cashInData || []);
    setWithdrawals(withdrawalData || []);
    setTransactions(transactionData || []);
    setMembershipOrders(orderData || []);
    setSellTreeRequests(sellData || []);
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
      .filter((item) => ["APPROVED", "COMPLETED"].includes((item.status || "").toUpperCase()))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const totalWithdrawn = withdrawals
      .filter((item) => ["APPROVED", "COMPLETED"].includes((item.status || "").toUpperCase()))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return { totalCashIn, totalWithdrawn };
  }, [cashIns, withdrawals]);

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
    setMessage("");

    if (!profile) return setMessage("Profile not found.");

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

    setCashInAmount("");
    setPaymentMethod("");
    setCashInReference("");
    setReceiptUrl("");
    setActiveAction("NONE");
    setMessage("Cash-in request submitted. Waiting for admin verification.");
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

    if (!payoutMethod) {
      return setMessage("Please select payout method.");
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

    setWithdrawAmount("");
    setPayoutMethod("");
    setPayoutName("");
    setPayoutNumber("");
    setActiveAction("NONE");
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
            Manage your investor wallet, cash-in requests, withdrawals, completed
            transactions, and pending approvals.
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

            <MetricCard label="Total Cash-In" value={peso(stats.totalCashIn)} note="Approved cash-ins" />
            <MetricCard label="Total Withdrawn" value={peso(stats.totalWithdrawn)} note="Completed withdrawals" />
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
              <strong>Add funds to wallet</strong>
              <small>GCash, Maya, or Bank Transfer</small>
            </button>

            <button
              className={`actionCard ${activeAction === "WITHDRAW" ? "selected" : ""}`}
              onClick={() => {
                setActiveAction(activeAction === "WITHDRAW" ? "NONE" : "WITHDRAW");
                setMessage("");
              }}
            >
              <span>Withdraw</span>
              <strong>Request cash-out</strong>
              <small>Send funds to your account</small>
            </button>
          </section>

          {activeAction === "CASHIN" && (
            <section className="flowPanel">
              <PanelHeader
                title="Cash-In Request"
                text="Select amount first. After choosing an amount, select where you paid and submit the reference number."
                badge="Payment → Admin Verification"
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
                    {["GCASH", "MAYA", "BANK_TRANSFER"].map((method) => (
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

                  {paymentMethod === "GCASH" && (
                    <QrPayment image="/payments/gcash.png" label="GCash QR" />
                  )}

                  {paymentMethod === "MAYA" && (
                    <QrPayment image="/payments/maya.png" label="Maya QR" />
                  )}

                  {paymentMethod === "BANK_TRANSFER" && (
                    <div className="bankBox">
                      <strong>Bank Transfer</strong>
                      <p>Account Name: {PAYMENT_ACCOUNT_NAME}</p>
                      <small>Bank account details can be added later.</small>
                    </div>
                  )}

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

                  <button className="primaryButton" onClick={submitCashIn}>
                    Submit Cash-In Request
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
                badge="Admin Approval Required"
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
                    {["GCASH", "MAYA", "BANK_TRANSFER"].map((method) => (
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

                      <button className="primaryButton" onClick={submitWithdrawal} disabled={!canWithdraw}>
                        Submit Withdrawal Request
                      </button>

                      {!canWithdraw && (
                        <small className="lockText">
                          Withdrawal locked. Complete KYC and keep membership ACTIVE.
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
          min-height: 100vh;
          padding: 30px;
          color: #18261d;
          font-family: Arial, Helvetica, sans-serif;
          background:
            radial-gradient(circle at 18% 5%, rgba(255, 226, 154, .55), transparent 24%),
            radial-gradient(circle at 92% 8%, rgba(255,255,255,.72), transparent 28%),
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
          font-size: 44px;
          letter-spacing: -1.6px;
          color: #101a14;
        }

        .hero span {
          display: block;
          margin-top: 8px;
          color: #5f665e;
          font-size: 15px;
          max-width: 820px;
          line-height: 1.6;
        }

        .loadingBox,
        .messageBox,
        .panel,
        .flowPanel,
        .metricCard,
        .actionCard {
          border-radius: 26px;
          background: rgba(255,253,246,.88);
          border: 1px solid rgba(92,70,35,.08);
          box-shadow: 0 18px 42px rgba(82,60,27,.09);
        }

        .loadingBox,
        .messageBox {
          padding: 20px;
          margin-bottom: 18px;
          color: #31553d;
          font-weight: 900;
        }

        .topCards {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr;
          gap: 16px;
          margin-bottom: 18px;
        }

        .balanceCard {
          min-height: 190px;
          border-radius: 32px;
          padding: 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: white;
          background:
            radial-gradient(circle at 80% 18%, rgba(214,178,94,.44), transparent 34%),
            linear-gradient(135deg, #244536, #10281f);
          box-shadow: 0 24px 56px rgba(36,69,54,.24);
        }

        .balanceCard p {
          margin: 0;
          color: rgba(255,255,255,.72);
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .14em;
          font-size: 12px;
        }

        .balanceCard h2 {
          margin: 12px 0 0;
          font-size: 48px;
          letter-spacing: -2px;
        }

        .balanceSeal {
          width: 86px;
          height: 86px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #d6b25e, #b99242);
          color: #10281f;
          font-size: 42px;
          font-weight: 900;
          box-shadow: inset 0 2px 0 rgba(255,255,255,.25);
        }

        .metricCard {
          min-height: 190px;
          padding: 26px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .metricCard p {
          margin: 0;
          color: #6b6b62;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
          font-size: 12px;
        }

        .metricCard h3 {
          margin: 12px 0 8px;
          font-size: 30px;
          letter-spacing: -1px;
          color: #101a14;
        }

        .metricCard small {
          color: #8c6a3c;
          font-weight: 900;
        }

        .actionCards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 18px;
        }

        .actionCard {
          border: 2px solid transparent;
          padding: 28px;
          text-align: left;
          cursor: pointer;
          min-height: 160px;
          transition: .2s ease;
        }

        .actionCard:hover,
        .actionCard.selected {
          transform: translateY(-2px);
          border-color: rgba(140,106,60,.45);
          box-shadow: 0 22px 50px rgba(82,60,27,.14);
        }

        .actionCard span {
          display: inline-flex;
          border-radius: 999px;
          padding: 9px 14px;
          background: rgba(214,178,94,.20);
          color: #8c6a3c;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .actionCard strong {
          display: block;
          margin-top: 18px;
          color: #101a14;
          font-size: 28px;
        }

        .actionCard small {
          display: block;
          margin-top: 8px;
          color: #6b6b62;
          font-weight: 900;
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
          color: #101a14;
          font-size: 24px;
        }

        .panelHead p {
          margin: 6px 0 0;
          color: #6b6b62;
          font-size: 14px;
          line-height: 1.5;
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

        .stepBox {
          border-radius: 24px;
          background: #f3ead8;
          border: 1px solid rgba(92,70,35,.08);
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
          background: #244536;
          color: white;
          font-weight: 900;
        }

        .stepTitle strong {
          color: #101a14;
          font-size: 16px;
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
          border: 1px solid rgba(92,70,35,.12);
          border-radius: 999px;
          padding: 13px 18px;
          background: rgba(255,253,246,.92);
          color: #244536;
          font-weight: 900;
          cursor: pointer;
        }

        .amountChips button.selected,
        .methodGrid button.selected {
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

        input,
        select {
          width: 100%;
          border: 1px solid rgba(92,70,35,.14);
          border-radius: 14px;
          padding: 13px 14px;
          background: rgba(255,253,246,.94);
          color: #101a14;
          outline: none;
          font-weight: 800;
        }

        .paymentNotice {
          border-radius: 22px;
          padding: 18px;
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
          margin-bottom: 16px;
        }

        .paymentNotice strong {
          color: rgba(255,255,255,.72);
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
          color: rgba(255,255,255,.75);
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
          border-radius: 20px;
          padding: 14px;
          background: white;
          text-align: center;
        }

        .qrBox img {
          width: 100%;
          height: auto;
          border-radius: 14px;
        }

        .qrText h3 {
          margin: 0 0 8px;
          font-size: 24px;
          color: #101a14;
        }

        .qrText p {
          margin: 0 0 14px;
          color: #6b6b62;
          font-weight: 900;
        }

        .openQr {
          display: inline-flex;
          border-radius: 999px;
          padding: 12px 16px;
          background: #244536;
          color: white;
          text-decoration: none;
          font-weight: 900;
          font-size: 13px;
        }

        .bankBox {
          border-radius: 20px;
          background: rgba(255,253,246,.72);
          border: 1px solid rgba(92,70,35,.10);
          padding: 20px;
          margin-bottom: 16px;
        }

        .bankBox strong {
          color: #101a14;
          font-size: 20px;
        }

        .bankBox p {
          margin: 8px 0;
          color: #31553d;
          font-weight: 900;
        }

        .bankBox small {
          color: #6b6b62;
          font-weight: 900;
        }

        .formGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
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

        .bottomGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          align-items: start;
        }

        .historyPanel {
          display: grid;
          gap: 12px;
          max-height: 620px;
          overflow: auto;
          padding-right: 4px;
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
        .status.processing,
        .status.under_review,
        .status.under-review {
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

        @media (max-width: 1180px) {
          .topCards {
            grid-template-columns: 1fr;
          }

          .balanceCard,
          .metricCard {
            min-height: auto;
          }

          .bottomGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .walletPage {
            padding: 18px;
          }

          .hero,
          .balanceCard,
          .panelHead,
          .qrPayment {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: flex-start;
          }

          .hero h1 {
            font-size: 34px;
          }

          .balanceCard h2 {
            font-size: 34px;
          }

          .actionCards,
          .formGrid,
          .ruleGrid {
            grid-template-columns: 1fr;
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