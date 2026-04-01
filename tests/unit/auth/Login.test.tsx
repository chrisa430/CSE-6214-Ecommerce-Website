import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Login from "../../../apps/web/src/pages/Login";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockLogin = vi.fn();

vi.mock("../../../apps/web/src/context/AuthContext", () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs in and redirects buyer", async () => {
    mockLogin.mockResolvedValue({
      user: { type: "buyer" },
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: "test@test.com" },
    });

    fireEvent.change(screen.getByPlaceholderText(/••••••••••••/i), {
      target: { value: "Valid$123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: "test@test.com",
        password: "Valid$123",
      });
      expect(mockNavigate).toHaveBeenCalledWith("/buyer");
    });
  });

  it("shows error for invalid email", async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: "invalid-email" },
    });

    fireEvent.change(screen.getByPlaceholderText(/••••••••••••/i), {
      target: { value: "Valid$123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByText(/enter a valid email/i)
    ).toBeInTheDocument();
  });

  it("shows error for invalid password", async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: "test@test.com" },
    });

    fireEvent.change(screen.getByPlaceholderText(/••••••••••••/i), {
      target: { value: "weak" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByText(/password must be/i)
    ).toBeInTheDocument();
  });

  it("shows API error on failed login", async () => {
    mockLogin.mockRejectedValue({
      response: {
        data: { error: "Invalid credentials" },
      },
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: "test@test.com" },
    });

    fireEvent.change(screen.getByPlaceholderText(/••••••••••••/i), {
      target: { value: "Valid$123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/an unexpected error occurred/i)
      ).toBeInTheDocument();
    });
  });
});