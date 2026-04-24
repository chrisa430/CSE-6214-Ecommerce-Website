import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addToCart, getActiveProducts, Product } from "../../services/api";
import { useCompare } from "../../context/CompareContext";
import Pagination from "../../components/Pagination";

const PAGE_SIZE = 12;

export default function BuyerHome() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { compareList, addToCompare, removeFromCompare, isInCompare } = useCompare();
  const navigate = useNavigate();

  useEffect(() => {
    async function loadProducts() {
      try {
        const data = await getActiveProducts();
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setError("Failed to load products.");
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
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
    } catch (err) {
      console.error(err);
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

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE);
  const pageProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) {
    return <div className="card cardPad">Loading products...</div>;
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      {/* Toast notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 9999,
            background: "rgba(124,92,255,0.95)",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 14,
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            pointerEvents: "none",
          }}
        >
          {toast}
        </div>
      )}

      <div className="card cardPad">
        <div className="h2">Browse Products</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          View approved memorabilia available for purchase. Select up to 4 products to compare.
        </div>

        <div style={{ marginTop: 14 }}>
          <input
            className="input"
            type="text"
            placeholder="Search products"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {error && (
          <div style={{ marginTop: 12, color: "red" }}>{error}</div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 20,
        }}
      >
        {pageProducts.map((product) => {
          const inCompare = isInCompare(product.id);
          return (
            <div
              key={product.id}
              className="card cardPad"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                outline: inCompare ? "2px solid rgba(124,92,255,0.8)" : "none",
              }}
            >
              <img
                src={product.imageUrl || "/images/default-product.png"}
                alt={product.name}
                style={{
                  width: "100%",
                  height: 180,
                  objectFit: "contain",
                  borderRadius: 8,
                  background: "#181717",
                  padding: 6,
                  cursor: "pointer",
                }}
                onClick={() => navigate(`/buyer/products/${product.id}`)}
              />

              <div
                className="h2"
                style={{ fontSize: 18, cursor: "pointer" }}
                onClick={() => navigate(`/buyer/products/${product.id}`)}
              >
                {product.name}
              </div>

              <div className="muted" style={{ fontSize: 13 }}>
                {product.shortDesc || "Sports memorabilia listing"}
              </div>

              <div style={{ fontWeight: 700 }}>
                ${Number(product.unitPrice).toFixed(2)}
              </div>

              <div className="muted" style={{ fontSize: 12 }}>
                {product.quantity === 0
                  ? "Out of stock"
                  : `In stock: ${product.quantity}`}
              </div>

              {product.quantity === 0 ? (
                <button className="btn" disabled>
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

              <button
                className="btn"
                style={{ fontSize: 12 }}
                onClick={() => navigate(`/buyer/products/${product.id}`)}
              >
                View Details &amp; Reviews
              </button>

              <button
                className="btn"
                style={{
                  background: inCompare
                    ? "rgba(124,92,255,0.25)"
                    : "rgba(255,255,255,0.06)",
                  color: inCompare ? "rgba(124,92,255,1)" : "rgba(255,255,255,0.7)",
                  border: inCompare
                    ? "1px solid rgba(124,92,255,0.6)"
                    : "1px solid rgba(255,255,255,0.12)",
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

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={filteredProducts.length}
        pageSize={PAGE_SIZE}
        onChange={setPage}
      />

      {/* Floating compare bar */}
      {compareList.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 280,
            right: 0,
            background: "rgba(18,18,18,0.97)",
            borderTop: "1px solid rgba(124,92,255,0.4)",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            zIndex: 1000,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14, color: "rgba(255,255,255,0.8)", whiteSpace: "nowrap" }}>
            Compare ({compareList.length}/4):
          </div>
          <div style={{ display: "flex", gap: 10, flex: 1, overflow: "hidden" }}>
            {compareList.map((p: Product) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(124,92,255,0.15)",
                  border: "1px solid rgba(124,92,255,0.4)",
                  borderRadius: 8,
                  padding: "4px 10px",
                  fontSize: 13,
                  whiteSpace: "nowrap",
                }}
              >
                <img
                  src={p.imageUrl || "/images/default-product.png"}
                  alt={p.name}
                  style={{ width: 28, height: 28, objectFit: "contain", borderRadius: 4 }}
                />
                <span>{p.name}</span>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: "rgba(255,255,255,0.5)",
                    cursor: "pointer",
                    padding: 0,
                    lineHeight: 1,
                    fontSize: 16,
                  }}
                  onClick={() => removeFromCompare(p.id)}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {compareList.length >= 2 && (
            <button
              className="btn btnPrimary"
              style={{ whiteSpace: "nowrap" }}
              onClick={() => navigate("/buyer/compare")}
            >
              Compare Now
            </button>
          )}
        </div>
      )}

      {/* Spacer so cards aren't hidden behind fixed bar */}
      {compareList.length > 0 && <div style={{ height: 64 }} />}
    </div>
  );
}
