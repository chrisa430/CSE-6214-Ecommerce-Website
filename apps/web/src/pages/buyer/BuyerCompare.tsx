import { useNavigate } from "react-router-dom";
import { addToCart, Product } from "../../services/api";
import { useCompare } from "../../context/CompareContext";
import { useState } from "react";

const ROWS: { label: string; key: keyof Product; format?: (v: unknown) => string }[] = [
  { label: "Price",        key: "unitPrice",  format: (v) => `$${Number(v).toFixed(2)}` },
  { label: "Availability", key: "quantity",   format: (v) => (Number(v) > 0 ? `In stock (${v})` : "Out of stock") },
  { label: "Description",  key: "shortDesc",  format: (v) => (v as string) || "—" },
  { label: "Details",      key: "longDesc",   format: (v) => (v as string) || "—" },
];

export default function BuyerCompare() {
  const navigate = useNavigate();
  const { compareList, removeFromCompare, clearCompare } = useCompare();
  const [toast, setToast] = useState<string | null>(null);

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

  if (compareList.length === 0) {
    return (
      <div className="col" style={{ gap: 16 }}>
        <div className="card cardPad">
          <div className="h2">Compare Products</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            No products selected for comparison.
          </div>
          <button
            className="btn btnPrimary"
            style={{ marginTop: 14, width: "fit-content" }}
            onClick={() => navigate("/buyer")}
          >
            Browse Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 16 }}>
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

      <div className="card cardPad" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div className="h2">Compare Products</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Comparing {compareList.length} product{compareList.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn" onClick={() => navigate("/buyer")}>
            Back to Browse
          </button>
          <button className="btn btnDanger" onClick={clearCompare}>
            Clear All
          </button>
        </div>
      </div>

      <div className="card cardPad" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
          <colgroup>
            <col style={{ width: 130 }} />
            {compareList.map((p) => <col key={p.id} />)}
          </colgroup>

          {/* Product header row */}
          <thead>
            <tr>
              <th style={thStyle}></th>
              {compareList.map((product) => (
                <th key={product.id} style={{ ...thStyle, textAlign: "center", verticalAlign: "top" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "8px 0" }}>
                    <img
                      src={product.imageUrl || "/images/default-product.png"}
                      alt={product.name}
                      style={{
                        width: 120,
                        height: 120,
                        objectFit: "contain",
                        borderRadius: 8,
                        background: "#181717",
                        padding: 6,
                      }}
                    />
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{product.name}</div>
                    <button
                      style={{
                        background: "none",
                        border: "1px solid rgba(255,255,255,0.15)",
                        color: "rgba(255,255,255,0.45)",
                        borderRadius: 6,
                        padding: "2px 10px",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                      onClick={() => removeFromCompare(product.id)}
                    >
                      Remove
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {ROWS.map(({ label, key, format }) => (
              <tr key={key}>
                <td style={labelCellStyle}>{label}</td>
                {compareList.map((product) => {
                  const raw = product[key];
                  const display = format ? format(raw) : (raw ?? "—");
                  return (
                    <td key={product.id} style={valueCellStyle}>
                      {String(display)}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Add to Cart row */}
            <tr>
              <td style={labelCellStyle}>Action</td>
              {compareList.map((product) => (
                <td key={product.id} style={{ ...valueCellStyle, textAlign: "center" }}>
                  {product.quantity === 0 ? (
                    <button className="btn" disabled>Out of Stock</button>
                  ) : (
                    <button
                      className="btn btnPrimary"
                      onClick={() => handleAddToCart(product)}
                    >
                      Add to Cart
                    </button>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
  color: "rgba(255,255,255,0.92)",
  fontWeight: 600,
  textAlign: "left",
};

const labelCellStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderBottom: "1px solid rgba(255,255,255,0.07)",
  color: "rgba(255,255,255,0.5)",
  fontSize: 13,
  fontWeight: 600,
  whiteSpace: "nowrap",
  verticalAlign: "top",
};

const valueCellStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderBottom: "1px solid rgba(255,255,255,0.07)",
  color: "rgba(255,255,255,0.85)",
  fontSize: 13,
  verticalAlign: "top",
  textAlign: "center",
};
