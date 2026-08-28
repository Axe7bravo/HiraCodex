import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { AdminPropertyReview } from "./property-review";

describe("AdminPropertyReview", () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    Object.defineProperty(global, "fetch", {
      configurable: true,
      value: fetchMock,
    });
  });

  it("approves a pending property and disables further decisions", async () => {
    fetchMock
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(response(adminProfile))
      .mockResolvedValueOnce(
        response({ ...detail, status: "ACTIVE", review: review }),
      );
    render(<AdminPropertyReview id="property-1" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Approve and activate" }),
    );
    await waitFor(() => expect(screen.getByText("ACTIVE")).toBeInTheDocument());
    expect(fetchMock.mock.calls[2][1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    expect(
      screen.queryByRole("button", { name: "Approve and activate" }),
    ).not.toBeInTheDocument();
  });

  it("requires and sends a rejection reason", async () => {
    fetchMock
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(response(adminProfile))
      .mockResolvedValueOnce(
        response({
          ...detail,
          status: "REJECTED",
          rejectionReason: "Add clearer photos.",
          review,
        }),
      );
    render(<AdminPropertyReview id="property-1" />);
    const reason = await screen.findByLabelText("Rejection reason");
    fireEvent.change(reason, { target: { value: "Add clearer photos." } });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(
      await screen.findByText("Reason: Add clearer photos."),
    ).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
      status: "REJECTED",
      rejectionReason: "Add clearer photos.",
    });
  });

  it("warns an admin reviewing their own pending listing", async () => {
    fetchMock
      .mockResolvedValueOnce(
        response({
          ...detail,
          landlordId: "admin-1",
          landlord: { ...landlord, id: "admin-1" },
        }),
      )
      .mockResolvedValueOnce(response(adminProfile));

    render(<AdminPropertyReview id="property-1" />);

    const note = await screen.findByRole("note");
    expect(within(note).getByText("You own this listing.")).toBeInTheDocument();
    expect(
      within(note).getByText(
        "You can review it for V1, but this decision will be recorded in the audit log.",
      ),
    ).toBeInTheDocument();
  });

  it("does not show the self-review warning for another landlord's listing", async () => {
    fetchMock
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(response(adminProfile));

    render(<AdminPropertyReview id="property-1" />);

    await screen.findByRole("button", { name: "Approve and activate" });
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});

const landlord = {
  id: "landlord-1",
  firstName: "Thabo",
  lastName: "Mokoena",
  email: "landlord@example.com",
  phone: null,
  contactMethod: null,
  landlordProfile: { organisation: "Hira Homes", propertyCount: 2 },
};
const detail = {
  id: "property-1",
  landlordId: "landlord-1",
  title: "Roma room",
  description: "A quiet furnished student room near campus.",
  monthlyPrice: "1500",
  roomType: "Private room",
  status: "PENDING_REVIEW",
  availableFrom: "2026-09-15T00:00:00.000Z",
  amenities: ["Wi-Fi"],
  country: "Lesotho",
  city: "Maseru",
  area: "Roma",
  nearestInstitution: "NUL",
  distanceNote: null,
  fullAddress: null,
  latitude: null,
  longitude: null,
  rejectionReason: null,
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-26T00:00:00.000Z",
  photos: [],
  landlord,
  review: null,
};
const review = {
  action: "PROPERTY_APPROVED",
  createdAt: "2026-08-26T01:00:00.000Z",
  actor: {
    id: "admin-1",
    firstName: "Admin",
    lastName: "Reviewer",
    email: "admin@example.com",
  },
};
const adminProfile = {
  id: "admin-1",
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "Reviewer",
  role: "ADMIN",
  status: "ACTIVE",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  phone: null,
  contactMethod: null,
  verificationStatus: "NOT_SUBMITTED",
  adminProfile: null,
};
function response(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}
