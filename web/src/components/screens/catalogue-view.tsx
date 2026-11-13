"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { Button, MorphLabel } from "@/components/ui/button";
import { Segmented, TextField } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Dialog, DialogClose, DialogContent, DialogTrigger, Tooltip } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { Money } from "@/components/invoice/money";
import type { Currency } from "@/lib/format";
import { deleteCatalogItem, saveCatalogItem, type CatalogInput } from "@/server/crm-actions";

type Item = { id: string; name: string; price: number; currency: string; unit: string; used: number };
const CURRENCIES = ["USD", "GBP", "EUR", "NGN"] as const;
const UNITS = ["hour", "day", "month", "project", "item", "set"];

export function CatalogueView({ items }: { items: Item[] }) {
  const router = useRouter();
  const toast = useToast();
  return (
    <div className="wrap" style={{ maxWidth: 980 }}>
      <div className="ph">
        <div>
          <h1>Catalogue</h1>
          <p className="sub">Things you sell often. Add them to any invoice in one click from the editor.</p>
        </div>
        <div className="acts">
          <ItemDialog trigger={<Button variant="primary" icon="plus">New item</Button>} onSaved={(v) => { toast({ title: `${v.name} added to your catalogue` }); router.refresh(); }} />
        </div>
      </div>
      {items.length === 0 ? (
        <div className="empty"><b>Your catalogue is empty.</b>Add the services or products you bill most, with their usual price.</div>
      ) : (
        <table className="tbl" data-m="cat">
          <thead>
            <tr>
              <th aria-hidden="true" />
              <th>Item</th>
              <th>Charged per</th>
              <th>Used on</th>
              <th className="r">Price</th>
              <th style={{ width: 90 }}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td aria-hidden="true" />
                <td><b className="font-medium">{i.name}</b></td>
                <td className="text-text-2 capitalize">{i.unit}</td>
                <td className="text-text-2">{i.used ? `${i.used} invoice line${i.used === 1 ? "" : "s"}` : "Not used yet"}</td>
                <td className="r"><Money value={i.price} currency={i.currency as Currency} /></td>
                <td>
                  <div className="ra" style={{ opacity: 1 }}>
                    <ItemDialog
                      id={i.id}
                      initial={{ name: i.name, price: i.price, currency: i.currency, unit: i.unit }}
                      trigger={<Button size="sm" variant="ghost" iconOnly icon="pencil" aria-label={`Edit ${i.name}`} />}
                      onSaved={() => { toast({ title: "Item saved" }); router.refresh(); }}
                    />
                    <Tooltip label="Delete">
                      <Button
                        size="sm"
                        variant="ghost"
                        iconOnly
                        icon="trash"
                        aria-label={`Delete ${i.name}`}
                        onClick={async () => {
                          const removed = await deleteCatalogItem(i.id);
                          router.refresh();
                          if (removed) toast({ title: `${removed.name} deleted`, undo: async () => { await saveCatalogItem(null, removed); router.refresh(); } });
                        }}
                      />
                    </Tooltip>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-4 text-[13px] text-text-2">Deleting an item doesn&apos;t change invoices that already use it.</p>
    </div>
  );
}

function ItemDialog({ trigger, initial, id, onSaved }: { trigger: ReactElement; initial?: CatalogInput; id?: string; onSaved: (v: CatalogInput) => void }) {
  const blank: CatalogInput = { name: "", price: 0, currency: "USD", unit: "hour" };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<CatalogInput>(initial ?? blank);
  const [price, setPrice] = useState(initial ? initial.price.toFixed(2) : "");
  const [state, setState] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState("");
  async function save() {
    setError("");
    setState("saving");
    const input = { ...v, price: parseFloat(price) || 0 };
    const res = await saveCatalogItem(id ?? null, input);
    setState("idle");
    if (!res.ok) return setError(res.error);
    setOpen(false);
    onSaved(input);
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setV(initial ?? blank); setPrice(initial ? initial.price.toFixed(2) : ""); setError(""); } }}>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent
        title={id ? "Edit item" : "New catalogue item"}
        description="The price is a starting point. You can change it on each invoice."
        footer={
          <>
            <span className="iv-sp" />
            <DialogClose render={<Button>Cancel</Button>} />
            <Button variant="primary" onClick={save} disabled={state === "saving"} style={{ minWidth: 110 }}>
              <MorphLabel id={state}>{state === "saving" ? "Saving…" : <><Icon name="check" />{id ? "Save" : "Add item"}</>}</MorphLabel>
            </Button>
          </>
        }
      >
        <TextField label="Name" placeholder="e.g. Design hour" autoFocus value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Price" inputMode="decimal" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} />
          <TextField label="Charged per" list="units" value={v.unit} onChange={(e) => setV({ ...v, unit: e.target.value })} />
          <datalist id="units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
        </div>
        <div className="iv-field">
          <span className="iv-label">Currency</span>
          <Segmented label="Currency" value={v.currency as (typeof CURRENCIES)[number]} onChange={(c) => setV({ ...v, currency: c })} options={CURRENCIES.map((c) => ({ value: c, label: c }))} fill />
        </div>
        {error && <div className="form-error"><Icon name="alert" />{error}</div>}
      </DialogContent>
    </Dialog>
  );
}
