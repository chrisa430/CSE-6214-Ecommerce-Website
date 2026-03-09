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
        <div className="card cardPad" style={{ height: "calc(100vh - 36px)", position: "sticky", top: 18, display: "flex", flexDirection: "column" }}>
          <div className="col" style={{ gap: 6 }}>
            <div className="badge">SportVault • Seller</div>
            <div className="h2">Seller Hub</div>
            {user && (
              <div className="muted" style={{ fontSize: 12 }}>
                {user.firstName} {user.lastName}
              </div>
            )}
            <div className="muted" style={{ fontSize: 13 }}>
              Manage listings, orders, and payouts.
            </div>
          </div>

          <div className="divider" />

          <nav className="col" style={{ gap: 10 }}>
            <NavItem to="/seller">Dashboard</NavItem>
            <NavItem to="/seller/inventory">Inventory</NavItem>
            <NavItem to="/seller/subpage">Seller Actions</NavItem>
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
          <div className="card cardPad" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div className="h1">Seller Portal</div>
            <button className="btn" onClick={() => navigate("/seller")}>Refresh</button>
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
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        background: isActive ? "rgba(124, 92, 255, 0.18)" : "rgba(255,255,255,0.04)",
        color: "rgba(255,255,255,0.92)",
        fontWeight: 600,
        fontSize: 13,
      })}
    >
      {children}
    </NavLink>
  );
}

