/**
 * @fileoverview AdminRSSFeeds — admin dashboard for RSS feed monitoring
 * @module pages/admin/AdminRSSFeeds.tsx
 * @author Darrell Hobson
 * @Date 2026.04.24
 *
 * Provides admins with:
 *  - Summary cards per feed type (item count + subscriber count)
 *  - Complete feed event log with filtering
 *  - Full subscriber table with seller emails
 *  - Direct RSS feed links for each channel
 */
import { useEffect, useState } from "react";
import {
  getRssAdminSummary,
  getRssAdminSubscribers,
  getRssFeedItems,
  type RssFeedItem,
  type RssFeedItemMetadata,
  type RssAdminSummaryRow,
  type RssSubscriberRow,
} from "../../services/api";

const FEED_ICONS: Record<string, string> = {
  product_activations: "✅",
  product_blocks:      "🔒",
  product_sales:       "🛒",
  product_returns:     "↩",
  account_blocks:      "🚫",
};

const FEED_COLORS: Record<string, string> = {
  product_activations: "#a78bfa",
  product_blocks:      "#fb923c",
  product_sales:       "#34d399",
  product_returns:     "#fbbf24",
  account_blocks:      "#f87171",
};

type Tab = "overview" | "events" | "subscribers";

export default function AdminRSSFeeds() {
  const [tab,          setTab]          = useState<Tab>("overview");
  const [summary,      setSummary]      = useState<RssAdminSummaryRow[]>([]);
  const [recentItems,  setRecentItems]  = useState<RssFeedItem[]>([]);
  const [allItems,     setAllItems]     = useState<RssFeedItem[]>([]);
  const [subscribers,  setSubscribers]  = useState<RssSubscriberRow[]>([]);
  const [filterType,   setFilterType]   = useState<string>("");
  const [loading,      setLoading]      = useState(true);
  const [toast,        setToast]        = useState<string | null>(null);

  const baseUrl = window.location.origin;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function load() {
    setLoading(true);
    try {
      const [sum, subs, items] = await Promise.all([
        getRssAdminSummary(),
        getRssAdminSubscribers(),
        getRssFeedItems({ limit: 100 }),
      ]);
      setSummary(Array.isArray(sum?.summary) ? sum.summary : []);
      setRecentItems(Array.isArray(sum?.recentItems) ? sum.recentItems : []);
      setSubscribers(Array.isArray(subs) ? subs : []);
      setAllItems(Array.isArray(items) ? items : []);
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function copyFeedUrl(feedType: string) {
    const url = `${baseUrl}/api/admin/rss/${feedType}.xml`;
    navigator.clipboard.writeText(url).then(() => showToast(`Copied feed URL for ${feedType}`));
  }

  const filteredItems = filterType
    ? allItems.filter((i) => i.feedType === filterType)
    : allItems;

  if (loading) {
    return (
      <div className="card cardPad" style={{ textAlign: "center", padding: 40 }}>
        <div className="muted">Loading RSS dashboard…</div>
      </div>
    );
  }

  const totalItems       = summary.reduce((s, r) => s + r.itemCount,       0);
  const totalSubscribers = subscribers.length;

  return (
    <div className="col" style={{ gap: 18 }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 1000,
          padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14,
          background: "rgba(34,197,94,0.9)", color: "#fff",
          boxShadow: "0 4px 12px rgba(0,0,0,.3)",
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="card cardPad">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="col" style={{ gap: 6 }}>
            <div className="h2">📡 RSS Feed Management</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Monitor feed activity, manage subscribers, and access live RSS channels.
            </div>
          </div>
          <div className="row" style={{ gap: 12 }}>
            <StatPill label="Total Events"      value={totalItems}       color="#a78bfa" />
            <StatPill label="Subscriptions"     value={totalSubscribers} color="#34d399" />
          </div>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="row" style={{ gap: 8 }}>
        {(["overview", "events", "subscribers"] as Tab[]).map((t) => (
          <button
            key={t}
            className="btn"
            style={{
              fontWeight: tab === t ? 700 : 400,
              background: tab === t ? "rgba(124,92,255,0.2)" : "rgba(255,255,255,0.05)",
              color: tab === t ? "#a78bfa" : "rgba(255,255,255,0.6)",
              textTransform: "capitalize",
            }}
            onClick={() => setTab(t)}
          >
            {t === "overview" ? "📊 Overview" : t === "events" ? "📋 Events" : "👥 Subscribers"}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={load} style={{ fontSize: 12 }}>
          ↺ Refresh
        </button>
      </div>

      {/* ── OVERVIEW TAB ────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="col" style={{ gap: 14 }}>
          {/* Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {summary.map((row) => (
              <div
                key={row.feedType}
                className="card cardPad"
                style={{ borderLeft: `3px solid ${FEED_COLORS[row.feedType] ?? "#94a3b8"}` }}
              >
                <div className="col" style={{ gap: 10 }}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <div className="row" style={{ gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 20 }}>{FEED_ICONS[row.feedType] ?? "📋"}</span>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{row.label}</div>
                    </div>
                    <button
                      className="btn"
                      style={{ padding: "4px 10px", fontSize: 11 }}
                      onClick={() => copyFeedUrl(row.feedType)}
                    >
                      Copy RSS URL
                    </button>
                  </div>

                  <div className="row" style={{ gap: 20 }}>
                    <div className="col" style={{ gap: 2 }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: FEED_COLORS[row.feedType] ?? "#a78bfa" }}>
                        {row.itemCount}
                      </div>
                      <div className="muted" style={{ fontSize: 11 }}>Total Events</div>
                    </div>
                    <div className="col" style={{ gap: 2 }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: "#60a5fa" }}>
                        {row.subscriberCount}
                      </div>
                      <div className="muted" style={{ fontSize: 11 }}>Subscribers</div>
                    </div>
                  </div>

                  {/* RSS link */}
                  <div style={{
                    background: "rgba(0,0,0,0.2)", borderRadius: 6, padding: "5px 8px",
                    fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.4)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {baseUrl}/api/admin/rss/{row.feedType}.xml
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Activity */}
          <div className="card cardPad">
            <div className="col" style={{ gap: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Recent Activity</div>
              {recentItems.length === 0 ? (
                <div className="muted" style={{ textAlign: "center", padding: 16, fontSize: 13 }}>
                  No feed events yet.
                </div>
              ) : (
                recentItems.map((item) => (
                  <FeedItemRow key={item.id} item={item} />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── EVENTS TAB ──────────────────────────────────────────────── */}
      {tab === "events" && (
        <div className="card cardPad">
          <div className="col" style={{ gap: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                All Feed Events ({filteredItems.length})
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style={{
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.85)", borderRadius: 8, padding: "6px 12px", fontSize: 13,
                }}
              >
                <option value="">All feed types</option>
                <option value="product_activations">Product Activations</option>
                <option value="product_blocks">Product Blocks</option>
                <option value="product_sales">Product Sales</option>
                <option value="product_returns">Product Returns</option>
                <option value="account_blocks">Account Blocks</option>
              </select>
            </div>

            {filteredItems.length === 0 ? (
              <div className="muted" style={{ textAlign: "center", padding: 24, fontSize: 13 }}>
                No events match the selected filter.
              </div>
            ) : (
              <div className="col" style={{ gap: 6 }}>
                {filteredItems.map((item) => (
                  <FeedItemRow key={item.id} item={item} detailed />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SUBSCRIBERS TAB ─────────────────────────────────────────── */}
      {tab === "subscribers" && (
        <div className="card cardPad">
          <div className="col" style={{ gap: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                RSS Subscribers ({subscribers.length})
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                Sellers subscribed to at least one feed
              </div>
            </div>

            {subscribers.length === 0 ? (
              <div className="muted" style={{ textAlign: "center", padding: 24, fontSize: 13 }}>
                No sellers have subscribed to RSS feeds yet.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                      {["Seller", "Feed Type", "Email Alerts", "Subscribed"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.map((sub) => (
                      <tr
                        key={sub.id}
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.85)" }}>
                          {sub.sellerDisplay ?? sub.sellerId.slice(0, 8)}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{
                            padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: `${FEED_COLORS[sub.feedType] ?? "#94a3b8"}22`,
                            color: FEED_COLORS[sub.feedType] ?? "#94a3b8",
                          }}>
                            {FEED_ICONS[sub.feedType] ?? "📋"} {sub.feedLabel}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{
                            padding: "2px 8px", borderRadius: 20, fontSize: 11,
                            background: sub.emailAlerts ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
                            color: sub.emailAlerts ? "#4ade80" : "rgba(255,255,255,0.3)",
                          }}>
                            {sub.emailAlerts ? "✓ On" : "✗ Off"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.45)", fontSize: 12 }}>
                          {new Date(sub.subscribedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="col" style={{ alignItems: "center", gap: 2 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div className="muted" style={{ fontSize: 11 }}>{label}</div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value?: string | number }) {
  if (!value && value !== 0) return null;
  return (
    <div className="row" style={{ gap: 6, fontSize: 11 }}>
      <span style={{ color: "rgba(255,255,255,0.35)", minWidth: 100 }}>{label}</span>
      <span style={{ color: "rgba(255,255,255,0.75)", fontFamily: "monospace", fontSize: 11 }}>
        {String(value)}
      </span>
    </div>
  );
}

function FeedItemMeta({ item }: { item: RssFeedItem }) {
  const m = item.metadata;
  if (!m) return null;

  if (item.feedType === "product_activations") return (
    <div className="col" style={{ gap: 2, marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <MetaRow label="Product ID"   value={m.productId} />
      <MetaRow label="Product Name" value={m.productName} />
      <MetaRow label="Description"  value={m.description} />
      <MetaRow label="Quantity"     value={m.quantity} />
      <MetaRow label="Unit Price"   value={m.unitPrice ? `$${m.unitPrice}` : undefined} />
    </div>
  );

  if (item.feedType === "product_blocks") return (
    <div className="col" style={{ gap: 2, marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <MetaRow label="Product ID"   value={m.productId} />
      <MetaRow label="Product Name" value={m.productName} />
      <MetaRow label="Reason"       value={m.reason} />
    </div>
  );

  if (item.feedType === "product_sales") return (
    <div className="col" style={{ gap: 2, marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <MetaRow label="Order ID"     value={m.orderId} />
      <MetaRow label="Product ID"   value={m.productId} />
      <MetaRow label="Product Name" value={m.productName} />
      <MetaRow label="Buyer Name"   value={m.buyerName} />
      <MetaRow label="Product Cost" value={m.productCost ? `$${m.productCost}` : undefined} />
    </div>
  );

  if (item.feedType === "product_returns") return (
    <div className="col" style={{ gap: 2, marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <MetaRow label="Order ID"     value={m.orderId} />
      <MetaRow label="Product ID"   value={m.productId} />
      <MetaRow label="Product Name" value={m.productName} />
      <MetaRow label="Buyer Name"   value={m.buyerName} />
      <MetaRow label="Product Cost" value={m.productCost ? `$${m.productCost}` : undefined} />
      <MetaRow label="Return Reason" value={m.reason} />
    </div>
  );

  if (item.feedType === "account_blocks") return (
    <div className="col" style={{ gap: 2, marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <MetaRow label="Account Status" value={m.accountStatus} />
      <MetaRow label="Account"        value={m.accountName} />
      <MetaRow label="Email"          value={m.accountEmail} />
      <MetaRow label="Reason"         value={m.reason} />
    </div>
  );

  return null;
}

function FeedItemRow({ item, detailed = false }: { item: RssFeedItem; detailed?: boolean }) {
  const color = FEED_COLORS[item.feedType] ?? "#94a3b8";
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", borderRadius: 8,
      padding: "9px 12px", borderLeft: `3px solid ${color}`,
    }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="col" style={{ gap: 2, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {FEED_ICONS[item.feedType] ?? "📋"} {item.title}
          </div>
          {detailed && item.description && (
            <div className="muted" style={{ fontSize: 12 }}>{item.description}</div>
          )}
          {detailed && <FeedItemMeta item={item} />}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0, marginLeft: 12 }}>
          <span style={{
            padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
            background: `${color}22`, color,
          }}>
            {item.feedType.replace(/_/g, " ")}
          </span>
          <span className="muted" style={{ fontSize: 11 }}>
            {formatRelativeTime(item.occurredAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}
