import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { env, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { DEV_URL } from "./seedSupport";

export const DEMO_EMAILS = ["parent", "teacher", "principal", "finance", "admin"].map(
  (role) => `${role}@wgjs.example`,
);
export function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") throw new Error("Enter a valid email address.");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Enter a valid email address.");
  return email;
}
export function demoEnabled() {
  return env.CONVEX_CLOUD_URL === DEV_URL && env.ENABLE_DEMO_ACCOUNTS === "true";
}
export function checkActive(user: { status?: string; email?: string } | null) {
  if (!user || user.status !== "Active")
    throw new Error("This account is not active. Contact the school.");
  if (
    user.email?.endsWith("@wgjs.example") &&
    (!demoEnabled() || !DEMO_EMAILS.includes(user.email))
  )
    throw new Error("Development accounts are disabled.");
}

export async function requireSession(ctx: QueryCtx) {
  // Convex Auth owns its subject format. Use its supported helpers, never caller identity arguments.
  const userId = await getAuthUserId(ctx);
  const sessionId = await getAuthSessionId(ctx);
  if (!userId || !sessionId) throw new Error("Sign in to continue.");
  const session = await ctx.db.get("authSessions", sessionId);
  if (!session || session.userId !== userId)
    throw new Error("Your session has ended. Sign in again.");
  const user = await ctx.db.get("users", userId);
  checkActive(user);
  if (user?.sessionsValidAfter !== undefined && session._creationTime <= user.sessionsValidAfter)
    throw new Error("Your session has ended. Sign in again.");
  return user!;
}

export async function linkAuthUser(
  ctx: MutationCtx,
  args: {
    existingUserId: Id<"users"> | null;
    type: string;
    profile: { email?: string; emailVerified?: boolean };
  },
) {
  const email = normalizeEmail(args.profile.email);
  const existing = args.existingUserId
    ? await ctx.db.get("users", args.existingUserId)
    : await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .unique();
  if (existing) {
    if (existing.email !== email) throw new Error("Account email mismatch.");
    checkActive(existing);
    if (args.profile.emailVerified)
      await ctx.db.patch("users", existing._id, {
        emailVerificationTime: Date.now(),
        updatedAt: Date.now(),
      });
    return existing._id;
  }
  const invites = await ctx.db
    .query("invitations")
    .withIndex("by_email_and_status", (q) => q.eq("email", email).eq("status", "Pending"))
    .take(21);
  if (invites.length > 20 || !invites.some((i) => i.expiresAt > Date.now()))
    throw new Error("Use your school-registered email or request an invitation.");
  return ctx.db.insert("users", {
    email,
    status: "Active",
    emailVerificationTime: args.profile.emailVerified ? Date.now() : undefined,
    updatedAt: Date.now(),
  });
}

export async function hashInvitation(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
