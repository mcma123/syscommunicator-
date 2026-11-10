import { useMemo, useState, type FormEvent } from "react";
import { ConvexError } from "convex/values";
import {
  Building2,
  Check,
  Copy,
  ExternalLink,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { ADVERTISER_STATUSES, type AdvertiserStatus } from "@school-connect/core/domain";
import { ADVERTISER_CATEGORIES } from "@school-connect/core/advertising";
import type { AdvertiserView } from "@school-connect/backend/client";
import type { Id } from "@school-connect/backend/dataModel";
import { Button } from "@/components/ui/button";
import { Empty, Placeholder } from "./components";
import { formatDate } from "./format";
import { useAdvertisers } from "./store";

const STATUS_HELP: Record<AdvertiserStatus, string> = {
  Lead: "New enquiry",
  Contacted: "In conversation",
  Active: "Paying advertiser",
  Lapsed: "Ended",
  Unsubscribed: "Asked not to be emailed",
};
const message = (err: unknown) =>
  err instanceof ConvexError && typeof err.data?.message === "string"
    ? err.data.message
    : "Something went wrong. Please try again.";
const waLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "").replace(/^0/, "27")}`;

function AddBusiness({ onDone }: { onDone: () => void }) {
  const { create } = useAdvertisers();
  const [form, setForm] = useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    category: "",
    notes: "",
    consentEmail: false,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await create(form);
      onDone();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };
  const field = (key: "businessName" | "contactName" | "email" | "phone", label: string) => (
    <label>
      {label}
      <input
        className="field"
        required={key !== "phone"}
        type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </label>
  );
  return (
    <form className="advertiser-add" onSubmit={(e) => void submit(e)}>
      <h3>Add a business you spoke to</h3>
      {field("businessName", "Business name")}
      {field("contactName", "Contact person")}
      {field("email", "Email")}
      {field("phone", "Phone (optional)")}
      <label>
        Type of business
        <select
          className="field"
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
        >
          <option value="">Choose…</option>
          {ADVERTISER_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="advertiser-wide">
        Notes
        <textarea
          className="field"
          rows={2}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </label>
      <label className="advertiser-check advertiser-wide">
        <input
          type="checkbox"
          checked={form.consentEmail}
          onChange={(e) => setForm((f) => ({ ...f, consentEmail: e.target.checked }))}
        />
        They agreed to receive advertising emails from the school. Leave unticked if not: you can
        still contact them personally, and you can send them the &quot;Advertise with us&quot; page.
      </label>
      {error && (
        <p className="advertiser-error advertiser-wide" role="alert">
          {error}
        </p>
      )}
      <div className="advertiser-wide advertiser-actions">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Add business"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function AdvertiserCard({ a }: { a: AdvertiserView }) {
  const { update } = useAdvertisers();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(a.notes ?? "");
  const [error, setError] = useState("");
  const run = (p: Promise<unknown>) => p.catch((err) => setError(message(err)));
  const toggle = () => {
    setOpen((o) => !o);
    if (a.isNew) void run(update({ advertiserId: a.id, seen: true }));
  };
  return (
    <article className={`advertiser-card${a.isNew ? " is-new" : ""}`}>
      <button type="button" className="advertiser-head" aria-expanded={open} onClick={toggle}>
        <Building2 size={18} />
        <span>
          <strong>{a.businessName}</strong>
          <small>
            {a.contactName}
            {a.category ? ` · ${a.category}` : ""} ·{" "}
            {a.source === "Website" ? "Website enquiry" : "Added by staff"} ·{" "}
            {formatDate(a.createdAt, { day: "numeric", month: "short" })}
          </small>
        </span>
        {a.isNew && <em className="advertiser-new">New</em>}
        <em className={`advertiser-status is-${a.status.toLowerCase()}`}>{a.status}</em>
      </button>
      {open && (
        <div className="advertiser-body">
          <div className="advertiser-contact">
            <a href={`mailto:${a.email}`}>
              <Mail size={13} /> {a.email}
            </a>
            {a.phone && (
              <a href={`tel:${a.phone}`}>
                <Phone size={13} /> {a.phone}
              </a>
            )}
            {a.phone && a.consentWhatsApp && (
              <a href={waLink(a.phone)} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={13} /> WhatsApp
              </a>
            )}
          </div>
          <p className="advertiser-consent">
            <ShieldCheck size={13} />
            {a.consentEmail
              ? `Agreed to advertising emails${a.consentAt ? ` on ${formatDate(a.consentAt, { day: "numeric", month: "short", year: "numeric" })}` : ""}${a.consentWhatsApp ? " and WhatsApp" : ""}. ${a.emailsSent} follow-up email${a.emailsSent === 1 ? "" : "s"} sent${a.nextEmailAt ? `, next on ${formatDate(a.nextEmailAt, { day: "numeric", month: "short" })}` : ""}.`
              : a.status === "Unsubscribed"
                ? "Unsubscribed: do not send advertising emails."
                : "No email consent: contact personally only."}
          </p>
          {a.message && <blockquote>{a.message}</blockquote>}
          <div className="advertiser-row">
            <label>
              Status
              <select
                className="field"
                value={a.status}
                disabled={a.status === "Unsubscribed"}
                onChange={(e) =>
                  void run(
                    update({ advertiserId: a.id, status: e.target.value as AdvertiserStatus }),
                  )
                }
              >
                {ADVERTISER_STATUSES.filter(
                  (s) => s !== "Unsubscribed" || a.status === "Unsubscribed",
                ).map((s) => (
                  <option key={s} value={s}>
                    {s} – {STATUS_HELP[s]}
                  </option>
                ))}
              </select>
            </label>
            <span className="advertiser-ads">
              {a.adIds.length
                ? `${a.adIds.length} linked ad${a.adIds.length === 1 ? "" : "s"}`
                : "No linked ads yet: link one from the ad's details"}
            </span>
          </div>
          <label>
            Notes
            <textarea
              className="field"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() =>
                notes !== (a.notes ?? "") && void run(update({ advertiserId: a.id, notes }))
              }
            />
          </label>
          {error && (
            <p className="advertiser-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

/** Ad Center → Advertisers: enquiries and businesses, with the public page link to share. */
export function AdvertisersPanel() {
  const { list } = useAdvertisers();
  const [filter, setFilter] = useState<AdvertiserStatus | "All">("All");
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const pageUrl =
    typeof window === "undefined" ? "/advertise" : `${window.location.origin}/advertise`;
  const shown = useMemo(
    () => (list ?? []).filter((a) => filter === "All" || a.status === filter),
    [list, filter],
  );
  const count = (s: AdvertiserStatus) => (list ?? []).filter((a) => a.status === s).length;
  return (
    <section className="advertisers">
      <div className="advertisers-share">
        <div>
          <strong>Your &quot;Advertise with us&quot; page</strong>
          <span>
            Share it in newsletters, on WhatsApp Status and on flyers. Businesses enquire there and
            appear below.
          </span>
        </div>
        <div className="advertiser-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard?.writeText(pageUrl).then(() => setCopied(true));
            }}
          >
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy link"}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/advertise" target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Open page
            </a>
          </Button>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus /> Add business
          </Button>
        </div>
      </div>
      {adding && <AddBusiness onDone={() => setAdding(false)} />}
      <div className="source-tabs" role="tablist" aria-label="Filter advertisers">
        {(["All", "Lead", "Contacted", "Active", "Lapsed", "Unsubscribed"] as const).map((s) => (
          <Button
            key={s}
            role="tab"
            size="sm"
            aria-selected={filter === s}
            variant={filter === s ? "secondary" : "ghost"}
            onClick={() => setFilter(s)}
          >
            {s}
            {s !== "All" && count(s) > 0 ? ` (${count(s)})` : ""}
          </Button>
        ))}
      </div>
      {list === undefined ? (
        <Placeholder rows={3} height={70} />
      ) : shown.length === 0 ? (
        <Empty
          title={filter === "All" ? "No businesses yet" : `No ${filter.toLowerCase()} businesses`}
          text="Share your Advertise with us page, or add a business you spoke to."
        />
      ) : (
        <div className="advertiser-list">
          {shown.map((a) => (
            <AdvertiserCard key={a.id} a={a} />
          ))}
        </div>
      )}
    </section>
  );
}

/** In an ad's details (leaders only): which business pays for this ad. */
export function AdAdvertiserLink({ adId }: { adId: string }) {
  const { leader, list, linkAd } = useAdvertisers();
  const [error, setError] = useState("");
  if (!leader || !list) return null;
  const current = list.find((a) => a.adIds.includes(adId as Id<"ads">));
  return (
    <label className="ad-advertiser-link">
      Advertiser (for monthly reports)
      <select
        className="field"
        value={current?.id ?? ""}
        onChange={(e) =>
          void linkAd({
            adId: adId as Id<"ads">,
            advertiserId: (e.target.value || null) as Id<"advertisers"> | null,
          }).catch((err) => setError(message(err)))
        }
      >
        <option value="">School ad (no advertiser)</option>
        {list
          .filter((a) => a.status !== "Unsubscribed" || a.id === current?.id)
          .map((a) => (
            <option key={a.id} value={a.id}>
              {a.businessName} ({a.status})
            </option>
          ))}
      </select>
      {error && <small role="alert">{error}</small>}
    </label>
  );
}
