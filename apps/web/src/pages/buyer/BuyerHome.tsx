/**
 * @fileoverview BuyerHome — Browse Products with 3×4 pagination
 * @module pages/buyer/BuyerHome.tsx
 * @author Darrell Hobson
 * @Date 2026.04.24
 */
import { useEffect, useState } from "react";
import { useNavigate }          from "react-router-dom";
import { addToCart, getActiveProducts, Product } from "../../services/api";
import { useCompare }           from "../../context/CompareContext";

const TILES_PER_ROW = 4;
const ROWS_PER_PAGE = 3;
const PAGE_SIZE     = TILES_PER_ROW * ROWS_PER_PAGE; // 12

const STATUS_COLOR: Record<string, string> = {
  active:    "#22c55e",
  suspended: "#ef4444",
  open:      "#93c5fd",
};

export default function BuyerHome() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [search,   setSearch]   = useState("");
  const [page,     setPage]     = useState(1);
  const [toast,    setToast]    = useState<string | null>(null);

  const { compareList, addToCompare, removeFromCompare, isInCompare } = useCompare();
  const navigate = useNavigate();

  useEffect(() => {
    getActiveProducts()
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load products."))
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function handleAddToCart(product: Product) {
    try {
      await addToCart(product);
      window.dispatchEvent(new CustomEvent("cartUpdated"));
      showToast(`${product.name} added to cart`);
    } catch {
      showToast("Failed to add item to cart");
    }
  }

  function handleCompareToggle(product: Product) {
    if (isInCompare(product.id)) {
      removeFromCompare(product.id);
    } else if (compareList.length >= 4) {
      showToast("You can compare up to 4 products at a time");
    } else {
      addToCompare(product);
    }
  }

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageItems  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset page when search changes
  useEffect(() => { setPage(1); }, [search]);

  if (loading) {
    return (
      <div className="card cardPad" style={{ textAlign: "center", padding: 48 }}>
        <div className="muted">Loading products…</div>
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 16 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 9999,
          background: "rgba(124,92,255,0.95)", color: "#fff",
          padding: "12px 20px", borderRadius: 10, fontWeight: 600,
          fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,.4)", pointerEvents: "none",
        }}>
          {toast}
        </div>
      )}

      {/* Header + search */}
      <div className="card cardPad">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div className="h2" style={{ fontWeight: 800 }}>🛍 Browse Products</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              {filtered.length} product{filtered.length !== 1 ? "s" : ""} available
              &nbsp;·&nbsp; Page {safePage} of {totalPages}
            </div>
          </div>
          <input
            className="input"
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 240 }}
          />
        </div>
      </div>

      {error && (
        <div style={{
          padding: "10px 16px", borderRadius: 10, fontSize: 13,
          background: "rgba(239,68,68,0.12)", color: "#fca5a5",
          border: "1px solid rgba(239,68,68,0.3)",
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Product grid — 4 columns × 3 rows */}
      {filtered.length === 0 ? (
        <div className="card cardPad" style={{ textAlign: "center", padding: 48 }}>
          <div className="muted">No products match your search.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {pageItems.map((product) => {
            const inCompare  = isInCompare(product.id);
            const outOfStock = product.quantity === 0;

            return (
              <div
                key={product.id}
                className="card cardPad"
                style={{
                  display: "flex", flexDirection: "column", gap: 10,
                  outline: inCompare ? "2px solid rgba(124,92,255,0.8)" : "none",
                  transition: "transform .15s, box-shadow .15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(0,0,0,.4)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = "";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "";
                }}
              >
                {/* Product image */}
                <div style={{ position: "relative" }}>
                  <img
                    src={product.imageUrl || "/images/default-product.png"}
                    alt={product.name}
                    style={{
                      width: "100%", height: 160, objectFit: "contain",
                      borderRadius: 8, background: "rgba(0,0,0,0.3)", padding: 6,
                      display: "block",
                    }}
                  />
                  {outOfStock && (
                    <div style={{
                      position: "absolute", top: 8, left: 8,
                      background: "rgba(239,68,68,0.85)", color: "#fff",
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                    }}>
                      OUT OF STOCK
                    </div>
                  )}
                </div>

                {/* Name + description */}
                <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>
                  {product.name}
                </div>
                {product.shortDesc && (
                  <div className="muted" style={{
                    fontSize: 12, lineHeight: 1.5,
                    overflow: "hidden", textOverflow: "ellipsis",
                    display: "-webkit-box", WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}>
                    {product.shortDesc}
                  </div>
                )}

                {/* Price + stock */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 800, fontSize: 16, color: "#22c55e" }}>
                    ${Number(product.unitPrice).toFixed(2)}
                  </span>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {outOfStock ? "Out of stock" : `${product.quantity} in stock`}
                  </span>
                </div>

                {/* Spacer pushes buttons to bottom */}
                <div style={{ flex: 1 }} />

                {/* Add to cart */}
                {outOfStock ? (
                  <button className="btn" disabled style={{ opacity: 0.5 }}>
                    Out of Stock
                  </button>
                ) : (
                  <button
                    className="btn btnPrimary"
                    onClick={() => handleAddToCart(product)}
                  >
                    Add to Cart
                  </button>
                )}

                {/* Compare toggle */}
                <button
                  className="btn"
                  style={{
                    background: inCompare ? "rgba(124,92,255,0.25)" : "rgba(255,255,255,0.06)",
                    color:      inCompare ? "rgba(124,92,255,1)"    : "rgba(255,255,255,0.7)",
                    border:     inCompare ? "1px solid rgba(124,92,255,0.6)" : "1px solid rgba(255,255,255,0.12)",
                    fontSize: 12,
                  }}
                  onClick={() => handleCompareToggle(product)}
                >
                  {inCompare ? "✓ In Compare" : "+ Compare"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
          <button
            className="btn"
            style={{ padding: "10px 22px", fontSize: 18, fontWeight: 700, opacity: safePage <= 1 ? 0.3 : 1 }}
            disabled={safePage <= 1}
            onClick={() => setPage((p) => p - 1)}
          >←</button>

          <div style={{ display: "flex", gap: 6 }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(Math.max(0, safePage - 3), Math.min(totalPages, safePage + 2))
              .map((p) => (
              <button
                key={p} className="btn"
                style={{
                  padding: "8px 14px", fontSize: 13, minWidth: 40,
                  fontWeight: p === safePage ? 800 : 500,
                  background: p === safePage
                    ? "linear-gradient(135deg,rgba(124,92,255,0.55),rgba(124,92,255,0.25))"
                    : "rgba(255,255,255,0.05)",
                  borderColor: p === safePage ? "rgba(124,92,255,0.5)" : "rgba(255,255,255,0.1)",
                  color: p === safePage ? "#c4b5fd" : "rgba(255,255,255,0.6)",
                }}
                onClick={() => setPage(p)}
              >{p}</button>
            ))}
          </div>

          <button
            className="btn"
            style={{ padding: "10px 22px", fontSize: 18, fontWeight: 700, opacity: safePage >= totalPages ? 0.3 : 1 }}
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >→</button>
        </div>
      )}

      <div style={{ textAlign: "center" }}>
        <span className="muted" style={{ fontSize: 12 }}>
          Showing {pageItems.length} of {filtered.length} products &nbsp;·&nbsp; Page {safePage} of {totalPages}
        </span>
      </div>

      {/* Floating compare bar */}
      {compareList.length > 0 && (
        <div style={{
          position: "fixed", bottom: 0, left: 280, right: 0,
          background: "rgba(18,18,18,0.97)", borderTop: "1px solid rgba(124,92,255,0.4)",
          padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, zIndex: 1000,
        }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "rgba(255,255,255,0.8)", whiteSpace: "nowrap" }}>
            Compare ({compareList.length}/4):
          </div>
          <div style={{ display: "flex", gap: 10, flex: 1, overflow: "hidden" }}>
            {compareList.map((p: Product) => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(124,92,255,0.15)", border: "1px solid rgba(124,92,255,0.4)",
                borderRadius: 8, padding: "4px 10px", fontSize: 13, whiteSpace: "nowrap",
              }}>
                <img src={p.imageUrl || "/images/default-product.png"} alt={p.name}
                  style={{ width: 28, height: 28, objectFit: "contain", borderRadius: 4 }} />
                <span>{p.name}</span>
                <button
                  style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)",
                    cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 16 }}
                  onClick={() => removeFromCompare(p.id)} title="Remove"
                >×</button>
              </div>
            ))}
          </div>
          {compareList.length >= 2 && (
            <button className="btn btnPrimary" style={{ whiteSpace: "nowrap" }}
              onClick={() => navigate("/buyer/compare")}>
              Compare Now
            </button>
          )}
        </div>
      )}
      {compareList.length > 0 && <div style={{ height: 64 }} />}
    </div>
  );
}
