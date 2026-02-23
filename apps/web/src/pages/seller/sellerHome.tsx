import { Link } from "react-router-dom";

export default function AdminHome() {
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <div className="card cardPad">
          <div> Welcome, User!</div>
            <br></br>
        </div>

        <div className="card cardPad">
          <div>Below are actions you can take as a seller:</div>
            <br></br>
        </div>
      </div>

      <div className="card cardPad">
        <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
          <div className="col" style={{ gap: 4 }}>
            <div className="h2">Options:</div>
          </div>

          <Link className="btn btnPrimary" to="/admin/subpage">
            Open Seller Actions
          </Link>
        </div>

        <div className="divider" />

        <div className="row" style={{ flexWrap: "wrap" }}>
          <ActionCard
            title="Update Account Details"
            desc="Update personal information and payment details."
            anchor="account"
          />
          <ActionCard
            title="Search and Compare"
            desc="Search for products and directly compare them to each other."
            anchor="search"
          />
          <ActionCard
            title="Manage Inventory"
            desc="Review details of your past orders."
            anchor="inventory"
          />
          <ActionCard
            title="Returns"
            desc="See returns for your products initiated by buyers."
            anchor="returns"
          />
        </div>
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
        <Link className="btn" to={`/seller/subpage#${anchor}`}>
          Open
        </Link>
      </div>
    </div>
  );
}
