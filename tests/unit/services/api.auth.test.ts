import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPost = vi.fn();
const mockRequestUse = vi.fn();

vi.mock("axios", () => {
  const create = vi.fn(() => ({
    post: mockPost,
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
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

describe("api auth functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    localStorage.clear();
  });

  it("loginUser posts to /login and returns response data", async () => {
    const { loginUser } = await import("../../../apps/web/src/services/api");

    mockPost.mockResolvedValueOnce({
      data: {
        accessToken: "access-123",
        refreshToken: "refresh-123",
        user: {
          id: "u1",
          email: "buyer@test.com",
          firstName: "Buyer",
          lastName: "User",
          type: "buyer",
        },
      },
    });

    const result = await loginUser({
      email: "buyer@test.com",
      password: "Different1!",
    });

    expect(mockPost).toHaveBeenCalledWith("/login", {
      email: "buyer@test.com",
      password: "Different1!",
    });

    expect(result).toEqual({
      accessToken: "access-123",
      refreshToken: "refresh-123",
      user: {
        id: "u1",
        email: "buyer@test.com",
        firstName: "Buyer",
        lastName: "User",
        type: "buyer",
      },
    });
  });

  it("logoutUser posts to /logout with accountId", async () => {
    const { logoutUser } = await import("../../../apps/web/src/services/api");

    mockPost.mockResolvedValueOnce({ data: {} });

    await logoutUser("acc-1");

    expect(mockPost).toHaveBeenCalledWith("/logout", {
      accountId: "acc-1",
    });
  });

  it("extractApiError returns error field from axios error response", async () => {
    const { extractApiError } = await import("../../../apps/web/src/services/api");
    const { AxiosError } = await import("axios");

    const err = new AxiosError("Request failed", {
      data: { error: "Invalid credentials" },
    });

    expect(extractApiError(err)).toBe("Invalid credentials");
  });

  it("extractApiError returns joined validation errors from axios error response", async () => {
    const { extractApiError } = await import("../../../apps/web/src/services/api");
    const { AxiosError } = await import("axios");

    const err = new AxiosError("Request failed", {
      data: {
        errors: {
          email: "Email is required",
          password: "Password is required",
        },
      },
    });

    expect(extractApiError(err)).toBe(
      "Email is required Password is required"
    );
  });

  it("extractApiError returns axios message when response has no error fields", async () => {
    const { extractApiError } = await import("../../../apps/web/src/services/api");
    const { AxiosError } = await import("axios");

    const err = new AxiosError("Network Error", { data: {} });

    expect(extractApiError(err)).toBe("Network Error");
  });

  it("extractApiError returns fallback for non-axios errors", async () => {
    const { extractApiError } = await import("../../../apps/web/src/services/api");

    expect(extractApiError(new Error("plain error"))).toBe(
      "An unexpected error occurred."
    );
  });

  it("registers request interceptors on axios instances", async () => {
    await import("../../../apps/web/src/services/api");

    expect(mockRequestUse).toHaveBeenCalled();
  });

  it("auth interceptor adds bearer token when accessToken exists", async () => {
    localStorage.setItem("accessToken", "token-123");

    await import("../../../apps/web/src/services/api");

    const interceptor = mockRequestUse.mock.calls[0][0];
    const config = interceptor({ headers: {} });

    expect(config.headers.Authorization).toBe("Bearer token-123");
  });
});