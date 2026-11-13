"use client";

import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { clsx } from "clsx";
import type { ReactNode } from "react";
import { initials, tintFor } from "@/lib/format";
import { Glyph } from "../invoice/status";
import { Popover, PopoverContent, PopoverTrigger } from "./overlay";

export function Avatar({ name, size = "sm", label }: { name: string; size?: "sm" | "md" | "lg"; label?: string }) {
  const [bg, fg] = tintFor(name);
  return (
    <span className={clsx("iv-avatar", `iv-avatar--${size}`)} style={{ background: bg, color: fg }} aria-hidden={!label} aria-label={label}>
      {initials(name)}
    </span>
  );
}

export function Tag({ tone = "neutral", children }: { tone?: "neutral" | "agent"; children: ReactNode }) {
  return <span className={clsx("iv-tag", `iv-tag--${tone}`)}>{children}</span>;
}

export type Actor =
  | { kind: "person"; name: string; short: string; role: string; email: string }
  | { kind: "agent"; name: string; owner: string }
  | { kind: "system" }
  | { kind: "customer"; name: string };

/** Who did something, with a small card on click. Agents and automatic actions are always labelled. */
export function ActorChip({ actor }: { actor: Actor }) {
  if (actor.kind === "system")
    return (
      <span className="inline-flex items-center gap-2">
        <span className="iv-person">
          <Glyph status="invin" />
          InVin
        </span>
        <Tag>Automatic</Tag>
      </span>
    );
  if (actor.kind === "customer")
    return (
      <span className="inline-flex items-center gap-2">
        <span className="iv-person">
          <Avatar name={actor.name} />
          {actor.name}
        </span>
        <Tag>Customer</Tag>
      </span>
    );
  const isAgent = actor.kind === "agent";
  return (
    <span className="inline-flex items-center gap-2">
      <Popover>
        <PopoverTrigger>
          <button type="button" className="iv-person">
            {isAgent ? <Glyph status="spark" /> : <Avatar name={actor.name} />}
            <span className="iv-name">{isAgent ? actor.name : actor.short}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent>
          <div className="flex items-start gap-3 p-2.5" style={{ maxWidth: 300 }}>
            {isAgent ? (
              <span className="iv-avatar iv-avatar--lg" style={{ background: "var(--agent-bg)" }}>
                <Glyph status="spark" />
              </span>
            ) : (
              <Avatar name={actor.name} size="lg" />
            )}
            <div>
              <b className="font-medium">{actor.name}</b>
              <p className="text-[13px] text-text-2 leading-snug mt-0.5">
                {isAgent
                  ? `An AI agent ${actor.owner} connected through InVin MCP. It drafts invoices and reminders, and acts on money only after approval.`
                  : `${actor.role} · ${actor.email}`}
              </p>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {isAgent && <Tag tone="agent">Agent</Tag>}
    </span>
  );
}

/* ---------------- Tabs (switch instantly: used all day) ---------------- */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  children,
}: {
  tabs: { value: T; label: ReactNode; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  children?: ReactNode;
}) {
  return (
    <BaseTabs.Root value={value} onValueChange={(v) => onChange(v as T)}>
      <BaseTabs.List className="iv-tabs-list">
        {tabs.map((t) => (
          <BaseTabs.Tab key={t.value} value={t.value} className="iv-tab">
            {t.label}
            {t.count !== undefined && <span className="iv-count">{t.count}</span>}
          </BaseTabs.Tab>
        ))}
        <BaseTabs.Indicator className="iv-tab-indicator" />
      </BaseTabs.List>
      {children}
    </BaseTabs.Root>
  );
}
export const TabPanel = BaseTabs.Panel;
