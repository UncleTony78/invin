# InVin — Product & Design Plan

> Status: Draft v0.1 · 2026-11-12
> Scope: every feature end to end, the design direction, the interaction/motion spec, the data model, and a phased build order. Nothing is built yet. Decisions marked **[Decide]** need your call.

---

## 1. What InVin is

InVin is an invoicing workspace for creators, freelancers and small businesses. You create a good-looking invoice in under a minute, send it, and InVin keeps track of it until the money arrives. Then it does the same thing again next month without you asking.

**The promise:** *Bill, track and get paid, all in one calm place.*

### What we do better than the references

| What the references do | What InVin does |
| --- | --- |
| Cards inside cards inside cards (ref 2–3). Every block has a border. | One surface level per screen. We group with spacing and type, and keep borders for inputs and tables. |
| Color everywhere: green headers, blue buttons, purple gradients (refs 7–10). | The app itself stays neutral. **Your brand color only shows up on your invoices**, so every user's invoices look like their own work, not ours. |
| The invoice preview looks like a screenshot pasted into a panel. | The invoice is the main object on the page, drawn as real paper with real proportions (A4/Letter). It updates as you type and matches the PDF exactly. |
| Statuses are only pills (ref 12). | Statuses come from one state machine. Each has a color, an icon and a meaning, and the timeline explains why an invoice is in its state. |
| Activity feed is decoration (ref 2). | The activity timeline is the record: who did what, when, by which channel, with expandable details (ref 13, taken further). |
| Detail opens a full page, so you lose the list. | Detail opens in a **sheet over the list**. Arrow keys / J·K move through invoices without closing it. |
| Bare empty states. | Every empty state teaches one thing and offers one action. |

---

## 2. Users and core jobs

| User | Core job | What they care about |
| --- | --- | --- |
| Freelancer / creator | "Bill this client for this project, fast." | Speed, looking professional, getting paid on time |
| Retainer / agency | "Bill the same 6 clients every month." | Recurring series, reminders, cash-flow visibility |
| Small business | "Know who owes us what." | Customer ledger, partial payments, reports, team access |

**Jobs to be done (in priority order):**
1. Create and send a professional invoice.
2. Know the state of every invoice without asking.
3. Get paid: online payment, reminders, recording manual payments.
4. Reuse: customers, products/services, templates, recurring series.
5. Organise: categories, tags, saved views, pins.
6. Understand: dashboard and reports.

---

## 3. Information architecture

```
Sidebar
├── Workspace switcher (business name + logo, ⌄)
├── Search  ⌘K
├── Home                 (dashboard)
├── Invoices             (all · drafts · outstanding · overdue · paid · saved views…)
├── Recurring            (series)
├── Customers
├── Payments
├── Catalog              (products & services)
├── Reports
├── ── Pinned ──         (user-pinned invoices, customers, series, saved views; drag to reorder)
├── ── bottom ──
├── Settings
├── Help & shortcuts  ?
└── Account (avatar)

Public (no login)
├── /i/[token]           hosted invoice page (view, download, pay)
├── /r/[token]           receipt
└── /p/[token]           customer portal: every invoice for that customer
```

**Global layer (works on every page):** command palette (⌘K), quick create (C → new invoice), toasts, the detail sheet, keyboard shortcuts overlay (?).

---

## 4. Features, end to end

### 4.1 Onboarding (first-run)
- Sign up with email magic link, Google, or password.
- **3 steps, skippable, with a live preview:** business name and logo → brand color (pulled from the logo automatically) and currency → how you get paid (bank details and other payment instructions).
- The preview on the right shows *your* invoice taking shape as you fill in each step. This is the "aha" moment.
- Ends on "Create your first invoice", with sample data pre-filled and easy to clear.

### 4.2 Home (dashboard)
- **4 numbers at the top:** Outstanding, Overdue, Paid (this month), Avg. days to get paid. Each one has a delta and clicks through to a filtered list.
- **Cash-flow chart:** invoiced vs. collected over time, with forecasted inflow from due and recurring invoices shown dashed.
- **Needs attention:** overdue invoices, failed payments, invoices viewed but unpaid for 7+ days. Each row has an inline action (Remind / Record payment).
- **Upcoming:** the next recurring runs and scheduled sends for the next 14 days.
- **Recent activity:** the last 10 events across the workspace.
- Empty state: a guided checklist (brand → customer → invoice → send).

### 4.3 Invoices list
- Table with columns: Number, Customer, Category, Issue date, Due date, Status, Amount, Balance. Columns can be shown or hidden.
- **Views:** All, Drafts, Outstanding, Overdue, Paid, Scheduled. You can save your own views (filter + sort + columns), and a saved view can be pinned.
- **Filters:** status, customer, category, tag, date range, amount range, currency, recurring/one-off. Filters show as removable chips.
- **Search:** number, customer, line item text, amount (`>500`, `=2450`).
- **Bulk actions:** send, remind, mark paid, change category, download PDFs (zip), export CSV, void.
- **Row actions (hover or ⋯):** open, duplicate, download, copy link, pin, remind, record payment, void.
- **Grouping:** by status, customer, category or month.
- Click a row to open the detail sheet. The list stays visible behind it.

### 4.4 Invoice detail (sheet)
- Header: number, status pill, amount, balance due, customer chip, and actions (Send / Remind / Record payment / ⋯).
- Tabs: **Overview** (paper preview + key facts), **Activity**, **Payments**.
- Key facts: issue date, due date, terms, category, tags, recurring series link, currency.
- Actions in ⋯: edit, duplicate, convert to recurring, pin, download PDF, copy link, void, delete (drafts only).
- **Pin to sidebar** puts the invoice in the sidebar's Pinned section.
- Keyboard: ↑/↓ or J/K for previous/next invoice, E edit, P pin, Esc close.
- On wide screens the sheet can be expanded to a full page (shareable URL `/invoices/INV-0124`).

### 4.5 Invoice editor (create / edit)
Split layout: **form on the left, live paper preview on the right.** On mobile the preview is a toggle.

- **Customer:** search existing customers or create one inline (name, email, address), without leaving the editor.
- **Details:** number (auto, editable), issue date, due date or terms (Net 7/14/30, Due on receipt, custom), currency, language/locale, PO/reference.
- **Line items:** pick from the catalog or type freely. Each line has description, qty, unit, rate, tax and a per-line discount. Lines can be reordered by dragging, collapsed into sections ("Phase 1"), and given an optional image.
- **Totals:** subtotal, discounts (% or fixed; per line or whole invoice), taxes (multiple, inclusive or exclusive), shipping/fees, deposit/amount already paid, total, balance due.
- **Extras:** notes, terms, payment instructions, attachments (PDF/images), signature.
- **Categorise:** category (one) and tags (many).
- **Autosave** every change to the draft, with a "Saved" indicator. No Save button anxiety.
- **Validation:** inline and calm. "Send" stays enabled and the send sheet lists what's missing.
- **Primary actions:** Send… (opens the send sheet) · secondary: Save as draft, Schedule, Preview as client.
- Shortcuts: ⌘↵ add line, ⌘S save, ⌘⇧P toggle preview.

### 4.6 Customisation (templates and branding)
- **Brand kit (workspace level):** logo, brand color, accent, font pair (4 curated pairs), business details, default notes, terms, footer.
- **Templates:** 4 layouts to start (Classic, Modern, Minimal, Bold header). Each one can be configured:
  - show/hide fields (tax ID, PO, QR pay code, signature, item images)
  - custom fields (e.g. "Project", "VAT reg")
  - paper size (A4 / Letter), number and date format
- Set a default template per workspace, override it per customer or per invoice.
- **The preview is the PDF.** One renderer for screen, PDF and the client page, so what you see is what they get.

### 4.7 Sending and delivery
- **Send sheet:** to/cc (from customer contacts), subject, message (with a template and variables like `{customer.first_name}`, `{invoice.due_date}`), attach PDF on/off, include pay button on/off, schedule for later.
- Channels: email (from InVin, or a custom sending domain in Settings) and **copy link** (for WhatsApp, DM and so on). WhatsApp share is a deep link.
- After sending: status → Sent, the timeline logs it, and a toast offers Undo for 5s (cancels the queued email).
- **Tracking:** delivered, opened (email), viewed (hosted page load), downloaded, payment started.

### 4.8 Hosted invoice page (client side)
- Clean page with the invoice (same renderer), payment instructions with copy buttons, **I've paid**, Download PDF, and a contact link for the sender.
- Once the sender confirms payment: receipt emailed, and the invoice on the page is stamped **Paid**.
- Later, with a provider: a **Pay now** button (card / bank / local methods) and partial payment if the sender allows it.
- **Customer portal** (optional link): all invoices for that customer, with paid/unpaid totals and statements.
- No InVin branding on paid plans.

### 4.9 Payments
- **Decided: no payment provider at launch.** Users get paid outside InVin (bank transfer, cash, etc.) and record payments in InVin. The payment layer is built behind a provider-agnostic interface (`PaymentProvider`: create checkout, handle webhook, refund), so Stripe or Paystack can be added later without touching invoices.
- **Payment instructions** (bank name, account name and number, other methods) are set in Settings and printed on every invoice and the hosted page. On the hosted page each detail has a copy button.
- **"I've paid" on the hosted page:** the client can say they've paid (amount, date, reference, optional proof upload). The sender gets a notification and confirms with one click, which records the payment. Unconfirmed claims never change the invoice status.
- **Online (later):** provider webhooks mark invoices paid or partially paid automatically.
- **Manual:** "Record payment" with amount (defaults to balance), date, method (bank transfer, cash, cheque, other), reference and a note.
- **Partial payments** reduce the balance and set status → Partially paid.
- **Overpayment** becomes a customer credit, applied to the next invoice.
- **Refunds:** full or partial, logged on the invoice and the payment.
- **Receipts:** sent automatically on payment (toggle).
- **Payments page:** ledger of all payments with filters, export, and matching to invoices.

### 4.10 Reminders (dunning)
- Default schedule per workspace, e.g. 3 days before due, on due date, 3 / 7 / 14 days overdue. Each reminder has editable email copy.
- Can be overridden or paused per customer or per invoice.
- Optional late fee (fixed or %), applied after N days.
- Every reminder is logged on the timeline. Manual "Remind now" is always available.

### 4.11 Recurring invoices (series)
- Make any invoice recurring, or create a series directly.
- **Schedule:** weekly, monthly, quarterly, yearly or custom; start date; end (never, after N invoices, or on a date); timezone.
- **Behaviour:** auto-send or create as draft for review; auto-charge (later, once a payment provider is connected); amount fixed or variable (prompt before each run).
- **Series page (improving ref 12):** header facts (amount, next run, sent N/M, status, active toggle), a table of occurrences (Upcoming, Queued, Sent, Paid, Overdue, Skipped, Failed), and actions (Skip next, Edit future, Pause, End).
- Editing a series asks: "This and future" vs "Future only".

### 4.12 Customers
- List: name, email, outstanding, overdue, total billed, last invoice. Sortable, filterable, taggable.
- **Customer page:** contact details and multiple contacts (billing/CC), addresses, tax ID, default currency/terms/template/language, and a notes field.
  - Summary: lifetime billed, paid, outstanding, avg days to pay (a reliability signal).
  - Tabs: Invoices · Recurring · Payments · Activity · Statements (generate a PDF statement for a period).
- Import from CSV. Merge duplicates. Pin to sidebar.

### 4.13 Catalog (products and services)
- Items with name, description, unit (hour, day, item, project), rate, tax default and category.
- Search them while adding a line in the editor. Usage stats ("used on 14 invoices").

### 4.14 Organising: categories, tags, saved views, pins
- **Categories:** one per invoice, colored, user-defined (e.g. Design, Consulting, Retainer). Used for reports.
- **Tags:** many per invoice, free-form.
- **Saved views:** any filtered list, named and optionally pinned.
- **Pins:** invoices, customers, series and saved views. Pinned items appear in the sidebar's Pinned section and can be dragged to reorder. Hover shows unpin. Soft limit of 10, with a hint.

### 4.15 Search and command palette (⌘K)
- One box for jumping (to any invoice, customer or page) and for actions ("New invoice for Acme", "Record payment INV-0124", "Toggle theme").
- Recent items first. Results are grouped. Every action has a keyboard path.

### 4.16 Activity and audit
- Every entity has a timeline: created, edited (field diff), sent, viewed, reminded, paid, refunded, voided, plus comments.
- Actor types: **user**, **customer**, **system** (scheduler/webhook), and later **agent** (with execution details, like ref 13).
- Workspace-wide audit log in Settings (paid tier).

### 4.17 Reports
- Revenue (invoiced vs. collected), outstanding by age (0–30 / 31–60 / 61–90 / 90+), by customer, by category, tax summary, recurring revenue (MRR-style).
- Date range picker and multi-currency (converted at a snapshot rate, with the original amounts shown).
- Export CSV / PDF.

### 4.18 Notifications
- In-app inbox (bell): viewed, paid, failed payment, overdue, recurring created.
- Email digests: daily or weekly, toggles per event.
- Optional later: Slack and WhatsApp.

### 4.19 Settings
- **Business:** profile, addresses, tax IDs, logo, brand kit.
- **Invoicing defaults:** numbering (prefix, next number, padding, reset yearly), terms, notes, currency, template, locale.
- **Taxes:** saved tax rates.
- **Payments:** connect provider(s), bank details, allow partial payments, fees.
- **Reminders:** schedule and copy.
- **Emails:** sender name, reply-to, custom domain, email templates.
- **Team (paid):** invite members, roles (Owner, Admin, Member, Viewer).
- **Plan and billing**, **Data:** import/export, delete workspace.
- **Account:** profile, security, theme (light/dark/system), shortcuts.

### 4.20 Estimates / quotes (v2)
- Same editor. Client can accept or decline on the hosted page. Converts to an invoice in one click, or to a deposit invoice plus final invoice.

### 4.21 AI assist (v2, optional)
- "Describe it" invoice drafting: *"10 hours of design for Acme at $80, due in 14 days"* → a filled draft.
- Payment-risk hints per customer, based on pay history.
- Ask InVin: questions about your numbers ("Who owes me the most?").
- Agent actions are logged on the timeline with execution details.

---

## 5. Status model

**Invoice status** (one source of truth; the UI never invents statuses):

```
Draft ──send──▶ Sent ──view──▶ Viewed
  │  └─schedule─▶ Scheduled ─(time)─▶ Sent
  │
Sent/Viewed ──partial pay──▶ Partially paid ──full──▶ Paid
Sent/Viewed ──full pay─────────────────────────────▶ Paid
(any unpaid, past due date) ═ derived ═▶ Overdue (badge on top of Sent/Viewed/Partially paid)
Paid ──refund──▶ Refunded / Partially refunded
(any non-paid) ──void──▶ Void
```

| Status | Color token | Icon |
| --- | --- | --- |
| Draft | neutral | pencil-line |
| Scheduled | neutral-blue | clock |
| Sent | blue | send |
| Viewed | violet | eye |
| Partially paid | teal | circle-half |
| Paid | green | check-circle |
| Overdue | amber → red past 30 days | alert-triangle |
| Void | neutral, struck through | slash |
| Refunded | neutral-green | rotate-ccw |
| Payment failed (event) | red | x-circle |

**Series status:** Active, Paused, Ended. **Occurrence status:** Upcoming, Queued, Generated, Skipped, Failed.

---

## 6. Data model (first cut)

```
User ─┬─< Membership >─ Workspace
      │                   ├─< Customer ─< Contact
      │                   ├─< CatalogItem
      │                   ├─< TaxRate
      │                   ├─< Category / Tag
      │                   ├─< Template (brand + layout config)
      │                   ├─< Invoice ─┬─< LineItem
      │                   │            ├─< InvoiceTax / Discount
      │                   │            ├─< Payment ─< Refund
      │                   │            ├─< Attachment
      │                   │            ├─< Reminder (scheduled/sent)
      │                   │            └─< Event (activity)
      │                   ├─< RecurringSeries ─< Occurrence ─> Invoice
      │                   ├─< SavedView
      │                   ├─< Pin (user-scoped, entity ref, position)
      │                   └─< Notification
```

Rules:
- **Money is stored as integer minor units plus a currency code.** Never floats. Each invoice snapshots its exchange rate for reporting.
- **Invoices snapshot** customer details, business details and the template at send time, so later edits don't rewrite history.
- Invoice numbers are unique per workspace and allocated in a transaction.
- **Events are append-only** and drive both the timeline and notifications.
- Public tokens are random and unguessable, separate from IDs, and can be revoked.

---

## 7. Design direction

### 7.1 Principles
1. **The invoice is the hero.** The app chrome stays quiet so the document stands out.
2. **Neutral app, branded output.** Brand color lives on invoices, the hosted page and emails, and almost nowhere in the app.
3. **One level of surface.** Canvas → surface. Elevation is used only for things that float (sheets, menus, modals).
4. **Numbers are first-class.** Tabular figures, aligned decimals, currency symbols at reduced weight.
5. **Calm density.** Information-rich tables with generous row height, and secondary info in a muted tone.
6. **Every state is designed:** empty, loading (skeletons), error, partial, offline.

### 7.2 Visual system (starting point; validated with comps in Phase 0)
- **Canvas:** warm off-white `#F7F7F5` (light) / `#0E0E0F` (dark). **Surface:** `#FFFFFF` / `#161617`.
- **Ink:** `#111111` primary text, `#6B6B6B` secondary, `#A3A3A3` tertiary. Hairline borders at `rgba(0,0,0,0.06)`.
- **Primary action:** ink-black button (white in dark mode). It looks confident, doesn't compete with status colors, and lets user brand colors show.
- **Status palette:** soft-tinted backgrounds with saturated text and icon (as in §5), tuned for contrast in both themes.
- **Type:** IBM Plex Sans (UI) with tabular figures; IBM Plex Mono for invoice numbers and IDs. Invoices use the user's chosen font pair. *(Changed 2026-11-13 to follow the user's main reference; tokens in `design/tokens.css`.)*
- **Radius:** 8 (inputs/buttons), 12 (cards/menus), 16 (sheets/modals). **Spacing:** 4-pt scale.
- **Icons:** Lucide at 1.5 stroke, 16/20 px.
- **Materials:** the sheet and command palette use a light backdrop blur over a dimmed canvas. The paper preview has a two-layer soft shadow so it reads as a physical object.
- **Imagery:** used sparingly. Onboarding and empty states get small monochrome illustrations; marketing pages get large photographic or gradient moments (refs 4/6 energy). Sourced from the asset sites you shared, license checked per asset (recent.design is inspiration only, not reusable assets).

### 7.3 Comps before code
Phase 0 produces 3 high-fidelity comps (Dashboard, Invoices list + open sheet, Editor) in two accent directions. You pick one before we build the component library.

---

## 8. Interaction and motion spec

Rules (from the design-engineering principles we're following):
- **Frequency decides.** Things done 100×/day (⌘K, J/K navigation, typing in the editor, tab switches) get **no animation**. Occasional things (sheets, modals, menus, toasts) get short, purposeful motion. Rare moments (first invoice sent, first payment) can delight.
- **Easing:** enter/exit `cubic-bezier(0.23, 1, 0.32, 1)`; on-screen movement `cubic-bezier(0.77, 0, 0.175, 1)`; sheets `cubic-bezier(0.32, 0.72, 0, 1)`. Never `ease-in`.
- **Durations:** press 120 ms · tooltip 125 ms · menu 160 ms · modal 200 ms · sheet 280 ms. **Exits are faster than entries.**
- Only `transform`, `opacity` (and `clip-path` / small `filter: blur`) are animated. CSS transitions are used for anything interruptible. Springs are used for drag.
- `prefers-reduced-motion`: movement is removed and fades kept. Hover effects only apply on `(hover: hover) and (pointer: fine)`.

### Catalogue of micro-interactions

| Where | Interaction | Spec |
| --- | --- | --- |
| All buttons and pressables | Press feedback | `scale(0.97)` on `:active`, 120 ms ease-out |
| Sidebar | Active indicator | Background pill slides to the new item (shared layout), 200 ms in-out. Not animated when using keyboard nav |
| Sidebar | Collapse to icon rail | Width via `transform` on the inner content, 240 ms drawer curve. Labels fade 120 ms |
| Sidebar → Pinned | Pin an item | Pinned row enters with height + opacity, plus a one-time soft highlight that fades over 600 ms. The pin icon in the sheet fills with a 160 ms rotate-in |
| Pinned list | Reorder | Drag with spring (bounce 0.15). Neighbors shift with layout animation. Pointer capture on drag |
| Filters / view switcher (ref 1) | Dropdown | Origin-aware scale 0.96→1 + opacity, 160 ms. Selected item gets a check and tinted row. No animation on keyboard open |
| Invoice row | Open detail | Sheet slides in from the right with `translateX(100%)→0`, 280 ms drawer curve. Canvas dims to 20%. Row stays highlighted behind it |
| Detail sheet | Next/prev invoice (J/K) | Content swaps **instantly** (no animation). The list highlight follows |
| Detail sheet | Close | 200 ms exit, faster than entry. Esc, click outside, or swipe right on touch (velocity > 0.11 dismisses) |
| Status pill | Status changes | Background and text crossfade with a 2 px blur bridge, 200 ms. Width animates via layout |
| Paid moment | First time an invoice is paid in-session | A "PAID" stamp presses onto the paper preview: scale 1.08→1 + opacity, 240 ms, single soft bounce. Rare enough to earn it |
| Editor | Typing | Preview updates instantly. No animation |
| Editor | Add line item | Row enters with height + opacity 180 ms. Focus jumps to description |
| Editor | Remove line item | Row collapses 150 ms. Undo toast for 5 s |
| Editor | Totals change | Digits update instantly. A 150 ms subtle highlight on the changed figure only when the change came from another field (e.g. tax toggled) |
| Editor | Drag to reorder lines | Grab handle on hover. Lifted row gets shadow + scale 1.01. Spring settle |
| Send button | Send flow | Label morphs Send → Sending… → Sent ✓ with a blur crossfade. Button width animates. The sheet closes after 600 ms |
| Destructive actions (void, delete) | Hold to confirm | `clip-path` fill over 1.2 s linear while held. Release snaps back 200 ms. Click alternative opens a confirm dialog (accessible path) |
| Toasts | Feedback / undo | Bottom-center stack, enter from below, swipe to dismiss, timers pause on hover and while the tab is hidden |
| Modals | Open / close | Centered, scale 0.96→1 + opacity 200 ms. Exit 150 ms |
| Tooltips | Hover | 400 ms delay on the first one, then instant for adjacent ones (no animation) |
| ⌘K palette | Open | **No animation.** Appears instantly |
| Tables | Loading | Skeleton rows that match real row heights. No spinners for page loads |
| Lists | First paint | 30 ms stagger on the first 8 rows, once per session. Never blocks clicks |
| Dashboard | Chart hover | Crosshair follows the pointer with no lag. The tooltip moves with a light spring (decorative) |
| Copy link | Click | Icon morphs copy → check for 1.5 s, plus a toast |
| Mobile | Sheets | Bottom sheet, drag to dismiss with velocity, rubber-banding past the top |

---

## 9. Page and screen inventory

**App:** Sign in · Sign up · Onboarding (3) · Home · Invoices list · Invoice sheet · Invoice full page · Editor (new/edit) · Send sheet · Record payment modal · Recurring list · Series page · Series editor · Customers list · Customer page · Customer form · Payments ledger · Catalog · Reports (5 tabs) · Notifications · Settings (10 sections) · Command palette · Shortcuts overlay · Empty states for each list · Error/404.

**Public:** Hosted invoice · Payment success · Receipt · Customer portal · (v2) Estimate accept.

**Marketing (later):** Landing · Pricing · Templates gallery · Changelog.

---

## 10. Technical architecture (recommended)

| Layer | Choice | Why |
| --- | --- | --- |
| App | **Next.js (App Router) + TypeScript** | SSR for public invoice pages, server actions, one codebase |
| UI | **Tailwind CSS v4 + Base UI/Radix primitives** (shadcn-style, our own styling) | Accessible primitives, full control of look and motion |
| Motion | **Motion** (springs, layout) + CSS transitions | As in §8 |
| Data | **Postgres (Neon) + Drizzle ORM** | Relational money data, branching for previews |
| Auth | **Better Auth** (or Neon Auth) | Magic link, OAuth, orgs/teams |
| PDF | **One React invoice renderer** → PDF through a headless Chromium render | The preview and the PDF are pixel-identical |
| Email | **Resend + React Email** | Templated, trackable |
| Payments | **None at launch.** Manual recording behind a `PaymentProvider` interface | Stripe or Paystack can be added later without changing invoice logic |
| Jobs | Scheduled queue (e.g. Inngest / Trigger.dev / cron functions) | Recurring runs, reminders, scheduled sends |
| Files | Object storage | Logos, attachments, generated PDFs |
| Hosting | Vercel (or similar) | Preview deploys per branch |

---

## 11. Build roadmap

**Phase 0 — Foundations (design first)**
Brand name treatment and logo, design tokens, 3 key comps in 2 directions, component library (button, input, select, menu, sheet, modal, toast, table, pill, tooltip, command palette), motion tokens.

**Phase 1 — MVP: "send an invoice and get paid"**
Auth + workspace · onboarding · customers · catalog · editor with live preview · 1–2 templates + brand kit · send by email/link · hosted invoice page (with "I've paid") · PDF download · manual payment recording · invoices list with views/filters · detail sheet with timeline · pins · ⌘K · dashboard v1.

**Phase 2 — "runs itself"**
Recurring series · reminders/dunning · partial payments, credits, refunds · receipts · notifications · categories/tags/saved views · more templates and custom fields · CSV import/export · bulk actions.

**Phase 3 — "grows with you"**
Reports · customer portal and statements · teams and roles · custom email domain · multi-currency reporting · estimates/quotes · mobile polish.

**Phase 3.5 — online payments**
Connect a provider (Stripe and/or Paystack) · Pay now on the hosted page · webhooks · auto-charge for recurring series.

**Phase 4 — "smart"**
AI drafting · payment-risk hints · Ask InVin · agent actions in the timeline · integrations (accounting export, Slack, WhatsApp).

---

## 12. Open questions [Decide]

1. ~~Payments~~ **Decided:** no provider at launch; manual recording + "I've paid". **Still open:** who are the first users and where, and which currencies matter at launch?
2. **Solo or teams at launch?** Teams add roles and permissions work. Recommendation: solo-first, teams in Phase 3.
3. **Business model:** free tier limits (e.g. 5 invoices/month, InVin branding on the hosted page) vs. paid.
4. **Brand:** do you already have an InVin logo and color, or do we design them in Phase 0?
5. **Platform:** web-only (responsive) at launch, or a mobile app later?
6. **Stack:** OK with the recommendation in §10, or do you have preferences or existing accounts (Vercel, Neon, Supabase…)?
7. **Estimates/quotes:** needed in MVP, or fine in Phase 3?
