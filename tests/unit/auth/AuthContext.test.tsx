import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../../../apps/web/src/context/AuthContext";
import * as api from "../../../apps/web/src/services/api";

vi.mock("../../../apps/web/src/services/api", () => ({
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
}));

function TestConsumer() {
  const { user, isAuth, login, logout } = useAuth();

  return (
    <div>
      <div data-testid="auth">{isAuth ? "true" : "false"}</div>
      <div data-testid="user-email">{user?.email ?? ""}</div>
      <button
        onClick={() =>
          login({
            email: "buyer@test.com",
            password: "Different1!",
          })
        }
      >
        Login
      </button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("initializes from localStorage", () => {
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: "u1",
        email: "saved@test.com",
        firstName: "Saved",
        lastName: "User",
        type: "buyer",
      })
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId("auth").textContent).toBe("true");
    expect(screen.getByTestId("user-email").textContent).toBe("saved@test.com");
  });

  it("logs in and stores tokens and user", async () => {
    (api.loginUser as any).mockResolvedValue({
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

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText("Login"));

    await waitFor(() => {
      expect(api.loginUser).toHaveBeenCalledWith({
        email: "buyer@test.com",
        password: "Different1!",
      });
    });

    expect(localStorage.getItem("accessToken")).toBe("access-123");
    expect(localStorage.getItem("refreshToken")).toBe("refresh-123");
    expect(JSON.parse(localStorage.getItem("user") || "{}").email).toBe("buyer@test.com");
    expect(screen.getByTestId("auth").textContent).toBe("true");
    expect(screen.getByTestId("user-email").textContent).toBe("buyer@test.com");
  });

  it("logs out and clears storage", async () => {
    localStorage.setItem("accessToken", "access-123");
    localStorage.setItem("refreshToken", "refresh-123");
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: "u1",
        email: "buyer@test.com",
        firstName: "Buyer",
        lastName: "User",
        type: "buyer",
      })
    );

    (api.logoutUser as any).mockResolvedValue(undefined);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText("Logout"));

    await waitFor(() => {
      expect(api.logoutUser).toHaveBeenCalledWith("u1");
    });

    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(screen.getByTestId("auth").textContent).toBe("false");
  });

  it("still clears storage if logout API fails", async () => {
    localStorage.setItem("accessToken", "access-123");
    localStorage.setItem("refreshToken", "refresh-123");
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: "u1",
        email: "buyer@test.com",
        firstName: "Buyer",
        lastName: "User",
        type: "buyer",
      })
    );

    (api.logoutUser as any).mockRejectedValue(new Error("logout failed"));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText("Logout"));

    await waitFor(() => {
      expect(screen.getByTestId("auth").textContent).toBe("false");
    });

    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });
});