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

describe("BuyerCart remove flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes the only cart item and shows empty cart message", async () => {
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
      expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
    });
  });
});