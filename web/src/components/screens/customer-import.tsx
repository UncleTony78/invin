"use client";

import { useState } from "react";
import { Button, MorphLabel } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/overlay";
import { useWorkspaceCurrency } from "@/components/shell/workspace-context";
import { matchColumns, parseCsv, toCustomers, type ImportRow } from "@/lib/customer-import";
import { importCustomers } from "@/server/crm-actions";

/**
 * Pick or drop a CSV, see exactly what will happen (new, updated, skipped), then import.
 * Nothing is saved until the last button, and the file never leaves the browser until then.
 */
export function CustomerImport({ existingEmails, onDone }: { existingEmails: string[]; onDone: (msg: string) => void }) {
  const home = useWorkspaceCurrency();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const [state, setState] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState("");

  const known = new Set(existingEmails.map((e) => e.toLowerCase()));
  const ok = rows.filter((r) => !r.problem);
  const updates = ok.filter((r) => known.has(r.email)).length;
  const news = ok.length - updates;

  async function read(f: File) {
    setError("");
    if (!/\.(csv|txt)$/i.test(f.name) && f.type !== "text/csv") return setError("Choose a .csv file. Most spreadsheet apps can save one with File › Download or Export.");
    if (f.size > 2_000_000) return setError("That file is over 2 MB. Split it into smaller files.");
    const table = parseCsv(await f.text());
    if (table.length < 2) return setError("That file has no customer rows under the header.");
    const map = matchColumns(table[0]);
    const need = (["name", "email"] as const).filter((k) => map[k] == null);
    setMissing(need.map((k) => (k === "name" ? "Name" : "Email")));
    setFile(f.name);
    setRows(need.length ? [] : toCustomers(table.slice(1), map, home));
  }

  function reset() {
    setFile(null);
    setRows([]);
    setMissing([]);
    setError("");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) reset(); }}>
      <DialogTrigger>
        <Button icon="upload" className="imp-btn">Import CSV</Button>
      </DialogTrigger>
      <DialogContent
        title="Import customers"
        description="From a spreadsheet with a Name and Email column. Address, Currency and Payment terms are used if they're there."
        footer={
          <>
            {file && <Button variant="ghost" onClick={reset}>Choose another file</Button>}
            <span className="iv-sp" />
            <DialogClose render={<Button>Cancel</Button>} />
            <Button
              variant="primary"
              disabled={!ok.length || state === "saving"}
              style={{ minWidth: 150 }}
              onClick={async () => {
                setState("saving");
                const res = await importCustomers(ok.map(({ name, email, address, currency, termsDays }) => ({ name, email, address, currency, termsDays })));
                setState("idle");
                if (!res.ok) return setError(res.error);
                setOpen(false);
                onDone([res.added && `${res.added} added`, res.updated && `${res.updated} updated`, res.skipped && `${res.skipped} skipped`].filter(Boolean).join(", ") || "Nothing to import");
              }}
            >
              <MorphLabel id={state}>{state === "saving" ? "Importing…" : <><Icon name="check" />Import {ok.length || ""} customer{ok.length === 1 ? "" : "s"}</>}</MorphLabel>
            </Button>
          </>
        }
      >
        {!file ? (
          <label
            className="imp-drop"
            data-drag={drag || undefined}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) void read(f); }}
          >
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); }} />
            <Icon name="upload" size={22} />
            <b>Drop a CSV here, or choose a file</b>
            <span>Columns can be in any order. The first row should be the headers.</span>
          </label>
        ) : missing.length ? (
          <div className="form-error"><Icon name="alert" />{file} has no {missing.join(" or ")} column. Rename the header and try again.</div>
        ) : (
          <>
            <div className="imp-sum">
              <span><b>{news}</b> new</span>
              <span><b>{updates}</b> update existing</span>
              <span data-bad={rows.length - ok.length > 0 || undefined}><b>{rows.length - ok.length}</b> can&apos;t import</span>
              <small>{file}</small>
            </div>
            <div className="imp-table">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Pays in</th><th /></tr></thead>
                <tbody>
                  {rows.slice(0, 50).map((r) => (
                    <tr key={r.line} data-bad={r.problem ? true : undefined}>
                      <td>{r.name || <i>Missing</i>}</td>
                      <td>{r.email || <i>Missing</i>}</td>
                      <td>{r.currency}</td>
                      <td>{r.problem ? <span className="imp-tag" data-t="bad">Row {r.line}: {r.problem}</span> : known.has(r.email) ? <span className="imp-tag" data-t="upd">Update</span> : <span className="imp-tag" data-t="new">New</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 50 && <p className="imp-more">And {rows.length - 50} more rows</p>}
            </div>
            <p className="iv-hint">A customer whose email is already here gets updated, not duplicated. Empty cells keep what&apos;s saved.</p>
          </>
        )}
        {error && <div className="form-error"><Icon name="alert" />{error}</div>}
      </DialogContent>
    </Dialog>
  );
}
