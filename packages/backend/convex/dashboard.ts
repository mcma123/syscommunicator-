import { v } from "convex/values";
import { authedQuery, authedAction } from "./lib/functions";
import { internalMutation, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireActor, requireModule, requireLearnerAccess, denied, type Actor } from "./lib/auth";
import {
  accessRolesFor,
  canAccessModule,
  type SchoolModule,
} from "@school-connect/core/permissions";
import type { DashboardState, ModuleRecord } from "@school-connect/core/live";
import type { Id } from "./_generated/dataModel";
import { dashboardAggregate } from "./lib/dashboardAggregate";
import { readPage } from "./lib/read";
const stages = ["messages", "forms", "calendar", "payments"] as const;
const selectionArgs = { learnerId: v.optional(v.id("learners")) };
const stateValidator = v.object({
  ready: v.boolean(),
  revision: v.string(),
  unread: v.union(v.number(), v.null()),
  pendingActions: v.number(),
  progress: v.number(),
  upcomingEvents: v.union(v.number(), v.null()),
  amountDueCents: v.union(v.number(), v.null()),
});
async function scope(ctx: QueryCtx, actor: Actor, learnerId?: Id<"learners">) {
  requireModule(actor, "home");
  if (learnerId) await requireLearnerAccess(ctx, learnerId, actor);
  const groups = await ctx.db
    .query("groupMembers")
    .withIndex("by_userId", (q) => q.eq("userId", actor.user._id))
    .take(101);
  if (groups.length > 100) denied();
  const version = await ctx.db
    .query("dashboardVersions")
    .withIndex("by_key", (q) => q.eq("key", "sources"))
    .unique();
  const revision = JSON.stringify([
    version?.revision ?? 0,
    actor.user.dashboardRevision ?? 0,
    actor.roles.slice().sort(),
    actor.learners.map((l) => [l._id, l.classId, l.gradeId]).sort(),
    actor.teachingClasses.map((c) => [c._id, c.gradeId]).sort(),
    groups.map((g) => g.groupId).sort(),
  ]);
  const build = await ctx.db
    .query("dashboardBuilds")
    .withIndex("by_userId_and_learnerId", (q) =>
      q.eq("userId", actor.user._id).eq("learnerId", learnerId),
    )
    .unique();
  return { revision, build, roles: accessRolesFor(actor.roles, actor.learners.length > 0) };
}
export const current = authedQuery({
  args: { ...selectionArgs, now: v.number() },
  returns: stateValidator,
  handler: async (ctx, { learnerId, now }): Promise<DashboardState> => {
    if (!Number.isFinite(now) || now < 0) throw new Error("Invalid time.");
    const { revision, build, roles } = await scope(ctx, ctx.actor, learnerId);
    const ready = !!build && build.revision === revision && build.phase === "ready";
    const base = {
      ready,
      revision,
      progress: build?.progress ?? 0,
      unread:
        canAccessModule(roles, "messages") && !ctx.actor.disabledModules?.includes("messages")
          ? 0
          : null,
      pendingActions: 0,
      upcomingEvents:
        canAccessModule(roles, "calendar") && !ctx.actor.disabledModules?.includes("calendar")
          ? 0
          : null,
      amountDueCents:
        canAccessModule(roles, "payments") && !ctx.actor.disabledModules?.includes("payments")
          ? 0
          : null,
    };
    if (!ready || !build) return base;
    const count = (kind: string, pending: boolean) =>
      dashboardAggregate.count(ctx, {
        namespace: build._id,
        bounds: { prefix: [kind, pending ? 1 : 0] },
      });
    return {
      ...base,
      unread: base.unread === null ? null : await count("messages", true),
      pendingActions:
        (await count("forms", true)) +
        (await count("payments", true)) +
        (await count("acknowledgements", true)),
      upcomingEvents:
        base.upcomingEvents === null
          ? null
          : await dashboardAggregate.count(ctx, {
              namespace: build._id,
              bounds: {
                lower: { key: ["calendar", 0, now], inclusive: true },
                upper: { key: ["calendar", 1, 0], inclusive: false },
              },
            }),
      amountDueCents:
        base.amountDueCents === null
          ? null
          : await dashboardAggregate.sum(ctx, {
              namespace: build._id,
              bounds: { prefix: ["payments", 1] },
            }),
    };
  },
});
/** Derived-cache transaction, not a domain submission; it still authenticates independently. */
export const step = internalMutation({
  args: selectionArgs,
  returns: v.null(),
  handler: async (ctx, { learnerId }) => {
    const actor = await requireActor(ctx);
    const { revision, build: old, roles } = await scope(ctx, actor, learnerId);
    let build = old;
    if (!build) {
      const id = await ctx.db.insert("dashboardBuilds", {
        userId: actor.user._id,
        ...(learnerId ? { learnerId } : {}),
        revision,
        phase: "build",
        moduleIndex: 0,
        progress: 0,
        cursor: null,
      });
      build = (await ctx.db.get("dashboardBuilds", id))!;
    }
    if (build.revision !== revision) {
      await ctx.db.patch("dashboardBuilds", build._id, {
        revision,
        phase: "clean",
        moduleIndex: 0,
        progress: 0,
        cursor: null,
      });
      build = { ...build, revision, phase: "clean", moduleIndex: 0, cursor: null };
    }
    await ctx.db.patch("dashboardBuilds", build._id, { progress: build.progress + 1 });
    if (build.phase === "clean") {
      const stale = await ctx.db
        .query("dashboardItems")
        .withIndex("by_buildId", (q) => q.eq("buildId", build!._id))
        .take(25);
      for (const item of stale) {
        await dashboardAggregate.deleteIfExists(ctx, item);
        await ctx.db.delete("dashboardItems", item._id);
      }
      if (stale.length === 0) await ctx.db.patch("dashboardBuilds", build._id, { phase: "build" });
      return null;
    }
    if (build.phase === "ready") return null;
    const module = stages[build.moduleIndex];
    if (!module) {
      await ctx.db.patch("dashboardBuilds", build._id, { phase: "ready" });
      return null;
    }
    if (!canAccessModule(roles, module) || actor.disabledModules?.includes(module)) {
      await ctx.db.patch("dashboardBuilds", build._id, {
        moduleIndex: build.moduleIndex + 1,
        cursor: null,
      });
      return null;
    }
    const page = await readPage(
      ctx,
      actor,
      { module, ...(learnerId ? { learnerId } : {}) },
      { numItems: 25, cursor: build.cursor },
    );
    const add = async (
      kind: (typeof stages)[number] | "acknowledgements",
      r: ModuleRecord,
      pending: boolean,
    ) => {
      const existing = await ctx.db
        .query("dashboardItems")
        .withIndex("by_buildId_and_kind_and_sourceId", (q) =>
          q.eq("buildId", build!._id).eq("kind", kind).eq("sourceId", r.id),
        )
        .unique();
      if (existing) return;
      const id = await ctx.db.insert("dashboardItems", {
        buildId: build!._id,
        kind,
        pending,
        at: r.at ?? 0,
        amount: r.amountCents ?? 0,
        sourceId: r.id,
      });
      await dashboardAggregate.insert(ctx, (await ctx.db.get("dashboardItems", id))!);
    };
    for (const r of page.page) {
      await add(
        module,
        r,
        module === "calendar" ? false : module === "messages" ? !r.read : !!r.pending,
      );
      if (module === "messages" && r.requiresAcknowledgement && r.canAcknowledge)
        await add("acknowledgements", r, !r.acknowledged);
    }
    await ctx.db.patch(
      "dashboardBuilds",
      build._id,
      page.isDone
        ? { moduleIndex: build.moduleIndex + 1, cursor: null }
        : { cursor: page.continueCursor },
    );
    return null;
  },
});
export const advance = authedAction({
  args: selectionArgs,
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await ctx.runMutation(internal.dashboard.step, args);
    return null;
  },
});
