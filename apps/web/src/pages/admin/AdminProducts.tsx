/**
 * @fileoverview Admin Product Inventory page
 * @module AdminProducts.tsx
 * @author Darrell Hobson
 * @Date 2026.03.10
 *
 * Requirements:
 *   - Admin-only guard
 *   - List all products: id, name, category, subcategory, seller name, status
 *   - Select single or all records via checkboxes
 *   - Bulk set status to active or suspended
 *   - Click product id → navigates to ProductDetail page
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link }                 from "react-router-dom";
import { useAuth }                           from "../../context/AuthContext";
import {
  fetchProducts,
  updateProductStatus,
  ProductSummary,
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
    active:    { bg: "rgba(34,197,94,0.15)",   fg: "#22c55e" },
    suspended: { bg: "rgba(251,191,36,0.18)",  fg: "#fbbf24" },
    removed:   { bg: "rgba(239,68,68,0.15)",   fg: "#ef4444" },
    open:      { bg: "rgba(147,197,253,0.18)", fg: "#93c5fd" },
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminProducts() {
  const { user }  = useAuth();
  const navigate  = useNavigate();

  const [products,   setProducts]   = useState<ProductSummary[]>([]);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback,   setFeedback]   = useState<{ kind: "success" | "error"; msg: string } | null>(null);

  // Filter state
  const [filterStatus,   setFilterStatus]   = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [searchName,     setSearchName]     = useState("");

  // Admin-only guard
  useEffect(() => {
    if (user !== null && user.type !== "admin") navigate("/login", { replace: true });
  }, [user, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    setSelected(new Set());
    try {
      setProducts(await fetchProducts());
    } catch (err) {
      setFeedback({ kind: "error", msg: extractApiError(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Selection helpers ────────────────────────────────────────────────────────

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const visible = filtered.map((p) => p.id);
    const allSelected = visible.every((id) => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(visible));
  }

  // ── Bulk status action ───────────────────────────────────────────────────────

  async function handleStatusChange(status: "active" | "suspended") {
    if (selected.size === 0) {
      setFeedback({ kind: "error", msg: "Select at least one product row first." });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await updateProductStatus([...selected], status);
      setFeedback({ kind: "success", msg: result.message });
      await load();
    } catch (err) {
      setFeedback({ kind: "error", msg: extractApiError(err) });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Filtering ────────────────────────────────────────────────────────────────

  const filtered = products.filter((p) => {
    if (filterStatus   && p.statusCode   !== filterStatus)   return false;
    if (filterCategory && p.categoryCode !== filterCategory) return false;
    if (searchName     && !p.name.toLowerCase().includes(searchName.toLowerCase())) return false;
    return true;
  });

  const categories = [...new Set(products.map((p) => ({ code: p.categoryCode, name: p.category }))
    .map((c) => JSON.stringify(c)))]
    .map((s) => JSON.parse(s) as { code: string; name: string });

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((p) => selected.has(p.id));

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

      {/* Page header */}
      <div className="card cardPad">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div className="col" style={{ gap: 4 }}>
            <div className="h2">Product Inventory</div>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              View, filter, and manage the status of all products on the platform.
            </p>
          </div>
          <button className="btn" onClick={load} disabled={loading}>↻ Refresh</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card cardPad">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>

          {/* Name search */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>Search Name</label>
            <input
              type="text"
              placeholder="Type to filter…"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              style={{ ...selectStyle, minWidth: 200 }}
            />
          </div>

          {/* Category filter */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>Category</label>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={selectStyle}>
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>Status</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="open">Open</option>
              <option value="removed">Removed</option>
            </select>
          </div>

          {/* Clear filters */}
          {(filterStatus || filterCategory || searchName) && (
            <button
              className="btn"
              onClick={() => { setFilterStatus(""); setFilterCategory(""); setSearchName(""); }}
              style={{ alignSelf: "flex-end" }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div style={{
          padding: "10px 16px", borderRadius: 10, fontSize: 13,
          background: feedback.kind === "success" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
          border: `1px solid ${feedback.kind === "success" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
          color: feedback.kind === "success" ? "#22c55e" : "var(--danger)",
        }}>
          {feedback.msg}
        </div>
      )}

      {/* Product table */}
      <div className="card cardPad">
        {loading ? (
          <p className="muted" style={{ textAlign: "center", padding: 32 }}>Loading products…</p>
        ) : filtered.length === 0 ? (
          <p className="muted" style={{ textAlign: "center", padding: 32 }}>
            {products.length === 0 ? "No products in inventory yet." : "No products match the selected filters."}
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ minWidth: 960 }}>
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAll}
                        title={allVisibleSelected ? "Deselect all" : "Select all"}
                      />
                    </th>
                    <th>Product ID</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Subcategory</th>
                    <th>Seller</th>
                    <th>Qty</th>
                    <th>Status</th>
                    <th>Listed</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product) => {
                    const isSelected = selected.has(product.id);
                    return (
                      <tr
                        key={product.id}
                        onClick={() => toggleRow(product.id)}
                        style={{
                          cursor: "pointer",
                          background: isSelected ? "rgba(124,92,255,0.12)" : undefined,
                        }}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(product.id)}
                          />
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <Link
                            to={`/admin/products/${product.id}`}
                            style={{
                              fontFamily: "monospace",
                              fontSize: 11,
                              color: "rgba(124,92,255,0.9)",
                              textDecoration: "underline",
                              wordBreak: "break-all",
                            }}
                          >
                            {product.id}
                          </Link>
                        </td>
                        <td style={{ fontWeight: 500 }}>{product.name}</td>
                        <td style={{ textTransform: "capitalize" }}>{product.category}</td>
                        <td style={{ color: "var(--muted)", fontSize: 13 }}>
                          {product.subcategory ?? "—"}
                        </td>
                        <td>{product.sellerFirstName} {product.sellerLastName}</td>
                        <td style={{ textAlign: "center" }}>{product.quantity}</td>
                        <td><StatusBadge status={product.status} /></td>
                        <td style={{ fontSize: 12, color: "var(--muted)" }}>{fmtDate(product.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bulk actions toolbar */}
            <div style={{
              marginTop: 16,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              paddingTop: 12,
              borderTop: "1px solid rgba(255,255,255,0.08)",
            }}>
              <span className="muted" style={{ fontSize: 13, flex: 1 }}>
                {selected.size} of {filtered.length} row{filtered.length !== 1 ? "s" : ""} selected
                {products.length !== filtered.length && ` (${products.length} total)`}
              </span>
              <button
                className="btn"
                disabled={submitting || selected.size === 0}
                onClick={() => handleStatusChange("suspended")}
                style={{
                  background: "rgba(251,191,36,0.15)",
                  border: "1px solid rgba(251,191,36,0.4)",
                  color: "#fbbf24",
                }}
              >
                {submitting ? "Processing…" : "Suspend Selected"}
              </button>
              <button
                className="btn btnPrimary"
                disabled={submitting || selected.size === 0}
                onClick={() => handleStatusChange("active")}
              >
                {submitting ? "Processing…" : "Set Active"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 10,
  color: "rgba(255,255,255,0.9)",
  padding: "7px 12px",
  fontSize: 13,
  cursor: "pointer",
  minWidth: 160,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--muted)",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};
