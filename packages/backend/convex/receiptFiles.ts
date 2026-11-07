import { v } from "convex/values";
import { renderReceipt } from "./lib/receiptPdf";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { authedAction } from "./lib/functions";
import { requireActor } from "./lib/auth";
import { receiptAccess } from "./lib/fileRules";
import { get, invalid } from "./lib/workflowRules";
import { writeAudit } from "./lib/audit";
import type { Id } from "./_generated/dataModel";

const receiptData = v.object({
  receiptNumber: v.string(),
  schoolName: v.string(),
  currency: v.string(),
  amountCents: v.number(),
  issuedAt: v.number(),
  title: v.string(),
  hasFile: v.boolean(),
});
export const context = internalQuery({
  args: { receiptId: v.id("receipts") },
  returns: receiptData,
  handler: async (ctx, { receiptId }) => {
    const r = await receiptAccess(ctx, await requireActor(ctx), receiptId);
    const p = await get(ctx, "payments", r.paymentId),
      c = await get(ctx, "charges", r.chargeId);
    if (
      p.status !== "Succeeded" ||
      p.chargeId !== r.chargeId ||
      p.payerId !== r.guardianId ||
      p.amountCents !== r.amountCents ||
      !Number.isSafeInteger(r.amountCents) ||
      r.amountCents <= 0
    )
      invalid("Only verified successful payments can have receipts.");
    const school = (await ctx.db.query("schools").take(1))[0];
    return {
      receiptNumber: r.receiptNumber,
      schoolName: school?.name ?? "Wynberg Girls Junior School",
      currency: school?.currency ?? "ZAR",
      amountCents: r.amountCents,
      issuedAt: r.issuedAt,
      title: c.title,
      hasFile: r.file?.contentType === "application/pdf",
    };
  },
});
export const attach = internalMutation({
  args: { receiptId: v.id("receipts"), storageId: v.id("_storage") },
  returns: v.boolean(),
  handler: async (ctx, { receiptId, storageId }) => {
    const actor = await requireActor(ctx),
      r = await receiptAccess(ctx, actor, receiptId);
    const p = await get(ctx, "payments", r.paymentId);
    if (
      p.status !== "Succeeded" ||
      p.chargeId !== r.chargeId ||
      p.payerId !== r.guardianId ||
      p.amountCents !== r.amountCents
    )
      invalid("Payment no longer supports this receipt.");
    if (r.file?.contentType === "application/pdf") return false;
    const m = await ctx.db.system.get("_storage", storageId);
    if (!m || m.contentType !== "application/pdf" || m.size > 2 * 1048576)
      invalid("Invalid receipt PDF.");
    await ctx.db.patch("receipts", receiptId, {
      file: {
        storageId,
        fileName: `receipt-${r.receiptNumber.replace(/[^a-z0-9-]/gi, "_")}.pdf`,
        contentType: "application/pdf",
        size: m.size,
      },
    });
    await ctx.db.insert("managedFiles", { storageId, target: { kind: "receipt", id: receiptId } });
    await writeAudit(ctx, actor, "receipt.pdfGenerated", "receipts", receiptId);
    return true;
  },
});
export const generate = authedAction({
  args: { receiptId: v.id("receipts") },
  returns: v.id("receipts"),
  handler: async (ctx, args): Promise<Id<"receipts">> => {
    const data: {
      receiptNumber: string;
      schoolName: string;
      currency: string;
      amountCents: number;
      issuedAt: number;
      title: string;
      hasFile: boolean;
    } = await ctx.runQuery(internal.receiptFiles.context, args);
    if (data.hasFile) return args.receiptId;
    const bytes = await renderReceipt(data);
    const storageId = await ctx.storage.store(
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" }),
    );
    try {
      if (!(await ctx.runMutation(internal.receiptFiles.attach, { ...args, storageId })))
        await ctx.storage.delete(storageId);
      return args.receiptId;
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }
  },
});
