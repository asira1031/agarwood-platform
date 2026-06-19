"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type CashInRequest = {
  id: string;
  profile_id: string;
  amount: number | null;
  payment_method: string | null;
  account_name: string | null;
  reference_no: string | null;
  receipt_url: string | null;
  status: string | null;
  created_at: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type Wallet = {
  id: string;
  profile_id: string;
  balance: number | null;
};

const ADMIN_RECEIVER = "JANICA MALDIVES";

export default function AdminCashInPage() {
  const [requests, setRequests] = useState<CashInRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [wallets, setWallets] = useState<Record<string, Wallet>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("PENDING");
  const [message, setMessage] = useState("");
  const [processingId, setProcessingId] = useState("");

  async function loadCashIns() {
    setLoading(true);
    setMessage("");

    const { data: cashInData, error } = await supabase
      .from("cashin_requests")
      .select("id, profile_id, amount, payment_method, account_name, reference_no, receipt_url, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const rows = cashInData || [];
    setRequests(rows);

    const profileIds = Array.from(new Set(rows.map((item) => item.profile_id).filter(Boolean)));

    if (profileIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", profileIds);

      const profileMap: Record<string, Profile> = {};
      (profileData || []).forEach((profile) => {
        profileMap[profile.id] = profile;
      });
      setProfiles(profileMap);

      const { data: walletData } = await supabase
        .from("wallets")
        .select("id, profile_id, balance")
        .in("profile_id", profileIds);

      const walletMap: Record<string, Wallet> = {};
      (walletData || []).forEach((wallet) => {
        walletMap[wallet.profile_id] = wallet;
      });
      setWallets(walletMap);
    } else {
      setProfiles({});
      setWallets({});
    }

    setLoading(false);
  }

  useEffect(() => {
    loadCashIns();
  }, []);

  const filteredRequests = useMemo(() => {
    if (filter === "ALL") return requests;
    return requests.filter((item) => (item.status || "PENDING").toUpperCase() === filter);
  }, [requests, filter]);

  const counts = useMemo(() => {
    return {
      all: requests.length,
      pending: requests.filter((item) => (item.status || "PENDING").toUpperCase() === "PENDING").length,
      approved: requests.filter((item) => (item.status || "").toUpperCase() === "APPROVED").length,
      rejected: requests.filter((item) => (item.status || "").toUpperCase() === "REJECTED").length,
    };
  }, [requests]);

  async function approveCashIn(request: CashInRequest) {
    setMessage("");
    setProcessingId(request.id);

    const currentStatus = (request.status || "PENDING").toUpperCase();

    if (currentStatus !== "PENDING") {
      setMessage("Only PENDING requests can be approved.");
      setProcessingId("");
      return;
    }

    const amount = Number(request.amount || 0);

    if (amount <= 0) {
      setMessage("Invalid cash-in amount.");
      setProcessingId("");
      return;
    }

    const wallet = wallets[request.profile_id];

    if (!wallet) {
      setMessage("Wallet not found for this customer.");
      setProcessingId("");
      return;
    }

    const newBalance = Number(wallet.balance || 0) + amount;

    const { error: walletError } = await supabase
      .from("wallets")
      .update({ balance: newBalance })
      .eq("id", wallet.id);

    if (walletError) {
      setMessage(walletError.message);
      setProcessingId("");
      return;
    }

    const { error: txError } = await supabase.from("wallet_transactions").insert({
      profile_id: request.profile_id,
      transaction_type: "CASH_IN",
      amount,
      status: "COMPLETED",
      reference_no: request.reference_no || request.id,
      description: `Approved cash-in via ${request.payment_method || "payment method"}`,
    });

    if (txError) {
      await supabase.from("wallets").update({ balance: wallet.balance || 0 }).eq("id", wallet.id);
      setMessage(txError.message);
      setProcessingId("");
      return;
    }

    const { error: requestError } = await supabase
      .from("cashin_requests")
      .update({ status: "APPROVED" })
      .eq("id", request.id);

    if (requestError) {
      setMessage(requestError.message);
      setProcessingId("");
      await loadCashIns();
      return;
    }

    setMessage("Cash-in approved. Wallet credited and transaction recorded.");
    setProcessingId("");
    await loadCashIns();
  }

  async function rejectCashIn(request: CashInRequest) {
    setMessage("");
    setProcessingId(request.id);

    const currentStatus = (request.status || "PENDING").toUpperCase();

    if (currentStatus !== "PENDING") {
      setMessage("Only PENDING requests can be rejected.");
      setProcessingId("");
      return;
    }

    const { error } = await supabase
      .from("cashin_requests")
      .update({ status: "REJECTED" })
      .eq("id", request.id);

    if (error) {
      setMessage(error.message);
      setProcessingId("");
      return;
    }

    setMessage("Cash-in request rejected.");
    setProcessingId("");
    await loadCashIns();
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Admin Finance Center</p>
          <h1>Cash-In Approval</h1>
          <span>
            Review customer cash-in payments, verify references, approve wallet credits,
            and record completed CASH_IN transactions.
          </span>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      <section className="stats">
        <Stat label="All Requests" value={counts.all} />
        <Stat label="Pending" value={counts.pending} />
        <Stat label="Approved" value={counts.approved} />
        <Stat label="Rejected" value={counts.rejected} />
      </section>

      <section className="filters">
        {["PENDING", "APPROVED", "REJECTED", "ALL"].map((item) => (
          <button
            key={item}
            className={filter === item ? "active" : ""}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </section>

      <section className="panel">
        {loading ? (
          <div className="empty">Loading cash-in requests...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="empty">No cash-in requests found.</div>
        ) : (
          <div className="list">
            {filteredRequests.map((request) => {
              const profile = profiles[request.profile_id];
              const wallet = wallets[request.profile_id];
              const status = (request.status || "PENDING").toUpperCase();
              const locked = status !== "PENDING" || processingId === request.id;

              return (
                <div key={request.id} className="requestCard">
                  <div className="requestTop">
                    <div>
                      <p className="customer">{profile?.full_name || "Unnamed Customer"}</p>
                      <p className="email">{profile?.email || "No email"}</p>
                    </div>

                    <div className="amountBox">
                      <span>Amount</span>
                      <strong>{peso(Number(request.amount || 0))}</strong>
                    </div>
                  </div>

                  <div className="details">
                    <Info label="Payment Method" value={cleanType(request.payment_method)} />
                    <Info label="Receiver" value={request.account_name || ADMIN_RECEIVER} />
                    <Info label="Reference No." value={request.reference_no || "—"} />
                    <Info label="Wallet Balance" value={peso(Number(wallet?.balance || 0))} />
                    <Info label="Submitted" value={formatDate(request.created_at)} />
                    <Info label="Status" value={status} />
                  </div>

                  {request.receipt_url ? (
                    <a
                      className="receipt"
                      href={request.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Receipt
                    </a>
                  ) : (
                    <div className="noReceipt">No receipt URL submitted.</div>
                  )}

                  <div className="actions">
                    <button
                      disabled={locked}
                      className="approve"
                      onClick={() => approveCashIn(request)}
                    >
                      {processingId === request.id ? "Processing..." : "Approve & Credit Wallet"}
                    </button>

                    <button
                      disabled={locked}
                      className="reject"
                      onClick={() => rejectCashIn(request)}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
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
          max-width: 850px;
          line-height: 1.6;
        }

        .message,
        .panel,
        .stat,
        .requestCard {
          border-radius: 26px;
          background: rgba(255,253,246,.88);
          border: 1px solid rgba(92,70,35,.08);
          box-shadow: 0 18px 42px rgba(82,60,27,.09);
        }

        .message {
          padding: 18px;
          margin-bottom: 18px;
          color: #31553d;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 18px;
        }

        .stat {
          padding: 22px;
        }

        .stat p {
          margin: 0;
          color: #6b6b62;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .stat h3 {
          margin: 10px 0 0;
          color: #244536;
          font-size: 34px;
        }

        .filters {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 18px;
        }

        .filters button {
          border: 1px solid rgba(92,70,35,.12);
          border-radius: 999px;
          padding: 12px 18px;
          background: rgba(255,253,246,.92);
          color: #244536;
          font-weight: 900;
          cursor: pointer;
        }

        .filters button.active {
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
          border-color: transparent;
        }

        .panel {
          padding: 22px;
        }

        .empty {
          padding: 20px;
          border-radius: 18px;
          background: #f3ead8;
          color: #6b6b62;
          font-weight: 900;
        }

        .list {
          display: grid;
          gap: 16px;
        }

        .requestCard {
          padding: 22px;
        }

        .requestTop {
          display: flex;
          justify-content: space-between;
          align-items: start;
          gap: 18px;
          margin-bottom: 18px;
        }

        .customer {
          margin: 0;
          color: #101a14;
          font-size: 24px;
          font-weight: 900;
        }

        .email {
          margin: 6px 0 0;
          color: #6b6b62;
          font-weight: 800;
        }

        .amountBox {
          min-width: 210px;
          border-radius: 22px;
          padding: 18px;
          color: white;
          background: linear-gradient(135deg, #244536, #10281f);
          text-align: right;
        }

        .amountBox span {
          display: block;
          color: rgba(255,255,255,.72);
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .amountBox strong {
          display: block;
          margin-top: 8px;
          font-size: 28px;
        }

        .details {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 14px;
        }

        .info {
          border-radius: 18px;
          background: #f3ead8;
          padding: 14px;
          border: 1px solid rgba(92,70,35,.08);
        }

        .info span {
          display: block;
          color: #6b6b62;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .1em;
        }

        .info strong {
          display: block;
          margin-top: 6px;
          color: #101a14;
          word-break: break-word;
        }

        .receipt,
        .noReceipt {
          display: inline-flex;
          border-radius: 999px;
          padding: 12px 16px;
          font-weight: 900;
          margin-bottom: 16px;
        }

        .receipt {
          background: #244536;
          color: white;
          text-decoration: none;
        }

        .noReceipt {
          background: rgba(214,178,94,.20);
          color: #8c6a3c;
        }

        .actions {
          display: grid;
          grid-template-columns: 1fr 180px;
          gap: 12px;
        }

        .actions button {
          border: 0;
          border-radius: 16px;
          padding: 15px 18px;
          font-weight: 900;
          cursor: pointer;
        }

        .actions button:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .approve {
          background: linear-gradient(135deg, #244536, #10281f);
          color: white;
        }

        .reject {
          background: rgba(163,60,42,.12);
          color: #a33c2a;
        }

        @media (max-width: 1100px) {
          .stats,
          .details {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 760px) {
          .page {
            padding: 18px;
          }

          .hero h1 {
            font-size: 34px;
          }

          .stats,
          .details,
          .actions {
            grid-template-columns: 1fr;
          }

          .requestTop {
            flex-direction: column;
          }

          .amountBox {
            width: 100%;
            text-align: left;
          }
        }
      `}</style>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <p>{label}</p>
      <h3>{value}</h3>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value}</strong>
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

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}