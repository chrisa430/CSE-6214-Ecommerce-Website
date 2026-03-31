import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { extractApiError } from "../services/api";

// Password validation: 8+ chars, ≥1 upper, ≥1 lower, ≥1 digit, ≥1 special (* $ ! - @)
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[*$!\-@]).{8,}$/;
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(email: string, password: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  if (!PASSWORD_RE.test(password)) {
    errors.password =
        "Password must be ≥8 chars with at least 1 uppercase, 1 lowercase, 1 digit, and 1 special character (* $ ! - @).";
  }
  return errors;
}

export default function Login() {
  const navigate      = useNavigate();
  const { login }     = useAuth();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [errors,   setErrors]   = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPw,   setShowPw]   = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setApiError("");

    const fieldErrors = validate(email.trim(), password);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const resp = await login({ email: email.trim(), password });
      // Navigate based on account type returned from the service
      if (resp.user.type === "admin")  navigate("/admin");
      else if (resp.user.type === "buyer")  navigate("/buyer");
      else navigate("/seller");
    } catch (err) {
      setApiError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 18 }}>
        <div className="container" style={{ maxWidth: 480 }}>
          <div className="card cardPad">

            {/* Header */}
            <div className="badge">SportVault</div>
            <h1 className="h1" style={{ marginTop: 10 }}>Sign in</h1>
            <p className="muted" style={{ fontSize: 14, marginTop: 6, marginBottom: 0 }}>
              Enter your credentials to continue.
            </p>

            <div className="divider" />

            {/* API-level error banner */}
            {apiError && (
                <div
                    style={{
                      background: "rgba(239,68,68,0.12)",
                      border: "1px solid rgba(239,68,68,0.35)",
                      borderRadius: 12,
                      padding: "10px 14px",
                      fontSize: 13,
                      color: "var(--danger)",
                      marginBottom: 8,
                    }}
                >
                  {apiError}
                </div>
            )}

            <form onSubmit={onSubmit} noValidate className="col" style={{ gap: 14 }}>

              {/* Email */}
              <div>
                <div className="label">Email address</div>
                <input
                    className="input"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrors({}); }}
                    placeholder="you@example.com"
                    disabled={loading}
                />
                {errors.email && <FieldError msg={errors.email} />}
              </div>

              {/* Password */}
              <div>
                <div className="label">Password</div>
                <div style={{ position: "relative" }}>
                  <input
                      className="input"
                      type={showPw ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setErrors({}); }}
                      placeholder="••••••••••••"
                      disabled={loading}
                      style={{ paddingRight: 44 }}
                  />
                  <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      style={{
                        position: "absolute", right: 12, top: "50%",
                        transform: "translateY(-50%)",
                        background: "none", border: "none",
                        color: "var(--muted)", cursor: "pointer", fontSize: 13,
                        padding: 0,
                      }}
                  >
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>
                {errors.password && <FieldError msg={errors.password} />}
              </div>

              {/* Submit */}
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                <button
                    className="btn btnPrimary"
                    type="submit"
                    disabled={loading}
                    style={{ opacity: loading ? 0.7 : 1, minWidth: 120 }}
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>

                <span className="muted" style={{ fontSize: 13 }}>
                No account?{" "}
                  <Link to="/register" style={{ color: "var(--accent)", fontWeight: 600 }}>
                  Register
                </Link>
              </span>
              </div>
            </form>

            {/* Password hint */}
            <div className="divider" />
            <div className="muted" style={{ fontSize: 11, lineHeight: 1.6 }}>
              Password requirements: 8+ characters · uppercase · lowercase · digit ·
              special character (* $ ! - @)
            </div>
          </div>
        </div>
      </div>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
      <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 5 }}>{msg}</div>
  );
}