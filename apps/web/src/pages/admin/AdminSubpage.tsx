/**
 * @fileoverview Admin Subpage — account approvals, product moderation, returns, audit log
 * @module AdminSubpage.tsx
 * @author Darrell Hobson
 * @Date 2026.03.04
 *
 * Requirement 7:
 *   - Admin-only guard (redirects non-admin users to /login)
 *   - "Account Approvals" section lists all accounts with status='open'
 *   - Multi-row checkbox selection; approve or reject via AdminService
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate }                       from "react-router-dom";
import { useAuth }                           from "../../context/AuthContext";
import {
  fetchOpenAccounts,
  submitAccountDecision,
  OpenAccount,
  extractApiError,
} from "../../services/api";

// ── Page shell ────────────────────────────────────────────────────────────────

export default function AdminSubpage() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  // Admin-only guard — redirect unauthorised users immediately
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
          Manage account approvals, product listings, returns, and audit records.
        </p>
      </div>

      {/* ── Req 7: Live account approvals ─────────────────────────────────── */}
      <AccountApprovalsSection />

      {/* ── Product moderation ────────────────────────────────────────────── */}
      <Section id="products" title="Product Moderation (REQ-047 / REQ-048 / REQ-049)">
        <div className="divider" />
        <table className="table">
          <thead>
            <tr>
              <th>Product</th><th>Seller</th><th>Status</th><th>Submitted</th><th>Actions</th>
            </tr>
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

      {/* ── Return facilitation ───────────────────────────────────────────── */}
      <Section id="returns" title="Return Facilitation (REQ-082)">
        <div className="divider" />
        <table className="table">
          <thead>
            <tr>
              <th>Return ID</th><th>Order</th><th>Status</th><th>Requested</th><th>Decision</th>
            </tr>
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

      {/* ── Audit logs ────────────────────────────────────────────────────── */}
      <Section id="audit" title="Audit Logs (REQ-050 / REQ-059 / REQ-060)">
        <div className="divider" />
        <table className="table">
          <thead>
            <tr><th>Time</th><th>Actor</th><th>Action</th><th>Resource</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>2026-02-18 11:05</td><td>admin@demo</td>
              <td>RESOLVE_RETURN</td><td>Return r09</td>
            </tr>
            <tr>
              <td>2026-02-18 10:31</td><td>admin@demo</td>
              <td>BLOCK_PRODUCT</td><td>Product a12</td>
            </tr>
          </tbody>
        </table>
      </Section>
    </div>
  );
}

// ── Account Approvals section (live data) ─────────────────────────────────────

function AccountApprovalsSection() {
  const [accounts,   setAccounts]   = useState<OpenAccount[]>([]);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback,   setFeedback]   = useState<
    { kind: "success" | "error"; msg: string } | null
  >(null);

  // ── Data load ───────────────────────────────────────────────────────────
  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    setSelected(new Set());
    try {
      const data = await fetchOpenAccounts();
      setAccounts(data);
    } catch (err) {
      setFeedback({ kind: "error", msg: extractApiError(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  // ── Selection helpers ───────────────────────────────────────────────────
  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(
      selected.size === accounts.length
        ? new Set()
        : new Set(accounts.map((a) => a.id))
    );
  }

  // ── Decision submit ─────────────────────────────────────────────────────
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
      await loadAccounts(); // refresh list
    } catch (err) {
      setFeedback({ kind: "error", msg: extractApiError(err) });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  const allSelected = accounts.length > 0 && selected.size === accounts.length;

  return (
    <section id="accounts" className="card cardPad">
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div className="h2">Account Approvals (REQ-008 / REQ-009)</div>
        <button className="btn" onClick={loadAccounts} disabled={loading || submitting}>
          ↻ Refresh
        </button>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 10,
            fontSize: 13,
            background: feedback.kind === "success"
              ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            border: `1px solid ${
              feedback.kind === "success"
                ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"
            }`,
            color: feedback.kind === "success" ? "#22c55e" : "var(--danger)",
          }}
        >
          {feedback.msg}
        </div>
      )}

      <div className="divider" />

      {/* States */}
      {loading ? (
        <p className="muted" style={{ textAlign: "center", padding: 24 }}>
          Loading pending accounts…
        </p>
      ) : accounts.length === 0 ? (
        <p className="muted" style={{ textAlign: "center", padding: 24 }}>
          ✅ No accounts pending approval.
        </p>
      ) : (
        <>
          {/* Table */}
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    title={allSelected ? "Deselect all" : "Select all"}
                  />
                </th>
                <th>Email</th>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Requested</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acct) => {
                const isSelected = selected.has(acct.id);
                return (
                  <tr
                    key={acct.id}
                    onClick={() => toggleRow(acct.id)}
                    style={{
                      cursor: "pointer",
                      background: isSelected
                        ? "rgba(124,92,255,0.12)"
                        : undefined,
                    }}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(acct.id)}
                      />
                    </td>
                    <td>{acct.email}</td>
                    <td>{acct.firstName} {acct.lastName}</td>
                    <td style={{ textTransform: "capitalize" }}>{acct.type}</td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 10px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          background: "rgba(251,191,36,0.18)",
                          color: "#fbbf24",
                          textTransform: "capitalize",
                        }}
                      >
                        {acct.status}
                      </span>
                    </td>
                    <td>{new Date(acct.createdAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Action bar */}
          <div
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span className="muted" style={{ fontSize: 13, flex: 1 }}>
              {selected.size} of {accounts.length} row{accounts.length !== 1 ? "s" : ""} selected
            </span>
            <button
              className="btn btnDanger"
              disabled={submitting || selected.size === 0}
              onClick={() => handleDecision("reject")}
            >
              {submitting ? "Processing…" : "Reject Selected"}
            </button>
            <button
              className="btn btnPrimary"
              disabled={submitting || selected.size === 0}
              onClick={() => handleDecision("approve")}
            >
              {submitting ? "Processing…" : "Approve Selected"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// ── Generic section wrapper ───────────────────────────────────────────────────

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="card cardPad">
      <div className="h2">{title}</div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </section>
  );
}
