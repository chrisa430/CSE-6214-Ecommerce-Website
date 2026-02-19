import { Link } from "react-router-dom";

export default function AdminHome() {
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
            anchor="accounts"
          />
          <ActionCard
            title="Moderate Product Listings"
            desc="Approve, block, or remove products from the catalog."
            anchor="products"
          />
          <ActionCard
            title="Facilitate Returns"
            desc="Resolve disputes and notify buyer/seller outcomes."
            anchor="returns"
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
              <td>admin@demo</td>
              <td>APPROVE_ACCOUNT</td>
              <td>seller@demo</td>
            </tr>
            <tr>
              <td>10:31</td>
              <td>admin@demo</td>
              <td>BLOCK_PRODUCT</td>
              <td>Product #a12</td>
            </tr>
            <tr>
              <td>11:05</td>
              <td>admin@demo</td>
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
