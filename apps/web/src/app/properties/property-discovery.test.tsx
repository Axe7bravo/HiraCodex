import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { PropertyDiscovery } from "./property-discovery";

const push = jest.fn();
let params = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));

describe("PropertyDiscovery", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    params = new URLSearchParams();
    push.mockReset();
    fetchMock.mockReset();
    Object.defineProperty(global, "fetch", {
      configurable: true,
      value: fetchMock,
    });
  });

  it("shows loading then renders an active listing card and safe photo route", async () => {
    fetchMock.mockResolvedValue(response(page([listing])));
    render(<PropertyDiscovery />);

    expect(screen.getByText("Loading approved homes…")).toBeInTheDocument();
    expect(await screen.findByText("Roma garden room")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Roma garden room listing" }),
    ).toHaveAttribute(
      "src",
      "http://localhost:4000/discovery/properties/property-1/photos/photo-1",
    );
    expect(screen.getByText("Wi-Fi")).toBeInTheDocument();
  });

  it("sends filters through URL state for an authoritative backend request", async () => {
    fetchMock.mockResolvedValue(response(page([])));
    render(<PropertyDiscovery />);
    await screen.findByText("No homes match these filters");

    fireEvent.change(screen.getByLabelText("Minimum price"), {
      target: { value: "800" },
    });
    fireEvent.change(screen.getByLabelText("Area"), {
      target: { value: "Roma" },
    });
    fireEvent.change(screen.getByLabelText(/Amenities/), {
      target: { value: "Wi-Fi, Parking" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Show listings" }));

    expect(push).toHaveBeenCalledWith(
      "/properties?minPrice=800&area=Roma&amenities=Wi-Fi%2C+Parking",
    );
  });

  it("shows invalid-filter, API-error and image-failure states", async () => {
    fetchMock.mockResolvedValueOnce(
      response({ message: ["minPrice must match"] }, 400),
    );
    const view = render(<PropertyDiscovery />);
    expect(await screen.findByText("Check your filters")).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(response(page([listing])));
    view.unmount();
    const cardView = render(<PropertyDiscovery />);
    const image = await screen.findByRole("img", {
      name: "Roma garden room listing",
    });
    fireEvent.error(image);
    expect(screen.getByText("Image unavailable")).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(
      response({ message: "Database down" }, 500),
    );
    cardView.unmount();
    render(<PropertyDiscovery />);
    expect(await screen.findByText("Listings unavailable")).toBeInTheDocument();
  });
});

const listing = {
  id: "property-1",
  title: "Roma garden room",
  monthlyPrice: "1450.5",
  roomType: "Private room",
  availableFrom: "2026-09-15T00:00:00.000Z",
  amenities: ["Wi-Fi", "Parking", "Furnished"],
  country: "Lesotho",
  city: "Maseru",
  area: "Roma",
  nearestInstitution: "National University of Lesotho",
  distanceNote: "Ten-minute walk",
  createdAt: "2026-08-25T00:00:00.000Z",
  photos: [{ id: "photo-1", mimeType: "image/jpeg", sortOrder: 0 }],
};

function page(items: (typeof listing)[]) {
  return { items, page: 1, pageSize: 12, total: items.length, totalPages: 1 };
}

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}
