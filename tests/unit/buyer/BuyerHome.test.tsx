import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import BuyerHome from "../../../apps/web/src/pages/buyer/BuyerHome";
import * as api from "../../../apps/web/src/services/api";

vi.mock("../../../apps/web/src/services/api", () => ({
  getActiveProducts: vi.fn(),
  addToCart: vi.fn(),
}));

describe("BuyerHome", () => {
  const mockProducts = [
    {
      id: "1",
      name: "Signed Baseball",
      shortDesc: "Baseball item",
      longDesc: "Signed baseball collectible",
      quantity: 3,
      unitPrice: 25,
      status: "active",
      imageUrl: "/images/baseball.png",
    },
    {
      id: "2",
      name: "Football Helmet",
      shortDesc: "Helmet item",
      longDesc: "Signed football helmet",
      quantity: 0,
      unitPrice: 40,
      status: "active",
      imageUrl: "/images/helmet.png",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  it("loads and displays active products", async () => {
    (api.getActiveProducts as any).mockResolvedValue(mockProducts);

    render(<BuyerHome />);

    expect(screen.getByText(/loading products/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Signed Baseball")).toBeInTheDocument();
      expect(screen.getByText("Football Helmet")).toBeInTheDocument();
    });
  });

  it("filters products by search text", async () => {
    (api.getActiveProducts as any).mockResolvedValue(mockProducts);

    render(<BuyerHome />);

    await waitFor(() => {
      expect(screen.getByText("Signed Baseball")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/search products/i), {
      target: { value: "baseball" },
    });

    expect(screen.getByText("Signed Baseball")).toBeInTheDocument();
    expect(screen.queryByText("Football Helmet")).not.toBeInTheDocument();
  });

  it("adds an in-stock product to cart", async () => {
    (api.getActiveProducts as any).mockResolvedValue(mockProducts);
    (api.addToCart as any).mockResolvedValue({
      productId: "1",
      quantity: 1,
      unitPrice: 25,
    });

    render(<BuyerHome />);

    await waitFor(() => {
      expect(screen.getByText("Signed Baseball")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /add to cart/i })[0]);

    await waitFor(() => {
      expect(api.addToCart).toHaveBeenCalledWith(mockProducts[0]);
      expect(window.alert).toHaveBeenCalledWith("Signed Baseball added to cart");
    });
  });

  it("shows out of stock button for unavailable products", async () => {
    (api.getActiveProducts as any).mockResolvedValue(mockProducts);

    render(<BuyerHome />);

    await waitFor(() => {
      expect(screen.getByText("Football Helmet")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /out of stock/i })).toBeDisabled();
  });

  it("shows error message when product load fails", async () => {
    (api.getActiveProducts as any).mockRejectedValue(new Error("load failed"));

    render(<BuyerHome />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load products/i)).toBeInTheDocument();
    });
  });
});