import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { AdminVerificationReview } from "./verification-review";

describe("AdminVerificationReview", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    Object.defineProperty(global, "fetch", {
      value: fetchMock,
      configurable: true,
    });
  });

  it("shows secure document controls and replaces actions after approval", async () => {
    fetchMock
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(
        response({
          ...detail,
          status: "APPROVED",
          reviewedAt: "2026-08-25T12:00:00.000Z",
        }),
      );
    render(<AdminVerificationReview id="verification-1" />);

    expect(await screen.findByText("Mpho Student")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Download securely" }),
    ).toHaveAttribute(
      "href",
      "http://localhost:4000/admin/verifications/verification-1/documents/document-1",
    );
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("APPROVED")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      status: "APPROVED",
    });
  });
});

const detail = {
  id: "verification-1",
  type: "STUDENT",
  status: "PENDING",
  rejectionReason: null,
  reviewedAt: null,
  createdAt: "2026-08-25T00:00:00.000Z",
  reviewedBy: null,
  user: {
    id: "owner-1",
    firstName: "Mpho",
    lastName: "Student",
    email: "mpho@example.com",
    role: "TENANT",
    tenantProfile: { institution: "NUL" },
    landlordProfile: null,
  },
  documents: [
    {
      id: "document-1",
      originalName: "student.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      createdAt: "2026-08-25T00:00:00.000Z",
    },
  ],
};

function response(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}
