"use client";

import { useState, type ReactElement } from "react";
import { Button, MorphLabel } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/overlay";
import { formatDate } from "@/lib/invoice-math";
import { describeEnding, describeSchedule, FREQUENCIES, runDate, type Frequency } from "@/lib/schedule";
import type { Schedule } from "@/server/series-actions";

type EndKind = "never" | "after" | "on";
const endKind = (s: Schedule): EndKind => (s.endAfter != null ? "after" : s.endOn ? "on" : "never");

/** How often, when it ends, and what happens each time. Used in the editor, the invoice panel and the series page. */
export function ScheduleFields({ value, onChange, start, startIsNext, compact }: { value: Schedule; onChange: (s: Schedule) => void; start: string; startIsNext?: boolean; compact?: boolean }) {
  const kind = endKind(value);
  // `start` is either the first invoice (the next is one period later) or, for a running series, the next run itself
  const next = startIsNext ? start : firstAhead(start, value.frequency);
  return (
    <div className="sched" data-compact={compact || undefined}>
      <div className="iv-field">
        <span className="iv-label">Repeats</span>
        <Segmented fill label="How often it repeats" value={value.frequency} onChange={(f: Frequency) => onChange({ ...value, frequency: f })} options={FREQUENCIES.map((f) => ({ value: f.value, label: f.label }))} />
      </div>
      <div className="iv-field">
        <span className="iv-label">Ends</span>
        <Segmented
          fill
          label="When it ends"
          value={kind}
          onChange={(k: EndKind) => onChange({ ...value, endAfter: k === "after" ? (value.endAfter ?? 12) : null, endOn: k === "on" ? (value.endOn ?? runDate(start, value.frequency, 12)) : null })}
          options={[
            { value: "never", label: "Never" },
            { value: "after", label: "After a number" },
            { value: "on", label: "On a date" },
          ]}
        />
        {kind === "after" && (
          <label className="sched-inline">
            After
            <input className="iv-input" inputMode="numeric" value={value.endAfter ?? ""} onChange={(e) => onChange({ ...value, endAfter: parseInt(e.target.value.replace(/\D/g, "")) || 0 })} aria-label="Number of invoices" />
            invoices in total
          </label>
        )}
        {kind === "on" && (
          <label className="sched-inline">
            Last invoice on or before
            <input className="iv-input" type="date" min={next} value={value.endOn ?? ""} onChange={(e) => onChange({ ...value, endOn: e.target.value || null })} aria-label="End date" />
          </label>
        )}
      </div>
      <div className="iv-field">
        <span className="iv-label">Each time</span>
        <Segmented
          fill
          label="What happens each time"
          value={value.mode}
          onChange={(m: "send" | "draft") => onChange({ ...value, mode: m })}
          options={[
            { value: "send", label: "Send it for me" },
            { value: "draft", label: "Make a draft to check" },
          ]}
        />
      </div>
      <p className="sched-sum">
        <Icon name="repeat" size={14} />
        <span>
          {describeSchedule(start, value.frequency)}. The next one {value.mode === "send" ? "goes out" : "is drafted"} on <b>{formatDate(next, { year: true })}</b>. {describeEnding(value)}.
        </span>
      </p>
    </div>
  );
}

/** The first run after `start` that isn't in the past (an old invoice made recurring starts from the next date ahead). */
function firstAhead(start: string, frequency: Frequency) {
  const today = new Date().toISOString().slice(0, 10);
  let i = 1;
  while (runDate(start, frequency, i) < today && i < 1000) i++;
  return runDate(start, frequency, i);
}

export const DEFAULT_SCHEDULE: Schedule = { frequency: "monthly", endAfter: null, endOn: null, mode: "send" };

/** A dialog wrapper for ScheduleFields with its own save button. */
export function ScheduleDialog({
  trigger, title, description, initial, start, startIsNext, saveLabel, onSave,
}: {
  trigger: ReactElement; title: string; description: string; initial: Schedule; start: string; startIsNext?: boolean; saveLabel: string;
  onSave: (s: Schedule) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(initial);
  const [state, setState] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setV(initial); setError(""); } }}>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent
        title={title}
        description={description}
        footer={
          <>
            <span className="iv-sp" />
            <DialogClose render={<Button>Cancel</Button>} />
            <Button
              variant="primary"
              disabled={state === "saving"}
              style={{ minWidth: 120 }}
              onClick={async () => {
                setError("");
                setState("saving");
                const problem = await onSave(v);
                setState("idle");
                if (problem) return setError(problem);
                setOpen(false);
              }}
            >
              <MorphLabel id={state}>{state === "saving" ? "Saving…" : <><Icon name="check" />{saveLabel}</>}</MorphLabel>
            </Button>
          </>
        }
      >
        <ScheduleFields value={v} onChange={setV} start={start} startIsNext={startIsNext} />
        {error && <div className="form-error"><Icon name="alert" />{error}</div>}
      </DialogContent>
    </Dialog>
  );
}
