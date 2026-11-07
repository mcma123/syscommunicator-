import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { hasRole, wholeSchool, type Actor } from "./auth";

export async function matchesAudience(
  ctx: QueryCtx,
  actor: Actor,
  audiences: Doc<"notices">["audiences"],
  mode: "guardian" | "teacher",
) {
  if (audiences.length > 20) return false;
  if (mode === "guardian" && actor.learners.length === 0) return false;
  if (mode === "teacher" && !hasRole(actor, "Teacher")) return false;
  for (const audience of audiences) {
    if (audience.kind === "School") return true;
    if (
      audience.kind === "Grade" &&
      (mode === "guardian"
        ? actor.learners.some((l) => l.gradeId === audience.gradeId)
        : actor.teachingClasses.some((c) => c.gradeId === audience.gradeId))
    )
      return true;
    if (
      audience.kind === "Class" &&
      (mode === "guardian"
        ? actor.learners.some((l) => l.classId === audience.classId)
        : actor.teachingClasses.some((c) => c._id === audience.classId))
    )
      return true;
    if (audience.kind === "Group") {
      const group = await ctx.db.get("groups", audience.groupId);
      if (
        group &&
        (await ctx.db
          .query("groupMembers")
          .withIndex("by_groupId_and_userId", (q) =>
            q.eq("groupId", audience.groupId).eq("userId", actor.user._id),
          )
          .first())
      )
        return true;
    }
  }
  return false;
}
export async function canReadNotice(ctx: QueryCtx, actor: Actor, notice: Doc<"notices">) {
  if (wholeSchool(actor)) return true;
  if (
    notice.status === "Published" &&
    (await matchesAudience(ctx, actor, notice.audiences, "guardian"))
  )
    return true;
  if (
    !hasRole(actor, "Teacher") ||
    !(await matchesAudience(ctx, actor, notice.audiences, "teacher"))
  )
    return false;
  return notice.status === "Published" || notice.authorId === actor.user._id;
}

/** Staff receipt/delivery management must never inherit a guardian read grant. */
export function canManageNotice(actor: Actor, notice: Doc<"notices">) {
  if (wholeSchool(actor)) return true;
  return (
    hasRole(actor, "Teacher") &&
    notice.authorId === actor.user._id &&
    notice.audiences.length > 0 &&
    notice.audiences.length <= 20 &&
    notice.audiences.every(
      (a) => a.kind === "Class" && actor.teachingClasses.some((c) => c._id === a.classId),
    )
  );
}
