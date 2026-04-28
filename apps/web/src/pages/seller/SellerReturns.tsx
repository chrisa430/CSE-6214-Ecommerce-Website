/**
 * @fileoverview Seller Returns page
 * @module SellerReturns.tsx
 *
 * Displays all orders containing items the seller sold.
 * Orders with return requests are marked ✱ and highlighted.
 * Seller can select one or more return records, optionally add a note,
 * and Approve, Decline, or Dispute the returns.
 * Notifications are sent automatically on action.
 */
import React, { useEffect, useState, useCallback } from "react";
import { getSellerReturns, actionReturn, SellerReturnRow, extractApiError } from "../../services/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(val: string | null) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric" });
}

function ReturnBadge({ status }: { status: string }) {
  const colors: Record<string, { bg:string; fg:string }> = {
    pending:   { bg:"rgba(147,197,253,0.18)", fg:"#93c5fd" },
    approved:  { bg:"rgba(34,197,94,0.15)",   fg:"#22c55e" },
    declined:  { bg:"rgba(239,68,68,0.15)",   fg:"#ef4444" },
    rejected:  { bg:"rgba(239,68,68,0.15)",   fg:"#ef4444" },
    disputed:  { bg:"rgba(251,191,36,0.18)",  fg:"#fbbf24" },
    completed: { bg:"rgba(124,92,255,0.18)",  fg:"#a78bfa" },
  };
  const c = colors[status] ?? { bg:"rgba(255,255,255,0.1)", fg:"#fff" };
  return (
    <span style={{
      display:"inline-block", padding:"2px 8px", borderRadius:20,
      fontSize:11, fontWeight:700, textTransform:"capitalize",
      background:c.bg, color:c.fg,
    }}>
      {status}
    </span>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 10,
  color: "rgba(255,255,255,0.9)",
  padding: "7px 12px",
  fontSize: 13,
  width: "100%",
  boxSizing: "border-box",
  resize: "vertical",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderGroup {
  orderId:     string;
  total:       number;
  createdAt:   string;
  orderStatus: string;
  hasReturn:   boolean;
  hasPending:  boolean;
  items:       SellerReturnRow[];
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SellerReturns() {
  const [groups,     setGroups]     = useState<OrderGroup[]>([]);
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set());
  const [selected,   setSelected]   = useState<Set<string>>(new Set());  // return IDs
  const [notes,      setNotes]      = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback,   setFeedback]   = useState<{ kind:"success"|"error"; msg:string } | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setSelected(new Set());
    setFeedback(null);
    getSellerReturns()
      .then((rows) => {
        const map = new Map<string, OrderGroup>();
        for (const row of rows) {
          if (!map.has(row.orderId)) {
            map.set(row.orderId, {
              orderId:     row.orderId,
              total:       row.total,
              createdAt:   row.orderCreatedAt,
              orderStatus: row.orderStatus,
              hasReturn:   false,
              hasPending:  false,
              items:       [],
            });
          }
          const g = map.get(row.orderId)!;
          if (row.returnId) {
            g.hasReturn = true;
            if (row.returnStatus === "pending") g.hasPending = true;
          }
          g.items.push(row);
        }
        setGroups([...map.values()]);
      })
      .catch(() => setError("Failed to load orders."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggle(orderId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(orderId) ? next.delete(orderId) : next.add(orderId);
      return next;
    });
  }

  function toggleReturn(returnId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(returnId) ? next.delete(returnId) : next.add(returnId);
      return next;
    });
  }

  // All pending return IDs across all groups
  const allPendingIds = groups.flatMap((g) =>
    g.items.filter((i) => i.returnId && i.returnStatus === "pending").map((i) => i.returnId!)
  );

  function toggleAllPending() {
    const allSelected = allPendingIds.every((id) => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(allPendingIds));
  }

  async function handleAction(action: "approved" | "declined" | "disputed") {
    if (selected.size === 0) {
      setFeedback({ kind:"error", msg:"Select at least one pending return request first." });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await actionReturn([...selected], action, notes.trim() || undefined);
      setFeedback({
        kind: "success",
        msg: `${result.updated} return${result.updated !== 1 ? "s" : ""} ${action}. Notifications have been sent.`,
      });
      setNotes("");
      load();
    } catch (err: any) {
      setFeedback({ kind:"error", msg: extractApiError(err) });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="card cardPad">Loading…</div>;

  const pendingCount   = allPendingIds.length;
  const returnOrders   = groups.filter((g) => g.hasReturn);

  return (
    <div className="col" style={{ gap:16 }}>

      {/* Header */}
      <div className="card cardPad">
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
          <div>
            <div className="h2">Returns</div>
            <p className="muted" style={{ fontSize:13, margin:"6px 0 0" }}>
              Orders marked <strong>✱</strong> contain return requests.
              Select one or more pending requests to approve, decline, or dispute.
            </p>
          </div>
          <button className="btn" onClick={load} disabled={loading}>↻ Refresh</button>
        </div>
      </div>

      {error && <div className="card cardPad" style={{ color:"var(--danger)" }}>{error}</div>}

      {/* Summary strip */}
      {returnOrders.length > 0 && (
        <div style={{
          padding:"10px 16px", borderRadius:10, fontSize:13,
          background:"rgba(147,197,253,0.12)", border:"1px solid rgba(147,197,253,0.3)", color:"#93c5fd",
        }}>
          ✱ {returnOrders.length} order{returnOrders.length !== 1 ? "s" : ""} with return requests
          {pendingCount > 0 && ` · ${pendingCount} pending action`}
        </div>
      )}

      {/* Action toolbar — only shown when pending returns exist */}
      {pendingCount > 0 && (
        <div className="card cardPad">
          <div className="h2" style={{ marginBottom:8 }}>Bulk Action</div>
          <p className="muted" style={{ fontSize:13, marginBottom:12 }}>
            Select pending return requests below, optionally add a note, then choose an action.
            Notifications are sent automatically.
          </p>

          {feedback && (
            <div style={{
              marginBottom:14, padding:"8px 14px", borderRadius:8, fontSize:13,
              background: feedback.kind==="success" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
              border:`1px solid ${feedback.kind==="success" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
              color: feedback.kind==="success" ? "#22c55e" : "var(--danger)",
            }}>
              {feedback.msg}
            </div>
          )}

          {/* Note field */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, color:"var(--muted)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:6 }}>
              Note to buyer (optional)
            </label>
            <textarea
              rows={2}
              placeholder="Provide a reason or explanation to include in buyer and seller notifications…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Selection summary + action buttons */}
          <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:10 }}>
            <span className="muted" style={{ fontSize:13, flex:1 }}>
              {selected.size} of {pendingCount} pending return{pendingCount !== 1 ? "s" : ""} selected
            </span>

            <button
              className="btn"
              onClick={toggleAllPending}
              disabled={submitting}
            >
              {allPendingIds.every((id) => selected.has(id)) ? "Deselect All" : "Select All Pending"}
            </button>

            <button
              className="btn btnPrimary"
              disabled={submitting || selected.size === 0}
              onClick={() => handleAction("approved")}
              style={{ background:"rgba(34,197,94,0.18)", border:"1px solid rgba(34,197,94,0.4)", color:"#22c55e" }}
            >
              {submitting ? "Processing…" : "✓ Approve"}
            </button>

            <button
              className="btn"
              disabled={submitting || selected.size === 0}
              onClick={() => handleAction("declined")}
              style={{ background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.35)", color:"#ef4444" }}
            >
              {submitting ? "Processing…" : "✗ Decline"}
            </button>

            <button
              className="btn"
              disabled={submitting || selected.size === 0}
              onClick={() => handleAction("disputed")}
              style={{ background:"rgba(251,191,36,0.12)", border:"1px solid rgba(251,191,36,0.35)", color:"#fbbf24" }}
            >
              {submitting ? "Processing…" : "⚑ Dispute"}
            </button>
          </div>
        </div>
      )}

      {/* Orders table */}
      {groups.length === 0 ? (
        <div className="card cardPad">No orders containing your items yet.</div>
      ) : (
        <div className="card cardPad" style={{ padding:0, overflow:"hidden" }}>
          <table className="table" style={{ minWidth:640 }}>
            <thead>
              <tr>
                <th style={{ width:28 }}></th>
                <th>Order #</th>
                <th>Date</th>
                <th>Status</th>
                <th style={{ textAlign:"right" }}>Total</th>
                <th style={{ textAlign:"center" }}>Items</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const isOpen      = expanded.has(group.orderId);
                const returnItems = group.items.filter((i) => i.returnId);
                const pendingItems = returnItems.filter((i) => i.returnStatus === "pending");

                return (
                  <React.Fragment key={group.orderId}>
                    <tr
                      onClick={() => toggle(group.orderId)}
                      style={{
                        cursor:"pointer",
                        background: group.hasPending
                          ? "rgba(147,197,253,0.07)"
                          : group.hasReturn
                            ? "rgba(255,255,255,0.02)"
                            : isOpen ? "rgba(124,92,255,0.04)" : undefined,
                      }}
                    >
                      <td style={{ textAlign:"center", fontWeight:700, color: group.hasPending ? "#93c5fd" : "#fbbf24", fontSize:14 }}>
                        {group.hasReturn ? "✱" : ""}
                      </td>
                      <td style={{ fontFamily:"monospace", fontSize:12 }}>{group.orderId.slice(0,8).toUpperCase()}</td>
                      <td style={{ fontSize:13 }}>{fmtDate(group.createdAt)}</td>
                      <td style={{ textTransform:"capitalize", fontSize:13 }}>{group.orderStatus}</td>
                      <td style={{ textAlign:"right", fontWeight:600, fontVariantNumeric:"tabular-nums" }}>
                        ${Number(group.total).toFixed(2)}
                      </td>
                      <td style={{ textAlign:"center", color:"var(--muted)", fontSize:13 }}>
                        {group.items.length} {isOpen ? "▲" : "▼"}
                        {pendingItems.length > 0 && (
                          <span style={{ marginLeft:6, fontSize:10, color:"#93c5fd", fontWeight:700 }}>
                            ({pendingItems.length} pending)
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded return items */}
                    {isOpen && returnItems.length > 0 && (
                      <tr key={`${group.orderId}-returns`}>
                        <td colSpan={6} style={{ padding:0 }}>
                          <div style={{
                            margin:"0 12px 12px",
                            borderRadius:10,
                            background:"rgba(147,197,253,0.05)",
                            border:"1px solid rgba(147,197,253,0.18)",
                            padding:"12px 16px",
                          }}>
                            <div style={{ fontWeight:700, fontSize:11, color:"#93c5fd", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>
                              Return Requests
                            </div>
                            <table className="table" style={{ margin:0 }}>
                              <thead>
                                <tr>
                                  <th style={{ width:36 }}>Select</th>
                                  <th>Product</th>
                                  <th style={{ textAlign:"center" }}>Qty</th>
                                  <th style={{ textAlign:"right" }}>Price</th>
                                  <th>Return Status</th>
                                  <th>Buyer Reason</th>
                                  <th>Seller Note</th>
                                  <th>Requested</th>
                                </tr>
                              </thead>
                              <tbody>
                                {returnItems.map((item) => {
                                  const isPending = item.returnStatus === "pending";
                                  const isChecked = item.returnId ? selected.has(item.returnId) : false;
                                  return (
                                    <tr
                                      key={item.itemId}
                                      onClick={() => isPending && item.returnId && toggleReturn(item.returnId)}
                                      style={{
                                        cursor: isPending ? "pointer" : "default",
                                        background: isChecked ? "rgba(124,92,255,0.12)" : undefined,
                                      }}
                                    >
                                      <td onClick={(e) => e.stopPropagation()}>
                                        <input
                                          type="checkbox"
                                          disabled={!isPending || !item.returnId}
                                          checked={isChecked}
                                          onChange={() => item.returnId && toggleReturn(item.returnId)}
                                          style={{ cursor: isPending ? "pointer" : "not-allowed" }}
                                        />
                                      </td>
                                      <td>
                                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                          {item.imageUrl && (
                                            <img src={item.imageUrl} alt={item.productName}
                                              style={{ width:32, height:32, objectFit:"contain", borderRadius:4, background:"#181717" }} />
                                          )}
                                          <span style={{ fontWeight:500 }}>{item.productName}</span>
                                        </div>
                                      </td>
                                      <td style={{ textAlign:"center" }}>{item.quantity}</td>
                                      <td style={{ textAlign:"right" }}>${Number(item.unitPrice).toFixed(2)}</td>
                                      <td>
                                        {item.returnStatus && <ReturnBadge status={item.returnStatus} />}
                                      </td>
                                      <td style={{ fontSize:12, color:"var(--muted)", maxWidth:180 }}>
                                        {item.returnReason || <em style={{ opacity:0.4 }}>No reason</em>}
                                      </td>
                                      <td style={{ fontSize:12, color:"var(--muted)", maxWidth:160 }}>
                                        {(item as any).sellerNotes || <em style={{ opacity:0.4 }}>—</em>}
                                      </td>
                                      <td style={{ fontSize:12, color:"var(--muted)", whiteSpace:"nowrap" }}>
                                        {fmtDate(item.returnCreatedAt)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Expanded: non-return items */}
                    {isOpen && returnItems.length === 0 && (
                      <tr key={`${group.orderId}-items`}>
                        <td colSpan={6}>
                          <div style={{ padding:"8px 24px 12px", color:"var(--muted)", fontSize:13 }}>
                            {group.items.map((item) => (
                              <div key={item.itemId} style={{ marginBottom:4 }}>
                                • {item.productName} × {item.quantity} @ ${Number(item.unitPrice).toFixed(2)}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
