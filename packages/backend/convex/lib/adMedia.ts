import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { env, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { MAX_AD_ITEMS } from "./fileRules";

/** `p` = parent feed (published, running ads only); `e` = editor preview (any state). */
export type MediaScope = "p" | "e";

function signingKey() {
  const key = env.AD_MEDIA_SIGNING_KEY;
  if (!key || key.length < 32) return null;
  return new TextEncoder().encode(key);
}

export function mediaSignature(mediaId: string, revision: number, scope: MediaScope) {
  const key = signingKey();
  if (!key) return null;
  return bytesToHex(hmac(sha256, key, new TextEncoder().encode(`${mediaId}|${revision}|${scope}`)));
}

/** Constant-time comparison of two hex signatures. */
export function signatureMatches(expected: string | null, actual: string) {
  if (!expected || expected.length !== actual.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  return diff === 0;
}

/** Stable gateway URL; the HTTP route rechecks state and redirects to a short-lived R2 link. */
export function mediaUrl(mediaId: Id<"adMedia">, revision: number, scope: MediaScope) {
  const sig = mediaSignature(mediaId, revision, scope);
  const site = env.CONVEX_SITE_URL;
  if (!sig || !site) return null;
  const query = new URLSearchParams({ m: mediaId, r: String(revision), s: scope, sig });
  return `${site}/media/ad?${query.toString()}`;
}

/** Ready, attached media for an ad in display order (bounded). */
export async function readyMedia(ctx: QueryCtx, adId: Id<"ads">) {
  const rows = await ctx.db
    .query("adMedia")
    .withIndex("by_adId_and_order", (q) => q.eq("adId", adId))
    .take(MAX_AD_ITEMS * 3);
  return rows.filter((m) => m.status === "Ready" && m.detachedAt === undefined);
}

export function mediaKind(contentType: string): "image" | "video" {
  return contentType.startsWith("video/") ? "video" : "image";
}

/** Items for one ad, including the legacy single Convex-stored file for older test ads. */
export async function adItems(ctx: QueryCtx, ad: Doc<"ads">, scope: MediaScope) {
  const items: { id: string; url: string; kind: "image" | "video"; contentType: string }[] = [];
  for (const m of await readyMedia(ctx, ad._id)) {
    const url = mediaUrl(m._id, ad.revision, scope);
    if (url) items.push({ id: m._id, url, kind: m.kind, contentType: m.contentType });
  }
  if (!items.length && ad.media) {
    const url = await ctx.storage.getUrl(ad.media.storageId);
    if (url)
      items.push({
        id: ad.media.storageId,
        url,
        kind: mediaKind(ad.media.contentType),
        contentType: ad.media.contentType,
      });
  }
  return items;
}
