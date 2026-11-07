import { getAuthSessionId } from "@convex-dev/auth/server";
import { v, type Infer } from "convex/values";
import { env, internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import schema from "./schema";
import { authedAction, authedMutation, authedQuery } from "./lib/functions";
import { requireActor, loadActor, denied, wholeSchool } from "./lib/auth";
import { checkActive, hashInvitation } from "./authPolicy";
import {
  accessibleFile,
  fileTarget,
  uploadSpec,
  uploadPermission,
  validateFile,
  validateSignature,
} from "./lib/fileRules";
import { audiences, get, invalid, text } from "./lib/workflowRules";
import { writeAudit } from "./lib/audit";
import type { Doc, Id } from "./_generated/dataModel";
import type { ResourceCategory } from "@school-connect/core/domain";

const DAY = 86400000;
function digestHex(value: string) {
  if (/^[a-f0-9]{64}$/i.test(value)) return value.toLowerCase();
  try {
    return Array.from(atob(value), (c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
}
const downloadResult = v.object({
  url: v.string(),
  expiresAt: v.number(),
  name: v.string(),
  contentType: v.string(),
});
export const beginUpload = authedMutation({
  args: {
    spec: uploadSpec,
    fileName: v.string(),
    contentType: v.string(),
    size: v.number(),
    sha256: v.string(),
  },
  returns: v.object({ uploadId: v.id("fileUploads"), uploadUrl: v.string() }),
  handler: async (ctx, args) => {
    await uploadPermission(ctx, ctx.actor, args.spec);
    validateFile(args.fileName, args.contentType, args.size, args.spec.kind === "report");
    if (!/^[a-f0-9]{64}$/.test(args.sha256)) invalid("Invalid file digest.");
    const sessionId = await getAuthSessionId(ctx);
    if (!sessionId) denied();
    const uploadId = await ctx.db.insert("fileUploads", {
      ...args,
      userId: ctx.actor.user._id,
      sessionId,
      expiresAt: Date.now() + 3600000,
    });
    const uploadUrl = await ctx.storage.generateUploadUrl();
    await ctx.audit("file.uploadRequested", "fileUploads", uploadId);
    return { uploadId, uploadUrl };
  },
});
async function ownUpload(ctx: QueryCtx, uploadId: Id<"fileUploads">, now: number) {
  const actor = await requireActor(ctx),
    u = await get(ctx, "fileUploads", uploadId);
  if (
    u.userId !== actor.user._id ||
    u.sessionId !== (await getAuthSessionId(ctx)) ||
    u.expiresAt <= now
  )
    denied();
  await uploadPermission(ctx, actor, u.spec, !u.resultId);
  return { actor, u };
}
export const uploadContext = internalQuery({
  args: { uploadId: v.id("fileUploads"), now: v.number() },
  returns: schema.doc("fileUploads"),
  handler: async (ctx, { uploadId, now }) => (await ownUpload(ctx, uploadId, now)).u,
});
// Register the uploaded object before inspecting bytes, so rejected/abandoned uploads can be reclaimed.
export const claimUpload = authedMutation({
  args: { uploadId: v.id("fileUploads"), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { uploadId, storageId }) => {
    const { u } = await ownUpload(ctx, uploadId, Date.now());
    if (u.resultId || (u.storageId && u.storageId !== storageId))
      invalid("This upload has already been used.");
    const metadata = await ctx.db.system.get("_storage", storageId);
    if (
      !metadata ||
      metadata._creationTime < u._creationTime ||
      metadata.size !== u.size ||
      metadata.contentType !== u.contentType ||
      digestHex(metadata.sha256) !== u.sha256
    )
      invalid("Upload metadata does not match.");
    if (
      await ctx.db
        .query("managedFiles")
        .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
        .unique()
    )
      denied();
    const other = await ctx.db
      .query("fileUploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .unique();
    if (other && other._id !== u._id) denied();
    // The digest is verified by the action before saving; never attach a caller-selected object directly.
    await ctx.db.patch("fileUploads", u._id, { storageId });
    await ctx.audit("file.uploadClaimed", "fileUploads", u._id);
    return null;
  },
});
export const finishUpload = authedAction({
  args: { uploadId: v.id("fileUploads") },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const u: Doc<"fileUploads"> = await ctx.runQuery(internal.files.uploadContext, {
      ...args,
      now: Date.now(),
    });
    if (u.resultId) return u.resultId;
    if (!u.storageId) invalid("Upload the file first.");
    const blob = await ctx.storage.get(u.storageId);
    if (!blob || blob.size !== u.size || blob.type !== u.contentType)
      invalid("File upload is incomplete.");
    const bytes = await blob.arrayBuffer();
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    if (digest !== u.sha256) invalid("File contents changed during upload.");
    validateSignature(new Uint8Array(bytes), u.contentType);
    // The final storage reference is created server-side and never returned to the uploader.
    const storageId = await ctx.storage.store(new Blob([bytes], { type: u.contentType }));
    try {
      const result: { id: string; created: boolean } = await ctx.runMutation(
        internal.files.saveUpload,
        { ...args, storageId },
      );
      if (!result.created) await ctx.storage.delete(storageId);
      await ctx.storage.delete(u.storageId);
      return result.id;
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }
  },
});
export const saveUpload = internalMutation({
  args: { uploadId: v.id("fileUploads"), storageId: v.id("_storage") },
  returns: v.object({ id: v.string(), created: v.boolean() }),
  handler: async (ctx, args) => {
    const { actor, u } = await ownUpload(ctx, args.uploadId, Date.now());
    if (u.resultId) return { id: u.resultId, created: false };
    const meta = await ctx.db.system.get("_storage", args.storageId);
    if (!meta || meta.size !== u.size || meta.contentType !== u.contentType)
      invalid("Invalid stored file.");
    const file = {
      storageId: args.storageId,
      fileName: u.fileName,
      contentType: u.contentType,
      size: u.size,
    };
    let target: Infer<typeof fileTarget>;
    if (u.spec.kind === "report") {
      const learner = await get(ctx, "learners", u.spec.values["learnerId"]);
      const digestBytes = Array.from(u.sha256.match(/../g) ?? [], (b) => parseInt(b, 16));
      const uploadHash = await hashInvitation(
        JSON.stringify([
          learner._id,
          text(u.spec.values, "title"),
          text(u.spec.values, "term", 100),
          digestBytes,
        ]),
      );
      const prior = await ctx.db
        .query("reports")
        .withIndex("by_uploadedBy_and_uploadHash", (q) =>
          q.eq("uploadedBy", actor.user._id).eq("uploadHash", uploadHash),
        )
        .unique();
      if (prior) {
        await ctx.db.patch("fileUploads", u._id, { resultId: prior._id });
        await writeAudit(ctx, actor, "file.uploadReused", "fileUploads", u._id);
        return { id: prior._id, created: false };
      }
      const id = await ctx.db.insert("reports", {
        uploadHash,
        learnerId: learner._id,
        title: text(u.spec.values, "title"),
        term: text(u.spec.values, "term", 100),
        status: "Draft",
        uploadedBy: actor.user._id,
        file,
      });
      target = { kind: "report", id };
    } else if (u.spec.kind === "notice") {
      const n = await get(ctx, "notices", u.spec.targetId);
      target = { kind: "notice", id: n._id, slot: n.attachments.length };
      await ctx.db.patch("notices", n._id, {
        attachments: [...n.attachments, file],
        revision: (n.revision ?? 0) + 1,
        updatedAt: Date.now(),
      });
    } else {
      const id = await ctx.db.insert("resources", {
        title: text(u.spec.values, "title"),
        description: text(u.spec.values, "description", 10000, true),
        category: u.spec.values["category"] as ResourceCategory,
        audiences: await audiences(ctx, actor, u.spec.values["audience"] ?? ""),
        status: "Draft",
        publishedBy: actor.user._id,
        updatedAt: Date.now(),
        file,
      });
      target = { kind: "resource", id };
    }
    await ctx.db.insert("managedFiles", { storageId: args.storageId, target });
    await ctx.db.patch("fileUploads", u._id, { resultId: target.id });
    await writeAudit(
      ctx,
      actor,
      "file.attached",
      u.spec.kind === "notice" ? "notices" : u.spec.kind === "report" ? "reports" : "resources",
      target.id,
    );
    return { id: target.id, created: true };
  },
});
export const prepareDownload = authedAction({
  args: { target: fileTarget },
  returns: v.object({ grantId: v.id("fileGrants"), token: v.string() }),
  handler: async (ctx, { target }): Promise<{ grantId: Id<"fileGrants">; token: string }> => {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const grantId: Id<"fileGrants"> = await ctx.runMutation(internal.files.createGrant, {
      target,
      tokenHash: await hashInvitation(token),
    });
    return { grantId, token };
  },
});
export const createGrant = internalMutation({
  args: { target: fileTarget, tokenHash: v.string() },
  returns: v.id("fileGrants"),
  handler: async (ctx, { target, tokenHash }) => {
    const actor = await requireActor(ctx),
      file = await accessibleFile(ctx, actor, target),
      sessionId = await getAuthSessionId(ctx);
    if (!sessionId) denied();
    if (!(await ctx.db.system.get("_storage", file.storageId))) invalid("File unavailable.");
    return ctx.db.insert("fileGrants", {
      target,
      tokenHash,
      storageId: file.storageId,
      sessionId,
      userId: actor.user._id,
      expiresAt: Date.now() + 120000,
    });
  },
});
export const downloadUrl = authedQuery({
  args: { grantId: v.id("fileGrants"), token: v.string(), now: v.number() },
  returns: downloadResult,
  handler: async (ctx, { grantId, token, now }) => {
    const g = await get(ctx, "fileGrants", grantId);
    if (
      g.userId !== ctx.actor.user._id ||
      g.sessionId !== (await getAuthSessionId(ctx)) ||
      g.expiresAt <= now ||
      token.length !== 64 ||
      (await hashInvitation(token)) !== g.tokenHash
    )
      denied();
    const file = await accessibleFile(ctx, ctx.actor, g.target);
    if (file.storageId !== g.storageId) denied();
    return {
      url: `${env.CONVEX_SITE_URL}/files/download?token=${token}`,
      expiresAt: g.expiresAt,
      name: file.fileName,
      contentType: file.contentType,
    };
  },
});
export const redeem = internalQuery({
  args: { tokenHash: v.string(), now: v.number() },
  returns: v.object({
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.string(),
    size: v.number(),
  }),
  handler: async (ctx, { tokenHash, now }) => {
    const g = await ctx.db
      .query("fileGrants")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!g || g.expiresAt <= now) denied();
    const session = await ctx.db.get("authSessions", g.sessionId),
      user = await ctx.db.get("users", g.userId);
    checkActive(user);
    if (
      !session ||
      !user ||
      session.userId !== user._id ||
      session.expirationTime <= now ||
      (user.sessionsValidAfter !== undefined && session._creationTime <= user.sessionsValidAfter)
    )
      denied();
    const file = await accessibleFile(ctx, await loadActor(ctx, user), g.target);
    if (file.storageId !== g.storageId) denied();
    return file;
  },
});
export const resourceStatus = authedMutation({
  args: { resourceId: v.id("resources"), publish: v.boolean() },
  returns: v.string(),
  handler: async (ctx, { resourceId, publish }) => {
    const r = await get(ctx, "resources", resourceId);
    await accessibleFile(ctx, ctx.actor, { kind: "resource", id: resourceId });
    if (!wholeSchool(ctx.actor)) denied();
    if (publish && r.status !== "Draft") invalid("Only draft resources can be published.");
    await ctx.db.patch("resources", r._id, {
      status: publish ? "Published" : "Archived",
      updatedAt: Date.now(),
    });
    await ctx.audit(publish ? "resource.published" : "resource.archived", "resources", r._id);
    return r._id;
  },
});
export const removeAttachment = authedMutation({
  args: { noticeId: v.id("notices"), slot: v.number() },
  returns: v.string(),
  handler: async (ctx, { noticeId, slot }) => {
    await uploadPermission(
      ctx,
      ctx.actor,
      { kind: "notice", targetId: noticeId, values: {} },
      false,
    );
    const n = await get(ctx, "notices", noticeId);
    const file = await accessibleFile(ctx, ctx.actor, { kind: "notice", id: noticeId, slot });
    const managed = await ctx.db
      .query("managedFiles")
      .withIndex("by_storageId", (q) => q.eq("storageId", file.storageId))
      .unique();
    if (managed) await ctx.db.patch("managedFiles", managed._id, { detachedAt: Date.now() });
    await ctx.db.patch("notices", n._id, {
      attachments: n.attachments.filter((_, i) => i !== slot),
      revision: (n.revision ?? 0) + 1,
      updatedAt: Date.now(),
    });
    await ctx.audit("notice.attachmentRemoved", "notices", n._id);
    return n._id;
  },
});
/** Bounded, conservative cleanup: preserve every unowned storage object. */
export const cleanup = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const grants = await ctx.db
      .query("fileGrants")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(100);
    for (const g of grants) await ctx.db.delete("fileGrants", g._id);
    const uploads = await ctx.db
      .query("fileUploads")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now - 3 * DAY))
      .take(25);
    for (const u of uploads) {
      if (u.storageId) await ctx.storage.delete(u.storageId);
      await ctx.db.delete("fileUploads", u._id);
    }
    const detached = await ctx.db
      .query("managedFiles")
      .withIndex("by_detachedAt", (q) => q.gt("detachedAt", 0).lt("detachedAt", now - DAY))
      .take(25);
    for (const m of detached) {
      // Notice slots may move. Check the complete bounded array before deleting.
      if (m.target.kind === "notice") {
        const id = ctx.db.normalizeId("notices", m.target.id);
        const n = id ? await ctx.db.get("notices", id) : null;
        if (n?.attachments.some((f) => f.storageId === m.storageId)) {
          await ctx.db.patch("managedFiles", m._id, { detachedAt: undefined });
          continue;
        }
      }
      await ctx.storage.delete(m.storageId);
      await ctx.db.delete("managedFiles", m._id);
    }
    if (grants.length === 100 || uploads.length === 25 || detached.length === 25)
      await ctx.scheduler.runAfter(0, internal.files.cleanup, {});
    return null;
  },
});
/** Lost upload responses have no claim row. Match only a declared digest and upload window; never sweep unknown files. */
export const sweepUploads = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const now = Date.now();
    const page = await ctx.db.system.query("_storage").paginate({ cursor, numItems: 25 });
    for (const file of page.page) {
      if (file._creationTime > now - DAY) continue;
      if (
        await ctx.db
          .query("managedFiles")
          .withIndex("by_storageId", (q) => q.eq("storageId", file._id))
          .unique()
      )
        continue;
      const leases = await ctx.db
        .query("fileUploads")
        .withIndex("by_sha256", (q) => q.eq("sha256", digestHex(file.sha256)))
        .take(101);
      if (leases.length === 0 || leases.length > 100) continue;
      const matches = leases.filter(
        (u) =>
          file._creationTime >= u._creationTime &&
          file._creationTime <= u.expiresAt &&
          file.size === u.size &&
          file.contentType === u.contentType,
      );
      if (matches.length && matches.every((u) => u.expiresAt < now - DAY))
        await ctx.storage.delete(file._id);
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.files.sweepUploads, { cursor: page.continueCursor });
    return null;
  },
});
