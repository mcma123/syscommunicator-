import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

const visibleSources = new Set([
  "users",
  "staffRoles",
  "guardianLinks",
  "learners",
  "classes",
  "grades",
  "teachingAssignments",
  "groups",
  "groupMembers",
  "notices",
  "events",
  "resources",
  "consentRequests",
  "consentResponses",
  "charges",
  "payments",
  "receipts",
  "reports",
  "attendanceRegisters",
  "attendanceMarks",
  "conductEntries",
  "timetablePeriods",
  "schools",
]);
export async function invalidateDashboard(
  ctx: MutationCtx,
  targetTable: string,
  userId?: Id<"users">,
) {
  if (targetTable === "noticeReceipts" && userId) {
    const user = await ctx.db.get("users", userId);
    if (user)
      await ctx.db.patch("users", userId, { dashboardRevision: (user.dashboardRevision ?? 0) + 1 });
  } else if (visibleSources.has(targetTable)) {
    const version = await ctx.db
      .query("dashboardVersions")
      .withIndex("by_key", (q) => q.eq("key", "sources"))
      .unique();
    if (version)
      await ctx.db.patch("dashboardVersions", version._id, { revision: version.revision + 1 });
    else await ctx.db.insert("dashboardVersions", { key: "sources", revision: 1 });
  }
}
