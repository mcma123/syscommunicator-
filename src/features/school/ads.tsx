import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Megaphone, PlayCircle, X } from "lucide-react";
import type { ModuleRecord, PublicAd } from "@school-connect/core/live";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { StatusTag } from "./components";
import { adStage, formatDate } from "./format";
import { useAds } from "./store";

type SlideAd = Pick<PublicAd, "title" | "caption" | "linkUrl" | "linkLabel"> & {
  media: { url: string; kind: "image" | "video" } | null;
};

const DISMISSED_KEY = "wgjs-ads-dismissed";
const reducedMotion = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

function readDismissed(): string[] {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}
function remember(key: string) {
  try {
    const next = [key, ...readDismissed().filter((k) => k !== key)].slice(0, 50);
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  } catch {
    // Blocked storage: the popup simply may show again on a later visit.
  }
}

export function AdMedia({
  media,
  title,
  autoPlay = true,
  controls,
}: {
  media: SlideAd["media"];
  title: string;
  autoPlay?: boolean;
  /** Defaults to showing controls only when the video cannot autoplay. */
  controls?: boolean;
}) {
  if (!media) return <div className="ad-media ad-media-empty" aria-hidden />;
  if (media.kind === "video") {
    const play = autoPlay && !reducedMotion();
    return (
      <video
        className="ad-media"
        // Without autoplay, seek a fraction in so browsers paint the first frame as a thumbnail.
        src={play ? media.url : `${media.url}#t=0.1`}
        muted
        loop
        playsInline
        autoPlay={play}
        controls={controls ?? !play}
        preload="metadata"
        aria-label={title}
      />
    );
  }
  return (
    <img className="ad-media" src={media.url} alt={title} loading={autoPlay ? "lazy" : "eager"} />
  );
}

function AdLink({
  ad,
  className,
}: {
  ad: Pick<SlideAd, "linkUrl" | "linkLabel">;
  className?: string;
}) {
  if (!ad.linkUrl) return null;
  return (
    <a className={className} href={ad.linkUrl} target="_blank" rel="noopener noreferrer">
      {ad.linkLabel || "Learn more"}
      <ArrowRight size={13} />
    </a>
  );
}

export function AdSlide({ ad, active = true }: { ad: SlideAd; active?: boolean }) {
  return (
    <div className="ad-slide">
      <AdMedia media={ad.media} title={ad.title} autoPlay={active} />
      <div className="ad-overlay">
        <span className="ad-eyebrow">
          <Megaphone size={11} /> SCHOOL SPOTLIGHT
        </span>
        <h2>{ad.title}</h2>
        {ad.caption && <p>{ad.caption}</p>}
        <AdLink ad={ad} className="ad-cta" />
      </div>
    </div>
  );
}

/** Every picture/video of every running ad, in order, as banner slides. */
function slidesOf(ads: PublicAd[]) {
  return ads.flatMap((ad) =>
    ad.items.map((item, i) => ({
      key: `${ad.id}:${i}`,
      ad: { ...ad, media: item } as SlideAd & { id: string },
      label: ad.items.length > 1 ? `${ad.title} (${i + 1} of ${ad.items.length})` : ad.title,
    })),
  );
}

/** Home carousel of running ads; renders nothing when there are none. */
export function AdBanner() {
  const { ads } = useAds();
  const slides = useMemo(() => slidesOf(ads), [ads]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const current = slides[Math.min(index, Math.max(count - 1, 0))];
  useEffect(() => {
    if (index >= count && count) setIndex(0);
  }, [count, index]);
  useEffect(() => {
    if (count < 2 || paused || reducedMotion()) return;
    const delay = current?.ad.media?.kind === "video" ? 14000 : 8000;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % count), delay);
    return () => clearTimeout(timer);
  }, [count, paused, index, current?.ad.media?.kind]);
  if (!current) return null;
  const go = (step: number) => setIndex((i) => (i + step + count) % count);
  return (
    <section
      className="ad-banner"
      aria-roledescription="carousel"
      aria-label="School spotlight"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        aria-live={paused ? "polite" : "off"}
        aria-roledescription="slide"
        aria-label={`${index + 1} of ${count}`}
      >
        <AdSlide key={current.key} ad={current.ad} />
      </div>
      {count > 1 && (
        <div className="ad-controls">
          <button type="button" aria-label="Previous ad" onClick={() => go(-1)}>
            <ChevronLeft size={16} />
          </button>
          <div className="ad-dots" role="tablist" aria-label="Choose ad">
            {slides.map((slide, i) => (
              <button
                key={slide.key}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={slide.label}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
          <button type="button" aria-label="Next ad" onClick={() => go(1)}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </section>
  );
}

/** Shows the first unseen popup ad once per device and ad revision. */
export function AdPopup() {
  const { ads } = useAds();
  const [dismissed, setDismissed] = useState<string[] | null>(null);
  useEffect(() => setDismissed(readDismissed()), []);
  const ad = useMemo(
    () =>
      dismissed === null
        ? undefined
        : ads.find((a) => a.popup && !dismissed.includes(`${a.id}:${a.revision}`)),
    [ads, dismissed],
  );
  const [itemIndex, setItemIndex] = useState(0);
  if (!ad) return null;
  const item = ad.items[Math.min(itemIndex, ad.items.length - 1)] ?? null;
  const close = () => {
    const key = `${ad.id}:${ad.revision}`;
    remember(key);
    setDismissed((d) => [...(d ?? []), key]);
    setItemIndex(0);
  };
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="ad-popup p-0 gap-0 sm:max-w-[560px]">
        <div className="ad-popup-media">
          <AdMedia key={item?.url} media={item} title={ad.title} controls />
          {ad.items.length > 1 && (
            <div className="ad-controls">
              <button
                type="button"
                aria-label="Previous picture or video"
                onClick={() => setItemIndex((i) => (i - 1 + ad.items.length) % ad.items.length)}
              >
                <ChevronLeft size={16} />
              </button>
              <div className="ad-dots">
                {ad.items.map((it, i) => (
                  <button
                    key={it.url}
                    type="button"
                    aria-label={`Item ${i + 1} of ${ad.items.length}`}
                    aria-selected={i === itemIndex}
                    onClick={() => setItemIndex(i)}
                  />
                ))}
              </div>
              <button
                type="button"
                aria-label="Next picture or video"
                onClick={() => setItemIndex((i) => (i + 1) % ad.items.length)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
        <div className="ad-popup-body">
          <span className="ad-eyebrow">
            <Megaphone size={11} /> FROM YOUR SCHOOL
          </span>
          <DialogTitle>{ad.title}</DialogTitle>
          <DialogDescription>{ad.caption || "A message from your school."}</DialogDescription>
          <div className="ad-popup-actions">
            <AdLink ad={ad} className="ad-cta" />
            <Button variant="outline" onClick={close}>
              <X size={14} />
              Got it
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const value = (r: ModuleRecord, label: string) => {
  const v = r.fields?.find((f) => f.label === label)?.value;
  return v && v !== "Not provided" ? v : null;
};

const schedule = (r: ModuleRecord) =>
  r.at === null
    ? ""
    : `${formatDate(r.at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} – ${
        r.endsAt
          ? formatDate(r.endsAt, {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : ""
      }`;

/** Staff preview inside the ad detail dialog: exactly how the home banner will look. */
export function AdPreview({ record }: { record: ModuleRecord }) {
  const ad: SlideAd = {
    title: record.title,
    caption: record.body,
    linkUrl: value(record, "Link"),
    linkLabel: value(record, "Button label"),
    media: record.media ?? null,
  };
  return (
    <section className="ad-preview" aria-label="Banner preview">
      <div className="ad-preview-head">
        <strong>Banner preview</strong>
        <span>
          <StatusTag status={adStage(record)} /> {record.category === "Popup" && "· Also a popup"}
        </span>
      </div>
      {record.media ? (
        <div className="ad-banner is-preview">
          <AdSlide ad={ad} />
        </div>
      ) : (
        <p className="home-quiet">Add pictures or videos below to see the banner preview.</p>
      )}
      {value(record, "Review note") && (
        <p className="ad-note">Review note: {value(record, "Review note")}</p>
      )}
    </section>
  );
}

export function AdList({
  records,
  onOpen,
}: {
  records: ModuleRecord[];
  onOpen: (id: string) => void;
}) {
  const now = useRef(Date.now()).current;
  return (
    <div className="ad-grid">
      {records.map((r) => {
        const stage = adStage(r, now);
        return (
          <article className="record-card ad-card" key={r.id}>
            <button
              type="button"
              className="ad-thumb"
              onClick={() => onOpen(r.id)}
              aria-label={`Open ${r.title}`}
            >
              {r.media ? (
                <AdMedia media={r.media} title={r.title} autoPlay={false} controls={false} />
              ) : (
                <span className="ad-thumb-empty">
                  <Megaphone size={22} />
                  No media yet
                </span>
              )}
              {r.media?.kind === "video" && <PlayCircle className="ad-thumb-play" size={34} />}
              {Number(value(r, "Media items") ?? 0) > 1 && (
                <span className="ad-thumb-count">+{Number(value(r, "Media items")) - 1}</span>
              )}
            </button>
            <div className="ad-card-body">
              <div className="notice-badges">
                <StatusTag status={stage} />
                <span className="tag neutral">{r.category}</span>
              </div>
              <h2>{r.title}</h2>
              {r.body && <p className="body-excerpt">{r.body}</p>}
              <dl className="ad-meta">
                <div>
                  <dt>Runs</dt>
                  <dd>{schedule(r)}</dd>
                </div>
                <div>
                  <dt>Audience</dt>
                  <dd>{r.subtitle || "Not set"}</dd>
                </div>
                <div>
                  <dt>Created by</dt>
                  <dd>{value(r, "Created by") ?? "School"}</dd>
                </div>
              </dl>
              <Button variant="outline" size="sm" onClick={() => onOpen(r.id)}>
                Edit & preview
                <ArrowRight size={12} />
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
