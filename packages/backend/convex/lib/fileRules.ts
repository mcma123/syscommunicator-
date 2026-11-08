import { type Infer } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { denied, hasRole, requireGuardianOf, requireModule, wholeSchool, type Actor } from "./auth";
import { canReadNotice, matchesAudience } from "./audiences";
import { audiences, get, invalid, keys, learnerWriter, text } from "./workflowRules";
import { RESOURCE_CATEGORIES } from "@school-connect/core/domain";

import { fileTarget, uploadSpec } from "./fileValidators";
export { fileTarget, uploadSpec } from "./fileValidators";
export const MAX_PDF = 10 * 1024 * 1024;
export const MAX_IMAGE = 5 * 1024 * 1024;
/** Ad videos stay small: finalization holds the bytes in action memory about twice. */
export const MAX_VIDEO = 15 * 1024 * 1024;
export const AD_MEDIA_TYPES = ["image/png", "image/jpeg", "video/mp4", "video/webm"] as const;
export const isVideo = (contentType: string) => contentType.startsWith("video/");
type FileKind = "report" | "ad" | "other";
export function validateFile(
  name: string,
  contentType: string,
  size: number,
  kind: FileKind = "other",
) {
  if (!name.trim() || name.length > 150 || /[\x00-\x1f/\\]/.test(name))
    invalid("Choose a file with a safe name, up to 150 characters.");
  const ext =
    contentType === "application/pdf"
      ? /\.pdf$/i
      : contentType === "image/png"
        ? /\.png$/i
        : contentType === "image/jpeg"
          ? /\.jpe?g$/i
          : contentType === "video/mp4"
            ? /\.mp4$/i
            : contentType === "video/webm"
              ? /\.webm$/i
              : null;
  if (kind === "ad") {
    if (!ext?.test(name) || !(AD_MEDIA_TYPES as readonly string[]).includes(contentType))
      invalid("Choose a PNG or JPEG image, or an MP4 or WebM video.");
  } else if (
    !ext?.test(name) ||
    isVideo(contentType) ||
    (kind === "report" && contentType !== "application/pdf")
  )
    invalid("Choose a PDF, PNG or JPEG (reports require PDF).");
  const max =
    contentType === "application/pdf" ? MAX_PDF : isVideo(contentType) ? MAX_VIDEO : MAX_IMAGE;
  if (!Number.isSafeInteger(size) || size < 5 || size > max)
    invalid(
      kind === "ad"
        ? "Images may be up to 5 MiB; videos up to 15 MiB."
        : "PDFs may be up to 10 MiB; images up to 5 MiB.",
    );
}
export function validateSignature(bytes: Uint8Array, type: string) {
  const ok =
    type === "application/pdf"
      ? new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-"
      : type === "image/png"
        ? [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
        : type === "image/jpeg"
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : type === "video/mp4"
            ? new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp"
            : type === "video/webm" && [0x1a, 0x45, 0xdf, 0xa3].every((b, i) => bytes[i] === b);
  if (!ok) invalid("The file contents do not match its declared type.");
}
export async function uploadPermission(
  ctx: QueryCtx,
  actor: Actor,
  spec: Infer<typeof uploadSpec>,
  checkCapacity = true,
) {
  if (spec.kind === "report") {
    keys(spec.values, ["learnerId", "title", "term", "file"]);
    requireModule(actor, "reports");
    const l = await get(ctx, "learners", spec.values["learnerId"]);
    await learnerWriter(ctx, actor, l._id);
    text(spec.values, "title");
    text(spec.values, "term", 100);
  } else if (spec.kind === "notice") {
    keys(spec.values, ["file"]);
    requireModule(actor, "messages");
    const n = await get(ctx, "notices", spec.targetId);
    if (
      n.status !== "Draft" ||
      (!wholeSchool(actor) && (!hasRole(actor, "Teacher") || n.authorId !== actor.user._id))
    )
      denied();
    await audiences(ctx, actor, JSON.stringify(n.audiences));
    if (checkCapacity && n.attachments.length >= 10)
      invalid("A notice can have up to 10 attachments.");
  } else if (spec.kind === "ad") {
    keys(spec.values, ["file"]);
    const ad = await get(ctx, "ads", spec.targetId);
    await adEditor(ctx, actor, ad);
    if (ad.status !== "Draft" && ad.status !== "Review")
      invalid("Return this ad to draft before replacing its media.");
  } else {
    keys(spec.values, ["title", "description", "category", "audience", "file"]);
    requireModule(actor, "resources");
    if (!wholeSchool(actor) && !hasRole(actor, "Teacher")) denied();
    text(spec.values, "title");
    text(spec.values, "description", 10000, true);
    if (
      !RESOURCE_CATEGORIES.includes(spec.values["category"] as (typeof RESOURCE_CATEGORIES)[number])
    )
      invalid("Choose a resource category.");
    await audiences(ctx, actor, spec.values["audience"] ?? "");
  }
}
/** Ad managers: whole-school staff, or the creating Teacher while they still teach the ad's classes. */
export async function adEditor(ctx: QueryCtx, actor: Actor, ad: Doc<"ads">) {
  requireModule(actor, "ads");
  if (wholeSchool(actor)) return;
  if (
    !hasRole(actor, "Teacher") ||
    ad.createdBy !== actor.user._id ||
    !(await matchesAudience(ctx, actor, ad.audiences, "teacher"))
  )
    denied();
}
export async function receiptAccess(ctx: QueryCtx, actor: Actor, receiptId: string) {
  requireModule(actor, "payments");
  const receipt = await get(ctx, "receipts", receiptId);
  const charge = await get(ctx, "charges", receipt.chargeId);
  if (!wholeSchool(actor) && !hasRole(actor, "Finance")) {
    if (receipt.guardianId !== actor.user._id) denied();
    await requireGuardianOf(ctx, charge.learnerId, actor);
  }
  return receipt;
}
export async function accessibleFile(
  ctx: QueryCtx,
  actor: Actor,
  target: Infer<typeof fileTarget>,
) {
  if (target.kind === "notice") {
    requireModule(actor, "messages");
    const n = await get(ctx, "notices", target.id);
    if (!(await canReadNotice(ctx, actor, n))) denied();
    if (!Number.isInteger(target.slot) || target.slot! < 0 || target.slot! >= n.attachments.length)
      invalid("Attachment unavailable.");
    return n.attachments[target.slot!]!;
  }
  if (target.kind === "resource") {
    requireModule(actor, "resources");
    const r = await get(ctx, "resources", target.id);
    const ownDraft =
      hasRole(actor, "Teacher") &&
      r.publishedBy === actor.user._id &&
      r.status === "Draft" &&
      (await matchesAudience(ctx, actor, r.audiences, "teacher"));
    if (
      !wholeSchool(actor) &&
      !ownDraft &&
      (r.status !== "Published" ||
        !(
          (await matchesAudience(ctx, actor, r.audiences, "guardian")) ||
          (await matchesAudience(ctx, actor, r.audiences, "teacher"))
        ))
    )
      denied();
    return r.file;
  }
  if (target.kind === "ad") {
    const ad = await get(ctx, "ads", target.id);
    await adEditor(ctx, actor, ad);
    if (!ad.media) invalid("This ad has no media yet.");
    return ad.media;
  }
  if (target.kind === "receipt") {
    const r = await receiptAccess(ctx, actor, target.id);
    if (!r.file) invalid("Receipt PDF is not generated yet.");
    return r.file;
  }
  if (actor.disabledModules?.includes("reports")) denied();
  const r = await get(ctx, "reports", target.id);
  const learner = await get(ctx, "learners", r.learnerId);
  if (
    wholeSchool(actor) ||
    (hasRole(actor, "Teacher") && actor.teachingClasses.some((c) => c._id === learner.classId))
  )
    requireModule(actor, "reports");
  else {
    requireModule(actor, "children");
    await requireGuardianOf(ctx, learner._id, actor);
    if (r.status !== "Released") denied();
  }
  if (!r.file) invalid("This report has no PDF.");
  return r.file;
}
