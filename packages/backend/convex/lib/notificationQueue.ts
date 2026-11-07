import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal, components } from "../_generated/api";
import { Workpool } from "@convex-dev/workpool";
export const notificationPool = new Workpool(components.notificationWorkpool, {
  maxParallelism: 2,
  retryActionsByDefault: false,
  defaultRetryBehavior: { maxAttempts: 3, initialBackoffMs: 2000, base: 2 },
});
export const notificationEmailPool = new Workpool(components.notificationEmailWorkpool, {
  maxParallelism: 1,
  retryActionsByDefault: true,
  defaultRetryBehavior: { maxAttempts: 3, initialBackoffMs: 2000, base: 2 },
});
export async function queueNotifications(
  ctx: MutationCtx,
  userId: Id<"users">,
  source: Doc<"notices"> | Doc<"consentRequests">,
) {
  const notice = "urgent" in source ? source : null;
  const tokens = await ctx.db
    .query("pushTokens")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(11);
  if (tokens.length > 10) throw new Error("Device registration limit exceeded.");
  const channels: { channel: "Push" | "Email"; pushTokenId?: Id<"pushTokens"> }[] = tokens.length
    ? tokens.map((p) => ({ channel: "Push", pushTokenId: p._id }))
    : [{ channel: "Push" }];
  if (!notice || notice.urgent) channels.push({ channel: "Email" });
  const revision = notice ? (notice.revision ?? 0) : (source as Doc<"consentRequests">).dueAt;
  for (const c of channels) {
    const key = `${source._id}:${revision}:${userId}:${c.channel}:${c.pushTokenId ?? "none"}`;
    if (
      await ctx.db
        .query("notificationDeliveries")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique()
    )
      continue;
    const deliveryId = await ctx.db.insert("notificationDeliveries", {
      key,
      userId,
      ...c,
      kind: notice ? "Notice" : "ConsentReminder",
      revision,
      ...(notice
        ? { noticeId: notice._id }
        : { consentRequestId: source._id as Id<"consentRequests"> }),
      state: "Pending",
      run: 0,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.notificationJobs.dispatch, { deliveryId });
  }
}
