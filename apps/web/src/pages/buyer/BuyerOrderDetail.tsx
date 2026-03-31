/**
 * @fileoverview Buyer Order Detail page
 * @module BuyerOrderDetail.tsx
 *
 * Shows full order details and allows the buyer to select one item
 * and submit a return request.
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getMyOrders, Order, OrderItem, requestReturn, extractApiError } from "../../services/api";

function fmtDate(val: string) {
  return new Date(val).toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
}

export default function BuyerOrderDetail() {
  const { orderId }  = useParams<{ orderId: string }>();
  const navigate     = useNavigate();

  const [order,       setOrder]      = useState<Order | null>(null);
  const [selected,    setSelected]   = useState<OrderItem | null>(null);
  const [reason,      setReason]     = useState("");
  const [submitting,  setSubmitting] = useState(false);
  const [feedback,    setFeedback]   = useState<{ kind:"success"|"error"; msg:string } | null>(null);
  const [loading,     setLoading]    = useState(true);
  const [error,       setError]      = useState("");

  useEffect(() => {
    async function load() {
      try {
        const orders = await getMyOrders();
        const found  = orders.find((o) => o.id === orderId);
        if (!found) { setError("Order not found."); } else { setOrder(found); }
      } catch (err) {
        setError("Failed to load order.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [orderId]);

  async function handleReturn() {
    if (!selected?.id || !orderId) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await requestReturn(orderId, selected.id, reason || undefined);
      setFeedback({ kind:"success", msg:`Return request submitted for "${selected.name || "item"}". You will receive a confirmation notification.` });
      setSelected(null);
      setReason("");
    } catch (err: any) {
      setFeedback({ kind:"error", msg: extractApiError(err) });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="card cardPad">Loading…</div>;
  if (error || !order) return (
    <div className="card cardPad">
      <div style={{ color:"var(--danger)", marginBottom:14 }}>{error || "Order not found"}</div>
      <button className="btn" onClick={() => navigate("/buyer/orders")}>← Back to Orders</button>
    </div>
  );

  return (
    <div className="col" style={{ gap:16 }}>
      {/* Header */}
      <div className="card cardPad">
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
          <div>
            <div className="h2">Order #{order.id.slice(0,8).toUpperCase()}</div>
            <div className="muted" style={{ fontSize:12, marginTop:4 }}>{fmtDate(order.createdAt)}</div>
          </div>
          <button className="btn" onClick={() => navigate("/buyer/orders")}>← Back</button>
        </div>
      </div>

      {/* Order summary */}
      <div className="card cardPad">
        <div className="h2" style={{ marginBottom:12 }}>Order Summary</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12 }}>
          {[
            { label:"Subtotal",  value:`$${Number(order.subtotal).toFixed(2)}` },
            { label:"Tax",       value:`$${Number(order.tax).toFixed(2)}` },
            { label:"Total",     value:`$${Number(order.total).toFixed(2)}` },
            { label:"Status",    value: order.status ?? "—" },
          ].map(({ label, value }) => (
            <div key={label} style={{ padding:"10px 14px", borderRadius:10, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }}>
              <div className="muted" style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:600 }}>{label}</div>
              <div style={{ fontWeight:700, marginTop:4, textTransform:"capitalize" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{
          padding:"10px 16px", borderRadius:10, fontSize:13,
          background: feedback.kind==="success" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
          border:`1px solid ${feedback.kind==="success" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
          color: feedback.kind==="success" ? "#22c55e" : "var(--danger)",
        }}>
          {feedback.msg}
        </div>
      )}

      {/* Items table + return selection */}
      <div className="card cardPad">
        <div className="h2" style={{ marginBottom:4 }}>Items Purchased</div>
        <p className="muted" style={{ fontSize:13, marginBottom:14 }}>
          Select one item to request a return, then click <strong>Submit Return Request</strong>.
        </p>

        <div style={{ overflowX:"auto" }}>
          <table className="table" style={{ minWidth:600 }}>
            <thead>
              <tr>
                <th style={{ width:36 }}>Select</th>
                <th>Product</th>
                <th style={{ textAlign:"center" }}>Qty</th>
                <th style={{ textAlign:"right" }}>Unit Price</th>
                <th style={{ textAlign:"right" }}>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, idx) => {
                const isSelected = selected?.id === item.id;
                return (
                  <tr
                    key={idx}
                    onClick={() => item.id && setSelected(isSelected ? null : item)}
                    style={{
                      cursor: item.id ? "pointer" : "default",
                      background: isSelected ? "rgba(124,92,255,0.12)" : undefined,
                    }}
                  >
                    <td>
                      <input
                        type="radio"
                        readOnly
                        checked={isSelected}
                        disabled={!item.id}
                        style={{ cursor:"pointer" }}
                      />
                    </td>
                    <td>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        {item.imageUrl && (
                          <img src={item.imageUrl} alt={item.name || ""}
                            style={{ width:40, height:40, objectFit:"contain", borderRadius:6, background:"#181717", padding:3 }} />
                        )}
                        <span style={{ fontWeight:500 }}>{item.name || item.productId.slice(0,8)}</span>
                      </div>
                    </td>
                    <td style={{ textAlign:"center" }}>{item.quantity}</td>
                    <td style={{ textAlign:"right" }}>${Number(item.unitPrice).toFixed(2)}</td>
                    <td style={{ textAlign:"right" }}>${(Number(item.unitPrice) * item.quantity).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Return form */}
        {selected && (
          <div style={{ marginTop:20, padding:"16px", borderRadius:10, background:"rgba(124,92,255,0.07)", border:"1px solid rgba(124,92,255,0.2)" }}>
            <div style={{ fontWeight:600, marginBottom:8 }}>
              Return: <em>{selected.name || "selected item"}</em>
            </div>
            <label style={{ fontSize:11, color:"var(--muted)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>
              Reason (optional)
            </label>
            <textarea
              rows={3}
              placeholder="Describe why you are returning this item…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{
                display:"block", width:"100%", marginTop:6,
                background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.14)",
                borderRadius:10, color:"rgba(255,255,255,0.9)", padding:"8px 12px", fontSize:13,
                resize:"vertical", boxSizing:"border-box",
              }}
            />
            <div style={{ display:"flex", gap:10, marginTop:12 }}>
              <button
                className="btn btnPrimary"
                onClick={handleReturn}
                disabled={submitting}
              >
                {submitting ? "Submitting…" : "Submit Return Request"}
              </button>
              <button className="btn" onClick={() => { setSelected(null); setReason(""); }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
