import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      .mockResolvedValueOnce(
        response({ ...detail, status: "ACTIVE", review: review }),
      );
    render(<AdminPropertyReview id="property-1" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Approve and activate" }),
    );
    await waitFor(() => expect(screen.getByText("ACTIVE")).toBeInTheDocument());
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    expect(
      screen.queryByRole("button", { name: "Approve and activate" }),
    ).not.toBeInTheDocument();
  });

  it("requires and sends a rejection reason", async () => {
    fetchMock.mockResolvedValueOnce(response(detail)).mockResolvedValueOnce(
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
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      status: "REJECTED",
      rejectionReason: "Add clearer photos.",
    });
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
function response(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}
