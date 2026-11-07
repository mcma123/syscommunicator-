import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { loadActor } from "./auth";
import { matchesAudience } from "./audiences";
import { checkActive } from "../authPolicy";

/** Johannesburg has a fixed UTC+2 offset. Equal endpoints mean no quiet interval. */
export function nextNotificationTime(now: number, start?: string, end?: string) {
  if (!start || !end || start === end) return now;
  const valid = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  if (!valid(start) || !valid(end)) return now + 86400000;
  const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const day = Math.floor((now + 7200000) / 86400000) * 86400000 - 7200000;
  const current = (now - day) / 60000,
    from = minutes(start),
    to = minutes(end);
  const quiet = from < to ? current >= from && current < to : current >= from || current < to;
  return quiet ? day + to * 60000 + (from > to && current >= from ? 86400000 : 0) : now;
}
export async function notificationAudience(
  ctx: QueryCtx,
  delivery: Doc<"notificationDeliveries">,
  now: number,
) {
  const user = await ctx.db.get("users", delivery.userId);
  try {
    checkActive(user);
  } catch {
    return null;
  }
  if (!user) return null;
  const actor = await loadActor(ctx, user);
  if (delivery.kind === "Notice") {
    const n = delivery.noticeId ? await ctx.db.get("notices", delivery.noticeId) : null;
    if (
      !n ||
      n.status !== "Published" ||
      (n.revision ?? 0) !== delivery.revision ||
      actor.disabledModules?.includes("messages") ||
      !(await matchesAudience(ctx, actor, n.audiences, "guardian"))
    )
      return null;
    return { actor, category: n.category, urgent: n.urgent };
  }
  const f = delivery.consentRequestId
    ? await ctx.db.get("consentRequests", delivery.consentRequestId)
    : null;
  if (
    !f ||
    f.status !== "Open" ||
    f.dueAt <= now ||
    f.dueAt !== delivery.revision ||
    actor.disabledModules?.includes("forms")
  )
    return null;
  for (const learner of actor.learners) {
    if (!(await matchesAudience(ctx, { ...actor, learners: [learner] }, f.audiences, "guardian")))
      continue;
    const response = await ctx.db
      .query("consentResponses")
      .withIndex("by_consentRequestId_and_learnerId", (q) =>
        q.eq("consentRequestId", f._id).eq("learnerId", learner._id),
      )
      .unique();
    if (!response) return { actor, category: "Events" as const, urgent: false };
  }
  return null;
}
