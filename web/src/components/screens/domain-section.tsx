"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, MorphLabel } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { addSendingDomain, checkSendingDomain, removeSendingDomain, setFromAddress } from "@/server/domain-actions";

export type DomainState = { domain: string | null; status: string; records: { type: string; name: string; value: string; status: string }[]; fromEmail: string | null };

/** Send from your own domain: add it, copy the DNS records, check until it's verified. */
export function DomainSection({ d, canManage }: { d: DomainState; canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [domain, setDomain] = useState("");
  const [local, setLocal] = useState(d.fromEmail?.split("@")[0] ?? "invoices");
  const [busy, setBusy] = useState<"" | "add" | "check" | "from" | "remove">("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  async function act<T extends { ok: boolean; error?: string }>(kind: typeof busy, fn: () => Promise<T>, okMsg?: (r: T) => string) {
    setBusy(kind);
    setError("");
    const r = await fn();
    setBusy("");
    if (!r.ok) return setError(r.error ?? "Something went wrong.");
    if (okMsg) toast({ title: okMsg(r) });
    router.refresh();
  }
  const copy = (v: string, key: string) => {
    navigator.clipboard?.writeText(v);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1200);
  };

  if (!d.domain) {
    return (
      <div className="dom">
        <p className="iv-hint">Emails go out from InVin&apos;s shared address with your business name on them. Add your own domain so they come from you, like invoices@yourstudio.com.</p>
        <form className="dom-add" onSubmit={(e) => { e.preventDefault(); act("add", () => addSendingDomain(domain, local), () => "Domain added. Now add the DNS records below."); }}>
          <label className="iv-field"><span className="iv-label">Send from</span>
            <span className="dom-addr">
              <input className="iv-input" value={local} onChange={(e) => setLocal(e.target.value)} aria-label="Name before the @" disabled={!canManage} />
              <span>@</span>
              <input className="iv-input" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="yourstudio.com" aria-label="Your domain" disabled={!canManage} />
            </span>
          </label>
          <Button type="submit" disabled={!canManage || !domain.trim() || busy === "add"}><MorphLabel id={busy || "i"}>{busy === "add" ? "Adding…" : "Add domain"}</MorphLabel></Button>
        </form>
        {error && <div className="form-error"><Icon name="alert" />{error}</div>}
      </div>
    );
  }

  const verified = d.status === "verified";
  return (
    <div className="dom">
      <div className="dom-head" data-status={d.status}>
        <span className="dom-dot" />
        <span className="flex-1">
          <b>{d.domain}</b>
          <small>{verified ? `Verified. Emails come from ${d.fromEmail}.` : d.status === "failed" ? "Resend couldn't verify the records yet. Check they match exactly, then try again." : "Waiting for the DNS records below. Changes can take a few minutes to an hour."}</small>
        </span>
        {!verified && <Button size="sm" disabled={!canManage || !!busy} onClick={() => act("check", checkSendingDomain, (r) => ((r as { status?: string }).status === "verified" ? "Verified. Emails now come from your domain." : "Not verified yet. Give DNS a little longer."))}><MorphLabel id={busy === "check" ? "c" : "i"}>{busy === "check" ? "Checking…" : "Check again"}</MorphLabel></Button>}
        <Button size="sm" variant="ghost" disabled={!canManage || !!busy} onClick={() => act("remove", removeSendingDomain, () => "Domain removed. Emails use the shared address again.")}>Remove</Button>
      </div>

      {!verified && d.records.length > 0 && (
        <div className="dom-recs">
          <p className="iv-hint">Add these at your domain&apos;s DNS host (where you bought the domain, or Cloudflare). Copy each value exactly.</p>
          <table>
            <thead><tr><th>Type</th><th>Name</th><th>Value</th><th /></tr></thead>
            <tbody>
              {d.records.map((r, i) => (
                <tr key={i} data-ok={r.status === "verified" || undefined}>
                  <td className="iv-mono">{r.type}</td>
                  <td className="iv-mono dom-cell">{r.name}</td>
                  <td className="iv-mono dom-cell">{r.value}</td>
                  <td>
                    {r.status === "verified" ? <span className="dom-ok"><Icon name="check" size={13} />Found</span> : (
                      <Tooltip label={copied === `v${i}` ? "Copied" : "Copy value"}>
                        <Button size="sm" variant="ghost" iconOnly icon={copied === `v${i}` ? "check" : "copy"} aria-label={`Copy the ${r.type} value`} onClick={() => copy(r.value, `v${i}`)} />
                      </Tooltip>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {verified && (
        <form className="dom-add" onSubmit={(e) => { e.preventDefault(); act("from", () => setFromAddress(local), () => `Emails now come from ${local}@${d.domain}`); }}>
          <label className="iv-field"><span className="iv-label">From address</span>
            <span className="dom-addr"><input className="iv-input" value={local} onChange={(e) => setLocal(e.target.value)} aria-label="Name before the @" disabled={!canManage} /><span>@{d.domain}</span></span>
          </label>
          {local !== d.fromEmail?.split("@")[0] && <Button type="submit" disabled={!canManage}>Save</Button>}
        </form>
      )}
      {error && <div className="form-error"><Icon name="alert" />{error}</div>}
    </div>
  );
}
