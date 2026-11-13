"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CustomerDialog } from "@/components/screens/customer-form";

/** New workspaces have no customers yet. An invoice needs someone to pay it, so start there. */
export function FirstCustomer() {
  const router = useRouter();
  return (
    <div className="wrap" style={{ maxWidth: 560 }}>
      <div className="empty" style={{ paddingTop: 72 }}>
        <h1 style={{ fontSize: "var(--fs-22)", fontWeight: 600, color: "var(--text)" }}>Who are you billing?</h1>
        <p className="mt-2">Add your first customer. Their currency and payment terms fill in on every invoice you make for them.</p>
        <div className="mt-6">
          <CustomerDialog trigger={<Button variant="primary" icon="plus">Add a customer</Button>} onSaved={() => router.refresh()} />
        </div>
      </div>
    </div>
  );
}
