export default function BuyerSubpage() {
  return (
      <div className="col" style={{ gap: 16 }}>
        <div className="card cardPad">
          <div className="h2">Buyer Profile</div>
        </div>
        <Section id="personalInfo" title="Personal Information (REQ-012)">
          <div className="divider" />
          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <div className="col" style={{ gap: 6 }}>
              <div className="h2">Name: Jane Doe</div>
              <div className="h2">Email: jane.doe@email.com</div>
              <div className="h2">Birthday: 01/12/2000</div>
            </div>
          </div>
        </Section>
        <Section id="shipAddress" title="Shipping Address (REQ-012)">
          <div className="divider" />
          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <div className="col" style={{ gap: 6 }}>
              <div className="h2">Address line 1: 123 Forrest Drive</div>
              <div className="h2">Address line 2: </div>
              <div className="h2">City: Atlanta State: GA Zipcode: 12345</div>
              <div className="h2"><button className="btn btnPrimary">Edit</button>{" "}</div>
            </div>
          </div>
        </Section>
        <Section id="billAddress" title="Billing Address (REQ-012)">
          <div className="divider" />
          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <div className="col" style={{ gap: 6 }}>
              <div className="h2">Address line 1: 123 Forrest Drive</div>
              <div className="h2">Address line 2: </div>
              <div className="h2">City: Atlanta State: GA Zipcode: 12345</div>
              <div className="h2"><button className="btn btnPrimary">Edit</button>{" "}</div>
            </div>
          </div>
        </Section>
        <Section id="paymentMethod1" title="Payment Method 1 (REQ-012)">
          <div className="divider" />
          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <div className="col" style={{ gap: 6 }}>
              <div className="h2">Name on card: Jane Doe</div>
              <div className="h2">Card Number: XXXX-XXXX-XXXX-1234</div>
              <div className="h2">Exp. Date: 01/2028 CV2: XXX</div>
              <div className="h2"><button className="btn btnPrimary">Edit</button>{" "}</div>
            </div>
          </div>
        </Section>
        <Section id="paymentMethod2" title="Payment Method 2 (REQ-012)">
          <div className="divider" />
          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <div className="col" style={{ gap: 6 }}>
              <div className="h2">Name on card: Jane Doe</div>
              <div className="h2">Card Number: XXXX-XXXX-XXXX-1234</div>
              <div className="h2">Exp. Date: 01/2028 CV2: XXX</div>
              <div className="h2"><button className="btn btnPrimary">Edit</button>{" "}</div>
            </div>
          </div>
        </Section>
        <div className="card cardPad">
           <div className="h2">Security</div>
        </div>
          <Section id="security" title="Password Update (REQ-022B)">
              <div className="divider" />
              <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                  <div className="col" style={{ gap: 6 }}>
                      <div className="h2">Current password: ************</div>
                      <div className="h2">New password: </div>
                      <div className="h2"><button className="btn btnPrimary">Update</button>{" "}</div>
                  </div>
              </div>
          </Section>
          <Section id="purchases" title="Purchases (REQ-035)">
              <div className="divider" />
              <table className="table">
                  <thead>
                  <tr>
                      <th>Date</th>
                      <th>Order Number</th>
                      <th>Order Total</th>
                      <th>Tracking</th>
                      <th>Status</th>
                  </tr>
                  </thead>
                  <tbody>
                  <tr>
                      <td>02/14/2025</td>
                      <td>12345</td>
                      <td>$590.85</td>
                      <td>1X21323881</td>
                      <td>Complete</td>
                  </tr>
                  <tr>
                      <td>05/05/2025</td>
                      <td>13798</td>
                      <td>$175.99</td>
                      <td>1X7823826</td>
                      <td>Complete</td>
                  </tr>
                  <tr>
                      <td>01/01/2026</td>
                      <td>23412</td>
                      <td>$3,506.99</td>
                      <td>1X97323854</td>
                      <td>Complete</td>
                  </tr>
                  <tr>
                      <td>02/20/2026</td>
                      <td>35102</td>
                      <td>$5,000.00</td>
                      <td>----------</td>
                      <td>In Progress</td>
                  </tr>
                  </tbody>
              </table>
          </Section>
          <Section id="returns" title="Returns (REQ-036)">
              <div className="divider" />
              <table className="table">
                  <thead>
                  <tr>
                      <th>Date</th>
                      <th>Order Number</th>
                      <th>Order Total</th>
                      <th>Tracking</th>
                      <th>Status</th>
                  </tr>
                  </thead>
                  <tbody>
                  </tbody>
              </table>
          </Section>
          <Section id="closeAccount" title="Close Account (REQ-079)">
              <div className="divider" />
              <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                  <div className="col" style={{ gap: 6 }}>
                      <div className="h2"><button className="btn btnPrimary">Close SportsVault Account</button>{" "}</div>
                  </div>
              </div>
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
