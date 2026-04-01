import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();
const mockRequestUse = vi.fn();

vi.mock("axios", () => {
  const create = vi.fn((config?: { baseURL?: string }) => ({
    defaults: { baseURL: config?.baseURL },
    post: mockPost,
    get: mockGet,
    patch: mockPatch,
    delete: mockDelete,
    interceptors: {
      request: {
        use: mockRequestUse,
      },
    },
  }));

  class AxiosError extends Error {
    response?: any;
    constructor(message: string, response?: any) {
      super(message);
      this.name = "AxiosError";
      this.response = response;
    }
  }

  return {
    default: { create, AxiosError },
    create,
    AxiosError,
  };
});

describe("api admin functions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    localStorage.clear();
  });

  it("fetchOpenAccounts calls /accounts/open and returns data", async () => {
    const { fetchOpenAccounts } = await import("../../../apps/web/src/services/api");

    mockGet.mockResolvedValueOnce({
      data: [
        {
          id: "u2",
          email: "pending@test.com",
          firstName: "Pending",
          lastName: "User",
          type: "seller",
          status: "open",
          createdAt: "2026-03-31T00:00:00.000Z",
        },
      ],
    });

    const result = await fetchOpenAccounts();

    expect(mockGet).toHaveBeenCalledWith("/accounts/open");
    expect(result).toEqual([
      {
        id: "u2",
        email: "pending@test.com",
        firstName: "Pending",
        lastName: "User",
        type: "seller",
        status: "open",
        createdAt: "2026-03-31T00:00:00.000Z",
      },
    ]);
  });

  it("submitAccountDecision posts /accounts/decision with accountIds and decision", async () => {
    const { submitAccountDecision } = await import("../../../apps/web/src/services/api");

    mockPost.mockResolvedValueOnce({
      data: { message: "Approved 1 account", count: 1 },
    });

    const result = await submitAccountDecision(["u2"], "approve");

    expect(mockPost).toHaveBeenCalledWith("/accounts/decision", {
      accountIds: ["u2"],
      decision: "approve",
    });

    expect(result).toEqual({ message: "Approved 1 account", count: 1 });
  });

  it("fetchPendingProducts calls /products/pending and returns data", async () => {
    const { fetchPendingProducts } = await import("../../../apps/web/src/services/api");

    mockGet.mockResolvedValueOnce({
      data: [
        {
          id: "p1",
          name: "Signed Jersey",
          sellerId: "s1",
          quantity: 3,
          unitPrice: 120,
          status: "pending",
          imageUrl: "/images/jersey.png",
          createdAt: "2026-03-31T00:00:00.000Z",
        },
      ],
    });

    const result = await fetchPendingProducts();

    expect(mockGet).toHaveBeenCalledWith("/products/pending");
    expect(result).toEqual([
      {
        id: "p1",
        name: "Signed Jersey",
        sellerId: "s1",
        quantity: 3,
        unitPrice: 120,
        status: "pending",
        imageUrl: "/images/jersey.png",
        createdAt: "2026-03-31T00:00:00.000Z",
      },
    ]);
  });

  it("submitProductDecision posts /products/decision with productIds and decision", async () => {
    const { submitProductDecision } = await import("../../../apps/web/src/services/api");

    mockPost.mockResolvedValueOnce({
      data: { message: "Approved 1 product", count: 1 },
    });

    const result = await submitProductDecision(["p1"], "approve");

    expect(mockPost).toHaveBeenCalledWith("/products/decision", {
      productIds: ["p1"],
      decision: "approve",
    });

    expect(result).toEqual({ message: "Approved 1 product", count: 1 });
  });

  it("searchAccounts gets /search with params", async () => {
    const { searchAccounts } = await import("../../../apps/web/src/services/api");

    mockGet.mockResolvedValueOnce({
      data: [
        {
          id: "u1",
          userId: "seller@test.com",
          firstName: "Sam",
          lastName: "Seller",
          type: "seller",
          status: "active",
          activatedDate: "2026-03-01",
          suspendedDate: null,
          closedDate: null,
          createdAt: "2026-02-28",
        },
      ],
    });

    const result = await searchAccounts({
      type: "seller",
      status: "active",
      sortBy: "created_at",
      sortOrder: "desc",
    });

    expect(mockGet).toHaveBeenCalledWith("/search", {
      params: {
        type: "seller",
        status: "active",
        sortBy: "created_at",
        sortOrder: "desc",
      },
    });

    expect(result).toEqual([
      {
        id: "u1",
        userId: "seller@test.com",
        firstName: "Sam",
        lastName: "Seller",
        type: "seller",
        status: "active",
        activatedDate: "2026-03-01",
        suspendedDate: null,
        closedDate: null,
        createdAt: "2026-02-28",
      },
    ]);
  });

  it("fetchProducts calls /products and returns data", async () => {
    const { fetchProducts } = await import("../../../apps/web/src/services/api");

    mockGet.mockResolvedValueOnce({
      data: [
        {
          id: "p1",
          sellerId: "s1",
          sellerFirstName: "Sam",
          sellerLastName: "Seller",
          name: "Signed Jersey",
          category: "Jerseys",
          categoryCode: "jerseys",
          subcategory: null,
          subcategoryCode: null,
          status: "active",
          statusCode: "active",
          quantity: 3,
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-02T00:00:00.000Z",
        },
      ],
    });

    const result = await fetchProducts();

    expect(mockGet).toHaveBeenCalledWith("/products");
    expect(result).toEqual([
      {
        id: "p1",
        sellerId: "s1",
        sellerFirstName: "Sam",
        sellerLastName: "Seller",
        name: "Signed Jersey",
        category: "Jerseys",
        categoryCode: "jerseys",
        subcategory: null,
        subcategoryCode: null,
        status: "active",
        statusCode: "active",
        quantity: 3,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-02T00:00:00.000Z",
      },
    ]);
  });

  it("fetchProductDetail calls /products/:id and returns data", async () => {
    const { fetchProductDetail } = await import("../../../apps/web/src/services/api");

    mockGet.mockResolvedValueOnce({
      data: {
        id: "p1",
        sellerId: "s1",
        sellerFirstName: "Sam",
        sellerLastName: "Seller",
        name: "Signed Jersey",
        category: "Jerseys",
        categoryCode: "jerseys",
        subcategory: null,
        subcategoryCode: null,
        status: "active",
        statusCode: "active",
        quantity: 3,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-02T00:00:00.000Z",
        shortDesc: "Short desc",
        longDesc: "Long desc",
        teamName: "Team A",
        playerName: "Player A",
        gender: "Unisex",
        isSigned: true,
        isAuthenticated: true,
        isFramed: false,
        hasInscription: false,
        inscriptionText: null,
        hasMultiSigs: false,
        isProtected: false,
        protectionType: null,
        condition: "Excellent",
        conditionCode: "excellent",
        sellerEmail: "seller@test.com",
        images: [],
      },
    });

    const result = await fetchProductDetail("p1");

    expect(mockGet).toHaveBeenCalledWith("/products/p1");
    expect(result).toEqual({
      id: "p1",
      sellerId: "s1",
      sellerFirstName: "Sam",
      sellerLastName: "Seller",
      name: "Signed Jersey",
      category: "Jerseys",
      categoryCode: "jerseys",
      subcategory: null,
      subcategoryCode: null,
      status: "active",
      statusCode: "active",
      quantity: 3,
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
      shortDesc: "Short desc",
      longDesc: "Long desc",
      teamName: "Team A",
      playerName: "Player A",
      gender: "Unisex",
      isSigned: true,
      isAuthenticated: true,
      isFramed: false,
      hasInscription: false,
      inscriptionText: null,
      hasMultiSigs: false,
      isProtected: false,
      protectionType: null,
      condition: "Excellent",
      conditionCode: "excellent",
      sellerEmail: "seller@test.com",
      images: [],
    });
  });

  it("updateProductStatus posts /products/status with productIds and status", async () => {
    const { updateProductStatus } = await import("../../../apps/web/src/services/api");

    mockPost.mockResolvedValueOnce({
      data: { message: "Updated 1 product", count: 1 },
    });

    const result = await updateProductStatus(["p1"], "suspended");

    expect(mockPost).toHaveBeenCalledWith("/products/status", {
      productIds: ["p1"],
      status: "suspended",
    });

    expect(result).toEqual({ message: "Updated 1 product", count: 1 });
  });

  it("registers request interceptors for admin api instances", async () => {
    await import("../../../apps/web/src/services/api");

    expect(mockRequestUse).toHaveBeenCalled();
  });

  it("admin interceptor adds bearer token when accessToken exists", async () => {
    localStorage.setItem("accessToken", "token-123");

    await import("../../../apps/web/src/services/api");

    const interceptor = mockRequestUse.mock.calls[0][0];
    const config = interceptor({ headers: {} });

    expect(config.headers.Authorization).toBe("Bearer token-123");
  });
});