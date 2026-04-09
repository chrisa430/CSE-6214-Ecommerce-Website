import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminLayout from "../../../apps/web/src/layouts/AdminLayout";

const mockNavigate = vi.fn();
const mockLogout = vi.fn();

let mockUser: any = {
  id: "u1",
  email: "admin@test.com",
  firstName: "Admin",
  lastName: "User",
  type: "admin",
};

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
    user: mockUser,
  }),
}));

describe("AdminLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      id: "u1",
      email: "admin@test.com",
      firstName: "Admin",
      lastName: "User",
      type: "admin",
    };
  });

  it("renders admin navigation", () => {
    render(
      <MemoryRouter>
        <AdminLayout />
      </MemoryRouter>
    );

    expect(screen.getByText(/admin portal/i)).toBeInTheDocument();
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/product inventory/i)).toBeInTheDocument();
  });

  it("logs out and redirects to login", async () => {
    mockLogout.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <AdminLayout />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /log out/i }));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("redirects non-admin users to login", async () => {
    mockUser = {
      id: "u2",
      email: "buyer@test.com",
      firstName: "Buyer",
      lastName: "User",
      type: "buyer",
    };

    render(
      <MemoryRouter>
        <AdminLayout />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
    });
  });

  it("refresh button navigates to admin home", () => {
    render(
      <MemoryRouter>
        <AdminLayout />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/admin");
  });
});