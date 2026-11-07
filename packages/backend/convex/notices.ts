import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import schema from "./schema";
import { authedQuery, authedMutation } from "./lib/functions";
import { matchesAudience } from "./lib/audiences";
import { canReadNotice } from "./lib/audiences";
import { denied, missing, requireModule } from "./lib/auth";

const publicNotice = schema
  .doc("notices")
  .omit("attachments")
  .extend({
    attachments: v.array(
      v.object({ fileName: v.string(), contentType: v.string(), size: v.number() }),
    ),
  });
const safeNotice = (notice: import("./_generated/dataModel").Doc<"notices">) => ({
  ...notice,
  attachments: notice.attachments.map(({ storageId: _storageId, ...file }) => file),
});
export const listForMe = authedQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(publicNotice),
  handler: async (ctx, args) => {
    requireModule(ctx.actor, "messages");
    if (
      !Number.isInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 50
    )
      throw new Error("Request between 1 and 50 notices.");
    const result = await ctx.db
      .query("notices")
      .withIndex("by_status_and_publishedAt", (q) => q.eq("status", "Published"))
      .order("desc")
      .paginate(args.paginationOpts);
    const page = [];
    for (const notice of result.page)
      if (await canReadNotice(ctx, ctx.actor, notice)) page.push(safeNotice(notice));
    // Pages can be empty after authorization; the cursor still advances safely.
    return { ...result, page };
  },
});
export const get = authedQuery({
  args: { noticeId: v.id("notices") },
  returns: publicNotice,
  handler: async (ctx, { noticeId }) => {
    requireModule(ctx.actor, "messages");
    const notice = await ctx.db.get("notices", noticeId);
    if (!notice) missing();
    if (!(await canReadNotice(ctx, ctx.actor, notice))) denied();
    return safeNotice(notice);
  },
});

/** A small persisted interaction to verify cross-client reactive data and optimistic rollback. */
export const setReceipt = authedMutation({
  args: { noticeId: v.id("notices"), acknowledge: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { noticeId, acknowledge }) => {
    requireModule(ctx.actor, "messages");
    const notice = await ctx.db.get("notices", noticeId);
    if (!notice) missing();
    if (
      notice.status !== "Published" ||
      !(await canReadNotice(ctx, ctx.actor, notice)) ||
      (acknowledge && !(await matchesAudience(ctx, ctx.actor, notice.audiences, "guardian")))
    )
      denied();
    const receipt = await ctx.db
      .query("noticeReceipts")
      .withIndex("by_noticeId_and_guardianId", (q) =>
        q.eq("noticeId", noticeId).eq("guardianId", ctx.actor.user._id),
      )
      .unique();
    const now = Date.now();
    const id =
      receipt?._id ??
      (await ctx.db.insert("noticeReceipts", { noticeId, guardianId: ctx.actor.user._id }));
    await ctx.db.patch("noticeReceipts", id, {
      readAt: receipt?.readAt ?? now,
      ...(acknowledge ? { acknowledgedAt: receipt?.acknowledgedAt ?? now } : {}),
    });
    await ctx.audit(acknowledge ? "notice.acknowledged" : "notice.read", "noticeReceipts", id);
    return null;
  },
});
