import { internalQuery } from "./_generated/server";
import { v } from "convex/values";
import schema from "./schema";
import { requireActor, type Actor } from "./lib/auth";
import { staffRole } from "./validators";

export const context = internalQuery({
  args: {},
  returns: v.object({
    user: schema.doc("users"),
    disabledModules: v.optional(v.array(v.string())),
    roles: v.array(staffRole),
    learners: v.array(schema.doc("learners")),
    teachingClasses: v.array(schema.doc("classes")),
  }),
  handler: async (ctx): Promise<Actor> => requireActor(ctx),
});
