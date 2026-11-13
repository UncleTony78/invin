# InVin design system

Source of truth for how the app looks and moves. Product facts live in `PRODUCT.md`.

- **Components:** `web/src/components` (React, Base UI), live at `/components` when `npm run dev` runs in `web/`. Inventory in `web/README.md`.
- **Tokens:** `web/src/styles/tokens.css` (the Phase 0 copy in `design/tokens.css` is kept for the HTML comps).
- **Screen comps:** `design/comps/index.html`.

## World

A quiet, flat workspace. The page is calm, warm grey and white; the user's invoices carry the colour. InVin's own tangerine appears only as a signal: the logo, the focus ring, an agent's spark, pinned and "just changed" highlights.

- **Inspired by** the user's reference screens (rail sidebar, centred search, activity timeline with agent details, recurring series page), not copied from them.
- **Mode:** Operate. Familiar controls, dense but calm, and structure that stays predictable.

## Hierarchy rules

1. **One lead per screen.**
   - Home leads with *Owed to you*.
   - Invoices leads with the money pipeline and the Overdue group.
   - The sheet leads with the amount and its progress.
   - The editor leads with the live invoice.
2. **Group by relationship.** Use proximity before boxes. Containers only appear where they mean something:
   - a payment form
   - agent details
   - account details on paper
3. **Controls sit next to what they change.** The design and colour pickers sit above the invoice preview, and *Getting paid* sits beside the account details that print.
4. **Two boxes deep at most.** No cards inside cards.

## Signature: the money pipeline

One segmented bar:
- **Drafts:** hatched, because they haven't been sent.
- **Not due yet:** blue.
- **Overdue:** amber.
- **Paid this month:** green.

The same bar appears on Home (large, with a legend) and Invoices (thin, with totals). Every segment filters the list. Segments resize with a 520 ms in-out ease when money moves.

## Type and colour

- **IBM Plex Sans** for UI; **IBM Plex Mono** for invoice numbers and IDs. Both SIL OFL. Product scale ×1.2.
- **Neutrals:** canvas `#F2F2EF`, surface `#FFF`, text `#1A1916` / `#5F5D58`.
- **Status colours:** each is a soft tint with saturated text and icon, and every one has an icon so colour is never the only signal.
- **Agent:** tangerine family, never violet. No violet anywhere.

## Invoice designs

There are four designs on one renderer and one data shape:
- **Minimal:** white space, with the amount due in the header.
- **Classic:** a lettered header, a brand rule, a tinted table head and a totals band.
- **Stacked:** a brand-colour band with the amount due, then labelled rows: Billed to, Items, How to pay, From.
- **Bold:** an oversized amount due, three-column meta and a bank card.

Every design prints:
- the full bank details for the invoice's currency, with "use the invoice number as the reference"
- the sender's details
- the customer's address
- the note

The bank account is picked automatically from the customer's currency and can be changed.

## Motion

| Moment | Spec |
|---|---|
| Press | 1px down, scale .985, 90 ms |
| Hover (buttons) | 1px up, 140 ms in / 200 ms out |
| Sheet | slides in at 300 ms on the drawer curve, exits faster; the page behind scales to .982 (depth) |
| Sidebar collapse | grid track, 280 ms on the drawer curve |
| Sidebar rail peek | clip-path reveal on a translucent material after 260 ms of hover intent |
| Mobile drawer | swipe to close, decided by velocity |
| Pin | an icon flies to the sidebar on an arc (separate X and Y easings), then the row grows in and flashes |
| Pinned reorder | drag with a 4px threshold; neighbours make room; settles in 200 ms |
| Template switch | View Transition crossfade with a 3px blur and a 1.5% scale |
| Popovers | scale from the trigger, 160 ms; menus open instantly by keyboard |
| Modal | centred, scale .96 → 1, 220 ms; exit 150 ms; focus stays inside |
| Payment | progress bar fills, status pill crossfades with blur, PAID stamp lands (300 ms, single soft overshoot) |
| Send | label morphs Send → Sending… → Sent ✓ with a blur crossfade |
| Agent details | rows reveal with height, opacity and blur, 260 ms |
| Never animated | ⌘K, J/K, tabs, typing, totals updating |

Reduced motion keeps fades and state changes and drops movement. Reduced transparency makes the materials solid.

## Copy

Plain words over finance terms:
- "Owed to you", not "Accounts receivable"
- "Left to pay", not "Balance"
- "Opened", not "Viewed"
- "Time to pay", not "Terms"

Buttons say what they do, and errors and empty states say what to try next.
