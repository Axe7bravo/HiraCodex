import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AccountClient } from "./account-client";

const replace = jest.fn();
const refresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

describe("AccountClient", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    replace.mockReset();
    refresh.mockReset();
    Object.defineProperty(global, "fetch", {
      value: fetchMock,
      configurable: true,
    });
  });

  it("loads and saves a tenant profile with tenant-only fields", async () => {
    fetchMock
      .mockResolvedValueOnce(response(tenantProfile))
      .mockResolvedValueOnce(
        response({
          ...tenantProfile,
          firstName: "Mpho",
          tenantProfile: {
            institution: "National University of Lesotho",
            expectedMoveIn: "2026-09-15T00:00:00.000Z",
          },
        }),
      );
    render(<AccountClient />);

    expect(
      await screen.findByDisplayValue("student@example.com"),
    ).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Institution")).toBeInTheDocument();
    expect(screen.queryByLabelText("Organisation")).not.toBeInTheDocument();
    expect(screen.getByText("Not submitted")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Mpho" },
    });
    fireEvent.change(screen.getByLabelText("Institution"), {
      target: { value: "National University of Lesotho" },
    });
    fireEvent.change(screen.getByLabelText("Expected move-in date"), {
      target: { value: "2026-09-15" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Profile saved successfully",
    );
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe("http://localhost:4000/users/me");
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body)).toMatchObject({
      firstName: "Mpho",
      institution: "National University of Lesotho",
      expectedMoveIn: "2026-09-15",
    });
    expect(JSON.parse(options.body)).not.toHaveProperty("role");
    expect(JSON.parse(options.body)).not.toHaveProperty("verificationStatus");
  });

  it("shows and saves landlord-only profile fields", async () => {
    fetchMock
      .mockResolvedValueOnce(response(landlordProfile))
      .mockResolvedValueOnce(
        response({
          ...landlordProfile,
          landlordProfile: { organisation: "Hira Homes", propertyCount: 5 },
        }),
      );
    render(<AccountClient />);

    expect(await screen.findByLabelText("Organisation")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Declared property count/)).toHaveValue(2);
    expect(screen.queryByLabelText("Institution")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Organisation"), {
      target: { value: "Hira Homes" },
    });
    fireEvent.change(screen.getByLabelText(/^Declared property count/), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      organisation: "Hira Homes",
      propertyCount: 5,
    });
  });

  it("shows loading and API failure states", async () => {
    fetchMock.mockRejectedValue(new Error("Session unavailable"));
    render(<AccountClient />);

    expect(screen.getByText("Loading your profile…")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Session unavailable",
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});

const common = {
  id: "user-id",
  firstName: "Hira",
  lastName: "Tester",
  phone: null,
  contactMethod: null,
  status: "ACTIVE",
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:00:00.000Z",
};

const tenantProfile = {
  ...common,
  email: "student@example.com",
  role: "TENANT",
  verificationStatus: "NOT_SUBMITTED",
  tenantProfile: { institution: null, expectedMoveIn: null },
};

const landlordProfile = {
  ...common,
  email: "landlord@example.com",
  role: "LANDLORD",
  verificationStatus: "PENDING",
  landlordProfile: { organisation: "Existing Homes", propertyCount: 2 },
};

function response(body: object) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  };
}
