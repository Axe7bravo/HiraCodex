import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ForgotPasswordForm } from "./forgot-password-form";

describe("ForgotPasswordForm", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    Object.defineProperty(global, "fetch", {
      value: fetchMock,
      configurable: true,
    });
  });

  it("submits the email and displays the generic confirmation", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ message: "safe response" }),
    });
    render(<ForgotPasswordForm />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: " student@example.com " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Send reset instructions" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "If an account exists for that email",
    );
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:4000/auth/forgot-password");
    expect(JSON.parse(options.body)).toEqual({ email: "student@example.com" });
  });

  it("shows a request failure and restores the form", async () => {
    fetchMock.mockRejectedValue(new Error("Network unavailable"));
    render(<ForgotPasswordForm />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "student@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Send reset instructions" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Network unavailable",
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Send reset instructions" }),
      ).toBeEnabled(),
    );
  });
});
