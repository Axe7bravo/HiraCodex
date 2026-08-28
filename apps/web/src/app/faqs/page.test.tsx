import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import FaqsPage from "./page";

jest.mock("next/navigation", () => ({
  usePathname: () => "/faqs",
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn() }),
}));

describe("FAQs page", () => {
  beforeEach(() => {
    Object.defineProperty(global, "fetch", {
      configurable: true,
      value: jest.fn(() => Promise.reject(new Error("Guest session"))),
    });
  });

  it("answers important V1 marketplace questions without deferred links", () => {
    render(<FaqsPage />);

    expect(
      screen.getByRole("heading", { name: "Frequently asked questions" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Does Hira handle rent or deposits?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Can landlords edit an active listing?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Its V1 statuses are PENDING, ACCEPTED, DECLINED and CANCELLED/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not mean a completed booking, tenancy, signed lease or payment/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /payment|chat|map/i })).not.toBeInTheDocument();
  });
});
