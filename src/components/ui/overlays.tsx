"use client";

import { X } from "lucide-react";
import { AlertDialog, Dialog, DropdownMenu, Tooltip } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "./button";
import { cn } from "./cn";

/* ------------------------------------------------------------------ Menu */

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({ className, align = "end", ...rest }: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        collisionPadding={12}
        className={cn(
          "qm-popover z-50 min-w-48 max-w-[min(20rem,calc(100vw-24px))] rounded-md border border-line-strong bg-surface p-1 shadow-float",
          className,
        )}
        {...rest}
      />
    </DropdownMenu.Portal>
  );
}

export function MenuItem({ className, danger, ...rest }: ComponentProps<typeof DropdownMenu.Item> & { danger?: boolean }) {
  return (
    <DropdownMenu.Item
      className={cn(
        "flex h-8 cursor-default items-center gap-2 rounded-sm px-2 text-body outline-none select-none pointer-coarse:h-10",
        "data-[highlighted]:bg-hover data-[disabled]:cursor-not-allowed data-[disabled]:text-fg-3",
        danger ? "text-danger" : "text-fg",
        className,
      )}
      {...rest}
    />
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <DropdownMenu.Label className="px-2 pt-1.5 pb-1 text-meta font-medium text-fg-3">{children}</DropdownMenu.Label>;
}

export const MenuSeparator = () => <DropdownMenu.Separator className="my-1 h-px bg-line" />;

/* --------------------------------------------------------------- Tooltip */

/** Modest first delay; adjacent tooltips open instantly (Emil: skip delay). */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <Tooltip.Provider delayDuration={350} skipDelayDuration={300}>
      {children}
    </Tooltip.Provider>
  );
}

export function Tip({ label, children, side = "top" }: { label: string; children: ReactNode; side?: "top" | "right" | "bottom" }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={6}
          className="qm-popover z-50 rounded-sm bg-fg px-2 py-1 text-meta text-canvas shadow-float"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/* --------------------------------------------------------------- Dialogs */

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <Dialog.Content
          className={cn(
            "qm-dialog fixed top-1/2 left-1/2 z-50 flex max-h-[min(90dvh,760px)] w-[calc(100vw-24px)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col",
            "rounded-overlay border border-line-strong bg-surface shadow-float",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-section font-semibold text-fg">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-body text-fg-2">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="-mr-1.5 grid size-8 place-items-center rounded-sm text-fg-3 hover:bg-hover hover:text-fg"
              aria-label="Close"
            >
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="min-h-0 overflow-y-auto px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Destructive or consequential confirmation: states what happens and if it's reversible. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  consequence,
  confirmLabel,
  onConfirm,
  pending,
  danger = true,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  consequence: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  danger?: boolean;
  children?: ReactNode;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <AlertDialog.Content className="qm-dialog fixed top-1/2 left-1/2 z-50 w-[calc(100vw-24px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-overlay border border-line-strong bg-surface p-5 shadow-float">
          <AlertDialog.Title className="text-section font-semibold text-fg">{title}</AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="mt-2 text-body text-fg-2">{consequence}</div>
          </AlertDialog.Description>
          {children}
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AlertDialog.Cancel>
            <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} pending={pending} pendingLabel="Working…">
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
