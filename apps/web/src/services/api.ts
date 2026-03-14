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
  baseURL: "/api/inventory",
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
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    type: string;
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
  userId: string;
  password: string;
  firstName: string;
  lastName: string;
  accountType: "admin" | "buyer" | "seller";
}

export interface RegisterResponse {
  message: string;
  accountId: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
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

// ── Inventory endpoints ─────────────────────────────────────────────────────

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

export async function getMyProducts(): Promise<Product[]> {
  const { data } = await inventoryApi.get<Product[]>("/products/mine");
  return data;
}

export async function createProduct(payload: CreateProductPayload): Promise<Product> {
  const { data } = await inventoryApi.post<Product>("/products", payload);
  return data;
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

export async function updateProductImage(id: string, imageUrl: string) {
  const { data } = await inventoryApi.patch(`/products/${id}/image`, {
    imageUrl,
  });
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  await inventoryApi.delete(`/products/${id}`);
}

export async function getActiveProducts(): Promise<Product[]> {
  const { data } = await inventoryApi.get<Product[]>("/products/active");
  return data;
}

// ── Admin endpoints ─────────────────────────────────────────────────────────

export interface OpenAccount {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  type: string;
  status: string;
  createdAt: string;
}

export interface PendingProduct {
  id: string;
  name: string;
  sellerId: string;
  quantity: number;
  unitPrice: number;
  status: string;
  imageUrl?: string;
  createdAt: string;
}

export async function fetchOpenAccounts(): Promise<OpenAccount[]> {
  const { data } = await adminApi.get<OpenAccount[]>("/accounts/open");
  return data;
}

export async function submitAccountDecision(
  accountIds: string[],
  decision: "approve" | "reject"
): Promise<{ message: string; count: number }> {
  const { data } = await adminApi.post<{ message: string; count: number }>(
    "/accounts/decision",
    { accountIds, decision }
  );
  return data;
}

export async function fetchPendingProducts(): Promise<PendingProduct[]> {
  const { data } = await adminApi.get<PendingProduct[]>("/products/pending");
  return data;
}

export async function submitProductDecision(
  productIds: string[],
  decision: "approve" | "reject"
): Promise<{ message: string; count: number }> {
  const { data } = await adminApi.post<{ message: string; count: number }>(
    "/products/decision",
    { productIds, decision }
  );
  return data;
}

// ── Shopping Cart ─────────────────────────────────────────────────────────

export interface CartItem {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  imageUrl?: string;
}

const CART_KEY = "buyerCart";

export function getCart(): CartItem[] {
  const raw = localStorage.getItem(CART_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function addToCart(product: Product): void {
  const cart = getCart();
  const existing = cart.find((item) => item.productId === product.id);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      productId: product.id,
      name: product.name,
      unitPrice: product.unitPrice,
      quantity: 1,
      imageUrl: product.imageUrl,
    });
  }

  saveCart(cart);
}

export function removeFromCart(productId: string): void {
  const cart = getCart().filter((item) => item.productId !== productId);
  saveCart(cart);
}