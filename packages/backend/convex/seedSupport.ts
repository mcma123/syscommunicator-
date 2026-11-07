import type { WithoutSystemFields } from "convex/server";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { env, type MutationCtx, type QueryCtx } from "./_generated/server";
import schema from "./schema";

export const DEV_URL = "https://diligent-bass-226.convex.cloud";
export const MAX_ROWS = 500;
export const FIXTURE_DATE = Date.parse("2026-10-14T09:00:00+02:00");
export const TABLES = Object.keys(schema.tables) as TableNames[];

export function requireSeedDeployment() {
  if (env.CONVEX_CLOUD_URL !== DEV_URL) {
    throw new Error(
      "Fixture operations are restricted to dev:diligent-bass-226. Missing, production and unknown targets are blocked.",
    );
  }
}

export async function checkSchool(ctx: QueryCtx) {
  const schools = await ctx.db.query("schools").take(2);
  if (schools.length > 1 || (schools[0] && schools[0].name !== "Wynberg Girls Junior School")) {
    throw new Error("Conflicting school data; seed refused without changing records.");
  }
  return schools[0] ?? null;
}

/** Bounded development tooling only; deliberately not an application counter. */
export async function inventory(ctx: QueryCtx) {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const table of TABLES) {
    const rows = await ctx.db.query(table).take(MAX_ROWS + 1);
    total += rows.length;
    if (total > MAX_ROWS)
      throw new Error(
        `Development fixture operation exceeds ${MAX_ROWS} rows; no deletion performed.`,
      );
    counts[table] = rows.length;
  }
  return counts;
}

export async function fixture(ctx: QueryCtx, key: string) {
  return ctx.db
    .query("seedFixtures")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

export function single<T>(rows: T[], predicate: (row: T) => boolean): T | null {
  if (rows.length > MAX_ROWS) throw new Error("Fixture lookup exceeds development limit.");
  const matches = rows.filter(predicate);
  if (matches.length > 1) throw new Error("Ambiguous fixture match; no records changed.");
  return matches[0] ?? null;
}

/** Stable fixture keys preserve edits, including renamed records, between runs. */
export async function ensure<T extends Exclude<TableNames, "seedFixtures">>(
  ctx: MutationCtx,
  table: T,
  key: string,
  value: WithoutSystemFields<Doc<T>>,
  lookup: () => Promise<Doc<T> | null>,
): Promise<Id<T>> {
  const existing = await fixture(ctx, key);
  if (existing) {
    if (existing.target.kind !== "document" || existing.target.table !== table)
      throw new Error(`Conflicting fixture key: ${key}`);
    const id = ctx.db.normalizeId(table, existing.target.documentId);
    if (!id) throw new Error(`Invalid fixture reference: ${key}`);
    if (await ctx.db.get(table, id)) return id;
    await ctx.db.delete("seedFixtures", existing._id);
  }
  const matched = await lookup();
  const id = matched?._id ?? (await ctx.db.insert(table, value));
  await ctx.db.insert("seedFixtures", { key, target: { kind: "document", table, documentId: id } });
  return id;
}
