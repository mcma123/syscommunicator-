import { AwsV4Signer } from "aws4fetch";
import { env } from "../_generated/server";
import { invalid } from "./workflowRules";

/**
 * Cloudflare R2 (S3-compatible) access for Ad Center media. Credentials live only in
 * Convex deployment environment variables; the bucket stays private. Call these helpers
 * from actions or HTTP actions (they use Web Crypto and fetch).
 */
function config() {
  const endpoint = env.R2_ENDPOINT?.replace(/\/+$/, "");
  const bucket = env.R2_BUCKET;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey)
    invalid("Media storage is not configured. Ask the administrator to connect Cloudflare R2.");
  return { endpoint, bucket, accessKeyId, secretAccessKey };
}

function objectUrl(key: string) {
  const { endpoint, bucket } = config();
  const path = key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return new URL(`${endpoint}/${bucket}/${path}`);
}

async function signer(
  key: string,
  method: string,
  options: { headers?: Record<string, string>; expiresIn?: number } = {},
) {
  const { accessKeyId, secretAccessKey } = config();
  const url = objectUrl(key);
  if (options.expiresIn) url.searchParams.set("X-Amz-Expires", String(options.expiresIn));
  return new AwsV4Signer({
    url: url.toString(),
    method,
    headers: options.headers ?? {},
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
    signQuery: options.expiresIn !== undefined,
  }).sign();
}

/** Presigned PUT; the browser/app must send exactly this Content-Type. */
export async function presignPut(key: string, contentType: string, expiresIn = 900) {
  const signed = await signer(key, "PUT", { headers: { "content-type": contentType }, expiresIn });
  return signed.url.toString();
}

/** Short-lived presigned GET used by the media gateway redirect (supports Range). */
export async function presignGet(key: string, expiresIn = 3600) {
  const signed = await signer(key, "GET", { expiresIn });
  return signed.url.toString();
}

async function send(key: string, method: string, headers: Record<string, string> = {}) {
  const signed = await signer(key, method, { headers });
  return fetch(signed.url, { method, headers: signed.headers });
}

export async function headObject(key: string) {
  const response = await send(key, "HEAD");
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Media storage check failed (${response.status}).`);
  return {
    size: Number(response.headers.get("content-length") ?? NaN),
    contentType: response.headers.get("content-type") ?? "",
  };
}

/** First bytes of an object, for file-signature validation. */
export async function readPrefix(key: string, length = 16) {
  const response = await send(key, "GET", { range: `bytes=0-${length - 1}` });
  if (!response.ok) throw new Error(`Media storage read failed (${response.status}).`);
  return new Uint8Array(await response.arrayBuffer()).slice(0, length);
}

export async function deleteObject(key: string) {
  const response = await send(key, "DELETE");
  if (!response.ok && response.status !== 404)
    throw new Error(`Media storage delete failed (${response.status}).`);
}
