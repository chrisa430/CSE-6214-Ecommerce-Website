export default function AdminSubpage() {
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="card cardPad">
        <div className="h2">Admin Tools</div>
      </div>

      <Section id="accounts" title="Account Approvals (REQ-008 / REQ-009)">
        <div className="divider" />
        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Type</th>
              <th>Status</th>
              <th>Requested</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>seller@demo</td>
              <td>Seller</td>
              <td>Pending</td>
              <td>2026-02-16</td>
              <td>
                <button className="btn btnPrimary">Approve</button>{" "}
                <button className="btn btnDanger">Block</button>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section id="products" title="Product Moderation (REQ-047 / REQ-048 / REQ-049)">
        <div className="divider" />
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Seller</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Signed Jersey</td>
              <td>seller@demo</td>
              <td>Pending</td>
              <td>2026-02-17</td>
              <td>
                <button className="btn btnPrimary">Approve</button>{" "}
                <button className="btn btnDanger">Block</button>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section id="returns" title="Return Facilitation (REQ-082)">
        <div className="divider" />
        <table className="table">
          <thead>
            <tr>
              <th>Return ID</th>
              <th>Order</th>
              <th>Status</th>
              <th>Requested</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>r09</td>
              <td>o21</td>
              <td>Disputed</td>
              <td>2026-02-16</td>
              <td>
                <button className="btn btnPrimary">Approve Return</button>{" "}
                <button className="btn btnDanger">Deny Return</button>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section id="audit" title="Audit Logs (REQ-050 / REQ-059 / REQ-060)">
        <div className="divider" />
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Resource</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>2026-02-18 11:05</td>
              <td>admin@demo</td>
              <td>RESOLVE_RETURN</td>
              <td>Return r09</td>
            </tr>
            <tr>
              <td>2026-02-18 10:31</td>
              <td>admin@demo</td>
              <td>BLOCK_PRODUCT</td>
              <td>Product a12</td>
            </tr>
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card cardPad">
      <div className="h2">{title}</div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </section>
  );
}
