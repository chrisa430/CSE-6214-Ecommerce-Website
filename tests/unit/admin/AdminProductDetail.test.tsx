import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminProductDetail from "../../../apps/web/src/pages/admin/AdminProductDetail";
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
    useParams: () => ({ id: "p1" }),
  };
});

vi.mock("../../../apps/web/src/context/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

vi.mock("../../../apps/web/src/services/api", () => ({
  fetchProductDetail: vi.fn(),
  extractApiError: vi.fn(() => "Request failed"),
}));

describe("AdminProductDetail", () => {
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

  function mockDetail() {
    (api.fetchProductDetail as any).mockResolvedValue({
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
      quantity: 3,
      createdAt: "2026-03-01T00:00:00Z",
      updatedAt: "2026-03-02T00:00:00Z",
      shortDesc: "Short desc",
      longDesc: "Long desc",
      teamName: "Team A",
      playerName: "Player A",
      gender: "Unisex",
      isSigned: true,
      isAuthenticated: true,
      isFramed: false,
      hasInscription: false,
      inscriptionText: null,
      hasMultiSigs: false,
      isProtected: false,
      protectionType: null,
      condition: "Excellent",
      conditionCode: "excellent",
      sellerEmail: "seller@test.com",
      images: [],
    });
  }

  it("shows loading state initially", () => {
    (api.fetchProductDetail as any).mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <AdminProductDetail />
      </MemoryRouter>
    );

    expect(screen.getByText(/loading product/i)).toBeInTheDocument();
  });

  it("renders product detail for admin", async () => {
    mockDetail();

    render(
      <MemoryRouter>
        <AdminProductDetail />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/signed jersey/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/identity/i)).toBeInTheDocument();
      expect(screen.getByText(/seller@test.com/i)).toBeInTheDocument();
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
        <AdminProductDetail />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
    });
  });

  it("shows not found state when fetch fails", async () => {
    (api.fetchProductDetail as any).mockRejectedValue(new Error("fail"));

    render(
      <MemoryRouter>
        <AdminProductDetail />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/product not found/i)).toBeInTheDocument();
      expect(screen.getByText(/request failed/i)).toBeInTheDocument();
    });
  });
});