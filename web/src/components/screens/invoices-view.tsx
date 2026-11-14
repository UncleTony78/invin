"use client";

import { useWorkspaceCurrency } from "@/components/shell/workspace-context";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, MorphLabel } from "@/components/ui/button";
import { Checkbox, Switch, TextField } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Avatar, Tabs } from "@/components/ui/identity";
import { Dialog, DialogClose, DialogContent, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Popover, PopoverContent, PopoverTrigger, Tooltip } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { Money } from "@/components/invoice/money";
import { MoneyPipeline, type PipelineKey } from "@/components/invoice/pipeline";
import { StatusPill } from "@/components/invoice/status";
import { useInvoiceSheet } from "@/components/shell/invoice-sheet";
import { formatMoney, formatShort, tintFor, type Currency } from "@/lib/format";
import { toHomeMinor } from "@/lib/fx";
import { bulkInvoices, deleteView, renameView, saveView, sendReminder, togglePin, updateView, type BulkOp } from "@/server/actions";
import type { InvoiceRow, PipelineData, SavedView } from "@/server/queries";
import { TagChip } from "@/components/invoice/tags";

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

export function InvoicesView({ rows, pipeline, initialView, fresh, initialQ, categories = [], savedViews = [], pinnedViews = [] }: { rows: InvoiceRow[]; pipeline: PipelineData; initialView: string; fresh?: string; initialQ?: string; categories?: string[]; savedViews?: SavedView[]; pinnedViews?: string[] }) {
  const home = useWorkspaceCurrency() as Currency;
  const router = useRouter();
  const sheet = useInvoiceSheet();
  const toast = useToast();
  const startSaved = savedViews.find((v) => `sv:${v.id}` === initialView);
  const [view, setView] = useState<View>(((startSaved?.base ?? VIEWS.find((v) => v.value === initialView)?.value) ?? "all") as View);
  // The tab that's highlighted: a built-in view, or "sv:<id>" for a saved one
  const [tab, setTab] = useState<string>(startSaved ? initialView : view);
  const [q, setQ] = useState(initialQ ?? startSaved?.q ?? "");
  const [tagF, setTagF] = useState<string[]>(startSaved?.tags ?? []);
  const [catF, setCatF] = useState<string[]>(startSaved?.categories ?? []);
  const [naming, setNaming] = useState<null | "new" | "rename">(null);
  const allTags = useMemo(() => [...new Set(rows.flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b)), [rows]);
  const [grouped, setGrouped] = useState(true);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  // Selection for bulk actions. Shift-click selects everything between the last click and this one.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const lastPick = useRef<string | null>(null);

  // Follow ?view= when a pin, the pipeline or the sidebar links here (adjusting state while rendering, no effect)
  const [seenView, setSeenView] = useState(initialView);
  if (initialView !== seenView) {
    setSeenView(initialView);
    const sv = savedViews.find((v) => `sv:${v.id}` === initialView);
    if (sv) applySaved(sv);
    else {
      setView((VIEWS.find((v) => v.value === initialView)?.value ?? "all") as View);
      setTab(VIEWS.find((v) => v.value === initialView)?.value ?? "all");
    }
  }

  const filtered = useMemo(() => {
    const test = VIEWS.find((v) => v.value === view)!.test;
    const needle = q.trim().toLowerCase();
    return rows.filter(test).filter((r) => {
      if (tagF.length && !tagF.every((t) => r.tags.includes(t))) return false;
      if (catF.length && !catF.includes(r.category ?? "")) return false;
      if (!needle) return true;
      const m = needle.match(/^([<>=])\s*(\d+(?:\.\d+)?)$/);
      if (m) {
        const n = parseFloat(m[2]) * 100;
        return m[1] === ">" ? r.total > n : m[1] === "<" ? r.total < n : r.total === n;
      }
      return `${r.number} ${r.customer} ${r.category ?? ""} ${r.tags.join(" ")}`.toLowerCase().includes(needle);
    });
  }, [rows, view, q, tagF, catF]);

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

  function applySaved(sv: SavedView) {
    setView(sv.base as View);
    setTab(`sv:${sv.id}`);
    setQ(sv.q);
    setTagF(sv.tags);
    setCatF(sv.categories);
  }
  function chooseTab(t: string) {
    const sv = savedViews.find((v) => `sv:${v.id}` === t);
    if (sv) {
      applySaved(sv);
      const url = new URL(location.href);
      url.searchParams.set("view", t);
      history.replaceState(history.state, "", url);
      return;
    }
    // Leaving a saved view clears its filters; moving between built-in tabs keeps your search
    if (tab.startsWith("sv:")) {
      setQ("");
      setTagF([]);
      setCatF([]);
    }
    changeView(t as View);
  }
  const current = savedViews.find((v) => `sv:${v.id}` === tab);
  async function updateCurrent() {
    if (!current) return;
    await updateView(current.id, { name: current.name, base: view, q, tags: tagF, categories: catF });
    toast({ title: `${current.name} updated` });
    router.refresh();
  }
  const filtering = !!(q.trim() || tagF.length || catF.length);
  const unsaved = filtering && (!current || current.q !== q || current.base !== view || current.tags.join() !== tagF.join() || current.categories.join() !== catF.join());

  function changeView(v: View) {
    setView(v);
    setTab(v);
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

      <Tabs
        value={tab}
        onChange={chooseTab}
        tabs={[
          ...VIEWS.map((v) => ({ value: v.value, label: v.label, count: rows.filter(v.test).length })),
          ...savedViews.map((sv) => ({ value: `sv:${sv.id}`, label: sv.name, count: countSaved(rows, sv) })),
        ]}
      />

      <div className="toolbar">
        <label className="field-s">
          <Icon name="search" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoices, or try >500" aria-label="Search invoices by customer, number or amount" title="Search by customer, invoice number or amount. Type >500 for amounts over 500." />
        </label>
        <Menu>
          <MenuTrigger>
            <Button size="sm" variant={tagF.length || catF.length ? "secondary" : "ghost"} icon="tag">
              Filter{tagF.length + catF.length ? ` · ${tagF.length + catF.length}` : ""}
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuLabel>Tags</MenuLabel>
            {allTags.length === 0 && <div className="iv-menu-label">No tags yet. Add them from an invoice.</div>}
            {allTags.map((t) => (
              <MenuItem key={t} closeOnClick={false} onClick={() => setTagF((f) => (f.includes(t) ? f.filter((x) => x !== t) : [...f, t]))}>
                <span className="flt-check" data-on={tagF.includes(t) || undefined}><Icon name="check" size={12} /></span>
                {t}
              </MenuItem>
            ))}
            <MenuSeparator />
            <MenuLabel>Categories</MenuLabel>
            {categories.map((c) => (
              <MenuItem key={c} closeOnClick={false} onClick={() => setCatF((f) => (f.includes(c) ? f.filter((x) => x !== c) : [...f, c]))}>
                <span className="flt-check" data-on={catF.includes(c) || undefined}><Icon name="check" size={12} /></span>
                <span className="cat-dot" style={{ background: tintFor(c)[1] }} />
                {c}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
        {unsaved && (
          <Button size="sm" variant="ghost" icon="plus" onClick={() => setNaming("new")}>
            Save as a view
          </Button>
        )}
        {current && (
          <Menu>
            <MenuTrigger>
              <Button size="sm" variant="ghost" iconOnly icon="more" aria-label={`Options for the ${current.name} view`} />
            </MenuTrigger>
            <MenuContent>
              <MenuLabel>{current.name}</MenuLabel>
              {unsaved && <MenuItem onClick={() => updateCurrent()}><Icon name="check" />Update with these filters</MenuItem>}
              <MenuItem onClick={() => setNaming("rename")}><Icon name="pencil" />Rename</MenuItem>
              <MenuItem
                onClick={async () => {
                  const r = await togglePin({ kind: "view", ref: `sv:${current.id}`, label: current.name });
                  toast({ title: r.pinned ? `${current.name} pinned to the sidebar` : `${current.name} unpinned` });
                  router.refresh();
                }}
              >
                <Icon name="pin" />
                {pinnedViews.includes(`sv:${current.id}`) ? "Unpin from sidebar" : "Pin to sidebar"}
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                onClick={async () => {
                  await deleteView(current.id);
                  toast({ title: `${current.name} view deleted` });
                  chooseTab("all");
                  router.refresh();
                }}
              >
                <Icon name="trash" />
                Delete view
              </MenuItem>
            </MenuContent>
          </Menu>
        )}
        <span className="sp" />
        <Switch checked={grouped} onCheckedChange={setGrouped} label={<span className="whitespace-nowrap text-[13px] text-text-2">Group by status</span>} />
        <Tooltip label="Download this view as a spreadsheet">
          <a className="iv-btn iv-btn--ghost iv-btn--sm" href={`/invoices/export?ids=${filtered.map((r) => r.id).join(",")}`} download>
            <Icon name="download" />
            Export
          </a>
        </Tooltip>
      </div>

      {(tagF.length > 0 || catF.length > 0) && (
        <div className="flt-row">
          {tagF.map((t) => (
            <span key={t} className="flt-chip"><Icon name="tag" size={12} />{t}<button type="button" aria-label={`Remove filter ${t}`} onClick={() => setTagF(tagF.filter((x) => x !== t))}><Icon name="x" size={11} /></button></span>
          ))}
          {catF.map((c) => (
            <span key={c} className="flt-chip"><span className="cat-dot" style={{ background: tintFor(c)[1] }} />{c}<button type="button" aria-label={`Remove filter ${c}`} onClick={() => setCatF(catF.filter((x) => x !== c))}><Icon name="x" size={11} /></button></span>
          ))}
          <button type="button" className="iv-link text-[13px]" onClick={() => { setTagF([]); setCatF([]); }}>Clear filters</button>
          <span className="text-[13px] text-text-2">{filtered.length} of {rows.filter(VIEWS.find((v) => v.value === view)!.test).length}</span>
        </div>
      )}

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

      <ViewNameDialog
        mode={naming}
        initial={naming === "rename" ? current?.name ?? "" : ""}
        onClose={() => setNaming(null)}
        onSave={async (name) => {
          if (naming === "rename" && current) {
            await renameView(current.id, name);
            toast({ title: `Renamed to ${name}` });
          } else {
            const r = await saveView({ name, base: view, q, tags: tagF, categories: catF });
            if (!r.ok) return r.error;
            toast({ title: `${name} saved. It's a tab now, and you can pin it.` });
            router.refresh();
            setTimeout(() => setTab(`sv:${r.id}`), 300);
          }
          setNaming(null);
          router.refresh();
          return null;
        }}
      />

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
              <td>
                <span className="catg"><i style={{ background: tintFor(r.category ?? "General")[1] }} />{r.category}</span>
                {r.tags.length > 0 && (
                  <span className="row-tags">
                    {r.tags.slice(0, 2).map((t) => <TagChip key={t} tag={t} />)}
                    {r.tags.length > 2 && <span className="text-[11px] text-text-2">+{r.tags.length - 2}</span>}
                  </span>
                )}
              </td>
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
  const allTags = [...new Set(rows.flatMap((r) => r.tags))];
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
            <Popover>
              <PopoverTrigger>
                <Button size="sm" variant="ghost" icon="tag" disabled={busy}>Tag</Button>
              </PopoverTrigger>
              <PopoverContent width={240} align="center">
                <form
                  className="bulk-tag"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = new FormData(e.currentTarget).get("tag")?.toString().trim();
                    if (v) run("tag", v, (d) => `Tagged ${n(d)} “${v}”`);
                  }}
                >
                  <input name="tag" autoFocus maxLength={24} placeholder="Add a tag to all" aria-label="Tag to add" className="iv-input" />
                </form>
                {allTags.length > 0 && (
                  <div className="bulk-tag-list">
                    {allTags.slice(0, 8).map((t) => (
                      <button key={t} type="button" className="iv-menu-item w-full text-left" onClick={() => run("tag", t, (d) => `Tagged ${n(d)} “${t}”`)}>
                        <Icon name="tag" />{t}
                      </button>
                    ))}
                  </div>
                )}
              </PopoverContent>
            </Popover>
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

function countSaved(rows: InvoiceRow[], sv: SavedView) {
  const test = VIEWS.find((v) => v.value === sv.base)?.test ?? (() => true);
  const needle = sv.q.trim().toLowerCase();
  return rows.filter(test).filter((r) =>
    sv.tags.every((t) => r.tags.includes(t)) &&
    (!sv.categories.length || sv.categories.includes(r.category ?? "")) &&
    (!needle || `${r.number} ${r.customer} ${r.category ?? ""} ${r.tags.join(" ")}`.toLowerCase().includes(needle)),
  ).length;
}

function ViewNameDialog({ mode, initial, onClose, onSave }: { mode: null | "new" | "rename"; initial: string; onClose: () => void; onSave: (name: string) => Promise<string | null> }) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState("");
  const [was, setWas] = useState(mode);
  if (mode !== was) {
    setWas(mode);
    setName(initial);
    setError("");
  }
  return (
    <Dialog open={!!mode} onOpenChange={(o) => !o && onClose()}>
      {mode && (
        <DialogContent
          title={mode === "new" ? "Save this view" : "Rename view"}
          description={mode === "new" ? "Your filters and search become a tab on this page, shared with your team. Pin it to keep it in the sidebar." : "Everyone in the workspace sees the new name."}
          footer={
            <>
              <span className="iv-sp" />
              <DialogClose render={<Button>Cancel</Button>} />
              <Button variant="primary" icon="check" onClick={async () => { const e = await onSave(name); if (e) setError(e); }}>{mode === "new" ? "Save view" : "Rename"}</Button>
            </>
          }
        >
          <form onSubmit={async (e) => { e.preventDefault(); const er = await onSave(name); if (er) setError(er); }}>
            <TextField label="Name" autoFocus maxLength={40} placeholder="e.g. Q4 retainers" value={name} onChange={(e) => setName(e.target.value)} />
          </form>
          {error && <div className="form-error"><Icon name="alert" />{error}</div>}
        </DialogContent>
      )}
    </Dialog>
  );
}
