import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BuyerOrders from "../../../apps/web/src/pages/buyer/BuyerOrders";
import * as api from "../../../apps/web/src/services/api";

vi.mock("../../../apps/web/src/services/api", () => ({
  getMyOrders: vi.fn(),
  getOrderConfig: vi.fn(),
}));

describe("BuyerOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders order history with order totals", async () => {
    (api.getMyOrders as any).mockResolvedValue([
      {
        id: "order-1",
        subtotal: 20,
        tax: 1.4,
        total: 21.4,
        createdAt: new Date().toISOString(),
        status: "delivered",
        items: [
          {
            productId: "prod-1",
            quantity: 1,
            unitPrice: 20,
            name: "Signed Baseball",
            imageUrl: "/images/baseball.png",
          },
        ],
      },
    ]);

    (api.getOrderConfig as any).mockResolvedValue({
      config: { order_age: "60" },
    });

    render(
      <MemoryRouter>
        <BuyerOrders />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/order history/i)).toBeInTheDocument();
      expect(screen.getByText("Signed Baseball")).toBeInTheDocument();
      expect(screen.getByText("$21.40")).toBeInTheDocument();
    });
  });

  it("shows empty state when there are no orders", async () => {
    (api.getMyOrders as any).mockResolvedValue([]);
    (api.getOrderConfig as any).mockResolvedValue({
      config: { order_age: "60" },
    });

    render(
      <MemoryRouter>
        <BuyerOrders />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/no orders yet/i)).toBeInTheDocument();
    });
  });

  it("shows error when order load fails", async () => {
    (api.getMyOrders as any).mockRejectedValue(new Error("load failed"));
    (api.getOrderConfig as any).mockResolvedValue({
      config: { order_age: "60" },
    });

    render(
      <MemoryRouter>
        <BuyerOrders />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/failed to load orders/i)).toBeInTheDocument();
    });
  });
});