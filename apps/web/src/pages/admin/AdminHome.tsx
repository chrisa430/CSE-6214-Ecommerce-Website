/**
 * @fileoverview Admin Dashboard Home
 * @module AdminHome.tsx
 * @author Darrell Hobson
 * @Date 2026.04.24
 *
 * - KPI tiles with live counts from GET /admin/stats
 * - Quick-action cards with correct navigation targets
 * - Recent audit activity from live audit log
 */
import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate }                 from "react-router-dom";
import { useAuth }                           from "../../context/AuthContext";
import {
  getDashboardStats,
  getAuditLogs,
  DashboardStats,
  AuditLogRow,
  extractApiError,
} from "../../services/api";

export default function AdminHome() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [stats,        setStats]        = useState<DashboardStats | null>(null);
  const [recentLogs,   setRecentLogs]   = useState<AuditLogRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError,   setStatsError]   = useState<string | null>(null);

  useEffect(() => {
    if (user !== null && user.type !== "admin") navigate("/login", { replace: true });
  }, [user, navigate]);

  const loadData = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const [s, logs] = await Promise.all([
        getDashboardStats(),
        getAuditLogs({ limit: 5 }),
      ]);
      setStats(s);
      setRecentLogs(logs.rows);
    } catch (err) {
      setStatsError(extractApiError(err));
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (!user || user.type !== "admin") {
    return (
      <div className="card cardPad" style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 44 }}>🚫</div>
        <div className="h2" style={{ marginTop: 14 }}>Access Denied</div>
        <p className="muted">This page is restricted to administrator accounts.</p>
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 20 }}>

      {/* ── KPI Tiles ───────────────────────────────────────────────────── */}
      {statsError && (
        <div style={{
          padding: "10px 16px", borderRadius: 10, fontSize: 13,
          background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
          color: "#fca5a5",
        }}>
          ⚠️ Could not load live stats: {statsError}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KpiTile
          icon="👥"
          label="Accounts"
          primary={statsLoading ? "—" : String(stats?.accounts.total ?? 0)}
          primaryHint="Total accounts"
          secondary={statsLoading ? "—" : String(stats?.accounts.pending ?? 0)}
          secondaryHint="Pending approval"
          secondaryColor={stats && stats.accounts.pending > 0 ? "#f59e0b" : "#22c55e"}
          to="/admin/subpage#approvals"
          accent="#7c5cff"
        />
        <KpiTile
          icon="📦"
          label="Products"
          primary={statsLoading ? "—" : String(stats?.products.total ?? 0)}
          primaryHint="Total products"
          secondary={statsLoading ? "—" : String(stats?.products.pending ?? 0)}
          secondaryHint="Pending review"
          secondaryColor={stats && stats.products.pending > 0 ? "#f59e0b" : "#22c55e"}
          to="/admin/products"
          accent="#22c55e"
        />
        <KpiTile
          icon="↩"
          label="Returns"
          primary={statsLoading ? "—" : String(stats?.returns.active ?? 0)}
          primaryHint="Active returns"
          secondary={null}
          secondaryHint="Pending or disputed"
          secondaryColor="#fbbf24"
          to="/admin/returns"
          accent="#f59e0b"
        />
        <KpiTile
          icon="📋"
          label="Audit Log"
          primary={statsLoading ? "—" : String(stats?.audit.total ?? 0)}
          primaryHint="Total events"
          secondary={null}
          secondaryHint=""
          secondaryColor="#a78bfa"
          to="/admin/audit-logs"
          accent="#a78bfa"
        />
      </div>

      {/* ── Quick Actions ────────────────────────────────────────────────── */}
      <div className="card cardPad">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div className="h2" style={{ fontSize: 17, fontWeight: 800 }}>Quick Actions</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Common administrative tasks
            </div>
          </div>
          <button className="btn" onClick={loadData} disabled={statsLoading} style={{ fontSize: 12 }}>
            ↻ Refresh
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          <ActionCard
            icon="✅"
            title="Account Approvals"
            desc="Review new registration requests and approve or reject pending accounts."
            to="/admin/subpage#approvals"
            count={stats?.accounts.pending}
            countLabel="pending"
          />
          <ActionCard
            icon="👥"
            title="User Management"
            desc="Search, filter, sort, activate, suspend, or close any platform account."
            to="/admin/subpage#users"
          />
          <ActionCard
            icon="📦"
            title="Product Inventory"
            desc="Approve, suspend, or remove products. Set product status across the catalog."
            to="/admin/products"
            count={stats?.products.pending}
            countLabel="pending review"
          />
          <ActionCard
            icon="↩"
            title="Return Facilitation"
            desc="Review and manage buyer return requests. Escalate disputes between buyers and sellers."
            to="/admin/returns"
            count={stats?.returns.active}
            countLabel="active"
          />
          <ActionCard
            icon="🛒"
            title="Order Maintenance"
            desc="View all orders in the system. Configure the return window policy."
            to="/admin/orders"
          />
          <ActionCard
            icon="📋"
            title="Audit Logs"
            desc="Trace every administrative action taken on the platform."
            to="/admin/audit-logs"
            count={stats?.audit.total}
            countLabel="total events"
          />
        </div>
      </div>

      {/* ── Recent Activity ──────────────────────────────────────────────── */}
      <div className="card cardPad">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div className="h2" style={{ fontSize: 17, fontWeight: 800 }}>Recent Activity</div>
          <Link to="/admin/audit-logs" className="btn" style={{ fontSize: 12 }}>
            View All →
          </Link>
        </div>

        {recentLogs.length === 0 ? (
          <div className="muted" style={{ textAlign: "center", padding: 24, fontSize: 13 }}>
            {statsLoading ? "Loading activity…" : "No audit events yet."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {new Date(log.occurredAt).toLocaleString("en-US", {
                        month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>
                        {log.actorFirstName} {log.actorLastName}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>
                        {log.actorEmail}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        padding: "2px 8px", borderRadius: 20,
                        fontSize: 10, fontWeight: 700,
                        background: "rgba(124,92,255,0.15)", color: "#a78bfa",
                      }}>
                        {log.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--muted)", maxWidth: 280, wordBreak: "break-word" }}>
                      {log.detail ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────

function KpiTile({
  icon, label, primary, primaryHint, secondary, secondaryHint,
  secondaryColor, to, accent,
}: {
  icon: string; label: string;
  primary: string; primaryHint: string;
  secondary: string | null; secondaryHint: string; secondaryColor: string;
  to: string; accent: string;
}) {
  return (
    <Link to={to} style={{ textDecoration: "none" }}>
      <div
        className="card cardPad"
        style={{
          borderTop: `3px solid ${accent}`,
          cursor: "pointer",
          transition: "transform .15s, box-shadow .15s",
          height: "100%",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px rgba(0,0,0,.4)`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "";
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.08em", color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>
              {icon} {label}
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, color: accent }}>
              {primary}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
              {primaryHint}
            </div>
          </div>
        </div>

        {secondary !== null && (
          <div style={{
            marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.07)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{secondaryHint}</span>
            <span style={{
              fontSize: 18, fontWeight: 800, color: secondaryColor,
            }}>
              {secondary}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Action Card ───────────────────────────────────────────────────────────────

function ActionCard({
  icon, title, desc, to, count, countLabel,
}: {
  icon: string; title: string; desc: string; to: string;
  count?: number; countLabel?: string;
}) {
  return (
    <div className="card cardPad" style={{
      display: "flex", flexDirection: "column", gap: 10,
      background: "rgba(255,255,255,0.04)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {icon} {title}
        </div>
        {count !== undefined && count > 0 && (
          <span style={{
            padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: "rgba(245,158,11,0.15)", color: "#f59e0b",
            border: "1px solid rgba(245,158,11,0.3)", whiteSpace: "nowrap",
          }}>
            {count} {countLabel}
          </span>
        )}
      </div>
      <div className="muted" style={{ fontSize: 13, flex: 1, lineHeight: 1.5 }}>{desc}</div>
      <Link className="btn" to={to} style={{ alignSelf: "flex-start", fontSize: 13 }}>
        Open →
      </Link>
    </div>
  );
}
