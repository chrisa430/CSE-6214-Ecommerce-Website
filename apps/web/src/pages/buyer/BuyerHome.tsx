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
            <div>Below are actions you can take as a buyer:</div>
            <br></br>
          </div>
        </div>

        <div className="card cardPad">
          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <div className="col" style={{ gap: 4 }}>
              <div className="h2">Options:</div>
            </div>

            <Link className="btn btnPrimary" to="/admin/subpage">
              Open Buyer Actions
            </Link>
          </div>

          <div className="divider" />

          <div className="row" style={{ flexWrap: "wrap" }}>
            <ActionCard //REQ-012 Update Account Details (Buyer)
                title="Update Account Details"
                desc="Update personal information and payment details."
                anchor="account"
            />
            <ActionCard //REQ-029 Initiate Product Comparison (Buyer)
                title="Search and Compare"
                desc="Search for products and directly compare them to each other."
                anchor="search"
            />
            <ActionCard //REQ-035 Show Order History (Buyer)
                title="Order History"
                desc="Review details of your past orders."
                anchor="orders"
            />
            <ActionCard //REQ-036 Initiate Product Return (Buyer)
                title="Returns"
                desc="Initiate returns and check status of existing returns."
                anchor="returns"
            />
              <ActionCard //REQ-022B Password Reset (Buyer)
                  title="Reset Password"
                  desc="Reset your SportsVault password."
                  anchor="password"
              />

              <ActionCard //REQ-079 Close Account (Buyer)
                  title="Close SportsVault Account"
                  desc="Close your SportsVault account and remove all associated data."
                  anchor="closeAccount"
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
          <Link className="btn" to={`/buyer/subpage#${anchor}`}>
            Open
          </Link>
        </div>
      </div>
  );
}

