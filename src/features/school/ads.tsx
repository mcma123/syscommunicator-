import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Megaphone, PlayCircle, X } from "lucide-react";
import type { ModuleRecord, PublicAd } from "@school-connect/core/live";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { StatusTag } from "./components";
import { adStage, formatDate } from "./format";
import { useAdStats, useAds, useTrackAd } from "./store";

type SlideAd = Pick<PublicAd, "title" | "caption" | "linkUrl" | "linkLabel"> & {
  media: { url: string; kind: "image" | "video" } | null;
};

const DISMISSED_KEY = "wgjs-ads-popup-seen";
const reducedMotion = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

/**
 * Popup ads already seen during this sign-in session. Stored with the session's start time,
 * so every new login (a new session) shows the popup again while reloads do not.
 */
function readSeen(session: number): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object") return [];
    const { session: stored, keys } = parsed as { session?: unknown; keys?: unknown };
    return stored === session && Array.isArray(keys)
      ? keys.filter((k): k is string => typeof k === "string")
      : [];
  } catch {
    return [];
  }
}
function rememberSeen(session: number, keys: string[]) {
  try {
    window.localStorage.setItem(
      DISMISSED_KEY,
      JSON.stringify({ session, keys: keys.slice(0, 100) }),
    );
  } catch {
    // Blocked storage: the popup may show again on a later visit in this login.
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
  // Remount per URL so each picture/video starts with its own loading shimmer.
  if (!media) return <div className="ad-media ad-media-empty" aria-hidden />;
  return (
    <LoadingMedia
      key={media.url}
      media={media}
      title={title}
      autoPlay={autoPlay}
      controls={controls}
    />
  );
}

/** Shows a shimmer until the picture or video can display, and a calm message if it fails. */
function LoadingMedia({
  media,
  title,
  autoPlay,
  controls,
}: {
  media: NonNullable<SlideAd["media"]>;
  title: string;
  autoPlay: boolean;
  controls: boolean | undefined;
}) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const done = () => setState("ready");
  const failed = () => setState("failed");
  const play = media.kind === "video" && autoPlay && !reducedMotion();
  return (
    <>
      {state !== "ready" && (
        <div
          className={`ad-media ad-media-loading ${state === "failed" ? "is-failed" : ""}`}
          role={state === "failed" ? "img" : "status"}
          aria-label={state === "failed" ? `${title} could not be loaded` : `Loading ${title}`}
        >
          {state === "failed" ? <span>Picture unavailable right now</span> : null}
        </div>
      )}
      {media.kind === "video" ? (
        <video
          className={`ad-media ${state === "ready" ? "is-ready" : "is-pending"}`}
          // Without autoplay, seek a fraction in so browsers paint the first frame as a thumbnail.
          src={play ? media.url : `${media.url}#t=0.1`}
          muted
          loop
          playsInline
          autoPlay={play}
          controls={controls ?? !play}
          preload="metadata"
          aria-label={title}
          onLoadedData={done}
          onError={failed}
        />
      ) : (
        <img
          className={`ad-media ${state === "ready" ? "is-ready" : "is-pending"}`}
          src={media.url}
          alt={title}
          loading={autoPlay ? "lazy" : "eager"}
          onLoad={done}
          onError={failed}
          ref={(img) => {
            // Cached images can finish before React attaches onLoad.
            if (img?.complete && img.naturalWidth > 0 && state === "loading") done();
          }}
        />
      )}
    </>
  );
}

function AdLink({
  ad,
  className,
  onOpen,
}: {
  ad: Pick<SlideAd, "linkUrl" | "linkLabel">;
  className?: string;
  onOpen?: (() => void) | undefined;
}) {
  if (!ad.linkUrl) return null;
  return (
    <a
      className={className}
      href={ad.linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onOpen}
    >
      {ad.linkLabel || "Learn more"}
      <ArrowRight size={13} />
    </a>
  );
}

export function AdSlide({
  ad,
  active = true,
  onOpen,
}: {
  ad: SlideAd;
  active?: boolean;
  onOpen?: (() => void) | undefined;
}) {
  return (
    <div className="ad-slide">
      <AdMedia media={ad.media} title={ad.title} autoPlay={active} />
      <div className="ad-overlay">
        <span className="ad-eyebrow">
          <Megaphone size={11} /> SCHOOL SPOTLIGHT
        </span>
        <h2>{ad.title}</h2>
        {ad.caption && <p>{ad.caption}</p>}
        <AdLink ad={ad} className="ad-cta" onOpen={onOpen} />
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
  const track = useTrackAd();
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
  const shownId = current?.ad.id;
  useEffect(() => {
    if (shownId) track(shownId, "banner");
  }, [shownId, track]);
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
        <AdSlide key={current.key} ad={current.ad} onOpen={() => track(current.ad.id, "click")} />
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

/** Seen-key for a popup ad; an edit (new revision) shows it again. */
const keyOf = (a: Pick<PublicAd, "id" | "revision">) => `${a.id}:${a.revision}`;

/**
 * After every login, one popup steps through all running ads marked "popup" (and each ad's
 * pictures/videos). Closing it marks them seen for this login only.
 */
export function AdPopup() {
  const { ads, sessionStartedAt } = useAds();
  const track = useTrackAd();
  const [seen, setSeen] = useState<{ session: number; keys: string[] } | null>(null);
  const known = sessionStartedAt !== undefined && seen?.session === sessionStartedAt;
  if (sessionStartedAt !== undefined && !known)
    setSeen({ session: sessionStartedAt, keys: readSeen(sessionStartedAt) });
  const queue = useMemo(
    () =>
      known ? ads.filter((a) => a.popup && a.items.length && !seen!.keys.includes(keyOf(a))) : [],
    [ads, known, seen],
  );
  const slides = useMemo(
    () => queue.flatMap((ad, adIndex) => ad.items.map((item) => ({ ad, adIndex, item }))),
    [queue],
  );
  const [index, setIndex] = useState(0);
  const slide = slides[Math.min(index, slides.length - 1)];
  const popupId = sessionStartedAt === undefined ? undefined : slide?.ad.id;
  useEffect(() => {
    if (popupId) track(popupId, "popup");
  }, [popupId, track]);
  if (!slide || sessionStartedAt === undefined) return null;
  const { ad, adIndex, item } = slide;
  const close = () => {
    const keys = [...(seen?.keys ?? []), ...queue.map(keyOf)];
    rememberSeen(sessionStartedAt, keys);
    setSeen({ session: sessionStartedAt, keys });
    setIndex(0);
  };
  const go = (step: number) => setIndex((i) => (i + step + slides.length) % slides.length);
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="ad-popup p-0 gap-0 sm:max-w-[560px]">
        <div className="ad-popup-media">
          <AdMedia key={`${ad.id}:${item.url}`} media={item} title={ad.title} controls />
          {slides.length > 1 && (
            <div className="ad-controls">
              <button type="button" aria-label="Previous slide" onClick={() => go(-1)}>
                <ChevronLeft size={16} />
              </button>
              <div className="ad-dots">
                {slides.map((s, i) => (
                  <button
                    key={`${s.ad.id}:${s.item.url}`}
                    type="button"
                    aria-label={`${s.ad.title}, ${i + 1} of ${slides.length}`}
                    aria-selected={i === index}
                    onClick={() => setIndex(i)}
                  />
                ))}
              </div>
              <button type="button" aria-label="Next slide" onClick={() => go(1)}>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
        <div className="ad-popup-body">
          <span className="ad-eyebrow">
            <Megaphone size={11} /> FROM YOUR SCHOOL
            {queue.length > 1 && ` · ${adIndex + 1} OF ${queue.length}`}
          </span>
          <DialogTitle>{ad.title}</DialogTitle>
          <DialogDescription>{ad.caption || "A message from your school."}</DialogDescription>
          <div className="ad-popup-actions">
            <AdLink ad={ad} className="ad-cta" onOpen={() => track(ad.id, "click")} />
            {slides.length > 1 && index < slides.length - 1 ? (
              <Button variant="outline" onClick={() => go(1)}>
                Next
                <ChevronRight size={14} />
              </Button>
            ) : null}
            <Button variant="outline" onClick={close}>
              <X size={14} />
              {slides.length > 1 && index < slides.length - 1 ? "Skip all" : "Got it"}
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

const DAY_MS = 86400000;
/** Converts a stats day (days since epoch, SAST) to a short date label. */
const dayLabel = (day: number) =>
  formatDate(day * DAY_MS, { day: "numeric", month: "short", timeZone: "UTC" });

/** Staff ad detail: how many parents saw and clicked the ad (counted once per parent per day). */
export function AdPerformance({ adId }: { adId: string }) {
  const { stats, status } = useAdStats(adId);
  if (status === "error") return null;
  const t = stats?.totals;
  const shown = (t?.impressions ?? 0) + (t?.popupViews ?? 0);
  const rate = shown && t ? `${Math.round((t.clicks / shown) * 1000) / 10}%` : "—";
  const days = [...(stats?.days ?? [])].reverse().slice(-14);
  const peak = Math.max(1, ...days.map((d) => d.viewers));
  const tiles = [
    { label: "Parents reached", value: t?.viewers },
    { label: "Banner views", value: t?.impressions },
    { label: "Popup views", value: t?.popupViews },
    { label: "Button clicks", value: t?.clicks, hint: `Click rate ${rate}` },
  ];
  return (
    <section className="ad-stats" aria-label="Ad performance">
      <div className="ad-stats-head">
        <strong>Performance</strong>
        <span>Each parent is counted once per day</span>
      </div>
      <div className="ad-stats-tiles">
        {tiles.map((tile) => (
          <div key={tile.label} className="ad-stat">
            <span>{tile.label}</span>
            <strong>{status === "loading" ? "…" : (tile.value ?? 0).toLocaleString()}</strong>
            {tile.hint && <small>{tile.hint}</small>}
          </div>
        ))}
      </div>
      {days.length > 0 ? (
        <div className="ad-stats-days" role="list" aria-label="Parents reached per day">
          {days.map((d) => (
            <div
              key={d.day}
              role="listitem"
              className="ad-stats-day"
              title={`${dayLabel(d.day)}: ${d.viewers} parents, ${d.clicks} clicks`}
            >
              <i style={{ height: `${Math.max(6, (d.viewers / peak) * 100)}%` }} />
              <span>{dayLabel(d.day)}</span>
            </div>
          ))}
        </div>
      ) : (
        status === "ready" && (
          <p className="ad-stats-empty">No views yet. Numbers appear once the ad is live.</p>
        )
      )}
    </section>
  );
}
