import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { RequestList } from "./request-list";

const replace = jest.fn();
const refresh = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => "/account/requests",
  useRouter: () => ({ replace, refresh }),
}));

describe("RequestList", () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;
  beforeEach(() => {
    fetchMock.mockReset();
    replace.mockReset();
    refresh.mockReset();
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
      .mockResolvedValueOnce(response({ role: "TENANT" }))
      .mockResolvedValueOnce(response({ ...pending, status: "CANCELLED" }));
    render(<RequestList />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Cancel request" }),
    );
    expect(await screen.findByText("Request cancelled.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "History 1" }));
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
    expect(screen.getByText("Needs response")).toBeInTheDocument();
    expect(screen.getByText("PENDING")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(await screen.findByText("Request accepted.")).toBeInTheDocument();
    expect(screen.getByText("ACCEPTED")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Decline request" }),
    ).not.toBeInTheDocument();
  });

  it.each(["LANDLORD", "ADMIN"])("requires and submits a visible decline reason for a %s owner", async (role) => {
    const pending = { ...fixture("PENDING"), tenant: { firstName: "Lerato", lastName: "Molefe", phone: null, contactMethod: null, institution: "NUL", verified: true } };
    const declined = { ...pending, status: "DECLINED", declineReason: "The room is unavailable for that date." };
    fetchMock
      .mockResolvedValueOnce(response({ role }))
      .mockResolvedValueOnce(response([pending]))
      .mockResolvedValueOnce(response({ role }))
      .mockResolvedValueOnce(response(declined));
    render(<RequestList />);
    fireEvent.click(await screen.findByRole("button", { name: "Decline request" }));
    const confirm = screen.getAllByRole("button", { name: "Decline request" })[1];
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Reason for declining"), { target: { value: "  The room is unavailable for that date.  " } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(await screen.findByText("Request declined.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "History 1" }));
    expect(screen.getByText("Reason from landlord")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("/requests/request-1/decline"),
      expect.objectContaining({ body: JSON.stringify({ reason: "The room is unavailable for that date." }) }),
    );
  });

  it("shows a declined request reason to its tenant", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ role: "TENANT" }))
      .mockResolvedValueOnce(response([{ ...fixture("DECLINED"), declineReason: "The room has already been allocated." }]));
    render(<RequestList />);
    fireEvent.click(await screen.findByRole("tab", { name: "History 1" }));
    expect(screen.getByText("Reason from landlord")).toBeInTheDocument();
    expect(screen.getByText("“The room has already been allocated.”")).toBeInTheDocument();
  });

  it("groups current and historical requests with independent counts and empty states", async () => {
    const pending = { ...fixture("PENDING"), id: "pending" };
    const accepted = { ...fixture("ACCEPTED"), id: "accepted" };
    const cancelled = { ...fixture("CANCELLED"), id: "cancelled" };
    fetchMock
      .mockResolvedValueOnce(response({ role: "TENANT" }))
      .mockResolvedValueOnce(response([cancelled, accepted, pending]));
    render(<RequestList />);
    expect(await screen.findByRole("tab", { name: "Current 2" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("PENDING")).toBeInTheDocument();
    expect(screen.getByText("ACCEPTED")).toBeInTheDocument();
    expect(screen.queryByText("CANCELLED")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "History 1" }));
    expect(screen.getByText("CANCELLED")).toBeInTheDocument();
    expect(screen.queryByText("PENDING")).not.toBeInTheDocument();
  });
});

function fixture(status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED") {
  return {
    id: "request-1",
    propertyId: "property-1",
    preferredMoveInDate: "2026-10-01T00:00:00.000Z",
    note: "Near campus",
    declineReason: null,
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
