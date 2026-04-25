/**
 * @fileoverview InventoryManagement — redesigned seller inventory page
 * @module pages/seller/InventoryManagement.tsx
 * @author Darrell Hobson
 * @Date 2026.04.24
 *
 * Layout:
 *  1. Page header + search/filter bar
 *  2. Product tile grid — 4 columns × 3 rows (12 per page)
 *     Each tile has inline Update + Remove controls
 *  3. Pagination controls (← page N of M →)
 *  4. Add New Product form
 */
import { useEffect, useState, useCallback } from "react";
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

// ── Constants ─────────────────────────────────────────────────────────────────

const TILES_PER_ROW  = 4;
const ROWS_PER_PAGE  = 3;
const PAGE_SIZE      = TILES_PER_ROW * ROWS_PER_PAGE; // 12

// ── Status color map ──────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  active:    "#22c55e",
  pending:   "#f59e0b",
  suspended: "#ef4444",
  inactive:  "#6b7280",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function InventoryManagement() {
  const [items,           setItems]           = useState<Product[]>([]);
  const [categories,      setCategories]      = useState<Category[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState("");
  const [toast,           setToast]           = useState<{ msg: string; ok: boolean } | null>(null);

  // Pagination
  const [page,            setPage]            = useState(1);

  // Per-tile edit state: map of product id → draft values
  const [drafts, setDrafts] = useState<Record<string, {
    name: string; quantity: number; unitPrice: number; imageUrl: string;
  }>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId,    setBusyId]    = useState<string | null>(null);

  // Add-product form
  const [newName,          setNewName]          = useState("");
  const [newQty,           setNewQty]           = useState(0);
  const [newPrice,         setNewPrice]         = useState(0);
  const [newImageUrl,      setNewImageUrl]      = useState("");
  const [newCategory,      setNewCategory]      = useState("");
  const [addBusy,          setAddBusy]          = useState(false);

  // ── Data load ───────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const [products, cats] = await Promise.all([getMyProducts(), getCategories()]);
      setItems(Array.isArray(products) ? products : []);
      setCategories(Array.isArray(cats) ? cats : []);
      if (Array.isArray(cats) && cats.length > 0) setNewCategory(cats[0].id);
    } catch (err: any) {
      setError(err?.response?.status === 401
        ? "Session expired — please log out and sign back in."
        : "Failed to load inventory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Toast helper ─────────────────────────────────────────────────────────────

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Pagination ───────────────────────────────────────────────────────────────

  const totalPages  = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage    = Math.min(page, totalPages);
  const pageItems   = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // ── Per-tile edit helpers ─────────────────────────────────────────────────────

  function startEdit(item: Product) {
    setEditingId(item.id);
    setDrafts((prev) => ({
      ...prev,
      [item.id]: {
        name:      item.name,
        quantity:  item.quantity,
        unitPrice: Number(item.unitPrice),
        imageUrl:  item.imageUrl ?? "",
      },
    }));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function patchDraft(id: string, patch: Partial<{ name: string; quantity: number; unitPrice: number; imageUrl: string }>) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async function saveItem(id: string) {
    const d = drafts[id];
    if (!d) return;
    setBusyId(id);
    try {
      const updated = await updateProduct(id, { name: d.name, quantity: d.quantity, unitPrice: d.unitPrice });
      if (d.imageUrl !== items.find((i) => i.id === id)?.imageUrl) {
        await updateProductImage(id, d.imageUrl);
      }
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...updated, imageUrl: d.imageUrl } : i));
      setEditingId(null);
      showToast("Product updated ✓");
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? "Update failed", false);
    } finally {
      setBusyId(null);
    }
  }

  async function removeItem(id: string) {
    setBusyId(id);
    try {
      await deleteProduct(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      showToast("Product removed");
      // If removing last item on current page, go back
      const remaining = items.length - 1;
      if ((safePage - 1) * PAGE_SIZE >= remaining && safePage > 1) {
        setPage((p) => p - 1);
      }
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? "Remove failed", false);
    } finally {
      setBusyId(null);
    }
  }

  async function addItem() {
    if (!newName.trim() || !newCategory) return;
    setAddBusy(true);
    try {
      const created = await createProduct({
        name: newName.trim(), category: newCategory,
        quantity: newQty, unitPrice: newPrice,
      });
      if (newImageUrl.trim()) {
        await updateProductImage(created.id, newImageUrl.trim());
        created.imageUrl = newImageUrl.trim();
      }
      setItems((prev) => [...prev, created]);
      setNewName(""); setNewQty(0); setNewPrice(0); setNewImageUrl("");
      // Jump to last page to show the new item
      const newTotal = Math.ceil((items.length + 1) / PAGE_SIZE);
      setPage(newTotal);
      showToast(`"${created.name}" added to inventory ✓`);
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? "Failed to add product", false);
    } finally {
      setAddBusy(false);
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="card cardPad" style={{ textAlign: "center", padding: 48 }}>
        <div className="muted">Loading inventory…</div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="col" style={{ gap: 20 }}>

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14,
          background: toast.ok ? "rgba(34,197,94,0.92)" : "rgba(239,68,68,0.92)",
          color: "#fff", boxShadow: "0 4px 16px rgba(0,0,0,.4)",
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="card cardPad">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div className="h2" style={{ fontSize: 20, fontWeight: 800 }}>📦 Inventory Management</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              {items.length} product{items.length !== 1 ? "s" : ""} · Page {safePage} of {totalPages}
            </div>
          </div>
          {error && (
            <div style={{
              padding: "8px 14px", borderRadius: 8, fontSize: 13,
              background: "rgba(239,68,68,0.12)", color: "#fca5a5",
              border: "1px solid rgba(239,68,68,0.3)",
            }}>
              ⚠️ {error}
            </div>
          )}
        </div>
      </div>

      {/* ── Product tile grid ───────────────────────────────────────────────── */}
      <div className="card cardPad">
        {items.length === 0 ? (
          <div className="muted" style={{ textAlign: "center", padding: "40px 0", fontSize: 14 }}>
            No products yet. Use the form below to add your first product.
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
          }}>
            {pageItems.map((item) => {
              const isEditing = editingId === item.id;
              const isBusy    = busyId === item.id;
              const draft     = drafts[item.id];
              const statusColor = STATUS_COLOR[item.status?.toLowerCase() ?? ""] ?? "#6b7280";

              return (
                <div
                  key={item.id}
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${isEditing ? "rgba(124,92,255,0.45)" : "rgba(255,255,255,0.08)"}`,
                    background: isEditing ? "rgba(124,92,255,0.07)" : "rgba(255,255,255,0.04)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    transition: "border-color .2s, background .2s",
                  }}
                >
                  {/* Product image */}
                  <div style={{ position: "relative" }}>
                    <img
                      src={isEditing ? (draft?.imageUrl || "/images/default-product.png") : (item.imageUrl || "/images/default-product.png")}
                      alt={item.name}
                      style={{
                        width: "100%", height: 140,
                        objectFit: "contain",
                        background: "rgba(0,0,0,0.3)",
                        display: "block",
                      }}
                    />
                    {/* Status pill */}
                    <span style={{
                      position: "absolute", top: 8, right: 8,
                      padding: "3px 8px", borderRadius: 20,
                      fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                      background: `${statusColor}22`, color: statusColor,
                      border: `1px solid ${statusColor}44`,
                    }}>
                      {item.status ?? "—"}
                    </span>
                  </div>

                  {/* Tile content */}
                  <div style={{ padding: "12px 12px 0", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>

                    {isEditing ? (
                      /* ── Edit mode ─────────────────────────────────── */
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <input
                          className="input"
                          placeholder="Product name"
                          value={draft?.name ?? ""}
                          onChange={(e) => patchDraft(item.id, { name: e.target.value })}
                          style={{ fontSize: 13 }}
                        />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                          <input
                            className="input"
                            type="number"
                            placeholder="Qty"
                            value={draft?.quantity ?? 0}
                            onChange={(e) => patchDraft(item.id, { quantity: Number(e.target.value) })}
                            style={{ fontSize: 13 }}
                          />
                          <input
                            className="input"
                            type="number"
                            step="0.01"
                            placeholder="Price"
                            value={draft?.unitPrice ?? 0}
                            onChange={(e) => patchDraft(item.id, { unitPrice: Number(e.target.value) })}
                            style={{ fontSize: 13 }}
                          />
                        </div>
                        <input
                          className="input"
                          placeholder="Image URL"
                          value={draft?.imageUrl ?? ""}
                          onChange={(e) => patchDraft(item.id, { imageUrl: e.target.value })}
                          style={{ fontSize: 12 }}
                        />
                      </div>
                    ) : (
                      /* ── View mode ─────────────────────────────────── */
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>
                          {item.name}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                            Qty: {item.quantity}
                          </span>
                          <span style={{ color: "#22c55e", fontWeight: 700, fontSize: 15 }}>
                            ${Number(item.unitPrice).toFixed(2)}
                          </span>
                        </div>
                        {item.shortDesc && (
                          <div style={{
                            fontSize: 11, color: "rgba(255,255,255,0.4)",
                            overflow: "hidden", textOverflow: "ellipsis",
                            display: "-webkit-box", WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}>
                            {item.shortDesc}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Action buttons ─────────────────────────────────── */}
                  <div style={{ padding: "10px 12px 12px", display: "flex", gap: 6, marginTop: "auto" }}>
                    {isEditing ? (
                      <>
                        <button
                          className="btn btnPrimary"
                          style={{ flex: 1, fontSize: 12, padding: "7px 0", opacity: isBusy ? 0.6 : 1 }}
                          disabled={isBusy}
                          onClick={() => saveItem(item.id)}
                        >
                          {isBusy ? "Saving…" : "✓ Save"}
                        </button>
                        <button
                          className="btn"
                          style={{ flex: 1, fontSize: 12, padding: "7px 0" }}
                          disabled={isBusy}
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn btnPrimary"
                          style={{ flex: 1, fontSize: 12, padding: "7px 0" }}
                          disabled={isBusy}
                          onClick={() => startEdit(item)}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="btn"
                          style={{
                            flex: 1, fontSize: 12, padding: "7px 0",
                            background: "rgba(239,68,68,0.12)", color: "#fca5a5",
                            borderColor: "rgba(239,68,68,0.25)",
                            opacity: isBusy ? 0.6 : 1,
                          }}
                          disabled={isBusy}
                          onClick={() => removeItem(item.id)}
                        >
                          {isBusy ? "…" : "🗑 Remove"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pagination controls ─────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div style={{
          display: "flex", justifyContent: "center", alignItems: "center", gap: 12,
        }}>
          <button
            className="btn"
            style={{
              padding: "10px 20px", fontSize: 18, fontWeight: 700,
              opacity: safePage <= 1 ? 0.3 : 1,
              cursor: safePage <= 1 ? "default" : "pointer",
            }}
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ←
          </button>

          {/* Page number pills */}
          <div style={{ display: "flex", gap: 6 }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                className="btn"
                style={{
                  padding: "8px 14px", fontSize: 13, fontWeight: p === safePage ? 800 : 500,
                  minWidth: 40,
                  background: p === safePage
                    ? "linear-gradient(135deg, rgba(124,92,255,0.55), rgba(124,92,255,0.25))"
                    : "rgba(255,255,255,0.05)",
                  borderColor: p === safePage ? "rgba(124,92,255,0.5)" : "rgba(255,255,255,0.1)",
                  color: p === safePage ? "#c4b5fd" : "rgba(255,255,255,0.6)",
                }}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            className="btn"
            style={{
              padding: "10px 20px", fontSize: 18, fontWeight: 700,
              opacity: safePage >= totalPages ? 0.3 : 1,
              cursor: safePage >= totalPages ? "default" : "pointer",
            }}
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            →
          </button>
        </div>
      )}

      {/* Page indicator label (shown even on page 1 if there are items) */}
      {items.length > 0 && (
        <div style={{ textAlign: "center", marginTop: -8 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            Showing {Math.min(PAGE_SIZE, items.length - (safePage - 1) * PAGE_SIZE)} of {items.length} products
            &nbsp;·&nbsp; Page {safePage} of {totalPages}
          </span>
        </div>
      )}

      {/* ── Add New Product ─────────────────────────────────────────────────── */}
      <div className="card cardPad">
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>➕ Add New Product</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Fill in the details below and click Add Product to add it to your inventory.
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr",
          gap: 12,
          alignItems: "end",
        }}>
          {/* Product Name */}
          <div className="col" style={{ gap: 6 }}>
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
              PRODUCT NAME *
            </label>
            <input
              className="input"
              placeholder="e.g. LeBron James Signed Jersey"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>

          {/* Quantity */}
          <div className="col" style={{ gap: 6 }}>
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
              QUANTITY
            </label>
            <input
              className="input"
              type="number"
              min={0}
              placeholder="0"
              value={newQty}
              onChange={(e) => setNewQty(Number(e.target.value))}
            />
          </div>

          {/* Unit Price */}
          <div className="col" style={{ gap: 6 }}>
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
              UNIT PRICE ($)
            </label>
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={newPrice}
              onChange={(e) => setNewPrice(Number(e.target.value))}
            />
          </div>

          {/* Category */}
          <div className="col" style={{ gap: 6 }}>
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
              CATEGORY *
            </label>
            <select
              className="input"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Image URL — full width */}
        <div className="col" style={{ gap: 6, marginTop: 12 }}>
          <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
            IMAGE URL (optional)
          </label>
          <input
            className="input"
            placeholder="https://example.com/image.jpg"
            value={newImageUrl}
            onChange={(e) => setNewImageUrl(e.target.value)}
          />
        </div>

        {/* Submit */}
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button
            className="btn btnPrimary"
            style={{
              padding: "12px 32px", fontWeight: 700, fontSize: 14,
              opacity: (!newName.trim() || !newCategory || addBusy) ? 0.5 : 1,
            }}
            disabled={!newName.trim() || !newCategory || addBusy}
            onClick={addItem}
          >
            {addBusy ? "Adding…" : "Add Product"}
          </button>
        </div>
      </div>
    </div>
  );
}
