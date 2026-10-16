"use client";

import { X } from "lucide-react";
import { useLinkStatus } from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dialog } from "radix-ui";
import { useLayoutEffect, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "@/components/ui/button";
import { TaskDetailView } from "./task-detail";

/**
 * Task detail as a right-hand panel over the board/list. The underlying view,
 * its filters and scroll position are untouched; closing returns focus to the
 * card that opened it. Below md it becomes a full-screen sheet.
 */
export function TaskPanel(props: Omit<ComponentProps<typeof TaskDetailView>, "closeSlot" | "fullPageHref">) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const close = () => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("task");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <Dialog.Root open onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim-sheet md:bg-scrim-soft md:backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          tabIndex={-1}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement | null)?.focus();
          }}
          onCloseAutoFocus={(e) => {
            const origin = document.querySelector<HTMLElement>(`[data-task-link="${props.task.key}"]`);
            if (origin) {
              e.preventDefault();
              origin.focus();
            }
          }}
          className="qm-panel fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line-strong bg-surface shadow-float outline-none md:w-[460px] md:rounded-l-overlay"
        >
          <Dialog.Title className="sr-only">
            {props.task.key}: {props.task.title}
          </Dialog.Title>
          <TaskDetailView
            {...props}
            fullPageHref={`/t/${props.teamSlug}/tasks/${props.task.key}`}
            closeSlot={
              <Dialog.Close asChild>
                <IconButton label="Close task">
                  <X className="size-4" aria-hidden />
                </IconButton>
              </Dialog.Close>
            }
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Same response whether the key never existed or belongs to a private team. */
export function TaskMissingPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const close = () => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("task");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return (
    <Dialog.Root open onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim-soft" />
        <Dialog.Content
          aria-describedby="task-missing"
          className="qm-panel fixed inset-y-0 right-0 z-50 flex w-full flex-col gap-3 border-l border-line-strong bg-surface p-6 shadow-float md:w-[460px] md:rounded-l-overlay"
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-section font-semibold text-fg">This task isn&apos;t available</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton label="Close">
                <X className="size-4" aria-hidden />
              </IconButton>
            </Dialog.Close>
          </div>
          <p id="task-missing" className="text-body text-fg-2">
            It may have been archived or moved, or the link may be wrong.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Shown inside a task card's link while its navigation is pending: the panel
 * opens on click with what the card already knows (key and title), and the
 * server-rendered panel replaces it in place, without a second entrance.
 */
export function PendingTaskPanel({ taskKey, title }: { taskKey: string; title: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return createPortal(<PendingPanelShell taskKey={taskKey} title={title} />, document.body);
}

function PendingPanelShell({ taskKey, title }: { taskKey: string; title: string }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    return () => {
      // The real panel mounts in this same commit; skip its entrance.
      root.dataset.panelHandoff = "";
      window.setTimeout(() => delete root.dataset.panelHandoff, 400);
    };
  }, []);
  return (
    <>
      <div className="fixed inset-0 z-40 bg-scrim-sheet md:bg-scrim-soft md:backdrop-blur-[2px]" aria-hidden />
      <div
        role="status"
        aria-label={`Opening ${taskKey}`}
        data-state="open"
        className="qm-panel fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line-strong bg-surface shadow-float md:w-[460px] md:rounded-l-overlay"
      >
        <div className="flex h-[57px] items-center gap-2 border-b border-line px-5">
          <span className="font-mono text-label text-fg-3">{taskKey}</span>
          <span className="qm-skeleton h-7 w-28 rounded-sm" />
        </div>
        <div className="flex flex-col gap-6 px-5 py-5">
          <p className="text-[18px] leading-6 font-semibold text-fg [overflow-wrap:anywhere]">{title}</p>
          <div className="flex flex-col gap-2">
            <span className="qm-skeleton h-3.5 w-11/12 rounded-xs" />
            <span className="qm-skeleton h-3.5 w-3/4 rounded-xs" />
          </div>
          <div className="grid grid-cols-[96px_1fr] gap-x-4 gap-y-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="contents">
                <span className="qm-skeleton h-3.5 w-16 rounded-xs" />
                <span className="qm-skeleton h-8 rounded-sm" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
