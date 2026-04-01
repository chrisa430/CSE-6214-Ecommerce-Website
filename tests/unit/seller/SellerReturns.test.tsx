import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SellerReturns from "../../../apps/web/src/pages/seller/SellerReturns";
import * as api from "../../../apps/web/src/services/api";

vi.mock("../../../apps/web/src/services/api", () => ({
  getSellerReturns: vi.fn(),
  actionReturn: vi.fn(),
  extractApiError: vi.fn(() => "Request failed"),
}));

describe("SellerReturns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockReturnRows() {
    (api.getSellerReturns as any).mockResolvedValue([
      {
        orderId: "order-1",
        total: 125,
        orderCreatedAt: new Date().toISOString(),
        orderStatus: "delivered",
        itemId: "item-1",
        productName: "Signed Jersey",
        productId: "prod-1",
        quantity: 1,
        unitPrice: 125,
        imageUrl: "/images/jersey.png",
        returnId: "ret-1",
        returnStatus: "pending",
        returnReason: "Damaged item",
        returnCreatedAt: new Date().toISOString(),
      },
    ]);
  }

  it("renders loading state initially", () => {
    (api.getSellerReturns as any).mockReturnValue(new Promise(() => {}));

    render(<SellerReturns />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders grouped return orders", async () => {
    mockReturnRows();

    render(<SellerReturns />);

    await waitFor(() => {
      expect(screen.getByText(/returns/i)).toBeInTheDocument();
      expect(screen.getByText(/with return requests/i)).toBeInTheDocument();
    });
  });

  it("shows empty state when no orders are returned", async () => {
    (api.getSellerReturns as any).mockResolvedValue([]);

    render(<SellerReturns />);

    await waitFor(() => {
      expect(
        screen.getByText(/no orders containing your items yet/i)
      ).toBeInTheDocument();
    });
  });

  it("shows load error when fetch fails", async () => {
    (api.getSellerReturns as any).mockRejectedValue(new Error("load failed"));

    render(<SellerReturns />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load orders/i)).toBeInTheDocument();
    });
  });

  it("expands an order row to show return request details", async () => {
    mockReturnRows();

    render(<SellerReturns />);

    await waitFor(() => {
      expect(screen.getByText(/returns/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/ORDER-1/i));

    await waitFor(() => {
      expect(screen.getByText("Signed Jersey")).toBeInTheDocument();
      expect(screen.getByText(/damaged item/i)).toBeInTheDocument();
      expect(screen.getByRole("checkbox")).toBeInTheDocument();
    });
  });

  it("disables bulk action buttons when nothing is selected", async () => {
    mockReturnRows();

    render(<SellerReturns />);

    await waitFor(() => {
      expect(screen.getByText(/returns/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /approve/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /decline/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /dispute/i })).toBeDisabled();
  });

  it("selects all pending returns", async () => {
    mockReturnRows();

    render(<SellerReturns />);

    await waitFor(() => {
      expect(screen.getByText(/returns/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/ORDER-1/i));
    fireEvent.click(screen.getByRole("button", { name: /select all pending/i }));

    await waitFor(() => {
      expect(screen.getByRole("checkbox")).toBeChecked();
    });
  });

  it("approves selected return requests", async () => {
    mockReturnRows();
    (api.actionReturn as any).mockResolvedValue({ updated: 1 });

    render(<SellerReturns />);

    await waitFor(() => {
        expect(screen.getByText(/returns/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/ORDER-1/i));
    fireEvent.click(screen.getByRole("button", { name: /select all pending/i }));
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() => {
        expect(api.actionReturn).toHaveBeenCalledWith(
        ["ret-1"],
        "approved",
        undefined
        );
    });

    await waitFor(() => {
        expect(api.getSellerReturns).toHaveBeenCalledTimes(2);
    });
    });

  it("passes optional note when approving returns", async () => {
    mockReturnRows();
    (api.actionReturn as any).mockResolvedValue({ updated: 1 });

    render(<SellerReturns />);

    await waitFor(() => {
      expect(screen.getByText(/returns/i)).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByPlaceholderText(/provide a reason or explanation/i),
      { target: { value: "Approved after review" } }
    );

    fireEvent.click(screen.getByText(/ORDER-1/i));
    fireEvent.click(screen.getByRole("button", { name: /select all pending/i }));
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() => {
      expect(api.actionReturn).toHaveBeenCalledWith(
        ["ret-1"],
        "approved",
        "Approved after review"
      );
    });
  });

  it("shows API error when return action fails", async () => {
    mockReturnRows();
    (api.actionReturn as any).mockRejectedValue(new Error("action failed"));

    render(<SellerReturns />);

    await waitFor(() => {
      expect(screen.getByText(/returns/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/ORDER-1/i));
    fireEvent.click(screen.getByRole("button", { name: /select all pending/i }));
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() => {
      expect(screen.getByText(/request failed/i)).toBeInTheDocument();
    });
  });

  it("refresh button reloads data", async () => {
    mockReturnRows();

    render(<SellerReturns />);

    await waitFor(() => {
      expect(api.getSellerReturns).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => {
      expect(api.getSellerReturns).toHaveBeenCalledTimes(2);
    });
  });
});