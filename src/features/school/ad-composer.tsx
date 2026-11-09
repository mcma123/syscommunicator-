import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CloudUpload,
  Film,
  ImageIcon,
  Link2,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { workflowError } from "@school-connect/backend/react";
import type { WorkflowForm } from "@school-connect/core/workflows";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adContentType, useAdMedia, useAdUploader, useSchool, useWorkflows } from "./store";
import { AdSlide } from "./ads";

const MB = 1024 * 1024;
const MAX_ITEMS = 10;
const LIMITS = { image: 10 * MB, video: 50 * MB };
const ACCEPT = "image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime,.mov";
type Queued = {
  id: string;
  file: File;
  type: string;
  kind: "image" | "video";
  preview: string;
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  error?: string | undefined;
};
const sizeLabel = (bytes: number) =>
  bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
/** Johannesburg wall-clock "YYYY-MM-DDTHH:mm" for datetime inputs (UTC+2, no DST). */
const localInput = (at: number) => new Date(at + 7200000).toISOString().slice(0, 16);

/** Server-provided values plus defaults for a new ad (starts now, runs two weeks). */
function formDefaults(form: WorkflowForm, openedAt: number) {
  const initial: Record<string, string> = Object.fromEntries(
    form.fields.map((f) => [f.name, f.value]),
  );
  initial["startsAt"] ||= localInput(openedAt);
  initial["endsAt"] ||= localInput(openedAt + 14 * 86400000);
  initial["audience"] ||= form.fields.find((f) => f.name === "audience")?.options?.[0]?.value ?? "";
  initial["popup"] ||= "false";
  return initial;
}

/** Check a dropped file before any upload starts; the server validates again. */
function checkAdFile(file: { name: string; size: number }) {
  const type = adContentType(file.name);
  if (!type) return { error: "Use a PNG, JPEG or WebP picture, or an MP4, WebM or MOV video." };
  const kind = type.startsWith("video/") ? ("video" as const) : ("image" as const);
  if (file.size > LIMITS[kind])
    return {
      error: kind === "video" ? "Videos may be up to 50 MB." : "Pictures may be up to 10 MB.",
    };
  return { type, kind };
}

/** Ad Center page toolbar: a "New ad" button that opens the composer inline. */
export function AdComposerLauncher() {
  const { notify } = useSchool();
  const [open, setOpen] = useState(false);
  return open ? (
    <AdComposer
      onCancel={() => setOpen(false)}
      onSaved={() => {
        setOpen(false);
        notify("Ad saved. Open it below to preview, submit or publish.");
      }}
    />
  ) : (
    <div className="ad-launcher">
      <div>
        <strong>Share something with families</strong>
        <span>Drop in posters, photos or short videos and choose who sees them.</span>
      </div>
      <Button onClick={() => setOpen(true)}>
        <Plus size={15} /> New ad
      </Button>
    </div>
  );
}

function Thumb({ kind, url, name }: { kind: "image" | "video"; url: string; name: string }) {
  return kind === "video" ? (
    <video src={`${url}#t=0.1`} muted playsInline preload="metadata" aria-label={name} />
  ) : (
    <img src={url} alt={name} />
  );
}

/**
 * Ad Center composer: one form for the ad text, schedule and audience plus a drag-and-drop
 * area for pictures and videos, which upload straight to the school's Cloudflare R2 bucket.
 */
export function AdComposer({
  adId,
  onSaved,
  onCancel,
  showPreview = true,
}: {
  adId?: string | undefined;
  onSaved?: (id: string) => void;
  onCancel?: () => void;
  showPreview?: boolean;
}) {
  const { offline } = useSchool();
  const workflows = useWorkflows("ads", adId);
  const form = workflows.forms.find((f) => f.action === "adSave");
  const media = useAdMedia(adId);
  const uploader = useAdUploader();
  // Fixed when the editor opens, so new ads default to going live straight away.
  const [openedAt] = useState(() => Math.floor(Date.now() / 60000) * 60000);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const values = useMemo(
    () => ({ ...(form ? formDefaults(form, openedAt) : {}), ...edits }),
    [form, openedAt, edits],
  );
  const ready = !!form;
  const [linkChoice, setWithLink] = useState<boolean | null>(null);
  const withLink = linkChoice ?? !!(form && formDefaults(form, openedAt)["linkUrl"]);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => queue.forEach((q) => URL.revokeObjectURL(q.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const pending = queue.filter((q) => q.status !== "done");
  const total = media.items.length + pending.length;
  const audience = form?.fields.find((f) => f.name === "audience")?.options ?? [];
  const firstMedia = useMemo(() => {
    const existing = media.items[0];
    if (existing) return { url: existing.url, kind: existing.kind };
    const q = pending[0];
    return q ? { url: q.preview, kind: q.kind } : null;
  }, [media.items, pending]);

  if (workflows.status === "loading" && !form)
    return <p className="home-quiet">Loading the ad editor…</p>;
  if (!form)
    return adId ? null : <p className="home-quiet">You do not have permission to create ads.</p>;

  const set = (name: string, value: string) => setEdits((v) => ({ ...v, [name]: value }));
  const addFiles = (files: FileList | File[]) => {
    const problems: string[] = [];
    const next: Queued[] = [];
    let room = MAX_ITEMS - total;
    for (const file of Array.from(files)) {
      const check = checkAdFile(file);
      if ("error" in check) problems.push(`${file.name}: ${check.error}`);
      else if (room <= 0) problems.push(`${file.name}: an ad can have up to ${MAX_ITEMS} items.`);
      else {
        room--;
        next.push({
          id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
          file,
          type: check.type,
          kind: check.kind,
          preview: URL.createObjectURL(file),
          status: "queued",
          progress: 0,
        });
      }
    }
    setRejected(problems);
    setQueue((q) => [...q, ...next]);
  };
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };
  const unqueue = (id: string) =>
    setQueue((q) => {
      const item = q.find((x) => x.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return q.filter((x) => x.id !== id);
    });
  const patch = (id: string, change: Partial<Queued>) =>
    setQueue((q) => q.map((x) => (x.id === id ? { ...x, ...change } : x)));

  const save = async () => {
    setBusy(true);
    setMessage("");
    setFailure(false);
    try {
      const out = await workflows.submit({
        action: "adSave",
        itemId: adId,
        values: {
          ...values,
          linkUrl: withLink ? (values["linkUrl"] ?? "") : "",
          linkLabel: withLink ? (values["linkLabel"] ?? "") : "",
        },
      });
      const id = adId ?? out.id;
      let failed = 0;
      for (const item of queue.filter((q) => q.status === "queued" || q.status === "error")) {
        patch(item.id, { status: "uploading", progress: 0, error: undefined });
        try {
          await uploader.upload(
            id,
            { name: item.file.name, type: item.type, size: item.file.size, body: item.file },
            (progress) => patch(item.id, { progress }),
          );
          patch(item.id, { status: "done", progress: 1 });
        } catch (e) {
          failed++;
          patch(item.id, { status: "error", error: workflowError(e) });
        }
      }
      setFailure(failed > 0);
      setMessage(
        failed
          ? `Ad saved, but ${failed} file${failed === 1 ? "" : "s"} could not upload. Try again.`
          : adId
            ? "Changes saved."
            : "Ad saved as a draft. Open it to submit or publish.",
      );
      if (!failed) {
        setQueue((q) => {
          q.forEach((x) => URL.revokeObjectURL(x.preview));
          return [];
        });
        onSaved?.(id);
      }
    } catch (e) {
      setFailure(true);
      setMessage(workflowError(e));
    } finally {
      setBusy(false);
    }
  };
  const run = (action: Promise<unknown>) =>
    void action.catch((e) => {
      setFailure(true);
      setMessage(workflowError(e));
    });

  return (
    <section className="ad-composer" aria-label={adId ? "Edit ad" : "New ad"}>
      <header className="ad-composer-head">
        <div>
          <h2>{adId ? "Edit ad" : "Create an ad"}</h2>
          <p>{form.description}</p>
        </div>
        {onCancel && (
          <Button variant="ghost" size="icon" aria-label="Close editor" onClick={onCancel}>
            <X size={16} />
          </Button>
        )}
      </header>
      <div className="ad-composer-grid">
        <div className="ad-composer-fields">
          <label className="composer-field">
            <span>
              Headline <small>{(values["title"] ?? "").length}/80</small>
            </span>
            <input
              className="field"
              value={values["title"] ?? ""}
              maxLength={80}
              placeholder="e.g. Spring Concert tickets now available"
              onChange={(e) => set("title", e.target.value)}
            />
          </label>
          <label className="composer-field">
            <span>
              Caption <small>{(values["caption"] ?? "").length}/500</small>
            </span>
            <textarea
              className="field"
              value={values["caption"] ?? ""}
              maxLength={500}
              rows={3}
              placeholder="A short message parents will see on the banner."
              onChange={(e) => set("caption", e.target.value)}
            />
          </label>
          <div className="composer-row">
            <label className="composer-field">
              <span>Show from</span>
              <input
                className="field"
                type="datetime-local"
                value={values["startsAt"] ?? ""}
                onChange={(e) => set("startsAt", e.target.value)}
              />
            </label>
            <label className="composer-field">
              <span>Show until</span>
              <input
                className="field"
                type="datetime-local"
                value={values["endsAt"] ?? ""}
                onChange={(e) => set("endsAt", e.target.value)}
              />
            </label>
          </div>
          <label className="composer-field">
            <span>Who sees it</span>
            <select
              className="field"
              value={values["audience"] ?? ""}
              onChange={(e) => set("audience", e.target.value)}
            >
              {audience.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="toggle-chip composer-toggle">
            <input
              type="checkbox"
              checked={values["popup"] === "true"}
              onChange={(e) => set("popup", String(e.target.checked))}
            />
            Also show as a popup after every login
          </label>
          <label className="toggle-chip composer-toggle">
            <input
              type="checkbox"
              checked={withLink}
              onChange={(e) => setWithLink(e.target.checked)}
            />
            <Link2 size={13} /> Add a button link
          </label>
          {withLink && (
            <div className="composer-row">
              <label className="composer-field">
                <span>Link (https://)</span>
                <input
                  className="field"
                  value={values["linkUrl"] ?? ""}
                  placeholder="https://"
                  inputMode="url"
                  onChange={(e) => set("linkUrl", e.target.value)}
                />
              </label>
              <label className="composer-field">
                <span>Button text</span>
                <input
                  className="field"
                  value={values["linkLabel"] ?? ""}
                  maxLength={40}
                  placeholder="Learn more"
                  onChange={(e) => set("linkLabel", e.target.value)}
                />
              </label>
            </div>
          )}
        </div>

        <div className="ad-composer-media">
          {showPreview && firstMedia && (
            <div className="ad-banner is-preview composer-preview">
              <AdSlide
                ad={{
                  title: values["title"] || "Your headline",
                  caption: values["caption"] ?? "",
                  linkUrl: withLink ? values["linkUrl"] || "https://" : null,
                  linkLabel: values["linkLabel"] || null,
                  media: firstMedia,
                }}
              />
            </div>
          )}
          <div
            className={`dropzone ${dragging ? "is-dragging" : ""}`}
            role="button"
            tabIndex={0}
            aria-label="Add pictures or videos: drop files here or press Enter to browse"
            onClick={() => input.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                input.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={drop}
          >
            <CloudUpload size={28} />
            <strong>Drag & drop pictures or videos here</strong>
            <span>or click to browse · up to {MAX_ITEMS} items</span>
            <small>
              Pictures (PNG, JPEG, WebP) up to 10 MB · Videos (MP4, WebM, MOV) up to 50 MB
            </small>
            <input
              ref={input}
              type="file"
              multiple
              accept={ACCEPT}
              hidden
              data-testid="ad-media-input"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          {rejected.length > 0 && (
            <ul className="composer-rejected" role="alert">
              {rejected.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          {(media.items.length > 0 || queue.length > 0) && (
            <ol className="media-tiles">
              {media.items.map((m, i) => (
                <li key={m.id} className="media-tile">
                  <div className="media-thumb">
                    <Thumb kind={m.kind} url={m.url} name={m.fileName} />
                    <span className="media-badge">
                      {m.kind === "video" ? <Film size={11} /> : <ImageIcon size={11} />}
                      {i + 1}
                    </span>
                  </div>
                  <span className="media-name" title={m.fileName}>
                    {m.fileName}
                  </span>
                  <div className="media-actions">
                    <button
                      type="button"
                      aria-label={`Move ${m.fileName} earlier`}
                      disabled={i === 0 || busy}
                      onClick={() => run(uploader.move(m.id, -1))}
                    >
                      <ArrowLeft size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${m.fileName} later`}
                      disabled={i === media.items.length - 1 || busy}
                      onClick={() => run(uploader.move(m.id, 1))}
                    >
                      <ArrowRight size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${m.fileName}`}
                      disabled={busy}
                      onClick={() => run(uploader.remove(m.id))}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </li>
              ))}
              {queue.map((q) => (
                <li key={q.id} className={`media-tile is-${q.status}`}>
                  <div className="media-thumb">
                    <Thumb kind={q.kind} url={q.preview} name={q.file.name} />
                    {q.status === "uploading" && (
                      <span className="media-progress" aria-label={`Uploading ${q.file.name}`}>
                        <Loader2 size={14} className="spin" /> {Math.round(q.progress * 100)}%
                      </span>
                    )}
                    {q.status === "done" && (
                      <span className="media-progress is-done">
                        <CheckCircle2 size={14} /> Uploaded
                      </span>
                    )}
                  </div>
                  <span className="media-name" title={q.file.name}>
                    {q.file.name} · {sizeLabel(q.file.size)}
                  </span>
                  {q.status === "uploading" && (
                    <progress max={1} value={q.progress} aria-label={`${q.file.name} progress`} />
                  )}
                  {q.error && <span className="media-error">{q.error}</span>}
                  {(q.status === "queued" || q.status === "error") && (
                    <div className="media-actions">
                      <button
                        type="button"
                        aria-label={`Remove ${q.file.name}`}
                        disabled={busy}
                        onClick={() => unqueue(q.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      <footer className="ad-composer-foot">
        {message && (
          <p
            role={failure ? "alert" : "status"}
            className={failure ? "composer-error" : "composer-ok"}
          >
            {message}
          </p>
        )}
        <Button disabled={busy || offline || !ready} onClick={() => void save()}>
          {busy ? (
            <>
              <Loader2 size={14} className="spin" /> Saving…
            </>
          ) : pending.length ? (
            `Save and upload ${pending.length} file${pending.length === 1 ? "" : "s"}`
          ) : adId ? (
            "Save changes"
          ) : (
            "Save draft"
          )}
        </Button>
      </footer>
    </section>
  );
}
