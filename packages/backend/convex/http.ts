import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { hashInvitation } from "./authPolicy";
import { presignGet } from "./lib/r2";

const http = httpRouter();
auth.addHttpRoutes(http);
http.route({
  path: "/files/download",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const headers = {
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Access-Control-Allow-Origin": "*",
    };
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!/^[a-f0-9]{64}$/.test(token))
      return new Response("File unavailable", { status: 403, headers });
    try {
      const args = { tokenHash: await hashInvitation(token), now: Date.now() };
      const file = await ctx.runQuery(internal.files.redeem, args);
      const blob = await ctx.storage.get(file.storageId);
      if (!blob) return new Response("File unavailable", { status: 404, headers });
      await ctx.runQuery(internal.files.redeem, { ...args, now: Date.now() });
      return new Response(blob, {
        headers: {
          ...headers,
          "Content-Type": file.contentType,
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        },
      });
    } catch {
      return new Response("File unavailable", { status: 403, headers });
    }
  }),
});
/**
 * Ad Center media gateway: verifies the signed link and the ad's current state, then
 * redirects to a short-lived presigned R2 URL (R2 serves byte ranges for video seeking).
 */
http.route({
  path: "/media/ad",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const headers = {
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Access-Control-Allow-Origin": "*",
    };
    const params = new URL(request.url).searchParams;
    const mediaId = params.get("m") ?? "";
    const revision = Number(params.get("r"));
    const scope = params.get("s") ?? "";
    const sig = params.get("sig") ?? "";
    if (!mediaId || !Number.isSafeInteger(revision) || !/^[a-f0-9]{64}$/.test(sig))
      return new Response("Media unavailable", { status: 403, headers });
    const media = await ctx.runQuery(internal.ads.resolveMedia, {
      mediaId,
      revision,
      scope,
      sig,
      now: Date.now(),
    });
    if (!media)
      return new Response("Media unavailable", {
        status: 404,
        headers: { ...headers, "Cache-Control": "no-store" },
      });
    return new Response(null, {
      status: 302,
      headers: {
        ...headers,
        Location: await presignGet(media.key, 3600),
        "Cache-Control": "private, max-age=600",
      },
    });
  }),
});
export default http;
