import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getSellerSales, SellerSale } from "../../services/api";

export default function SellerHome() {
  const { user } = useAuth();
  const [sales, setSales] = useState<SellerSale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSellerSales()
      .then((data) => setSales(Array.isArray(data) ? data : []))
      .catch(() => setSales([]))
      .finally(() => setLoading(false));
  }, []);

  const totalRevenue   = sales.reduce((sum, s) => sum + Number(s.lineTotal), 0);
  const totalUnitsSold = sales.reduce((sum, s) => sum + s.quantity, 0);
  const uniqueOrders   = new Set(sales.map((s) => s.orderId)).size;
  const recentSales    = sales.slice(0, 10);

  const STATUS_COLORS: Record<string, string> = {
    delivered: "rgba(50,200,100,0.9)",
    confirmed: "rgba(80,160,255,0.9)",
    shipped:   "rgba(160,120,255,0.9)",
    pending:   "rgba(255,200,50,0.9)",
    cancelled: "rgba(255,80,80,0.9)",
    refunded:  "rgba(150,150,150,0.9)",
  };

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="card cardPad">
        <div className="h2">Welcome{user ? `, ${user.firstName}` : ""}!</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Your seller dashboard — track earnings, manage inventory, and handle returns.
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
        <KpiCard
          label="Total Earnings"
          value={loading ? "—" : `$${totalRevenue.toFixed(2)}`}
          sub="gross revenue from all sales"
          accent="rgba(50,200,100,0.12)"
          border="rgba(50,200,100,0.35)"
        />
        <KpiCard
          label="Units Sold"
          value={loading ? "—" : String(totalUnitsSold)}
          sub="items across all orders"
          accent="rgba(124,92,255,0.12)"
          border="rgba(124,92,255,0.35)"
        />
        <KpiCard
          label="Orders"
          value={loading ? "—" : String(uniqueOrders)}
          sub="orders containing your items"
          accent="rgba(80,160,255,0.12)"
          border="rgba(80,160,255,0.35)"
        />
        <KpiCard
          label="Inventory"
          value=""
          sub={<Link to="/seller/inventory" style={{ color: "rgba(124,92,255,0.9)", fontSize: 13, fontWeight: 600 }}>Manage listings →</Link>}
          accent="rgba(255,200,50,0.08)"
          border="rgba(255,200,50,0.25)"
        />
      </div>

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
        <QuickAction to="/seller/inventory" label="Inventory Manager"
          desc="Add, edit, and price your listings." />
        <QuickAction to="/seller/returns" label="Returns"
          desc="Review and action buyer return requests." />
        <QuickAction to="/seller/trades" label="Trades"
          desc="Propose and accept seller-to-seller swaps." />
      </div>

      {/* Recent sales */}
      <div className="card cardPad">
        <div className="h2" style={{ marginBottom: 14 }}>Recent Sales</div>

        {loading ? (
          <div className="muted">Loading sales…</div>
        ) : recentSales.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>
            No sales yet. Your earnings will appear here once a buyer purchases one of your products.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>You Earned</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentSales.map((sale) => (
                <tr key={sale.itemId}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <img
                        src={sale.imageUrl || "/images/default-product.png"}
                        alt={sale.productName}
                        style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 6, background: "#181717" }}
                      />
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{sale.productName}</span>
                    </div>
                  </td>
                  <td>{sale.quantity}</td>
                  <td>${Number(sale.unitPrice).toFixed(2)}</td>
                  <td style={{ fontWeight: 700, color: "rgba(50,200,100,0.9)" }}>
                    ${Number(sale.lineTotal).toFixed(2)}
                  </td>
                  <td style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                    {new Date(sale.orderDate).toLocaleDateString()}
                  </td>
                  <td>
                    <span style={{
                      background: STATUS_COLORS[sale.orderStatus] ?? "rgba(180,180,180,0.8)",
                      color: "#000",
                      borderRadius: 6,
                      padding: "2px 8px",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "capitalize",
                    }}>
                      {sale.orderStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {sales.length > 10 && (
          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Showing 10 of {sales.length} sales.
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, accent, border }: {
  label: string;
  value: string;
  sub: React.ReactNode;
  accent: string;
  border: string;
}) {
  return (
    <div style={{ background: accent, border: `1px solid ${border}`, borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.8 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 4px" }}>{value}</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{sub}</div>
    </div>
  );
}

function QuickAction({ to, label, desc }: { to: string; label: string; desc: string }) {
  return (
    <div className="card cardPad col" style={{ gap: 8 }}>
      <div className="h2" style={{ fontSize: 15 }}>{label}</div>
      <div className="muted" style={{ fontSize: 12, flex: 1 }}>{desc}</div>
      <Link className="btn btnPrimary" to={to} style={{ fontSize: 13, textAlign: "center" }}>
        Open
      </Link>
    </div>
  );
}
