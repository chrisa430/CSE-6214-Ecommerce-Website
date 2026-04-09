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

describe("api inventory functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    localStorage.clear();
  });

  it("getMyProducts calls /products/mine and returns data", async () => {
    const { getMyProducts } = await import("../../../apps/web/src/services/api");

    mockGet.mockResolvedValueOnce({
      data: [
        {
          id: "p1",
          name: "Signed Jersey",
          quantity: 3,
          unitPrice: 120,
          status: "pending",
        },
      ],
    });

    const result = await getMyProducts();

    expect(mockGet).toHaveBeenCalledWith("/products/mine");
    expect(result).toEqual([
      {
        id: "p1",
        name: "Signed Jersey",
        quantity: 3,
        unitPrice: 120,
        status: "pending",
      },
    ]);
  });

  it("getCategories calls /categories and returns data", async () => {
    const { getCategories } = await import("../../../apps/web/src/services/api");

    mockGet.mockResolvedValueOnce({
      data: [
        { id: "cat-1", name: "Jerseys" },
        { id: "cat-2", name: "Baseballs" },
      ],
    });

    const result = await getCategories();

    expect(mockGet).toHaveBeenCalledWith("/categories");
    expect(result).toEqual([
      { id: "cat-1", name: "Jerseys" },
      { id: "cat-2", name: "Baseballs" },
    ]);
  });

  it("createProduct posts to /products with payload", async () => {
    const { createProduct } = await import("../../../apps/web/src/services/api");

    mockPost.mockResolvedValueOnce({
      data: {
        id: "p2",
        name: "Signed Baseball",
        category: "cat-2",
        quantity: 2,
        unitPrice: 45,
        status: "pending",
      },
    });

    const payload = {
      name: "Signed Baseball",
      category: "cat-2",
      quantity: 2,
      unitPrice: 45,
    };

    const result = await createProduct(payload);

    expect(mockPost).toHaveBeenCalledWith("/products", payload);
    expect(result).toEqual({
      id: "p2",
      name: "Signed Baseball",
      category: "cat-2",
      quantity: 2,
      unitPrice: 45,
      status: "pending",
    });
  });

  it("updateProduct patches /products/:id with payload", async () => {
    const { updateProduct } = await import("../../../apps/web/src/services/api");

    mockPatch.mockResolvedValueOnce({
      data: {
        id: "p1",
        name: "Updated Jersey",
        quantity: 5,
        unitPrice: 150,
        status: "pending",
      },
    });

    const result = await updateProduct("p1", {
      name: "Updated Jersey",
      quantity: 5,
      unitPrice: 150,
    });

    expect(mockPatch).toHaveBeenCalledWith("/products/p1", {
      name: "Updated Jersey",
      quantity: 5,
      unitPrice: 150,
    });

    expect(result).toEqual({
      id: "p1",
      name: "Updated Jersey",
      quantity: 5,
      unitPrice: 150,
      status: "pending",
    });
  });

  it("updateProductImage patches /products/:id/image with imageUrl", async () => {
    const { updateProductImage } = await import("../../../apps/web/src/services/api");

    mockPatch.mockResolvedValueOnce({
      data: { success: true },
    });

    const result = await updateProductImage("p1", "/images/jersey.png");

    expect(mockPatch).toHaveBeenCalledWith("/products/p1/image", {
      imageUrl: "/images/jersey.png",
    });

    expect(result).toEqual({ success: true });
  });

  it("deleteProduct calls delete on /products/:id", async () => {
    const { deleteProduct } = await import("../../../apps/web/src/services/api");

    mockDelete.mockResolvedValueOnce({});

    await deleteProduct("p1");

    expect(mockDelete).toHaveBeenCalledWith("/products/p1");
  });

  it("getActiveProducts calls /products/active and returns data", async () => {
    const { getActiveProducts } = await import("../../../apps/web/src/services/api");

    mockGet.mockResolvedValueOnce({
      data: [
        {
          id: "p1",
          name: "Signed Jersey",
          quantity: 3,
          unitPrice: 120,
          status: "active",
        },
      ],
    });

    const result = await getActiveProducts();

    expect(mockGet).toHaveBeenCalledWith("/products/active");
    expect(result).toEqual([
      {
        id: "p1",
        name: "Signed Jersey",
        quantity: 3,
        unitPrice: 120,
        status: "active",
      },
    ]);
  });

  it("registers request interceptors for inventory api instances", async () => {
    await import("../../../apps/web/src/services/api");

    expect(mockRequestUse).toHaveBeenCalled();
  });

  it("inventory interceptor adds bearer token when accessToken exists", async () => {
    localStorage.setItem("accessToken", "token-123");

    await import("../../../apps/web/src/services/api");

    const interceptor = mockRequestUse.mock.calls[0][0];
    const config = interceptor({ headers: {} });

    expect(config.headers.Authorization).toBe("Bearer token-123");
  });
});