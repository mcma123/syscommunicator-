import { v } from "convex/values";
import schema from "./schema";
import { authedQuery } from "./lib/functions";
import { denied, missing, requireModule, wholeSchool } from "./lib/auth";
import { matchesAudience } from "./lib/audiences";

export const get = authedQuery({
  args: { resourceId: v.id("resources") },
  returns: schema
    .doc("resources")
    .omit("file")
    .extend({
      file: v.object({ fileName: v.string(), contentType: v.string(), size: v.number() }),
    }),
  handler: async (ctx, { resourceId }) => {
    requireModule(ctx.actor, "resources");
    const resource = await ctx.db.get("resources", resourceId);
    if (!resource) missing();
    if (
      !wholeSchool(ctx.actor) &&
      (resource.status !== "Published" ||
        !(
          (await matchesAudience(ctx, ctx.actor, resource.audiences, "guardian")) ||
          (await matchesAudience(ctx, ctx.actor, resource.audiences, "teacher"))
        ))
    )
      denied();
    const { storageId: _storageId, ...file } = resource.file;
    return { ...resource, file };
  },
});
