import { useState } from "react";

export default function InventoryManagement() {
  const [items, setItems] = useState([]);
  const [newItemName, setNewItemName] = useState("");
  const [updateInput, setUpdateInput] = useState("");
  const [nextId, setNextId] = useState(0);

  function addItem() {
    if (!newItemName) return;  //if nothing is typed in the new item box, nothing happens
    const newItem = {id: nextId, name: newItemName, status: "Unpublished"};
    setItems([...items, newItem]);
    setNextId(nextId + 1); //iterates to the next id starting at 0. This can only be for use on the seller account, will need to be translated to unique id for the market.
    setNewItemName(""); //resets the box
  }

  function removeItem(id) {
    setItems(function(items) {
      const updatedItems = [];

      for (let i = 0; i < items.length; i++) { //Goes through every item and puts ones that aren't the item to remove into the list of items to be kept
        if (items[i].id !== id) {
          updatedItems.push(items[i]);
          }
      }

    return updatedItems;
    });
  }

  function publishItem(id) {
    setItems(function(items){
      return items.map(function(item) {
        if (item.id === id) { //searches for the item that matches the id and sets its status to pending
          return { ...item, status: "Pending" };
        } else {
          return item;
        }
      });
    });
  }

  function unpublishItem(id) { //this is basically a copy of publishItem but it sets it to unpublished instead
    setItems(function(items){
      return items.map(function(item) {
        if (item.id === id) {
          return { ...item, status: "Unpublished" };
        } else {
          return item;
        }
      });
    });
  }

  function updateItem(id) {
    if (!updateInput) return;

    setItems(function(items){
      return items.map(function(item) {
        if (item.id === id) {
          return { ...item, name: updateInput };
        } else {
          return item;
        }
      });
    });

    setUpdateInput("");
  }

  return (
    <div className="card cardPad">
      <div className="h2">Inventory Management</div>

      <br />
      Enter text here to update an item with it:
      <div style={{ marginBottom: 10 }}>
        <input
          type="text"
          className="input"
          placeholder="Enter new item name"
          value={updateInput}
          onChange={function(input) { setUpdateInput(input.target.value); }}
        />
      </div>

      <table className="table" style={{ marginTop: 10 }}>
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
          {items.map(item => {
            let publishButton;

            if (item.status === "Published" || item.status === "Pending") {
              publishButton = (
                <button
                  className="btn btnPrimary"
                  onClick={() => unpublishItem(item.id)}
                >
                  Unpublish
                </button>
              );
            } else {
              publishButton = (
                <button
                  className="btn btnPrimary"
                  onClick={() => publishItem(item.id)}
                >
                    Publish
                </button>
              );
            }
            return (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.status}</td>

                <td>{publishButton}</td>

                <td>
                  <button
                    className="btn btnPrimary"
                    onClick={() => updateItem(item.id)}
                    disabled={!updateInput}
                  >
                    Update
                  </button>
                </td>

                <td>
                  <button
                    className="btn btnDanger"
                    onClick={() => removeItem(item.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}

          <tr>
            <td>
              <input
                type="text"
                className="input"
                placeholder="New item"
                value={newItemName}
                onChange={input => { setNewItemName(input.target.value); }}
              />
            </td>
            <td>
              <button
                className="btn btnPrimary"
                onClick={addItem}
                disabled={!newItemName}
              >
                Add Item
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}