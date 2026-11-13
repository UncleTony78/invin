"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema as s } from "@/db";
import { toMinor } from "@/lib/invoice-math";
import { requireSession } from "./session";

/* Customers, catalogue and workspace settings. Every action scopes to the session's workspace. */

const refresh = () => revalidatePath("/", "layout");
const CURRENCIES = ["USD", "GBP", "EUR", "NGN"];
const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/* ---------------- Customers ---------------- */
export type CustomerInput = { name: string; email: string; address: string; currency: string; termsDays: number };

function checkCustomer(c: CustomerInput): string | null {
  if (!c.name.trim()) return "Add the customer's name.";
  if (!emailOk(c.email.trim())) return "Check the email address, it looks incomplete.";
  if (!CURRENCIES.includes(c.currency)) return "Choose a currency.";
  if (![0, 7, 14, 30].includes(c.termsDays)) return "Choose how long they have to pay.";
  return null;
}

export async function createCustomer(input: CustomerInput): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  const err = checkCustomer(input);
  if (err) return { ok: false, error: err };
  const [c] = await db
    .insert(s.customers)
    .values({ workspaceId: session.workspace.id, name: input.name.trim(), email: input.email.trim().toLowerCase(), address: input.address.trim(), currency: input.currency, termsDays: input.termsDays })
    .returning();
  refresh();
  return { ok: true, id: c.id };
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<Result> {
  const session = await requireSession();
  const err = checkCustomer(input);
  if (err) return { ok: false, error: err };
  const res = await db
    .update(s.customers)
    .set({ name: input.name.trim(), email: input.email.trim().toLowerCase(), address: input.address.trim(), currency: input.currency, termsDays: input.termsDays })
    .where(and(eq(s.customers.id, id), eq(s.customers.workspaceId, session.workspace.id)))
    .returning();
  if (!res.length) return { ok: false, error: "Customer not found." };
  refresh();
  return { ok: true };
}

/* ---------------- Catalogue ---------------- */
export type CatalogInput = { name: string; price: number; currency: string; unit: string };

function checkItem(i: CatalogInput): string | null {
  if (!i.name.trim()) return "Give the item a name.";
  if (!(i.price >= 0) || !Number.isFinite(i.price)) return "Enter a price, or 0 if it varies.";
  if (!CURRENCIES.includes(i.currency)) return "Choose a currency.";
  if (!i.unit.trim()) return "Say what one unit is, like hour or project.";
  return null;
}

export async function saveCatalogItem(id: string | null, input: CatalogInput): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  const err = checkItem(input);
  if (err) return { ok: false, error: err };
  if (!(input.price >= 0) || toMinor(input.price) > 99_999_999_999_999) return { ok: false, error: "Use a price between 0 and 999,999,999,999.99." };
  const values = { name: input.name.trim(), unitPrice: toMinor(input.price), currency: input.currency, unit: input.unit.trim().toLowerCase() };
  if (id) {
    const res = await db.update(s.catalogItems).set(values).where(and(eq(s.catalogItems.id, id), eq(s.catalogItems.workspaceId, session.workspace.id))).returning();
    if (!res.length) return { ok: false, error: "Item not found." };
    refresh();
    return { ok: true, id };
  }
  const [item] = await db.insert(s.catalogItems).values({ workspaceId: session.workspace.id, ...values }).returning();
  refresh();
  return { ok: true, id: item.id };
}

export async function deleteCatalogItem(id: string) {
  const session = await requireSession();
  const [item] = await db.delete(s.catalogItems).where(and(eq(s.catalogItems.id, id), eq(s.catalogItems.workspaceId, session.workspace.id))).returning();
  refresh();
  // Returned so the toast's Undo can put it back exactly
  return item ? { name: item.name, price: item.unitPrice / 100, currency: item.currency, unit: item.unit } : null;
}

/* ---------------- Workspace settings ---------------- */
export type BusinessInput = { name: string; mark: string; address: string; email: string; brandColor: string; template: string; numberPrefix: string; nextNumber: number };

export async function updateBusiness(input: BusinessInput): Promise<Result> {
  const session = await requireSession();
  if (!input.name.trim()) return { ok: false, error: "Add your business name." };
  if (!emailOk(input.email.trim())) return { ok: false, error: "Check the business email, it looks incomplete." };
  if (!/^[A-Za-z0-9]{1,3}$/.test(input.mark.trim())) return { ok: false, error: "Use 1 to 3 letters or numbers for your mark." };
  if (!/^#[0-9a-fA-F]{6}$/.test(input.brandColor)) return { ok: false, error: "Choose a brand colour." };
  if (!/^[A-Za-z0-9-]{0,8}$/.test(input.numberPrefix)) return { ok: false, error: "Keep the prefix short: letters, numbers or a dash." };
  if (!Number.isInteger(input.nextNumber) || input.nextNumber < 1) return { ok: false, error: "The next number must be 1 or more." };
  // Never let the counter go backwards into numbers already used
  const [{ used }] = await db
    .select({ used: sql<number>`count(*)` })
    .from(s.invoices)
    .where(and(eq(s.invoices.workspaceId, session.workspace.id), eq(s.invoices.number, `${input.numberPrefix}${String(input.nextNumber).padStart(4, "0")}`)));
  if (Number(used) > 0) return { ok: false, error: `${input.numberPrefix}${String(input.nextNumber).padStart(4, "0")} is already used. Pick a higher number.` };
  await db
    .update(s.workspaces)
    .set({ name: input.name.trim(), mark: input.mark.trim().toUpperCase(), address: input.address.trim(), email: input.email.trim().toLowerCase(), brandColor: input.brandColor, template: input.template, numberPrefix: input.numberPrefix, nextNumber: input.nextNumber })
    .where(eq(s.workspaces.id, session.workspace.id));
  refresh();
  return { ok: true };
}

export type BankInput = { currency: string; bank: string; rows: [string, string][] };

export async function saveBankAccount(id: string | null, input: BankInput): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  const rows = input.rows.map(([k, v]) => [k.trim(), v.trim()] as [string, string]).filter(([k, v]) => k && v);
  if (!input.bank.trim()) return { ok: false, error: "Add the bank's name." };
  if (!CURRENCIES.includes(input.currency)) return { ok: false, error: "Choose a currency." };
  if (rows.length === 0) return { ok: false, error: "Add at least one detail, like the account number." };
  if (id) {
    const res = await db.update(s.bankAccounts).set({ bank: input.bank.trim(), currency: input.currency, rows }).where(and(eq(s.bankAccounts.id, id), eq(s.bankAccounts.workspaceId, session.workspace.id))).returning();
    if (!res.length) return { ok: false, error: "Account not found." };
    refresh();
    return { ok: true, id };
  }
  const [a] = await db.insert(s.bankAccounts).values({ workspaceId: session.workspace.id, bank: input.bank.trim(), currency: input.currency, rows }).returning();
  refresh();
  return { ok: true, id: a.id };
}

export async function deleteBankAccount(id: string): Promise<Result> {
  const session = await requireSession();
  // Invoices keep pointing at their account; don't pull the details out from under open invoices
  const [{ open }] = await db
    .select({ open: sql<number>`count(*)` })
    .from(s.invoices)
    .where(and(eq(s.invoices.bankAccountId, id), sql`${s.invoices.status} in ('draft','scheduled','sent','viewed','partial')`));
  if (Number(open) > 0) return { ok: false, error: `${open} unpaid invoice${Number(open) === 1 ? " uses" : "s use"} this account. Keep it until they're paid.` };
  await db.update(s.invoices).set({ bankAccountId: null }).where(eq(s.invoices.bankAccountId, id));
  await db.delete(s.bankAccounts).where(and(eq(s.bankAccounts.id, id), eq(s.bankAccounts.workspaceId, session.workspace.id)));
  refresh();
  return { ok: true };
}

/* ---------------- Automation ---------------- */
export type AutomationInput = { remindersOn: boolean; reminderOffsets: number[]; receiptsOn: boolean; categories: string[] };

export async function updateAutomation(input: AutomationInput): Promise<Result> {
  const session = await requireSession();
  const offsets = [...new Set(input.reminderOffsets.map(Number))].filter((n) => Number.isInteger(n) && n >= -30 && n <= 90).sort((a, b) => a - b);
  if (input.remindersOn && offsets.length === 0) return { ok: false, error: "Choose at least one reminder, or turn reminders off." };
  if (offsets.length > 8) return { ok: false, error: "Keep it to 8 reminders or fewer." };
  const cats = [...new Map(input.categories.map((c) => c.trim().replace(/\s+/g, " ")).filter(Boolean).map((c) => [c.toLowerCase(), c])).values()];
  if (cats.length === 0) return { ok: false, error: "Keep at least one category." };
  if (cats.length > 40 || cats.some((c) => c.length > 30)) return { ok: false, error: "Use up to 40 categories, each under 30 characters." };
  await db
    .update(s.workspaces)
    .set({ remindersOn: !!input.remindersOn, reminderOffsets: offsets, receiptsOn: !!input.receiptsOn, categories: cats })
    .where(eq(s.workspaces.id, session.workspace.id));
  refresh();
  return { ok: true };
}
