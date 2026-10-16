"use client";

import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dialog } from "radix-ui";
import type { ComponentProps } from "react";
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
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim-sheet md:bg-scrim-soft" />
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
