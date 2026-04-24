import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function SellerLayout() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "280px 1fr" }}>
      <aside style={{ padding: 18 }}>
        <div
          className="card cardPad"
          style={{
            height: "calc(100vh - 36px)",
            position: "sticky",
            top: 18,
            display: "flex",
            flexDirection: "column",
            background: "linear-gradient(168deg, rgba(22, 10, 55, 0.97) 0%, rgba(9, 7, 26, 0.98) 100%)",
            borderColor: "rgba(124, 92, 255, 0.28)",
          }}
        >
          <div className="col" style={{ gap: 6 }}>
            <div className="badge">SportVault • Seller</div>
            <div className="h2">Seller Hub</div>

            {user && (
              <div className="muted" style={{ fontSize: 12 }}>
                {user.firstName} {user.lastName}
              </div>
            )}

            <div className="muted" style={{ fontSize: 13 }}>
              Manage your approved listings, pricing, inventory, and product images.
            </div>
          </div>

          <div className="divider" />

          <nav className="col" style={{ gap: 8 }}>
            <NavItem to="/seller">Dashboard</NavItem>
            <NavItem to="/seller/profile">Account Profile</NavItem>
            <NavItem to="/seller/inventory">Inventory</NavItem>
            <NavItem to="/seller/returns">Returns</NavItem>
            <NavItem to="/seller/trades">Trades</NavItem>
            <NavItem to="/seller/wallet">Wallet &amp; Withdraw</NavItem>
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
          <div className="card cardPad">
            <div className="h1">Seller Portal</div>
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
      style={({ isActive }) => ({
        padding: "10px 14px",
        borderRadius: 10,
        border: isActive
          ? "1px solid rgba(124, 92, 255, 0.50)"
          : "1px solid rgba(255, 255, 255, 0.14)",
        background: isActive
          ? "linear-gradient(135deg, rgba(124, 92, 255, 0.32), rgba(124, 92, 255, 0.18))"
          : "rgba(255, 255, 255, 0.06)",
        color: isActive ? "#fff" : "rgba(255, 255, 255, 0.82)",
        fontWeight: 600,
        fontSize: 13,
        transition: "all 120ms ease",
        display: "block",
      })}
    >
      {children}
    </NavLink>
  );
}
