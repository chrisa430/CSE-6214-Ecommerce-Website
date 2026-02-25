import { NavLink, Outlet, useNavigate } from "react-router-dom";

export default function SellerLayout() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "280px 1fr" }}>
      <aside style={{ padding: 18 }}>
        <div className="card cardPad" style={{ height: "calc(100vh - 36px)", position: "sticky", top: 18 }}>
          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <div className="col" style={{ gap: 6 }}>
              <div className="badge">SportVault • Seller</div>
              <div className="h2">Action Page</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Manage account details, inventory, and return requests.
              </div>
            </div>
          </div>

          <div className="divider" />

          <nav className="col" style={{ gap: 10 }}>
            <NavItem to="/seller">Dashboard</NavItem>
            <NavItem to="/seller/subpage">Seller Actions</NavItem>
            <NavItem to="/seller/subpage#account">Account Information</NavItem>
            <NavItem to="/seller/subpage#inventory">Manage Inventory</NavItem>
            <NavItem to="/seller/subpage#audit">Returns</NavItem>
          </nav>

          <div style={{ flex: 1 }} />

          <div className="divider" />
          <button className="btn btnDanger" onClick={() => navigate("/login")}>
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
              <div className="h1">Seller Portal</div>
            </div>

            <div className="row" style={{ alignItems: "center" }}>
              <button className="btn" onClick={() => navigate("/seller")}>
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