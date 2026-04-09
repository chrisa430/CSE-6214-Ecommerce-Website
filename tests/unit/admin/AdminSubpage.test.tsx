import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminSubpage from "../../../apps/web/src/pages/admin/AdminSubpage";
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
  searchAccounts: vi.fn(),
  fetchOpenAccounts: vi.fn(),
  submitAccountDecision: vi.fn(),
  extractApiError: vi.fn(() => "Request failed"),
}));

describe("AdminSubpage", () => {
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

  function mockAdminData() {
    (api.searchAccounts as any).mockResolvedValue([
      {
        id: "u1",
        userId: "seller@test.com",
        firstName: "Sam",
        lastName: "Seller",
        type: "seller",
        status: "active",
        activatedDate: "2026-03-01",
        suspendedDate: null,
        closedDate: null,
        createdAt: "2026-02-28",
      },
    ]);

    (api.fetchOpenAccounts as any).mockResolvedValue([
      {
        id: "u2",
        email: "pending@test.com",
        firstName: "Pending",
        lastName: "User",
        type: "seller",
        status: "open",
        createdAt: "2026-03-15",
      },
    ]);
  }

  it("renders admin tools page", async () => {
    mockAdminData();

    render(
      <MemoryRouter>
        <AdminSubpage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/admin tools/i)).toBeInTheDocument();
      expect(screen.getByText(/user management/i)).toBeInTheDocument();
      expect(screen.getByText(/account approvals/i)).toBeInTheDocument();
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
        <AdminSubpage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
    });
  });

  it("loads account management results", async () => {
    mockAdminData();

    render(
      <MemoryRouter>
        <AdminSubpage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(api.searchAccounts).toHaveBeenCalled();
      expect(screen.getByText(/seller@test.com/i)).toBeInTheDocument();
    });
  });

  it("filters accounts by type", async () => {
    mockAdminData();

    render(
      <MemoryRouter>
        <AdminSubpage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(api.searchAccounts).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByDisplayValue(/all types/i), {
      target: { value: "seller" },
    });

    await waitFor(() => {
      expect(api.searchAccounts).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "seller" })
      );
    });
  });

  it("loads open accounts for approvals", async () => {
    mockAdminData();

    render(
      <MemoryRouter>
        <AdminSubpage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(api.fetchOpenAccounts).toHaveBeenCalled();
      expect(screen.getByText(/pending@test.com/i)).toBeInTheDocument();
    });
  });

  it("approves selected open accounts", async () => {
    mockAdminData();
    (api.submitAccountDecision as any).mockResolvedValue({
      message: "Approved 1 account",
      count: 1,
    });

    render(
      <MemoryRouter>
        <AdminSubpage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/pending@test.com/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    fireEvent.click(screen.getByRole("button", { name: /approve selected/i }));

    await waitFor(() => {
      expect(api.submitAccountDecision).toHaveBeenCalledWith(["u2"], "approve");
    });
  });

  it("shows API error when account search fails", async () => {
    (api.searchAccounts as any).mockRejectedValue(new Error("fail"));
    (api.fetchOpenAccounts as any).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <AdminSubpage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/request failed/i).length).toBeGreaterThan(0);
    });
  });
});