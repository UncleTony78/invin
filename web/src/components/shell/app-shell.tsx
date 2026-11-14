"use client";

import { NotificationBell } from "./notifications";
import { WorkspaceContext } from "./workspace-context";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Kbd } from "@/components/ui/button";
import { CommandPalette, type Command } from "@/components/ui/command";
import { Icon } from "@/components/ui/icon";
import { SheetStage, Tooltip, TooltipProvider } from "@/components/ui/overlay";
import { ToastProvider } from "@/components/ui/toast";
import { formatMoney, type Currency } from "@/lib/format";
import type { PinDTO } from "@/server/queries";
import { InvoiceSheetProvider, useInvoiceSheet } from "./invoice-sheet";
import { Sidebar } from "./sidebar";

export type ShellProps = {
  workspace: { name: string; mark: string; brandColor: string; currency: string };
  member: { name: string; role: string };
  pins: PinDTO[];
  overdue: number;
  invoices: { id: string; number: string; customer: string; total: number; currency: string }[];
  unread: number;
  workspaces: { id: string; name: string; mark: string; brandColor: string; role: string; current: boolean }[];
  children: ReactNode;
};

export function AppShell(props: ShellProps) {
  return (
    <WorkspaceContext value={{ currency: props.workspace.currency }}>
    <TooltipProvider>
      <ToastProvider>
        <SheetStage>
          <InvoiceSheetProvider>
            <Shell {...props} />
          </InvoiceSheetProvider>
        </SheetStage>
      </ToastProvider>
    </TooltipProvider>
    </WorkspaceContext>
  );
}

const CRUMBS: Record<string, [string, string?][]> = {
  "/": [["Home"]],
  "/invoices": [["Invoices"]],
  "/invoices/new": [["Invoices", "/invoices"], ["New invoice"]],
  "/estimates/new": [["Estimates", "/estimates"], ["New estimate"]],
  "/outbox": [["Settings", "/settings"], ["Sent emails"]],
};

function crumbsFor(path: string): [string, string?][] {
  if (CRUMBS[path]) return CRUMBS[path];
  const edit = path.match(/^\/invoices\/([^/]+)\/edit$/);
  if (edit) return [["Invoices", "/invoices"], [`Edit ${decodeURIComponent(edit[1])}`]];
  if (/^\/customers\/[^/]+$/.test(path)) return [["Customers", "/customers"], ["Customer"]];
  const stm = path.match(/^\/customers\/([^/]+)\/statement$/);
  if (stm) return [["Customers", "/customers"], ["Customer", `/customers/${stm[1]}`], ["Statement"]];
  const est = path.match(/^\/estimates\/([^/]+)(\/edit)?$/);
  if (est && est[1] !== "new") return est[2] ? [["Estimates", "/estimates"], [decodeURIComponent(est[1]), `/estimates/${est[1]}`], ["Edit"]] : [["Estimates", "/estimates"], [decodeURIComponent(est[1])]];
  const rec = path.match(/^\/recurring\/([^/]+)(\/edit)?$/);
  if (rec) return rec[2] ? [["Recurring", "/recurring"], ["Series", `/recurring/${rec[1]}`], ["Edit invoice"]] : [["Recurring", "/recurring"], ["Series"]];
  const top = path.split("/")[1] ?? "";
  return [[top.slice(0, 1).toUpperCase() + top.slice(1)]];
}

function Shell({ workspace, member, pins, overdue, invoices, unread, workspaces, children }: ShellProps) {
  const path = usePathname();
  const router = useRouter();
  const sheet = useInvoiceSheet();
  const [rail, setRail] = useState(false);
  const [anim, setAnim] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    try {
      /* eslint-disable react-hooks/set-state-in-effect -- reading per-viewer preferences once after hydration */
      setRail(localStorage.getItem("invin.rail") === "1");
      setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {}
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close the mobile drawer on navigation
  useEffect(() => setDrawer(false), [path]);

  const narrow = () => matchMedia("(max-width: 860px)").matches;
  function toggleSide(animate = true) {
    if (narrow()) return setDrawer((d) => !d);
    setAnim(animate);
    setRail((r) => {
      try {
        localStorage.setItem("invin.rail", r ? "0" : "1");
      } catch {}
      return !r;
    });
    setTimeout(() => setAnim(false), 300);
  }
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("invin.theme", next);
    } catch {}
  }

  // Single-key shortcuts: C new invoice, [ sidebar. Never while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(el?.tagName ?? "") || el?.isContentEditable) return;
      if (document.querySelector("[role=dialog]")) return;
      if (e.key === "c") router.push("/invoices/new");
      if (e.key === "[") toggleSide(false);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  const commands: Command[] = useMemo(
    () => [
      { id: "home", group: "Go to", label: "Home", icon: "home", run: () => router.push("/") },
      { id: "invoices", group: "Go to", label: "Invoices", icon: "file", run: () => router.push("/invoices") },
      { id: "overdue", group: "Go to", label: "Overdue invoices", icon: "alert", run: () => router.push("/invoices?view=overdue") },
      { id: "payments", group: "Go to", label: "Payments", icon: "cash", run: () => router.push("/payments") },
      { id: "customers", group: "Go to", label: "Customers", icon: "users", run: () => router.push("/customers") },
      { id: "catalogue", group: "Go to", label: "Catalogue", icon: "copy", run: () => router.push("/catalogue") },
      { id: "estimates", group: "Go to", label: "Estimates", icon: "clipboard", run: () => router.push("/estimates") },
      { id: "new-estimate", group: "Actions", label: "New estimate", icon: "clipboard", run: () => router.push("/estimates/new") },
      { id: "reports", group: "Go to", label: "Reports", icon: "chart", run: () => router.push("/reports") },
      { id: "settings", group: "Go to", label: "Settings", icon: "settings", run: () => router.push("/settings") },
      { id: "new", group: "Actions", label: "New invoice", icon: "plus", kbd: "C", run: () => router.push("/invoices/new") },
      { id: "theme", group: "Actions", label: "Switch between light and dark", icon: "moon", run: toggleTheme },
      { id: "outbox", group: "Actions", label: "See sent emails", icon: "mail", run: () => router.push("/outbox") },
      ...invoices.map((i) => ({ id: i.id, group: "Invoices", label: `${i.number} · ${i.customer}`, icon: "file" as const, hint: formatMoney(i.total / 100, i.currency as Currency), run: () => sheet.open(i.id) })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoices, router, sheet.open],
  );

  const crumbs = crumbsFor(path);

  return (
    <div className="app" data-rail={rail || undefined} data-anim={anim || undefined} data-drawer={drawer || undefined}>
      <Sidebar workspace={workspace} workspaces={workspaces} member={member} pins={pins} overdue={overdue} rail={rail} />
      <div className="dscrim" onClick={() => setDrawer(false)} />
      <div className="frame">
        <header className="top" data-scrolled={scrolled || undefined}>
          <div className="l">
            <Tooltip label={rail ? "Expand sidebar" : "Collapse sidebar"} kbd="[">
              <Button variant="ghost" iconOnly icon="panel" aria-label="Toggle sidebar" onClick={() => toggleSide()} />
            </Tooltip>
            <nav className="crumbs" aria-label="Breadcrumb">
              {crumbs.map(([label, href], i) =>
                href ? (
                  <span key={i} className="flex items-center gap-2">
                    <Link href={href}>{label}</Link>
                    <span className="sl">/</span>
                  </span>
                ) : (
                  <b key={i}>{label}</b>
                ),
              )}
            </nav>
          </div>
          <button type="button" className="search" onClick={() => setPalette(true)}>
            <Icon name="search" />
            <span>Search invoices, customers, items…</span>
            <Kbd>Ctrl K</Kbd>
          </button>
          <div className="r">
            <NotificationBell initialUnread={unread} />
            <Tooltip label="Sent emails">
              <Button variant="ghost" iconOnly icon="mail" aria-label="Sent emails" onClick={() => router.push("/outbox")} />
            </Tooltip>
            <Tooltip label={theme === "dark" ? "Light mode" : "Dark mode"}>
              <Button variant="ghost" iconOnly icon={theme === "dark" ? "sun" : "moon"} aria-label="Switch theme" onClick={toggleTheme} />
            </Tooltip>
          </div>
        </header>
        <main className="scroll" onScroll={(e) => setScrolled((e.target as HTMLElement).scrollTop > 2)}>
          {children}
        </main>
      </div>
      <CommandPalette commands={commands} open={palette} onOpenChange={setPalette} hideTrigger />
    </div>
  );
}
