import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { ResetPasswordForm } from "./reset-password-form";

const getToken = jest.fn();
jest.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: getToken }),
}));

describe("ResetPasswordForm", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    getToken.mockReset();
    getToken.mockReturnValue("raw-reset-token");
    fetchMock.mockReset();
    Object.defineProperty(global, "fetch", {
      value: fetchMock,
      configurable: true,
    });
  });

  it("handles a missing reset token safely", () => {
    getToken.mockReturnValue(null);
    render(<ResetPasswordForm />);

    expect(screen.getByRole("alert")).toHaveTextContent("missing or invalid");
    expect(
      screen.getByRole("link", { name: "Request a new link" }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  it("validates matching passwords before submitting", () => {
    render(<ResetPasswordForm />);
    fillPasswords("SecurePass123!", "DifferentPass123!");
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Passwords do not match",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits the token and offers sign in after success", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: "Password reset successfully." }),
    });
    render(<ResetPasswordForm />);
    fillPasswords("NewSecurePass456!", "NewSecurePass456!");
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "password has been reset",
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      token: "raw-reset-token",
      newPassword: "NewSecurePass456!",
    });
  });

  it("shows a safe message when the API rejects the token", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: "internal detail" }),
    });
    render(<ResetPasswordForm />);
    fillPasswords("NewSecurePass456!", "NewSecurePass456!");
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "invalid or has expired",
    );
    expect(screen.queryByText("internal detail")).not.toBeInTheDocument();
  });
});

function fillPasswords(password: string, confirmation: string) {
  fireEvent.change(screen.getByLabelText(/^New password/), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText("Confirm new password"), {
    target: { value: confirmation },
  });
}
