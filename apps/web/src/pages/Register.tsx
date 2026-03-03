import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerUser, extractApiError, RegisterPayload } from "../services/api";

const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[*$!\-@]).{12,}$/;

type AccountType = "admin" | "buyer" | "seller";

interface FormState {
  userId:      string;
  password:    string;
  confirmPw:   string;
  firstName:   string;
  lastName:    string;
  accountType: AccountType | "";
}

function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!EMAIL_RE.test(form.userId))
    errors.userId = "Enter a valid email address.";

  if (!PASSWORD_RE.test(form.password))
    errors.password =
      "Password must be ≥12 chars with at least 1 uppercase, 1 lowercase, 1 digit, and 1 special character (* $ ! - @).";

  if (form.password !== form.confirmPw)
    errors.confirmPw = "Passwords do not match.";

  if (!form.firstName.trim())
    errors.firstName = "First name is required.";

  if (!form.lastName.trim())
    errors.lastName = "Last name is required.";

  if (!form.accountType)
    errors.accountType = "Please select an account type.";

  return errors;
}

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    userId:      "",
    password:    "",
    confirmPw:   "",
    firstName:   "",
    lastName:    "",
    accountType: "",
  });

  const [errors,   setErrors]   = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [showPw,   setShowPw]   = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
    setApiError("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    const fieldErrors = validate(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    setApiError("");

    try {
      await registerUser({
        userId:      form.userId.trim(),
        password:    form.password,
        firstName:   form.firstName.trim(),
        lastName:    form.lastName.trim(),
        accountType: form.accountType as AccountType,
      } satisfies RegisterPayload);

      setSuccess(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setApiError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 18 }}>
        <div className="container" style={{ maxWidth: 480 }}>
          <div className="card cardPad" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <h2 className="h1" style={{ marginTop: 12 }}>Account Created</h2>
            <p className="muted">Redirecting you to sign in…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px 18px" }}>
      <div className="container" style={{ maxWidth: 520 }}>
        <div className="card cardPad">

          {/* Header */}
          <div className="badge">SportVault</div>
          <h1 className="h1" style={{ marginTop: 10 }}>Create account</h1>
          <p className="muted" style={{ fontSize: 14, marginTop: 6, marginBottom: 0 }}>
            Fill in the form below to get started.
          </p>

          <div className="divider" />

          {/* API error banner */}
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

            {/* User ID / Email */}
            <div>
              <div className="label">Email address (User ID) *</div>
              <input
                className="input"
                type="email"
                autoComplete="email"
                value={form.userId}
                onChange={(e) => update("userId", e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
              />
              {errors.userId && <FieldError msg={errors.userId} />}
            </div>

            {/* First / Last name row */}
            <div className="row" style={{ gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div className="label">First name *</div>
                <input
                  className="input"
                  type="text"
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={(e) => update("firstName", e.target.value)}
                  placeholder="Jane"
                  disabled={loading}
                />
                {errors.firstName && <FieldError msg={errors.firstName} />}
              </div>
              <div style={{ flex: 1 }}>
                <div className="label">Last name *</div>
                <input
                  className="input"
                  type="text"
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={(e) => update("lastName", e.target.value)}
                  placeholder="Doe"
                  disabled={loading}
                />
                {errors.lastName && <FieldError msg={errors.lastName} />}
              </div>
            </div>

            {/* Account type */}
            <div>
              <div className="label">Account type *</div>
              <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                {(["admin", "buyer", "seller"] as const).map((t) => (
                  <TypeButton
                    key={t}
                    active={form.accountType === t}
                    onClick={() => update("accountType", t)}
                    disabled={loading}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </TypeButton>
                ))}
              </div>
              {errors.accountType && <FieldError msg={errors.accountType} />}
              {form.accountType && (
                <p className="muted" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                  {form.accountType === "admin"  && "Full platform administrative access."}
                  {form.accountType === "buyer"  && "Browse and purchase sports memorabilia."}
                  {form.accountType === "seller" && "List and sell sports memorabilia."}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="label">Password *</div>
              <div style={{ position: "relative" }}>
                <input
                  className="input"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
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
                    color: "var(--muted)", cursor: "pointer", fontSize: 13, padding: 0,
                  }}
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
              {errors.password && <FieldError msg={errors.password} />}
            </div>

            {/* Confirm password */}
            <div>
              <div className="label">Confirm password *</div>
              <input
                className="input"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={form.confirmPw}
                onChange={(e) => update("confirmPw", e.target.value)}
                placeholder="••••••••••••"
                disabled={loading}
              />
              {errors.confirmPw && <FieldError msg={errors.confirmPw} />}
            </div>

            {/* Password strength indicator */}
            <PasswordStrength password={form.password} />

            {/* Actions */}
            <div
              className="row"
              style={{ justifyContent: "space-between", alignItems: "center", marginTop: 4 }}
            >
              <button
                className="btn btnPrimary"
                type="submit"
                disabled={loading}
                style={{ opacity: loading ? 0.7 : 1, minWidth: 140 }}
              >
                {loading ? "Creating account…" : "Create account"}
              </button>

              <span className="muted" style={{ fontSize: 13 }}>
                Have an account?{" "}
                <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
                  Sign in
                </Link>
              </span>
            </div>
          </form>

          <div className="divider" />
          <div className="muted" style={{ fontSize: 11, lineHeight: 1.6 }}>
            Password requirements: 12+ characters · uppercase · lowercase · digit ·
            special character (* $ ! - @)
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function FieldError({ msg }: { msg: string }) {
  return <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 5 }}>{msg}</div>;
}

function TypeButton({
  active,
  onClick,
  disabled,
  children,
}: {
  active:    boolean;
  onClick:   () => void;
  disabled:  boolean;
  children:  React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={"btn" + (active ? " btnPrimary" : "")}
      onClick={onClick}
      disabled={disabled}
      style={{ minWidth: 110 }}
    >
      {children}
    </button>
  );
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const checks = {
    "12+ characters":    password.length >= 12,
    "Uppercase letter":  /[A-Z]/.test(password),
    "Lowercase letter":  /[a-z]/.test(password),
    "Digit (0–9)":       /\d/.test(password),
    "Special (* $ ! - @)": /[*$!\-@]/.test(password),
  };

  const passed = Object.values(checks).filter(Boolean).length;
  const barColor =
    passed <= 2 ? "var(--danger)" :
    passed <= 3 ? "#f59e0b" :
    passed === 4 ? "#3b82f6" : "var(--accent-2)";

  return (
    <div style={{ marginTop: -4 }}>
      <div
        style={{
          height: 4,
          borderRadius: 4,
          background: "var(--border)",
          overflow: "hidden",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(passed / 5) * 100}%`,
            background: barColor,
            transition: "width 300ms ease, background 300ms ease",
          }}
        />
      </div>
      <div className="row" style={{ flexWrap: "wrap", gap: "4px 12px" }}>
        {Object.entries(checks).map(([label, ok]) => (
          <span
            key={label}
            style={{
              fontSize: 11,
              color: ok ? "var(--accent-2)" : "var(--muted)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {ok ? "✓" : "○"} {label}
          </span>
        ))}
      </div>
    </div>
  );
}
