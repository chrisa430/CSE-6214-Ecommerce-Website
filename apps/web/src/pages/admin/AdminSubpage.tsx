/**
 * @fileoverview Admin Subpage — account management, approvals, product moderation, audit log
 * @module AdminSubpage.tsx
 * @author Darrell Hobson
 * @Date 2026.03.05
 *
 * Requirements:
 *   - Admin-only guard (redirects non-admin users to /login)
 *   - Account Management section: search all users, filter by type/status, sort by
 *     activated_date / suspended_date / closed_date
 *   - Account Approvals section: approve/reject pending 'open' accounts
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate }                       from "react-router-dom";
import { useAuth }                           from "../../context/AuthContext";
import {
  searchAccounts,
  fetchOpenAccounts,
  submitAccountDecision,
  AccountRecord,
  OpenAccount,
  AccountSearchParams,
  extractApiError,
} from "../../services/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Page shell ────────────────────────────────────────────────────────────────

export default function AdminSubpage() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  useEffect(() => {
    if (user !== null && user.type !== "admin") {
      navigate("/login", { replace: true });
    }
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

      <Section id="products" title="Product Moderation">
        <div className="divider" />
        <table className="table">
          <thead>
            <tr><th>Product</th><th>Seller</th><th>Status</th><th>Submitted</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Signed Jersey</td><td>seller@demo</td><td>Pending</td><td>2026-02-17</td>
              <td>
                <button className="btn btnPrimary">Approve</button>{" "}
                <button className="btn btnDanger">Block</button>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section id="returns" title="Return Facilitation">
        <div className="divider" />
        <table className="table">
          <thead>
            <tr><th>Return ID</th><th>Order</th><th>Status</th><th>Requested</th><th>Decision</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>r09</td><td>o21</td><td>Disputed</td><td>2026-02-16</td>
              <td>
                <button className="btn btnPrimary">Approve Return</button>{" "}
                <button className="btn btnDanger">Deny Return</button>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section id="audit" title="Audit Logs">
        <div className="divider" />
        <table className="table">
          <thead>
            <tr><th>Time</th><th>Actor</th><th>Action</th><th>Resource</th></tr>
          </thead>
          <tbody>
            <tr><td>2026-02-18 11:05</td><td>admin@sportvault.com</td><td>RESOLVE_RETURN</td><td>Return r09</td></tr>
            <tr><td>2026-02-18 10:31</td><td>admin@sportvault.com</td><td>BLOCK_PRODUCT</td><td>Product a12</td></tr>
          </tbody>
        </table>
      </Section>
    </div>
  );
}

// ── Account Management Section ────────────────────────────────────────────────

function AccountManagementSection() {
  const [accounts,  setAccounts]  = useState<AccountRecord[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  // Filter & sort state
  const [filterType,   setFilterType]   = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortBy,       setSortBy]       = useState<AccountSearchParams["sortBy"]>("created_at");
  const [sortOrder,    setSortOrder]    = useState<"asc" | "desc">("desc");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchAccounts({
        type:      filterType   || undefined,
        status:    filterStatus || undefined,
        sortBy,
        sortOrder,
      });
      setAccounts(data);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, sortBy, sortOrder]);

  useEffect(() => { load(); }, [load]);

  function handleSortHeader(col: AccountSearchParams["sortBy"]) {
    if (sortBy === col) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortOrder("desc");
    }
  }

  function SortIcon({ col }: { col: AccountSearchParams["sortBy"] }) {
    if (sortBy !== col) return <span style={{ opacity: 0.3, marginLeft: 4 }}>↕</span>;
    return <span style={{ marginLeft: 4 }}>{sortOrder === "asc" ? "↑" : "↓"}</span>;
  }

  return (
    <section id="users" className="card cardPad">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div className="h2">User Management</div>
        <button className="btn" onClick={load} disabled={loading}>↻ Refresh</button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        {/* Type filter */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Account Type
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={selectStyle}
          >
            <option value="">All Types</option>
            <option value="admin">Admin</option>
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
          </select>
        </div>

        {/* Status filter */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={selectStyle}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="closed">Closed</option>
            <option value="open">Open (Pending)</option>
          </select>
        </div>

        {/* Sort column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Sort By
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as AccountSearchParams["sortBy"])}
            style={selectStyle}
          >
            <option value="created_at">Created Date</option>
            <option value="activated_date">Activated Date</option>
            <option value="suspended_date">Suspended Date</option>
            <option value="closed_date">Closed Date</option>
          </select>
        </div>

        {/* Sort direction */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Order
          </label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
            style={selectStyle}
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>
      </div>

      <div className="divider" />

      {/* Error */}
      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 12,
          background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)", color: "var(--danger)" }}>
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="muted" style={{ textAlign: "center", padding: 24 }}>Loading accounts…</p>
      ) : accounts.length === 0 ? (
        <p className="muted" style={{ textAlign: "center", padding: 24 }}>No accounts match the selected filters.</p>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>First Name</th>
                  <th>Last Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th
                    style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                    onClick={() => handleSortHeader("activated_date")}
                  >
                    Activated Date<SortIcon col="activated_date" />
                  </th>
                  <th
                    style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                    onClick={() => handleSortHeader("suspended_date")}
                  >
                    Suspended Date<SortIcon col="suspended_date" />
                  </th>
                  <th
                    style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                    onClick={() => handleSortHeader("closed_date")}
                  >
                    Closed Date<SortIcon col="closed_date" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acct) => (
                  <tr key={acct.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{acct.userId}</td>
                    <td>{acct.firstName}</td>
                    <td>{acct.lastName}</td>
                    <td style={{ textTransform: "capitalize" }}>{acct.type}</td>
                    <td><StatusBadge status={acct.status} /></td>
                    <td>{fmtDate(acct.activatedDate)}</td>
                    <td>{fmtDate(acct.suspendedDate)}</td>
                    <td>{fmtDate(acct.closedDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            {accounts.length} account{accounts.length !== 1 ? "s" : ""} found
          </div>
        </>
      )}
    </section>
  );
}

const selectStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 10,
  color: "rgba(255,255,255,0.9)",
  padding: "7px 12px",
  fontSize: 13,
  cursor: "pointer",
  minWidth: 140,
};

// ── Account Approvals Section ─────────────────────────────────────────────────

function AccountApprovalsSection() {
  const [accounts,   setAccounts]   = useState<OpenAccount[]>([]);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback,   setFeedback]   = useState<{ kind: "success" | "error"; msg: string } | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    setSelected(new Set());
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
    setSelected(
      selected.size === accounts.length ? new Set() : new Set(accounts.map((a) => a.id))
    );
  }

  async function handleDecision(decision: "approve" | "reject") {
    if (selected.size === 0) {
      setFeedback({ kind: "error", msg: "Select at least one account row first." });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
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
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} title={allSelected ? "Deselect all" : "Select all"} />
                </th>
                <th>Email</th><th>Name</th><th>Type</th><th>Status</th><th>Requested</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acct) => {
                const isSelected = selected.has(acct.id);
                return (
                  <tr
                    key={acct.id}
                    onClick={() => toggleRow(acct.id)}
                    style={{ cursor: "pointer", background: isSelected ? "rgba(124,92,255,0.12)" : undefined }}
                  >
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
            <button className="btn btnDanger"  disabled={submitting || selected.size === 0} onClick={() => handleDecision("reject")}>
              {submitting ? "Processing…" : "Reject Selected"}
            </button>
            <button className="btn btnPrimary" disabled={submitting || selected.size === 0} onClick={() => handleDecision("approve")}>
              {submitting ? "Processing…" : "Approve Selected"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// ── Generic section wrapper ───────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card cardPad">
      <div className="h2">{title}</div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </section>
  );
}
