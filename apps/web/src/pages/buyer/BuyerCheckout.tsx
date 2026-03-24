import { useEffect, useState } from "react";
import { checkout, getCart, CartItem } from "../../services/api";

export default function BuyerCheckout() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [error, setError] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");

  const [cardNumber, setCardNumber] = useState("");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");

  useEffect(() => {
    async function loadCart() {
      try {
        const data = await getCart();
        setItems(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load cart");
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
      await checkout();

      alert("✅ Order placed successfully!");

      // optional: redirect later
      window.location.href = "/buyer/orders";
    } catch (err) {
      console.error(err);
      setError("Checkout failed");
    }
  }

  return (
    <div className="col" style={{ gap: 20 }}>
      <div className="card cardPad">
        <div className="h2">Checkout</div>
      </div>

      {error && <div className="card cardPad">{error}</div>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 20,
        }}
      >
        {/* LEFT SIDE */}
        <div className="col" style={{ gap: 16 }}>
          {/* SHIPPING */}
          <div className="card cardPad">
            <div className="h2">Shipping Information</div>

            <input className="input" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="input" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
            <input className="input" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />

            <div className="row" style={{ gap: 10 }}>
              <input className="input" placeholder="State" value={state} onChange={(e) => setState(e.target.value)} />
              <input className="input" placeholder="Zip Code" value={zip} onChange={(e) => setZip(e.target.value)} />
            </div>
          </div>

          {/* PAYMENT */}
          <div className="card cardPad">
            <div className="h2">Payment Information</div>

            <input
              className="input"
              placeholder="Card Number"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
            />

            <div className="row" style={{ gap: 10 }}>
              <input
                className="input"
                placeholder="MM/YY"
                value={exp}
                onChange={(e) => setExp(e.target.value)}
              />
              <input
                className="input"
                placeholder="CVV"
                value={cvv}
                onChange={(e) => setCvv(e.target.value)}
              />
            </div>

            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              * This is a simulated payment. No real transaction occurs.
            </div>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="card cardPad">
          <div className="h2">Order Summary</div>

          <div style={{ marginTop: 10 }}>
            {items.map((item) => (
              <div
                key={item.productId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div>
                  {item.name || "Item"} x{item.quantity}
                </div>
                <div>
                  ${(Number(item.unitPrice) * item.quantity).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <div className="divider" />

          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>

          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>Tax</span>
            <span>${tax.toFixed(2)}</span>
          </div>

          <div className="row" style={{ justifyContent: "space-between", fontWeight: 700 }}>
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>

          <button
            className="btn btnPrimary"
            style={{ marginTop: 20, width: "100%" }}
            onClick={handleCheckout}
          >
            Place Order
          </button>
        </div>
      </div>
    </div>
  );
}