import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { hashInvitation, normalizeEmail } from "./authPolicy";
import { requireRole, requireModule } from "./lib/auth";
import { authedMutation, authedQuery, staffAction } from "./lib/functions";
import { writeAudit } from "./lib/audit";
import { requireEmailService, sendSchoolEmail } from "./authEmail";
import { env } from "./_generated/server";
import { invitationKind, staffRole } from "./validators";
import type { Id } from "./_generated/dataModel";

const invitationArgs = {
  email: v.string(),
  kind: invitationKind,
  staffRole: v.optional(staffRole),
  learnerIds: v.array(v.id("learners")),
};
export const recordInvitation = internalMutation({
  args: { ...invitationArgs, tokenHash: v.string() },
  returns: v.id("invitations"),
  handler: async (ctx, args) => {
    const actor = await requireRole(ctx, "Administrator");
    const administrator = actor.user;
    const email = normalizeEmail(args.email);
    if (args.kind === "Staff" && !args.staffRole) throw new Error("Choose a staff role.");
    if (args.kind === "Guardian" && (args.staffRole || args.learnerIds.length === 0))
      throw new Error("Guardian invitations need learners and cannot grant staff roles.");
    if (args.learnerIds.length > 20 || new Set(args.learnerIds).size !== args.learnerIds.length)
      throw new Error("Choose at most 20 distinct learners.");
    for (const learnerId of args.learnerIds)
      if ((await ctx.db.get("learners", learnerId))?.status !== "Active")
        throw new Error("Unknown or inactive learner.");
    const previous = await ctx.db
      .query("invitations")
      .withIndex("by_email_and_status", (q) => q.eq("email", email).eq("status", "Pending"))
      .take(21);
    if (previous.length > 20) throw new Error("Too many invitations for this email.");
    for (const invite of previous) {
      await ctx.db.patch("invitations", invite._id, { status: "Revoked" });
      await writeAudit(ctx, actor, "invitation.revoked", "invitations", invite._id);
    }
    const invitationId = await ctx.db.insert("invitations", {
      email,
      kind: args.kind,
      staffRole: args.staffRole,
      learnerIds: args.learnerIds,
      tokenHash: args.tokenHash,
      expiresAt: Date.now() + 7 * 86400000,
      status: "Pending",
      invitedBy: administrator._id,
    });
    await writeAudit(ctx, actor, "invitation.created", "invitations", invitationId);
    return invitationId;
  },
});

export const invite = staffAction(["Administrator"], {
  args: invitationArgs,
  returns: v.id("invitations"),
  handler: async (ctx, args): Promise<Id<"invitations">> => {
    requireEmailService();
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    const id = await ctx.runMutation(internal.onboarding.recordInvitation, {
      ...args,
      tokenHash: await hashInvitation(token),
    });
    const url = new URL("/signin", env.SITE_URL);
    url.searchParams.set("invitation", token);
    url.searchParams.set("email", normalizeEmail(args.email));
    await sendSchoolEmail(
      normalizeEmail(args.email),
      "Your invitation to WGJS Connect",
      `You have been invited to Wynberg Girls Junior Connect.\n${url}\n\nSign in or create a password using this email, verify your email, then accept the invitation.\nInvitation code: ${token}\nIt expires in 7 days and can be used once. You can also paste the code into the WGJS Connect mobile sign-in screen.`,
    );
    return id;
  },
});

export const accept = authedMutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = ctx.actor.user;
    if (!user.emailVerificationTime)
      throw new Error("Verify your email before accepting an invitation.");
    if (!/^[a-f0-9]{64}$/.test(args.token)) throw new Error("Invalid invitation.");
    const hash = await hashInvitation(args.token);
    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", hash))
      .unique();
    if (
      !invitation ||
      invitation.status !== "Pending" ||
      invitation.expiresAt <= Date.now() ||
      invitation.email !== user.email
    )
      throw new Error("Invitation is invalid, expired, already used, or belongs to another email.");
    const currentLinks = await ctx.db
      .query("guardianLinks")
      .withIndex("by_guardianId", (q) => q.eq("guardianId", user._id))
      .take(21);
    const linkedIds = new Set(currentLinks.map((link) => link.learnerId));
    const addedIds = new Set(invitation.learnerIds.filter((id) => !linkedIds.has(id)));
    if (invitation.learnerIds.length > 20 || currentLinks.length + addedIds.size > 20)
      throw new Error("Account membership limit exceeded. Contact the school.");
    if (invitation.kind === "Staff") {
      const role = invitation.staffRole;
      if (!role) throw new Error("Invitation is missing a staff role.");
      const existing = await ctx.db
        .query("staffRoles")
        .withIndex("by_userId_and_role", (q) => q.eq("userId", user._id).eq("role", role))
        .unique();
      if (!existing) {
        const roleId = await ctx.db.insert("staffRoles", { userId: user._id, role });
        await ctx.audit("role.granted", "staffRoles", roleId);
      }
    }
    for (const learnerId of invitation.learnerIds) {
      if ((await ctx.db.get("learners", learnerId))?.status !== "Active")
        throw new Error("Learner no longer exists. Contact the school.");
      const link = await ctx.db
        .query("guardianLinks")
        .withIndex("by_guardianId_and_learnerId", (q) =>
          q.eq("guardianId", user._id).eq("learnerId", learnerId),
        )
        .unique();
      if (!link) {
        const linkId = await ctx.db.insert("guardianLinks", {
          guardianId: user._id,
          learnerId,
          relationship: "Guardian",
          isPrimaryContact: false,
        });
        await ctx.audit("guardian.linked", "guardianLinks", linkId);
      }
    }
    await ctx.db.patch("invitations", invitation._id, { status: "Accepted", acceptedBy: user._id });
    await ctx.audit("invitation.accepted", "invitations", invitation._id);
    return null;
  },
});

export const invitationOptions = authedQuery({
  args: {},
  returns: v.array(v.object({ id: v.id("learners"), name: v.string() })),
  handler: async (ctx) => {
    requireModule(ctx.actor, "people");
    return (await ctx.db.query("learners").withIndex("by_learnerNumber").take(100)).map((l) => ({
      id: l._id,
      name: `${l.firstName} ${l.lastName}`,
    }));
  },
});
