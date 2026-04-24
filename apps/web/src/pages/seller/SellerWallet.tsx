import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getSellerSales, SellerSale } from "../../services/api";

interface Withdrawal {
  id: string;
  sellerId: string;
  amount: number;
  method: string;
  accountLabel: string;
  date: string;
  status: "processing" | "completed";
}

const STORAGE_KEY = "sportvault_withdrawals";

function loadWithdrawals(sellerId: string): Withdrawal[] {
  try {
    const all: Withdrawal[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    // Mark anything older than 8 seconds as completed
    const now = Date.now();
    return all
      .filter((w) => w.sellerId === sellerId)
      .map((w) => ({
        ...w,
        status: now - new Date(w.date).getTime() > 8000 ? "completed" : w.status,
      }));
  } catch {
    return [];
  }
}

function saveWithdrawal(w: Withdrawal) {
  const all: Withdrawal[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  all.push(w);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const METHODS = ["Direct Deposit (ACH)", "Check by Mail", "PayPal", "Venmo"];

export default function SellerWallet() {
  const { user } = useAuth();
  const [sales, setSales] = useState<SellerSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(METHODS[0]);
  const [accountLabel, setAccountLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    getSellerSales()
      .then((data) => setSales(Array.isArray(data) ? data : []))
      .catch(() => setSales([]))
      .finally(() => setLoading(false));
    setWithdrawals(loadWithdrawals(user.id));
  }, [user]);

  // Refresh withdrawal statuses every 2s while any are "processing"
  useEffect(() => {
    if (!user) return;
    const hasProcessing = withdrawals.some((w) => w.status === "processing");
    if (!hasProcessing) return;
    const timer = setTimeout(() => setWithdrawals(loadWithdrawals(user.id)), 2000);
    return () => clearTimeout(timer);
  }, [withdrawals, user]);

  const totalEarned = sales.reduce((sum, s) => sum + Number(s.lineTotal), 0);
  const totalWithdrawn = withdrawals
    .filter((w) => w.status === "completed")
    .reduce((sum, w) => sum + w.amount, 0);
  const pendingWithdrawal = withdrawals
    .filter((w) => w.status === "processing")
    .reduce((sum, w) => sum + w.amount, 0);
  const available = Math.max(0, totalEarned - totalWithdrawn - pendingWithdrawal);

  function handleWithdrawAll() {
    setAmount(available.toFixed(2));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setFeedback({ kind: "error", msg: "Enter a valid amount greater than $0.00." });
      return;
    }
    if (amt > available) {
      setFeedback({ kind: "error", msg: `Amount exceeds available balance of $${available.toFixed(2)}.` });
      return;
    }
    if (!accountLabel.trim()) {
      setFeedback({ kind: "error", msg: "Enter an account label (e.g. your bank name or email)." });
      return;
    }

    setSubmitting(true);
    // Simulate a brief processing delay
    await new Promise((r) => setTimeout(r, 1200));

    const w: Withdrawal = {
      id: crypto.randomUUID(),
      sellerId: user!.id,
      amount: amt,
      method,
      accountLabel: accountLabel.trim(),
      date: new Date().toISOString(),
      status: "processing",
    };
    saveWithdrawal(w);
    setWithdrawals(loadWithdrawals(user!.id));
    setAmount("");
    setAccountLabel("");
    setFeedback({ kind: "success", msg: `Withdrawal of $${amt.toFixed(2)} initiated. Funds will arrive within 1–3 business days.` });
    setSubmitting(false);
  }

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.22)",
    borderRadius: 10,
    color: "rgba(255,255,255,0.95)",
    padding: "9px 13px",
    fontSize: 14,
    outline: "none",
    width: "100%",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.70)",
    marginBottom: 5,
    display: "block",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  return (
    <div className="col" style={{ gap: 16 }}>
      {/* Header */}
      <div className="card cardPad">
        <div className="h2">Wallet &amp; Withdrawals</div>
        <p className="muted" style={{ fontSize: 13, margin: "6px 0 0" }}>
          View your earnings and withdraw funds to your preferred payment method. All transactions are simulated.
        </p>
      </div>

      {/* Balance cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
        <BalanceCard
          label="Available Balance"
          value={loading ? "—" : `$${available.toFixed(2)}`}
          color="rgba(34,197,94,0.9)"
          bg="rgba(34,197,94,0.10)"
          border="rgba(34,197,94,0.35)"
        />
        <BalanceCard
          label="Total Earned"
          value={loading ? "—" : `$${totalEarned.toFixed(2)}`}
          color="rgba(124,92,255,0.9)"
          bg="rgba(124,92,255,0.10)"
          border="rgba(124,92,255,0.30)"
        />
        <BalanceCard
          label="Total Withdrawn"
          value={loading ? "—" : `$${totalWithdrawn.toFixed(2)}`}
          color="rgba(80,160,255,0.9)"
          bg="rgba(80,160,255,0.10)"
          border="rgba(80,160,255,0.30)"
        />
        {pendingWithdrawal > 0 && (
          <BalanceCard
            label="Processing"
            value={`$${pendingWithdrawal.toFixed(2)}`}
            color="rgba(251,191,36,0.9)"
            bg="rgba(251,191,36,0.10)"
            border="rgba(251,191,36,0.30)"
          />
        )}
      </div>

      {/* Withdrawal form */}
      <div className="card cardPad">
        <div className="h2" style={{ marginBottom: 16 }}>Withdraw Funds</div>

        {feedback && (
          <div style={{
            marginBottom: 14,
            padding: "10px 14px",
            borderRadius: 9,
            fontSize: 13,
            background: feedback.kind === "success" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            border: `1px solid ${feedback.kind === "success" ? "rgba(34,197,94,0.40)" : "rgba(239,68,68,0.40)"}`,
            color: feedback.kind === "success" ? "#4ade80" : "#f87171",
          }}>
            {feedback.msg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="col" style={{ gap: 14, maxWidth: 440 }}>
          {/* Amount */}
          <div>
            <label style={labelStyle}>Amount (USD)</label>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <span style={{
                  position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)",
                  color: "rgba(255,255,255,0.50)", fontSize: 14, pointerEvents: "none",
                }}>$</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={available}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  style={{ ...inputStyle, paddingLeft: 26 }}
                  required
                />
              </div>
              <button
                type="button"
                className="btn"
                onClick={handleWithdrawAll}
                disabled={available <= 0}
                style={{ whiteSpace: "nowrap", fontSize: 13 }}
              >
                Withdraw All
              </button>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 5 }}>
              Available: ${available.toFixed(2)}
            </div>
          </div>

          {/* Payment method */}
          <div>
            <label style={labelStyle}>Payment Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Account label */}
          <div>
            <label style={labelStyle}>Account / Destination Label</label>
            <input
              type="text"
              value={accountLabel}
              onChange={(e) => setAccountLabel(e.target.value)}
              placeholder={method === "Check by Mail" ? "Mailing address" : "Bank name, email, or username"}
              style={inputStyle}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btnPrimary"
            disabled={submitting || available <= 0 || loading}
            style={{ marginTop: 4 }}
          >
            {submitting ? "Processing…" : "Request Withdrawal"}
          </button>

          {available <= 0 && !loading && (
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              No funds available to withdraw. Earnings appear here once buyers complete their orders.
            </p>
          )}
        </form>
      </div>

      {/* Withdrawal history */}
      <div className="card cardPad">
        <div className="h2" style={{ marginBottom: 14 }}>Withdrawal History</div>

        {withdrawals.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>No withdrawals yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Destination</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[...withdrawals].reverse().map((w) => (
                  <tr key={w.id}>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>{fmtDate(w.date)}</td>
                    <td style={{ fontWeight: 700, color: "rgba(50,200,100,0.9)" }}>
                      ${w.amount.toFixed(2)}
                    </td>
                    <td style={{ fontSize: 13 }}>{w.method}</td>
                    <td style={{ fontSize: 13, color: "var(--muted)" }}>{w.accountLabel}</td>
                    <td>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        background: w.status === "completed"
                          ? "rgba(34,197,94,0.15)"
                          : "rgba(251,191,36,0.15)",
                        color: w.status === "completed" ? "#4ade80" : "#fbbf24",
                      }}>
                        {w.status === "completed" ? "Completed" : "Processing"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function BalanceCard({ label, value, color, bg, border }: {
  label: string; value: string; color: string; bg: string; border: string;
}) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", textTransform: "uppercase", letterSpacing: 0.8 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 0", color }}>{value}</div>
    </div>
  );
}
