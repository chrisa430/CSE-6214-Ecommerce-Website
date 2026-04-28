/**
 * @fileoverview ResetPassword — set new password via token from email link
 * @module pages/ResetPassword.tsx
 */
import { useState, FormEvent } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { resetPassword } from "../services/api";

const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[*$!\-@]).{8,}$/;

export default function ResetPassword() {
  const [searchParams]  = useSearchParams();
  const navigate        = useNavigate();
  const token           = searchParams.get("token") ?? "";

  const [newPw,     setNewPw]     = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!newPw)                { setError("New password is required."); return; }
    if (!PASSWORD_RE.test(newPw)) {
      setError("Password must be ≥8 characters with at least 1 uppercase, 1 lowercase, 1 digit, and 1 special character (* $ ! - @).");
      return;
    }
    if (newPw !== confirmPw)   { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      await resetPassword(token, newPw);
      setSuccess(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 18 }}>
        <div style={{ width: "100%", maxWidth: 460 }}>
          <div className="card cardPad col" style={{ gap: 16, textAlign: "center" }}>
            <div style={{ fontSize: 40 }}>⚠️</div>
            <div className="h2">Invalid Reset Link</div>
            <p className="muted" style={{ fontSize: 14 }}>
              This password reset link is missing or malformed. Please request a new one.
            </p>
            <Link to="/forgot-password" className="btn btnPrimary"
              style={{ alignSelf: "center" }}>
              Request New Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 18 }}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        <div className="card cardPad">
          <div className="badge">SportVault</div>
          <h1 className="h1" style={{ marginTop: 10 }}>Reset Password</h1>

          {success ? (
            <div className="col" style={{ gap: 16, marginTop: 20 }}>
              <div style={{
                padding: "16px", borderRadius: 12, fontSize: 14, lineHeight: 1.6,
                background: "rgba(34,197,94,0.12)", color: "#4ade80",
                border: "1px solid rgba(34,197,94,0.3)",
              }}>
                ✓ Your password has been updated successfully. Redirecting you to
                sign in…
              </div>
              <Link to="/login" className="btn btnPrimary" style={{ alignSelf: "flex-start" }}>
                Sign In Now
              </Link>
            </div>
          ) : (
            <>
              <p className="muted" style={{ fontSize: 14, marginTop: 8, marginBottom: 0 }}>
                Choose a strong new password for your account.
              </p>

              <div className="divider" />

              {error && (
                <div style={{
                  padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 8,
                  background: "rgba(239,68,68,0.12)", color: "var(--danger)",
                  border: "1px solid rgba(239,68,68,0.35)",
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={onSubmit} noValidate className="col" style={{ gap: 14 }}>
                {/* New password */}
                <div className="col" style={{ gap: 6 }}>
                  <label style={labelSt}>New Password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      className="input"
                      type={showPw ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••••••"
                      value={newPw}
                      onChange={(e) => { setNewPw(e.target.value); setError(""); }}
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

                {/* Confirm password */}
                <div className="col" style={{ gap: 6 }}>
                  <label style={labelSt}>Confirm New Password</label>
                  <input
                    className="input"
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••••••"
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

                <div className="muted" style={{ fontSize: 11, lineHeight: 1.6 }}>
                  Password requirements: 8+ characters · uppercase · lowercase ·
                  digit · special character (* $ ! - @)
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button
                    className="btn btnPrimary"
                    type="submit"
                    disabled={loading || !newPw || newPw !== confirmPw}
                    style={{
                      opacity: (loading || !newPw || newPw !== confirmPw) ? 0.5 : 1,
                      minWidth: 160,
                    }}
                  >
                    {loading ? "Updating…" : "Update Password"}
                  </button>
                  <Link to="/login" style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none" }}>
                    ← Sign In
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
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
