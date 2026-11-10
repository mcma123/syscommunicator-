import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  BarChart3,
  CheckCircle2,
  Eye,
  HeartHandshake,
  ImagePlus,
  Megaphone,
  MousePointerClick,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";
import { ConvexError } from "convex/values";
import { ADVERTISER_CATEGORIES, ADVERTISING } from "@school-connect/core/advertising";
import { schoolConfig } from "../../../packages/school-core/src";
import { Button } from "@/components/ui/button";
import { useAdvertisePage } from "./store";

const TURNSTILE_SITE_KEY = import.meta.env["VITE_TURNSTILE_SITE_KEY"] as string | undefined;

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
};
/** Cloudflare Turnstile bot check, only when a site key is configured. */
function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !box.current) return;
    const el = box.current;
    const render = () => {
      const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
      if (api && !el.dataset["rendered"]) {
        el.dataset["rendered"] = "1";
        api.render(el, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: onToken,
          "expired-callback": () => onToken(""),
        });
      }
    };
    if ((window as unknown as { turnstile?: unknown }).turnstile) return render();
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [onToken]);
  return TURNSTILE_SITE_KEY ? <div ref={box} className="advertise-turnstile" /> : null;
}

const empty = {
  businessName: "",
  contactName: "",
  email: "",
  phone: "",
  category: "",
  message: "",
  consentEmail: true,
  consentWhatsApp: false,
  website: "",
};

/** Public "Advertise with us" page for local businesses (no sign-in). */
export function AdvertisePage() {
  const { reach, enquire } = useAdvertisePage();
  const [form, setForm] = useState(empty);
  const [token, setToken] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const set = (key: keyof typeof empty) => (value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setState("sending");
    try {
      await enquire({ ...form, turnstileToken: token });
      setState("sent");
    } catch (err) {
      setState("idle");
      setError(
        err instanceof ConvexError && typeof err.data?.message === "string"
          ? err.data.message
          : "We couldn't send your enquiry. Please try again in a few minutes.",
      );
    }
  };
  const school = reach?.school ?? schoolConfig.name;
  const tiles = [
    { icon: Users, value: reach?.families, label: "families on the school app" },
    { icon: HeartHandshake, value: reach?.learners, label: "learners in the school" },
    { icon: Smartphone, value: reach?.weeklyFamilies, label: "families active this week" },
    { icon: Eye, value: reach?.adViews30, label: "ad views in the last 30 days" },
  ].filter((t) => (t.value ?? 0) > 0);

  return (
    <div className="advertise">
      <header className="advertise-top">
        <a href="/advertise" className="advertise-brand">
          <img src={schoolConfig.logoUrl} alt="" width={40} height={40} />
          <span>
            <strong>{schoolConfig.name}</strong>
            <small>{schoolConfig.subtitle}</small>
          </span>
        </a>
        <a className="advertise-signin" href="/signin">
          Parent &amp; staff sign in
        </a>
      </header>

      <section className="advertise-hero">
        <div>
          <span className="advertise-eyebrow">
            <Megaphone size={13} /> Advertise with {school}
          </span>
          <h1>{ADVERTISING.headline}</h1>
          <p>{ADVERTISING.pitch}</p>
          <div className="advertise-hero-actions">
            <Button asChild size="lg">
              <a href="#enquire">Enquire now</a>
            </Button>
            <a href="#packages" className="advertise-link">
              See packages
            </a>
          </div>
        </div>
        <div className="advertise-phone" aria-hidden>
          <div className="advertise-phone-screen">
            <span className="advertise-phone-bar" />
            <div className="advertise-phone-ad">
              <small>SCHOOL SPOTLIGHT</small>
              <strong>Your business here</strong>
              <em>Shop now →</em>
            </div>
            <span className="advertise-phone-line" />
            <span className="advertise-phone-line short" />
            <span className="advertise-phone-line" />
          </div>
        </div>
      </section>

      {tiles.length > 0 && (
        <section className="advertise-reach" aria-label="Reach">
          {tiles.map((t) => (
            <div key={t.label}>
              <t.icon size={18} />
              <strong>{t.value!.toLocaleString("en-ZA")}+</strong>
              <span>{t.label}</span>
            </div>
          ))}
        </section>
      )}

      <section className="advertise-section">
        <h2>How it works</h2>
        <ol className="advertise-steps">
          <li>
            <ImagePlus size={20} />
            <strong>Send your picture or short video</strong>
            <span>
              Your logo, a product photo or a 15-second clip, plus a link to your site or WhatsApp.
            </span>
          </li>
          <li>
            <ShieldCheck size={20} />
            <strong>The school approves it</strong>
            <span>Every ad is checked by the principal, so parents trust what they see.</span>
          </li>
          <li>
            <MousePointerClick size={20} />
            <strong>Parents see it every day</strong>
            <span>
              On the home screen of the app and, if you like, as a popup when they sign in.
            </span>
          </li>
          <li>
            <BarChart3 size={20} />
            <strong>You get a monthly report</strong>
            <span>How many parents saw your ad and how many tapped your button.</span>
          </li>
        </ol>
      </section>

      {ADVERTISING.videoUrl && (
        <section className="advertise-section">
          <h2>See it in action</h2>
          {/youtube\.com\/embed|player\.vimeo/.test(ADVERTISING.videoUrl) ? (
            <iframe
              className="advertise-video"
              src={ADVERTISING.videoUrl}
              title="How advertising with the school works"
              allow="encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              className="advertise-video"
              src={ADVERTISING.videoUrl}
              controls
              preload="metadata"
            />
          )}
        </section>
      )}

      <section className="advertise-section" id="packages">
        <h2>Packages</h2>
        <div className="advertise-packages">
          {ADVERTISING.packages.map((p) => (
            <article key={p.name} className={"featured" in p && p.featured ? "is-featured" : ""}>
              {"featured" in p && p.featured && (
                <span className="advertise-badge">Most popular</span>
              )}
              <h3>{p.name}</h3>
              <p className="advertise-price">
                <strong>{p.price}</strong> {p.period}
              </p>
              <ul>
                {p.highlights.map((h) => (
                  <li key={h}>
                    <CheckCircle2 size={14} /> {h}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <ul className="advertise-incentives">
          {ADVERTISING.incentives.map((i) => (
            <li key={i}>{i}</li>
          ))}
          <li>Every rand you spend goes towards {school}.</li>
        </ul>
      </section>

      <section className="advertise-section advertise-form-wrap" id="enquire">
        <h2>Enquire</h2>
        {state === "sent" ? (
          <div className="advertise-thanks" role="status">
            <CheckCircle2 size={28} />
            <strong>Thank you! We've received your enquiry.</strong>
            <span>
              {form.consentEmail
                ? "Check your inbox for the details. The school will be in touch soon."
                : "The school will be in touch soon."}
            </span>
          </div>
        ) : (
          <form className="advertise-form" onSubmit={(e) => void submit(e)}>
            <label>
              Business name
              <input
                required
                maxLength={120}
                value={form.businessName}
                onChange={(e) => set("businessName")(e.target.value)}
              />
            </label>
            <label>
              Your name
              <input
                required
                maxLength={120}
                autoComplete="name"
                value={form.contactName}
                onChange={(e) => set("contactName")(e.target.value)}
              />
            </label>
            <label>
              Email
              <input
                required
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => set("email")(e.target.value)}
              />
            </label>
            <label>
              <span>
                Phone <small>(optional)</small>
              </span>
              <input
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => set("phone")(e.target.value)}
              />
            </label>
            <label>
              Type of business
              <select value={form.category} onChange={(e) => set("category")(e.target.value)}>
                <option value="">Choose…</option>
                {ADVERTISER_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="advertise-wide">
              <span>
                Anything we should know? <small>(optional)</small>
              </span>
              <textarea
                rows={3}
                maxLength={1000}
                value={form.message}
                onChange={(e) => set("message")(e.target.value)}
              />
            </label>
            <label className="advertise-honeypot" aria-hidden>
              Website
              <input
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(e) => set("website")(e.target.value)}
              />
            </label>
            <label className="advertise-check advertise-wide">
              <input
                type="checkbox"
                checked={form.consentEmail}
                onChange={(e) => set("consentEmail")(e.target.checked)}
              />
              {ADVERTISING.consentEmail}
            </label>
            <label className="advertise-check advertise-wide">
              <input
                type="checkbox"
                checked={form.consentWhatsApp}
                onChange={(e) => set("consentWhatsApp")(e.target.checked)}
              />
              {ADVERTISING.consentWhatsApp}
            </label>
            <div className="advertise-wide">
              <Turnstile onToken={setToken} />
            </div>
            {error && (
              <p className="advertise-error advertise-wide" role="alert">
                {error}
              </p>
            )}
            <div className="advertise-wide advertise-submit">
              <Button type="submit" size="lg" disabled={state === "sending"}>
                {state === "sending" ? "Sending…" : "Send enquiry"}
              </Button>
              <small>
                We use your details only to talk to you about advertising with the school. We never
                share them, and you can unsubscribe at any time.
              </small>
            </div>
          </form>
        )}
      </section>

      <footer className="advertise-footer">
        © {new Date().getFullYear()} {schoolConfig.name} · {schoolConfig.subtitle}
      </footer>
    </div>
  );
}

/** Confirm page behind the unsubscribe link in advertiser emails. */
export function AdvertiseUnsubscribe({
  advertiserId,
  token,
}: {
  advertiserId: string;
  token: string;
}) {
  const { unsubscribe } = useAdvertisePage();
  const [state, setState] = useState<"idle" | "busy" | "done" | "invalid">("idle");
  const confirm = async () => {
    setState("busy");
    try {
      const result = await unsubscribe({ advertiserId, token });
      setState(result.ok ? "done" : "invalid");
    } catch {
      setState("invalid");
    }
  };
  return (
    <div className="advertise advertise-unsubscribe">
      <div className="advertise-thanks">
        <img src={schoolConfig.logoUrl} alt="" width={56} height={56} />
        {state === "done" ? (
          <>
            <strong>You're unsubscribed.</strong>
            <span>{schoolConfig.name} won't send you advertising emails again.</span>
          </>
        ) : state === "invalid" ? (
          <>
            <strong>This link doesn't work.</strong>
            <span>Reply to any of our emails and we'll remove you by hand.</span>
          </>
        ) : (
          <>
            <strong>Stop advertising emails from {schoolConfig.name}?</strong>
            <span>You can always enquire again later.</span>
            <Button disabled={state === "busy"} onClick={() => void confirm()}>
              {state === "busy" ? "Unsubscribing…" : "Unsubscribe"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
