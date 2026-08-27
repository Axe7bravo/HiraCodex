import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PropertyDetail } from "./property-detail";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} />
  ),
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
    expect(screen.getByText("Verified landlord")).toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText(/Preferred move-in date/), {
      target: { value: "2026-09-15" },
    });
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
});

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}
