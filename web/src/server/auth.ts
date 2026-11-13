import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins/email-otp";
import { db, schema as s } from "@/db";
import { appUrl, sendEmail } from "@/server/email";
import { signInCodeEmail } from "@/server/email-templates";

/*
 * Sign-in is passwordless: we email a 6-digit code. New emails get an account on first sign-in,
 * then land in the welcome chat to set up a workspace.
 * Built lazily so `next build` never opens the local database.
 */
function build() {
  return betterAuth({
    baseURL: appUrl(),
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg", schema: { user: s.user, session: s.session, account: s.account, verification: s.verification } }),
    session: {
      expiresIn: 60 * 60 * 24 * 30, // stay signed in for 30 days
      updateAge: 60 * 60 * 24,
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 5,
        storeOTP: "hashed",
        async sendVerificationOTP({ email, otp }) {
          if (process.env.NODE_ENV !== "production") console.log(`[sign-in] code for ${email}: ${otp}`);
          const mail = signInCodeEmail(otp);
          // Not awaited: response time shouldn't reveal whether the email exists or how delivery went
          void sendEmail({ workspaceId: null, to: email, subject: mail.subject, text: mail.text, html: mail.html, logText: "Sign-in code (not stored)" }).catch(() => {});
        },
      }),
      nextCookies(),
    ],
  });
}

let instance: ReturnType<typeof build> | undefined;
export const getAuth = () => (instance ??= build());
