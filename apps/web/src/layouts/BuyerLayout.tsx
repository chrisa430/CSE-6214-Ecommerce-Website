import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useCompare } from "../context/CompareContext";
import { getCart } from "../services/api";

export default function BuyerLayout() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { compareList } = useCompare();
  const [cartCount, setCartCount] = useState(0);

  async function refreshCartCount() {
    try {
      const items = await getCart();
      setCartCount(Array.isArray(items) ? items.length : 0);
    } catch {
      // silently ignore — cart count is non-critical
    }
  }

  useEffect(() => {
    refreshCartCount();
    const handler = () => refreshCartCount();
    window.addEventListener("cartUpdated", handler);
    return () => window.removeEventListener("cartUpdated", handler);
  }, []);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "280px 1fr" }}>
      <aside style={{ padding: 18 }}>
        <div className="card cardPad" style={{ height: "calc(100vh - 36px)", position: "sticky", top: 18 }}>
          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <div className="col" style={{ gap: 6 }}>
              <div className="badge">SportVault • Buyer</div>
              <div className="h2">User Account</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Browse approved products, manage your cart, and review checkout totals.
              </div>
            </div>
          </div>

          <div className="divider" />

          <nav className="col" style={{ gap: 10 }}>
            <NavItem to="/buyer/profile">Account Profile</NavItem>
            <NavItem to="/buyer">Browse Products</NavItem>
            <NavItem to="/buyer/cart">
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                Shopping Cart
                {cartCount > 0 && (
                  <span
                    style={{
                      background: "rgba(124,92,255,0.9)",
                      color: "#fff",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "1px 7px",
                      minWidth: 20,
                      textAlign: "center",
                    }}
                  >
                    {cartCount}
                  </span>
                )}
              </span>
            </NavItem>
            <NavItem to="/buyer/checkout">Checkout</NavItem>
            <NavItem to="/buyer/orders">Order History</NavItem>
            <NavItem to="/buyer/returns">Returns</NavItem>
            <NavItem to="/buyer/compare">
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                Compare Products
                {compareList.length > 0 && (
                  <span
                    style={{
                      background: "rgba(124,92,255,0.9)",
                      color: "#fff",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "1px 7px",
                      minWidth: 20,
                      textAlign: "center",
                    }}
                  >
                    {compareList.length}
                  </span>
                )}
              </span>
            </NavItem>
          </nav>

          <div style={{ flex: 1 }} />

          <div className="divider" />
          <button className="btn btnDanger" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      <main style={{ padding: 18 }}>
        <header className="container" style={{ marginBottom: 14 }}>
          <div
            className="card cardPad"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div className="col" style={{ gap: 4 }}>
              <div className="h1">Buyer Portal</div>
            </div>

            <div className="row" style={{ alignItems: "center" }}>
              <button className="btn" onClick={() => navigate("/buyer")}>
                Refresh
              </button>
            </div>
          </div>
        </header>

        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === "/buyer"}
      style={({ isActive }) => ({
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        background: isActive ? "rgba(124, 92, 255, 0.18)" : "rgba(255,255,255,0.04)",
        color: "rgba(255,255,255,0.92)",
        fontWeight: 600,
        fontSize: 13,
        textDecoration: "none",
        display: "block",
      })}
    >
      {children}
    </NavLink>
  );
}
