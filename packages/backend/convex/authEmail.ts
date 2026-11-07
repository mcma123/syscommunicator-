import { Email } from "@convex-dev/auth/providers/Email";
import { env } from "./_generated/server";

export function requireEmailService() {
  if (!env.RESEND_API_KEY || !env.AUTH_EMAIL_FROM || !env.SITE_URL)
    throw new Error("Email sign-in is not configured. Contact the school.");
}
export async function sendSchoolEmail(to: string, subject: string, text: string) {
  requireEmailService();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.AUTH_EMAIL_FROM, to: [to], subject, text }),
  });
  if (!response.ok)
    throw new Error("Email could not be sent. Please try again or contact the school.");
}

export function verificationEmail(id: string, purpose: string) {
  return Email({
    id,
    maxAge: 15 * 60,
    async generateVerificationToken() {
      let token = "";
      while (token.length < 8) {
        for (const byte of crypto.getRandomValues(new Uint8Array(16))) {
          if (byte < 250 && token.length < 8) token += (byte % 10).toString();
        }
      }
      return token;
    },
    async sendVerificationRequest({ identifier, token }) {
      await sendSchoolEmail(
        identifier,
        `${purpose} - WGJS Connect`,
        `Your ${purpose.toLowerCase()} code is ${token}. It expires in 15 minutes. If you did not request this, ignore this email.`,
      );
    },
  });
}

export const magicEmail = Email({
  id: "school-email",
  maxAge: 15 * 60,
  async sendVerificationRequest({ identifier, token, url: suppliedUrl }) {
    requireEmailService();
    const url = new URL(suppliedUrl);
    url.searchParams.delete("code");
    if (url.protocol === "http:" || url.protocol === "https:") url.pathname = "/signin";
    // Require explicit confirmation and the email, rather than silently consuming a URL code.
    url.searchParams.set("email", identifier);
    url.searchParams.set("emailToken", token);
    await sendSchoolEmail(
      identifier,
      "Sign in to WGJS Connect",
      `Confirm sign-in for ${identifier}: ${url.toString()}\nThis link expires in 15 minutes. If you did not request it, ignore this email.`,
    );
  },
});
