import { getAuthSessionId, getAuthUserId, invalidateSessions } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query, env } from "./_generated/server";
import { authedAction } from "./lib/functions";
import { checkActive, demoEnabled } from "./authPolicy";
import { staffRole } from "./validators";
import type { CurrentIdentity } from "../client";

export const configuration = query({
  args: {},
  returns: v.object({ emailReady: v.boolean(), demoEnabled: v.boolean() }),
  handler: () => ({
    emailReady: !!env.RESEND_API_KEY && !!env.AUTH_EMAIL_FROM && !!env.SITE_URL,
    demoEnabled: demoEnabled(),
  }),
});
export const current = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      id: v.id("users"),
      name: v.string(),
      email: v.string(),
      status: v.union(v.literal("Active"), v.literal("Deactivated"), v.literal("Revoked")),
      disabledModules: v.optional(v.array(v.string())),
      roles: v.array(staffRole),
      learners: v.array(
        v.object({
          id: v.id("learners"),
          name: v.string(),
          gradeId: v.id("grades"),
          classId: v.id("classes"),
        }),
      ),
    }),
  ),
  handler: async (ctx): Promise<CurrentIdentity | null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get("users", userId);
    if (!user) return null;
    const sessionId = await getAuthSessionId(ctx);
    const session = sessionId ? await ctx.db.get("authSessions", sessionId) : null;
    let status: "Active" | "Deactivated" | "Revoked" = "Active";
    try {
      checkActive(user);
    } catch {
      status = "Deactivated";
    }
    if (
      !session ||
      session.userId !== userId ||
      (user.sessionsValidAfter !== undefined && session._creationTime <= user.sessionsValidAfter)
    )
      status = "Revoked";
    const base = {
      id: userId,
      name: user.name ?? "School account",
      email: user.email ?? "",
      status,
    };
    if (status !== "Active") return { ...base, roles: [], learners: [] };
    const roles = await ctx.db
      .query("staffRoles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(5);
    const links = await ctx.db
      .query("guardianLinks")
      .withIndex("by_guardianId", (q) => q.eq("guardianId", userId))
      .take(21);
    if (roles.length > 4 || links.length > 20)
      throw new Error("Account membership limit exceeded. Contact the school.");
    const learners = [];
    for (const link of links) {
      const learner = await ctx.db.get("learners", link.learnerId);
      if (learner?.status === "Active")
        learners.push({
          id: learner._id,
          name: `${learner.firstName} ${learner.lastName}`,
          gradeId: learner.gradeId,
          classId: learner.classId,
        });
    }
    const school = await ctx.db.query("schools").take(1);
    return {
      ...base,
      roles: roles.map((r) => r.role),
      learners,
      disabledModules: Object.keys(school[0]?.featureFlags ?? {}).filter(
        (key) => school[0]?.featureFlags[key] === false,
      ),
    };
  },
});

export const signOutEverywhere = authedAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await invalidateSessions(ctx, { userId: ctx.actor.user._id });
    return null;
  },
});
