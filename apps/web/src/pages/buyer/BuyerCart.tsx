import { Link } from "react-router-dom";
import { getCart, removeFromCart, CartItem, getActiveProducts, Product } from "../../services/api";
import { useEffect, useState } from "react";

export default function BuyerCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [cartItems, activeProducts] = await Promise.all([
          getCart(),
          getActiveProducts(),
        ]);

        setItems(Array.isArray(cartItems) ? cartItems : []);
        setProducts(Array.isArray(activeProducts) ? activeProducts : []);
      } catch (err) {
        console.error(err);
        setError("Failed to load cart.");
      }
    }

    loadData();
  }, []);

  function enrichCartItem(item: CartItem) {
    const product = products.find((p) => p.id === item.productId);

    return {
      ...item,
      name: product?.name || item.name || "Product",
      imageUrl: product?.imageUrl || item.imageUrl || "/images/default-product.png",
    };
  }

  async function handleRemove(productId: string) {
    try {
      await removeFromCart(productId);
      setItems((prev) => prev.filter((item) => item.productId !== productId));
    } catch (err) {
      console.error(err);
      setError("Failed to remove item from cart.");
    }
  }

  const subtotal = items.reduce(
    (sum, item) => sum + (item.unitPrice ?? 0) * item.quantity,
    0
  );

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="card cardPad">
        <div className="h2">Shopping Cart</div>
      </div>

      {error && <div className="card cardPad">{error}</div>}

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
                {items.map((item) => {
                  const fullItem = enrichCartItem(item);

                  return (
                    <tr key={item.productId}>
                      <td>
                        <img
                          src={fullItem.imageUrl}
                          alt={fullItem.name}
                          style={{ width: 60, height: 60, objectFit: "contain", borderRadius: 6 }}
                        />
                      </td>
                      <td>{fullItem.name}</td>
                      <td>{item.quantity}</td>
                      <td>${Number(item.unitPrice).toFixed(2)}</td>
                      <td>${Number((item.unitPrice ?? 0) * item.quantity).toFixed(2)}</td>
                      <td>
                        <button
                          className="btn btnDanger"
                          onClick={() => handleRemove(item.productId)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
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