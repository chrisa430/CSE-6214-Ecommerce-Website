import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  getBrowsableProducts,
  getMyProducts,
  getMyTrades,
  proposeTrade,
  acceptTrade,
  declineTrade,
  cancelTrade,
  TradableProduct,
  TradeRecord,
  Product,
  extractApiError,
} from "../../services/api";

type Tab = "browse" | "incoming" | "outgoing";

// ── Status badge helpers ────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:   "rgba(255,200,50,0.9)",
  accepted:  "rgba(50,200,100,0.9)",
  declined:  "rgba(255,80,80,0.9)",
  cancelled: "rgba(150,150,150,0.9)",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      style={{
        background: STATUS_COLORS[status] ?? "rgba(180,180,180,0.8)",
        color: "#000",
        borderRadius: 6,
        padding: "2px 10px",
        fontSize: 12,
        fontWeight: 700,
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  );
}

// ── Propose trade panel ─────────────────────────────────────────────────────

interface ProposePanelProps {
  target: TradableProduct;
  myProducts: Product[];
  onClose: () => void;
  onSuccess: () => void;
}

function ProposePanel({ target, myProducts, onClose, onSuccess }: ProposePanelProps) {
  const [selectedId, setSelectedId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const activeOwned = myProducts.filter((p) => p.status === "Active" || p.status === "active");

  async function handleSubmit() {
    if (!selectedId) { setError("Select one of your products to offer."); return; }
    setSubmitting(true);
    setError("");
    try {
      await proposeTrade(selectedId, target.id, notes || undefined);
      onSuccess();
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="card cardPad col"
        style={{ gap: 16, maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="h2">Propose a Trade</div>
          <button
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 20, lineHeight: 1 }}
            onClick={onClose}
          >×</button>
        </div>

        {/* Target product */}
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>YOU WANT</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", background: "rgba(124,92,255,0.1)", border: "1px solid rgba(124,92,255,0.3)", borderRadius: 10, padding: 12 }}>
            <img
              src={target.imageUrl || "/images/default-product.png"}
              alt={target.name}
              style={{ width: 64, height: 64, objectFit: "contain", borderRadius: 6, background: "#181717" }}
            />
            <div>
              <div style={{ fontWeight: 700 }}>{target.name}</div>
              <div className="muted" style={{ fontSize: 13 }}>${Number(target.unitPrice).toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* Offer selection */}
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>YOU OFFER (select one of your active products)</div>
          {activeOwned.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>You have no active products to offer.</div>
          ) : (
            <div className="col" style={{ gap: 8, maxHeight: 260, overflowY: "auto" }}>
              {activeOwned.map((p) => {
                const selected = selectedId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    style={{
                      display: "flex", gap: 12, alignItems: "center",
                      background: selected ? "rgba(124,92,255,0.18)" : "rgba(255,255,255,0.04)",
                      border: selected ? "1px solid rgba(124,92,255,0.6)" : "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 10, padding: 12, cursor: "pointer",
                    }}
                  >
                    <img
                      src={p.imageUrl || "/images/default-product.png"}
                      alt={p.name}
                      style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 6, background: "#181717" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>${Number(p.unitPrice).toFixed(2)}</div>
                    </div>
                    {selected && (
                      <span style={{ color: "rgba(124,92,255,1)", fontWeight: 700, fontSize: 18 }}>✓</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Optional notes */}
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>NOTES (optional)</div>
          <textarea
            className="input"
            rows={2}
            placeholder="Add a message to the other seller..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ resize: "vertical", fontFamily: "inherit" }}
          />
        </div>

        {error && <div style={{ color: "rgb(255,80,80)", fontSize: 13 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btnPrimary"
            onClick={handleSubmit}
            disabled={submitting || !selectedId}
            style={{ flex: 1 }}
          >
            {submitting ? "Sending…" : "Send Trade Proposal"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function SellerTrades() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("browse");

  const [browsable, setBrowsable] = useState<TradableProduct[]>([]);
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const [proposingFor, setProposingFor] = useState<TradableProduct | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [b, mp, t] = await Promise.all([
        getBrowsableProducts(),
        getMyProducts(),
        getMyTrades(),
      ]);
      setBrowsable(Array.isArray(b) ? b : []);
      setMyProducts(Array.isArray(mp) ? mp : []);
      setTrades(Array.isArray(t) ? t : []);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function handleAccept(tradeId: string) {
    try {
      await acceptTrade(tradeId);
      showToast("Trade accepted — both products marked as traded.");
      loadAll();
    } catch (err) {
      showToast(extractApiError(err));
    }
  }

  async function handleDecline(tradeId: string) {
    try {
      await declineTrade(tradeId);
      showToast("Trade declined.");
      loadAll();
    } catch (err) {
      showToast(extractApiError(err));
    }
  }

  async function handleCancel(tradeId: string) {
    try {
      await cancelTrade(tradeId);
      showToast("Trade proposal cancelled.");
      loadAll();
    } catch (err) {
      showToast(extractApiError(err));
    }
  }

  const incoming = trades.filter((t) => t.receiverId === user?.id);
  const outgoing = trades.filter((t) => t.proposerId === user?.id);
  const pendingIncoming = incoming.filter((t) => t.status === "pending").length;

  const filteredBrowsable = browsable.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="card cardPad">Loading trades…</div>;

  return (
    <div className="col" style={{ gap: 16 }}>
      {toast && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 9999,
          background: "rgba(124,92,255,0.95)", color: "#fff",
          padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14,
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)", pointerEvents: "none",
        }}>
          {toast}
        </div>
      )}

      {proposingFor && (
        <ProposePanel
          target={proposingFor}
          myProducts={myProducts}
          onClose={() => setProposingFor(null)}
          onSuccess={() => {
            setProposingFor(null);
            showToast("Trade proposal sent!");
            loadAll();
            setTab("outgoing");
          }}
        />
      )}

      <div className="card cardPad">
        <div className="h2">Seller Trades</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Propose product swaps with other sellers. When a trade is accepted both items are removed from the marketplace.
        </div>
      </div>

      {error && <div className="card cardPad" style={{ color: "rgb(255,80,80)" }}>{error}</div>}

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 10 }}>
        {(["browse", "incoming", "outgoing"] as Tab[]).map((t) => (
          <button
            key={t}
            className="btn"
            style={{
              background: tab === t ? "rgba(124,92,255,0.25)" : "rgba(255,255,255,0.06)",
              color: tab === t ? "rgba(124,92,255,1)" : "rgba(255,255,255,0.7)",
              border: tab === t ? "1px solid rgba(124,92,255,0.5)" : "1px solid rgba(255,255,255,0.12)",
              textTransform: "capitalize",
            }}
            onClick={() => setTab(t)}
          >
            {t === "incoming" && pendingIncoming > 0
              ? `Incoming (${pendingIncoming} pending)`
              : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── BROWSE TAB ──────────────────────────────────────────────────── */}
      {tab === "browse" && (
        <>
          <div className="card cardPad">
            <input
              className="input"
              type="text"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filteredBrowsable.length === 0 ? (
            <div className="card cardPad muted">No products from other sellers are currently available.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
              {filteredBrowsable.map((p) => (
                <div key={p.id} className="card cardPad col" style={{ gap: 10 }}>
                  <img
                    src={p.imageUrl || "/images/default-product.png"}
                    alt={p.name}
                    style={{ width: "100%", height: 160, objectFit: "contain", borderRadius: 8, background: "#181717", padding: 6 }}
                  />
                  <div className="h2" style={{ fontSize: 16 }}>{p.name}</div>
                  {p.shortDesc && <div className="muted" style={{ fontSize: 12 }}>{p.shortDesc}</div>}
                  <div style={{ fontWeight: 700 }}>${Number(p.unitPrice).toFixed(2)}</div>
                  <div className="muted" style={{ fontSize: 12 }}>In stock: {p.quantity}</div>

                  {/* Seller identity */}
                  <div style={{
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    paddingTop: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 0.8 }}>Sold by</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
                      {p.sellerFirstName} {p.sellerLastName}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                      {p.sellerEmail}
                    </div>
                  </div>

                  <button
                    className="btn btnPrimary"
                    style={{ fontSize: 13 }}
                    onClick={() => setProposingFor(p)}
                  >
                    Propose Trade
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── INCOMING TAB ────────────────────────────────────────────────── */}
      {tab === "incoming" && (
        <div className="card cardPad">
          {incoming.length === 0 ? (
            <div className="muted">No incoming trade proposals.</div>
          ) : (
            <div className="col" style={{ gap: 12 }}>
              {incoming.map((tr) => (
                <TradeRow
                  key={tr.id}
                  trade={tr}
                  direction="incoming"
                  onAccept={() => handleAccept(tr.id)}
                  onDecline={() => handleDecline(tr.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── OUTGOING TAB ────────────────────────────────────────────────── */}
      {tab === "outgoing" && (
        <div className="card cardPad">
          {outgoing.length === 0 ? (
            <div className="muted">You haven't sent any trade proposals yet.</div>
          ) : (
            <div className="col" style={{ gap: 12 }}>
              {outgoing.map((tr) => (
                <TradeRow
                  key={tr.id}
                  trade={tr}
                  direction="outgoing"
                  onCancel={() => handleCancel(tr.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Trade row component ─────────────────────────────────────────────────────

interface TradeRowProps {
  trade: TradeRecord;
  direction: "incoming" | "outgoing";
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
}

function TradeRow({ trade, direction, onAccept, onDecline, onCancel }: TradeRowProps) {
  const isPending = trade.status === "pending";

  return (
    <div style={{
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12, padding: 16,
      background: "rgba(255,255,255,0.03)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
          {new Date(trade.createdAt).toLocaleDateString()}
        </div>
        <StatusBadge status={trade.status} />
      </div>

      {/* Products side-by-side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center" }}>
        {/* Left: offered product */}
        <ProductMini
          name={trade.offeredProductName}
          price={trade.offeredProductPrice}
          image={trade.offeredProductImage}
          label={direction === "outgoing" ? "You offer" : "They offer"}
        />

        <div style={{ textAlign: "center", fontSize: 22, color: "rgba(124,92,255,0.8)" }}>⇄</div>

        {/* Right: requested product */}
        <ProductMini
          name={trade.requestedProductName}
          price={trade.requestedProductPrice}
          image={trade.requestedProductImage}
          label={direction === "outgoing" ? "You want" : "They want"}
        />
      </div>

      {trade.notes && (
        <div style={{ marginTop: 10, fontSize: 13, color: "rgba(255,255,255,0.55)", fontStyle: "italic" }}>
          "{trade.notes}"
        </div>
      )}

      {isPending && (
        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          {direction === "incoming" && (
            <>
              <button className="btn btnPrimary" style={{ flex: 1 }} onClick={onAccept}>
                Accept
              </button>
              <button className="btn btnDanger" onClick={onDecline}>
                Decline
              </button>
            </>
          )}
          {direction === "outgoing" && (
            <button className="btn btnDanger" onClick={onCancel}>
              Cancel Proposal
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ProductMini({ name, price, image, label }: { name: string; price: number; image: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <img
        src={image}
        alt={name}
        style={{ width: 72, height: 72, objectFit: "contain", borderRadius: 8, background: "#181717", padding: 4 }}
      />
      <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>${Number(price).toFixed(2)}</div>
    </div>
  );
}
