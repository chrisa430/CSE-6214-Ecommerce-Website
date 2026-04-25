import { useEffect, useState } from "react";
import {
  Category,
  createProduct,
  deleteProduct,
  getCategories,
  getMyProducts,
  Product,
  updateProduct,
  updateProductImage,
} from "../../services/api";

export default function InventoryManagement() {
  const [items, setItems] = useState<Product[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newQuantity, setNewQuantity] = useState(0);
  const [newPrice, setNewPrice] = useState(0);
  const [newImageUrl, setNewImageUrl] = useState("");
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

        setItems(Array.isArray(products) ? products : []);
        setCategories(Array.isArray(categoryList) ? categoryList : []);

        if (Array.isArray(categoryList) && categoryList.length > 0) {
          setSelectedCategory(categoryList[0].id);
        }
      } catch (err: any) {
        console.error(err);

        if (err?.response?.status === 401) {
          setError("Your session expired. Please log out and sign back in as a seller.");
        } else {
          setError("Failed to load inventory data.");
        }

        setItems([]);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  async function addItem() {
    if (!newItemName || !selectedCategory) return;

    try {
      setError("");

      const created = await createProduct({
        name: newItemName,
        category: selectedCategory,
        quantity: newQuantity,
        unitPrice: newPrice,
      });

      if (newImageUrl) {
        await updateProductImage(created.id, newImageUrl);
        created.imageUrl = newImageUrl;
      }

      setItems((prev) => [...prev, created]);

      setNewItemName("");
      setNewQuantity(0);
      setNewPrice(0);
      setNewImageUrl("");
    } catch (err: any) {
      console.error(err);

      if (err?.response?.status === 401) {
        setError("Your session expired. Please log out and sign back in as a seller.");
      } else {
        setError("Failed to create product.");
      }
    }
  }

  async function removeItem(id: string) {
    try {
      setError("");
      await deleteProduct(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      console.error(err);

      if (err?.response?.status === 401) {
        setError("Your session expired. Please log out and sign back in as a seller.");
      } else {
        setError("Failed to remove product.");
      }
    }
  }

  async function updateItem(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    try {
      setError("");

      const updated = await updateProduct(id, {
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      });

      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updated } : i)));
    } catch (err: any) {
      console.error(err);

      if (err?.response?.status === 401) {
        setError("Your session expired. Please log out and sign back in as a seller.");
      } else {
        setError("Failed to update product.");
      }
    }
  }

  async function saveImage(id: string, imageUrl: string) {
    try {
      setError("");
      await updateProductImage(id, imageUrl);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, imageUrl } : item))
      );
    } catch (err: any) {
      console.error(err);

      if (err?.response?.status === 401) {
        setError("Your session expired. Please log out and sign back in as a seller.");
      } else {
        setError("Failed to update image.");
      }
    }
  }

  if (loading) {
    return <div className="card cardPad">Loading inventory...</div>;
  }

  return (
    <div className="card cardPad">
      <div className="h2">Inventory Management</div>

      {error && (
        <div style={{ marginTop: 12, marginBottom: 12, color: "red" }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 20, marginBottom: 30 }}>
        <h3>Product Preview</h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 20,
          }}
        >
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                border: "1px solid #131212",
                borderRadius: 10,
                padding: 10,
                background: "#181717",
              }}
            >
              <img
                src={item.imageUrl || "/images/default-product.png"}
                alt={item.name}
                style={{
                  width: "100%",
                  height: 150,
                  objectFit: "contain",
                  borderRadius: 6,
                  background: "#222"
                }}
              />

              <div style={{ fontWeight: 600, marginTop: 10 }}>{item.name}</div>
              <div style={{ color: "#555", marginTop: 5 }}>Qty: {item.quantity}</div>
              <div style={{ color: "#1a7f37", fontWeight: 600 }}>
                ${Number(item.unitPrice).toFixed(2)}
              </div>
              <div style={{ fontSize: 12, marginTop: 5 }}>Status: {item.status}</div>
            </div>
          ))}
        </div>
      </div>

      <table className="table" style={{ marginTop: 10 }}>
        <thead>
          <tr>
            <th>Image</th>
            <th>Item</th>
            <th>Quantity</th>
            <th>Price</th>
            <th>Status / Category</th>
            <th></th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td style={{ minWidth: 180 }}>
                <img
                  src={item.imageUrl || "/images/default-product.png"}
                  alt={item.name}
                  style={{
                    width: 60,
                    height: 60,
                    objectFit: "contain",
                    borderRadius: 6,
                    display: "block",
                    marginBottom: 6,
                    background: "#222"
                  }}
                />

                <input
                  className="input"
                  placeholder="Image URL"
                  value={item.imageUrl || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setItems((prev) =>
                      prev.map((i) => (i.id === item.id ? { ...i, imageUrl: value } : i))
                    );
                  }}
                />

                <button
                  className="btn btnPrimary"
                  style={{ marginTop: 4 }}
                  onClick={() => saveImage(item.id, item.imageUrl || "")}
                >
                  Save Image
                </button>
              </td>

              <td>
                <input
                  className="input"
                  value={item.name}
                  onChange={(e) => {
                    const value = e.target.value;
                    setItems((prev) =>
                      prev.map((i) => (i.id === item.id ? { ...i, name: value } : i))
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
                    setItems((prev) =>
                      prev.map((i) => (i.id === item.id ? { ...i, quantity: value } : i))
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
                    setItems((prev) =>
                      prev.map((i) => (i.id === item.id ? { ...i, unitPrice: value } : i))
                    );
                  }}
                />
              </td>

              <td>{item.status}</td>

              <td>
                <button className="btn btnPrimary" onClick={() => updateItem(item.id)}>
                  Update
                </button>
              </td>

              <td>
                <button className="btn btnDanger" onClick={() => removeItem(item.id)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}

          <tr>
            <td>
              <input
                className="input"
                placeholder="Image URL"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
              />
            </td>

            <td>
              <input
                type="text"
                className="input"
                placeholder="Item name"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
              />
            </td>

            <td>
              <input
                type="number"
                className="input"
                placeholder="Quantity"
                value={newQuantity}
                onChange={(e) => setNewQuantity(Number(e.target.value))}
              />
            </td>

            <td>
              <input
                type="number"
                step="0.01"
                className="input"
                placeholder="Price"
                value={newPrice}
                onChange={(e) => setNewPrice(Number(e.target.value))}
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

            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}