import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { hashInvitation } from "./authPolicy";

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
export default http;
