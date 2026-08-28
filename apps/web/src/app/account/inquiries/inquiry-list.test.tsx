import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { InquiryList } from "./inquiry-list";

describe("InquiryList", () => {
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

  it("shows a tenant's sent inquiries", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ role: "TENANT" }))
      .mockResolvedValueOnce(
        response([
          {
            id: "inquiry-1",
            propertyId: "property-1",
            message: "Is this available?",
            moveInDate: null,
            status: "OPEN",
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
          },
        ]),
      );
    render(<InquiryList />);
    expect(
      await screen.findByRole("heading", { name: "Roma room" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Is this available?")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark responded" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Close inquiry" }),
    ).not.toBeInTheDocument();
  });

  it.each(["LANDLORD", "ADMIN"])("shows landlord controls for a %s owner and reconciles the authoritative status", async (role) => {
    const landlordInquiry = {
      id: "inquiry-1",
      propertyId: "property-1",
      message: "Can I view this room?",
      moveInDate: null,
      status: "OPEN",
      createdAt: "2026-08-27T00:00:00.000Z",
      updatedAt: "2026-08-27T00:00:00.000Z",
      property: {
        id: "property-1",
        title: "Maseru room",
        monthlyPrice: "1800",
        roomType: "Single",
        area: "Qoaling",
        city: "Maseru",
        nearestInstitution: "LUCT",
      },
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
      .mockResolvedValueOnce(response([landlordInquiry]))
      .mockResolvedValueOnce(response({ role }))
      .mockResolvedValueOnce(
        response({ ...landlordInquiry, status: "RESPONDED" }),
      );
    render(<InquiryList />);
    expect(await screen.findByText("Lerato Molefe")).toBeInTheDocument();
    expect(screen.getByText("Verified student")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark responded" }));
    expect(
      await screen.findByText("Inquiry marked as responded."),
    ).toBeInTheDocument();
    expect(screen.getByText("RESPONDED")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark responded" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close inquiry" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("/inquiries/inquiry-1/status"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "RESPONDED" }),
      }),
    );
  });
});

function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}
