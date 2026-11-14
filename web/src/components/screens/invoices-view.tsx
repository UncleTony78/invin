"use client";

import { useWorkspaceCurrency } from "@/components/shell/workspace-context";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, MorphLabel } from "@/components/ui/button";
import { Checkbox, Switch } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Avatar, Tabs } from "@/components/ui/identity";
import { Dialog, DialogClose, DialogContent, Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger, Tooltip } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { Money } from "@/components/invoice/money";
import { MoneyPipeline, type PipelineKey } from "@/components/invoice/pipeline";
import { StatusPill } from "@/components/invoice/status";
import { useInvoiceSheet } from "@/components/shell/invoice-sheet";
import { formatMoney, formatShort, tintFor, type Currency } from "@/lib/format";
import { toHomeMinor } from "@/lib/fx";
import { bulkInvoices, sendReminder, togglePin, type BulkOp } from "@/server/actions";
import type { InvoiceRow, PipelineData } from "@/server/queries";

type View = "all" | "open" | "overdue" | "drafts" | "scheduled" | "paid";
const VIEWS: { value: View; label: string; test: (r: InvoiceRow) => boolean }[] = [
  { value: "all", label: "All", test: () => true },
  { value: "open", label: "Waiting for payment", test: (r) => ["sent", "viewed", "partial"].includes(r.stored) },
  { value: "overdue", label: "Overdue", test: (r) => r.status === "overdue" },
  { value: "drafts", label: "Drafts", test: (r) => r.stored === "draft" },
  { value: "scheduled", label: "Scheduled", test: (r) => r.stored === "scheduled" },
  { value: "paid", label: "Paid", test: (r) => r.stored === "paid" },
];
const GROUPS: { key: string; label: string; test: (r: InvoiceRow) => boolean }[] = [
  { key: "overdue", label: "Overdue", test: (r) => r.status === "overdue" },
  { key: "open", label: "Waiting for payment", test: (r) => ["sent", "viewed", "partial"].includes(r.stored) && r.status !== "overdue" },
  { key: "scheduled", label: "Scheduled", test: (r) => r.stored === "scheduled" },
  { key: "draft", label: "Drafts", test: (r) => r.stored === "draft" },
  { key: "paid", label: "Paid", test: (r) => r.stored === "paid" },
  { key: "cancelled", label: "Cancelled", test: (r) => r.stored === "cancelled" },
];
const VIEW_FOR: Record<PipelineKey, View> = { draft: "drafts", open: "open", overdue: "overdue", paid: "paid" };

export function InvoicesView({ rows, pipeline, initialView, fresh, initialQ, categories = [] }: { rows: InvoiceRow[]; pipeline: PipelineData; initialView: string; fresh?: string; initialQ?: string; categories?: string[] }) {
  const home = useWorkspaceCurrency() as Currency;
  const router = useRouter();
  const sheet = useInvoiceSheet();
  const toast = useToast();
  const [view, setView] = useState<View>((VIEWS.find((v) => v.value === initialView)?.value ?? "all") as View);
  const [q, setQ] = useState(initialQ ?? "");
  const [grouped, setGrouped] = useState(true);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  // Selection for bulk actions. Shift-click selects everything between the last click and this one.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const lastPick = useRef<string | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- follow ?view= when a pin or the pipeline links here
  useEffect(() => setView((VIEWS.find((v) => v.value === initialView)?.value ?? "all") as View), [initialView]);

  const filtered = useMemo(() => {
    const test = VIEWS.find((v) => v.value === view)!.test;
    const needle = q.trim().toLowerCase();
    return rows.filter(test).filter((r) => {
      if (!needle) return true;
      const m = needle.match(/^([<>=])\s*(\d+(?:\.\d+)?)$/);
      if (m) {
        const n = parseFloat(m[2]) * 100;
        return m[1] === ">" ? r.total > n : m[1] === "<" ? r.total < n : r.total === n;
      }
      return `${r.number} ${r.customer} ${r.category ?? ""}`.toLowerCase().includes(needle);
    });
  }, [rows, view, q]);

  const allPicked = filtered.length > 0 && filtered.every((r) => picked.has(r.id));
  function pick(id: string, range: boolean) {
    setPicked((cur) => {
      const next = new Set(cur);
      const turnOn = !cur.has(id);
      const order = filtered.map((r) => r.id);
      const a = lastPick.current ? order.indexOf(lastPick.current) : -1;
      const b = order.indexOf(id);
      const span = range && a >= 0 && b >= 0 ? order.slice(Math.min(a, b), Math.max(a, b) + 1) : [id];
      for (const x of span) {
        if (turnOn) next.add(x);
        else next.delete(x);
      }
      return next;
    });
    lastPick.current = id;
  }
  // Escape clears a selection before it closes anything else
  useEffect(() => {
    if (!picked.size) return;
    const sheetOpen = !!sheet.current;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !sheetOpen && setPicked(new Set());
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [picked.size, sheet]);

  const sections = grouped ? GROUPS.map((g) => ({ ...g, rows: filtered.filter(g.test) })).filter((g) => g.rows.length) : [{ key: "all", label: "", test: () => true, rows: filtered }];
  const ordered = sections.flatMap((g) => (closed.has(g.key) ? [] : g.rows));
  useEffect(() => {
    sheet.setOrder(ordered.map((r) => r.id));
  });

  // J / Enter on the list opens the first invoice; the sheet takes over J/K from there
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet.current || e.metaKey || e.ctrlKey || /INPUT|TEXTAREA/.test(document.activeElement?.tagName ?? "") || document.querySelector("[role=dialog]")) return;
      if ((e.key === "j" || e.key === "Enter") && ordered[0] && document.activeElement === document.body) sheet.open(ordered[0].id);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  function changeView(v: View) {
    setView(v);
    const url = new URL(location.href);
    if (v === "all") url.searchParams.delete("view");
    else url.searchParams.set("view", v);
    history.replaceState(history.state, "", url);
  }

  return (
    <div className="wrap">
      <div className="ph" style={{ paddingBottom: 20 }}>
        <div>
          <h1>Invoices</h1>
          <p className="sub">{rows.length} invoices · {rows.filter((r) => ["sent", "viewed", "partial"].includes(r.stored)).length} waiting for payment</p>
        </div>
        <div className="acts">
          <Button icon="plus" variant="primary" onClick={() => router.push("/invoices/new")}>New invoice</Button>
        </div>
      </div>

      <div className="inv-sum">
        <MoneyPipeline
          variant="thin"
          onSelect={(k) => changeView(VIEW_FOR[k])}
          segments={[
            { key: "draft", label: "Drafts", value: pipeline.draft[0] / 100, count: pipeline.draft[1] },
            { key: "open", label: "Not due yet", value: pipeline.open[0] / 100, count: pipeline.open[1] },
            { key: "overdue", label: "Overdue", value: pipeline.overdue[0] / 100, count: pipeline.overdue[1] },
            { key: "paid", label: "Paid this month", value: pipeline.paid[0] / 100, count: pipeline.paid[1] },
          ]}
        />
        <div className="row">
          {(["draft", "open", "overdue", "paid"] as PipelineKey[]).map((k) => (
            <button key={k} type="button" className="iv-link" onClick={() => changeView(VIEW_FOR[k])}>
              {{ draft: "Drafts", open: "Not due yet", overdue: "Overdue", paid: "Paid this month" }[k]}&nbsp;<b>{formatShort(pipeline[k][0] / 100, home)}</b>
            </button>
          ))}
        </div>
      </div>

      <Tabs value={view} onChange={changeView} tabs={VIEWS.map((v) => ({ value: v.value, label: v.label, count: rows.filter(v.test).length }))} />

      <div className="toolbar">
        <label className="field-s">
          <Icon name="search" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoices, or try >500" aria-label="Search invoices by customer, number or amount" title="Search by customer, invoice number or amount. Type >500 for amounts over 500." />
        </label>
        <span className="sp" />
        <Switch checked={grouped} onCheckedChange={setGrouped} label={<span className="whitespace-nowrap text-[13px] text-text-2">Group by status</span>} />
        <Tooltip label="Download this view as a spreadsheet">
          <a className="iv-btn iv-btn--ghost iv-btn--sm" href={`/invoices/export?ids=${filtered.map((r) => r.id).join(",")}`} download>
            <Icon name="download" />
            Export
          </a>
        </Tooltip>
      </div>

      <table className="tbl" data-m="inv">
        <thead>
          <tr>
            <th className="sel">
              <Checkbox
                aria-label={allPicked ? "Clear selection" : "Select all in this view"}
                checked={allPicked}
                indeterminate={picked.size > 0 && !allPicked}
                onCheckedChange={() => setPicked(allPicked ? new Set() : new Set(filtered.map((r) => r.id)))}
              />
            </th>
            <th>Customer</th>
            <th>Category</th>
            <th>Due</th>
            <th>Status</th>
            <th className="r">Amount</th>
            <th style={{ width: 110 }}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} style={{ height: 180, textAlign: "center", whiteSpace: "normal" }}>
                {q ? (
                  <><b className="font-medium">No invoices match “{q}”</b><br /><span className="text-text-2">Try an invoice number, a customer&apos;s name, or an amount like &gt;500.</span></>
                ) : (
                  <><b className="font-medium">Nothing here yet</b><br /><span className="text-text-2">Invoices in this view will show up here.</span></>
                )}
              </td>
            </tr>
          )}
          {sections.map((g) => (
            <GroupRows
              key={g.key}
              label={g.label}
              rows={g.rows}
              open={!closed.has(g.key)}
              onToggle={() => {
                const next = new Set(closed);
                if (next.has(g.key)) next.delete(g.key);
                else next.add(g.key);
                setClosed(next);
              }}
              selected={sheet.current}
              picked={picked}
              onPick={pick}
              fresh={fresh}
              onOpen={(id, pay) => sheet.open(id, { pay })}
              onRemind={async (r) => {
                const res = await sendReminder(r.id);
                toast({ title: res.delivery === "sent" ? `Reminder sent to ${res.to}` : `Reminder saved. Email is in test mode, see Sent emails.` });
              }}
              onPin={async (r) => {
                const res = await togglePin({ kind: "invoice", ref: r.id, label: r.number });
                toast({ title: res.pinned ? `Pinned ${r.number} to the sidebar` : `Unpinned ${r.number}` });
              }}
            />
          ))}
        </tbody>
      </table>

      <BulkBar
        ids={[...picked]}
        rows={rows}
        categories={categories}
        onClear={() => setPicked(new Set())}
        onDone={() => {
          setPicked(new Set());
          router.refresh();
        }}
      />
    </div>
  );
}

function GroupRows({
  label, rows, open, onToggle, selected, picked, onPick, fresh, onOpen, onRemind, onPin,
}: {
  label: string; rows: InvoiceRow[]; open: boolean; onToggle: () => void; selected: string | null; picked: Set<string>; onPick: (id: string, range: boolean) => void; fresh?: string;
  onOpen: (id: string, pay?: boolean) => void; onRemind: (r: InvoiceRow) => void; onPin: (r: InvoiceRow) => void;
}) {
  const home = useWorkspaceCurrency() as Currency;
  const total = rows.reduce((a, r) => a + toHomeMinor(r.stored === "paid" || r.stored === "cancelled" || r.stored === "draft" ? r.total : r.left, r.currency, home), 0);
  return (
    <>
      {label && (
        <tr className="grp">
          <td colSpan={7}>
            <button type="button" aria-expanded={open} onClick={onToggle}>
              <Icon name="chevron" />
              <b>{label}</b>
              <span>{rows.length}</span>
              <span>·</span>
              <span className="iv-num">≈ {formatShort(total / 100, home)}</span>
            </button>
          </td>
        </tr>
      )}
      {open &&
        rows.map((r) => {
          const cur = r.currency as Currency;
          const canPay = ["sent", "viewed", "partial"].includes(r.stored);
          return (
            <tr key={r.id} data-row data-selected={selected === r.id || undefined} data-picked={picked.has(r.id) || undefined} data-fresh={fresh === r.number || undefined} onClick={() => onOpen(r.id)}>
              <td className="sel" onClick={(e) => { e.stopPropagation(); onPick(r.id, e.shiftKey); }}>
                <Checkbox aria-label={`Select ${r.number}`} checked={picked.has(r.id)} onClick={(e) => e.preventDefault()} tabIndex={-1} />
              </td>
              <td>
                <span className="cust">
                  <Avatar name={r.customer} size="md" />
                  <span><b>{r.customer}</b><small>{r.number}</small></span>
                </span>
              </td>
              <td><span className="catg"><i style={{ background: tintFor(r.category ?? "General")[1] }} />{r.category}</span></td>
              <td className={r.status === "overdue" ? "late" : "text-text-2"}>{r.due}</td>
              <td><StatusPill status={r.status} /></td>
              <td className="r">
                <span className="amt-c">
                  <b><Money value={r.total / 100} currency={cur} /></b>
                  {r.stored === "partial" && <small>{formatMoney(r.left / 100, cur)} left</small>}
                </span>
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                <div className="ra">
                  {canPay && (
                    <>
                      <Tooltip label="Send reminder">
                        <Button size="sm" variant="ghost" iconOnly icon="bell" aria-label={`Send reminder for ${r.number}`} onClick={() => onRemind(r)} />
                      </Tooltip>
                      <Tooltip label="Record payment">
                        <Button size="sm" variant="ghost" iconOnly icon="cash" aria-label={`Record payment for ${r.number}`} onClick={() => onOpen(r.id, true)} />
                      </Tooltip>
                    </>
                  )}
                  <Menu>
                    <MenuTrigger>
                      <Button size="sm" variant="ghost" iconOnly icon="more" aria-label={`More actions for ${r.number}`} />
                    </MenuTrigger>
                    <MenuContent align="end">
                      <MenuItem onClick={() => onOpen(r.id)}><Icon name="eye" />Open</MenuItem>
                      <MenuItem onClick={() => onPin(r)}><Icon name="pin" />Pin or unpin</MenuItem>
                    </MenuContent>
                  </Menu>
                </div>
              </td>
            </tr>
          );
        })}
    </>
  );
}

/** Floats up when invoices are selected. Each action says what it will do to how many before it runs. */
function BulkBar({ ids, rows, categories, onClear, onDone }: { ids: string[]; rows: InvoiceRow[]; categories: string[]; onClear: () => void; onDone: () => void }) {
  const toast = useToast();
  const reduce = useReducedMotion();
  const [confirm, setConfirm] = useState<null | "paid" | "cancel" | "delete">(null);
  const [busy, setBusy] = useState(false);
  const sel = rows.filter((r) => ids.includes(r.id));
  const openOnes = sel.filter((r) => ["sent", "viewed", "partial"].includes(r.stored));
  const drafts = sel.filter((r) => r.stored === "draft");
  const cancellable = sel.filter((r) => ["sent", "viewed", "partial", "scheduled"].includes(r.stored));
  const n = (k: number, word = "invoice") => `${k} ${word}${k === 1 ? "" : "s"}`;

  async function run(op: BulkOp, arg?: string, label?: (done: number) => string) {
    setBusy(true);
    const res = await bulkInvoices(ids, op, arg);
    setBusy(false);
    setConfirm(null);
    toast({ title: (label ?? ((d) => `Done for ${n(d)}`))(res.done) + (res.skipped ? `. ${res.skipped} skipped.` : "") });
    onDone();
  }

  const copy = {
    paid: { title: `Mark ${n(openOnes.length)} as paid?`, body: "Each one gets a payment for its full balance, dated today, by bank transfer. Use this for money that has already arrived.", go: "Mark as paid", op: "paid" as const },
    cancel: { title: `Cancel ${n(cancellable.length)}?`, body: "Customers can no longer pay them, and reminders stop. They stay on record.", go: "Cancel invoices", op: "cancel" as const },
    delete: { title: `Delete ${n(drafts.length, "draft")}?`, body: "Drafts were never sent, so nothing changes for customers. This can't be undone.", go: "Delete drafts", op: "delete" as const },
  };

  return (
    <>
      <AnimatePresence>
        {ids.length > 0 && (
          <motion.div
            className="bulk"
            role="toolbar"
            aria-label={`${ids.length} selected`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translate(-50%, 16px) scale(0.98)" }}
            animate={{ opacity: 1, transform: "translate(-50%, 0px) scale(1)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, transform: "translate(-50%, 12px) scale(0.98)" }}
            transition={{ type: "spring", bounce: 0, duration: 0.32 }}
          >
            <span className="bulk-n"><b key={ids.length}>{ids.length}</b> selected</span>
            <span className="bulk-sep" />
            <Button size="sm" variant="ghost" icon="bell" disabled={busy || !openOnes.length} onClick={() => run("remind", undefined, (d) => `Reminders sent for ${n(d)}`)}>Remind</Button>
            <Button size="sm" variant="ghost" icon="cash" disabled={busy || !openOnes.length} onClick={() => setConfirm("paid")}>Mark paid</Button>
            <Menu>
              <MenuTrigger>
                <Button size="sm" variant="ghost" icon="copy" disabled={busy}>Category</Button>
              </MenuTrigger>
              <MenuContent side="top">
                <MenuLabel>Move {n(ids.length)} to</MenuLabel>
                {categories.map((c) => (
                  <MenuItem key={c} onClick={() => run("category", c, (d) => `${n(d)} moved to ${c}`)}>
                    <span className="cat-dot" style={{ background: tintFor(c)[1] }} />
                    {c}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
            <a className="iv-btn iv-btn--ghost iv-btn--sm" href={`/invoices/export?ids=${ids.join(",")}`} download>
              <Icon name="download" />
              Export
            </a>
            <Menu>
              <MenuTrigger>
                <Button size="sm" variant="ghost" iconOnly icon="more" aria-label="More bulk actions" disabled={busy} />
              </MenuTrigger>
              <MenuContent side="top" align="end">
                <MenuItem disabled={!cancellable.length} onClick={() => setConfirm("cancel")}><Icon name="x" />Cancel {cancellable.length ? n(cancellable.length) : "invoices"}</MenuItem>
                <MenuItem disabled={!drafts.length} onClick={() => setConfirm("delete")}><Icon name="trash" />Delete {drafts.length ? n(drafts.length, "draft") : "drafts"}</MenuItem>
              </MenuContent>
            </Menu>
            <span className="bulk-sep" />
            <Tooltip label="Clear selection" kbd="Esc">
              <Button size="sm" variant="ghost" iconOnly icon="x" aria-label="Clear selection" onClick={onClear} />
            </Tooltip>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        {confirm && (
          <DialogContent
            title={copy[confirm].title}
            description={copy[confirm].body}
            footer={
              <>
                <span className="iv-sp" />
                <DialogClose render={<Button>Go back</Button>} />
                <Button variant={confirm === "paid" ? "primary" : "danger"} disabled={busy} style={{ minWidth: 140 }} onClick={() => run(copy[confirm].op)}>
                  <MorphLabel id={busy ? "b" : "i"}>{busy ? "Working…" : copy[confirm].go}</MorphLabel>
                </Button>
              </>
            }
          />
        )}
      </Dialog>
    </>
  );
}
