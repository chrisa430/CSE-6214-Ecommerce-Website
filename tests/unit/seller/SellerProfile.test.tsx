import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SellerProfile from "../../../apps/web/src/pages/seller/SellerProfile";

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

describe("SellerProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders seller profile fields", () => {
    render(<SellerProfile />);

    expect(screen.getByText(/account profile/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("seller@test.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Sam")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Seller")).toBeInTheDocument();
  });

  it("keeps email field disabled", () => {
    render(<SellerProfile />);

    expect(screen.getByDisplayValue("seller@test.com")).toBeDisabled();
  });

  it("allows editing first and last name inputs", () => {
    render(<SellerProfile />);

    const firstNameInput = screen.getByDisplayValue("Sam");
    const lastNameInput = screen.getByDisplayValue("Seller");

    fireEvent.change(firstNameInput, { target: { value: "Samuel" } });
    fireEvent.change(lastNameInput, { target: { value: "Smith" } });

    expect(screen.getByDisplayValue("Samuel")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Smith")).toBeInTheDocument();
  });

  it("renders save changes button", () => {
    render(<SellerProfile />);

    expect(
      screen.getByRole("button", { name: /save changes/i })
    ).toBeInTheDocument();
  });
});