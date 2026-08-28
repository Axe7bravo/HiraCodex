import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PropertyDetail } from "./property-detail";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    fill,
    unoptimized,
    priority,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    unoptimized?: boolean;
    priority?: boolean;
  }) => {
    void fill;
    void unoptimized;
    void priority;
    return <img {...props} />;
  },
}));

const detail = {
  id: "property-1",
  title: "Roma Student Studio",
  description: "A quiet furnished studio.",
  monthlyPrice: "2400",
  roomType: "Studio",
  availableFrom: "2026-09-15T00:00:00.000Z",
  amenities: ["Wi-Fi", "Furnished"],
  country: "Lesotho",
  city: "Maseru",
  area: "Roma",
  nearestInstitution: "NUL",
  distanceNote: "Near campus",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  photos: [],
  landlord: {
    firstName: "Mpho",
    lastName: "Mokoena",
    organisation: null,
    verified: true,
  },
};

describe("PropertyDetail", () => {
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

  it("renders safe public detail and prompts a guest to sign in", async () => {
    fetchMock
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(response({ message: "Unauthorized" }, 401));
    render(<PropertyDetail propertyId="property-1" />);
    expect(
      await screen.findByRole("heading", { name: detail.title }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Verified landlord")).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "Sign in to save or inquire" }),
    ).toHaveAttribute("href", "/login");
  });

  it("lets a tenant save and reconciles from the authoritative list", async () => {
    const tenant = { id: "tenant", role: "TENANT" };
    fetchMock
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(response(tenant))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({}, 201))
      .mockResolvedValueOnce(
        response([{ propertyId: "property-1", property: detail }]),
      );
    render(<PropertyDetail propertyId="property-1" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Save property" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Remove from saved" }),
      ).toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/favourites/property-1"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("submits a structured tenant inquiry and prevents duplicate in-flight submission", async () => {
    const tenant = { id: "tenant", role: "TENANT" };
    let resolveInquiry:
      ((value: ReturnType<typeof response>) => void) | undefined;
    fetchMock
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(response(tenant))
      .mockResolvedValueOnce(response([]))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveInquiry = resolve;
          }),
      );
    render(<PropertyDetail propertyId="property-1" />);
    fireEvent.change(await screen.findByLabelText("Message"), {
      target: { value: "Is the room still available?" },
    });
    fireEvent.change(
      screen.getByLabelText(/Preferred move-in date/, {
        selector: "#inquiry-move-in",
      }),
      {
        target: { value: "2026-09-15" },
      },
    );
    const button = screen.getByRole("button", { name: "Send inquiry" });
    fireEvent.click(button);
    expect(
      await screen.findByRole("button", { name: "Sending…" }),
    ).toBeDisabled();
    resolveInquiry?.(response({ id: "inquiry-1" }, 201));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Inquiry sent successfully",
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("/properties/property-1/inquiries"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          message: "Is the room still available?",
          moveInDate: "2026-09-15",
        }),
      }),
    );
  });

  it("submits a tenant accommodation request from authoritative form data", async () => {
    fetchMock
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(response({ id: "tenant", role: "TENANT" }))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(
        response({ id: "request-1", status: "PENDING" }, 201),
      );
    render(<PropertyDetail propertyId="property-1" />);
    fireEvent.change(
      await screen.findByLabelText("Preferred move-in date", {
        selector: "#request-move-in",
      }),
      { target: { value: "2026-10-01" } },
    );
    fireEvent.change(screen.getByLabelText(/^Note/), {
      target: { value: "I can move promptly." },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Request accommodation" }),
    );
    expect(
      await screen.findByText("Accommodation request submitted."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("/properties/property-1/requests"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          preferredMoveInDate: "2026-10-01",
          note: "I can move promptly.",
        }),
      }),
    );
  });

  it("switches the dominant gallery image from an accessible thumbnail", async () => {
    const withPhotos = {
      ...detail,
      photos: [
        { id: "photo-1", mimeType: "image/jpeg", sortOrder: 0 },
        { id: "photo-2", mimeType: "image/jpeg", sortOrder: 1 },
      ],
    };
    fetchMock
      .mockResolvedValueOnce(response(withPhotos))
      .mockResolvedValueOnce(response({ message: "Unauthorized" }, 401));
    render(<PropertyDetail propertyId="property-1" />);

    expect(
      await screen.findByRole("img", { name: `${detail.title} main photo` }),
    ).toHaveAttribute("src", expect.stringContaining("/photos/photo-1"));
    fireEvent.click(
      screen.getByRole("button", {
        name: `Show ${detail.title} photo 2`,
      }),
    );
    expect(
      screen.getByRole("img", { name: `${detail.title} main photo` }),
    ).toHaveAttribute("src", expect.stringContaining("/photos/photo-2"));
  });

  it("does not expose tenant actions to a landlord or admin viewer", async () => {
    fetchMock
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(response({ id: "landlord", role: "LANDLORD" }));
    render(<PropertyDetail propertyId="property-1" />);
    await screen.findByRole("heading", { name: detail.title });

    expect(
      screen.queryByRole("button", { name: "Save property" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Request accommodation" }),
    ).not.toBeInTheDocument();
  });
});

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}
