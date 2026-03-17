import { getCart, removeFromCart, CartItem } from "../../services/api";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function BuyerCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(getCart());
  }, []);

  function handleRemove(productId: string) {
    removeFromCart(productId);
    setItems(getCart());
  }

  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="card cardPad">
        <div className="h2">Shopping Cart</div>
      </div>

      {items.length === 0 ? (
        <div className="card cardPad">Your cart is empty.</div>
      ) : (
        <>
          <div className="card cardPad">
            <table className="table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.productId}>
                    <td>
                      <img
                        src={item.imageUrl || "/images/default-product.png"}
                        alt={item.name}
                        style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6 }}
                      />
                    </td>
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    <td>${Number(item.unitPrice).toFixed(2)}</td>
                    <td>${Number(item.unitPrice * item.quantity).toFixed(2)}</td>
                    <td>
                      <button
                        className="btn btnDanger"
                        onClick={() => handleRemove(item.productId)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card cardPad">
            <div className="h2">Subtotal: ${subtotal.toFixed(2)}</div>

            <div style={{ marginTop: 12 }}>
                <Link className="btn btnPrimary" to="/buyer/checkout">
                Proceed to Checkout
                </Link>
            </div>
         </div>
        </>
      )}
    </div>
  );
}