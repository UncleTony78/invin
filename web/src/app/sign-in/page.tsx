import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInView } from "@/components/screens/sign-in-view";
import { googleEnabled } from "@/server/auth";
import { getUser } from "@/server/session";

export const metadata: Metadata = { title: "Sign in · InVin" };
export const dynamic = "force-dynamic";

/** Only allow going back to a path on this site */
const safeNext = (v: unknown) => (typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "/");

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getUser()) redirect(next);
  return <SignInView next={next} google={googleEnabled()} failed={sp.error ? "Google sign-in didn't finish. Try again, or use your email." : null} testInbox={process.env.EMAIL_REDIRECT_TO?.trim() || null} />;
}
