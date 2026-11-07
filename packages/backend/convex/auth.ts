import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { magicEmail, verificationEmail } from "./authEmail";
import { checkActive, linkAuthUser, normalizeEmail } from "./authPolicy";
import type { MutationCtx } from "./_generated/server";
import { env } from "./_generated/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile: (params) => ({ email: normalizeEmail(params.email) }),
      validatePasswordRequirements: (password) => {
        if (typeof password !== "string" || password.length < 12 || password.length > 128)
          throw new Error("Use a password between 12 and 128 characters.");
      },
      verify: verificationEmail("verify-email", "Verify your email"),
      reset: verificationEmail("reset-password", "Reset your password"),
    }),
    magicEmail,
  ],
  callbacks: {
    redirect: async ({ redirectTo }) => {
      if (redirectTo === "wgjsconnect://signin") return redirectTo;
      if (!env.SITE_URL) throw new Error("School web URL is not configured.");
      const url = new URL(redirectTo, env.SITE_URL);
      if (url.origin !== new URL(env.SITE_URL).origin)
        throw new Error("Invalid sign-in destination.");
      return url.toString();
    },
    createOrUpdateUser: (ctx, args) => linkAuthUser(ctx as MutationCtx, args),
    beforeSessionCreation: async (ctx, { userId }) => {
      checkActive(await (ctx as MutationCtx).db.get("users", userId));
    },
  },
});
