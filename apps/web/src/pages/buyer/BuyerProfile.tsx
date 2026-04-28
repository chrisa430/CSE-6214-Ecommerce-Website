/**
 * @fileoverview BuyerProfile — account info, billing/shipping addresses, payment methods
 * @module pages/buyer/BuyerProfile.tsx
 * @author Darrell Hobson
 * @Date 2026.04.24
 */
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  updateMyProfile,
  getMyAddresses,
  saveMyAddress,
  getMyPaymentMethods,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  AddressRecord,
  PaymentMethod,
} from "../../services/api";

// ── US States — hardcoded so dropdown always works regardless of API ─────────

const US_STATES = [
  {abbreviation:"AL",name:"Alabama"},{abbreviation:"AK",name:"Alaska"},
  {abbreviation:"AZ",name:"Arizona"},{abbreviation:"AR",name:"Arkansas"},
  {abbreviation:"CA",name:"California"},{abbreviation:"CO",name:"Colorado"},
  {abbreviation:"CT",name:"Connecticut"},{abbreviation:"DE",name:"Delaware"},
  {abbreviation:"FL",name:"Florida"},{abbreviation:"GA",name:"Georgia"},
  {abbreviation:"HI",name:"Hawaii"},{abbreviation:"ID",name:"Idaho"},
  {abbreviation:"IL",name:"Illinois"},{abbreviation:"IN",name:"Indiana"},
  {abbreviation:"IA",name:"Iowa"},{abbreviation:"KS",name:"Kansas"},
  {abbreviation:"KY",name:"Kentucky"},{abbreviation:"LA",name:"Louisiana"},
  {abbreviation:"ME",name:"Maine"},{abbreviation:"MD",name:"Maryland"},
  {abbreviation:"MA",name:"Massachusetts"},{abbreviation:"MI",name:"Michigan"},
  {abbreviation:"MN",name:"Minnesota"},{abbreviation:"MS",name:"Mississippi"},
  {abbreviation:"MO",name:"Missouri"},{abbreviation:"MT",name:"Montana"},
  {abbreviation:"NE",name:"Nebraska"},{abbreviation:"NV",name:"Nevada"},
  {abbreviation:"NH",name:"New Hampshire"},{abbreviation:"NJ",name:"New Jersey"},
  {abbreviation:"NM",name:"New Mexico"},{abbreviation:"NY",name:"New York"},
  {abbreviation:"NC",name:"North Carolina"},{abbreviation:"ND",name:"North Dakota"},
  {abbreviation:"OH",name:"Ohio"},{abbreviation:"OK",name:"Oklahoma"},
  {abbreviation:"OR",name:"Oregon"},{abbreviation:"PA",name:"Pennsylvania"},
  {abbreviation:"RI",name:"Rhode Island"},{abbreviation:"SC",name:"South Carolina"},
  {abbreviation:"SD",name:"South Dakota"},{abbreviation:"TN",name:"Tennessee"},
  {abbreviation:"TX",name:"Texas"},{abbreviation:"UT",name:"Utah"},
  {abbreviation:"VT",name:"Vermont"},{abbreviation:"VA",name:"Virginia"},
  {abbreviation:"WA",name:"Washington"},{abbreviation:"WV",name:"West Virginia"},
  {abbreviation:"WI",name:"Wisconsin"},{abbreviation:"WY",name:"Wyoming"},
];

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 10, color: "rgba(255,255,255,0.9)",
  padding: "8px 12px", fontSize: 14, width: "100%",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.06em", color: "rgba(255,255,255,0.45)", marginBottom: 4,
};

function SectionCard({ title, icon, children }: {
  title: string; icon: string; children: React.ReactNode;
}) {
  return (
    <div className="card cardPad">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <div className="h2" style={{ fontSize: 17, fontWeight: 800 }}>{title}</div>
      </div>
      <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 16 }} />
      {children}
    </div>
  );
}

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 9999,
      padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14,
      background: ok ? "rgba(34,197,94,0.92)" : "rgba(239,68,68,0.92)",
      color: "#fff", boxShadow: "0 4px 16px rgba(0,0,0,.4)",
    }}>
      {msg}
    </div>
  );
}

// ── Address form component ─────────────────────────────────────────────────────

function AddressSection({
  type, label, existing, onSave,
}: {
  type: "billing" | "shipping";
  label: string;
  existing: AddressRecord | null;
  onSave: (addr: AddressRecord) => Promise<void>;
}) {
  const [editing, setEditing] = useState(!existing);
  const [busy,    setBusy]    = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [form,    setForm]    = useState<AddressRecord>({
    addressType: type,
    street1: existing?.street1 ?? "",
    street2: existing?.street2 ?? "",
    city:    existing?.city    ?? "",
    state:   existing?.state   ?? "",
    zipcode: existing?.zipcode ?? "",
  });

  // When parent loads an existing address after save, switch to view mode
  useEffect(() => {
    if (existing) {
      setEditing(false);
      setForm({
        addressType: type,
        street1: existing.street1 ?? "",
        street2: existing.street2 ?? "",
        city:    existing.city    ?? "",
        state:   existing.state   ?? "",
        zipcode: existing.zipcode ?? "",
      });
    }
  }, [existing?.street1, existing?.city, existing?.zipcode]);

  function patch(key: keyof AddressRecord, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit() {
    if (!form.street1 || !form.city || !form.state || !form.zipcode) return;
    setBusy(true);
    try {
      await onSave(form);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch {
      // parent shows toast on error
    } finally {
      setBusy(false);
    }
  }

  if (!editing && existing) {
    return (
      <div className="col" style={{ gap: 8 }}>
        {saved && (
          <div style={{
            padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: "rgba(34,197,94,0.15)", color: "#4ade80",
            border: "1px solid rgba(34,197,94,0.3)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            ✓ {label} saved successfully
          </div>
        )}
        <div style={{
          background: "rgba(255,255,255,0.04)", borderRadius: 12,
          padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        }}>
          <div className="col" style={{ gap: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{label}</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>
              {existing.street1}{existing.street2 ? `, ${existing.street2}` : ""}<br />
              {existing.city}, {existing.state} {existing.zipcode}
            </div>
          </div>
          <button
            className="btn"
            style={{ fontSize: 12, padding: "6px 14px" }}
            onClick={() => {
              setForm({ addressType: type, street1: existing.street1, street2: existing.street2 ?? "",
                        city: existing.city, state: existing.state, zipcode: existing.zipcode });
              setEditing(true);
            }}
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{existing ? `Update ${label}` : `Add ${label}`}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="col" style={{ gap: 4 }}>
          <label style={labelStyle}>Street Address *</label>
          <input style={inputStyle} placeholder="123 Main St" value={form.street1}
            onChange={(e) => patch("street1", e.target.value)} />
        </div>
        <div className="col" style={{ gap: 4 }}>
          <label style={labelStyle}>Apt / Suite</label>
          <input style={inputStyle} placeholder="Apt 4B" value={form.street2 ?? ""}
            onChange={(e) => patch("street2", e.target.value)} />
        </div>
        <div className="col" style={{ gap: 4 }}>
          <label style={labelStyle}>City *</label>
          <input style={inputStyle} placeholder="Atlanta" value={form.city}
            onChange={(e) => patch("city", e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="col" style={{ gap: 4 }}>
            <label style={labelStyle}>State *</label>
            <select
              style={{ ...inputStyle, cursor: "pointer" }}
              value={form.state}
              onChange={(e) => patch("state", e.target.value)}
            >
              <option value="">— Select —</option>
              {US_STATES.map((s) => (
                <option key={s.abbreviation} value={s.abbreviation}>{s.abbreviation} — {s.name}</option>
              ))}
            </select>
          </div>
          <div className="col" style={{ gap: 4 }}>
            <label style={labelStyle}>ZIP *</label>
            <input style={inputStyle} placeholder="30301" value={form.zipcode}
              onChange={(e) => patch("zipcode", e.target.value)} />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        {existing && (
          <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
        )}
        <button
          className="btn btnPrimary"
          disabled={busy || !form.street1 || !form.city || !form.state || !form.zipcode}
          onClick={handleSubmit}
          style={{ opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "Saving…" : "Save Address"}
        </button>
      </div>
    </div>
  );
}

// ── Payment method card ───────────────────────────────────────────────────────

const CARD_ICONS: Record<string, string> = {
  visa: "💳", mastercard: "💳", amex: "💳", discover: "💳",
};
const CARD_LABELS: Record<string, string> = {
  visa: "Visa", mastercard: "Mastercard", amex: "Amex", discover: "Discover",
};

function PaymentCard({
  pm, onDelete, onUpdate,
}: {
  pm: PaymentMethod;
  onDelete: () => Promise<void>;
  onUpdate: (data: Partial<PaymentMethod>) => Promise<void>;
}) {
  const [editing,  setEditing]  = useState(false);
  const [busy,     setBusy]     = useState(false);
  const [nickname, setNickname] = useState(pm.nickname ?? "");

  // Keep nickname field in sync if parent refreshes
  const displayNickname = pm.nickname || nickname;

  async function handleDelete() {
    if (!window.confirm("Remove this payment method?")) return;
    setBusy(true);
    try { await onDelete(); } finally { setBusy(false); }
  }

  async function handleUpdate() {
    setBusy(true);
    try {
      await onUpdate({ nickname });
      setEditing(false);
    } finally { setBusy(false); }
  }

  return (
    <div style={{
      background: "rgba(255,255,255,0.05)", borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.1)",
      padding: "16px", display: "flex", flexDirection: "column", gap: 12,
    }}>
      {/* Card info row — always visible */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>{CARD_ICONS[pm.type] ?? "💳"}</span>
          <div className="col" style={{ gap: 3 }}>
            {/* Type + last 4 */}
            <div style={{ fontWeight: 800, fontSize: 15 }}>
              {CARD_LABELS[pm.type] ?? pm.type}
              <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 400, marginLeft: 8 }}>
                •••• {pm.cardNumber}
              </span>
            </div>
            {/* Nickname — shown if set */}
            {pm.nickname && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", fontStyle: "italic" }}>
                "{pm.nickname}"
              </div>
            )}
            {/* Expiry */}
            <div className="muted" style={{ fontSize: 12 }}>
              Expires {String(pm.expMonth).padStart(2,"0")}/{pm.expYear}
            </div>
          </div>
        </div>

        {/* Action buttons — always visible */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            className="btn btnPrimary"
            style={{ fontSize: 12, padding: "6px 14px" }}
            onClick={() => { setNickname(pm.nickname ?? ""); setEditing((e) => !e); }}
          >
            {editing ? "Cancel" : "Update"}
          </button>
          <button
            className="btn"
            style={{
              fontSize: 12, padding: "6px 14px",
              background: "rgba(239,68,68,0.13)", color: "#fca5a5",
              borderColor: "rgba(239,68,68,0.3)", opacity: busy ? 0.5 : 1,
            }}
            disabled={busy}
            onClick={handleDelete}
          >
            {busy ? "…" : "Remove"}
          </button>
        </div>
      </div>

      {/* Update form — shown only when editing */}
      {editing && (
        <div style={{
          display: "flex", gap: 8, alignItems: "center",
          paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div className="col" style={{ gap: 4, flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.06em", color: "rgba(255,255,255,0.45)" }}>
              Nickname
            </label>
            <input
              style={{ ...inputStyle }}
              placeholder="e.g. Personal Visa, Work Card…"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoFocus
            />
          </div>
          <button
            className="btn btnPrimary"
            style={{ alignSelf: "flex-end", padding: "8px 18px", fontWeight: 700, opacity: busy ? 0.6 : 1 }}
            disabled={busy}
            onClick={handleUpdate}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Add payment method form ───────────────────────────────────────────────────

function AddPaymentForm({ onAdd }: { onAdd: (pm: {
  type: string; nickname?: string; cardNumber: string; expMonth: number; expYear: number;
}) => Promise<void> }) {
  const [open,      setOpen]      = useState(false);
  const [busy,      setBusy]      = useState(false);
  const [type,      setType]      = useState("visa");
  const [nickname,  setNickname]  = useState("");
  const [card,      setCard]      = useState("");
  const [expMonth,  setExpMonth]  = useState("");
  const [expYear,   setExpYear]   = useState("");

  const currentYear = new Date().getFullYear();

  async function handleAdd() {
    if (!card || !expMonth || !expYear) return;
    setBusy(true);
    try {
      await onAdd({ type, nickname: nickname || undefined,
        cardNumber: card, expMonth: parseInt(expMonth), expYear: parseInt(expYear) });
      setCard(""); setNickname(""); setExpMonth(""); setExpYear(""); setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn btnPrimary" style={{ alignSelf: "flex-start" }}
        onClick={() => setOpen(true)}>
        + Add Payment Method
      </button>
    );
  }

  return (
    <div style={{ background: "rgba(124,92,255,0.06)", borderRadius: 12,
      padding: "16px", border: "1px solid rgba(124,92,255,0.2)" }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>New Payment Method</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="col" style={{ gap: 4 }}>
          <label style={labelStyle}>Card Type *</label>
          <select style={{ ...inputStyle, cursor: "pointer" }} value={type}
            onChange={(e) => setType(e.target.value)}>
            <option value="visa">Visa</option>
            <option value="mastercard">Mastercard</option>
            <option value="amex">American Express</option>
            <option value="discover">Discover</option>
          </select>
        </div>
        <div className="col" style={{ gap: 4 }}>
          <label style={labelStyle}>Nickname</label>
          <input style={inputStyle} placeholder="e.g. Personal Visa"
            value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </div>
        <div className="col" style={{ gap: 4 }}>
          <label style={labelStyle}>Card Number *</label>
          <input style={inputStyle} placeholder="•••• •••• •••• 1234" maxLength={19}
            value={card} onChange={(e) => setCard(e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="col" style={{ gap: 4 }}>
            <label style={labelStyle}>Exp Month *</label>
            <select style={{ ...inputStyle, cursor: "pointer" }} value={expMonth}
              onChange={(e) => setExpMonth(e.target.value)}>
              <option value="">MM</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{String(m).padStart(2,"0")}</option>
              ))}
            </select>
          </div>
          <div className="col" style={{ gap: 4 }}>
            <label style={labelStyle}>Exp Year *</label>
            <select style={{ ...inputStyle, cursor: "pointer" }} value={expYear}
              onChange={(e) => setExpYear(e.target.value)}>
              <option value="">YYYY</option>
              {Array.from({ length: 10 }, (_, i) => currentYear + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
        <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
        <button
          className="btn btnPrimary"
          disabled={busy || !card || !expMonth || !expYear}
          onClick={handleAdd}
          style={{ opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "Adding…" : "Add Payment Method"}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BuyerProfile() {
  const { user } = useAuth();

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName,  setLastName]  = useState(user?.lastName  ?? "");
  const [profileBusy, setProfileBusy] = useState(false);

  const [addresses,  setAddresses]  = useState<AddressRecord[]>([]);
  const [payments,   setPayments]   = useState<PaymentMethod[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  const loadData = useCallback(async () => {
    setDataLoading(true);
    // Fetch independently so one failure doesn't block the other from rendering
    const [addrResult, pmResult] = await Promise.allSettled([
      getMyAddresses(),
      getMyPaymentMethods(),
    ]);
    if (addrResult.status === "fulfilled") setAddresses(addrResult.value);
    if (pmResult.status   === "fulfilled") setPayments(pmResult.value);
    setDataLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const billing  = addresses.find((a) => a.addressType === "billing")  ?? null;
  const shipping = addresses.find((a) => a.addressType === "shipping") ?? null;

  async function handleProfileSave() {
    setProfileBusy(true);
    try {
      await updateMyProfile(firstName, lastName);
      showToast("Profile updated ✓");
    } catch {
      showToast("Failed to update profile", false);
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleSaveAddress(addr: AddressRecord) {
    try {
      await saveMyAddress(addr);
      await loadData();
      showToast(`${addr.addressType === "billing" ? "Billing" : "Shipping"} address saved ✓`);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Failed to save address — please try again";
      showToast(msg, false);
      throw err;   // re-throw so AddressSection keeps the form open
    }
  }

  async function handleDeletePayment(id: string) {
    try {
      await deletePaymentMethod(id);
      await loadData();
      showToast("Payment method removed");
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? "Failed to remove payment method", false);
    }
  }

  async function handleUpdatePayment(id: string, data: Partial<PaymentMethod>) {
    try {
      await updatePaymentMethod(id, data);
      await loadData();
      showToast("Payment method updated ✓");
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? "Failed to update payment method", false);
    }
  }

  async function handleAddPayment(pm: {
    type: string; nickname?: string; cardNumber: string; expMonth: number; expYear: number;
  }) {
    try {
      await addPaymentMethod(pm);
      await loadData();
      showToast("Payment method added ✓");
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? "Failed to add payment method", false);
      throw err;
    }
  }

  return (
    <div className="col" style={{ gap: 20 }}>
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      {/* ── Account Info ─────────────────────────────────────────────────── */}
      <SectionCard title="Account Information" icon="👤">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="col" style={{ gap: 4, gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Email Address</label>
            <input style={{ ...inputStyle, opacity: 0.6 }} value={user?.email ?? ""} disabled />
          </div>
          <div className="col" style={{ gap: 4 }}>
            <label style={labelStyle}>First Name</label>
            <input style={inputStyle} value={firstName}
              onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="col" style={{ gap: 4 }}>
            <label style={labelStyle}>Last Name</label>
            <input style={inputStyle} value={lastName}
              onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn btnPrimary" onClick={handleProfileSave}
            disabled={profileBusy} style={{ opacity: profileBusy ? 0.6 : 1 }}>
            {profileBusy ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </SectionCard>

      {/* ── Billing Address ───────────────────────────────────────────────── */}
      <SectionCard title="Billing Address" icon="🏠">
        {dataLoading ? (
          <div className="muted" style={{ fontSize: 13 }}>Loading…</div>
        ) : (
          <AddressSection
            type="billing"
            label="Billing Address"
            existing={billing}
            onSave={handleSaveAddress}
          />
        )}
      </SectionCard>

      {/* ── Shipping Address ──────────────────────────────────────────────── */}
      <SectionCard title="Shipping Address" icon="📦">
        {dataLoading ? (
          <div className="muted" style={{ fontSize: 13 }}>Loading…</div>
        ) : (
          <AddressSection
            type="shipping"
            label="Shipping Address"
            existing={shipping}
            onSave={handleSaveAddress}
          />
        )}
      </SectionCard>

      {/* ── Payment Methods ───────────────────────────────────────────────── */}
      <SectionCard title="Payment Methods" icon="💳">
        <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          You can store up to 2 payment methods. Only the last 4 digits of your card number are saved.
        </div>

        {dataLoading ? (
          <div className="muted" style={{ fontSize: 13 }}>Loading…</div>
        ) : (
          <div className="col" style={{ gap: 10 }}>
            {payments.map((pm) => (
              <PaymentCard
                key={pm.id}
                pm={pm}
                onDelete={() => handleDeletePayment(pm.id)}
                onUpdate={(data) => handleUpdatePayment(pm.id, data)}
              />
            ))}

            {payments.length === 0 && (
              <div className="muted" style={{ fontSize: 13, fontStyle: "italic", marginBottom: 8 }}>
                No payment methods on file.
              </div>
            )}

            {payments.length < 2 && (
              <AddPaymentForm onAdd={handleAddPayment} />
            )}

            {payments.length >= 2 && (
              <div className="muted" style={{ fontSize: 12 }}>
                Maximum of 2 payment methods reached. Remove one to add another.
              </div>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
