import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminVerificationReview } from "./verification-review";

describe("AdminVerificationReview", () => {
  const fetchMock = jest.fn();
  const createObjectURLMock = jest.fn(() => "blob:verification-document");
  const revokeObjectURLMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    Object.defineProperty(global, "fetch", {
      value: fetchMock,
      configurable: true,
    });
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURLMock, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURLMock, configurable: true });
    createObjectURLMock.mockClear();
    revokeObjectURLMock.mockClear();
  });

  it("shows secure document controls and replaces actions after approval", async () => {
    fetchMock
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(fileResponse("application/pdf"))
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
      await screen.findByRole("link", { name: "Open document" }),
    ).toHaveAttribute(
      "href",
      "blob:verification-document",
    );
    expect(screen.getByLabelText("Preview of student.pdf")).toHaveAttribute("data", "blob:verification-document");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://localhost:4000/admin/verifications/verification-1/documents/document-1", { credentials: "include" });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("APPROVED")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
      status: "APPROVED",
    });
  });

  it("shows a private preview error and revokes created Blob URLs", async () => {
    fetchMock.mockResolvedValueOnce(response(detail)).mockResolvedValueOnce({ ok: false, status: 500 });
    const { unmount } = render(<AdminVerificationReview id="verification-1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Document preview could not be loaded.");
    expect(screen.getByRole("link", { name: "Open securely instead" })).toHaveAttribute("href", "http://localhost:4000/admin/verifications/verification-1/documents/document-1");

    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(response(detail)).mockResolvedValueOnce(fileResponse("application/pdf"));
    unmount();
    const second = render(<AdminVerificationReview id="verification-1" />);
    await waitFor(() => expect(createObjectURLMock).toHaveBeenCalled());
    second.unmount();
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:verification-document");
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

function fileResponse(type: string): Response {
  return { ok: true, status: 200, blob: async () => new Blob(["document"], { type }) } as Response;
}
