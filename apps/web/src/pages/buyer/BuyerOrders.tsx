/**
 * @fileoverview Buyer Order History page
 * @module BuyerOrders.tsx
 *
 * Displays all orders the buyer has placed. Orders within the return window
 * show a "Return Item" button that navigates to the order detail page.
 */
import { useEffect, useState } from "react";
import { useNavigate }         from "react-router-dom";
import { getMyOrders, Order, getOrderConfig, OrderConfig } from "../../services/api";

function fmtDate(val: string) {
  return new Date(val).toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric" });
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const colors: Record<string, { bg: string; fg: string }> = {
    pending:   { bg: "rgba(147,197,253,0.18)", fg: "#93c5fd" },
    confirmed: { bg: "rgba(34,197,94,0.15)",   fg: "#22c55e" },
    shipped:   { bg: "rgba(124,92,255,0.18)",  fg: "#a78bfa" },
    delivered: { bg: "rgba(34,197,94,0.22)",   fg: "#4ade80" },
    cancelled: { bg: "rgba(239,68,68,0.15)",   fg: "#ef4444" },
    refunded:  { bg: "rgba(251,191,36,0.18)",  fg: "#fbbf24" },
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

export default function BuyerOrders() {
  const navigate = useNavigate();
  const [orders, setOrders]     = useState<Order[]>([]);
  const [orderAge, setOrderAge] = useState(60);
  const [error,  setError]      = useState("");
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [orderData, configData] = await Promise.all([
          getMyOrders(),
          getOrderConfig().catch(() => null as OrderConfig | null),
        ]);
        setOrders(Array.isArray(orderData) ? orderData : []);
        if (configData?.config?.order_age) {
          setOrderAge(parseInt(configData.config.order_age, 10) || 60);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load orders.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function isWithinReturnWindow(createdAt: string): boolean {
    const days = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return days <= orderAge;
  }

  if (loading) return <div className="card cardPad">Loading orders…</div>;

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="card cardPad">
        <div className="h2">Order History</div>
        <p className="muted" style={{ fontSize:13, margin:"6px 0 0" }}>
          Returns are available within <strong>{orderAge} days</strong> of purchase.
        </p>
      </div>

      {error && <div className="card cardPad" style={{ color:"var(--danger)" }}>{error}</div>}

      {orders.length === 0 ? (
        <div className="card cardPad">No orders yet.</div>
      ) : (
        orders.map((order) => {
          const canReturn = isWithinReturnWindow(order.createdAt);
          return (
            <div key={order.id} className="card cardPad">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:10 }}>
                <div>
                  <div className="h2">Order #{order.id.slice(0,8).toUpperCase()}</div>
                  <div className="muted" style={{ fontSize:12, marginTop:2 }}>{fmtDate(order.createdAt)}</div>
                  <div style={{ marginTop:6 }}><StatusBadge status={order.status} /></div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8 }}>
                  <div className="h2">${Number(order.total).toFixed(2)}</div>
                  {canReturn ? (
                    <button
                      className="btn btnPrimary"
                      onClick={() => navigate(`/buyer/orders/${order.id}`)}
                    >
                      Return Item
                    </button>
                  ) : (
                    <span className="muted" style={{ fontSize:11 }}>Return window closed</span>
                  )}
                </div>
              </div>

              <div className="divider" />

              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th style={{ textAlign:"right" }}>Price</th>
                    <th style={{ textAlign:"right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          {item.imageUrl && (
                            <img src={item.imageUrl} alt={item.name || "Product"}
                              style={{ width:36, height:36, objectFit:"contain", borderRadius:6, background:"#181717", padding:3 }} />
                          )}
                          <span>{item.name || item.productId.slice(0,8)}</span>
                        </div>
                      </td>
                      <td>{item.quantity}</td>
                      <td style={{ textAlign:"right" }}>${Number(item.unitPrice).toFixed(2)}</td>
                      <td style={{ textAlign:"right" }}>${(Number(item.unitPrice) * item.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </div>
  );
}
