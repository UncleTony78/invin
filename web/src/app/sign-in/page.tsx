import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInView } from "@/components/screens/sign-in-view";
import { getUser } from "@/server/session";

export const metadata: Metadata = { title: "Sign in · InVin" };
export const dynamic = "force-dynamic";

/** Only allow going back to a path on this site */
const safeNext = (v: unknown) => (typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "/");

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const next = safeNext((await searchParams).next);
  if (await getUser()) redirect(next);
  return <SignInView next={next} testInbox={process.env.EMAIL_REDIRECT_TO?.trim() || null} />;
}
