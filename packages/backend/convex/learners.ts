import { v } from "convex/values";
import schema from "./schema";
import { authedQuery } from "./lib/functions";
import { requireLearnerAccess, requireModule, requireTeacherOf } from "./lib/auth";

export const get = authedQuery({
  args: { learnerId: v.id("learners") },
  returns: schema.doc("learners"),
  handler: async (ctx, { learnerId }) => {
    requireModule(ctx.actor, "children");
    return requireLearnerAccess(ctx, learnerId, ctx.actor);
  },
});
export const listForClass = authedQuery({
  args: { classId: v.id("classes") },
  returns: v.array(schema.doc("learners")),
  handler: async (ctx, { classId }) => {
    requireModule(ctx.actor, "children");
    await requireTeacherOf(ctx, classId, ctx.actor);
    return ctx.db
      .query("learners")
      .withIndex("by_classId_and_status", (q) => q.eq("classId", classId).eq("status", "Active"))
      .take(100);
  },
});
