/**
 * @fileoverview AdminReturns — return facilitation page
 * @module pages/admin/AdminReturns.tsx
 * @author Darrell Hobson
 * @Date 2026.04.24
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate }   from "react-router-dom";
import { useAuth }       from "../../context/AuthContext";
import { getAdminReturns, AdminReturn, extractApiError } from "../../services/api";

const PAGE_SIZE = 15;

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  pending:   { bg: "rgba(147,197,253,0.18)", fg: "#93c5fd" },
  approved:  { bg: "rgba(34,197,94,0.15)",   fg: "#22c55e" },
  rejected:  { bg: "rgba(239,68,68,0.15)",   fg: "#ef4444" },
  completed: { bg: "rgba(34,197,94,0.22)",   fg: "#4ade80" },
  disputed:  { bg: "rgba(251,191,36,0.18)",  fg: "#fbbf24" },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: "rgba(255,255,255,0.1)", fg: "#fff" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 700, textTransform: "capitalize",
      background: c.bg, color: c.fg,
    }}>
      {status}
    </span>
  );
}

function fmtDate(val: string): string {
  return new Date(val).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default function AdminReturns() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [returns,      setReturns]      = useState<AdminReturn[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [page,         setPage]         = useState(1);
  const [filterStatus, setFilterStatus] = useState("");
  const [searchTerm,   setSearchTerm]   = useState("");

  useEffect(() => {
    if (user !== null && user.type !== "admin") navigate("/login", { replace: true });
  }, [user, navigate]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setReturns(await getAdminReturns());
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = returns.filter((r) => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (
        !r.buyerName.toLowerCase().includes(term) &&
        !r.sellerName.toLowerCase().includes(term) &&
        !(r.productName ?? "").toLowerCase().includes(term)
      ) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const activeCount    = returns.filter((r) => ["pending","disputed"].includes(r.status)).length;
  const disputedCount  = returns.filter((r) => r.status === "disputed").length;

  if (!user || user.type !== "admin") {
    return (
      <div className="card cardPad" style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 44 }}>🚫</div>
        <div className="h2" style={{ marginTop: 14 }}>Access Denied</div>
        <p className="muted">This page is restricted to administrators.</p>
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 16 }}>

      {/* Header */}
      <div className="card cardPad">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div className="h2">↩ Return Facilitation</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              {returns.length} total return{returns.length !== 1 ? "s" : ""}
              {activeCount > 0 && (
                <> &nbsp;·&nbsp;
                  <span style={{ color: "#fbbf24", fontWeight: 700 }}>{activeCount} active</span>
                </>
              )}
              {disputedCount > 0 && (
                <> &nbsp;·&nbsp;
                  <span style={{ color: "#ef4444", fontWeight: 700 }}>{disputedCount} disputed</span>
                </>
              )}
            </div>
          </div>
          <button className="btn" onClick={load} disabled={loading}>↻ Refresh</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card cardPad">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>Search</label>
            <input
              type="text"
              placeholder="Buyer, seller, or product…"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              style={inputStyle}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>Status</label>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              style={selectStyle}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="disputed">Disputed</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          {(filterStatus || searchTerm) && (
            <button
              className="btn"
              style={{ alignSelf: "flex-end" }}
              onClick={() => { setFilterStatus(""); setSearchTerm(""); setPage(1); }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: "10px 16px", borderRadius: 10, fontSize: 13,
          background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)",
          color: "var(--danger)",
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Table */}
      <div className="card cardPad">
        {loading ? (
          <p className="muted" style={{ textAlign: "center", padding: 32 }}>Loading returns…</p>
        ) : filtered.length === 0 ? (
          <p className="muted" style={{ textAlign: "center", padding: 32 }}>
            {returns.length === 0 ? "No return requests in the system." : "No returns match the selected filters."}
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th>Return #</th>
                    <th>Product</th>
                    <th>Buyer</th>
                    <th>Seller</th>
                    <th>Status</th>
                    <th>Reason</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r.id}
                      style={{ background: r.status === "disputed" ? "rgba(239,68,68,0.04)" : undefined }}>
                      <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted)" }}>
                        {r.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td style={{ fontWeight: 500, maxWidth: 200, wordBreak: "break-word" }}>
                        {r.productName ?? "—"}
                      </td>
                      <td style={{ fontSize: 13 }}>{r.buyerName}</td>
                      <td style={{ fontSize: 13 }}>{r.sellerName}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td style={{ fontSize: 12, color: "var(--muted)", maxWidth: 220, wordBreak: "break-word" }}>
                        {r.reason ?? "—"}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                        {fmtDate(r.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 20 }}>
                <button
                  className="btn"
                  style={{ padding: "8px 20px", fontSize: 16, opacity: safePage <= 1 ? 0.3 : 1 }}
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >←</button>
                <div style={{ display: "flex", gap: 5 }}>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .slice(Math.max(0, safePage - 3), Math.min(totalPages, safePage + 2))
                    .map((p) => (
                    <button key={p} className="btn"
                      style={{
                        padding: "6px 12px", fontSize: 13, minWidth: 38,
                        fontWeight: p === safePage ? 800 : 500,
                        background: p === safePage ? "linear-gradient(135deg,rgba(124,92,255,0.5),rgba(124,92,255,0.25))" : "rgba(255,255,255,0.05)",
                        borderColor: p === safePage ? "rgba(124,92,255,0.5)" : "rgba(255,255,255,0.1)",
                        color: p === safePage ? "#c4b5fd" : "rgba(255,255,255,0.6)",
                      }}
                      onClick={() => setPage(p)}
                    >{p}</button>
                  ))}
                </div>
                <button
                  className="btn"
                  style={{ padding: "8px 20px", fontSize: 16, opacity: safePage >= totalPages ? 0.3 : 1 }}
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >→</button>
              </div>
            )}
            <div className="muted" style={{ fontSize: 12, textAlign: "center", marginTop: 6 }}>
              Showing {pageRows.length} of {filtered.length} returns · Page {safePage} of {totalPages}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: "var(--muted)", fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.05em",
};
const selectStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 10, color: "rgba(255,255,255,0.9)",
  padding: "7px 12px", fontSize: 13, cursor: "pointer", minWidth: 160,
};
const inputStyle: React.CSSProperties = {
  ...selectStyle, minWidth: 220, cursor: "text",
};
