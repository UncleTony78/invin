import { Icon, type IconName } from "@/components/ui/icon";
import type { EstimateStatus } from "@/server/estimates";

const LOOK: Record<EstimateStatus, { label: string; tone: string; icon: IconName }> = {
  draft: { label: "Draft", tone: "draft", icon: "pencil" },
  sent: { label: "Sent", tone: "sent", icon: "send" },
  viewed: { label: "Opened", tone: "viewed", icon: "eye" },
  accepted: { label: "Accepted", tone: "paid", icon: "check" },
  declined: { label: "Declined", tone: "failed", icon: "x" },
  expired: { label: "Expired", tone: "overdue", icon: "clock" },
  converted: { label: "Invoiced", tone: "scheduled", icon: "file" },
};

/** Same pill shape as invoices, with an icon and a word, never colour alone. */
export function EstimatePill({ status }: { status: EstimateStatus }) {
  const l = LOOK[status];
  return (
    <span className={`iv-pill st-${l.tone}`}>
      <Icon name={l.icon} size={13} />
      {l.label}
    </span>
  );
}
