import axios, { AxiosError } from "axios";

const authApi = axios.create({
  baseURL: "/api/auth",
  headers: { "Content-Type": "application/json" },
});

const accountApi = axios.create({
  baseURL: "/api/accounts",
  headers: { "Content-Type": "application/json" },
});

const inventoryApi = axios.create({
  baseURL: "/api/inventory",
  headers: { "Content-Type": "application/json" },
});

inventoryApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function getMyProducts(): Promise<Product[]> {
  const { data } = await inventoryApi.get<Product[]>("/products/mine");
  return data;
}

export async function createProduct(payload: CreateProductPayload): Promise<Product> {
  const { data } = await inventoryApi.post<Product>("/products", payload);
  return data;
}

// Attach JWT to every request automatically
authApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
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

export interface Product {
  id: string;
  name: string;
  shortDesc?: string;
  longDesc?: string;
  quantity: number;
  unitPrice: number;
  status: string;
  imageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateProductPayload {
  name: string;
  shortDesc?: string;
  longDesc?: string;
  category: string;
  subCategory?: string;
  quantity: number;
  unitPrice: number;
}


export interface Category {
  id: string;
  name: string;
}

export async function getCategories(): Promise<Category[]> {
  const { data } = await inventoryApi.get<Category[]>("/products/categories");
  return data;
}

export async function updateProduct(
  id: string,
  payload: Partial<CreateProductPayload>
): Promise<Product> {
  const { data } = await inventoryApi.patch<Product>(`/products/${id}`, payload);
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  await inventoryApi.delete(`/products/${id}`);
}