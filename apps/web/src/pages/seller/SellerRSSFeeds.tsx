/**
 * @fileoverview SellerRSSFeeds — choose which RSS feeds to receive
 * @module pages/seller/SellerRSSFeeds.tsx
 * @author Darrell Hobson
 * @Date 2026.04.24
 *
 * Feed cards are always rendered from a local definition — they never depend on
 * the API returning a feed-types list. Subscription state is loaded separately
 * and overlaid onto the static cards, so a slow or failing API never hides the
 * Subscribe buttons from the seller.
 */
import { useEffect, useState, useCallback } from "react";
import {
  subscribeRss,
  unsubscribeRss,
  getMyRssSubscriptions,
  getRssFeedItems,
  type RssFeedItem,
  type RssFeedItemMetadata,
  type RssSubscription,
} from "../../services/api";

// ── Static feed definitions — always shown, never API-dependent ───────────────

interface FeedDef {
  name:        string;
  shortDesc:   string;
  description: string;
  icon:        string;
  color:       string;
}

const FEEDS: FeedDef[] = [
  {
    name:        "product_activations",
    shortDesc:   "Product Activations",
    icon:        "✅",
    color:       "#a78bfa",
    description: "Notifies you when an admin approves and activates one of your products. Includes product name, description, quantity, and unit price.",
  },
  {
    name:        "product_blocks",
    shortDesc:   "Product Blocks",
    icon:        "🔒",
    color:       "#fb923c",
    description: "Notifies you when an admin suspends or blocks one of your products. Includes the product name and reason for the block.",
  },
  {
    name:        "product_sales",
    shortDesc:   "Product Sales",
    icon:        "🛒",
    color:       "#34d399",
    description: "Notifies you when a buyer completes a purchase of your product. Includes order ID, buyer name, and sale amount.",
  },
  {
    name:        "product_returns",
    shortDesc:   "Product Returns",
    icon:        "↩",
    color:       "#fbbf24",
    description: "Notifies you when a buyer submits a return request for your product. Includes order ID, buyer name, product cost, and reason.",
  },
  {
    name:        "account_blocks",
    shortDesc:   "Account Blocks",
    icon:        "🚫",
    color:       "#f87171",
    description: "Notifies you when an admin blocks or rejects an account on the platform.",
  },
];

export default function SellerRSSFeeds() {
  // Map of feedName → { subscribed, emailAlerts }
  const [subMap,       setSubMap]       = useState<Map<string, RssSubscription>>(new Map());
  const [recentItems,  setRecentItems]  = useState<RssFeedItem[]>([]);
  const [subsLoading,  setSubsLoading]  = useState(true);
  const [subsError,    setSubsError]    = useState(false);
  const [busy,         setBusy]         = useState<string | null>(null);
  const [copied,       setCopied]       = useState<string | null>(null);
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null);

  const baseUrl = `${window.location.protocol}//${window.location.host}`;

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  // Load subscription state + recent items independently
  const loadSubs = useCallback(async () => {
    setSubsLoading(true);
    setSubsError(false);
    try {
      const subs = await getMyRssSubscriptions();
      const m    = new Map<string, RssSubscription>();
      subs.forEach((s) => m.set(s.feedType, s));
      setSubMap(m);
    } catch {
      setSubsError(true);
    } finally {
      setSubsLoading(false);
    }
  }, []);

  const loadItems = useCallback(async () => {
    try {
      const items = await getRssFeedItems({ limit: 20 });
      setRecentItems(items);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    loadSubs();
    loadItems();
  }, [loadSubs, loadItems]);

  function extractError(err: unknown, fallback: string): string {
    if (err && typeof err === "object") {
      const e = err as any;
      const serverMsg = e?.response?.data?.error ?? e?.response?.data?.message;
      if (serverMsg) return `${serverMsg} (HTTP ${e?.response?.status ?? "?"})`;
      if (e?.message) return e.message;
    }
    return fallback;
  }

  async function handleSubscribe(feed: FeedDef) {
    setBusy(feed.name);
    try {
      await subscribeRss([feed.name], true);
      showToast(`✅ Subscribed to "${feed.shortDesc}" with email alerts on`);
      await loadSubs();
    } catch (err) {
      showToast(extractError(err, "Subscribe failed — please check console"), false);
      console.error("[RSS subscribe]", err);
    } finally {
      setBusy(null);
    }
  }

  async function handleUnsubscribe(feed: FeedDef) {
    setBusy(`unsub-${feed.name}`);
    try {
      await unsubscribeRss([feed.name]);
      showToast(`Unsubscribed from "${feed.shortDesc}"`);
      await loadSubs();
    } catch (err) {
      showToast(extractError(err, "Unsubscribe failed — please check console"), false);
      console.error("[RSS unsubscribe]", err);
    } finally {
      setBusy(null);
    }
  }

  async function handleToggleEmail(feed: FeedDef, currentAlerts: boolean) {
    setBusy(`email-${feed.name}`);
    try {
      await subscribeRss([feed.name], !currentAlerts);
      showToast(
        !currentAlerts
          ? `📧 Email alerts enabled for "${feed.shortDesc}"`
          : `Email alerts disabled for "${feed.shortDesc}"`
      );
      await loadSubs();
    } catch (err) {
      showToast(extractError(err, "Failed to update — please check console"), false);
      console.error("[RSS email toggle]", err);
    } finally {
      setBusy(null);
    }
  }

  function handleCopy(feedName: string) {
    const url = `${baseUrl}/api/admin/rss/${feedName}.xml`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(feedName);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const subscribedCount = FEEDS.filter((f) => subMap.has(f.name)).length;

  return (
    <div className="col" style={{ gap: 18 }}>

      {/* ── Toast ─────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14,
          background: toast.ok ? "rgba(34,197,94,0.92)" : "rgba(239,68,68,0.92)",
          color: "#fff", boxShadow: "0 4px 16px rgba(0,0,0,.35)",
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="card cardPad">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div className="col" style={{ gap: 6 }}>
            <div className="h2">📡 RSS Feed Subscriptions</div>
            <div className="muted" style={{ fontSize: 13, maxWidth: 560 }}>
              Choose which feeds to follow. Each feed sends an <strong>email alert via AWS SES</strong> when
              email alerts are enabled, and provides a live <strong>RSS 2.0 URL</strong> for your RSS reader.
            </div>
          </div>
          <div style={{
            padding: "8px 18px", borderRadius: 20, fontSize: 13, fontWeight: 700,
            background: subscribedCount > 0 ? "rgba(124,92,255,0.18)" : "rgba(255,255,255,0.05)",
            color:      subscribedCount > 0 ? "#c4b5fd"               : "rgba(255,255,255,0.35)",
          }}>
            {subscribedCount} / {FEEDS.length} subscribed
          </div>
        </div>
      </div>

      {/* ── Subscription error banner ──────────────────────────────────── */}
      {subsError && (
        <div style={{
          background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 10, padding: "12px 16px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 13, color: "#fca5a5" }}>
            ⚠️ Could not load your subscription status. You can still subscribe below.
          </span>
          <button className="btn" style={{ fontSize: 12 }} onClick={loadSubs}>
            Retry
          </button>
        </div>
      )}

      {/* ── Feed Cards — always rendered, one per feed ────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        {FEEDS.map((feed) => {
          const sub         = subMap.get(feed.name);
          const isSubscribed = !!sub;
          const emailAlerts  = sub?.emailAlerts ?? false;
          const isBusy       = busy === feed.name || busy === `unsub-${feed.name}`;
          const emailBusy    = busy === `email-${feed.name}`;
          const feedUrl      = `${baseUrl}/api/admin/rss/${feed.name}.xml`;

          return (
            <div
              key={feed.name}
              className="card cardPad"
              style={{
                border: `1px solid ${isSubscribed ? feed.color + "55" : "rgba(255,255,255,0.08)"}`,
                background: isSubscribed ? `${feed.color}0d` : undefined,
                transition: "border-color .2s, background .2s",
                display: "flex", flexDirection: "column", gap: 14,
              }}
            >
              {/* ── Title row ─────────────────────────────────────────── */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 26, lineHeight: 1 }}>{feed.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{feed.shortDesc}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                      {feed.description}
                    </div>
                  </div>
                </div>
                {/* Subscription status badge */}
                <span style={{
                  padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                  whiteSpace: "nowrap", flexShrink: 0,
                  background: isSubscribed ? `${feed.color}22` : "rgba(255,255,255,0.05)",
                  color:      isSubscribed ? feed.color         : "rgba(255,255,255,0.3)",
                }}>
                  {subsLoading
                    ? "…"
                    : isSubscribed ? "● SUBSCRIBED" : "○ NOT SUBSCRIBED"}
                </span>
              </div>

              {/* ── RSS URL row ────────────────────────────────────────── */}
              <div style={{
                display: "flex", gap: 8, alignItems: "center",
                background: "rgba(0,0,0,0.25)", borderRadius: 8, padding: "7px 10px",
              }}>
                <code style={{
                  flex: 1, fontSize: 10, color: "rgba(255,255,255,0.45)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {feedUrl}
                </code>
                <button
                  className="btn"
                  style={{ padding: "4px 12px", fontSize: 11, flexShrink: 0 }}
                  onClick={() => handleCopy(feed.name)}
                >
                  {copied === feed.name ? "✓ Copied!" : "Copy URL"}
                </button>
              </div>

              {/* ── Email alerts row — visible only when subscribed ────── */}
              {isSubscribed && (
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 12px",
                }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 14 }}>📧</span>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
                      Email alerts via AWS SES
                    </span>
                  </div>
                  <button
                    className="btn"
                    style={{
                      padding: "4px 14px", fontSize: 12, fontWeight: 700,
                      background: emailAlerts ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.06)",
                      color:      emailAlerts ? "#4ade80"               : "rgba(255,255,255,0.4)",
                      border:     `1px solid ${emailAlerts ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.1)"}`,
                    }}
                    disabled={emailBusy}
                    onClick={() => handleToggleEmail(feed, emailAlerts)}
                  >
                    {emailBusy ? "…" : emailAlerts ? "ON — click to disable" : "OFF — click to enable"}
                  </button>
                </div>
              )}

              {/* ── Subscribe / Unsubscribe CTA ────────────────────────── */}
              {isSubscribed ? (
                <button
                  className="btn"
                  style={{
                    width: "100%", padding: "10px 0", fontWeight: 700, fontSize: 13,
                    background: "rgba(239,68,68,0.15)", color: "#fca5a5",
                    border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10,
                    opacity: isBusy ? 0.6 : 1,
                  }}
                  disabled={isBusy}
                  onClick={() => handleUnsubscribe(feed)}
                >
                  {busy === `unsub-${feed.name}` ? "Unsubscribing…" : "Unsubscribe"}
                </button>
              ) : (
                <button
                  className="btn"
                  style={{
                    width: "100%", padding: "10px 0", fontWeight: 700, fontSize: 13,
                    background: `linear-gradient(135deg, ${feed.color}dd, ${feed.color}88)`,
                    color: "#fff", border: "none", borderRadius: 10,
                    opacity: isBusy ? 0.6 : 1,
                    cursor: isBusy ? "not-allowed" : "pointer",
                  }}
                  disabled={isBusy}
                  onClick={() => handleSubscribe(feed)}
                >
                  {busy === feed.name ? "Subscribing…" : `Subscribe to ${feed.shortDesc}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Recent Feed Activity ──────────────────────────────────────── */}
      <div className="card cardPad">
        <div className="col" style={{ gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Recent Feed Activity</div>
            <div className="muted" style={{ fontSize: 12 }}>Latest 20 events</div>
          </div>

          {recentItems.length === 0 ? (
            <div className="muted" style={{ textAlign: "center", padding: 28, fontSize: 13 }}>
              No feed events yet. Subscribe to a feed and activity will appear here.
            </div>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              {recentItems.map((item) => {
                const feed = FEEDS.find((f) => f.name === item.feedType)
                          ?? { icon: "📋", color: "#94a3b8", name: item.feedType, shortDesc: item.feedType, description: "" };
                return (
                  <div key={item.id} style={{
                    background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 14px",
                    borderLeft: `3px solid ${feed.color}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div className="col" style={{ gap: 3, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {feed.icon} {item.title}
                        </div>
                        {item.description && (
                          <div className="muted" style={{ fontSize: 12 }}>{item.description}</div>
                        )}
                        {item.metadata && (
                          <FeedMeta meta={item.metadata} feedType={item.feedType} />
                        )}
                      </div>
                      <div className="col" style={{ alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                          background: `${feed.color}22`, color: feed.color,
                        }}>
                          {item.feedType.replace(/_/g, " ")}
                        </span>
                        <span className="muted" style={{ fontSize: 11 }}>
                          {relativeTime(item.occurredAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <div className="card cardPad" style={{ background: "rgba(124,92,255,0.06)", border: "1px solid rgba(124,92,255,0.18)" }}>
        <div className="col" style={{ gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>📖 How RSS Feeds Work</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <InfoBlock icon="📧" title="Email Alerts"
              body="When subscribed with alerts on, SportVault sends you an AWS SES email each time a new event fires on that feed." />
            <InfoBlock icon="🔗" title="RSS Reader"
              body="Copy any feed URL and paste it into a reader like Feedly or Inoreader. Feeds are standard RSS 2.0 with the 50 most recent events." />
            {FEEDS.map((f) => (
              <InfoBlock key={f.name} icon={f.icon} title={f.shortDesc} body={f.description} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FeedMeta({ meta, feedType }: { meta: RssFeedItemMetadata; feedType: string }) {
  const rows: { label: string; value?: string | number }[] = [];

  if (feedType === "product_activations") {
    rows.push(
      { label: "Product ID",   value: meta.productId },
      { label: "Product",      value: meta.productName },
      { label: "Description",  value: meta.description },
      { label: "Quantity",     value: meta.quantity },
      { label: "Unit Price",   value: meta.unitPrice ? `$${meta.unitPrice}` : undefined },
    );
  } else if (feedType === "product_blocks") {
    rows.push(
      { label: "Product ID",   value: meta.productId },
      { label: "Product",      value: meta.productName },
      { label: "Reason",       value: meta.reason },
    );
  } else if (feedType === "product_sales") {
    rows.push(
      { label: "Order ID",     value: meta.orderId },
      { label: "Product ID",   value: meta.productId },
      { label: "Product",      value: meta.productName },
      { label: "Buyer",        value: meta.buyerName },
      { label: "Sale Amount",  value: meta.productCost ? `$${meta.productCost}` : undefined },
    );
  } else if (feedType === "product_returns") {
    rows.push(
      { label: "Order ID",     value: meta.orderId },
      { label: "Product ID",   value: meta.productId },
      { label: "Product",      value: meta.productName },
      { label: "Buyer",        value: meta.buyerName },
      { label: "Product Cost", value: meta.productCost ? `$${meta.productCost}` : undefined },
      { label: "Reason",       value: meta.reason },
    );
  } else if (feedType === "account_blocks") {
    rows.push(
      { label: "Status",  value: meta.accountStatus },
      { label: "Reason",  value: meta.reason },
    );
  }

  const visible = rows.filter((r) => r.value != null && r.value !== "");
  if (!visible.length) return null;

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "auto 1fr",
      gap: "2px 10px", marginTop: 6, paddingTop: 6,
      borderTop: "1px solid rgba(255,255,255,0.07)",
    }}>
      {visible.map((r) => (
        <>
          <span key={`${r.label}-l`} style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
            {r.label}
          </span>
          <span key={`${r.label}-v`} style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: "monospace", wordBreak: "break-all" }}>
            {String(r.value)}
          </span>
        </>
      ))}
    </div>
  );
}

function InfoBlock({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{icon} {title}</div>
      <div className="muted" style={{ fontSize: 12, lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m    = Math.floor(diff / 60_000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h    = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}
