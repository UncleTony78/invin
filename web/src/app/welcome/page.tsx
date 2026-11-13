import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { WelcomeChat } from "@/components/screens/welcome-chat";
import { db, schema as s } from "@/db";
import type { Answers } from "@/lib/onboarding";
import { findMembership, requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Welcome · InVin" };
export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const user = await requireUser();
  if (await findMembership(user.id)) redirect("/");
  const [row] = await db.select().from(s.onboarding).where(eq(s.onboarding.userId, user.id));
  return <WelcomeChat signInEmail={user.email} saved={(row?.answers ?? {}) as Partial<Answers>} />;
}
