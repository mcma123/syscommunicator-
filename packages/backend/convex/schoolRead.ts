import { v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { authedQuery } from "./lib/functions";
import { readArgs, readModule, readPage, readDetail } from "./lib/read";
import { recordValidator } from "./schoolData";

export const targetId = v.union(
  v.id("invitations"),
  v.id("noticeReceipts"),
  v.id("schools"),
  v.id("notices"),
  v.id("events"),
  v.id("learners"),
  v.id("resources"),
  v.id("charges"),
  v.id("payments"),
  v.id("consentRequests"),
  v.id("consentResponses"),
  v.id("enquiries"),
  v.id("enquiryMessages"),
  v.id("groups"),
  v.id("classes"),
  v.id("attendanceRegisters"),
  v.id("attendanceMarks"),
  v.id("conductEntries"),
  v.id("reports"),
  v.id("timetablePeriods"),
  v.id("users"),
  v.id("auditLog"),
);
export const detailValidator = v.object({
  record: recordValidator,
  related: v.array(
    v.object({
      module: readModule,
      title: v.string(),
      learnerId: v.optional(v.string()),
      parentId: v.optional(v.string()),
    }),
  ),
});
export const page = authedQuery({
  args: { ...readArgs, paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(recordValidator),
  handler: (ctx, args) => readPage(ctx, ctx.actor, args, args.paginationOpts),
});
export const detail = authedQuery({
  args: { ...readArgs, itemId: targetId },
  returns: detailValidator,
  handler: (ctx, args) => readDetail(ctx, ctx.actor, args, args.itemId),
});
