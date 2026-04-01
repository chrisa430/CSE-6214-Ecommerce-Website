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

describe("api cart and orders functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    localStorage.clear();
  });

  it("getCart calls / and returns cart data", async () => {
    const { getCart } = await import("../../../apps/web/src/services/api");

    mockGet.mockResolvedValueOnce({
      data: [
        {
          productId: "p1",
          quantity: 2,
          unitPrice: 20,
          name: "Signed Baseball",
        },
      ],
    });

    const result = await getCart();

    expect(mockGet).toHaveBeenCalledWith("/");
    expect(result).toEqual([
      {
        productId: "p1",
        quantity: 2,
        unitPrice: 20,
        name: "Signed Baseball",
      },
    ]);
  });

  it("addToCart posts to /items with mapped product payload", async () => {
    const { addToCart } = await import("../../../apps/web/src/services/api");

    mockPost.mockResolvedValueOnce({
      data: {
        productId: "p1",
        quantity: 1,
        unitPrice: 25,
      },
    });

    const product = {
      id: "p1",
      name: "Signed Jersey",
      quantity: 3,
      unitPrice: 25,
      status: "active",
    };

    const result = await addToCart(product as any);

    expect(mockPost).toHaveBeenCalledWith("/items", {
      productId: "p1",
      quantity: 1,
      unitPrice: 25,
    });

    expect(result).toEqual({
      productId: "p1",
      quantity: 1,
      unitPrice: 25,
    });
  });

  it("removeFromCart deletes /items/:productId", async () => {
    const { removeFromCart } = await import("../../../apps/web/src/services/api");

    mockDelete.mockResolvedValueOnce({});

    await removeFromCart("p1");

    expect(mockDelete).toHaveBeenCalledWith("/items/p1");
  });

  it("checkout posts to /checkout and returns order response", async () => {
    const { checkout } = await import("../../../apps/web/src/services/api");

    mockPost.mockResolvedValueOnce({
      data: {
        message: "Checkout completed",
        order: {
          id: "ord-1",
          buyerId: "buyer-1",
          subtotal: 20,
          tax: 1.4,
          total: 21.4,
          createdAt: "2026-03-31T00:00:00.000Z",
        },
        items: [
          {
            productId: "p1",
            quantity: 1,
            unitPrice: 20,
          },
        ],
      },
    });

    const result = await checkout();

    expect(mockPost).toHaveBeenCalledWith("/checkout");
    expect(result).toEqual({
      message: "Checkout completed",
      order: {
        id: "ord-1",
        buyerId: "buyer-1",
        subtotal: 20,
        tax: 1.4,
        total: 21.4,
        createdAt: "2026-03-31T00:00:00.000Z",
      },
      items: [
        {
          productId: "p1",
          quantity: 1,
          unitPrice: 20,
        },
      ],
    });
  });

  it("getMyOrders calls /mine and returns order history", async () => {
    const { getMyOrders } = await import("../../../apps/web/src/services/api");

    mockGet.mockResolvedValueOnce({
      data: [
        {
          id: "ord-1",
          subtotal: 20,
          tax: 1.4,
          total: 21.4,
          status: "confirmed",
          createdAt: "2026-03-31T00:00:00.000Z",
          items: [
            {
              productId: "p1",
              quantity: 1,
              unitPrice: 20,
            },
          ],
        },
      ],
    });

    const result = await getMyOrders();

    expect(mockGet).toHaveBeenCalledWith("/mine");
    expect(result).toEqual([
      {
        id: "ord-1",
        subtotal: 20,
        tax: 1.4,
        total: 21.4,
        status: "confirmed",
        createdAt: "2026-03-31T00:00:00.000Z",
        items: [
          {
            productId: "p1",
            quantity: 1,
            unitPrice: 20,
          },
        ],
      },
    ]);
  });

  it("registers request interceptors for cart/order api instances", async () => {
    await import("../../../apps/web/src/services/api");

    expect(mockRequestUse).toHaveBeenCalled();
  });

  it("cart/order interceptor adds bearer token when accessToken exists", async () => {
    localStorage.setItem("accessToken", "token-123");

    await import("../../../apps/web/src/services/api");

    const interceptor = mockRequestUse.mock.calls[0][0];
    const config = interceptor({ headers: {} });

    expect(config.headers.Authorization).toBe("Bearer token-123");
  });
});