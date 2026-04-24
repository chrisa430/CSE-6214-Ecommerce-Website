import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Pagination from "../../components/Pagination";

const PAGE_SIZE = 12;
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

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface AddForm {
  name: string;
  categoryId: string;
  quantity: number;
  price: number;
  imageDataUrl: string;
}

const blankForm = (firstCategoryId = ""): AddForm => ({
  name: "",
  categoryId: firstCategoryId,
  quantity: 1,
  price: 0,
  imageDataUrl: "",
});

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  active: "#1a7f37",
  open: "#b45309",
  suspended: "#dc2626",
  removed: "#6b6b6b",
  traded: "#1d4ed8",
};

function statusLabel(status: string) {
  return status === "open" ? "Pending" : status.charAt(0).toUpperCase() + status.slice(1);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InventoryManagement() {
  const [items, setItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageError, setImageError] = useState("");

  const [addForm, setAddForm] = useState<AddForm>(blankForm());
  const addFileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [products, cats] = await Promise.all([getMyProducts(), getCategories()]);
        setItems(Array.isArray(products) ? products : []);
        setCategories(Array.isArray(cats) ? cats : []);
        if (Array.isArray(cats) && cats.length > 0) {
          setAddForm(blankForm(cats[0].id));
        }
      } catch (err: any) {
        setError(
          err?.response?.status === 401
            ? "Session expired. Please log out and sign back in."
            : "Failed to load inventory data."
        );
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Image picking ───────────────────────────────────────────────────────────

  async function pickImage(file: File): Promise<string | null> {
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Image must be under 2 MB. Please choose a smaller file.");
      return null;
    }
    setImageError("");
    return fileToDataUrl(file);
  }

  async function onAddFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await pickImage(file);
    if (url) setAddForm((f) => ({ ...f, imageDataUrl: url }));
  }

  async function onEditFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await pickImage(file);
    if (url) setEditTarget((prev) => (prev ? { ...prev, imageUrl: url } : null));
  }

  // ── Add product ─────────────────────────────────────────────────────────────

  function openAddModal() {
    setAddForm(blankForm(categories[0]?.id ?? ""));
    setImageError("");
    setShowAddModal(true);
  }

  async function submitAdd() {
    if (!addForm.name.trim() || !addForm.categoryId) return;
    setSaving(true);
    setError("");
    try {
      const created = await createProduct({
        name: addForm.name.trim(),
        category: addForm.categoryId,
        quantity: addForm.quantity,
        unitPrice: addForm.price,
      });
      if (addForm.imageDataUrl) {
        await updateProductImage(created.id, addForm.imageDataUrl);
        created.imageUrl = addForm.imageDataUrl;
      }
      setItems((prev) => [...prev, created]);
      setShowAddModal(false);
    } catch (err: any) {
      setError(
        err?.response?.status === 401
          ? "Session expired. Please log out and sign back in."
          : "Failed to create product."
      );
    } finally {
      setSaving(false);
    }
  }

  // ── Edit product ────────────────────────────────────────────────────────────

  function openEditModal(item: Product) {
    setEditTarget({ ...item });
    setImageError("");
  }

  async function submitEdit() {
    if (!editTarget) return;
    setSaving(true);
    setError("");
    try {
      const original = items.find((i) => i.id === editTarget.id);
      const updated = await updateProduct(editTarget.id, {
        name: editTarget.name,
        quantity: editTarget.quantity,
        unitPrice: editTarget.unitPrice,
      });

      if (editTarget.imageUrl !== original?.imageUrl) {
        await updateProductImage(editTarget.id, editTarget.imageUrl ?? "");
      }

      setItems((prev) =>
        prev.map((i) =>
          i.id === editTarget.id
            ? { ...i, ...updated, imageUrl: editTarget.imageUrl }
            : i
        )
      );
      setEditTarget(null);
    } catch (err: any) {
      setError(
        err?.response?.status === 401
          ? "Session expired. Please log out and sign back in."
          : "Failed to update product."
      );
    } finally {
      setSaving(false);
    }
  }

  // ── Remove product ──────────────────────────────────────────────────────────

  async function removeItem(id: string) {
    setError("");
    try {
      await deleteProduct(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err: any) {
      setError(
        err?.response?.status === 401
          ? "Session expired. Please log out and sign back in."
          : "Failed to remove product."
      );
    }
  }

  // ── Derived stats ───────────────────────────────────────────────────────────

  const activeCount = items.filter((i) => i.status === "active").length;
  const pendingCount = items.filter((i) => i.status === "open").length;
  const portfolioValue = items.reduce(
    (sum, i) => sum + Number(i.unitPrice) * i.quantity,
    0
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="card cardPad">Loading inventory...</div>;
  }

  return (
    <div className="card cardPad">
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div className="h2">Inventory Management</div>
        <button className="btn btnPrimary" onClick={openAddModal}>
          + Add New Product
        </button>
      </div>

      {error && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 14px",
            background: "#1a0000",
            border: "1px solid #550000",
            borderRadius: 8,
            color: "#f87171",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {/* ── Stats row ── */}
      <div style={{ display: "flex", gap: 14, marginTop: 22, flexWrap: "wrap" }}>
        {[
          { label: "Total Listings", value: items.length },
          { label: "Active", value: activeCount, color: "#1a7f37" },
          { label: "Pending Approval", value: pendingCount, color: "#b45309" },
          { label: "Portfolio Value", value: `$${portfolioValue.toFixed(2)}` },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              flex: "1 1 140px",
              background: "#181717",
              border: "1px solid #2a2a2a",
              borderRadius: 10,
              padding: "14px 18px",
            }}
          >
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color ?? "#fff" }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Product grid ── */}
      {items.length === 0 ? (
        <div
          style={{
            marginTop: 60,
            textAlign: "center",
            color: "#555",
            fontSize: 15,
          }}
        >
          No products yet. Click "Add New Product" to get started.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 20,
            marginTop: 28,
          }}
        >
          {items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((item) => (
            <div
              key={item.id}
              style={{
                border: "1px solid #2a2a2a",
                borderRadius: 12,
                overflow: "hidden",
                background: "#181717",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Image */}
              <div style={{ position: "relative", background: "#111", height: 190 }}>
                <img
                  src={item.imageUrl || "/images/default-product.png"}
                  alt={item.name}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
                <span
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    background: STATUS_COLOR[item.status] ?? "#555",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 9px",
                    borderRadius: 99,
                  }}
                >
                  {statusLabel(item.status)}
                </span>
              </div>

              {/* Info */}
              <div
                style={{
                  padding: "12px 14px 6px",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>
                  {item.name}
                </div>
                <div style={{ color: "#1a7f37", fontWeight: 700, fontSize: 17 }}>
                  ${Number(item.unitPrice).toFixed(2)}
                </div>
                <div style={{ color: "#888", fontSize: 13 }}>Qty: {item.quantity}</div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, padding: "10px 14px 14px" }}>
                <button
                  className="btn btnPrimary"
                  style={{ flex: 1, fontSize: 13 }}
                  onClick={() => openEditModal(item)}
                >
                  Edit
                </button>
                <button
                  className="btn btnDanger"
                  style={{ flex: 1, fontSize: 13 }}
                  onClick={() => removeItem(item.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={Math.ceil(items.length / PAGE_SIZE)}
        totalItems={items.length}
        pageSize={PAGE_SIZE}
        onChange={setPage}
      />

      {/* ── Add Product Modal ── */}
      {showAddModal && (
        <ModalOverlay onClose={() => !saving && setShowAddModal(false)}>
          <ModalTitle>Add New Product</ModalTitle>

          <ImagePickerField
            imageUrl={addForm.imageDataUrl}
            error={imageError}
            onPick={() => addFileRef.current?.click()}
            onClear={() => {
              setAddForm((f) => ({ ...f, imageDataUrl: "" }));
              setImageError("");
            }}
          />
          <input
            ref={addFileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={onAddFilePick}
          />

          <FormField label="Product Name">
            <input
              className="input"
              placeholder="e.g. Signed Baseball"
              value={addForm.name}
              onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
            />
          </FormField>

          <FormField label="Category">
            <select
              className="input"
              value={addForm.categoryId}
              onChange={(e) => setAddForm((f) => ({ ...f, categoryId: e.target.value }))}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>

          <div style={{ display: "flex", gap: 12 }}>
            <FormField label="Quantity" style={{ flex: 1 }}>
              <input
                className="input"
                type="number"
                min={0}
                value={addForm.quantity}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, quantity: Number(e.target.value) }))
                }
              />
            </FormField>
            <FormField label="Price ($)" style={{ flex: 1 }}>
              <input
                className="input"
                type="number"
                min={0}
                step="0.01"
                value={addForm.price}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, price: Number(e.target.value) }))
                }
              />
            </FormField>
          </div>

          <ModalActions>
            <button
              className="btn"
              style={{ flex: 1, background: "#2a2a2a" }}
              disabled={saving}
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </button>
            <button
              className="btn btnPrimary"
              style={{ flex: 1 }}
              disabled={!addForm.name.trim() || !addForm.categoryId || saving}
              onClick={submitAdd}
            >
              {saving ? "Adding..." : "Add Product"}
            </button>
          </ModalActions>
        </ModalOverlay>
      )}

      {/* ── Edit Product Modal ── */}
      {editTarget && (
        <ModalOverlay onClose={() => !saving && setEditTarget(null)}>
          <ModalTitle>Edit Product</ModalTitle>

          <ImagePickerField
            imageUrl={editTarget.imageUrl ?? ""}
            error={imageError}
            onPick={() => editFileRef.current?.click()}
            onClear={() => {
              setEditTarget((prev) => (prev ? { ...prev, imageUrl: "" } : null));
              setImageError("");
            }}
          />
          <input
            ref={editFileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={onEditFilePick}
          />

          <FormField label="Product Name">
            <input
              className="input"
              value={editTarget.name}
              onChange={(e) =>
                setEditTarget((prev) =>
                  prev ? { ...prev, name: e.target.value } : null
                )
              }
            />
          </FormField>

          <div style={{ display: "flex", gap: 12 }}>
            <FormField label="Quantity" style={{ flex: 1 }}>
              <input
                className="input"
                type="number"
                min={0}
                value={editTarget.quantity}
                onChange={(e) =>
                  setEditTarget((prev) =>
                    prev ? { ...prev, quantity: Number(e.target.value) } : null
                  )
                }
              />
            </FormField>
            <FormField label="Price ($)" style={{ flex: 1 }}>
              <input
                className="input"
                type="number"
                min={0}
                step="0.01"
                value={editTarget.unitPrice}
                onChange={(e) =>
                  setEditTarget((prev) =>
                    prev ? { ...prev, unitPrice: Number(e.target.value) } : null
                  )
                }
              />
            </FormField>
          </div>

          <div
            style={{
              padding: "10px 14px",
              background: "#1a1000",
              border: "1px solid #3d2c00",
              borderRadius: 8,
              fontSize: 13,
              color: "#b45309",
            }}
          >
            Changing the product name will reset it to "Pending Approval".
          </div>

          <ModalActions>
            <button
              className="btn"
              style={{ flex: 1, background: "#2a2a2a" }}
              disabled={saving}
              onClick={() => setEditTarget(null)}
            >
              Cancel
            </button>
            <button
              className="btn btnPrimary"
              style={{ flex: 1 }}
              disabled={!editTarget.name.trim() || saving}
              onClick={submitEdit}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </ModalActions>
        </ModalOverlay>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ModalOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid #2a2a2a",
          borderRadius: 14,
          padding: 28,
          width: "100%",
          maxWidth: 500,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

function ModalTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 22 }}>{children}</div>
  );
}

function ModalActions({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 22 }}>{children}</div>
  );
}

function FormField({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <label
        style={{ display: "block", fontSize: 13, color: "#aaa", marginBottom: 5 }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function ImagePickerField({
  imageUrl,
  error,
  onPick,
  onClear,
}: {
  imageUrl: string;
  error: string;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 13, color: "#aaa", marginBottom: 8 }}>
        Product Image
      </div>

      {imageUrl ? (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <img
            src={imageUrl}
            alt="preview"
            style={{
              width: 100,
              height: 100,
              objectFit: "contain",
              borderRadius: 8,
              background: "#111",
              border: "1px solid #333",
              flexShrink: 0,
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              className="btn btnPrimary"
              style={{ fontSize: 13 }}
              onClick={onPick}
            >
              Change Image
            </button>
            <button
              className="btn"
              style={{ fontSize: 13, background: "#2a2a2a" }}
              onClick={onClear}
            >
              Remove Image
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onPick}
          style={{
            width: "100%",
            height: 120,
            border: "2px dashed #333",
            borderRadius: 10,
            background: "#111",
            color: "#666",
            cursor: "pointer",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span>Click to select an image</span>
          <span style={{ fontSize: 11, color: "#444" }}>PNG, JPG, WEBP — max 2 MB</span>
        </button>
      )}

      {error && (
        <div style={{ color: "#f87171", fontSize: 12, marginTop: 6 }}>{error}</div>
      )}
    </div>
  );
}