import { useEffect, useState } from "react";
import {
  Category,
  createProduct,
  deleteProduct,
  getCategories,
  getMyProducts,
  updateProduct,
  Product,
} from "../../services/api";

export default function InventoryManagement() {
  const [items, setItems] = useState<Product[]>([]);
  const [newItemName, setNewItemName] = useState("");
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

        setItems(products || []);
        setCategories(categoryList);

        if (categoryList.length > 0) {
          setSelectedCategory(categoryList[0].id);
        }
      } catch (err) {
        console.error(err);
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

  async function removeItem(id: string) {
    try {
      await deleteProduct(id);

      setItems((items) => items.filter((item) => item.id !== id));
    } catch (err) {
      console.error(err);
      setError("Failed to remove product.");
    }
  }

  async function updateItem(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    try {
      const updated = await updateProduct(id, {
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      });

      setItems((items) =>
        items.map((i) => (i.id === id ? updated : i))
      );
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

      <table className="table" style={{ marginTop: 10 }}>
        <thead>
          <tr>
            <th>Image</th>
            <th>Item</th>
            <th>Quantity</th>
            <th>Price</th>
            <th>Status</th>
            <th></th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <img
                  src={item.imageUrl || "/images/default-product.png"}
                  style={{
                    width: 60,
                    height: 60,
                    objectFit: "cover",
                    borderRadius: 6,
                  }}
                />
              </td>

              <td>
                <input
                  className="input"
                  value={item.name}
                  onChange={(e) => {
                    const value = e.target.value;

                    setItems((items) =>
                      items.map((i) =>
                        i.id === item.id ? { ...i, name: value } : i
                      )
                    );
                  }}
                />
              </td>

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

              <td>
                <button
                  className="btn btnPrimary"
                  onClick={() => updateItem(item.id)}
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
          ))}

          <tr>
            <td></td>

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

            <td></td>

            <td></td>

            <td>
              <button
                className="btn btnPrimary"
                onClick={addItem}
                disabled={!newItemName || !selectedCategory}
              >
                Add Item
              </button>
            </td>

            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}