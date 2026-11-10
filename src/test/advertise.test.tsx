import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ADVERTISING } from "@school-connect/core/advertising";
import { AdvertisePage, AdvertiseUnsubscribe } from "../features/school/advertise-page";
import { AdPerformance } from "../features/school/ads";

const enquire = vi.fn();
const unsubscribe = vi.fn();
const reach = {
  school: "Test School",
  families: 420,
  learners: 610,
  weeklyFamilies: 0,
  adViews30: 1230,
  updatedAt: 1,
};
const stats = {
  totals: { impressions: 120, popupViews: 30, clicks: 9, viewers: 80 },
  days: [
    { day: 20400, impressions: 20, popupViews: 5, clicks: 2, viewers: 18 },
    { day: 20399, impressions: 40, popupViews: 10, clicks: 3, viewers: 30 },
  ],
};
vi.mock("../features/school/store", () => ({
  useAdvertisePage: () => ({ reach, enquire, unsubscribe }),
  useAdStats: () => ({ stats, status: "ready" }),
  useAds: () => ({ ads: [], status: "ready" }),
  useTrackAd: () => vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Advertise with us page", () => {
  it("shows rounded reach (hiding zeros), packages and consented enquiry form", async () => {
    enquire.mockResolvedValue({ ok: true });
    render(<AdvertisePage />);
    expect(screen.getByText("420+")).toBeInTheDocument();
    expect(screen.getByText(/^1\D?230\+$/)).toBeInTheDocument();
    expect(screen.queryByText(/active this week/)).not.toBeInTheDocument();
    for (const p of ADVERTISING.packages) expect(screen.getByText(p.name)).toBeInTheDocument();
    expect(screen.getByLabelText(ADVERTISING.consentEmail)).toBeChecked();
    expect(screen.getByLabelText(ADVERTISING.consentWhatsApp)).not.toBeChecked();

    fireEvent.change(screen.getByLabelText("Business name"), { target: { value: "Sunny Bakery" } });
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Thandi" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "t@sunny.example" } });
    fireEvent.click(screen.getByRole("button", { name: "Send enquiry" }));
    await screen.findByText(/received your enquiry/);
    expect(enquire).toHaveBeenCalledWith(
      expect.objectContaining({
        businessName: "Sunny Bakery",
        consentEmail: true,
        consentWhatsApp: false,
        website: "",
        turnstileToken: "",
      }),
    );
  });

  it("confirms before unsubscribing and reports a bad link", async () => {
    unsubscribe.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false });
    const { unmount } = render(<AdvertiseUnsubscribe advertiserId="a1" token="t" />);
    expect(unsubscribe).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Unsubscribe" }));
    await screen.findByText("You're unsubscribed.");
    expect(unsubscribe).toHaveBeenCalledWith({ advertiserId: "a1", token: "t" });
    unmount();
    render(<AdvertiseUnsubscribe advertiserId="a1" token="bad" />);
    fireEvent.click(screen.getByRole("button", { name: "Unsubscribe" }));
    await waitFor(() => expect(screen.getByText("This link doesn't work.")).toBeInTheDocument());
  });
});

describe("ad performance", () => {
  it("shows parents reached, views, clicks with click rate and daily bars", () => {
    render(<AdPerformance adId="ad1" />);
    expect(screen.getByText("Parents reached").nextSibling).toHaveTextContent("80");
    expect(screen.getByText("Click rate 6%")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
