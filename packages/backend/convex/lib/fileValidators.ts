import { v } from "convex/values";
export const fileTarget = v.object({
  kind: v.union(
    v.literal("notice"),
    v.literal("resource"),
    v.literal("report"),
    v.literal("receipt"),
    v.literal("ad"),
  ),
  id: v.string(),
  slot: v.optional(v.number()),
});
export const uploadSpec = v.object({
  kind: v.union(v.literal("notice"), v.literal("resource"), v.literal("report"), v.literal("ad")),
  targetId: v.optional(v.string()),
  values: v.record(v.string(), v.string()),
});
