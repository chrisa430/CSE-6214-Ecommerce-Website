import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function SellerHome() {
  const { user } = useAuth();

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="card cardPad">
        <div className="h2">
          Welcome{user ? `, ${user.firstName}` : ""}!
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          This is your seller dashboard. Use the inventory manager to create listings,
          update product details, upload images, and remove listings.
        </div>
      </div>

      <div className="row" style={{ flexWrap: "wrap", gap: 16 }}>
        <div className="card cardPad" style={{ flex: 1, minWidth: 240 }}>
          <div className="h2">Inventory Manager</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            Create products, edit names, prices, quantities, and product images.
          </div>
          <div style={{ marginTop: 14 }}>
            <Link className="btn btnPrimary" to="/seller/inventory">
              Open Inventory
            </Link>
          </div>
        </div>

        <div className="card cardPad" style={{ flex: 1, minWidth: 240 }}>
          <div className="h2">Approval Workflow</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            Newly created or updated listings go to pending status until an admin approves them.
          </div>
        </div>
      </div>
    </div>
  );
}