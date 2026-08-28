import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { RequestList } from "./request-list";

describe("RequestList", () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;
  beforeEach(() => {
    fetchMock.mockReset();
    Object.defineProperty(global, "fetch", {
      configurable: true,
      writable: true,
      value: fetchMock,
    });
  });
  afterAll(() => {
    Object.defineProperty(global, "fetch", {
      configurable: true,
      writable: true,
      value: originalFetch,
    });
  });

  it("lets a tenant cancel a PENDING owned request", async () => {
    const pending = fixture("PENDING");
    fetchMock
      .mockResolvedValueOnce(response({ role: "TENANT" }))
      .mockResolvedValueOnce(response([pending]))
      .mockResolvedValueOnce(response({ ...pending, status: "CANCELLED" }));
    render(<RequestList />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Cancel request" }),
    );
    expect(await screen.findByText("Request cancelled.")).toBeInTheDocument();
    expect(screen.getByText("CANCELLED")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel request" }),
    ).not.toBeInTheDocument();
  });

  it.each(["LANDLORD", "ADMIN"])("lets a %s property owner accept a PENDING request with safe tenant context", async (role) => {
    const pending = {
      ...fixture("PENDING"),
      tenant: {
        firstName: "Lerato",
        lastName: "Molefe",
        phone: "50000000",
        contactMethod: "WhatsApp",
        institution: "LUCT",
        verified: true,
      },
    };
    fetchMock
      .mockResolvedValueOnce(response({ role }))
      .mockResolvedValueOnce(response([pending]))
      .mockResolvedValueOnce(response({ role }))
      .mockResolvedValueOnce(response({ ...pending, status: "ACCEPTED" }));
    render(<RequestList />);
    expect(await screen.findByText("Verified student")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(await screen.findByText("Request accepted.")).toBeInTheDocument();
    expect(screen.getByText("ACCEPTED")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Decline" }),
    ).not.toBeInTheDocument();
  });
});

function fixture(status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED") {
  return {
    id: "request-1",
    propertyId: "property-1",
    preferredMoveInDate: "2026-10-01T00:00:00.000Z",
    note: "Near campus",
    status,
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
    property: {
      id: "property-1",
      title: "Roma room",
      monthlyPrice: "2000",
      roomType: "Single",
      area: "Roma",
      city: "Maseru",
      nearestInstitution: "NUL",
    },
  };
}

function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}
