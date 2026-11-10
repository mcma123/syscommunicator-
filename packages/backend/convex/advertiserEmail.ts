// Advertiser email: the consented follow-up sequence and monthly performance reports.
// Sends through Resend (RESEND_API_KEY, AUTH_EMAIL_FROM). Without that configuration the
// attempt is recorded as Skipped and the sequence waits, so nothing is lost or sent twice.
import { v } from "convex/values";
import { ADVERTISING } from "@school-connect/core/advertising";
import { env, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { unsubscribeUrl } from "./lib/advertiserToken";
import { statsDay } from "./adStats";

type Email = { subject: string; text: string };
const DAY = 86400000;

function pageUrl() {
  return env.SITE_URL ? new URL("/advertise", env.SITE_URL).toString() : "";
}
function packagesText() {
  return ADVERTISING.packages
    .map((p) => `- ${p.name}: ${p.price} ${p.period} (${p.highlights.join("; ")})`)
    .join("\n");
}

/** The three follow-up emails. Plain text keeps them personal and deliverable. */
export function sequenceEmail(
  step: number,
  c: { contactName: string; businessName: string; school: string; families: number },
): Email | null {
  const first = c.contactName.split(" ")[0] || c.contactName;
  const reach = c.families > 0 ? `more than ${c.families} families` : "our school families";
  const page = pageUrl();
  switch (step) {
    case 0:
      return {
        subject: `Advertising ${c.businessName} to ${c.school} families`,
        text: [
          `Hi ${first},`,
          "",
          `Thank you for your interest in advertising with ${c.school}.`,
          "",
          `${ADVERTISING.pitch}`,
          `The school app reaches ${reach}.`,
          "",
          "Packages:",
          packagesText(),
          "",
          ...ADVERTISING.incentives,
          "",
          `Everything, including how the ads look, is here: ${page}`,
          "Reply to this email and we'll help you put your first ad together.",
        ].join("\n"),
      };
    case 1:
      return {
        subject: `What ${c.school} parents will see`,
        text: [
          `Hi ${first},`,
          "",
          "A quick look at how your ad works:",
          "- It appears in the banner on the home screen of the school app, on phones and on the web.",
          "- You can choose a popup that parents see when they sign in.",
          "- Pictures and short videos both work, with a button to your website or WhatsApp.",
          "- Each month you get a report of how many parents saw and clicked your ad.",
          "",
          `See an example and the packages: ${page}`,
          "Reply with your logo or a photo and we'll draft the ad for you.",
        ].join("\n"),
      };
    case 2:
      return {
        subject: `Founding-partner rate at ${c.school}`,
        text: [
          `Hi ${first},`,
          "",
          `The founding-partner rate is reserved for the first 10 businesses and is filling up.`,
          `It locks in your price for the year and adds the "Proudly supports ${c.school}" badge.`,
          "",
          `If you'd like one of the spots, just reply to this email or enquire again: ${page}`,
          "",
          "Thank you for supporting the school.",
        ].join("\n"),
      };
    default:
      return null;
  }
}

async function send(
  advertiserId: Id<"advertisers">,
  to: string,
  replyTo: string | null,
  email: Email,
  idempotencyKey: string,
): Promise<{ status: "Sent" | "Failed" | "Skipped"; detail?: string }> {
  if (!env.RESEND_API_KEY || !env.AUTH_EMAIL_FROM)
    return { status: "Skipped", detail: "Email sending is not configured." };
  const unsubscribe = unsubscribeUrl(advertiserId);
  if (!unsubscribe) return { status: "Skipped", detail: "Unsubscribe links are not configured." };
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: env.AUTH_EMAIL_FROM,
      to: [to],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject: email.subject,
      text: `${email.text}\n\n—\nYou receive this because you asked about advertising with the school.\nUnsubscribe: ${unsubscribe}`,
      headers: { "List-Unsubscribe": `<${unsubscribe}>` },
    }),
  });
  return result.ok
    ? { status: "Sent" }
    : { status: "Failed", detail: `Provider HTTP ${result.status}` };
}

/** Sends every due sequence email (bounded batch); scheduled after enquiries and by cron. */
export const sendDue = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const due = await ctx.runQuery(internal.advertisers.dueLeads, { now: Date.now() });
    for (const advertiserId of due) {
      const c = await ctx.runMutation(internal.advertisers.claimEmail, {
        advertiserId,
        now: Date.now(),
      });
      if (!c) continue;
      const email = sequenceEmail(c.step, c);
      if (!email) continue;
      const result = await send(
        advertiserId,
        c.email,
        c.replyTo,
        email,
        `wgjs-advertiser-${advertiserId}-step-${c.step}`,
      );
      await ctx.runMutation(internal.advertisers.recordEmail, {
        advertiserId,
        kind: `sequence-${c.step}`,
        status: result.status,
        ...(result.detail ? { detail: result.detail } : {}),
        step: c.step,
      });
    }
    return null;
  },
});

/** First day of each month: last month's views and clicks to each active advertiser. */
export const monthlyReports = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = new Date(Date.now() + 2 * 3600000);
    const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
    const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 1;
    const month = new Date(start).toLocaleString("en-ZA", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    const targets = await ctx.runQuery(internal.advertisers.reportTargets, {
      fromDay: Math.floor(start / DAY),
      toDay: Math.floor(end / DAY),
    });
    for (const t of targets) {
      const lines = t.ads.map(
        (a) =>
          `${a.title}: ${a.impressions + a.popupViews} views (${a.popupViews} as a popup), ${a.clicks} button clicks, ${a.viewers} parent visits`,
      );
      const result = await send(
        t.advertiserId,
        t.email,
        null,
        {
          subject: `Your ${t.school} ad report for ${month}`,
          text: [
            `Hi ${t.contactName.split(" ")[0] || t.contactName},`,
            "",
            `Here is how ${t.businessName}'s ads did in ${month}:`,
            ...lines,
            "",
            "Each parent is counted once per day. Reply to this email to change your ad or renew.",
            "Thank you for supporting the school.",
          ].join("\n"),
        },
        `wgjs-advertiser-${t.advertiserId}-report-${statsDay(start)}`,
      );
      await ctx.runMutation(internal.advertisers.recordEmail, {
        advertiserId: t.advertiserId,
        kind: `report-${month}`,
        status: result.status,
        ...(result.detail ? { detail: result.detail } : {}),
      });
    }
    return null;
  },
});
