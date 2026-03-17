import { Link } from "react-router-dom";

export default function SellerSubpage() {
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="card cardPad">
        <div className="h2">Seller Tools</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          This page has been simplified. Use the inventory manager for active seller features.
        </div>
      </div>

      <div className="card cardPad">
        <div className="h2">Available Seller Feature</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Manage products, images, quantity, pricing, and listing status from the inventory page.
        </div>

        <div style={{ marginTop: 14 }}>
          <Link className="btn btnPrimary" to="/seller/inventory">
            Go to Inventory
          </Link>
        </div>
      </div>
    </div>
  );
}