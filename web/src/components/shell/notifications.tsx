"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlay";
import { fetchNotifications, markNotificationsSeen, unreadCount, type NotificationDTO } from "@/server/notification-actions";
import { useInvoiceSheet } from "./invoice-sheet";

const KIND: Record<string, { icon: IconName; tone: string }> = {
  viewed: { icon: "eye", tone: "viewed" },
  claim: { icon: "cash", tone: "awaiting" },
  paid: { icon: "check", tone: "paid" },
  overdue: { icon: "alert", tone: "overdue" },
  recurring: { icon: "repeat", tone: "scheduled" },
  failed: { icon: "mail", tone: "failed" },
  refund: { icon: "cash", tone: "draft" },
  credit: { icon: "cash", tone: "sent" },
};

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 172800) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * The bell: a count of what's new since you last looked, and a short feed.
 * Checks every minute while the tab is visible. Opening it marks everything seen,
 * but new items keep their dot until the panel closes so you can tell what changed.
 */
export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const router = useRouter();
  const sheet = useInvoiceSheet();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<NotificationDTO[] | null>(null);
  const [bump, setBump] = useState(0);
  const last = useRef(initialUnread);

  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const n = await unreadCount().catch(() => last.current);
      // Something new arrived: the bell gives one small swing to say so
      if (n > last.current) setBump((b) => b + 1);
      last.current = n;
      setUnread(n);
    };
    const t = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  async function load() {
    const r = await fetchNotifications();
    setItems(r.items);
    if (r.unread) await markNotificationsSeen();
    last.current = 0;
    setUnread(0);
  }

  function go(n: NotificationDTO) {
    setOpen(false);
    if (n.href) router.push(n.href);
    else if (n.invoiceId) sheet.open(n.invoiceId);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void load();
        // Closing turns this round's "new" dots off
        else setItems((cur) => cur?.map((x) => ({ ...x, unread: false })) ?? null);
      }}
    >
      <PopoverTrigger>
        <Button variant="ghost" iconOnly className="bell" aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}>
          {/* Re-keyed when something new arrives, so the swing plays once */}
          <span key={bump} className="bell-ic" data-bump={bump || undefined}><Icon name="bell" /></span>
          {unread > 0 && <span className="bell-ct" aria-hidden="true">{unread > 9 ? "9+" : unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent width={380} align="end">
        <div className="nt-head">
          <b>Notifications</b>
          <span className="text-[12px] text-text-2">Last 40</span>
        </div>
        <div className="nt-list">
          {items === null && [0, 1, 2].map((k) => <div key={k} className="nt-row nt-sk"><span /><span /></div>)}
          {items?.length === 0 && (
            <div className="nt-empty">
              <Icon name="bell" />
              <b>You&apos;re all caught up</b>
              <span>When a customer opens or pays an invoice, it shows up here.</span>
            </div>
          )}
          {items?.map((n) => {
            const k = KIND[n.kind] ?? KIND.viewed;
            return (
              <button key={n.id} type="button" className="nt-row" data-unread={n.unread || undefined} onClick={() => go(n)}>
                <span className={`nt-ic st-${k.tone}`}><Icon name={k.icon} size={14} /></span>
                <span className="min-w-0 flex-1">
                  <b>{n.title}</b>
                  {n.body && <small>{n.body}</small>}
                </span>
                <time dateTime={n.at}>{ago(n.at)}</time>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
