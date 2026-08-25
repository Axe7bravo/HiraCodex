import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { ApiStatus } from "./api-status";

describe("ApiStatus", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    Object.defineProperty(global, "fetch", {
      value: fetchMock,
      configurable: true,
    });
  });

  it("shows loading and then the successful health result", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ok",
        api: "running",
        database: "reachable",
      }),
    });
    render(<ApiStatus />);
    expect(screen.getByText("Checking services…")).toBeInTheDocument();
    expect(
      await screen.findByText("All systems connected"),
    ).toBeInTheDocument();
    expect(screen.getByText("reachable")).toBeInTheDocument();
  });

  it("shows a clear failure state", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    render(<ApiStatus />);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Connection failed"),
    );
  });
});
