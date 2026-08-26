import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PropertyList } from "./property-list";

describe("PropertyList", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    Object.defineProperty(global, "fetch", {
      value: fetchMock,
      configurable: true,
    });
  });

  it("shows loading and empty states", async () => {
    fetchMock.mockResolvedValue(response([]));
    render(<PropertyList />);
    expect(screen.getByText("Loading your properties…")).toBeInTheDocument();
    expect(await screen.findByText("No properties yet")).toBeInTheDocument();
  });

  it("pauses and deletes an owned draft", async () => {
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock
      .mockResolvedValueOnce(response([listing]))
      .mockResolvedValueOnce(response({ ...listing, status: "PAUSED" }))
      .mockResolvedValueOnce(response(undefined, 200));
    render(<PropertyList />);

    fireEvent.click(await screen.findByRole("button", { name: "Pause" }));
    expect(await screen.findByText("Property paused.")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe(
      "http://localhost:4000/properties/property-1",
    );
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "PATCH" });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(screen.queryByText(listing.title)).not.toBeInTheDocument(),
    );
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: "DELETE" });
    confirm.mockRestore();
  });
});

const listing = {
  id: "property-1",
  landlordId: "landlord-1",
  title: "Roma garden room",
  description: "A quiet furnished room near campus.",
  monthlyPrice: "1450.50",
  roomType: "Private room",
  status: "DRAFT",
  availableFrom: "2026-09-15T00:00:00.000Z",
  amenities: ["Wi-Fi"],
  country: "Lesotho",
  city: "Maseru",
  area: "Roma",
  nearestInstitution: "National University of Lesotho",
  distanceNote: null,
  fullAddress: null,
  latitude: null,
  longitude: null,
  rejectionReason: null,
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:00:00.000Z",
} as const;

function response(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}
