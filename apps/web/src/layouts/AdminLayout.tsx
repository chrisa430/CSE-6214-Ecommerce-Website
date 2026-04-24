import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function AdminLayout() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  // Layout-level guard — any route under /admin requires type='admin'
  useEffect(() => {
    if (user !== null && user.type !== "admin") {
      navigate("/login", { replace: true });
    }
  }, [user, navigate]);

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
            <div className="badge">SportVault • Admin</div>
            <div className="h2">Control Center</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Manage users, products, orders, and returns.
            </div>
          </div>

          <div className="divider" />

          <nav className="col" style={{ gap: 8 }}>
            <NavItem to="/admin">Dashboard</NavItem>
            <NavItem to="/admin/subpage">Admin Tools</NavItem>
            <NavItem to="/admin/products">Product Inventory</NavItem>
            <NavItem to="/admin/orders">Order Maintenance</NavItem>
            <NavItem to="/admin/subpage#users">User Management</NavItem>
            <NavItem to="/admin/subpage#approvals">Account Approvals</NavItem>
            <NavItem to="/admin/subpage#returns">Return Facilitation</NavItem>
            <NavItem to="/admin/subpage#audit">Audit Logs</NavItem>
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
            <div className="h1">Admin Portal</div>
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
