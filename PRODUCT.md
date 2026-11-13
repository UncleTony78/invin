# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) + TypeScript, Tailwind CSS v4 with Base UI/Radix primitives, Motion, Postgres (Neon) + Drizzle, Better Auth, Resend + React Email, a scheduled job queue, object storage, one React invoice renderer printed to PDF with headless Chromium. Confirmed by the user (2026-11-13). Full detail in `docs/PLAN.md` §10.

## Users

- **Freelancers and creators** billing a client for a project; they want speed and to look professional.
- **Retainers and agencies** billing the same clients every month; they want recurring series, reminders and cash-flow visibility.
- **Small businesses** that need to know who owes what; they want a customer ledger, partial payments, reports and team access.

Global from day one: any currency, with the default picked at onboarding.

## Product Purpose

InVin is an invoicing workspace. You create a good-looking invoice in under a minute, send it, and InVin tracks it until the money arrives, then does it again next period without being asked. Promise: *bill, track and get paid, all in one calm place.*

## Positioning

The app stays neutral and the user's own brand lives on their invoices, the hosted invoice page and emails. One status model drives every pill, filter and timeline entry. Every change is on an append-only activity record that names who did it: a teammate, the customer, the system or an authorised AI agent, with execution details for agent actions.

## Operating Context

Daily, desk-based work in a browser: creating and sending invoices, checking what is outstanding or overdue, recording payments that arrive by bank transfer or cash, and running monthly recurring series. Clients receive an email and a hosted invoice page with payment instructions, a PDF and an "I've paid" button.

## Capabilities and Constraints

- Invoices, customers, catalog, recurring series, payments, reminders, categories, tags, saved views, pins, ⌘K, reports, notifications (`docs/PLAN.md` §4).
- **No payment provider at launch.** Payments are recorded manually or confirmed from the client's "I've paid"; a provider-agnostic interface allows Stripe/Paystack later.
- **Teams and AI agents at launch.** Members with roles; agents act through an authorised connection (MCP), and each agent action records who authorised it, the connection, the operation and the result.
- Multi-currency; money stored as integer minor units plus a currency code.
- Undecided: free-tier limits and pricing; mobile app vs. responsive web only; estimates/quotes in MVP.

## Brand Commitments

- Name: **InVin** in sentences, lowercase **invin** wordmark in the logo.
- Logo: the Slot mark (tile with a coin slot) plus a custom wordmark, in `brand/logo/final/`. Tangerine `#FF5A1F`, ink `#16130F`, paper `#F4F1EA`.
- Copy must be plain and easy to read (user requirement).
- Main interface reference (user-supplied, 2026-11-13): a light, flat, quiet invoicing UI with an icon-rail sidebar, breadcrumb top bar with centred search, detail sheet with General/Activity tabs, an activity timeline with expandable agent execution details, and a recurring series page with a facts row, status table and a Details/Activity side panel.

## Evidence on Hand

No real customers, testimonials, usage data or pricing yet. All comp data is sample data and must not be presented as real.

## Product Principles

1. The invoice is the hero; the app chrome stays quiet.
2. Every state is explained: status, why it is in that state, and who caused it.
3. Calm speed: frequent actions are instant, keyboard-reachable and never animated for show.
4. Plain words over finance jargon.
5. Humans stay in control of agents: every agent action is authorised, logged and reversible where possible.

## Accessibility & Inclusion

WCAG 2.1 AA: text contrast at least 4.5:1, full keyboard paths, visible focus, reduced-motion support, and status never shown by colour alone (each status pill has an icon and a label).
