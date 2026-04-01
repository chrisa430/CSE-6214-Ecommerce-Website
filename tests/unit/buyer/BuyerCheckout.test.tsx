import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BuyerCheckout from "../../../apps/web/src/pages/buyer/BuyerCheckout";
import * as api from "../../../apps/web/src/services/api";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../../apps/web/src/services/api", () => ({
  getCart: vi.fn(),
  checkout: vi.fn(),
}));

describe("BuyerCheckout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  it("renders checkout totals correctly", async () => {
    (api.getCart as any).mockResolvedValue([
      { productId: "1", quantity: 2, unitPrice: 20, name: "Signed Baseball" },
    ]);

    render(
      <MemoryRouter>
        <BuyerCheckout />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/^checkout$/i)).toBeInTheDocument();
      expect(screen.getAllByText("$40.00")).toHaveLength(2);
      expect(screen.getByText("$42.80")).toBeInTheDocument();
    });
  });

  it("submits simulated checkout successfully", async () => {
    (api.getCart as any).mockResolvedValue([
      { productId: "1", quantity: 1, unitPrice: 20, name: "Signed Baseball" },
    ]);

    (api.checkout as any).mockResolvedValue({
      message: "Checkout completed",
      order: {
        id: "ord-1",
        buyerId: "buyer-1",
        subtotal: 20,
        tax: 1.4,
        total: 21.4,
        createdAt: new Date().toISOString(),
      },
      items: [{ productId: "1", quantity: 1, unitPrice: 20 }],
    });

    render(
      <MemoryRouter>
        <BuyerCheckout />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/^checkout$/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/full name/i), {
      target: { value: "Chris User" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^address$/i), {
      target: { value: "123 Main St" },
    });
    fireEvent.change(screen.getByPlaceholderText(/city/i), {
      target: { value: "Atlanta" },
    });
    fireEvent.change(screen.getByPlaceholderText(/state/i), {
      target: { value: "GA" },
    });
    fireEvent.change(screen.getByPlaceholderText(/zip code/i), {
      target: { value: "30303" },
    });
    fireEvent.change(screen.getByPlaceholderText(/card number/i), {
      target: { value: "4111111111111111" },
    });
    fireEvent.change(screen.getByPlaceholderText(/mm\/yy/i), {
      target: { value: "12/30" },
    });
    fireEvent.change(screen.getByPlaceholderText(/cvv/i), {
      target: { value: "123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() => {
      expect(api.checkout).toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalled();
    });

    // Only keep this assertion if your component really navigates after checkout:
    expect(mockNavigate).toHaveBeenCalledWith("/buyer/orders");
  });

  it("shows error when checkout fails", async () => {
    (api.getCart as any).mockResolvedValue([
      { productId: "1", quantity: 1, unitPrice: 20, name: "Signed Baseball" },
    ]);

    (api.checkout as any).mockRejectedValue(new Error("Checkout failed"));

    render(
      <MemoryRouter>
        <BuyerCheckout />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/^checkout$/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() => {
      expect(screen.getByText(/checkout failed/i)).toBeInTheDocument();
    });
  });
});