"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { Kbd } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Tooltip } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import { tintFor } from "@/lib/format";
import { reorderPins, togglePin } from "@/server/actions";
import type { PinDTO } from "@/server/queries";
import { useInvoiceSheet } from "./invoice-sheet";

type NavItem = { href: string; label: string; icon: IconName; count?: number; alert?: boolean };

export function Sidebar({
  workspace,
  member,
  pins,
  overdue,
  rail,
}: {
  workspace: { name: string; mark: string; brandColor: string };
  member: { name: string; role: string };
  pins: PinDTO[];
  overdue: number;
  rail: boolean;
}) {
  const nav = useRouter();
  async function signOut() {
    await authClient.signOut();
    nav.replace("/sign-in");
    nav.refresh();
  }
  const path = usePathname();

  const groups: { label?: string; items: NavItem[] }[] = [
    { items: [{ href: "/", label: "Home", icon: "home" }] },
    {
      label: "Billing",
      items: [
        { href: "/invoices", label: "Invoices", icon: "file", count: overdue || undefined, alert: overdue > 0 },
        { href: "/recurring", label: "Recurring", icon: "repeat" },
        { href: "/payments", label: "Payments", icon: "cash" },
      ],
    },
    {
      label: "Clients",
      items: [
        { href: "/customers", label: "Customers", icon: "users" },
        { href: "/catalogue", label: "Catalogue", icon: "copy" },
      ],
    },
  ];
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  // Collapsed means collapsed: icons with tooltips, no hover-to-expand
  const showTip = rail;

  return (
    <aside className="side" aria-label="Main navigation">
      <div className="side-in">
        <Menu>
          <MenuTrigger>
            <button type="button" className="ws" aria-label="Switch workspace">
              <span className="logo" style={{ background: workspace.brandColor }}>{workspace.mark}</span>
              <span className="fade min-w-0 flex-1">
                <b>{workspace.name}</b>
                <small>{member.name}</small>
              </span>
              <span className="fade"><Icon name="chevron" /></span>
            </button>
          </MenuTrigger>
          <MenuContent>
            <MenuLabel>Workspace</MenuLabel>
            <MenuItem>
              <span className="iv-avatar iv-avatar--md" style={{ background: workspace.brandColor, color: "#fff", borderRadius: 7 }}>{workspace.mark}</span>
              <span>{workspace.name}<small>You&apos;re the {member.role}</small></span>
              <span className="iv-right"><Icon name="check" /></span>
            </MenuItem>
            <MenuSeparator />
            <MenuItem render={<Link href="/settings" />}><Icon name="settings" />Workspace settings</MenuItem>
            <MenuSeparator />
            <MenuItem onClick={signOut}><Icon name="x" />Sign out</MenuItem>
          </MenuContent>
        </Menu>

        <NavTip show={showTip} label="New invoice" kbd="C">
          <Link href="/invoices/new" className="create">
            <Icon name="plus" />
            <span className="fade">New invoice</span>
            <span className="fade ml-auto"><Kbd>C</Kbd></span>
          </Link>
        </NavTip>

        <nav>
          {groups.map((g, gi) => (
            <div className="nav-g" key={gi}>
              {g.label && <div className="nav-h fade">{g.label}</div>}
              {g.items.map((it) => (
                <NavTip key={it.href} show={showTip} label={it.label}>
                  <Link href={it.href} className="ni" aria-current={active(it.href) ? "page" : undefined}>
                    <span className="ic"><Icon name={it.icon} /></span>
                    <span className="lb fade">{it.label}</span>
                    {it.count !== undefined && <span className="ct fade" data-alert={it.alert || undefined}>{it.count}</span>}
                  </Link>
                </NavTip>
              ))}
            </div>
          ))}
          <div className="nav-g">
            <div className="nav-h fade">Pinned{pins.length > 0 && <span className="nav-ct">{pins.length}</span>}</div>
            <Pins pins={pins} showTip={showTip} rail={rail} />
          </div>
        </nav>

        <div className="side-foot">
          <NavTip show={showTip} label="Settings">
            <Link href="/settings" className="ni" aria-current={active("/settings") ? "page" : undefined}>
              <span className="ic"><Icon name="settings" /></span>
              <span className="lb fade">Settings</span>
            </Link>
          </NavTip>
          <Menu>
            <MenuTrigger>
              <button type="button" className="me-row" aria-label="Your account">
                <span className="iv-avatar iv-avatar--md" style={{ background: "#E7F0FE", color: "#2453B8" }}>{member.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
                <span className="fade text-left"><b>{member.name}</b><small className="capitalize">{member.role}</small></span>
              </button>
            </MenuTrigger>
            <MenuContent side="top" align="start">
              <MenuLabel>Signed in as {member.name}</MenuLabel>
              <MenuItem onClick={signOut}><Icon name="x" />Sign out</MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>
    </aside>
  );
}

function NavTip({ show, label, kbd, children }: { show: boolean; label: string; kbd?: string; children: React.ReactElement }) {
  if (!show) return children;
  return (
    <Tooltip label={label} kbd={kbd} side="right">
      {children}
    </Tooltip>
  );
}

/* Pinned items: click to open, × to unpin (with undo), drag to reorder (4px threshold, neighbours make room). */
function Pins({ pins, showTip, rail }: { pins: PinDTO[]; showTip: boolean; rail: boolean }) {
  const router = useRouter();
  const sheet = useInvoiceSheet();
  const toast = useToast();
  const [items, setItems] = useState(pins);
  const [fresh, setFresh] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [overflow, setOverflow] = useState<"" | "top" | "bottom" | "both">("");
  const [, start] = useTransition();
  const known = useRef(new Set(pins.map((p) => p.id)));
  const drag = useRef<{ id: string; y0: number; k0: number; h: number; moved: boolean; to: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const justDragged = useRef(false);

  useEffect(() => {
    const added = pins.find((p) => !known.current.has(p.id));
    known.current = new Set(pins.map((p) => p.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- server pins replace the optimistic list
    setItems(pins);
    if (added) {
      setFresh(added.id);
      // Bring the new pin into view if the list scrolls
      requestAnimationFrame(() => listRef.current?.querySelector(`[data-pin="${added.id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
      const t = setTimeout(() => setFresh(null), 1300);
      return () => clearTimeout(t);
    }
  }, [pins]);

  // Fade the edges only where there's more to scroll to
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const check = () => {
      const up = el.scrollTop > 2, down = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
      setOverflow(up && down ? "both" : up ? "top" : down ? "bottom" : "");
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", check);
      ro.disconnect();
    };
  }, [items.length]);

  function onDown(e: React.PointerEvent, id: string, k: number) {
    if (rail || e.button !== 0 || (e.target as HTMLElement).closest(".unpin")) return;
    const row = (e.currentTarget as HTMLElement).closest(".pin-row") as HTMLElement;
    drag.current = { id, y0: e.clientY, k0: k, h: row.offsetHeight, moved: false, to: k };
  }
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || !listRef.current) return;
      const dy = e.clientY - d.y0;
      if (!d.moved && Math.abs(dy) < 4) return;
      d.moved = true;
      const rows = [...listRef.current.querySelectorAll<HTMLElement>(".pin-row")];
      const min = -d.k0 * d.h, max = (rows.length - 1 - d.k0) * d.h;
      const c = Math.max(min - 12, Math.min(max + 12, dy));
      d.to = Math.max(0, Math.min(rows.length - 1, d.k0 + Math.round(c / d.h)));
      rows.forEach((r, k) => {
        if (k === d.k0) {
          r.dataset.dragging = "";
          r.style.transform = `translateY(${c}px) scale(1.02)`;
          return;
        }
        r.dataset.shift = "";
        let s = 0;
        if (k > d.k0 && k <= d.to) s = -d.h;
        if (k < d.k0 && k >= d.to) s = d.h;
        r.style.transform = s ? `translateY(${s}px)` : "";
      });
    };
    const up = () => {
      const d = drag.current;
      drag.current = null;
      if (!d?.moved || !listRef.current) return;
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 0);
      listRef.current.querySelectorAll<HTMLElement>(".pin-row").forEach((r) => {
        delete r.dataset.dragging;
        delete r.dataset.shift;
        r.style.transform = "";
      });
      if (d.to === d.k0) return;
      const next = [...items];
      const [p] = next.splice(d.k0, 1);
      next.splice(d.to, 0, p);
      setItems(next);
      start(() => reorderPins(next.map((x) => x.id)));
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    return () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
    };
  }, [items]);

  if (!items.length) return <p className="fade px-3 py-1 text-[12px] text-text-2" data-pins-empty>Pin an invoice or view to keep it here.</p>;

  return (
    <div ref={listRef} className="pins" data-overflow={overflow || undefined}>
      {items.map((p, k) => {
        const [bg, fg] = p.kind === "invoice" ? tintFor(p.label) : ["#FCEFDD", "#94470A"];
        const open = () => {
          if (justDragged.current) return;
          if (p.kind === "invoice") sheet.open(p.ref);
          else router.push(`/invoices?view=${p.ref}`);
        };
        return (
          <div key={p.id} className="pin-row" data-pin={p.id} data-new={fresh === p.id || undefined} data-leaving={leaving === p.id || undefined} onPointerDown={(e) => onDown(e, p.id, k)}>
            <NavTip show={showTip} label={p.label}>
              <div className="ni" role="button" tabIndex={0} onClick={open} onKeyDown={(e) => e.key === "Enter" && open()}>
                <span className="ic">
                  <span className="tile" style={{ background: bg, color: fg }}>
                    {p.kind === "invoice" ? <span className="iv-mono">{p.label.slice(-3)}</span> : <Icon name="alert" size={12} />}
                  </span>
                </span>
                <span className={`lb fade ${p.kind === "invoice" ? "iv-mono text-[13px]" : ""}`}>{p.label}</span>
                <button
                  type="button"
                  className="unpin fade"
                  aria-label={`Unpin ${p.label}`}
                  onClick={async (e) => {
                    e.stopPropagation();
                    // Collapse the row first, then remove it, so the list closes the gap smoothly
                    setLeaving(p.id);
                    setTimeout(() => {
                      setItems((cur) => cur.filter((x) => x.id !== p.id));
                      setLeaving(null);
                    }, 200);
                    await togglePin({ kind: p.kind, ref: p.ref, label: p.label });
                    toast({ title: `Unpinned ${p.label}`, undo: () => togglePin({ kind: p.kind, ref: p.ref, label: p.label }) });
                  }}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            </NavTip>
          </div>
        );
      })}
    </div>
  );
}
