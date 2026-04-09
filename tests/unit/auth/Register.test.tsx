import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Register from "../../../apps/web/src/pages/Register";
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
  registerUser: vi.fn(),
  extractApiError: vi.fn(() => "Registration failed"),
}));

describe("Register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function fillValidForm() {
    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: "newuser@test.com" },
    });

    fireEvent.change(screen.getByPlaceholderText(/^jane$/i), {
      target: { value: "Jane" },
    });

    fireEvent.change(screen.getByPlaceholderText(/^doe$/i), {
      target: { value: "Doe" },
    });

    fireEvent.click(screen.getByRole("button", { name: /buyer/i }));

    const passwordInputs = screen.getAllByPlaceholderText(/••••••••••••/i);

    fireEvent.change(passwordInputs[0], {
      target: { value: "Different1!" },
    });

    fireEvent.change(passwordInputs[1], {
      target: { value: "Different1!" },
    });
  }

  it("submits registration successfully and redirects to login", async () => {
    (api.registerUser as any).mockResolvedValue({});

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(api.registerUser).toHaveBeenCalledWith({
        userId: "newuser@test.com",
        password: "Different1!",
        firstName: "Jane",
        lastName: "Doe",
        accountType: "buyer",
      });
    });

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith("/login");
      },
      { timeout: 4000 }
    );
  });

  it("shows validation error for invalid email", async () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: "bad-email" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/enter a valid email address/i)
    ).toBeInTheDocument();

    expect(api.registerUser).not.toHaveBeenCalled();
  });

  it("shows validation error for invalid password", async () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    fillValidForm();

    const passwordInputs = screen.getAllByPlaceholderText(/••••••••••••/i);

    fireEvent.change(passwordInputs[0], {
      target: { value: "weak" },
    });

    fireEvent.change(passwordInputs[1], {
      target: { value: "weak" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/password must be/i)
    ).toBeInTheDocument();

    expect(api.registerUser).not.toHaveBeenCalled();
  });

  it("shows validation error when required fields are missing", async () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/please select an account type/i)).toBeInTheDocument();

    expect(api.registerUser).not.toHaveBeenCalled();
  });

  it("shows validation error when passwords do not match", async () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    fillValidForm();

    const passwordInputs = screen.getAllByPlaceholderText(/••••••••••••/i);

    fireEvent.change(passwordInputs[1], {
      target: { value: "Different$123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/passwords do not match/i)
    ).toBeInTheDocument();

    expect(api.registerUser).not.toHaveBeenCalled();
  });

  it("shows API error when registration fails", async () => {
    (api.registerUser as any).mockRejectedValue(new Error("fail"));

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/registration failed/i)).toBeInTheDocument();
    });
  });
});