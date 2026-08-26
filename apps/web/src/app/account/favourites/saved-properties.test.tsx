import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { SavedProperties } from "./saved-properties";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} />
  ),
}));

describe("SavedProperties", () => {
  const originalFetch = global.fetch;

  afterAll(() => {
    Object.defineProperty(global, "fetch", {
      configurable: true,
      writable: true,
      value: originalFetch,
    });
  });

  it("shows the empty state returned by the backend", async () => {
    Object.defineProperty(global, "fetch", {
      configurable: true,
      writable: true,
      value: jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      }),
    });
    render(<SavedProperties />);
    expect(
      await screen.findByRole("heading", { name: "No saved properties yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Browse approved homes" }),
    ).toHaveAttribute("href", "/properties");
  });
});
