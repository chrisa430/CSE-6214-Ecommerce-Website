import { getCart, CartItem } from "../../services/api";
import { useEffect, useState } from "react";

export default function BuyerCheckout() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(getCart());
  }, []);

  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  const tax = subtotal * 0.07;
  const fees = items.length > 0 ? 4.99 : 0;
  const total = subtotal + tax + fees;

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="card cardPad">
        <div className="h2">Checkout</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Review your items and order totals.
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card cardPad">Your cart is empty.</div>
      ) : (
        <>
          <div className="card cardPad">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.productId}>
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    <td>${Number(item.unitPrice).toFixed(2)}</td>
                    <td>${Number(item.unitPrice * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card cardPad">
            <div className="h2" style={{ marginBottom: 12 }}>Order Summary</div>

            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>

            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <span>Tax</span>
              <span>${tax.toFixed(2)}</span>
            </div>

            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <span>Fees</span>
              <span>${fees.toFixed(2)}</span>
            </div>

            <div className="divider" />

            <div
              className="row"
              style={{ justifyContent: "space-between", fontWeight: 700, fontSize: 18 }}
            >
              <span>Final Total</span>
              <span>${total.toFixed(2)}</span>
            </div>

            <div style={{ marginTop: 16 }}>
              <button className="btn btnPrimary" disabled>
                Place Order
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}