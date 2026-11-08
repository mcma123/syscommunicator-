import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicAd } from "@school-connect/core/live";
import { AdBanner, AdPopup } from "../features/school/ads";
import { adStage } from "../features/school/format";

const state = vi.hoisted(() => ({ ads: [] as PublicAd[] }));
vi.mock("../features/school/store", () => ({
  useAds: () => ({ ads: state.ads, status: "ready" }),
}));

const ad = (id: string, extra: Partial<PublicAd> = {}): PublicAd => ({
  id,
  title: `Ad ${id}`,
  caption: `Caption ${id}`,
  linkUrl: "https://example.org/info",
  linkLabel: "Book now",
  popup: false,
  revision: 1,
  startsAt: 0,
  endsAt: Date.now() + 3600000,
  media: { url: `https://files.example/${id}.png`, kind: "image", contentType: "image/png" },
  ...extra,
});

beforeEach(() => {
  window.localStorage.clear();
  state.ads = [];
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Ad Center presentation", () => {
  it("renders nothing without running ads", () => {
    const { container } = render(<AdBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a slide with a safe external link and rotates between ads", () => {
    vi.useFakeTimers();
    state.ads = [ad("a"), ad("b", { media: null, linkUrl: null })];
    render(<AdBanner />);
    expect(screen.getByRole("heading", { name: "Ad a" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Book now/ });
    expect(link).toHaveAttribute("href", "https://example.org/info");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    act(() => vi.advanceTimersByTime(8000));
    expect(screen.getByRole("heading", { name: "Ad b" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous ad" }));
    expect(screen.getByRole("heading", { name: "Ad a" })).toBeInTheDocument();
  });

  it("plays video ads muted and inline", () => {
    state.ads = [
      ad("v", {
        media: { url: "https://files.example/v.mp4", kind: "video", contentType: "video/mp4" },
      }),
    ];
    const { container } = render(<AdBanner />);
    const video = container.querySelector("video")!;
    expect(video).toHaveAttribute("src", "https://files.example/v.mp4");
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("playsinline");
  });

  it("pops up once per ad revision and remembers dismissal", () => {
    state.ads = [ad("p", { popup: true })];
    const first = render(<AdPopup />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Ad p");
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    first.unmount();

    render(<AdPopup />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    cleanup();

    state.ads = [ad("p", { popup: true, revision: 2 })];
    render(<AdPopup />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Ad p");
  });

  it("labels the staff stage from status and schedule", () => {
    const base = {
      id: "x",
      title: "x",
      body: "",
      subtitle: "",
      amountCents: null,
      read: false,
      acknowledged: false,
      canAcknowledge: false,
    };
    const now = 1_000_000;
    expect(adStage({ ...base, status: "Review", at: 0, endsAt: now * 2 }, now)).toBe(
      "Awaiting approval",
    );
    expect(adStage({ ...base, status: "Published", at: now + 1, endsAt: now * 2 }, now)).toBe(
      "Scheduled",
    );
    expect(adStage({ ...base, status: "Published", at: 0, endsAt: now - 1 }, now)).toBe("Ended");
    expect(adStage({ ...base, status: "Published", at: 0, endsAt: now * 2 }, now)).toBe("Live");
  });
});
