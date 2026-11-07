import { ConvexError } from "convex/values";
import {
  accessRolesFor,
  canAccessModule,
  type SchoolModule,
} from "@school-connect/core/permissions";
import type { StaffRole } from "@school-connect/core/domain";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { requireSession } from "../authPolicy";

export const MEMBERSHIP_LIMIT = 100;
export interface Actor {
  user: Doc<"users">;
  roles: StaffRole[];
  learners: Doc<"learners">[];
  teachingClasses: Doc<"classes">[];
  disabledModules?: string[];
}
export function denied(): never {
  throw new ConvexError({ code: "FORBIDDEN", message: "You cannot access this record or module." });
}
export function missing(): never {
  throw new ConvexError({ code: "NOT_FOUND", message: "Record not found." });
}
export const requireUser = requireSession;
export async function requireActor(ctx: QueryCtx): Promise<Actor> {
  const user = await requireUser(ctx);
  return loadActor(ctx, user);
}
/** Internal grant redemption supplies a validated, live session user. */
export async function loadActor(ctx: QueryCtx, user: Doc<"users">): Promise<Actor> {
  const roleRows = await ctx.db
    .query("staffRoles")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .take(5);
  const links = await ctx.db
    .query("guardianLinks")
    .withIndex("by_guardianId", (q) => q.eq("guardianId", user._id))
    .take(21);
  const assignments = await ctx.db
    .query("teachingAssignments")
    .withIndex("by_staffId", (q) => q.eq("staffId", user._id))
    .take(MEMBERSHIP_LIMIT + 1);
  if (roleRows.length > 4 || links.length > 20 || assignments.length > MEMBERSHIP_LIMIT) denied();
  const learners: Doc<"learners">[] = [];
  for (const link of links) {
    const learner = await ctx.db.get("learners", link.learnerId);
    if (learner?.status === "Active") learners.push(learner);
  }
  const teachingClasses: Doc<"classes">[] = [];
  for (const classId of new Set(assignments.map((a) => a.classId))) {
    const classroom = await ctx.db.get("classes", classId);
    if (classroom) teachingClasses.push(classroom);
  }
  const school = await ctx.db.query("schools").take(1);
  return {
    user,
    roles: roleRows.map((r) => r.role),
    learners,
    teachingClasses,
    disabledModules: Object.keys(school[0]?.featureFlags ?? {}).filter(
      (key) => school[0]?.featureFlags[key] === false,
    ),
  };
}
export function hasRole(actor: Actor, ...roles: StaffRole[]) {
  return actor.roles.some((role) => roles.includes(role));
}
export function requireModule(actor: Actor, module: SchoolModule) {
  if (actor.disabledModules?.includes(module)) denied();
  if (!canAccessModule(accessRolesFor(actor.roles, actor.learners.length > 0), module)) denied();
}
export async function requireRole(ctx: QueryCtx, ...roles: StaffRole[]): Promise<Actor> {
  const actor = await requireActor(ctx);
  if (!hasRole(actor, ...roles)) denied();
  return actor;
}
export async function requireAdministrator(ctx: QueryCtx) {
  return (await requireRole(ctx, "Administrator")).user;
}
export function wholeSchool(actor: Actor) {
  return hasRole(actor, "Administrator", "Principal");
}
export async function requireGuardianOf(ctx: QueryCtx, learnerId: Id<"learners">, actor?: Actor) {
  const caller = actor ?? (await requireActor(ctx));
  const learner = await ctx.db.get("learners", learnerId);
  if (!learner) missing();
  if (learner.status !== "Active" || !caller.learners.some((l) => l._id === learnerId)) denied();
  return learner;
}
export async function requireTeacherOf(ctx: QueryCtx, classId: Id<"classes">, actor?: Actor) {
  const caller = actor ?? (await requireActor(ctx));
  const classroom = await ctx.db.get("classes", classId);
  if (!classroom) missing();
  if (
    !wholeSchool(caller) &&
    (!hasRole(caller, "Teacher") || !caller.teachingClasses.some((c) => c._id === classId))
  )
    denied();
  return classroom;
}
export async function requireLearnerAccess(ctx: QueryCtx, learnerId: Id<"learners">, actor: Actor) {
  const learner = await ctx.db.get("learners", learnerId);
  if (!learner) missing();
  if (wholeSchool(actor)) return learner;
  if (hasRole(actor, "Teacher") && actor.teachingClasses.some((c) => c._id === learner.classId))
    return learner;
  return requireGuardianOf(ctx, learnerId, actor);
}
