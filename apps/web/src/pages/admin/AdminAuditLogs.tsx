/**
 * @fileoverview AdminAuditLogs — full account audit log viewer
 * @module pages/admin/AdminAuditLogs.tsx
 * @author Darrell Hobson
 * @Date 2026.04.24
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate }   from "react-router-dom";
import { useAuth }       from "../../context/AuthContext";
import { getAuditLogs, AuditLogRow, extractApiError } from "../../services/api";

const PAGE_SIZE = 25;

const ACTION_COLORS: Record<string, { bg: string; fg: string }> = {
  ACCOUNT_CREATION_SUBMITTED: { bg: "rgba(147,197,253,0.18)", fg: "#93c5fd" },
  ACCOUNT_APPROVED:           { bg: "rgba(34,197,94,0.15)",   fg: "#22c55e" },
  ACCOUNT_REJECTED:           { bg: "rgba(239,68,68,0.15)",   fg: "#ef4444" },
  ACCOUNT_SUSPENDED:          { bg: "rgba(251,191,36,0.18)",  fg: "#fbbf24" },
  ACCOUNT_CLOSED:             { bg: "rgba(239,68,68,0.15)",   fg: "#ef4444" },
  ACCOUNT_ACTIVATED:          { bg: "rgba(34,197,94,0.15)",   fg: "#22c55e" },
  SEED:                       { bg: "rgba(124,92,255,0.15)",  fg: "#a78bfa" },
};

function ActionBadge({ action }: { action: string }) {
  const c = ACTION_COLORS[action] ?? { bg: "rgba(255,255,255,0.08)", fg: "rgba(255,255,255,0.6)" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px", borderRadius: 20,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.03em",
      background: c.bg, color: c.fg, whiteSpace: "nowrap",
    }}>
      {action.replace(/_/g, " ")}
    </span>
  );
}

export default function AdminAuditLogs() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [rows,    setRows]    = useState<AuditLogRow[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState("");

  useEffect(() => {
    if (user !== null && user.type !== "admin") navigate("/login", { replace: true });
  }, [user, navigate]);

  const load = useCallback(async (p: number, action: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAuditLogs({
        limit:  PAGE_SIZE,
        offset: (p - 1) * PAGE_SIZE,
        action: action || undefined,
      });
      setRows(result.rows);
      setTotal(result.total);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page, filterAction); }, [load, page, filterAction]);

  function handleFilterChange(val: string) {
    setFilterAction(val);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
            <div className="h2">📋 Audit Logs</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              {total} total record{total !== 1 ? "s" : ""} — showing page {page} of {totalPages}
            </div>
          </div>
          <button className="btn" onClick={() => load(page, filterAction)} disabled={loading}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="card cardPad">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>
              Filter by Action
            </label>
            <select
              value={filterAction}
              onChange={(e) => handleFilterChange(e.target.value)}
              style={selectStyle}
            >
              <option value="">All Actions</option>
              <option value="ACCOUNT_CREATION_SUBMITTED">Account Creation Submitted</option>
              <option value="ACCOUNT_APPROVED">Account Approved</option>
              <option value="ACCOUNT_REJECTED">Account Rejected</option>
              <option value="ACCOUNT_SUSPENDED">Account Suspended</option>
              <option value="ACCOUNT_CLOSED">Account Closed</option>
              <option value="ACCOUNT_ACTIVATED">Account Activated</option>
            </select>
          </div>
          {filterAction && (
            <button className="btn" style={{ alignSelf: "flex-end" }} onClick={() => handleFilterChange("")}>
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
          <p className="muted" style={{ textAlign: "center", padding: 32 }}>Loading audit logs…</p>
        ) : rows.length === 0 ? (
          <p className="muted" style={{ textAlign: "center", padding: 32 }}>No audit log records found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {new Date(row.occurredAt).toLocaleString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td><ActionBadge action={row.action} /></td>
                    <td style={{ fontSize: 13 }}>
                      <div style={{ fontWeight: 600 }}>{row.actorFirstName} {row.actorLastName}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>
                        {row.actorEmail}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--muted)", maxWidth: 360, wordBreak: "break-word" }}>
                      {row.detail ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 20 }}>
            <button
              className="btn"
              style={{ padding: "8px 18px", fontSize: 16, opacity: page <= 1 ? 0.3 : 1 }}
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ←
            </button>
            <span className="muted" style={{ fontSize: 13 }}>
              Page {page} of {totalPages} &nbsp;·&nbsp; {total} records
            </span>
            <button
              className="btn"
              style={{ padding: "8px 18px", fontSize: 16, opacity: page >= totalPages ? 0.3 : 1 }}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 10, color: "rgba(255,255,255,0.9)",
  padding: "7px 12px", fontSize: 13, cursor: "pointer", minWidth: 220,
};
