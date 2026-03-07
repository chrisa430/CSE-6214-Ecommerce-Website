import axios, { AxiosError } from "axios";

const authApi = axios.create({
  baseURL: "/api/auth",
  headers: { "Content-Type": "application/json" },
});

const accountApi = axios.create({
  baseURL: "/api/accounts",
  headers: { "Content-Type": "application/json" },
});

const adminApi = axios.create({
  baseURL: "/api/admin",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT to every authenticated request automatically
[authApi, accountApi, adminApi].forEach((instance) => {
  instance.interceptors.request.use((config) => {
    const token = localStorage.getItem("accessToken");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
});

// ── Auth endpoints ──────────────────────────────────────────────────────────

export interface LoginPayload {
  email:    string;
  password: string;
}

export interface LoginResponse {
  accessToken:  string;
  refreshToken: string;
  user: {
    id:        string;
    email:     string;
    firstName: string;
    lastName:  string;
    type:      string;
  };
}

export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await authApi.post<LoginResponse>("/login", payload);
  return data;
}

export async function logoutUser(accountId: string): Promise<void> {
  await authApi.post("/logout", { accountId });
}

// ── Account endpoints ───────────────────────────────────────────────────────

export interface RegisterPayload {
  userId:      string;
  password:    string;
  firstName:   string;
  lastName:    string;
  accountType: "admin" | "buyer" | "seller";
}

export interface RegisterResponse {
  message:   string;
  accountId: string;
  user: {
    id:        string;
    email:     string;
    firstName: string;
    lastName:  string;
  };
}

export async function registerUser(
  payload: RegisterPayload
): Promise<RegisterResponse> {
  const { data } = await accountApi.post<RegisterResponse>("/register", payload);
  return data;
}

// ── Error message extractor ─────────────────────────────────────────────────

export function extractApiError(err: unknown): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as
      | { error?: string; errors?: Record<string, string> }
      | undefined;
    if (data?.error) return data.error;
    if (data?.errors) return Object.values(data.errors).join(" ");
    return err.message;
  }
  return "An unexpected error occurred.";
}

// ── Admin endpoints ─────────────────────────────────────────────────────────

/** Shape of an account record returned by GET /admin/accounts/open */
export interface OpenAccount {
  id:        string;
  email:     string;
  firstName: string;
  lastName:  string;
  type:      string;
  status:    string;
  createdAt: string;
}

/** Fetch all accounts with status = 'open' (pending admin approval) */
export async function fetchOpenAccounts(): Promise<OpenAccount[]> {
  const { data } = await adminApi.get<OpenAccount[]>("/accounts/open");
  return data;
}

/** Bulk approve or reject open account requests */
export async function submitAccountDecision(
  accountIds: string[],
  decision:   "approve" | "reject"
): Promise<{ message: string; count: number }> {
  const { data } = await adminApi.post<{ message: string; count: number }>(
    "/accounts/decision",
    { accountIds, decision }
  );
  return data;
}
