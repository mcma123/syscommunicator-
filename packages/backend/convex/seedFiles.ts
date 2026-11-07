import { initialState } from "@school-connect/core";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireSeedDeployment } from "./seedSupport";

/** Real UTF-8 sample files, not the school's PDFs or claimed mock file sizes. */
export const run = internalAction({
  args: {},
  returns: v.record(v.string(), v.number()),
  handler: async (ctx): Promise<Record<string, number>> => {
    requireSeedDeployment();
    await ctx.runQuery(internal.seed.preflight, {});
    const existing: { key: string; file: Doc<"resources">["file"] }[] = await ctx.runQuery(
      internal.seed.files,
      {},
    );
    const samples = [
      ...initialState.resources.map((r) => ({
        key: `resource:${r.title}`,
        title: r.title,
        body: "Development resource preview only.",
      })),
      ...initialState.notices
        .filter((n) => n.attachment)
        .map((n) => ({ key: `notice:${n.id}`, title: n.attachment!, body: n.body })),
    ];
    for (const sample of samples) {
      const key = `file:${sample.key}`;
      if (existing.some((f) => f.key === key)) continue;
      const content = new Blob(
        [
          `SAMPLE - FICTIONAL DEVELOPMENT DOCUMENT\n${sample.title}\n\n${sample.body}\n\nThis is not an actual school document.\n`,
        ],
        { type: "text/plain" },
      );
      const storageId = await ctx.storage.store(content);
      let claimed: Doc<"resources">["file"];
      try {
        claimed = await ctx.runMutation(internal.seed.claimFile, {
          key,
          file: {
            storageId,
            fileName: `${sample.title.replace(/\.pdf$/i, "")}.sample.txt`,
            contentType: "text/plain",
            size: content.size,
          },
        });
      } catch (error) {
        await ctx.storage.delete(storageId);
        throw error;
      }
      // A concurrent seed may have registered its own file first.
      if (claimed.storageId !== storageId) await ctx.storage.delete(storageId);
    }
    const counts: Record<string, number> = await ctx.runMutation(internal.seed.run, {});
    return counts;
  },
});
