import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminOrders from "../../../apps/web/src/pages/admin/AdminOrders";
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
  getOrderConfig: vi.fn(),
  updateOrderConfig: vi.fn(),
  getAdminOrders: vi.fn(),
  extractApiError: vi.fn(() => "Request failed"),
}));

describe("AdminOrders", () => {
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

  function mockData() {
    (api.getOrderConfig as any).mockResolvedValue({
      config: { order_age: "60" },
      rows: [{ updatedAt: new Date().toISOString() }],
    });

    (api.getAdminOrders as any).mockResolvedValue([
      {
        id: "ord-1",
        buyerFirstName: "Chris",
        buyerLastName: "User",
        sellerNames: ["Seller A"],
        total: 50,
        status: "confirmed",
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  it("renders loading states initially", () => {
    (api.getOrderConfig as any).mockReturnValue(new Promise(() => {}));
    (api.getAdminOrders as any).mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>
    );

    expect(screen.getByText(/order maintenance/i)).toBeInTheDocument();
  });

  it("loads config and orders", async () => {
    mockData();

    render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(api.getOrderConfig).toHaveBeenCalled();
      expect(api.getAdminOrders).toHaveBeenCalled();
      expect(screen.getAllByText(/orders in the system/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/chris user/i)).toBeInTheDocument();
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
        <AdminOrders />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
    });
  });

  it("shows validation error for invalid return window", async () => {
    mockData();

    render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/order configuration/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "0" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save configuration/i }));

    await waitFor(() => {
      expect(screen.getByText(/return window must be between/i)).toBeInTheDocument();
    });
  });

  it("saves valid order-age config", async () => {
    mockData();
    (api.updateOrderConfig as any).mockResolvedValue({});

    render(
        <MemoryRouter>
        <AdminOrders />
        </MemoryRouter>
    );

    await waitFor(() => {
        expect(screen.getByRole("spinbutton")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole("spinbutton"), {
        target: { value: "90" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save configuration/i }));

    await waitFor(() => {
        expect(api.updateOrderConfig).toHaveBeenCalledWith("order_age", "90");
    });
    });

  it("filters orders by buyer name", async () => {
    mockData();

    render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/chris user/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/first or last name/i), {
      target: { value: "chris" },
    });

    expect(screen.getByText(/chris user/i)).toBeInTheDocument();
  });

  it("filters orders by status", async () => {
    mockData();

    render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/chris user/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue(/all statuses/i), {
      target: { value: "confirmed" },
    });

    expect(screen.getByText(/chris user/i)).toBeInTheDocument();
  });

  it("shows API error when config load fails", async () => {
    (api.getOrderConfig as any).mockRejectedValue(new Error("fail"));
    (api.getAdminOrders as any).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/request failed/i)).toBeInTheDocument();
    });
  });

  it("shows API error when orders load fail", async () => {
    (api.getOrderConfig as any).mockResolvedValue({
      config: { order_age: "60" },
      rows: [],
    });
    (api.getAdminOrders as any).mockRejectedValue(new Error("fail"));

    render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/request failed/i)).toBeInTheDocument();
    });
  });
});