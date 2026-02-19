import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type Role = "admin" | "buyer" | "seller";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("admin@demo");
  const [password, setPassword] = useState("password");
  const [role, setRole] = useState<Role>("admin");

  const helper = useMemo(() => {
    if (role === "admin") return "Admin dashboard access.";
    if (role === "buyer") return "Buyer storefront access.";
    return "Seller inventory access.";
  }, [role]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    // temporary routing until real auth exists
    if (role === "admin") navigate("/admin");
    if (role === "buyer") navigate("/buyer");
    if (role === "seller") navigate("/seller");
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 18 }}>
      <div className="container" style={{ maxWidth: 520 }}>
        <div className="card cardPad">
          <div className="badge">SportVault</div>

          <h1 className="h1" style={{ marginTop: 10 }}>
            Sign in
          </h1>

          <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>
            Enter your credentials to continue.
          </div>

          <div className="divider" />

          <form onSubmit={onSubmit} className="col" style={{ gap: 12 }}>
            <div>
              <div className="label">Email</div>
              <input
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <div className="label">Password</div>
              <input
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
              />
            </div>

            <div>
              <div className="label">Role</div>
              <div className="row" style={{ flexWrap: "wrap" }}>
                <RoleButton active={role === "admin"} onClick={() => setRole("admin")}>
                  Admin
                </RoleButton>
                <RoleButton active={role === "buyer"} onClick={() => setRole("buyer")}>
                  Buyer
                </RoleButton>
                <RoleButton active={role === "seller"} onClick={() => setRole("seller")}>
                  Seller
                </RoleButton>
              </div>

              <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                {helper}
              </div>
            </div>

            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <button className="btn btnPrimary" type="submit">
                Continue
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function RoleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={"btn" + (active ? " btnPrimary" : "")}
      onClick={onClick}
      style={{ minWidth: 110 }}
    >
      {children}
    </button>
  );
}
