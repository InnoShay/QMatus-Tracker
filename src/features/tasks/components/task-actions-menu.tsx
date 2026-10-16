"use client";

import { ArrowRightLeft, Ellipsis, Link2, PanelRight, UserRound } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { IconButton } from "@/components/ui/button";
import { StatusIcon } from "@/components/ui/badges";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import type { Status } from "../types";

/** The non-drag path for every board move (WCAG 2.2 SC 2.5.7). */
export function TaskActionsMenu({
  taskKey,
  title,
  href,
  currentStatus,
  allowed,
  canWrite,
  onMove,
  onAssignToMe,
  disabled,
}: {
  taskKey: string;
  title: string;
  href: string;
  currentStatus: Status;
  allowed: Status[];
  canWrite: boolean;
  onMove: (statusId: string) => void;
  onAssignToMe?: () => void;
  disabled?: boolean;
}) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label={`Actions for ${taskKey}: ${title}`} size="sm" disabled={disabled}>
          <Ellipsis className="size-4" aria-hidden />
        </IconButton>
      </MenuTrigger>
      <MenuContent className="w-56">
        <MenuItem asChild>
          <a href={href}>
            <PanelRight className="size-4 text-fg-3" aria-hidden /> Open
          </a>
        </MenuItem>
        {canWrite && (
          <>
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger className="flex h-8 cursor-default items-center gap-2 rounded-sm px-2 text-body text-fg outline-none select-none data-[highlighted]:bg-hover data-[state=open]:bg-hover pointer-coarse:h-10">
                <ArrowRightLeft className="size-4 text-fg-3" aria-hidden /> Move to…
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent
                  sideOffset={4}
                  collisionPadding={12}
                  className="qm-popover z-50 min-w-44 rounded-md border border-line-strong bg-surface p-1 shadow-float"
                >
                  {allowed.length === 0 && <p className="px-2 py-1.5 text-meta text-fg-3">No moves allowed from {currentStatus.label}.</p>}
                  {allowed.map((s) => (
                    <MenuItem key={s.id} onSelect={() => onMove(s.id)}>
                      <StatusIcon statusKey={s.key} /> {s.label}
                    </MenuItem>
                  ))}
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>
            {onAssignToMe && (
              <MenuItem onSelect={onAssignToMe}>
                <UserRound className="size-4 text-fg-3" aria-hidden /> Assign to me
              </MenuItem>
            )}
          </>
        )}
        <MenuSeparator />
        <MenuItem
          onSelect={() => {
            const url = new URL(href, window.location.origin).toString();
            navigator.clipboard?.writeText(url).then(
              () => toast(`Link to ${taskKey} copied.`),
              () => toast("Couldn't copy the link.", "error"),
            );
          }}
        >
          <Link2 className="size-4 text-fg-3" aria-hidden /> Copy link
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
