/**
 * @fileoverview Admin Dashboard Home
 * @module AdminHome.tsx
 * @author Darrell Hobson
 * @Date 2026.03.05
 *
 * Admin-only guard — redirects non-admin users to /login.
 */
import { useEffect }    from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth }      from "../../context/AuthContext";

export default function AdminHome() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  // Admin-only guard
  useEffect(() => {
    if (user !== null && user.type !== "admin") {
      navigate("/login", { replace: true });
    }
  }, [user, navigate]);

  if (!user || user.type !== "admin") {
    return (
      <div className="card cardPad" style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 44 }}>🚫</div>
        <div className="h2" style={{ marginTop: 14 }}>Access Denied</div>
        <p className="muted">This page is restricted to administrator accounts.</p>
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <div className="card cardPad kpi">
          <div className="badge">Accounts</div>
          <div className="kpiValue">12</div>
          <div className="kpiHint">Pending approvals </div>
        </div>

        <div className="card cardPad kpi">
          <div className="badge">Products</div>
          <div className="kpiValue">7</div>
          <div className="kpiHint">New listings awaiting review</div>
        </div>

        <div className="card cardPad kpi">
          <div className="badge">Returns</div>
          <div className="kpiValue">3</div>
          <div className="kpiHint">Open return requests</div>
        </div>

        <div className="card cardPad kpi">
          <div className="badge">Audit</div>
          <div className="kpiValue">42</div>
          <div className="kpiHint">Events today </div>
        </div>
      </div>

      <div className="card cardPad">
        <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
          <div className="col" style={{ gap: 4 }}>
            <div className="h2">Quick Actions</div>
          </div>

          <Link className="btn btnPrimary" to="/admin/subpage">
            Open Admin Tools
          </Link>
        </div>

        <div className="divider" />

        <div className="row" style={{ flexWrap: "wrap" }}>
          <ActionCard
            title="Approve / Block Accounts"
            desc="Review new account requests and manage account status."
            anchor="approvals"
          />
          <ActionCard
            title="User Management"
            desc="Search, filter, and sort all platform users."
            anchor="users"
          />
          <ActionCard
            title="Moderate Product Listings"
            desc="Approve, block, or remove products from the catalog."
            anchor="products"
          />
          <ActionCard
            title="View Audit Logs"
            desc="Trace administrative-related actions."
            anchor="audit"
          />
        </div>
      </div>

      <div className="card cardPad">
        <div className="h2">Recent Activity</div>
        <div className="divider" />

        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>10:12</td>
              <td>admin@sportvault.com</td>
              <td>APPROVE_ACCOUNT</td>
              <td>seller@demo</td>
            </tr>
            <tr>
              <td>10:31</td>
              <td>admin@sportvault.com</td>
              <td>BLOCK_PRODUCT</td>
              <td>Product #a12</td>
            </tr>
            <tr>
              <td>11:05</td>
              <td>admin@sportvault.com</td>
              <td>RESOLVE_RETURN</td>
              <td>Return #r09</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionCard({ title, desc, anchor }: { title: string; desc: string; anchor: string }) {
  return (
    <div className="card cardPad" style={{ flex: 1, minWidth: 220 }}>
      <div className="h2">{title}</div>
      <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
        {desc}
      </div>
      <div style={{ marginTop: 14 }}>
        <Link className="btn" to={`/admin/subpage#${anchor}`}>
          Open
        </Link>
      </div>
    </div>
  );
}
