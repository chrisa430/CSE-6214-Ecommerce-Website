import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BuyerCart from "../../../apps/web/src/pages/buyer/BuyerCart";
import * as api from "../../../apps/web/src/services/api";

vi.mock("../../../apps/web/src/services/api", () => ({
  getCart: vi.fn(),
  removeFromCart: vi.fn(),
  getActiveProducts: vi.fn(),
}));

describe("BuyerCart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and displays cart items", async () => {
    (api.getCart as any).mockResolvedValue([
      { productId: "1", quantity: 2, unitPrice: 20 },
    ]);

    (api.getActiveProducts as any).mockResolvedValue([
      {
        id: "1",
        name: "Signed Baseball",
        shortDesc: "Baseball item",
        longDesc: "desc",
        quantity: 5,
        unitPrice: 20,
        status: "active",
        imageUrl: "/images/baseball.png",
      },
    ]);

    render(
      <MemoryRouter>
        <BuyerCart />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Signed Baseball")).toBeInTheDocument();
      expect(screen.getAllByText("$40.00").length).toBeGreaterThan(0);
    });
  });

  it("removes an item from the cart", async () => {
    (api.getCart as any).mockResolvedValue([
      { productId: "1", quantity: 1, unitPrice: 20 },
    ]);

    (api.getActiveProducts as any).mockResolvedValue([
      {
        id: "1",
        name: "Signed Baseball",
        shortDesc: "Baseball item",
        longDesc: "desc",
        quantity: 5,
        unitPrice: 20,
        status: "active",
        imageUrl: "/images/baseball.png",
      },
    ]);

    (api.removeFromCart as any).mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <BuyerCart />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Signed Baseball")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /remove/i }));

    await waitFor(() => {
      expect(api.removeFromCart).toHaveBeenCalledWith("1");
    });
  });

  it("shows empty cart message", async () => {
    (api.getCart as any).mockResolvedValue([]);
    (api.getActiveProducts as any).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <BuyerCart />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
    });
  });
});