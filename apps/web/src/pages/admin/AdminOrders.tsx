/**
 * @fileoverview Admin Order Maintenance page
 * @module AdminOrders.tsx
 * @author Darrell Hobson
 *
 * Sections:
 *   1. Order Configuration — admin sets ORDER_AGE (return window, days)
 *   2. Orders in the System — table of all orders with buyer, seller(s), total, status
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate }                       from "react-router-dom";
import { useAuth }                           from "../../context/AuthContext";
import Pagination from "../../components/Pagination";

const PAGE_SIZE = 15;
import {
  getOrderConfig,
  updateOrderConfig,
  getAdminOrders,
  AdminOrder,
  OrderConfig,
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
      display: "inline-block", padding: "2px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 700, textTransform: "capitalize",
      background: c.bg, color: c.fg,
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
  fontSize: 14,
  width: 120,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--muted)",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminOrders() {
  const { user }  = useAuth();
  const navigate  = useNavigate();

  // Config state
  const [config,          setConfig]         = useState<OrderConfig | null>(null);
  const [orderAgeInput,   setOrderAgeInput]  = useState("");
  const [configLoading,   setConfigLoading]  = useState(true);
  const [configSaving,    setConfigSaving]   = useState(false);
  const [configFeedback,  setConfigFeedback] = useState<{ kind: "success" | "error"; msg: string } | null>(null);

  // Orders state
  const [orders,         setOrders]        = useState<AdminOrder[]>([]);
  const [ordersLoading,  setOrdersLoading] = useState(true);
  const [ordersFeedback, setOrdersFeedback] = useState<{ kind: "error"; msg: string } | null>(null);
  const [searchBuyer,    setSearchBuyer]   = useState("");
  const [filterStatus,   setFilterStatus]  = useState("");
  const [page,           setPage]          = useState(1);

  // Admin guard
  useEffect(() => {
    if (user !== null && user.type !== "admin") navigate("/login", { replace: true });
  }, [user, navigate]);

  // ── Load config ──────────────────────────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigFeedback(null);
    try {
      const data = await getOrderConfig();
      setConfig(data);
      setOrderAgeInput(data.config.order_age ?? "60");
    } catch (err) {
      setConfigFeedback({ kind: "error", msg: extractApiError(err) });
    } finally {
      setConfigLoading(false);
    }
  }, []);

  // ── Load orders ──────────────────────────────────────────────────────────────
  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersFeedback(null);
    try {
      const ordersData = await getAdminOrders();
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch (err) {
      setOrdersFeedback({ kind: "error", msg: extractApiError(err) });
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); loadOrders(); }, [loadConfig, loadOrders]);

  // ── Save config ──────────────────────────────────────────────────────────────
  async function handleSaveConfig() {
    const n = parseInt(orderAgeInput, 10);
    if (isNaN(n) || n < 1 || n > 365) {
      setConfigFeedback({ kind: "error", msg: "Return window must be between 1 and 365 days." });
      return;
    }
    setConfigSaving(true);
    setConfigFeedback(null);
    try {
      await updateOrderConfig("order_age", String(n));
      setConfigFeedback({ kind: "success", msg: `Return window saved: ${n} days.` });
      await loadConfig();
    } catch (err) {
      setConfigFeedback({ kind: "error", msg: extractApiError(err) });
    } finally {
      setConfigSaving(false);
    }
  }

  // ── Filter orders ────────────────────────────────────────────────────────────
  const filtered = orders.filter((o) => {
    if (filterStatus && o.status !== filterStatus) return false;
    if (searchBuyer) {
      const full = `${o.buyerFirstName} ${o.buyerLastName}`.toLowerCase();
      if (!full.includes(searchBuyer.toLowerCase())) return false;
    }
    return true;
  });
  const totalPages   = Math.ceil(filtered.length / PAGE_SIZE);
  const pageFiltered = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="card cardPad">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div className="col" style={{ gap: 4 }}>
            <div className="h2">Order Maintenance</div>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              Configure order policies and review all orders in the system.
            </p>
          </div>
          <button className="btn" onClick={() => { loadConfig(); loadOrders(); }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── Section 1: Order Configuration ──────────────────────────────────── */}
      <div className="card cardPad">
        <div className="h2" style={{ marginBottom: 4 }}>Order Configuration</div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
          These values apply globally to all orders. Changes are persisted to the database.
        </p>

        {configFeedback && (
          <div style={{
            marginBottom: 14, padding: "8px 14px", borderRadius: 8, fontSize: 13,
            background: configFeedback.kind === "success" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            border: `1px solid ${configFeedback.kind === "success" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
            color: configFeedback.kind === "success" ? "#22c55e" : "var(--danger)",
          }}>
            {configFeedback.msg}
          </div>
        )}

        {configLoading ? (
          <p className="muted">Loading configuration…</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-end" }}>

            {/* order_age field */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={labelStyle}>Return Window (days)</label>
              <p className="muted" style={{ fontSize: 12, margin: "0 0 4px" }}>
                Number of days a buyer has to return an item from a completed order.
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={orderAgeInput}
                  onChange={(e) => setOrderAgeInput(e.target.value)}
                  style={inputStyle}
                />
                <span className="muted" style={{ fontSize: 13 }}>days</span>
              </div>
              {config && (
                <p className="muted" style={{ fontSize: 11, margin: 0 }}>
                  Current saved value: <strong>{config.config.order_age}</strong> days
                  {config.rows[0]?.updatedAt && ` · Last updated ${fmtDate(config.rows[0].updatedAt)}`}
                </p>
              )}
            </div>

            <button
              className="btn btnPrimary"
              onClick={handleSaveConfig}
              disabled={configSaving}
              style={{ alignSelf: "flex-end" }}
            >
              {configSaving ? "Saving…" : "Save Configuration"}
            </button>
          </div>
        )}
      </div>

      {/* ── Section 2: Orders in the System ─────────────────────────────────── */}
      <div className="card cardPad">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <div className="col" style={{ gap: 4 }}>
            <div className="h2">Orders in the System</div>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              {orders.length} total order{orders.length !== 1 ? "s" : ""}
              {orders.length !== filtered.length && ` · ${filtered.length} shown`}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>Search Buyer</label>
            <input
              type="text"
              placeholder="First or last name…"
              value={searchBuyer}
              onChange={(e) => { setSearchBuyer(e.target.value); setPage(1); }}
              style={{ ...inputStyle, width: 200 }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>Status</label>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              style={{ ...inputStyle, width: 160, cursor: "pointer" }}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          {(searchBuyer || filterStatus) && (
            <button
              className="btn"
              onClick={() => { setSearchBuyer(""); setFilterStatus(""); setPage(1); }}
              style={{ alignSelf: "flex-end" }}
            >
              Clear Filters
            </button>
          )}
        </div>

        {ordersFeedback && (
          <div style={{
            marginBottom: 14, padding: "8px 14px", borderRadius: 8, fontSize: 13,
            background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)",
            color: "var(--danger)",
          }}>
            {ordersFeedback.msg}
          </div>
        )}

        {ordersLoading ? (
          <p className="muted" style={{ textAlign: "center", padding: 32 }}>Loading orders…</p>
        ) : filtered.length === 0 ? (
          <p className="muted" style={{ textAlign: "center", padding: 32 }}>
            {orders.length === 0 ? "No orders in the system yet." : "No orders match the selected filters."}
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ minWidth: 860 }}>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Date</th>
                    <th>Buyer</th>
                    <th>Seller(s)</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageFiltered.map((order) => (
                    <tr key={order.id}>
                      <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted)" }}>
                        {order.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>
                        {fmtDate(order.createdAt)}
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {order.buyerFirstName} {order.buyerLastName}
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {order.sellerNames.join(", ")}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                        ${Number(order.total).toFixed(2)}
                      </td>
                      <td>
                        <StatusBadge status={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              onChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
