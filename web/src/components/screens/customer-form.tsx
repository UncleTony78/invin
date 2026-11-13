"use client";

import { useState, type ReactElement } from "react";
import { Button, MorphLabel } from "@/components/ui/button";
import { Segmented, TextField } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/overlay";
import { useWorkspaceCurrency } from "@/components/shell/workspace-context";
import { createCustomer, updateCustomer, type CustomerInput } from "@/server/crm-actions";

const CURRENCIES = ["USD", "GBP", "EUR", "NGN"] as const;
const TERMS = [
  { value: "0", label: "On receipt" },
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
] as const;

/** Add or edit a customer. Their currency and terms fill in on every new invoice for them. */
export function CustomerDialog({
  trigger,
  initial,
  id,
  onSaved,
  open: controlled,
  onOpenChange,
  prefillName,
}: {
  /** Omit when the dialog is opened from elsewhere (controlled with `open`) */
  trigger?: ReactElement;
  initial?: CustomerInput;
  id?: string;
  onSaved: (id: string, input: CustomerInput) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Start the name field with what they typed while searching */
  prefillName?: string;
}) {
  const home = useWorkspaceCurrency();
  const blank: CustomerInput = { name: prefillName ?? "", email: "", address: "", currency: home, termsDays: 14 };
  const [own, setOwn] = useState(false);
  const open = controlled ?? own;
  const setOpen = (o: boolean) => {
    setOwn(o);
    onOpenChange?.(o);
  };
  const [v, setV] = useState<CustomerInput>(initial ?? blank);
  const [state, setState] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState("");
  // A controlled dialog starts fresh each time it opens
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setV(initial ?? blank);
      setError("");
    }
  }

  async function save() {
    setError("");
    setState("saving");
    const res = id ? await updateCustomer(id, v) : await createCustomer(v);
    setState("idle");
    if (!res.ok) return setError(res.error);
    setOpen(false);
    onSaved(id ?? ("id" in res && typeof res.id === "string" ? res.id : ""), v);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setV(initial ?? blank);
          setError("");
        }
      }}
    >
      {trigger && <DialogTrigger>{trigger}</DialogTrigger>}
      <DialogContent
        title={id ? "Edit customer" : "New customer"}
        description={id ? "Changes apply to new invoices. Invoices already sent keep the details they were sent with." : "Their currency and payment terms fill in on every invoice you make for them."}
        footer={
          <>
            <span className="iv-sp" />
            <DialogClose render={<Button>Cancel</Button>} />
            <Button variant="primary" onClick={save} disabled={state === "saving"} style={{ minWidth: 120 }}>
              <MorphLabel id={state}>{state === "saving" ? "Saving…" : <><Icon name="check" />{id ? "Save changes" : "Add customer"}</>}</MorphLabel>
            </Button>
          </>
        }
      >
        <TextField label="Name" placeholder="e.g. Acme Corp" value={v.name} autoFocus onChange={(e) => setV({ ...v, name: e.target.value })} />
        <TextField label="Billing email" type="email" placeholder="billing@company.com" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} description="Invoices and reminders go here." />
        <TextField label="Address (optional)" placeholder="Street, city" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} />
        <div className="grid gap-4">
          <div className="iv-field">
            <span className="iv-label">They pay in</span>
            <Segmented label="Currency" value={v.currency as (typeof CURRENCIES)[number]} onChange={(c) => setV({ ...v, currency: c })} options={CURRENCIES.map((c) => ({ value: c, label: c }))} fill />
          </div>
          <div className="iv-field">
            <span className="iv-label">Time to pay</span>
            <Segmented label="Time to pay" value={String(v.termsDays) as (typeof TERMS)[number]["value"]} onChange={(t) => setV({ ...v, termsDays: Number(t) })} options={[...TERMS]} fill />
          </div>
        </div>
        {error && <div className="form-error"><Icon name="alert" />{error}</div>}
      </DialogContent>
    </Dialog>
  );
}
