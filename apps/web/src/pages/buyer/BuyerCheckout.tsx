/**
 * @fileoverview BuyerCheckout — checkout with saved addresses + payment methods
 * @module pages/buyer/BuyerCheckout.tsx
 * @author Darrell Hobson
 * @Date 2026.04.25
 *
 * Layout (2-column):
 *   Left  — Billing Address | Shipping Address | Payment
 *   Right — Order Summary + Place Order
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  checkout,
  getCart,
  getMyAddresses,
  getMyPaymentMethods,
  saveMyAddress,
  CartItem,
  AddressRecord,
  PaymentMethod,
} from "../../services/api";

// ── US States (hardcoded — no API dependency) ─────────────────────────────────

const US_STATES = [
  {a:"AL",n:"Alabama"},{a:"AK",n:"Alaska"},{a:"AZ",n:"Arizona"},{a:"AR",n:"Arkansas"},
  {a:"CA",n:"California"},{a:"CO",n:"Colorado"},{a:"CT",n:"Connecticut"},{a:"DE",n:"Delaware"},
  {a:"FL",n:"Florida"},{a:"GA",n:"Georgia"},{a:"HI",n:"Hawaii"},{a:"ID",n:"Idaho"},
  {a:"IL",n:"Illinois"},{a:"IN",n:"Indiana"},{a:"IA",n:"Iowa"},{a:"KS",n:"Kansas"},
  {a:"KY",n:"Kentucky"},{a:"LA",n:"Louisiana"},{a:"ME",n:"Maine"},{a:"MD",n:"Maryland"},
  {a:"MA",n:"Massachusetts"},{a:"MI",n:"Michigan"},{a:"MN",n:"Minnesota"},
  {a:"MS",n:"Mississippi"},{a:"MO",n:"Missouri"},{a:"MT",n:"Montana"},
  {a:"NE",n:"Nebraska"},{a:"NV",n:"Nevada"},{a:"NH",n:"New Hampshire"},
  {a:"NJ",n:"New Jersey"},{a:"NM",n:"New Mexico"},{a:"NY",n:"New York"},
  {a:"NC",n:"North Carolina"},{a:"ND",n:"North Dakota"},{a:"OH",n:"Ohio"},
  {a:"OK",n:"Oklahoma"},{a:"OR",n:"Oregon"},{a:"PA",n:"Pennsylvania"},
  {a:"RI",n:"Rhode Island"},{a:"SC",n:"South Carolina"},{a:"SD",n:"South Dakota"},
  {a:"TN",n:"Tennessee"},{a:"TX",n:"Texas"},{a:"UT",n:"Utah"},{a:"VT",n:"Vermont"},
  {a:"VA",n:"Virginia"},{a:"WA",n:"Washington"},{a:"WV",n:"West Virginia"},
  {a:"WI",n:"Wisconsin"},{a:"WY",n:"Wyoming"},
];

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 10, color: "rgba(255,255,255,0.9)",
  padding: "8px 12px", fontSize: 14, width: "100%", boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const,
  letterSpacing: "0.06em", color: "rgba(255,255,255,0.45)", display: "block",
  marginBottom: 4,
};

function SectionCard({ title, icon, children }: {
  title: string; icon: string; children: React.ReactNode;
}) {
  return (
    <div className="card cardPad">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <div className="h2" style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
      </div>
      <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 16 }} />
      {children}
    </div>
  );
}

// ── Address display + optional inline form ────────────────────────────────────

function AddressBlock({
  type,
  label,
  saved,
  onSaved,
}: {
  type: "billing" | "shipping";
  label: string;
  saved: AddressRecord | null;
  onSaved: (addr: AddressRecord) => void;
}) {
  const [editing, setEditing] = useState(!saved);
  const [busy,    setBusy]    = useState(false);
  const [saved2,  setSaved2]  = useState(false);
  const [form, setForm] = useState<AddressRecord>({
    addressType: type,
    street1: saved?.street1 ?? "",
    street2: saved?.street2 ?? "",
    city:    saved?.city    ?? "",
    state:   saved?.state   ?? "",
    zipcode: saved?.zipcode ?? "",
  });

  // Sync when saved address loads after initial render
  useEffect(() => {
    if (saved && !editing) {
      setForm({
        addressType: type,
        street1: saved.street1, street2: saved.street2 ?? "",
        city: saved.city, state: saved.state, zipcode: saved.zipcode,
      });
    }
  }, [saved?.street1, saved?.city]);

  function patch(k: keyof AddressRecord, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleSave() {
    if (!form.street1.trim() || !form.city.trim() || !form.state || !form.zipcode.trim()) return;
    setBusy(true);
    try {
      await saveMyAddress(form);
      onSaved(form);
      setEditing(false);
      setSaved2(true);
      setTimeout(() => setSaved2(false), 4000);
    } catch {
      // keep form open on error
    } finally {
      setBusy(false);
    }
  }

  if (!editing && saved) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {saved2 && (
          <div style={{
            padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: "rgba(34,197,94,0.15)", color: "#4ade80",
            border: "1px solid rgba(34,197,94,0.3)",
          }}>
            ✓ {label} saved
          </div>
        )}
        <div style={{
          background: "rgba(255,255,255,0.04)", borderRadius: 10,
          padding: "12px 14px",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        }}>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>
            {saved.street1}{saved.street2 ? `, ${saved.street2}` : ""}<br />
            {saved.city}, {saved.state} {saved.zipcode}
          </div>
          <button
            className="btn"
            style={{ fontSize: 12, padding: "4px 12px", marginLeft: 12, flexShrink: 0 }}
            onClick={() => { setForm({ addressType: type, street1: saved.street1,
              street2: saved.street2 ?? "", city: saved.city, state: saved.state,
              zipcode: saved.zipcode }); setEditing(true); }}
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  // Form mode
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {saved && (
        <div style={{ marginBottom: 4, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
          Editing {label.toLowerCase()}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>Street Address *</label>
          <input style={inputStyle} placeholder="123 Main St"
            value={form.street1} onChange={(e) => patch("street1", e.target.value)} />
        </div>
        <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>Apt / Suite</label>
          <input style={inputStyle} placeholder="Apt 4B"
            value={form.street2 ?? ""} onChange={(e) => patch("street2", e.target.value)} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>City *</label>
          <input style={inputStyle} placeholder="Atlanta"
            value={form.city} onChange={(e) => patch("city", e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>State *</label>
            <select style={{ ...inputStyle, cursor: "pointer" }}
              value={form.state} onChange={(e) => patch("state", e.target.value)}>
              <option value="">— Select —</option>
              {US_STATES.map((s) => (
                <option key={s.a} value={s.a}>{s.a} — {s.n}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>ZIP *</label>
            <input style={inputStyle} placeholder="30301" maxLength={10}
              value={form.zipcode} onChange={(e) => patch("zipcode", e.target.value)} />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
        {saved && (
          <button className="btn" style={{ fontSize: 13 }} onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
        <button
          className="btn btnPrimary"
          style={{
            fontSize: 13,
            opacity: (busy || !form.street1.trim() || !form.city.trim() || !form.state || !form.zipcode.trim()) ? 0.5 : 1,
          }}
          disabled={busy || !form.street1.trim() || !form.city.trim() || !form.state || !form.zipcode.trim()}
          onClick={handleSave}
        >
          {busy ? "Saving…" : `Save ${label}`}
        </button>
      </div>
    </div>
  );
}

// ── Payment selection / entry ─────────────────────────────────────────────────

const CARD_LABELS: Record<string, string> = {
  visa: "Visa", mastercard: "Mastercard", amex: "American Express", discover: "Discover",
};

function PaymentSection({
  methods,
  selectedId,
  onSelect,
}: {
  methods: PaymentMethod[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (methods.length === 0) {
    // No saved payment methods — show read-only notice
    return (
      <div style={{
        padding: "14px 16px", borderRadius: 10, fontSize: 14,
        background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
        No payment methods on file. Add one in your{" "}
        <a href="/buyer/profile" style={{ color: "#a78bfa", textDecoration: "underline" }}>
          Account Profile
        </a>{" "}
        before checking out.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
        Select the payment method to use for this order:
      </div>
      {methods.map((pm) => {
        const isSelected = pm.id === selectedId;
        return (
          <div
            key={pm.id}
            onClick={() => onSelect(pm.id)}
            style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "14px 16px", borderRadius: 10, cursor: "pointer",
              background: isSelected ? "rgba(124,92,255,0.12)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${isSelected ? "rgba(124,92,255,0.5)" : "rgba(255,255,255,0.08)"}`,
              transition: "background .15s, border-color .15s",
            }}
          >
            {/* Radio indicator */}
            <div style={{
              width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
              border: `2px solid ${isSelected ? "#a78bfa" : "rgba(255,255,255,0.3)"}`,
              background: isSelected ? "#a78bfa" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {isSelected && (
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />
              )}
            </div>

            <span style={{ fontSize: 22 }}>💳</span>

            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {CARD_LABELS[pm.type] ?? pm.type}
                <span style={{ color: "rgba(255,255,255,0.45)", fontWeight: 400, marginLeft: 8 }}>
                  •••• {pm.cardNumber}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                {pm.nickname && <span>"{pm.nickname}" &nbsp;·&nbsp; </span>}
                Exp {String(pm.expMonth).padStart(2,"0")}/{pm.expYear}
              </div>
            </div>

            {isSelected && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                background: "rgba(124,92,255,0.25)", color: "#c4b5fd",
              }}>
                Selected
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BuyerCheckout() {
  const navigate = useNavigate();

  // Cart
  const [items,       setItems]       = useState<CartItem[]>([]);
  const [cartLoading, setCartLoading] = useState(true);
  const [error,       setError]       = useState("");

  // Saved data
  const [billing,     setBilling]     = useState<AddressRecord | null>(null);
  const [shipping,    setShipping]    = useState<AddressRecord | null>(null);
  const [payMethods,  setPayMethods]  = useState<PaymentMethod[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Payment selection
  const [selectedPayId, setSelectedPayId] = useState<string | null>(null);

  // Checkout state
  const [placing,     setPlacing]     = useState(false);

  // ── Load cart ────────────────────────────────────────────────────────────────

  useEffect(() => {
    getCart()
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load cart"))
      .finally(() => setCartLoading(false));
  }, []);

  // ── Load saved addresses + payment methods ────────────────────────────────────

  const loadProfile = useCallback(async () => {
    const [addrResult, pmResult] = await Promise.allSettled([
      getMyAddresses(),
      getMyPaymentMethods(),
    ]);
    if (addrResult.status === "fulfilled") {
      const addrs = addrResult.value;
      setBilling(addrs.find((a) => a.addressType === "billing")  ?? null);
      setShipping(addrs.find((a) => a.addressType === "shipping") ?? null);
    }
    if (pmResult.status === "fulfilled") {
      const pms = pmResult.value;
      setPayMethods(pms);
      // Auto-select the first payment method
      if (pms.length > 0 && !selectedPayId) setSelectedPayId(pms[0].id);
    }
    setDataLoading(false);
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // ── Totals ───────────────────────────────────────────────────────────────────

  const subtotal = items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
  const tax      = subtotal * 0.07;
  const total    = subtotal + tax;

  // ── Ready check ──────────────────────────────────────────────────────────────

  const hasShipping  = !!shipping;
  const hasPayment   = payMethods.length === 0 || !!selectedPayId;
  const canCheckout  = hasShipping && hasPayment && items.length > 0 && !placing;

  // ── Place Order ───────────────────────────────────────────────────────────────

  async function handleCheckout() {
    if (!canCheckout) return;
    setPlacing(true);
    setError("");
    try {
      await checkout();
      navigate("/buyer/orders");
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Checkout failed — please try again.");
    } finally {
      setPlacing(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="col" style={{ gap: 20 }}>

      {/* Page header */}
      <div className="card cardPad">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div className="h2" style={{ fontWeight: 800, fontSize: 20 }}>🛒 Checkout</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Review your order details before placing.
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          padding: "10px 16px", borderRadius: 10, fontSize: 13,
          background: "rgba(239,68,68,0.12)", color: "#fca5a5",
          border: "1px solid rgba(239,68,68,0.3)",
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Main 2-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, alignItems: "start" }}>

        {/* ── Left column — address + payment ────────────────────────────────── */}
        <div className="col" style={{ gap: 16 }}>

          {/* Billing Address */}
          <SectionCard title="Billing Address" icon="🏠">
            {dataLoading ? (
              <div className="muted" style={{ fontSize: 13 }}>Loading…</div>
            ) : (
              <AddressBlock
                type="billing"
                label="Billing Address"
                saved={billing}
                onSaved={(addr) => setBilling(addr)}
              />
            )}
          </SectionCard>

          {/* Shipping Address */}
          <SectionCard title="Shipping Address" icon="📦">
            {dataLoading ? (
              <div className="muted" style={{ fontSize: 13 }}>Loading…</div>
            ) : (
              <>
                <AddressBlock
                  type="shipping"
                  label="Shipping Address"
                  saved={shipping}
                  onSaved={(addr) => setShipping(addr)}
                />
                {!shipping && (
                  <div style={{
                    marginTop: 10, padding: "8px 12px", borderRadius: 8,
                    fontSize: 12, background: "rgba(245,158,11,0.12)",
                    color: "#fbbf24", border: "1px solid rgba(245,158,11,0.25)",
                  }}>
                    ⚠️ A shipping address is required to place your order.
                  </div>
                )}
              </>
            )}
          </SectionCard>

          {/* Payment Method */}
          <SectionCard title="Payment Method" icon="💳">
            {dataLoading ? (
              <div className="muted" style={{ fontSize: 13 }}>Loading…</div>
            ) : (
              <PaymentSection
                methods={payMethods}
                selectedId={selectedPayId}
                onSelect={setSelectedPayId}
              />
            )}
            <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>
              * This is a simulated payment. No real transaction occurs.
            </div>
          </SectionCard>
        </div>

        {/* ── Right column — order summary ────────────────────────────────────── */}
        <div className="card cardPad" style={{ position: "sticky", top: 18 }}>
          <div className="h2" style={{ fontWeight: 800, marginBottom: 14 }}>Order Summary</div>

          {cartLoading ? (
            <div className="muted" style={{ fontSize: 13 }}>Loading cart…</div>
          ) : items.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>Your cart is empty.</div>
          ) : (
            <>
              {/* Line items */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {items.map((item) => (
                  <div key={item.productId} style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", gap: 8,
                  }}>
                    <div style={{ fontSize: 13, flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{item.name || "Item"}</div>
                      <div className="muted" style={{ fontSize: 11 }}>Qty: {item.quantity}</div>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
                      ${(Number(item.unitPrice) * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="divider" />

              {/* Totals */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span className="muted">Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span className="muted">Tax (7%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between",
                  fontWeight: 800, fontSize: 16, paddingTop: 8,
                  borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <span>Total</span>
                  <span style={{ color: "#22c55e" }}>${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Readiness checklist */}
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 5 }}>
                <CheckItem ok={!!shipping} label="Shipping address" />
                <CheckItem ok={payMethods.length === 0 || !!selectedPayId} label="Payment method" />
                <CheckItem ok={items.length > 0} label="Items in cart" />
              </div>

              {/* Place Order */}
              <button
                className="btn btnPrimary"
                style={{
                  marginTop: 18, width: "100%", padding: "13px 0",
                  fontSize: 15, fontWeight: 800,
                  opacity: canCheckout ? 1 : 0.4,
                  cursor: canCheckout ? "pointer" : "not-allowed",
                }}
                disabled={!canCheckout}
                onClick={handleCheckout}
              >
                {placing ? "Placing Order…" : "Place Order"}
              </button>

              {!hasShipping && (
                <div className="muted" style={{ fontSize: 12, textAlign: "center", marginTop: 8 }}>
                  Add a shipping address to enable checkout.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Small checklist item ──────────────────────────────────────────────────────

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
      <span style={{ color: ok ? "#22c55e" : "rgba(255,255,255,0.25)", fontSize: 14 }}>
        {ok ? "✓" : "○"}
      </span>
      <span style={{ color: ok ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)" }}>
        {label}
      </span>
    </div>
  );
}
