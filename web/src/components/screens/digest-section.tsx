"use client";

import { useState } from "react";
import { Button, MorphLabel } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { sendDigestNow, setDigest } from "@/server/digest-actions";

export type DigestState = { kind: "off" | "daily" | "weekly"; email: string };

const WHEN = {
  off: "No summary emails. You'll still see everything in notifications.",
  daily: "Every morning from 8am, covering the day before. Quiet days are skipped.",
  weekly: "Monday mornings from 8am, covering the week before. Quiet weeks are skipped.",
};

/** Personal: saves as soon as you pick, no Save bar. */
export function DigestSection({ d }: { d: DigestState }) {
  const toast = useToast();
  const [kind, setKind] = useState(d.kind);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pick(next: DigestState["kind"]) {
    const prev = kind;
    setKind(next);
    setError("");
    const r = await setDigest(next);
    if (!r.ok) {
      setKind(prev);
      return setError(r.error);
    }
    toast({ title: next === "off" ? "Summary emails off" : `You'll get a ${next} summary` });
  }

  async function sendNow() {
    setBusy(true);
    setError("");
    const r = await sendDigestNow();
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast({ title: `Summary sent to ${r.to}` });
  }

  return (
    <div className="grid gap-3">
      <Segmented label="How often" value={kind} onChange={pick} options={[{ value: "off", label: "Off" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }]} />
      <p className="iv-hint" aria-live="polite">{WHEN[kind]} It goes to {d.email}.</p>
      {kind !== "off" && (
        <div>
          <Button size="sm" variant="ghost" icon="mail" onClick={sendNow} disabled={busy}>
            <MorphLabel id={busy ? "s" : "i"}>{busy ? "Sending…" : "Send me one now"}</MorphLabel>
          </Button>
        </div>
      )}
      {error && <div className="form-error"><Icon name="alert" />{error}</div>}
    </div>
  );
}
