import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SellerLayout from "../../../apps/web/src/layouts/SellerLayout";

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
      email: "seller@test.com",
      firstName: "Seller",
      lastName: "User",
      type: "seller",
    },
  }),
}));

describe("SellerLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders seller info and navigation", () => {
    render(
        <MemoryRouter>
        <SellerLayout />
        </MemoryRouter>
    );

    expect(screen.getByText(/seller portal/i)).toBeInTheDocument();

    expect(
        screen.getByRole("link", { name: /inventory/i })
    ).toBeInTheDocument();

    expect(
        screen.getByRole("link", { name: /dashboard/i })
    ).toBeInTheDocument();
    });

  it("logs out and redirects to login", async () => {
    mockLogout.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <SellerLayout />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /log out/i }));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("refresh button navigates to seller home", () => {
    render(
      <MemoryRouter>
        <SellerLayout />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/seller");
  });
});