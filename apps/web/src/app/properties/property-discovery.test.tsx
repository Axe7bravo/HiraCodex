import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { trackAnalytics } from "@/lib/analytics";
import { PropertyDiscovery } from "./property-discovery";

const push = jest.fn();
let params = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));
jest.mock("@/lib/analytics", () => ({ trackAnalytics: jest.fn() }));

const trackAnalyticsMock = jest.mocked(trackAnalytics);

describe("PropertyDiscovery", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    params = new URLSearchParams();
    window.history.replaceState({}, "", "/properties");
    push.mockReset();
    fetchMock.mockReset();
    trackAnalyticsMock.mockReset();
    Object.defineProperty(global, "fetch", {
      configurable: true,
      value: fetchMock,
    });
  });

  it("shows loading then renders an active listing card and safe photo route", async () => {
    fetchMock.mockResolvedValue(response(page([listing])));
    const view = render(<PropertyDiscovery />);

    expect(screen.getByText("Loading approved homes…")).toBeInTheDocument();
    expect(await screen.findByText("Roma garden room")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Roma garden room listing" }),
    ).toHaveAttribute(
      "src",
      "http://localhost:4000/discovery/properties/property-1/photos/photo-1",
    );
    expect(screen.getAllByText("Wi-Fi")).toHaveLength(2);
    expect(screen.queryByText("Hira approved")).not.toBeInTheDocument();
    expect(trackAnalyticsMock).toHaveBeenCalledWith("property_search", {
      filtersActive: false,
      resultCount: 1,
    });

    view.rerender(<PropertyDiscovery />);
    expect(trackAnalyticsMock).toHaveBeenCalledTimes(1);
  });

  it("tracks only allow-listed structured discovery filters", async () => {
    params = new URLSearchParams(
      "area=Roma&nearestInstitution=National+University+of+Lesotho&roomType=Studio",
    );
    fetchMock.mockResolvedValue(response(page([])));

    render(<PropertyDiscovery />);
    await screen.findByText("No homes match these filters");

    expect(trackAnalyticsMock).toHaveBeenCalledWith("property_search", {
      area: "Roma",
      nearestInstitution: "National University of Lesotho",
      roomType: "Studio",
      filtersActive: true,
      resultCount: 0,
    });
  });

  it("maps dropdown, calendar, amenity and price controls to existing query state", async () => {
    fetchMock.mockResolvedValue(response(page([])));
    render(<PropertyDiscovery />);
    await screen.findByText("No homes match these filters");

    fireEvent.change(screen.getByLabelText("Location"), {
      target: { value: "Roma" },
    });
    fireEvent.change(screen.getByLabelText("Room type"), {
      target: { value: "Private room" },
    });
    const calendar = screen.getByTestId("move-in-calendar");
    const showPicker = jest.fn();
    Object.defineProperty(calendar, "showPicker", {
      configurable: true,
      value: showPicker,
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Choose move-in date" }),
    );
    expect(showPicker).toHaveBeenCalledTimes(1);
    expect(calendar).toHaveAttribute("tabindex", "-1");
    expect(screen.queryByLabelText("Move-in")).not.toBeInTheDocument();
    fireEvent.change(calendar, {
      target: { value: "2026-09-15" },
    });
    fireEvent.change(screen.getByLabelText("Institution"), {
      target: { value: "National University of Lesotho" },
    });
    fireEvent.click(screen.getByLabelText("Wi-Fi"));
    fireEvent.click(screen.getByLabelText("Parking"));
    fireEvent.change(screen.getByLabelText("Minimum price"), {
      target: { value: "800" },
    });
    fireEvent.change(screen.getByLabelText("Maximum price"), {
      target: { value: "2500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search listings" }));

    expect(push).toHaveBeenCalledWith(
      "/properties?minPrice=800&maxPrice=2500&area=Roma&nearestInstitution=National+University+of+Lesotho&availableBy=2026-09-15&roomType=Private+room&amenities=Wi-Fi%2CParking",
    );
  });

  it("resets move-in and all discovery controls", async () => {
    fetchMock.mockResolvedValue(response(page([])));
    render(<PropertyDiscovery />);
    await screen.findByText("No homes match these filters");

    fireEvent.change(screen.getByLabelText("Location"), {
      target: { value: "Roma" },
    });
    fireEvent.change(screen.getByLabelText("Room type"), {
      target: { value: "Studio" },
    });
    fireEvent.change(screen.getByTestId("move-in-calendar"), {
      target: { value: "2026-09-15" },
    });
    fireEvent.click(screen.getByLabelText("Wi-Fi"));
    fireEvent.change(screen.getByLabelText("Minimum price"), {
      target: { value: "1000" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear date" }));
    expect(screen.getByTestId("move-in-calendar")).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByLabelText("Location")).toHaveValue("");
    expect(screen.getByLabelText("Room type")).toHaveValue("");
    expect(screen.getByLabelText("Wi-Fi")).not.toBeChecked();
    expect(screen.getByText("Min: Any")).toBeInTheDocument();
    expect(push).toHaveBeenLastCalledWith("/properties");
  });

  it("restores controlled filters when browser history changes", async () => {
    fetchMock.mockResolvedValue(response(page([])));
    render(<PropertyDiscovery />);
    await screen.findByText("No homes match these filters");

    window.history.pushState(
      {},
      "",
      "/properties?area=Roma&roomType=Studio&amenities=Wi-Fi%2CParking",
    );
    fireEvent.popState(window);

    expect(screen.getByLabelText("Location")).toHaveValue("Roma");
    expect(screen.getByLabelText("Room type")).toHaveValue("Studio");
    expect(screen.getByLabelText("Wi-Fi")).toBeChecked();
    expect(screen.getByLabelText("Parking")).toBeChecked();
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
