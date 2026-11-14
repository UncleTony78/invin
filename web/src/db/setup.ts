/* npm run db:setup — apply migrations and load sample data (dates relative to today).
   Stop `npm run dev` first: PGlite allows one process per data folder. */
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { computeTotals, isoDate, toMinor } from "../lib/invoice-math";
import * as s from "./schema";
import { eq, inArray } from "drizzle-orm";
import { runDate } from "../lib/schedule";

// Same default as src/db/index.ts: outside synced folders
const dir = process.env.PGLITE_DIR ?? join(homedir(), ".invin", "pglite");
mkdirSync(dir, { recursive: true });
const client = new PGlite(dir);
const db = drizzle(client, { schema: s });

async function main() {
  await migrate(db, { migrationsFolder: "./drizzle" });
  await client.exec(`TRUNCATE notification_seen, notifications, refunds, credits, reminder_log, series, onboarding, verification, account, session, "user", payment_claims, outbox, pins, events, payments, line_items, invoices, catalog_items, bank_accounts, customers, members, workspaces CASCADE`);

  const today = new Date();
  const d = (n: number) => isoDate(today, n);

  // Sign-in identities for the sample team: sign in as ada@adaobi.studio to see this workspace
  await db.insert(s.user).values([
    { id: "seed-ada", name: "Ada Obi", email: "ada@adaobi.studio", emailVerified: true },
    { id: "seed-moses", name: "Moses Adeyemi", email: "moses@adaobi.studio", emailVerified: true },
    { id: "seed-wemimo", name: "Wemimo Ajayi", email: "wemimo@adaobi.studio", emailVerified: true },
  ]);
  const [ws] = await db
    .insert(s.workspaces)
    .values({ name: "Ada Obi Studio", mark: "AO", address: "Admiralty Way, Lekki, Lagos", email: "ada@adaobi.studio", defaultCurrency: "USD", nextNumber: 145, work: "Design", categories: ["Design", "Retainer", "Consulting", "Content"] })
    .returning();
  const [ada, moses, wemimo] = await db
    .insert(s.members)
    .values([
      { workspaceId: ws.id, name: "Ada Obi", email: "ada@adaobi.studio", role: "owner", userId: "seed-ada" },
      { workspaceId: ws.id, name: "Moses Adeyemi", email: "moses@adaobi.studio", role: "admin", userId: "seed-moses" },
      { workspaceId: ws.id, name: "Wemimo Ajayi", email: "wemimo@adaobi.studio", role: "member", userId: "seed-wemimo" },
    ])
    .returning();

  const accounts = await db
    .insert(s.bankAccounts)
    .values([
      { workspaceId: ws.id, currency: "USD", bank: "Wise · US account", rows: [["Account name", "Ada Obi Studio"], ["Account number", "8310004721"], ["Routing (ACH)", "026073008"], ["SWIFT", "CMFGUS33"]] },
      { workspaceId: ws.id, currency: "GBP", bank: "Wise · UK account", rows: [["Account name", "Ada Obi Studio"], ["Account number", "41286650"], ["Sort code", "23-14-70"], ["IBAN", "GB33 TRWI 2314 7041 2866 50"]] },
      { workspaceId: ws.id, currency: "EUR", bank: "Wise · EU account", rows: [["Account name", "Ada Obi Studio"], ["IBAN", "BE68 9672 0001 2345"], ["SWIFT / BIC", "TRWIBEB1XXX"]] },
      { workspaceId: ws.id, currency: "NGN", bank: "Guaranty Trust Bank", rows: [["Account name", "Ada Obi Studio"], ["Account number", "0123456789"], ["Bank code", "058"]] },
    ])
    .returning();
  const acct = (cur: string) => accounts.find((a) => a.currency === cur)!.id;

  const custRows = [
    { name: "Acme Corp", email: "billing@acme.co", address: "Market Street, San Francisco", currency: "USD" },
    { name: "Northstar Advisory Ltd", email: "finance@northstar.co.uk", address: "Shoreditch, London", currency: "GBP" },
    { name: "Lumen Labs", email: "ap@lumenlabs.io", address: "SoMa, San Francisco", currency: "USD" },
    { name: "Studio Nine", email: "money@studionine.co", address: "Ancoats, Manchester", currency: "GBP" },
    { name: "Kora Foods", email: "accounts@korafoods.ng", address: "Ikeja, Lagos", currency: "NGN" },
    { name: "Bloom & Co", email: "hello@bloom.co", address: "Prenzlauer Berg, Berlin", currency: "EUR" },
    { name: "Halden & Sons", email: "ap@halden.com", address: "Back Bay, Boston", currency: "USD" },
    { name: "Northwind", email: "finance@northwind.com", address: "Capitol Hill, Seattle", currency: "USD" },
    { name: "AJANK PLC", email: "accounts@ajank.co.uk", address: "Canary Wharf, London", currency: "GBP" },
    { name: "Field Notes", email: "team@fieldnotes.xyz", address: "Fitzrovia, London", currency: "USD" },
    { name: "Pico Studio", email: "hi@pico.studio", address: "Le Marais, Paris", currency: "EUR", termsDays: 7 },
  ];
  const customers = await db.insert(s.customers).values(custRows.map((c) => ({ ...c, workspaceId: ws.id }))).returning();
  const cust = (n: string) => customers.find((c) => c.name === n)!;

  await db.insert(s.catalogItems).values([
    { workspaceId: ws.id, name: "Monthly design retainer", unitPrice: toMinor(2800), currency: "USD", unit: "month" },
    { workspaceId: ws.id, name: "Brand identity sprint", unitPrice: toMinor(1350), currency: "USD", unit: "project" },
    { workspaceId: ws.id, name: "Design hour", unitPrice: toMinor(90), currency: "USD", unit: "hour" },
    { workspaceId: ws.id, name: "Social media templates (set of 12)", unitPrice: toMinor(450), currency: "USD", unit: "set" },
    { workspaceId: ws.id, name: "Strategy workshop", unitPrice: toMinor(1200), currency: "USD", unit: "day" },
  ]);

  type Seed = {
    n: number; c: string; cat: string; status: s.InvoiceStatus; issue: number | null; terms: number;
    lines: [string, number, number][]; vat?: number; paid?: number; by: string; tpl?: string;
  };
  const rows: Seed[] = [
    { n: 144, c: "Pico Studio", cat: "Design", status: "draft", issue: null, terms: 7, lines: [["Logo refresh", 1, 600], ["Asset export", 2, 60]], by: wemimo.id },
    { n: 143, c: "Acme Corp", cat: "Retainer", status: "scheduled", issue: 29, terms: 14, lines: [["Monthly design retainer · next month", 1, 3200]], by: ada.id },
    { n: 142, c: "Acme Corp", cat: "Retainer", status: "sent", issue: -1, terms: 14, lines: [["Monthly design retainer", 1, 2800], ["Extra hours", 4, 100]], by: ada.id },
    { n: 141, c: "Northstar Advisory Ltd", cat: "Retainer", status: "viewed", issue: -12, terms: 14, lines: [["Monthly retainer", 1, 1480], ["Extra hours", 4, 92.5]], by: "system" },
    { n: 140, c: "Lumen Labs", cat: "Design", status: "viewed", issue: -3, terms: 14, lines: [["Product UI design, sprint 3", 1, 3500], ["Prototype handover", 1, 600]], by: moses.id },
    { n: 139, c: "Studio Nine", cat: "Design", status: "partial", issue: -7, terms: 14, lines: [["Brand identity, phase 2", 1, 1350], ["File export and handover", 5, 90]], paid: 900, by: ada.id },
    { n: 138, c: "Kora Foods", cat: "Retainer", status: "sent", issue: -24, terms: 14, lines: [["Monthly marketing retainer", 1, 2450000]], by: moses.id },
    { n: 137, c: "Bloom & Co", cat: "Design", status: "sent", issue: -16, terms: 14, lines: [["Packaging concepts", 1, 640]], by: wemimo.id },
    { n: 136, c: "Halden & Sons", cat: "Consulting", status: "viewed", issue: -43, terms: 7, lines: [["Strategy workshop", 1, 600], ["Follow-up sessions", 2, 190]], by: ada.id },
    { n: 135, c: "Northwind", cat: "Consulting", status: "paid", issue: -10, terms: 7, lines: [["Strategy workshop", 1, 1200]], paid: 1200, by: ada.id },
    { n: 134, c: "AJANK PLC", cat: "Retainer", status: "cancelled", issue: -12, terms: 14, lines: [["Monthly retainer", 1, 1800]], paid: 600, by: wemimo.id },
    { n: 131, c: "Northstar Advisory Ltd", cat: "Retainer", status: "paid", issue: -43, terms: 14, lines: [["Monthly retainer", 1, 1480], ["Extra hours", 4, 92.5]], paid: 1850, by: "system" },
    { n: 130, c: "Field Notes", cat: "Content", status: "paid", issue: -35, terms: 14, lines: [["Editorial design, issue 7", 1, 1550]], paid: 1550, by: moses.id },
    // A long invoice, to show how many lines flow onto a second PDF page
    {
      n: 129, c: "Kora Foods", cat: "Content", status: "paid", issue: -50, terms: 14, by: ada.id, paid: 2111000,
      lines: [
        ["Campaign strategy workshop", 1, 450000], ["Brand voice guide", 1, 280000], ["Social calendar, January", 1, 120000], ["Social calendar, February", 1, 120000],
        ["Social calendar, March", 1, 120000], ["Product photography, half day", 2, 85000], ["Retouching, per image", 40, 2500], ["Short video edit (30s)", 6, 18000],
        ["Short video edit (60s)", 3, 26000], ["Caption writing, per post", 36, 1500], ["Community replies, per week", 12, 6000], ["Influencer brief", 2, 22000],
        ["Influencer outreach", 1, 40000], ["Paid social setup", 1, 55000], ["Ad creative, static", 12, 4000], ["Ad creative, motion", 4, 12000],
        ["Landing page copy", 1, 30000], ["Email newsletter design", 3, 15000], ["Monthly report", 3, 10000], ["Hashtag research", 1, 8000],
        ["Story highlight covers", 8, 1500], ["Profile refresh", 1, 12000], ["Stock licence", 5, 3000], ["Project management", 1, 52000],
      ],
    },
  ];

  const memberName = (idOrSystem: string) => [ada, moses, wemimo].find((m) => m.id === idOrSystem)?.name ?? "InVin";

  for (const r of rows) {
    const c = cust(r.c);
    const lines = r.lines.map(([description, quantity, price], position) => ({ description, quantity, unitPrice: toMinor(price), position }));
    const t = computeTotals(lines, r.vat ?? 0);
    const issueDate = r.issue === null ? null : d(r.issue);
    const dueDate = r.issue === null ? null : d(r.issue + r.terms);
    const [inv] = await db
      .insert(s.invoices)
      .values({
        workspaceId: ws.id, number: `INV-0${r.n}`, customerId: c.id, status: r.status, currency: c.currency, category: r.cat,
        issueDate, dueDate, termsDays: r.terms, bankAccountId: acct(c.currency), vatBps: r.vat ?? 0, ...t,
        amountPaid: toMinor(r.paid ?? 0), createdBy: r.by, template: r.tpl ?? "stacked",
        note: "Thank you. Please use the invoice number as your payment reference.",
        customerSnapshot: r.status === "draft" ? null : { name: c.name, email: c.email, address: c.address },
        sentAt: r.status === "draft" || r.status === "scheduled" ? null : new Date(`${issueDate}T09:00:00`),
      })
      .returning();
    await db.insert(s.lineItems).values(lines.map((l) => ({ ...l, invoiceId: inv.id })));

    const ev: (typeof s.events.$inferInsert)[] = [];
    const at = (iso: string, h: number, m = 0) => new Date(`${iso}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
    const actor = (id: string) => (id === "system" ? { actorType: "system" as const, actorId: null, actorLabel: "InVin" } : { actorType: "member" as const, actorId: id, actorLabel: memberName(id) });
    const created = issueDate ?? d(-1);
    ev.push({ workspaceId: ws.id, invoiceId: inv.id, title: r.by === "system" ? "Created from the Northstar recurring series" : "Invoice created", ...actor(r.by), createdAt: at(created, 8, 52) });
    if (r.status === "scheduled") ev.push({ workspaceId: ws.id, invoiceId: inv.id, title: `Scheduled to send`, ...actor(r.by), createdAt: at(d(-1), 17, 30) });
    if (issueDate && r.status !== "scheduled") ev.push({ workspaceId: ws.id, invoiceId: inv.id, title: `Invoice sent to ${c.email}`, ...actor(r.by === "system" ? "system" : r.by), createdAt: at(issueDate, 9) });
    if (issueDate && ["viewed", "partial", "paid"].includes(r.status)) ev.push({ workspaceId: ws.id, invoiceId: inv.id, title: "Customer opened the invoice", actorType: "customer", actorLabel: c.name, createdAt: at(issueDate, 15, 47) });
    if (r.paid && r.status !== "cancelled") {
      await db.insert(s.payments).values({ invoiceId: inv.id, amount: toMinor(r.paid), receivedOn: d(r.status === "partial" ? -4 : (r.issue ?? 0) + 3), method: "Bank transfer", recordedBy: moses.id });
      ev.push({ workspaceId: ws.id, invoiceId: inv.id, title: `${r.status === "partial" ? "Part payment" : "Payment"} recorded`, actorType: "member", actorId: moses.id, actorLabel: moses.name, note: r.status === "partial" ? "The customer says the rest will follow at the end of the month." : null, createdAt: at(d(r.status === "partial" ? -4 : (r.issue ?? 0) + 3), 11, 20) });
    }
    if (dueDate && ["sent", "viewed", "partial"].includes(r.status) && dueDate < d(0)) ev.push({ workspaceId: ws.id, invoiceId: inv.id, title: "Reminder sent: payment is late", actorType: "system", actorLabel: "InVin", createdAt: at(d(0), 8) });
    if (r.status === "cancelled") {
      await db.insert(s.payments).values({ invoiceId: inv.id, amount: toMinor(1200), receivedOn: d(-5), method: "Bank transfer", recordedBy: moses.id });
      ev.push(
        { workspaceId: ws.id, invoiceId: inv.id, title: "Payment recorded", actorType: "member", actorId: moses.id, actorLabel: moses.name, createdAt: at(d(-5), 9, 15) },
        { workspaceId: ws.id, invoiceId: inv.id, title: "Refund issued", actorType: "agent", actorId: ada.id, actorLabel: "Ada's agent", details: [["Started by", "Ada's agent"], ["Approved by", "Ada Obi"], ["Connected through", "InVin MCP"], ["Action", "Issue a refund"], ["Amount", "£600.00 to AJANK PLC"], ["Result", "Refund processed"]], createdAt: at(d(-5), 10, 36) },
        { workspaceId: ws.id, invoiceId: inv.id, title: "Invoice cancelled", actorType: "member", actorId: ada.id, actorLabel: ada.name, note: "Sent to the wrong billing contact. We emailed the customer and paused their recurring invoices until the contact is fixed.", createdAt: at(d(-5), 10, 42) },
      );
    }
    await db.insert(s.events).values(ev);
  }

  // Reminder steps already behind each unpaid invoice count as sent, so the scheduler doesn't fire them all at once
  const offsets = [-3, 0, 3, 7, 14];
  const open = await db.select().from(s.invoices).where(eq(s.invoices.workspaceId, ws.id));
  const past = open.flatMap((inv) => (["sent", "viewed", "partial"].includes(inv.status) && inv.dueDate ? offsets.filter((o) => shiftDay(inv.dueDate!, o) <= d(0)).map((o) => ({ invoiceId: inv.id, offsetDays: o })) : []));
  if (past.length) await db.insert(s.reminderLog).values(past);

  // Recurring series: two monthly retainers (one sends itself, one makes drafts for review) and a paused quarterly workshop
  const inv = (n: number) => open.find((i) => i.number === `INV-0${n}`)!;
  const lineRows = async (id: string) => (await db.select().from(s.lineItems).where(eq(s.lineItems.invoiceId, id)).orderBy(s.lineItems.position)).map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice }));
  const base = (i: typeof open[number]) => ({ workspaceId: ws.id, customerId: i.customerId, category: i.category, termsDays: i.termsDays, vatBps: i.vatBps, note: i.note, template: i.template, brandColor: i.brandColor, bankAccountId: i.bankAccountId, total: i.total, createdBy: ada.id });
  const ns = inv(141), kora = inv(138), halden = inv(136);
  const [northstar] = await db.insert(s.series).values({ ...base(ns), frequency: "monthly", anchorDate: inv(131).issueDate!, runIndex: 2, invoicesMade: 2, nextRun: runDate(inv(131).issueDate!, "monthly", 2), endAfter: 12, mode: "send", lines: await lineRows(ns.id) }).returning();
  const [koraS] = await db.insert(s.series).values({ ...base(kora), frequency: "monthly", anchorDate: kora.issueDate!, runIndex: 1, invoicesMade: 1, nextRun: runDate(kora.issueDate!, "monthly", 1), mode: "draft", lines: await lineRows(kora.id) }).returning();
  const [haldenS] = await db.insert(s.series).values({ ...base(halden), frequency: "quarterly", anchorDate: halden.issueDate!, runIndex: 1, invoicesMade: 1, nextRun: runDate(halden.issueDate!, "quarterly", 1), status: "paused", mode: "send", lines: await lineRows(halden.id) }).returning();
  await db.update(s.invoices).set({ seriesId: northstar.id }).where(inArray(s.invoices.id, [ns.id, inv(131).id]));
  await db.update(s.invoices).set({ seriesId: koraS.id }).where(eq(s.invoices.id, kora.id));
  await db.update(s.invoices).set({ seriesId: haldenS.id }).where(eq(s.invoices.id, halden.id));

  await db.insert(s.pins).values([{ workspaceId: ws.id, memberId: ada.id, kind: "view", ref: "overdue", label: "Overdue invoices", position: 0 }]);

  // A little history in the notification feed (the runner adds overdue ones on its first pass)
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
  await db.insert(s.notifications).values([
    { workspaceId: ws.id, kind: "viewed", title: "Lumen Labs opened INV-0140", invoiceId: inv(140).id, dedupe: `viewed:${inv(140).id}`, createdAt: hoursAgo(20) },
    { workspaceId: ws.id, kind: "paid", title: "INV-0135 is paid in full", body: "Moses Adeyemi recorded $1,200.00", invoiceId: inv(135).id, createdAt: hoursAgo(30) },
    { workspaceId: ws.id, kind: "viewed", title: "Northstar Advisory Ltd opened INV-0141", invoiceId: ns.id, dedupe: `viewed:${ns.id}`, createdAt: hoursAgo(52) },
  ]);
  console.log(`Seeded ${rows.length} invoices, ${customers.length} customers and 3 recurring series for ${ws.name}.`);
}

function shiftDay(date: string, days: number) {
  const [y, m, dd] = date.split("-").map(Number);
  return isoDate(new Date(y, m - 1, dd + days));
}

main()
  .then(() => client.close())
  .catch(async (e) => {
    console.error(e);
    await client.close();
    process.exit(1);
  });
