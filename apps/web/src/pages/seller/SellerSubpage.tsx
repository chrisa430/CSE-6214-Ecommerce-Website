import { useState } from "react";

export default function SellerSubpage() {
  const [mailingInput, setMailingInput] = useState("");
  const [accountInput, setAccountInput] = useState("");
  const [routingInput, setRoutingInput] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [addInput, setAddInput] = useState("");

  function handleSubmit() {
    //put API here? idk, I've never even heard of react before
    console.log("Submitted text:", accountInput);
  }

  function handleSearch() {
      //search stuff
  }

  function handleUpdate() {
      //bring to update page
  }

  function handleRemove() {
      //remove item
  }

  function handlePublish() {
      //send publication request and update status
  }

  function handleUnpublish() {
      //do all that and update status
  }

  function handleAccept(){
      //yeehaw
  }

  function handleDispute(){
      //escalate dispute to admin
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="card cardPad">
        <div className="h2">Seller Actions</div>
          <br></br>
      </div>

      <Section id="account" title="Account Details (REQ-013)">
        <div className="divider" />

        <table className="table">
          <thead>
            <tr>
              <th>Update Details</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <input
                  type="text"
                  className="input"
                  placeholder="New Mailing Address"
                  value={mailingInput}
                  onChange={(e) => setMailingInput(e.target.value)}
                />
              </td>
              <td>
                <button
                  className="btn btnPrimary"
                  onClick={handleSubmit}
                  disabled={!mailingInput}
                >
                  Submit
                </button>
              </td>
            </tr>
            <tr>
              <td>
                <input
                  type="text"
                  className="input"
                  placeholder="New Bank Account Number"
                  value={accountInput}
                  onChange={(e) => setAccountInput(e.target.value)}
                />
              </td>
              <td>
                <button
                  className="btn btnPrimary"
                  onClick={handleSubmit}
                  disabled={!accountInput}
                >
                  Submit
                </button>
              </td>
            </tr>
            <tr>
              <td>
                <input
                  type="text"
                  className="input"
                  placeholder="New Routing Number"
                  value={routingInput}
                  onChange={(e) => setRoutingInput(e.target.value)}
                />
              </td>
              <td>
                <button
                  className="btn btnPrimary"
                  onClick={handleSubmit}
                  disabled={!routingInput}
                >
                  Submit
                </button>
              </td>
            </tr>
            <tr>
                
            </tr>
          </tbody>
        </table>
      </Section>
        <br></br>
        <Section id="inventory" title="Inventory Management (REQ-038 / REQ-039 / REQ-040 / REQ-041)">
            <table className="table">
          <thead>
            <tr>
              <th>Items</th>
              <th>Status</th>
              <th></th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                Signed Jersey
              </td>
              <td>
                  Published
              </td>
              <td>
                <button
                  className="btn btnPrimary"
                  onClick={handleUpdate}
                >
                  Update
                </button>
              </td>
              <td>
                <button
                  className="btn btnPrimary"
                  onClick={handleRemove}
                >
                  Remove
                </button>                  
              </td>
              <td>
                <button
                  className="btn btnPrimary"
                  onClick={handleUnpublish}
                >
                  Unpublish
                </button>                  
              </td>
            </tr>
            <tr>
              <td>
                Baseball signed by John Baseball himself only $1.00 one of a kind get it now!!!!1!
              </td>
              <td>
                  Unpublished
              </td>
              <td>
                <button
                  className="btn btnPrimary"
                  onClick={handleUpdate}
                >
                  Update
                </button>
              </td>
              <td>
                <button
                  className="btn btnPrimary"
                  onClick={handleRemove}
                >
                  Remove
                </button>                  
              </td>
              <td>
                <button
                  className="btn btnPrimary"
                  onClick={handlePublish}
                >
                  Publish
                </button>                  
              </td>
            </tr>
            <tr>
              <td>
                <input
                  type="text"
                  className="input"
                  placeholder="New Item"
                  value={addInput}
                  onChange={(e) => setAddInput(e.target.value)}
                />
              </td>
              <td>
                <button
                  className="btn btnPrimary"
                  onClick={handleSubmit}
                  disabled={!addInput}
                >
                  Add Item
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>
        <br></br>
    <Section id="returns" title="Handle Returns (REQ-043 / REQ-081)">
        <div className="divider" />
        <table className="table"> 
          <thead>
            <tr>
              <th>Return ID</th>
              <th>Order</th>
              <th>Status</th>
              <th>Initiated</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>r09</td>
              <td>o21</td>
              <td>Pending</td>
              <td>2026-02-15</td>
              <td>
                <button className="btn btnPrimary" onClick={handleAccept}>Accept Return</button>{" "}
                <button className="btn btnDanger" onClick={handleDispute}>Dispute Return</button>
              </td>
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
