"use client";

import { Check, ChevronsUpDown, LocateFixed, Search } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/components/ui/cn";
import { modernZone, searchZones, type ZoneOption } from "@/lib/timezones";

const noop = () => () => {};

/**
 * Searchable time zone picker. Type a city, country-style name ("India"), an
 * abbreviation ("IST") or an offset ("+5:30"); arrows move, Enter picks,
 * Escape closes. Submits the IANA id through a hidden input named `name`.
 */
export function TimeZonePicker({
  id,
  name,
  defaultValue,
  zones,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: {
  id?: string;
  name: string;
  defaultValue: string;
  zones: ZoneOption[];
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const [value, setValue] = useState(() => modernZone(defaultValue));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  // The browser's own zone, offered as a one-click choice (client only).
  const device = useSyncExternalStore(
    noop,
    () => modernZone(Intl.DateTimeFormat().resolvedOptions().timeZone),
    () => null,
  );

  const selected = zones.find((z) => z.id === value);
  const deviceZone = device && device !== value ? zones.find((z) => z.id === device) : undefined;
  const results = useMemo(() => searchZones(zones, query), [zones, query]);

  // Keep the highlighted row in view while moving with the keyboard.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (z: ZoneOption) => {
    setValue(z.id);
    setOpen(false);
  };

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setQuery("");
            setActive(
              Math.max(
                0,
                zones.findIndex((z) => z.id === value),
              ),
            );
          }
        }}
      >
        <Popover.Trigger asChild>
          <button
            id={id}
            type="button"
            aria-describedby={describedBy}
            aria-haspopup="listbox"
            className={cn(
              "flex h-9 w-full items-center gap-2 rounded-sm border border-control bg-surface px-3 text-left text-body text-fg pointer-coarse:h-11",
              "hover:border-fg-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
              invalid && "border-danger",
            )}
          >
            <span className="min-w-0 flex-1 truncate">
              {selected ? (
                <>
                  {selected.city}
                  <span className="text-fg-3"> · {selected.longName}</span>
                </>
              ) : (
                value
              )}
            </span>
            {selected && <span className="shrink-0 font-mono text-meta text-fg-3 tabular">{selected.offset}</span>}
            <ChevronsUpDown className="size-4 shrink-0 text-fg-3" aria-hidden />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            collisionPadding={12}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement).querySelector("input")?.focus();
            }}
            className="qm-popover qm-glass-panel z-50 flex max-h-[min(420px,var(--radix-popover-content-available-height))] w-[min(var(--radix-popover-trigger-width),calc(100vw-24px))] min-w-[300px] flex-col overflow-hidden rounded-md"
          >
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search className="size-4 shrink-0 text-fg-3" aria-hidden />
              <input
                role="combobox"
                aria-expanded
                aria-controls={listId}
                aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
                aria-label="Search time zones"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((i) => Math.min(results.length - 1, i + 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((i) => Math.max(0, i - 1));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    if (results[active]) choose(results[active]);
                  }
                }}
                placeholder="City, country, abbreviation or +5:30"
                className="h-11 min-w-0 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-fg-3"
              />
            </div>
            {deviceZone && !query && (
              <button
                type="button"
                onClick={() => choose(deviceZone)}
                className="flex items-center gap-2 border-b border-line px-3 py-2 text-left text-label text-accent hover:bg-hover"
              >
                <LocateFixed className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  Use this device’s zone: {deviceZone.city} ({deviceZone.offset})
                </span>
              </button>
            )}
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label="Time zones"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1"
            >
              {results.length === 0 && <li className="px-3 py-6 text-center text-body text-fg-3">No time zone matches “{query}”.</li>}
              {results.map((z, i) => (
                <li
                  key={z.id}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={z.id === value}
                  onPointerMove={() => setActive(i)}
                  onClick={() => choose(z)}
                  className={cn(
                    "flex cursor-default items-center gap-2.5 rounded-sm px-2.5 py-2 text-body",
                    i === active ? "bg-hover" : undefined,
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-fg">
                      {z.city}
                      {z.region && <span className="text-fg-3"> · {z.region}</span>}
                    </span>
                    <span className="truncate text-meta text-fg-3">{z.longName}</span>
                  </span>
                  <span className="shrink-0 font-mono text-meta text-fg-3 tabular">{z.offset}</span>
                  <Check className={cn("size-4 shrink-0 text-accent", z.id === value ? "opacity-100" : "opacity-0")} aria-hidden />
                </li>
              ))}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
