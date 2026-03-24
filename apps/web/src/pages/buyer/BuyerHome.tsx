import { useEffect, useState } from "react";
import { addToCart, getActiveProducts, Product } from "../../services/api";

export default function BuyerHome() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

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

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="card cardPad">Loading products...</div>;
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="card cardPad">
        <div className="h2">Browse Products</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          View approved memorabilia available for purchase.
        </div>

        <div style={{ marginTop: 14 }}>
          <input
            className="input"
            type="text"
            placeholder="Search products"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {error && (
          <div style={{ marginTop: 12, color: "red" }}>
            {error}
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 20,
        }}
      >
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            className="card cardPad"
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
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
              }}
            />

            <div className="h2" style={{ fontSize: 18 }}>
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
                onClick={async () => {
                  try {
                    await addToCart(product);
                    alert(`${product.name} added to cart`);
                  } catch (err) {
                    console.error(err);
                    alert("Failed to add item to cart");
                  }
                }}
              >
                Add to Cart
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}