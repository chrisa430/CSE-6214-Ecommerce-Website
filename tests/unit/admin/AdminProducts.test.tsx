import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminProducts from "../../../apps/web/src/pages/admin/AdminProducts";
import * as api from "../../../apps/web/src/services/api";

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

vi.mock("../../../apps/web/src/services/api", () => ({
  fetchProducts: vi.fn(),
  updateProductStatus: vi.fn(),
  extractApiError: vi.fn(() => "Request failed"),
}));

describe("AdminProducts", () => {
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

  function mockProducts() {
    (api.fetchProducts as any).mockResolvedValue([
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
        createdAt: "2026-03-01",
        updatedAt: "2026-03-02",
      },
    ]);
  }

  it("renders product inventory page", async () => {
    mockProducts();

    render(
      <MemoryRouter>
        <AdminProducts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/product inventory/i)).toBeInTheDocument();
      expect(screen.getByText(/signed jersey/i)).toBeInTheDocument();
    });
  });

  it("redirects non-admin users", async () => {
    mockUser = {
      id: "b1",
      email: "buyer@test.com",
      firstName: "Buyer",
      lastName: "User",
      type: "buyer",
    };

    render(
      <MemoryRouter>
        <AdminProducts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
    });
  });

  it("loads products", async () => {
    mockProducts();

    render(
      <MemoryRouter>
        <AdminProducts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(api.fetchProducts).toHaveBeenCalled();
    });
  });

  it("filters products by name", async () => {
    mockProducts();

    render(
      <MemoryRouter>
        <AdminProducts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/signed jersey/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/type to filter/i), {
      target: { value: "jersey" },
    });

    expect(screen.getByText(/signed jersey/i)).toBeInTheDocument();
  });

  it("disables bulk action buttons when nothing is selected", async () => {
    mockProducts();

    render(
        <MemoryRouter>
        <AdminProducts />
        </MemoryRouter>
    );

    await waitFor(() => {
        expect(screen.getByText(/signed jersey/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /set active/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /suspend/i })).toBeDisabled();
    });

  it("updates selected product statuses", async () => {
    mockProducts();
    (api.updateProductStatus as any).mockResolvedValue({
      message: "Updated 1 product",
      count: 1,
    });

    render(
      <MemoryRouter>
        <AdminProducts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/signed jersey/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    fireEvent.click(screen.getByRole("button", { name: /suspend selected/i }));

    await waitFor(() => {
      expect(api.updateProductStatus).toHaveBeenCalledWith(["p1"], "suspended");
    });
  });

  it("shows API error when products fail to load", async () => {
    (api.fetchProducts as any).mockRejectedValue(new Error("fail"));

    render(
      <MemoryRouter>
        <AdminProducts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/request failed/i)).toBeInTheDocument();
    });
  });
});