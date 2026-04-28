/**
 * @fileoverview ForgotPassword — email submission for password reset
 * @module pages/ForgotPassword.tsx
 */
import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../services/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const [email,     setEmail]     = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!EMAIL_RE.test(email.trim())) {
      setError("Please enter a valid email address."); return;
    }
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 18 }}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        <div className="card cardPad">
          <div className="badge">SportVault</div>
          <h1 className="h1" style={{ marginTop: 10 }}>Forgot Password</h1>

          {submitted ? (
            <div className="col" style={{ gap: 16, marginTop: 20 }}>
              <div style={{
                padding: "16px", borderRadius: 12, fontSize: 14, lineHeight: 1.6,
                background: "rgba(34,197,94,0.12)", color: "#4ade80",
                border: "1px solid rgba(34,197,94,0.3)",
              }}>
                ✓ If <strong>{email}</strong> is registered, a password reset link
                has been sent to that address. Check your inbox and follow the link
                to reset your password.
              </div>
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                The reset link expires in <strong>1 hour</strong>. If you don't
                receive an email, check your spam folder or try again.
              </p>
              <Link
                to="/login"
                className="btn"
                style={{ alignSelf: "flex-start", fontSize: 13 }}
              >
                ← Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <p className="muted" style={{ fontSize: 14, marginTop: 8, marginBottom: 0 }}>
                Enter your account email address and we'll send you a link to reset
                your password.
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
                <div className="col" style={{ gap: 6 }}>
                  <label style={{
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.06em", color: "rgba(255,255,255,0.45)",
                  }}>
                    Email Address
                  </label>
                  <input
                    className="input"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    disabled={loading}
                    autoFocus
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button
                    className="btn btnPrimary"
                    type="submit"
                    disabled={loading}
                    style={{ opacity: loading ? 0.7 : 1, minWidth: 140 }}
                  >
                    {loading ? "Sending…" : "Send Reset Link"}
                  </button>
                  <Link to="/login" style={{
                    fontSize: 13, color: "var(--muted)", textDecoration: "none",
                  }}>
                    ← Back to Sign In
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
