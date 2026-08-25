import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RegisterForm } from "./register-form";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("RegisterForm", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    push.mockReset();
    fetchMock.mockReset();
    Object.defineProperty(global, "fetch", {
      value: fetchMock,
      configurable: true,
    });
  });

  it("submits a credentialed tenant registration and redirects to login", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: "1", role: "TENANT" }),
    });
    render(<RegisterForm />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/login?registered=1"),
    );
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:4000/auth/register");
    expect(options.credentials).toBe("include");
    expect(JSON.parse(options.body)).toMatchObject({
      role: "TENANT",
      email: "student@example.com",
    });
  });

  it("allows landlord selection and shows API errors", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        message: "An account with this email already exists",
      }),
    });
    render(<RegisterForm />);
    fillForm();
    fireEvent.click(screen.getByLabelText(/Landlord/));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "already exists",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      role: "LANDLORD",
    });
  });
});

function fillForm() {
  fireEvent.change(screen.getByLabelText("First name"), {
    target: { value: "Hira" },
  });
  fireEvent.change(screen.getByLabelText("Last name"), {
    target: { value: "Student" },
  });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "student@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/^Password/), {
    target: { value: "SecurePass123!" },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "SecurePass123!" },
  });
}
