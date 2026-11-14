# InVin web app

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Base UI 1.9 · Motion 14.

```bash
npm install
npm run db:setup   # create the local database and load sample data (stop `npm run dev` first)
npm run dev        # http://localhost:3000  ·  component library at /components
npm run build
npm run lint
```

## Data (Phase 1)

- **Local database:** PGlite (Postgres in-process) at `~/.invin/pglite`, outside the project because synced folders like OneDrive corrupt databases mid-write. `npm run db:setup` wipes and reseeds it; sample dates are relative to today.
- **Schema:** `src/db/schema.ts` (Drizzle). Money is integer minor units plus a currency code. Migrations live in `drizzle/` (`npm run db:generate` after schema changes).
- **Production:** point `DATABASE_URL` at Neon and swap the driver in `src/db/index.ts` to `drizzle-orm/neon-http`. Queries don't change.
- **Server code:** `src/server/queries.ts` (reads), `src/server/actions.ts` (Server Actions; each re-checks the session and workspace).
- **Session:** `src/server/session.ts` is a stand-in that returns the first owner until sign-in (Better Auth) lands.
- **Email:** sent through Resend (`src/server/email.ts`), and every email is logged with its result at `/outbox` (Sent emails). Settings live in `.env.local` (never committed):
  - `RESEND_API_KEY` connects Resend.
  - **Test mode** (no verified domain yet): set `EMAIL_REDIRECT_TO` to the email you signed up to Resend with. Every email goes there instead, with the real recipient in the subject, so sample customers are never contacted. Leave it empty and emails are kept in Sent emails, not delivered.
  - **Live:** verify a domain in Resend, set `EMAIL_FROM`, clear `EMAIL_REDIRECT_TO`.
- **Customer invoice page:** `/i/[token]` (unguessable link in every invoice email). Shows the amount due, bank details with copy buttons, the invoice, Download PDF, and "I've paid". A claim never changes the invoice; you confirm it from the invoice sheet. The first customer visit marks the invoice Opened (your own "View as customer" uses `?preview=1` and doesn't count). Drafts and scheduled invoices are never public.
- **PDF:** `/i/[token]/pdf` prints `/i/[token]/print` with headless Chrome (`CHROME_PATH`), so the PDF is the same renderer as the screen. On a host without Chrome, use `@sparticuz/chromium`.

## Phase 1 status

Built: app shell (grouped sidebar, collapse to rail with hover peek, mobile drawer, draggable pins, Ctrl K search), Home (money pipeline, to-do queue, money in, coming up), Invoices (views, search incl. `>500`, grouping by status, row actions), invoice sheet (shareable `?inv=` link, J/K, record payment with undo, reminders, pin, cancel, activity with agent details), new invoice editor (customer picker, catalogue, VAT, bank account per currency, four designs, live preview, review and send).

Also built: the customer's invoice page (`/i/[token]`) with "I've paid" claims and PDF download, email through Resend (`EMAIL_REDIRECT_TO` = test mode), customers list and customer page, catalogue (add, edit, delete with undo), payments ledger with CSV export (`/payments/export`), settings (business, invoice look, numbering, bank accounts, email status, team), editing drafts (`/invoices/INV-0144/edit`, or "Finish draft" in the sheet), and `/invoices/new?customer=<id>`.

Sign-in and onboarding: passwordless sign-in with a 6-digit email code (Better Auth, `/sign-in`), then a chat-style welcome (`/welcome`) that asks seven questions, saves each answer as it's given (refresh-safe), checks everything back in a summary, and creates the workspace. To see the sample data, sign in as `ada@adaobi.studio`. In development the code is also printed in the dev server log (`[sign-in] code for …`). Needs `BETTER_AUTH_SECRET` in `.env.local`.

Phase 2 (built): recurring series (`/recurring`), automatic reminders and receipts (background runner in `src/instrumentation.ts`; production calls `/api/cron` with `CRON_SECRET`), notifications (bell), refunds, customer credit from overpayments (used on the next invoice), bulk actions on the invoice list, invoice CSV export (`/invoices/export`), customer CSV import and export (`/customers/export`).

Organising (built): tags on invoices (panel, list chips, filter, bulk tag), saved views (filters saved as shared tabs, pinnable to the sidebar), custom invoice fields (defined in Settings, filled in the editor or panel, printed for customers only when marked).

Phase 3 (part 1, built): reports (`/reports`: invoiced vs collected, aging, by customer, category and currency, VAT, recurring revenue; CSV and print), customer statements (`/customers/<id>/statement`, PDF and email), estimates (`/estimates`; customers accept or decline at `/e/<token>`; convert to an invoice, or a deposit invoice then the rest).

Next: teams and roles (invites), custom sending domain, mobile polish, email notification digests, Google sign-in.

## Component library (Phase 0)

Live reference: **/components**. Every example on that page is interactive.

| Area | File | What's in it |
|---|---|---|
| Tokens | `src/styles/tokens.css` | Colours, status colours, type scale, spacing, radius, shadows, motion. Source of truth from Phase 1 on. |
| Styles | `src/styles/ui.css`, `src/styles/invoice.css` | Component styles (`iv-*` classes), one hover and press system, reduced-motion rules. |
| Buttons | `components/ui/button.tsx` | `Button` (primary, secondary, ghost, danger; small; icon-only), `Kbd`, `MorphLabel` (Send → Sending… → Sent). |
| Forms | `components/ui/form.tsx` | `TextField` (label, hint, error), `TextArea`, `Switch`, `Checkbox`, `Segmented`. |
| Overlays | `components/ui/overlay.tsx` | `Tooltip`, `Menu*`, `Popover*`, `Dialog*`, `Sheet*` (swipe to dismiss) and `SheetStage` (page steps back). |
| Feedback | `components/ui/toast.tsx` | `ToastProvider`, `useToast()` with optional Undo. |
| Identity | `components/ui/identity.tsx` | `Avatar`, `Tag`, `ActorChip` (person, agent, InVin, customer), `Tabs`. |
| Search | `components/ui/command.tsx` | `CommandPalette` (Ctrl/⌘K, no animation by design). |
| Status | `components/invoice/status.tsx` | `StatusPill`, `Glyph`, `STATUS_LABEL`. Icon and words on every status. |
| Money | `components/invoice/money.tsx`, `pipeline.tsx` | `Money` (lighter currency symbol), `MoneyPipeline` (the signature bar). |
| Record | `components/invoice/timeline.tsx` | `Timeline` with expandable agent execution details. |
| Invoice | `components/invoice/paper.tsx` | `InvoicePaper` (Minimal, Classic, Stacked, Bold, all with bank details), `TemplatePicker`, `ColourSwatches`. |

Rules for using them are in `../DESIGN.md`. Product facts are in `../PRODUCT.md`.

## Notes

- Sample data in `src/lib/sample.ts` is made up. The bank numbers look real but aren't; never ship them.
- `AGENTS.md` is written by `next dev`; read it before upgrading Next.js.
