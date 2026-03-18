import { useEffect, useState } from "react";
import { getCart, CartItem, checkout } from "../../services/api";
import { useNavigate } from "react-router-dom";

export default function BuyerCheckout() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    async function loadCart() {
      try {
        const data = await getCart();
        setItems(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load cart.");
      } finally {
        setLoading(false);
      }
    }

    loadCart();
  }, []);

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.unitPrice) * item.quantity,
    0
  );

  const tax = subtotal * 0.07;
  const total = subtotal + tax;

  async function handleCheckout() {
    try {
      setProcessing(true);
      setError("");

      const result = await checkout();

      alert(`Order placed! Total: $${Number(result.order.total).toFixed(2)}`);

      // redirect to cart (which will now be empty)
      navigate("/buyer/cart");
    } catch (err: any) {
      console.error(err);

      if (err?.response?.status === 400) {
        setError(err.response.data.error);
      } else {
        setError("Checkout failed.");
      }
    } finally {
      setProcessing(false);
    }
  }

  if (loading) return <div className="card cardPad">Loading checkout...</div>;

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="card cardPad">
        <div className="h2">Checkout</div>
      </div>

      {error && (
        <div className="card cardPad" style={{ color: "red" }}>
          {error}
        </div>
      )}

      <div className="card cardPad">
        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item) => (
              <tr key={item.productId}>
                <td>{item.name || "Product"}</td>
                <td>{item.quantity}</td>
                <td>${Number(item.unitPrice).toFixed(2)}</td>
                <td>${(Number(item.unitPrice) * item.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card cardPad">
        <div>Subtotal: ${subtotal.toFixed(2)}</div>
        <div>Tax (7%): ${tax.toFixed(2)}</div>
        <div className="h2">Total: ${total.toFixed(2)}</div>

        <button
          className="btn btnPrimary"
          style={{ marginTop: 12 }}
          onClick={handleCheckout}
          disabled={processing || items.length === 0}
        >
          {processing ? "Processing..." : "Place Order"}
        </button>
      </div>
    </div>
  );
}