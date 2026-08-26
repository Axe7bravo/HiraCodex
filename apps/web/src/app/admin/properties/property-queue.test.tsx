import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { AdminPropertyQueue } from "./property-queue";

describe("AdminPropertyQueue", () => {
  beforeEach(() => {
    Object.defineProperty(global, "fetch", {
      configurable: true,
      value: jest.fn().mockResolvedValue(response([])),
    });
  });

  it("shows loading and empty queue states", async () => {
    render(<AdminPropertyQueue />);
    expect(screen.getByText("Loading property queue…")).toBeInTheDocument();
    expect(
      await screen.findByText("No properties are awaiting review."),
    ).toBeInTheDocument();
  });
});

function response(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}
