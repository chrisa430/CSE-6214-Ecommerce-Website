import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminHome from "../../../apps/web/src/pages/admin/AdminHome";

const mockNavigate = vi.fn();

let mockUser: any = {
  id: "a1",
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
  };
});

vi.mock("../../../apps/web/src/context/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

describe("AdminHome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      id: "a1",
      email: "admin@test.com",
      firstName: "Admin",
      lastName: "User",
      type: "admin",
    };
  });

  it("renders admin dashboard for admin user", () => {
    render(
      <MemoryRouter>
        <AdminHome />
      </MemoryRouter>
    );

    expect(screen.getByText(/quick actions/i)).toBeInTheDocument();
    expect(screen.getByText(/recent activity/i)).toBeInTheDocument();
    expect(screen.getByText(/pending approvals/i)).toBeInTheDocument();
  });

  it("renders access denied for missing user", () => {
    mockUser = null;

    render(
      <MemoryRouter>
        <AdminHome />
      </MemoryRouter>
    );

    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
  });

  it("redirects non-admin users to login", async () => {
    mockUser = {
      id: "b1",
      email: "buyer@test.com",
      firstName: "Buyer",
      lastName: "User",
      type: "buyer",
    };

    render(
      <MemoryRouter>
        <AdminHome />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
    });
  });

  it("renders quick action links", () => {
    render(
      <MemoryRouter>
        <AdminHome />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /open admin tools/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /open/i }).length).toBeGreaterThan(0);
  });
});