import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { env } from "../_generated/server";
import { signatureMatches } from "./adMedia";

/**
 * Unsubscribe capability for one advertiser: HMAC of the advertiser ID under the deployment
 * signing key (purpose-prefixed so it can never be confused with a media signature).
 * Nothing is stored; rotating AD_MEDIA_SIGNING_KEY invalidates old unsubscribe links.
 */
export function unsubscribeToken(advertiserId: string) {
  const key = env.AD_MEDIA_SIGNING_KEY;
  if (!key || key.length < 32) return null;
  return bytesToHex(
    hmac(
      sha256,
      new TextEncoder().encode(key),
      new TextEncoder().encode(`advertiser-unsubscribe|${advertiserId}`),
    ),
  );
}
export function unsubscribeTokenMatches(advertiserId: string, token: string) {
  return /^[a-f0-9]{64}$/.test(token) && signatureMatches(unsubscribeToken(advertiserId), token);
}
/** Public page where the advertiser confirms unsubscribing (a GET never changes state). */
export function unsubscribeUrl(advertiserId: string) {
  const token = unsubscribeToken(advertiserId);
  if (!token || !env.SITE_URL) return null;
  const url = new URL("/advertise/unsubscribe", env.SITE_URL);
  url.searchParams.set("a", advertiserId);
  url.searchParams.set("t", token);
  return url.toString();
}
