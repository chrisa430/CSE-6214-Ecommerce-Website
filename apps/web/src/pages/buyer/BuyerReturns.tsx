/**
 * @fileoverview Buyer Returns page
 * @module BuyerReturns.tsx
 */
import { useEffect, useState } from "react";
import { getMyReturns, ReturnRequest } from "../../services/api";

function fmtDate(val: string) {
  return new Date(val).toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    pending:   { bg: "rgba(147,197,253,0.18)", fg: "#93c5fd" },
    approved:  { bg: "rgba(34,197,94,0.15)",   fg: "#22c55e" },
    rejected:  { bg: "rgba(239,68,68,0.15)",   fg: "#ef4444" },
    completed: { bg: "rgba(124,92,255,0.18)",  fg: "#a78bfa" },
  };
  const c = colors[status] ?? { bg: "rgba(255,255,255,0.1)", fg: "#fff" };
  return (
    <span style={{
      display:"inline-block", padding:"2px 10px", borderRadius:20,
      fontSize:11, fontWeight:700, textTransform:"capitalize",
      background:c.bg, color:c.fg,
    }}>
      {status}
    </span>
  );
}

export default function BuyerReturns() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    getMyReturns()
      .then((data) => setReturns(data))
      .catch(() => setError("Failed to load returns."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card cardPad">Loading returns…</div>;

  return (
    <div className="col" style={{ gap:16 }}>
      <div className="card cardPad">
        <div className="h2">My Returns</div>
        <p className="muted" style={{ fontSize:13, margin:"6px 0 0" }}>
          All return requests you have submitted.
        </p>
      </div>

      {error && <div className="card cardPad" style={{ color:"var(--danger)" }}>{error}</div>}

      {returns.length === 0 ? (
        <div className="card cardPad">No return requests yet.</div>
      ) : (
        <div className="card cardPad">
          <div style={{ overflowX:"auto" }}>
            <table className="table" style={{ minWidth:600 }}>
              <thead>
                <tr>
                  <th>Return #</th>
                  <th>Product</th>
                  <th>Order #</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontFamily:"monospace", fontSize:11, color:"var(--muted)" }}>
                      {r.id.slice(0,8).toUpperCase()}
                    </td>
                    <td style={{ fontWeight:500 }}>{r.productName}</td>
                    <td style={{ fontFamily:"monospace", fontSize:11, color:"var(--muted)" }}>
                      {r.orderId.slice(0,8).toUpperCase()}
                    </td>
                    <td style={{ fontSize:13, color:"var(--muted)", maxWidth:220 }}>
                      {r.reason || <em style={{ opacity:0.5 }}>No reason provided</em>}
                    </td>
                    <td><StatusBadge status={r.status} /></td>
                    <td style={{ fontSize:12, color:"var(--muted)" }}>{fmtDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
