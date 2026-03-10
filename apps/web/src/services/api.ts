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

const inventoryApi = axios.create({
  baseURL: "/api/admin",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT to every authenticated request automatically
[authApi, accountApi, adminApi, inventoryApi].forEach((instance) => {
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

/** Full account record returned by GET /accounts/search */
export interface AccountRecord {
  id:             string;
  userId:         string;
  firstName:      string;
  lastName:       string;
  type:           string;
  status:         string;
  activatedDate:  string | null;
  suspendedDate:  string | null;
  closedDate:     string | null;
  createdAt:      string;
}

export interface AccountSearchParams {
  type?:      string;
  status?:    string;
  sortBy?:    "activated_date" | "suspended_date" | "closed_date" | "created_at";
  sortOrder?: "asc" | "desc";
}

/** Search / filter / sort all accounts — admin only */
export async function searchAccounts(
  params: AccountSearchParams = {}
): Promise<AccountRecord[]> {
  const { data } = await accountApi.get<AccountRecord[]>("/search", { params });
  return data;
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

// ── Product / Inventory endpoints ───────────────────────────────────────────

/** Summary row returned by GET /admin/products */
export interface ProductSummary {
  id:               string;
  sellerId:         string;
  sellerFirstName:  string;
  sellerLastName:   string;
  name:             string;
  category:         string;
  categoryCode:     string;
  subcategory:      string | null;
  subcategoryCode:  string | null;
  status:           string;
  statusCode:       string;
  quantity:         number;
  createdAt:        string;
  updatedAt:        string;
}

/** Image record nested inside ProductDetail */
export interface ProductImage {
  id:        string;
  name:      string | null;
  shortDesc: string | null;
  imageUrl:  string;
  sortOrder: number;
  isPrimary: boolean;
}

/** Full detail record returned by GET /admin/products/:id */
export interface ProductDetail extends ProductSummary {
  shortDesc:      string | null;
  longDesc:       string | null;
  teamName:       string | null;
  playerName:     string | null;
  gender:         string | null;
  isSigned:       boolean;
  isAuthenticated:boolean;
  isFramed:       boolean;
  hasInscription: boolean;
  inscriptionText:string | null;
  hasMultiSigs:   boolean;
  isProtected:    boolean;
  protectionType: string | null;
  condition:      string | null;
  conditionCode:  string | null;
  sellerEmail:    string;
  images:         ProductImage[];
}

/** Fetch all products — admin only */
export async function fetchProducts(): Promise<ProductSummary[]> {
  const { data } = await inventoryApi.get<ProductSummary[]>("/products");
  return data;
}

/** Fetch full product detail — admin only */
export async function fetchProductDetail(id: string): Promise<ProductDetail> {
  const { data } = await inventoryApi.get<ProductDetail>(`/products/${id}`);
  return data;
}

/** Bulk set product status — admin only */
export async function updateProductStatus(
  productIds: string[],
  status:     "active" | "suspended"
): Promise<{ message: string; count: number }> {
  const { data } = await inventoryApi.post<{ message: string; count: number }>(
    "/products/status",
    { productIds, status }
  );
  return data;
}
