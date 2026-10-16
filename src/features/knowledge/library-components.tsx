"use client";

import { RelativeTime } from "@/components/ui/relative-time";
import { Archive, ExternalLink, FileText, Image as ImageIcon, Link2, Pencil, Plus, Wrench, type LucideIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ConfirmDialog, Modal } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { archiveLibraryItem, saveLibraryItem } from "./actions";

export type LibraryItem = {
  id: string;
  title: string;
  kind: "doc" | "link" | "image" | "tool";
  url: string;
  description: string | null;
  tags: string[];
  ownerName: string;
  updatedAt: string;
};

export const KIND: Record<LibraryItem["kind"], { label: string; Icon: LucideIcon }> = {
  doc: { label: "Doc", Icon: FileText },
  link: { label: "Link", Icon: Link2 },
  image: { label: "Image", Icon: ImageIcon },
  tool: { label: "Tool", Icon: Wrench },
};

export function LibraryItemButton({ teamSlug, item }: { teamSlug: string; item?: LibraryItem }) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  return (
    <>
      {item ? (
        <IconButton label={`Edit ${item.title}`} size="sm" onClick={() => setOpen(true)}>
          <Pencil className="size-3.5" aria-hidden />
        </IconButton>
      ) : (
        <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setOpen(true)}>
          Add reference
        </Button>
      )}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={item ? "Edit reference" : "Add a reference"}
        description="Links only. QMatus never fetches or previews the address."
      >
        <form
          className="flex flex-col gap-4"
          noValidate
          action={(f) =>
            startTransition(async () => {
              setErrors({});
              const res = await saveLibraryItem(teamSlug, item?.id ?? null, {
                title: String(f.get("title") ?? ""),
                kind: String(f.get("kind") ?? "link") as never,
                url: String(f.get("url") ?? ""),
                description: String(f.get("description") ?? ""),
                tags: String(f.get("tags") ?? ""),
              });
              if (!res.ok) {
                setErrors(res.error.fieldErrors ?? {});
                if (!res.error.fieldErrors) toast(res.error.message, "error");
                return;
              }
              setOpen(false);
              toast(item ? "Reference saved." : "Reference added.");
            })
          }
        >
          <Field label="Title" error={errors.title}>
            {(p) => <Input {...p} name="title" defaultValue={item?.title} maxLength={160} autoFocus />}
          </Field>
          <Field label="Link" error={errors.url}>
            {(p) => <Input {...p} name="url" type="url" defaultValue={item?.url} placeholder="https://" maxLength={2000} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              {(p) => (
                <Select {...p} name="kind" defaultValue={item?.kind ?? "link"}>
                  {Object.entries(KIND).map(([v, k]) => (
                    <option key={v} value={v}>
                      {k.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Tags" optional hint="Comma separated">
              {(p) => <Input {...p} name="tags" defaultValue={item?.tags.join(", ")} maxLength={200} />}
            </Field>
          </div>
          <Field label="Description" optional>
            {(p) => <Textarea {...p} name="description" defaultValue={item?.description ?? ""} rows={2} maxLength={1000} />}
          </Field>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" pending={pending} pendingLabel="Saving…">
              {item ? "Save" : "Add reference"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function LibraryList({
  items,
  teamSlug,
  canWrite,
  timezone,
}: {
  items: LibraryItem[];
  teamSlug: string;
  canWrite: boolean;
  timezone: string;
}) {
  const [archiving, setArchiving] = useState<LibraryItem | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface shadow-panel">
        {items.map((item) => {
          const { label, Icon } = KIND[item.kind];
          let host = "";
          try {
            host = new URL(item.url).host;
          } catch {
            host = item.url;
          }
          return (
            <li key={item.id} id={`item-${item.id}`} className="flex items-start gap-3 px-4 py-3 target:bg-selected">
              <Icon className="mt-0.5 size-4 shrink-0 text-fg-3" aria-label={label} />
              <div className="min-w-0 flex-1">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex max-w-full items-center gap-1 text-body font-medium text-fg hover:text-accent"
                >
                  <span className="truncate">{item.title}</span>
                  <ExternalLink className="size-3.5 shrink-0 text-fg-3" aria-label="(opens in a new tab)" />
                </a>
                {item.description && <p className="mt-0.5 text-label text-fg-2">{item.description}</p>}
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-meta text-fg-3">
                  <span className="max-w-full truncate font-mono">{host}</span>
                  <span>
                    {item.ownerName} · <RelativeTime iso={item.updatedAt} timeZone={timezone} />
                  </span>
                  {item.tags.map((t) => (
                    <span key={t} className="rounded-xs border border-line px-1.5">
                      {t}
                    </span>
                  ))}
                </p>
              </div>
              {canWrite && (
                <div className="flex shrink-0 gap-1">
                  <LibraryItemButton teamSlug={teamSlug} item={item} />
                  <IconButton label={`Archive ${item.title}`} size="sm" onClick={() => setArchiving(item)}>
                    <Archive className="size-3.5" aria-hidden />
                  </IconButton>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={!!archiving}
        onOpenChange={(o) => !o && setArchiving(null)}
        title={`Archive “${archiving?.title ?? ""}”?`}
        consequence="It will be hidden from the Library and search. The link itself isn't affected."
        confirmLabel="Archive"
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const res = await archiveLibraryItem(archiving!.id);
            toast(res.ok ? "Reference archived." : res.error.message, res.ok ? "success" : "error");
            setArchiving(null);
          })
        }
      />
    </>
  );
}
