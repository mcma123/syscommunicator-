import { v } from "convex/values";
import schema from "./schema";
import { authedQuery } from "./lib/functions";
import { hasRole, missing, requireGuardianOf, requireModule, wholeSchool } from "./lib/auth";

export const get = authedQuery({
  args: { chargeId: v.id("charges") },
  returns: schema.doc("charges"),
  handler: async (ctx, { chargeId }) => {
    requireModule(ctx.actor, "payments");
    const charge = await ctx.db.get("charges", chargeId);
    if (!charge) missing();
    if (!wholeSchool(ctx.actor) && !hasRole(ctx.actor, "Finance"))
      await requireGuardianOf(ctx, charge.learnerId, ctx.actor);
    return charge;
  },
});
