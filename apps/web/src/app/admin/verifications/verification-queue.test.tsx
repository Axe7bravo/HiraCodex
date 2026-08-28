import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { AdminVerificationQueue } from "./verification-queue";

describe("AdminVerificationQueue", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    Object.defineProperty(global, "fetch", {
      value: fetchMock,
      configurable: true,
    });
  });

  it("shows pending review context and applies the simple type filter", async () => {
    fetchMock
      .mockResolvedValueOnce(response([queueItem]))
      .mockResolvedValueOnce(response([]));
    render(<AdminVerificationQueue />);

    expect(await screen.findByText("Mpho Student")).toBeInTheDocument();
    expect(screen.getByText(/National University/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open review" })).toHaveAttribute(
      "href",
      "/admin/verifications/verification-1",
    );

    fireEvent.change(screen.getByLabelText("Verification type"), {
      target: { value: "LANDLORD" },
    });
    expect(
      await screen.findByText("Verification queues are clear."),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toContain("?type=LANDLORD");
  });
});

const queueItem = {
  id: "verification-1",
  type: "STUDENT",
  status: "PENDING",
  createdAt: "2026-08-25T00:00:00.000Z",
  documentCount: 1,
  user: {
    id: "owner-1",
    firstName: "Mpho",
    lastName: "Student",
    email: "mpho@example.com",
    role: "TENANT",
    tenantProfile: { institution: "National University of Lesotho" },
    landlordProfile: null,
  },
};

function response(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}
