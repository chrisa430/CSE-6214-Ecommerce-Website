/**
 * @fileoverview ChangePassword — authenticated password change for all account types
 * @module pages/ChangePassword.tsx
 */
import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { changePassword } from "../services/api";

const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[*$!\-@]).{8,}$/;

export default function ChangePassword() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [currentPw,  setCurrentPw]  = useState("");
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");
  const [showPw,     setShowPw]     = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState(false);

  // Back-navigation target by account type
  const backPath =
    user?.type === "admin"  ? "/admin" :
    user?.type === "seller" ? "/seller" :
    "/buyer";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!currentPw) { setError("Current password is required."); return; }
    if (!newPw)      { setError("New password is required."); return; }
    if (!PASSWORD_RE.test(newPw)) {
      setError(
        "New password must be ≥8 characters with at least 1 uppercase, " +
        "1 lowercase, 1 digit, and 1 special character (* $ ! - @)."
      ); return;
    }
    if (newPw !== confirmPw) { setError("New passwords do not match."); return; }
    if (currentPw === newPw) { setError("New password must be different from current password."); return; }

    setLoading(true);
    try {
      await changePassword(currentPw, newPw);
      setSuccess(true);
      // Redirect to home after 2 seconds
      setTimeout(() => navigate(backPath), 2500);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to change password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card cardPad" style={{ maxWidth: 520, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 22 }}>🔒</span>
        <div className="h2" style={{ fontWeight: 800 }}>Change Password</div>
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 4, marginBottom: 0 }}>
        Update your account password. You'll remain signed in after changing it.
      </p>

      <div className="divider" />

      {success ? (
        <div className="col" style={{ gap: 14 }}>
          <div style={{
            padding: "16px", borderRadius: 12, fontSize: 14, lineHeight: 1.6,
            background: "rgba(34,197,94,0.12)", color: "#4ade80",
            border: "1px solid rgba(34,197,94,0.3)",
          }}>
            ✓ Password changed successfully. Redirecting you back…
          </div>
          <button className="btn" style={{ alignSelf: "flex-start" }}
            onClick={() => navigate(backPath)}>
            ← Go Back
          </button>
        </div>
      ) : (
        <>
          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 14,
              background: "rgba(239,68,68,0.12)", color: "var(--danger)",
              border: "1px solid rgba(239,68,68,0.35)",
            }}>
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} noValidate className="col" style={{ gap: 16 }}>

            {/* Current password */}
            <div className="col" style={{ gap: 6 }}>
              <label style={labelSt}>Current Password</label>
              <div style={{ position: "relative" }}>
                <input
                  className="input"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Your current password"
                  value={currentPw}
                  onChange={(e) => { setCurrentPw(e.target.value); setError(""); }}
                  disabled={loading}
                  style={{ paddingRight: 52 }}
                  autoFocus
                />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  style={eyeBtnSt}>
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

            {/* New password */}
            <div className="col" style={{ gap: 6 }}>
              <label style={labelSt}>New Password</label>
              <input
                className="input"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                placeholder="New password"
                value={newPw}
                onChange={(e) => { setNewPw(e.target.value); setError(""); }}
                disabled={loading}
              />
              {newPw && !PASSWORD_RE.test(newPw) && (
                <div style={{ fontSize: 11, color: "#fbbf24" }}>
                  Must be ≥8 chars with uppercase, lowercase, digit, and special char (* $ ! - @)
                </div>
              )}
            </div>

            {/* Confirm new password */}
            <div className="col" style={{ gap: 6 }}>
              <label style={labelSt}>Confirm New Password</label>
              <input
                className="input"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Repeat new password"
                value={confirmPw}
                onChange={(e) => { setConfirmPw(e.target.value); setError(""); }}
                disabled={loading}
              />
              {confirmPw && newPw !== confirmPw && (
                <div style={{ fontSize: 12, color: "var(--danger)" }}>
                  Passwords do not match.
                </div>
              )}
            </div>

            {/* Strength indicators */}
            {newPw && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { label: "8+ chars",   ok: newPw.length >= 8 },
                  { label: "Uppercase",  ok: /[A-Z]/.test(newPw) },
                  { label: "Lowercase",  ok: /[a-z]/.test(newPw) },
                  { label: "Digit",      ok: /\d/.test(newPw) },
                  { label: "Special",    ok: /[*$!\-@]/.test(newPw) },
                ].map(({ label, ok }) => (
                  <span key={label} style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600,
                    background: ok ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
                    color: ok ? "#4ade80" : "rgba(255,255,255,0.35)",
                    border: `1px solid ${ok ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
                  }}>
                    {ok ? "✓" : "○"} {label}
                  </span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, justifyContent: "space-between",
              alignItems: "center", paddingTop: 4 }}>
              <button
                className="btn btnPrimary"
                type="submit"
                disabled={loading || !currentPw || !newPw || newPw !== confirmPw || !PASSWORD_RE.test(newPw)}
                style={{
                  opacity: (loading || !currentPw || !newPw || newPw !== confirmPw || !PASSWORD_RE.test(newPw)) ? 0.45 : 1,
                  minWidth: 160, fontWeight: 700,
                }}
              >
                {loading ? "Changing…" : "Change Password"}
              </button>
              <button type="button" className="btn"
                style={{ fontSize: 13 }} onClick={() => navigate(backPath)}>
                Cancel
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

const labelSt: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.06em", color: "rgba(255,255,255,0.45)",
};
const eyeBtnSt: React.CSSProperties = {
  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
  background: "none", border: "none", color: "var(--muted)",
  cursor: "pointer", fontSize: 13, padding: 0,
};
