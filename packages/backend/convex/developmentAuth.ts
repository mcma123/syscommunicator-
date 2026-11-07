import { createAccount } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { env, internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { DEMO_EMAILS, demoEnabled } from "./authPolicy";
import { requireSeedDeployment } from "./seedSupport";

export const verifyProfile = internalMutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, { email }) => {
    requireSeedDeployment();
    if (!demoEnabled() || !DEMO_EMAILS.includes(email))
      throw new Error("Demo provisioning is disabled.");
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email),
      )
      .unique();
    if (!account) throw new Error("Demo account has not been created.");
    await ctx.db.patch("authAccounts", account._id, { emailVerified: email });
    await ctx.db.patch("users", account.userId, { emailVerificationTime: Date.now() });
    return null;
  },
});
export const provision = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    requireSeedDeployment();
    if (!demoEnabled())
      throw new Error("Enable development accounts on the identified dev deployment first.");
    const passwords = [
      env.DEV_AUTH_PASSWORD_PARENT,
      env.DEV_AUTH_PASSWORD_TEACHER,
      env.DEV_AUTH_PASSWORD_PRINCIPAL,
      env.DEV_AUTH_PASSWORD_FINANCE,
      env.DEV_AUTH_PASSWORD_ADMIN,
    ];
    const accounts = DEMO_EMAILS.map((email, index) => ({ email, password: passwords[index] }));
    for (const account of accounts) {
      if (!account.password || account.password.length < 16)
        throw new Error("Missing private development credentials.");
      await createAccount(ctx, {
        provider: "password",
        account: { id: account.email, secret: account.password },
        profile: { email: account.email },
        shouldLinkViaEmail: true,
      });
      await ctx.runMutation(internal.developmentAuth.verifyProfile, { email: account.email });
    }
    return null;
  },
});
