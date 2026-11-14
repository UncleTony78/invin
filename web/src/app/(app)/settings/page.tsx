import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { SettingsView } from "@/components/screens/settings-view";
import { db, schema as s } from "@/db";
import { listBankAccounts } from "@/server/queries";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Settings · InVin" };

export default async function SettingsPage() {
  const session = await requireSession();
  const w = session.workspace;
  const [accounts, team] = await Promise.all([
    listBankAccounts(session),
    db.select().from(s.members).where(eq(s.members.workspaceId, w.id)).orderBy(asc(s.members.createdAt)),
  ]);
  const redirect = process.env.EMAIL_REDIRECT_TO;
  const email = !process.env.RESEND_API_KEY
    ? ({ mode: "off" } as const)
    : redirect
      ? ({ mode: "test", to: redirect } as const)
      : process.env.EMAIL_FROM
        ? ({ mode: "live", from: process.env.EMAIL_FROM } as const)
        : ({ mode: "off" } as const);
  return (
    <SettingsView
      automation={{ remindersOn: w.remindersOn, reminderOffsets: w.reminderOffsets, receiptsOn: w.receiptsOn, categories: w.categories, customFields: w.customFields }}
      business={{ name: w.name, mark: w.mark, address: w.address, email: w.email, brandColor: w.brandColor, template: w.template, numberPrefix: w.numberPrefix, nextNumber: w.nextNumber }}
      accounts={accounts.map((a) => ({ id: a.id, bank: a.bank, currency: a.currency, rows: a.rows }))}
      team={team.map((m) => ({ id: m.id, name: m.name, email: m.email, role: m.role, you: m.id === session.member.id }))}
      email={email}
    />
  );
}
