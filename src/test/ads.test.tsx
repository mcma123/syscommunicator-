import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicAd } from "@school-connect/core/live";
import { AdBanner, AdPopup } from "../features/school/ads";
import { AdComposer } from "../features/school/ad-composer";
import { adStage } from "../features/school/format";

const state = vi.hoisted(() => ({
  ads: [] as PublicAd[],
  session: 1000 as number | undefined,
  submit: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("../features/school/store", async () => {
  const backend = await vi.importActual<typeof import("@school-connect/backend/react")>(
    "@school-connect/backend/react",
  );
  return {
    adContentType: backend.adContentType,
    useAds: () => ({ ads: state.ads, status: "ready", sessionStartedAt: state.session }),
    useSchool: () => ({ offline: false, notify: vi.fn() }),
    useAdMedia: () => ({ items: [], status: "ready" }),
    useAdUploader: () => ({ upload: state.upload, remove: vi.fn(), move: vi.fn() }),
    useWorkflows: () => ({
      status: "ready",
      submit: state.submit,
      forms: [
        {
          action: "adSave",
          title: "Create ad",
          description: "Ads start as drafts.",
          fields: [
            { name: "title", label: "Headline", type: "text", value: "", required: true },
            { name: "caption", label: "Caption", type: "multiline", value: "", required: false },
            { name: "linkUrl", label: "Link", type: "text", value: "", required: false },
            { name: "linkLabel", label: "Button", type: "text", value: "", required: false },
            { name: "startsAt", label: "From", type: "datetime", value: "", required: true },
            { name: "endsAt", label: "Until", type: "datetime", value: "", required: true },
            {
              name: "audience",
              label: "Audience",
              type: "select",
              value: "",
              required: true,
              options: [{ value: '[{"kind":"School"}]', label: "Whole school" }],
            },
            { name: "popup", label: "Popup", type: "toggle", value: "false", required: true },
          ],
        },
      ],
    }),
  };
});

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
  items: [{ url: `https://media.example/${id}.png`, kind: "image", contentType: "image/png" }],
  ...extra,
});
const file = (name: string, size: number, type = "") => {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
};

beforeEach(() => {
  window.localStorage.clear();
  state.ads = [];
  state.session = 1000;
  state.submit.mockReset().mockResolvedValue({ id: "ad-new" });
  state.upload.mockReset().mockResolvedValue("media-1");
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Ad Center banner and popup", () => {
  it("renders nothing without running ads", () => {
    const { container } = render(<AdBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows every item of every ad as a slide and rotates", () => {
    vi.useFakeTimers();
    state.ads = [
      ad("a", {
        items: [
          { url: "https://media.example/a1.png", kind: "image", contentType: "image/png" },
          { url: "https://media.example/a2.mp4", kind: "video", contentType: "video/mp4" },
        ],
      }),
      ad("b", { linkUrl: null }),
    ];
    const { container } = render(<AdBanner />);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "Ad a (1 of 2)" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const link = screen.getByRole("link", { name: /Book now/ });
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    act(() => vi.advanceTimersByTime(8000));
    const video = container.querySelector("video")!;
    expect(video).toHaveAttribute("src", "https://media.example/a2.mp4");
    expect(video.muted).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next ad" }));
    expect(screen.getByRole("heading", { name: "Ad b" })).toBeInTheDocument();
  });

  it("shows every popup ad in one popup after each login, not again until the next", () => {
    state.session = 1000;
    state.ads = [
      ad("p", {
        popup: true,
        items: [
          { url: "https://media.example/p1.png", kind: "image", contentType: "image/png" },
          { url: "https://media.example/p2.png", kind: "image", contentType: "image/png" },
        ],
      }),
      ad("q", { popup: true }),
      ad("banner-only"),
    ];
    const first = render(<AdPopup />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Ad p");
    expect(dialog).toHaveTextContent("1 OF 2");
    expect(dialog.querySelector("img")).toHaveAttribute("src", "https://media.example/p1.png");
    fireEvent.click(screen.getAllByRole("button", { name: /^Next$/ })[0]!);
    expect(dialog.querySelector("img")).toHaveAttribute("src", "https://media.example/p2.png");
    fireEvent.click(screen.getAllByRole("button", { name: /^Next$/ })[0]!);
    expect(screen.getByRole("dialog")).toHaveTextContent("Ad q");
    expect(screen.getByRole("dialog")).toHaveTextContent("2 OF 2");
    expect(screen.getByRole("dialog")).not.toHaveTextContent("Ad banner-only");
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    first.unmount();

    // A reload within the same login keeps it closed.
    const reload = render(<AdPopup />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    reload.unmount();

    // Signing out and in again starts a new session: the popup returns.
    state.session = 2000;
    const relogin = render(<AdPopup />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Ad p");
    fireEvent.click(screen.getByRole("button", { name: "Skip all" }));
    relogin.unmount();

    // An edited ad (new revision) shows again in the same login.
    state.ads = [{ ...state.ads[1]!, revision: 2 }];
    render(<AdPopup />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Ad q");
  });

  it("shows a loading shimmer until media loads, and a calm message if it fails", () => {
    state.ads = [
      ad("s"),
      ad("f", {
        items: [{ url: "https://media.example/f.png", kind: "image", contentType: "image/png" }],
      }),
    ];
    const { container } = render(<AdBanner />);
    expect(screen.getByRole("status", { name: "Loading Ad s" })).toBeInTheDocument();
    fireEvent.load(container.querySelector("img")!);
    expect(screen.queryByRole("status", { name: "Loading Ad s" })).not.toBeInTheDocument();
    expect(container.querySelector("img")).toHaveClass("is-ready");
    fireEvent.click(screen.getByRole("button", { name: "Next ad" }));
    fireEvent.error(container.querySelector("img")!);
    expect(screen.getByRole("img", { name: "Ad f could not be loaded" })).toHaveTextContent(
      "Picture unavailable right now",
    );
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

describe("Ad composer", () => {
  it("keeps the button link hidden until requested", () => {
    render(<AdComposer />);
    expect(screen.queryByPlaceholderText("https://")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Add a button link/));
    expect(screen.getByPlaceholderText("https://")).toBeInTheDocument();
  });

  it("checks dropped files, then saves the ad and uploads the accepted files", async () => {
    render(<AdComposer />);
    fireEvent.change(screen.getByPlaceholderText(/Spring Concert/), {
      target: { value: "Open Day" },
    });
    const zone = screen.getByRole("button", { name: /Add pictures or videos/ });
    fireEvent.drop(zone, {
      dataTransfer: {
        files: [
          file("poster.jpg", 2 * 1024 * 1024),
          file("huge.mp4", 60 * 1024 * 1024),
          file("anim.gif", 1000),
          file("tour.mov", 30 * 1024 * 1024),
        ],
      },
    });
    const rejected = screen.getByRole("alert");
    expect(rejected).toHaveTextContent("huge.mp4: Videos may be up to 50 MB.");
    expect(rejected).toHaveTextContent("anim.gif: Use a PNG, JPEG or WebP picture");
    expect(screen.getByText(/poster\.jpg · 2\.0 MB/)).toBeInTheDocument();
    expect(screen.getByText(/tour\.mov · 30\.0 MB/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save and upload 2 files" }));
    await waitFor(() => expect(state.upload).toHaveBeenCalledTimes(2));
    expect(state.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "adSave",
        values: expect.objectContaining({ title: "Open Day", linkUrl: "", linkLabel: "" }),
      }),
    );
    expect(state.upload).toHaveBeenCalledWith(
      "ad-new",
      expect.objectContaining({ name: "tour.mov", type: "video/quicktime" }),
      expect.any(Function),
    );
    expect(await screen.findByText(/Ad saved as a draft/)).toBeInTheDocument();
  });

  it("reports uploads that fail and keeps them for another try", async () => {
    state.upload.mockRejectedValueOnce(new Error("Upload to storage failed."));
    render(<AdComposer />);
    fireEvent.drop(screen.getByRole("button", { name: /Add pictures or videos/ }), {
      dataTransfer: { files: [file("poster.png", 1000)] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and upload 1 file" }));
    expect(await screen.findByText(/1 file could not upload/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save and upload 1 file" })).toBeEnabled();
  });
});
