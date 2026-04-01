import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import InventoryManagement from "../../../apps/web/src/pages/seller/InventoryManagement";
import * as api from "../../../apps/web/src/services/api";

vi.mock("../../../apps/web/src/services/api", () => ({
  getMyProducts: vi.fn(),
  getCategories: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  updateProductImage: vi.fn(),
}));

describe("InventoryManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockInitialData() {
    (api.getMyProducts as any).mockResolvedValue([
      {
        id: "p1",
        name: "Signed Jersey",
        quantity: 3,
        unitPrice: 120,
        status: "pending",
        imageUrl: "/images/jersey.png",
      },
    ]);

    (api.getCategories as any).mockResolvedValue([
      { id: "cat-1", name: "Jerseys" },
      { id: "cat-2", name: "Balls" },
    ]);
  }

  it("loads and displays inventory data", async () => {
    mockInitialData();

    render(<InventoryManagement />);

    expect(screen.getByText(/loading inventory/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/inventory management/i)).toBeInTheDocument();
      expect(screen.getByText("Signed Jersey")).toBeInTheDocument();
      expect(screen.getByText(/status: pending/i)).toBeInTheDocument();
    });
  });

  it("shows session expired message on 401 load failure", async () => {
    (api.getMyProducts as any).mockRejectedValue({
      response: { status: 401 },
    });
    (api.getCategories as any).mockResolvedValue([]);

    render(<InventoryManagement />);

    await waitFor(() => {
      expect(
        screen.getByText(/your session expired/i)
      ).toBeInTheDocument();
    });
  });

  it("shows generic load error on non-401 failure", async () => {
    (api.getMyProducts as any).mockRejectedValue(new Error("load failed"));
    (api.getCategories as any).mockResolvedValue([]);

    render(<InventoryManagement />);

    await waitFor(() => {
      expect(
        screen.getByText(/failed to load inventory data/i)
      ).toBeInTheDocument();
    });
  });

  it("adds a new item", async () => {
    mockInitialData();

    (api.createProduct as any).mockResolvedValue({
      id: "p2",
      name: "Signed Baseball",
      quantity: 2,
      unitPrice: 45,
      status: "pending",
    });

    render(<InventoryManagement />);

    await waitFor(() => {
      expect(screen.getByText("Signed Jersey")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/item name/i), {
      target: { value: "Signed Baseball" },
    });

    fireEvent.change(screen.getByPlaceholderText(/^quantity$/i), {
      target: { value: "2" },
    });

    fireEvent.change(screen.getByPlaceholderText(/^price$/i), {
      target: { value: "45" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add item/i }));

    await waitFor(() => {
      expect(api.createProduct).toHaveBeenCalledWith({
        name: "Signed Baseball",
        category: "cat-1",
        quantity: 2,
        unitPrice: 45,
      });
    });

    expect(screen.getByText("Signed Baseball")).toBeInTheDocument();
  });

  it("adds a new item and uploads image when image url is provided", async () => {
    mockInitialData();

    (api.createProduct as any).mockResolvedValue({
      id: "p2",
      name: "Signed Baseball",
      quantity: 1,
      unitPrice: 50,
      status: "pending",
    });

    (api.updateProductImage as any).mockResolvedValue({});

    render(<InventoryManagement />);

    await waitFor(() => {
      expect(screen.getByText("Signed Jersey")).toBeInTheDocument();
    });

    const imageInputs = screen.getAllByPlaceholderText(/image url/i);
    fireEvent.change(imageInputs[imageInputs.length - 1], {
      target: { value: "/images/baseball.png" },
    });

    fireEvent.change(screen.getByPlaceholderText(/item name/i), {
      target: { value: "Signed Baseball" },
    });

    fireEvent.change(screen.getByPlaceholderText(/^quantity$/i), {
      target: { value: "1" },
    });

    fireEvent.change(screen.getByPlaceholderText(/^price$/i), {
      target: { value: "50" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add item/i }));

    await waitFor(() => {
      expect(api.updateProductImage).toHaveBeenCalledWith(
        "p2",
        "/images/baseball.png"
      );
    });
  });

  it("updates an existing item", async () => {
    mockInitialData();

    (api.updateProduct as any).mockResolvedValue({
      id: "p1",
      name: "Updated Jersey",
      quantity: 5,
      unitPrice: 150,
      status: "pending",
    });

    render(<InventoryManagement />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Signed Jersey")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue("Signed Jersey"), {
      target: { value: "Updated Jersey" },
    });

    fireEvent.change(screen.getByDisplayValue("3"), {
      target: { value: "5" },
    });

    fireEvent.change(screen.getByDisplayValue("120"), {
      target: { value: "150" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^update$/i }));

    await waitFor(() => {
      expect(api.updateProduct).toHaveBeenCalledWith("p1", {
        name: "Updated Jersey",
        quantity: 5,
        unitPrice: 150,
      });
    });
  });

  it("removes an item", async () => {
    mockInitialData();

    (api.deleteProduct as any).mockResolvedValue(undefined);

    render(<InventoryManagement />);

    await waitFor(() => {
      expect(screen.getByText("Signed Jersey")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /remove/i }));

    await waitFor(() => {
      expect(api.deleteProduct).toHaveBeenCalledWith("p1");
    });

    expect(screen.queryByText("Signed Jersey")).not.toBeInTheDocument();
  });

  it("saves an updated image url", async () => {
    mockInitialData();

    (api.updateProductImage as any).mockResolvedValue({});

    render(<InventoryManagement />);

    await waitFor(() => {
      expect(screen.getByText("Signed Jersey")).toBeInTheDocument();
    });

    const imageInputs = screen.getAllByPlaceholderText(/image url/i);
    fireEvent.change(imageInputs[0], {
      target: { value: "/images/new-jersey.png" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save image/i }));

    await waitFor(() => {
      expect(api.updateProductImage).toHaveBeenCalledWith(
        "p1",
        "/images/new-jersey.png"
      );
    });
  });

  it("shows create error when add item fails", async () => {
    mockInitialData();

    (api.createProduct as any).mockRejectedValue(new Error("create failed"));

    render(<InventoryManagement />);

    await waitFor(() => {
      expect(screen.getByText("Signed Jersey")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/item name/i), {
      target: { value: "Signed Baseball" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add item/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to create product/i)).toBeInTheDocument();
    });
  });
});