import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SellerHome from "../../../apps/web/src/pages/seller/SellerHome";

vi.mock("../../../apps/web/src/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "s1",
      email: "seller@test.com",
      firstName: "Sam",
      lastName: "Seller",
      type: "seller",
    },
  }),
}));

describe("SellerHome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders seller welcome text", () => {
    render(
      <MemoryRouter>
        <SellerHome />
      </MemoryRouter>
    );

    expect(screen.getByText(/welcome, sam/i)).toBeInTheDocument();
    expect(screen.getByText(/seller dashboard/i)).toBeInTheDocument();
  });

  it("renders inventory link", () => {
    render(
      <MemoryRouter>
        <SellerHome />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("link", { name: /open inventory/i })
    ).toBeInTheDocument();
  });

  it("shows approval workflow info", () => {
    render(
      <MemoryRouter>
        <SellerHome />
      </MemoryRouter>
    );

    expect(screen.getByText(/approval workflow/i)).toBeInTheDocument();
    expect(screen.getByText(/pending status/i)).toBeInTheDocument();
  });
});