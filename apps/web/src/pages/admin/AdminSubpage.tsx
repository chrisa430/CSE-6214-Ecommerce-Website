/**
 * @fileoverview Admin Subpage — User Management + Account Approvals
 * @module AdminSubpage.tsx
 * @author Darrell Hobson
 * @Date 2026.04.24
 *
 * Updates:
 *  - User Management: 15-row pagination + per-row Activate/Suspend/Close buttons
 *  - Account Approvals: unchanged (bulk approve/reject)
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate }                       from "react-router-dom";
import { useAuth }                           from "../../context/AuthContext";
import {
  searchAccounts,
  fetchOpenAccounts,
  submitAccountDecision,
  updateAccountStatus,
  AccountRecord,
  OpenAccount,
  AccountSearchParams,
  extractApiError,
} from "../../services/api";

const USERS_PER_PAGE = 15;

function fmtDate(val: string | null | undefined): string {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    active:    { bg: "rgba(34,197,94,0.15)",    fg: "#22c55e" },
    suspended: { bg: "rgba(251,191,36,0.18)",   fg: "#fbbf24" },
    closed:    { bg: "rgba(239,68,68,0.15)",    fg: "#ef4444" },
    open:      { bg: "rgba(147,197,253,0.18)",  fg: "#93c5fd" },
  };
  const c = colors[status] ?? { bg: "rgba(255,255,255,0.1)", fg: "#fff" };
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

export default function AdminSubpage() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  useEffect(() => {
    if (user !== null && user.type !== "admin") navigate("/login", { replace: true });
  }, [user, navigate]);

  if (!user || user.type !== "admin") {
    return (
      <div className="card cardPad" style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 44 }}>🚫</div>
        <div className="h2" style={{ marginTop: 14 }}>Access Denied</div>
        <p className="muted">This page is restricted to administrator accounts.</p>
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="card cardPad">
        <div className="h2">Admin Tools</div>
        <p className="muted" style={{ fontSize: 13, marginTop: 4, marginBottom: 0 }}>
          Manage users, approve accounts, moderate products, and review audit records.
        </p>
      </div>
      <AccountManagementSection />
      <AccountApprovalsSection />
    </div>
  );
}

// ── Account Management Section ────────────────────────────────────────────────

function AccountManagementSection() {
  const [accounts,     setAccounts]     = useState<AccountRecord[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null);
  const [busyId,       setBusyId]       = useState<string | null>(null);
  const [page,         setPage]         = useState(1);

  const [filterType,   setFilterType]   = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortBy,       setSortBy]       = useState<AccountSearchParams["sortBy"]>("created_at");
  const [sortOrder,    setSortOrder]    = useState<"asc" | "desc">("desc");

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await searchAccounts({
        type:      filterType   || undefined,
        status:    filterStatus || undefined,
        sortBy, sortOrder,
      });
      setAccounts(data);
      setPage(1);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, sortBy, sortOrder]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusAction(acct: AccountRecord, status: "active" | "suspended" | "closed") {
    setBusyId(`${acct.id}-${status}`);
    try {
      const r = await updateAccountStatus([acct.id], status);
      showToast(r.message);
      // Update locally for immediate feedback
      setAccounts((prev) => prev.map((a) => a.id === acct.id ? { ...a, status } : a));
    } catch (err) {
      showToast(extractApiError(err), false);
    } finally {
      setBusyId(null);
    }
  }

  function SortIcon({ col }: { col: AccountSearchParams["sortBy"] }) {
    if (sortBy !== col) return <span style={{ opacity: 0.3, marginLeft: 4 }}>↕</span>;
    return <span style={{ marginLeft: 4 }}>{sortOrder === "asc" ? "↑" : "↓"}</span>;
  }

  function handleSortHeader(col: AccountSearchParams["sortBy"]) {
    if (sortBy === col) setSortOrder((p) => p === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortOrder("desc"); }
  }

  // Pagination
  const totalPages = Math.max(1, Math.ceil(accounts.length / USERS_PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = accounts.slice((safePage - 1) * USERS_PER_PAGE, safePage * USERS_PER_PAGE);

  return (
    <section id="users" className="card cardPad">
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14,
          background: toast.ok ? "rgba(34,197,94,0.92)" : "rgba(239,68,68,0.92)",
          color: "#fff", boxShadow: "0 4px 16px rgba(0,0,0,.4)",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="h2">User Management</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            {accounts.length} account{accounts.length !== 1 ? "s" : ""} &nbsp;·&nbsp; Page {safePage} of {totalPages}
          </div>
        </div>
        <button className="btn" onClick={load} disabled={loading}>↻ Refresh</button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        {[
          { label: "Account Type", value: filterType, set: setFilterType,
            options: [["", "All Types"], ["admin", "Admin"], ["buyer", "Buyer"], ["seller", "Seller"]] },
          { label: "Status", value: filterStatus, set: setFilterStatus,
            options: [["", "All Statuses"], ["active", "Active"], ["suspended", "Suspended"], ["closed", "Closed"], ["open", "Open (Pending)"]] },
          { label: "Sort By", value: sortBy, set: (v: string) => setSortBy(v as AccountSearchParams["sortBy"]),
            options: [["created_at", "Created Date"], ["activated_date", "Activated Date"], ["suspended_date", "Suspended Date"], ["closed_date", "Closed Date"]] },
          { label: "Order", value: sortOrder, set: (v: string) => setSortOrder(v as "asc" | "desc"),
            options: [["desc", "Newest First"], ["asc", "Oldest First"]] },
        ].map(({ label, value, set, options }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {label}
            </label>
            <select value={value} onChange={(e) => set(e.target.value)} style={selectStyle}>
              {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="divider" />

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 12,
          background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)", color: "var(--danger)" }}>
          {error}
        </div>
      )}

      {loading ? (
        <p className="muted" style={{ textAlign: "center", padding: 24 }}>Loading accounts…</p>
      ) : accounts.length === 0 ? (
        <p className="muted" style={{ textAlign: "center", padding: 24 }}>No accounts match the selected filters.</p>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 1050 }}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>First Name</th>
                  <th>Last Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                      onClick={() => handleSortHeader("activated_date")}>
                    Activated<SortIcon col="activated_date" />
                  </th>
                  <th style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                      onClick={() => handleSortHeader("suspended_date")}>
                    Suspended<SortIcon col="suspended_date" />
                  </th>
                  <th style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                      onClick={() => handleSortHeader("closed_date")}>
                    Closed<SortIcon col="closed_date" />
                  </th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((acct) => (
                  <tr key={acct.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{acct.userId}</td>
                    <td>{acct.firstName}</td>
                    <td>{acct.lastName}</td>
                    <td style={{ textTransform: "capitalize" }}>{acct.type}</td>
                    <td><StatusBadge status={acct.status} /></td>
                    <td>{fmtDate(acct.activatedDate)}</td>
                    <td>{fmtDate(acct.suspendedDate)}</td>
                    <td>{fmtDate(acct.closedDate)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                        {/* Activate */}
                        <button
                          className="btn"
                          title="Activate account"
                          disabled={acct.status === "active" || !!busyId}
                          onClick={() => handleStatusAction(acct, "active")}
                          style={{
                            padding: "4px 10px", fontSize: 11, fontWeight: 700,
                            background: "rgba(34,197,94,0.13)", color: "#4ade80",
                            borderColor: "rgba(34,197,94,0.3)",
                            opacity: acct.status === "active" || !!busyId ? 0.35 : 1,
                          }}
                        >
                          {busyId === `${acct.id}-active` ? "…" : "Activate"}
                        </button>
                        {/* Suspend */}
                        <button
                          className="btn"
                          title="Suspend account"
                          disabled={acct.status === "suspended" || !!busyId}
                          onClick={() => handleStatusAction(acct, "suspended")}
                          style={{
                            padding: "4px 10px", fontSize: 11, fontWeight: 700,
                            background: "rgba(251,191,36,0.13)", color: "#fbbf24",
                            borderColor: "rgba(251,191,36,0.3)",
                            opacity: acct.status === "suspended" || !!busyId ? 0.35 : 1,
                          }}
                        >
                          {busyId === `${acct.id}-suspended` ? "…" : "Suspend"}
                        </button>
                        {/* Close */}
                        <button
                          className="btn"
                          title="Close account permanently"
                          disabled={acct.status === "closed" || !!busyId}
                          onClick={() => handleStatusAction(acct, "closed")}
                          style={{
                            padding: "4px 10px", fontSize: 11, fontWeight: 700,
                            background: "rgba(239,68,68,0.13)", color: "#fca5a5",
                            borderColor: "rgba(239,68,68,0.3)",
                            opacity: acct.status === "closed" || !!busyId ? 0.35 : 1,
                          }}
                        >
                          {busyId === `${acct.id}-closed` ? "…" : "Close"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 16 }}>
              <button
                className="btn"
                style={{ padding: "8px 20px", fontSize: 16, opacity: safePage <= 1 ? 0.3 : 1 }}
                disabled={safePage <= 1}
                onClick={() => setPage((p) => p - 1)}
              >←</button>

              <div style={{ display: "flex", gap: 5 }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                  Math.max(0, safePage - 3), Math.min(totalPages, safePage + 2)
                ).map((p) => (
                  <button
                    key={p}
                    className="btn"
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
            Showing {pageRows.length} of {accounts.length} accounts · Page {safePage} of {totalPages}
          </div>
        </>
      )}
    </section>
  );
}

const selectStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 10, color: "rgba(255,255,255,0.9)",
  padding: "7px 12px", fontSize: 13, cursor: "pointer", minWidth: 140,
};

// ── Account Approvals Section ─────────────────────────────────────────────────

function AccountApprovalsSection() {
  const [accounts,   setAccounts]   = useState<OpenAccount[]>([]);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback,   setFeedback]   = useState<{ kind: "success" | "error"; msg: string } | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true); setFeedback(null); setSelected(new Set());
    try {
      setAccounts(await fetchOpenAccounts());
    } catch (err) {
      setFeedback({ kind: "error", msg: extractApiError(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(selected.size === accounts.length ? new Set() : new Set(accounts.map((a) => a.id)));
  }

  async function handleDecision(decision: "approve" | "reject") {
    if (selected.size === 0) { setFeedback({ kind: "error", msg: "Select at least one account first." }); return; }
    setSubmitting(true); setFeedback(null);
    try {
      const result = await submitAccountDecision([...selected], decision);
      setFeedback({ kind: "success", msg: result.message });
      await loadAccounts();
    } catch (err) {
      setFeedback({ kind: "error", msg: extractApiError(err) });
    } finally {
      setSubmitting(false);
    }
  }

  const allSelected = accounts.length > 0 && selected.size === accounts.length;

  return (
    <section id="approvals" className="card cardPad">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div className="h2">Account Approvals</div>
        <button className="btn" onClick={loadAccounts} disabled={loading || submitting}>↻ Refresh</button>
      </div>

      {feedback && (
        <div style={{
          marginTop: 12, padding: "10px 14px", borderRadius: 10, fontSize: 13,
          background: feedback.kind === "success" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
          border: `1px solid ${feedback.kind === "success" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
          color: feedback.kind === "success" ? "#22c55e" : "var(--danger)",
        }}>
          {feedback.msg}
        </div>
      )}

      <div className="divider" />

      {loading ? (
        <p className="muted" style={{ textAlign: "center", padding: 24 }}>Loading pending accounts…</p>
      ) : accounts.length === 0 ? (
        <p className="muted" style={{ textAlign: "center", padding: 24 }}>✅ No accounts pending approval.</p>
      ) : (
        <>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th>Email</th><th>Name</th><th>Type</th><th>Status</th><th>Requested</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acct) => {
                const isSelected = selected.has(acct.id);
                return (
                  <tr key={acct.id} onClick={() => toggleRow(acct.id)}
                    style={{ cursor: "pointer", background: isSelected ? "rgba(124,92,255,0.12)" : undefined }}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleRow(acct.id)} />
                    </td>
                    <td>{acct.email}</td>
                    <td>{acct.firstName} {acct.lastName}</td>
                    <td style={{ textTransform: "capitalize" }}>{acct.type}</td>
                    <td><StatusBadge status={acct.status} /></td>
                    <td>{new Date(acct.createdAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="muted" style={{ fontSize: 13, flex: 1 }}>
              {selected.size} of {accounts.length} row{accounts.length !== 1 ? "s" : ""} selected
            </span>
            <button className="btn btnDanger" disabled={submitting || selected.size === 0}
              onClick={() => handleDecision("reject")}>
              {submitting ? "Processing…" : "Reject Selected"}
            </button>
            <button className="btn btnPrimary" disabled={submitting || selected.size === 0}
              onClick={() => handleDecision("approve")}>
              {submitting ? "Processing…" : "Approve Selected"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
