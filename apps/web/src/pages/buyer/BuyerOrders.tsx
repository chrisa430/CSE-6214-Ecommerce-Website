import { useEffect, useState } from "react";
import { getMyOrders, Order, getActiveProducts, Product } from "../../services/api";

export default function BuyerOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOrders() {
      try {
        const [orderData, productData] = await Promise.all([
          getMyOrders(),
          getActiveProducts(),
        ]);

        setOrders(Array.isArray(orderData) ? orderData : []);
        setProducts(Array.isArray(productData) ? productData : []);
      } catch (err) {
        console.error(err);
        setError("Failed to load orders.");
      }
    }

    loadOrders();
  }, []);

  function getProduct(productId: string) {
    return products.find((p) => p.id === productId);
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="card cardPad">
        <div className="h2">Order History</div>
      </div>

      {error && <div className="card cardPad">{error}</div>}

      {orders.length === 0 ? (
        <div className="card cardPad">No orders yet.</div>
      ) : (
        orders.map((order) => (
          <div key={order.id} className="card cardPad">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <div className="h2">Order #{order.id.slice(0, 8)}</div>
                <div className="muted">
                  {new Date(order.createdAt).toLocaleString()}
                </div>
              </div>

              <div className="h2">${Number(order.total).toFixed(2)}</div>
            </div>

            <div style={{ marginTop: 10, fontSize: 13 }}>
              {order.items.length} item{order.items.length !== 1 ? "s" : ""}
            </div>

            <div className="divider" />

            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {order.items.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <img
                          src={
                            getProduct(item.productId)?.imageUrl ||
                            "/images/default-product.png"
                          }
                          alt={getProduct(item.productId)?.name || "Product"}
                          style={{
                            width: 40,
                            height: 40,
                            objectFit: "contain",
                            borderRadius: 6,
                            background: "#181717",
                            padding: 4,
                          }}
                        />
                        <div>
                          {getProduct(item.productId)?.name || "Product"}
                        </div>
                      </div>
                    </td>
                    <td>{item.quantity}</td>
                    <td>${Number(item.unitPrice).toFixed(2)}</td>
                    <td>${(Number(item.unitPrice) * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}