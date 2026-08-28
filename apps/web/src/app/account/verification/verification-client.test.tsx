import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VerificationClient } from "./verification-client";

describe("VerificationClient", () => {
  const fetchMock = jest.fn();
  const createObjectURLMock = jest.fn(() => "blob:own-verification");
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

  it("submits tenant files as multipart form data", async () => {
    fetchMock
      .mockResolvedValueOnce(response(tenantProfile))
      .mockResolvedValueOnce(response(notSubmitted))
      .mockResolvedValueOnce(
        response({ ...notSubmitted, id: "verification-1", status: "PENDING" }),
      );
    render(<VerificationClient />);

    const input = await screen.findByLabelText(/^Verification documents/);
    const studentCard = new File(["card"], "student-card.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(input, { target: { files: [studentCard] } });
    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    await screen.findByText("Pending review");
    const [url, options] = fetchMock.mock.calls[2];
    expect(url).toBe("http://localhost:4000/verifications");
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.headers).toBeUndefined();
    expect((options.body as FormData).getAll("documents")).toHaveLength(1);
  });

  it("shows a rejection reason and allows resubmission", async () => {
    fetchMock
      .mockResolvedValueOnce(response(tenantProfile))
      .mockResolvedValueOnce(
        response({
          ...notSubmitted,
          id: "verification-1",
          status: "REJECTED",
          rejectionReason: "Please upload a clearer image.",
        }),
      );
    render(<VerificationClient />);

    expect(await screen.findByText("Changes required")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Please upload a clearer image",
    );
    expect(
      screen.getByRole("button", { name: "Resubmit documents" }),
    ).toBeInTheDocument();
  });

  it("validates landlord file count and hides upload while pending", async () => {
    fetchMock
      .mockResolvedValueOnce(response(landlordProfile))
      .mockResolvedValueOnce(response(notSubmitted));
    const { unmount } = render(<VerificationClient />);
    const input = await screen.findByLabelText(/^Verification document/);
    fireEvent.change(input, {
      target: {
        files: [
          new File(["one"], "one.pdf", { type: "application/pdf" }),
          new File(["two"], "two.pdf", { type: "application/pdf" }),
        ],
      },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("exactly one");

    unmount();
    fetchMock
      .mockResolvedValueOnce(response(landlordProfile))
      .mockResolvedValueOnce(
        response({ ...notSubmitted, id: "verification-2", status: "PENDING" }),
      );
    render(<VerificationClient />);
    await screen.findByText("Pending review");
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Submit for review" }),
      ).not.toBeInTheDocument(),
    );
  });

  it.each([
    ["tenant", tenantProfile],
    ["landlord", landlordProfile],
  ])("previews the authenticated %s owner's submitted document", async (_label, profile) => {
    fetchMock
      .mockResolvedValueOnce(response(profile))
      .mockResolvedValueOnce(response(submitted))
      .mockResolvedValueOnce(fileResponse());
    const { unmount } = render(<VerificationClient />);

    expect(await screen.findByLabelText("Preview of evidence.pdf")).toHaveAttribute("data", "blob:own-verification");
    expect(fetchMock).toHaveBeenNthCalledWith(3, "http://localhost:4000/verifications/me/documents/document-1", { credentials: "include" });
    unmount();
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:own-verification");
  });
});

const tenantProfile = {
  id: "tenant-1",
  email: "student@example.com",
  firstName: "Mpho",
  lastName: "Student",
  role: "TENANT",
  status: "ACTIVE",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  phone: null,
  contactMethod: null,
  verificationStatus: "NOT_SUBMITTED",
  tenantProfile: { institution: null, expectedMoveIn: null },
};

const landlordProfile = {
  ...tenantProfile,
  id: "landlord-1",
  role: "LANDLORD",
  landlordProfile: { organisation: null, propertyCount: null },
};

const notSubmitted = {
  id: null,
  type: "STUDENT",
  status: "NOT_SUBMITTED",
  rejectionReason: null,
  reviewedAt: null,
  createdAt: null,
  documents: [],
};

const submitted = {
  ...notSubmitted,
  id: "verification-1",
  status: "PENDING",
  createdAt: "2026-08-25T00:00:00.000Z",
  documents: [{ id: "document-1", originalName: "evidence.pdf", mimeType: "application/pdf", sizeBytes: 100, createdAt: "2026-08-25T00:00:00.000Z" }],
};

function response(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function fileResponse(): Response {
  return { ok: true, status: 200, blob: async () => new Blob(["document"], { type: "application/pdf" }) } as Response;
}
