"use client";

import { RelativeTime } from "@/components/ui/relative-time";
import { Check, EyeOff, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { IssueKey } from "@/components/ui/badges";
import { Button, IconButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { toast } from "@/components/ui/toast";
import type { InboxItem } from "@/server/dal/notifications";
import { markAllRead, setRead } from "./actions";

export function InboxList({
  items,
  descriptions,
  timezone,
}: {
  items: InboxItem[];
  descriptions: Record<number, string>;
  timezone: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const unread = items.filter((i) => !i.read).length;

  const open = (item: InboxItem) => {
    if (!item.target) return;
    startTransition(async () => {
      if (!item.read) await setRead([item.id], true);
      router.push(item.target!.href);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-label text-fg-2" aria-live="polite">
          {unread ? `${unread} unread` : "All caught up"}
        </p>
        {unread > 0 && (
          <Button
            size="sm"
            icon={<Check className="size-3.5" aria-hidden />}
            pending={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await markAllRead();
                toast(res.ok ? "Marked everything as read." : res.error.message, res.ok ? "success" : "error");
              })
            }
          >
            Mark all as read
          </Button>
        )}
      </div>
      <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface shadow-panel">
        {items.map((item) => (
          <li key={item.id} className={cn("flex items-start gap-3 px-4 py-3", !item.read && "bg-selected/50")}>
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.read ? "bg-transparent" : "bg-accent")} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-body text-fg">
                <span className="font-medium">{item.actorName ?? "Someone"}</span> {descriptions[item.id]}
                {!item.read && <span className="sr-only"> (unread)</span>}
              </p>
              {item.target ? (
                <button
                  type="button"
                  onClick={() => open(item)}
                  className="mt-1 flex max-w-full items-center gap-2 rounded-xs text-left hover:text-accent"
                >
                  <IssueKey className="shrink-0">{item.target.label}</IssueKey>
                  <span className="truncate text-body text-fg-2 hover:text-accent">{item.target.title}</span>
                  {item.target.detail && <span className="shrink-0 text-meta text-fg-3">· {item.target.detail}</span>}
                </button>
              ) : (
                <p className="mt-1 flex items-center gap-1.5 text-label text-fg-3">
                  <EyeOff className="size-3.5" aria-hidden /> This item is no longer available to you.
                </p>
              )}
              <p className="mt-1 text-meta text-fg-3">
                <RelativeTime iso={item.createdAt} timeZone={timezone} />
              </p>
            </div>
            <IconButton
              size="sm"
              label={item.read ? "Mark as unread" : "Mark as read"}
              onClick={() =>
                startTransition(async () => {
                  const res = await setRead([item.id], !item.read);
                  if (!res.ok) toast(res.error.message, "error");
                })
              }
            >
              {item.read ? <RotateCcw className="size-3.5" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
            </IconButton>
          </li>
        ))}
      </ul>
    </div>
  );
}
