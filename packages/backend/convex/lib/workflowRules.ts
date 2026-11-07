import { ConvexError } from "convex/values";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { denied, missing, wholeSchool, hasRole, requireTeacherOf, type Actor } from "./auth";
export function invalid(message: string): never {
  throw new ConvexError({ code: "VALIDATION", message });
}
export function text(values: Record<string, string>, key: string, max = 200, optional = false) {
  const value = (values[key] ?? "").trim();
  if ((!optional && !value) || value.length > max)
    invalid(`${key}: enter ${optional ? "at most" : "1 to"} ${max} characters.`);
  return value;
}
export function option<T extends string>(
  values: Record<string, string>,
  key: string,
  options: readonly T[],
): T {
  const value = values[key];
  if (!options.includes(value as T)) invalid(`Choose a valid ${key}.`);
  return value as T;
}
export function toggle(values: Record<string, string>, key: string) {
  return option(values, key, ["true", "false"]) === "true";
}
export function date(values: Record<string, string>, key: string) {
  const value = text(values, key, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value
  )
    invalid("Enter a valid calendar date.");
  return value;
}
export function instant(values: Record<string, string>, key: string) {
  const value = text(values, key, 16);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    invalid("Use YYYY-MM-DDTHH:mm in Johannesburg time.");
  const at = Date.parse(value + ":00+02:00");
  if (!Number.isFinite(at) || localTime(at) !== value) invalid("Enter a valid date and time.");
  return at;
}
export function localTime(at: number) {
  return new Date(at + 7200000).toISOString().slice(0, 16);
}
export function id<T extends TableNames>(
  ctx: QueryCtx,
  table: T,
  value: string | undefined,
): Id<T> {
  const result = value ? ctx.db.normalizeId(table, value) : null;
  if (!result) invalid(`Choose a valid ${table} record.`);
  return result;
}
export async function get<T extends TableNames>(
  ctx: QueryCtx,
  table: T,
  value: string | undefined,
) {
  const row = await ctx.db.get(table, id(ctx, table, value));
  if (!row) missing();
  return row;
}
export function administrator(actor: Actor) {
  if (!hasRole(actor, "Administrator")) denied();
}
export function academic(actor: Actor) {
  if (!wholeSchool(actor) && !hasRole(actor, "Teacher")) denied();
}
export async function learnerWriter(ctx: QueryCtx, actor: Actor, learnerId: Id<"learners">) {
  academic(actor);
  const learner = await ctx.db.get("learners", learnerId);
  if (!learner || learner.status !== "Active") missing();
  await requireTeacherOf(ctx, learner.classId, actor);
  return learner;
}
export async function audiences(
  ctx: QueryCtx,
  actor: Actor,
  raw: string,
): Promise<Doc<"notices">["audiences"]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    invalid("Choose an audience.");
  }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 20)
    invalid("Choose 1 to 20 audiences.");
  const result: Doc<"notices">["audiences"] = [];
  for (const entry of parsed as unknown[]) {
    if (!entry || typeof entry !== "object") invalid("Invalid audience.");
    const target = entry as Record<string, unknown>;
    const reference = (key: string) =>
      typeof target[key] === "string" ? (target[key] as string) : undefined;
    if (target["kind"] === "School") {
      if (!wholeSchool(actor)) denied();
      result.push({ kind: "School" });
    } else if (target["kind"] === "Class") {
      const c = await get(ctx, "classes", reference("classId"));
      await requireTeacherOf(ctx, c._id, actor);
      result.push({ kind: "Class", classId: c._id });
    } else if (target["kind"] === "Grade") {
      if (!wholeSchool(actor)) denied();
      const g = await get(ctx, "grades", reference("gradeId"));
      result.push({ kind: "Grade", gradeId: g._id });
    } else if (target["kind"] === "Group") {
      if (!wholeSchool(actor)) denied();
      const g = await get(ctx, "groups", reference("groupId"));
      result.push({ kind: "Group", groupId: g._id });
    } else invalid("Invalid audience.");
  }
  return result;
}
export const FEATURE_MODULES = [
  "messages",
  "calendar",
  "resources",
  "forms",
  "contact",
  "payments",
  "reports",
  "conduct",
  "attendance",
  "groups",
] as const;
export function keys(values: Record<string, string>, allowed: readonly string[]) {
  for (const key of Object.keys(values))
    if (!allowed.includes(key)) invalid(`Unexpected field: ${key}`);
}
