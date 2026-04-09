import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BuyerLayout from "../../../apps/web/src/layouts/BuyerLayout";

const mockNavigate = vi.fn();
const mockLogout = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Outlet: () => <div>Outlet Content</div>,
  };
});

vi.mock("../../../apps/web/src/context/AuthContext", () => ({
  useAuth: () => ({
    logout: mockLogout,
    user: {
      id: "u1",
      email: "buyer@test.com",
      firstName: "Buyer",
      lastName: "User",
      type: "buyer",
    },
  }),
}));

describe("BuyerLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders buyer navigation", () => {
    render(
      <MemoryRouter>
        <BuyerLayout />
      </MemoryRouter>
    );

    expect(screen.getByText(/buyer portal/i)).toBeInTheDocument();
    expect(screen.getByText(/browse products/i)).toBeInTheDocument();
    expect(screen.getByText(/shopping cart/i)).toBeInTheDocument();
    expect(screen.getByText(/order history/i)).toBeInTheDocument();
  });

  it("logs out and redirects to login", async () => {
    mockLogout.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <BuyerLayout />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /log out/i }));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("refresh button navigates to buyer home", () => {
    render(
      <MemoryRouter>
        <BuyerLayout />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/buyer");
  });
});