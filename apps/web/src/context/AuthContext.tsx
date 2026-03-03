import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { loginUser, logoutUser, LoginPayload, LoginResponse } from "../services/api";

interface AuthUser {
  id:        string;
  email:     string;
  firstName: string;
  lastName:  string;
  type:      "admin" | "buyer" | "seller";
}

interface AuthContextValue {
  user:    AuthUser | null;
  login:   (payload: LoginPayload) => Promise<LoginResponse>;
  logout:  () => Promise<void>;
  isAuth:  boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  });

  const login = useCallback(async (payload: LoginPayload): Promise<LoginResponse> => {
    const resp = await loginUser(payload);
    localStorage.setItem("accessToken",  resp.accessToken);
    localStorage.setItem("refreshToken", resp.refreshToken);
    localStorage.setItem("user", JSON.stringify(resp.user));
    setUser(resp.user as AuthUser);
    return resp;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    if (user) {
      try { await logoutUser(user.id); } catch { /* best-effort */ }
    }
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setUser(null);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuth: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
