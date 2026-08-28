import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  afterEach(() => jest.restoreAllMocks());

  it("creates a draft using calendar-date, decimal, amenities and location fields", async () => {
    fetchMock.mockResolvedValue(response({ ...listing, status: "DRAFT" }));
    render(<PropertyForm />);
    fill("Title", "Roma garden room");
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "A quiet furnished room close to campus." },
    });
    fill("Monthly price (LSL)", "1450.50");
    select("Room / property type", "Private room");
    fireEvent.change(screen.getByLabelText("Available from"), {
      target: { value: "2026-09-15" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Wi-Fi" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Parking" }));
    select("Area", "Roma");
    select("Nearest institution", "National University of Lesotho");
    fireEvent.click(screen.getByRole("button", { name: "Save property" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Property changes saved. Current status: DRAFT",
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

  it("submits a property with three photos and locks editing from refreshed state", async () => {
    const ready = {
      ...listing,
      photos: ["front", "room", "kitchen"].map((name, index) => ({
        id: `photo-${index}`,
        originalName: `${name}.jpg`,
        mimeType: "image/jpeg",
        sizeBytes: 100,
        sortOrder: index,
        createdAt: listing.createdAt,
      })),
    };
    fetchMock
      .mockResolvedValueOnce(response([ready]))
      .mockResolvedValueOnce(response({ ...ready, status: "PENDING_REVIEW" }))
      .mockResolvedValueOnce(
        response([{ ...ready, status: "PENDING_REVIEW" }]),
      );
    jest.spyOn(window, "confirm").mockReturnValue(true);
    render(<PropertyForm propertyId="property-1" />);

    const submit = await screen.findByRole("button", {
      name: "Submit for review",
    });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    expect(
      await screen.findByRole("heading", { name: "Awaiting Hira review" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "Property details cannot be changed while review is in progress.",
    );
    expect(fetchMock.mock.calls[1]).toEqual([
      "http://localhost:4000/properties/property-1/submit-review",
      expect.objectContaining({ method: "POST" }),
    ]);
    expect(
      screen.queryByRole("button", { name: "Submit for review" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeDisabled();
  });

  it("restores controlled selections when editing", async () => {
    fetchMock.mockResolvedValueOnce(response([listing]));
    render(<PropertyForm propertyId="property-1" />);
    expect(await screen.findByLabelText("Room / property type")).toHaveValue("Private room");
    expect(screen.getByLabelText("Area")).toHaveValue("Roma");
    expect(screen.getByLabelText("Nearest institution")).toHaveValue("National University of Lesotho");
    expect(screen.getByRole("checkbox", { name: "Wi-Fi" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Parking" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it.each(["DRAFT", "PAUSED", "REJECTED"])("edits and PATCHes an owned %s property with property fields only", async (status) => {
    const current = { ...listing, status, rejectionReason: status === "REJECTED" ? "Clarify the description" : null };
    const updated = { ...current, title: "Updated Roma room", description: "An updated practical room close to the university campus.", roomType: "Studio", amenities: ["Wi-Fi", "Kitchen"] };
    fetchMock
      .mockResolvedValueOnce(response([current]))
      .mockResolvedValueOnce(response(updated));
    render(<PropertyForm propertyId="property-1" />);
    fill(await screen.findByLabelText("Title"), "Updated Roma room");
    fill(screen.getByLabelText("Description"), "An updated practical room close to the university campus.");
    select("Room / property type", "Studio");
    fireEvent.click(screen.getByRole("checkbox", { name: "Parking" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Kitchen" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Changes saved.")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Updated Roma room");
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe("http://localhost:4000/properties/property-1");
    expect(options.method).toBe("PATCH");
    const payload = JSON.parse(options.body);
    expect(payload).toMatchObject({ title: "Updated Roma room", roomType: "Studio", amenities: ["Wi-Fi", "Kitchen"] });
    for (const protectedField of ["id", "landlordId", "status", "rejectionReason", "createdAt", "updatedAt", "photos"]) {
      expect(payload).not.toHaveProperty(protectedField);
    }
  });

  it.each([
    ["PENDING_REVIEW", "Property details cannot be changed while review is in progress."],
    ["INACTIVE", "This listing is inactive and cannot be edited from the landlord workflow."],
  ])("keeps %s property details read-only with an explanation", async (status, explanation) => {
    fetchMock.mockResolvedValueOnce(response([{ ...listing, status }]));
    render(<PropertyForm propertyId="property-1" />);
    expect(await screen.findByRole("note")).toHaveTextContent(explanation);
    expect(screen.getByLabelText("Title")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });

  it("shows ACTIVE as read-only and cancels pause confirmation without a request", async () => {
    fetchMock.mockResolvedValueOnce(response([{ ...listing, status: "ACTIVE" }]));
    render(<PropertyForm propertyId="property-1" />);

    expect(
      await screen.findByText(
        "This listing is currently visible to students. Pause it before changing property details.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeDisabled();
    expect(screen.getByRole("link", { name: "View listing" })).toHaveAttribute(
      "href",
      "/properties/property-1",
    );
    fireEvent.click(screen.getByRole("button", { name: "Pause to edit" }));
    expect(
      screen.getByRole("alertdialog", { name: "Pause this listing to edit it?" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Title")).toBeDisabled();
  });

  it("reconciles a successful ACTIVE pause and makes the PAUSED listing editable", async () => {
    const active = { ...listing, status: "ACTIVE" };
    const paused = { ...listing, status: "PAUSED" };
    fetchMock
      .mockResolvedValueOnce(response([active]))
      .mockResolvedValueOnce(response(paused));
    render(<PropertyForm propertyId="property-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Pause to edit" }));
    const confirmation = screen.getByRole("alertdialog");
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Pause to edit" }),
    );

    expect(await screen.findByText("Listing paused")).toBeInTheDocument();
    expect(screen.getByText("This listing is not currently visible to students, but remains editable.")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit for review" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[1]).toEqual([
      "http://localhost:4000/properties/property-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "PAUSED" }),
      }),
    ]);
  });

  it("keeps ACTIVE read-only and allows retry when pausing fails", async () => {
    fetchMock
      .mockResolvedValueOnce(response([{ ...listing, status: "ACTIVE" }]))
      .mockResolvedValueOnce(errorResponse("Listing could not be paused."));
    render(<PropertyForm propertyId="property-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Pause to edit" }));
    const confirmation = screen.getByRole("alertdialog");
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Pause to edit" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Listing could not be paused.",
    );
    expect(screen.getByText("Live on Hira")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeDisabled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Pause to edit",
      }),
    ).toBeEnabled();
  });

  it("keeps an API validation error visible and does not show success", async () => {
    fetchMock
      .mockResolvedValueOnce(response([listing]))
      .mockResolvedValueOnce(errorResponse("monthlyPrice must be positive"));
    render(<PropertyForm propertyId="property-1" />);
    fill(await screen.findByLabelText("Monthly price (LSL)"), "0");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("monthlyPrice must be positive");
    expect(screen.queryByText("Changes saved.")).not.toBeInTheDocument();
  });
});

function fill(label: string | HTMLElement, value: string) {
  fireEvent.change(typeof label === "string" ? screen.getByLabelText(label) : label, { target: { value } });
}
function select(label: string, value: string) {
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
  photos: [],
};
function response(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}
function errorResponse(message: string) {
  return Promise.resolve({
    ok: false,
    status: 400,
    json: () => Promise.resolve({ message }),
  });
}
