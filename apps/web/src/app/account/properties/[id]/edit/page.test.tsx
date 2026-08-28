import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import EditPropertyPage from "./page";

jest.mock("@/components/landlord-shell", () => ({
  LandlordShell: ({ children }: { children: ReactNode }) => <>{children}</>,
  LandlordStatus: ({ status }: { status: string }) => <span>{status}</span>,
}));

describe("EditPropertyPage", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    Object.defineProperty(global, "fetch", {
      value: fetchMock,
      configurable: true,
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it("renders the real ACTIVE management composition and unlocks it after pausing", async () => {
    fetchMock
      .mockResolvedValueOnce(response([{ ...listing, status: "ACTIVE" }]))
      .mockResolvedValueOnce(response({ ...listing, status: "PAUSED" }));
    render(
      await EditPropertyPage({
        params: Promise.resolve({ id: "property-1" }),
      }),
    );

    expect(await screen.findByText("Live on Hira")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeDisabled();
    const activeActions = screen.getByRole("region", {
      name: "Active listing actions",
    });
    fireEvent.click(
      within(activeActions).getByRole("button", { name: "Pause to edit" }),
    );
    const confirmation = screen.getByRole("alertdialog", {
      name: "Pause this listing to edit it?",
    });
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Pause to edit" }),
    );

    expect(await screen.findByText("Listing paused")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit for review" })).toBeInTheDocument();
  });

  it.each(["DRAFT", "PAUSED", "REJECTED"])(
    "renders editable controls and separate save/review actions for %s",
    async (status) => {
      fetchMock.mockResolvedValueOnce(
        response([
          {
            ...listing,
            status,
            rejectionReason:
              status === "REJECTED" ? "Clarify the property description." : null,
          },
        ]),
      );
      render(
        await EditPropertyPage({
          params: Promise.resolve({ id: "property-1" }),
        }),
      );

      const title = await screen.findByLabelText("Title");
      expect(title).toBeEnabled();
      expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Submit for review" })).toBeInTheDocument();
      fireEvent.change(title, { target: { value: "Updated Roma room" } });
      expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
      if (status === "REJECTED") {
        expect(screen.getByText("Clarify the property description.")).toBeInTheDocument();
      }
    },
  );

  it("keeps the actual PENDING_REVIEW route composition read-only", async () => {
    fetchMock.mockResolvedValueOnce(
      response([{ ...listing, status: "PENDING_REVIEW" }]),
    );
    render(
      await EditPropertyPage({
        params: Promise.resolve({ id: "property-1" }),
      }),
    );

    expect(
      await screen.findByText(
        "This listing is currently being reviewed by Hira. Property details cannot be changed while review is in progress.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit for review" })).not.toBeInTheDocument();
  });
});

const listing = {
  id: "property-1",
  landlordId: "landlord-1",
  title: "Roma garden room",
  description: "A quiet furnished room near campus.",
  monthlyPrice: "1450.50",
  roomType: "Private room",
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
  photos: [],
};

function response(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}
