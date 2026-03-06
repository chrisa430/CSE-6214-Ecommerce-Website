import { useEffect, useState } from "react";
import {
  Category,
  createProduct,
  getCategories,
  getMyProducts,
  updateProduct,
  Product,
} from "../../services/api";


export default function InventoryManagement() {
  const [items, setItems] = useState<Product[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [updateInput, setUpdateInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");

  useEffect(() => {
  async function loadData() {
    try {
      const [products, categoryList] = await Promise.all([
        getMyProducts(),
        getCategories(),
      ]);

      if (Array.isArray(products)) {
        setItems(products);
      } else {
        console.error("Expected array but got:", products);
        setItems([]);
        setError("Products response was not a list.");
      }

      setCategories(categoryList);
      if (categoryList.length > 0) {
        setSelectedCategory(categoryList[0].id);
      }
    } catch (err) {
      console.error(err);
      setItems([]);
      setError("Failed to load inventory data.");
    } finally {
      setLoading(false);
    }
  }

  loadData();
  }, []);

  async function addItem() {
    if (!newItemName || !selectedCategory) return;

    try {
      const created = await createProduct({
        name: newItemName,
        category: selectedCategory,
        quantity: 0,
        unitPrice: 0,
      });

      setItems((prev) => [...prev, created]);
      setNewItemName("");
    } catch (err) {
      console.error(err);
      setError("Failed to create product.");
    }
  }

  function removeItem(id: string) {
    setItems(function (items) {
      const updatedItems: Product[] = [];

      for (let i = 0; i < items.length; i++) {
        if (items[i].id !== id) {
          updatedItems.push(items[i]);
        }
      }

      return updatedItems;
    });
  }

  function publishItem(id: string) {
    setItems(function (items) {
      return items.map(function (item) {
        if (item.id === id) {
          return { ...item, status: "Pending" };
        } else {
          return item;
        }
      });
    });
  }

  function unpublishItem(id: string) {
    setItems(function (items) {
      return items.map(function (item) {
        if (item.id === id) {
          return { ...item, status: "Unpublished" };
        } else {
          return item;
        }
      });
    });
  }

  async function updateItem(id: string) {
    if (!updateInput) return;

    const item = items.find((i) => i.id === id);

    if (!item) return;

    try {
      const updated = await updateProduct(id, {
        name: updateInput,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      });

      setItems((items) =>
        items.map((i) => (i.id === id ? updated : i))
      );

      setUpdateInput("");
    } catch (err) {
      console.error(err);
      setError("Failed to update product.");
    }
  }

  if (loading) {
    return <div className="card cardPad">Loading inventory...</div>;
  }

  if (error) {
    return <div className="card cardPad">{error}</div>;
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
          onChange={function (input) {
            setUpdateInput(input.target.value);
          }}
        />
      </div>

      <table className="table" style={{ marginTop: 10 }}>
        <thead>
          <tr>
            <th>Item</th>
            <th>Quantity</th>
            <th>Price</th>
            <th>Status</th>
            <th></th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {Array.isArray(items) && items.map((item) => {let publishButton;

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
                <td>
                  <input
                    className="input"
                    type="number"
                    value={item.quantity}
                    onChange={(e) => {
                      const value = Number(e.target.value);

                      setItems((items) =>
                        items.map((i) =>
                          i.id === item.id ? { ...i, quantity: value } : i
                        )
                      );
                    }}
                  />
                </td>

                <td>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => {
                      const value = Number(e.target.value);

                      setItems((items) =>
                        items.map((i) =>
                          i.id === item.id ? { ...i, unitPrice: value } : i
                        )
                      );
                    }}
                  />
                </td>

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
                onChange={(input) => {
                  setNewItemName(input.target.value);
                }}
              />
            </td>

            <td>
              <select
                className="input"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </td>

            <td>
              <button
                className="btn btnPrimary"
                onClick={addItem}
                disabled={!newItemName || !selectedCategory}
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