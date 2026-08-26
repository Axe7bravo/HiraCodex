import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { PropertyForm } from "./property-form";

describe("PropertyForm", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    Object.defineProperty(global, "fetch", {
      value: fetchMock,
      configurable: true,
    });
  });

  it("creates a draft using calendar-date, decimal, amenities and location fields", async () => {
    fetchMock.mockResolvedValue(response({ ...listing, status: "DRAFT" }));
    render(<PropertyForm />);
    fill("Title", "Roma garden room");
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "A quiet furnished room close to campus." },
    });
    fill("Monthly price (LSL)", "1450.50");
    fill("Room / property type", "Private room");
    fireEvent.change(screen.getByLabelText("Available from"), {
      target: { value: "2026-09-15" },
    });
    fill("Amenities (comma separated)", "Wi-Fi, Parking");
    fill("Area", "Roma");
    fill("Nearest institution", "National University of Lesotho");
    fireEvent.click(screen.getByRole("button", { name: "Save property" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Property saved as a draft",
    );
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:4000/properties");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toMatchObject({
      monthlyPrice: "1450.50",
      availableFrom: "2026-09-15",
      amenities: ["Wi-Fi", "Parking"],
      area: "Roma",
    });
    expect(JSON.parse(options.body)).not.toHaveProperty("landlordId");
    expect(JSON.parse(options.body)).not.toHaveProperty("status");
  });
});

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
const listing = {
  id: "property-1",
  landlordId: "landlord-1",
  title: "Roma garden room",
  description: "A quiet furnished room close to campus.",
  monthlyPrice: "1450.50",
  roomType: "Private room",
  status: "DRAFT",
  availableFrom: "2026-09-15T00:00:00.000Z",
  amenities: ["Wi-Fi", "Parking"],
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
};
function response(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}
