/**
 * @fileoverview Admin Product Detail page
 * @module AdminProductDetail.tsx
 * @author Darrell Hobson
 * @Date 2026.03.10
 *
 * Displays all columns for a single product record.
 * Reached by clicking the product ID link on AdminProducts.tsx.
 */
import { useState, useEffect }  from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth }              from "../../context/AuthContext";
import {
  fetchProductDetail,
  ProductDetail,
  extractApiError,
} from "../../services/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(val: string | null | undefined): string {
  if (!val) return "—";
  return new Date(val).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function BoolBadge({ value }: { value: boolean }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 700,
      background: value ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.07)",
      color: value ? "#22c55e" : "rgba(255,255,255,0.4)",
    }}>
      {value ? "Yes" : "No"}
    </span>
  );
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
      display: "inline-block", padding: "3px 12px", borderRadius: 20,
      fontSize: 12, fontWeight: 700, textTransform: "capitalize",
      background: c.bg, color: c.fg,
    }}>
      {status}
    </span>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.06em", color: "var(--muted)",
      }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.9)", wordBreak: "break-all" }}>
        {value ?? <span style={{ color: "var(--muted)" }}>—</span>}
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card cardPad">
      <div className="h2" style={{ marginBottom: 12 }}>{title}</div>
      <div className="divider" style={{ marginBottom: 16 }} />
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "16px 24px",
      }}>
        {children}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminProductDetail() {
  const { id }   = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (user !== null && user.type !== "admin") navigate("/login", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchProductDetail(id)
      .then(setProduct)
      .catch((err) => setError(extractApiError(err)))
      .finally(() => setLoading(false));
  }, [id]);

  if (!user || user.type !== "admin") {
    return (
      <div className="card cardPad" style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 44 }}>🚫</div>
        <div className="h2" style={{ marginTop: 14 }}>Access Denied</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card cardPad" style={{ textAlign: "center", padding: 40 }}>
        <p className="muted">Loading product…</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="card cardPad" style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 44 }}>⚠️</div>
        <div className="h2" style={{ marginTop: 14 }}>Product Not Found</div>
        <p className="muted">{error ?? "This product does not exist."}</p>
        <Link className="btn" to="/admin/products" style={{ marginTop: 14 }}>
          ← Back to Product Inventory
        </Link>
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 16 }}>

      {/* Page header */}
      <div className="card cardPad">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div className="col" style={{ gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Link
                to="/admin/products"
                style={{ fontSize: 13, color: "rgba(124,92,255,0.9)", textDecoration: "none" }}
              >
                ← Product Inventory
              </Link>
            </div>
            <div className="h2">{product.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <StatusBadge status={product.status} />
              <span className="muted" style={{ fontSize: 12 }}>
                Listed {fmtDate(product.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Identity */}
      <SectionCard title="Identity">
        <Field label="Product ID"   value={<span style={{ fontFamily: "monospace", fontSize: 12 }}>{product.id}</span>} />
        <Field label="Name"         value={product.name} />
        <Field label="Short Desc"   value={product.shortDesc} />
        <Field label="Status"       value={<StatusBadge status={product.status} />} />
        <Field label="Quantity"     value={product.quantity} />
        <Field label="Created At"   value={fmtDate(product.createdAt)} />
        <Field label="Updated At"   value={fmtDate(product.updatedAt)} />
      </SectionCard>

      {/* Description */}
      {product.longDesc && (
        <div className="card cardPad">
          <div className="h2" style={{ marginBottom: 12 }}>Description</div>
          <div className="divider" style={{ marginBottom: 16 }} />
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.6, margin: 0 }}>
            {product.longDesc}
          </p>
        </div>
      )}

      {/* Classification */}
      <SectionCard title="Classification">
        <Field label="Category"      value={product.category} />
        <Field label="Category Code" value={product.categoryCode} />
        <Field label="Subcategory"   value={product.subcategory} />
        <Field label="Subcat. Code"  value={product.subcategoryCode} />
        <Field label="Gender"        value={product.gender} />
        <Field label="Team"          value={product.teamName} />
        <Field label="Player"        value={product.playerName} />
        <Field label="Condition"     value={product.condition} />
      </SectionCard>

      {/* Attributes */}
      <SectionCard title="Attributes">
        <Field label="Signed"          value={<BoolBadge value={product.isSigned} />} />
        <Field label="Authenticated"   value={<BoolBadge value={product.isAuthenticated} />} />
        <Field label="Framed"          value={<BoolBadge value={product.isFramed} />} />
        <Field label="Has Inscription" value={<BoolBadge value={product.hasInscription} />} />
        {product.hasInscription && (
          <Field label="Inscription Text" value={product.inscriptionText} />
        )}
        <Field label="Multi-Signature" value={<BoolBadge value={product.hasMultiSigs} />} />
        <Field label="Protected"       value={<BoolBadge value={product.isProtected} />} />
        {product.isProtected && (
          <Field label="Protection Type" value={product.protectionType} />
        )}
      </SectionCard>

      {/* Seller */}
      <SectionCard title="Seller">
        <Field label="Seller ID"    value={<span style={{ fontFamily: "monospace", fontSize: 12 }}>{product.sellerId}</span>} />
        <Field label="First Name"   value={product.sellerFirstName} />
        <Field label="Last Name"    value={product.sellerLastName} />
        <Field label="Email"        value={product.sellerEmail} />
      </SectionCard>

      {/* Images */}
      {(product.images ?? []).length > 0 && (
        <div className="card cardPad">
          <div className="h2" style={{ marginBottom: 12 }}>Product Images</div>
          <div className="divider" style={{ marginBottom: 16 }} />
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Image ID</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>URL</th>
                  <th>Primary</th>
                </tr>
              </thead>
              <tbody>
                {(product.images ?? []).map((img, idx) => (
                  <tr key={img.id}>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{img.sortOrder ?? idx + 1}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 11 }}>{img.id}</td>
                    <td>{img.name ?? "—"}</td>
                    <td>{img.shortDesc ?? "—"}</td>
                    <td>
                      <a
                        href={img.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "rgba(124,92,255,0.9)", fontSize: 12 }}
                      >
                        {img.imageUrl.length > 50 ? img.imageUrl.slice(0, 50) + "…" : img.imageUrl}
                      </a>
                    </td>
                    <td><BoolBadge value={img.isPrimary} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Back button */}
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <Link className="btn" to="/admin/products">
          ← Back to Product Inventory
        </Link>
      </div>
    </div>
  );
}
