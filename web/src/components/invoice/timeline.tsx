"use client";

import { Collapsible } from "@base-ui/react/collapsible";
import { useState, type ReactNode } from "react";
import { ActorChip, type Actor } from "../ui/identity";
import { Icon } from "../ui/icon";

export type TimelineEvent = {
  id: string;
  time: string;
  title: string;
  actor: Actor;
  note?: string;
  /** Agent actions carry what happened, who approved it and the result. */
  execution?: { label: string; value: ReactNode }[];
};

/** The record: every change, who made it and why. Agent rows expand to show their work. */
export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="iv-tl">
      {events.map((e) => (
        <li key={e.id} className="iv-ev" data-hot={e.actor.kind === "agent" || undefined}>
          <time>{e.time}</time>
          <div className="iv-ev-title">{e.title}</div>
          <div className="iv-ev-by">
            <ActorChip actor={e.actor} />
          </div>
          {e.note && <div className="iv-ev-note">{e.note}</div>}
          {e.execution && <ExecutionDetails rows={e.execution} />}
        </li>
      ))}
    </ol>
  );
}

function ExecutionDetails({ rows }: { rows: NonNullable<TimelineEvent["execution"]> }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger className="iv-xd-toggle">
        {open ? "Hide details" : "Show what the agent did"}
        <Icon name="chevron" size={14} />
      </Collapsible.Trigger>
      <Collapsible.Panel className="iv-xd-panel">
        <dl>
          {rows.map((r) => (
            <div key={r.label}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
