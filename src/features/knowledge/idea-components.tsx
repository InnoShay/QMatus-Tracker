"use client";

import { RelativeTime } from "@/components/ui/relative-time";
import { Archive, ArrowUpRight, Ellipsis, Pin, PinOff, Send, SquareKanban, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badges";
import { Button, IconButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Input, Textarea } from "@/components/ui/field";
import { AudienceSeam } from "@/components/ui/layout";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Modal } from "@/components/ui/overlays";
import { RichText } from "@/components/ui/rich-text";
import { toast } from "@/components/ui/toast";
import { RequestForm } from "@/features/requests/components/request-form";
import { captureIdea, markIdeaPromotedToRequest, promoteIdeaToTask, updateIdea } from "./actions";

export type Idea = {
  id: string;
  title: string;
  body: string | null;
  tags: string[];
  state: "captured" | "reviewing" | "promoted" | "archived";
  pinned: boolean;
  creatorName: string;
  updatedAt: string;
  promotedTaskKey: string | null;
  promotedRequestId: string | null;
};

/** Low-friction capture: title first, details optional. */
export function IdeaCapture({ teamSlug }: { teamSlug: string }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [more, setMore] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-col gap-2 rounded-xl border border-line bg-surface shadow-panel p-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await captureIdea(teamSlug, { title, body, tags });
          if (res.ok) {
            setTitle("");
            setBody("");
            setTags("");
            setMore(false);
            toast("Idea captured.");
          } else toast(res.error.message, "error");
        });
      }}
    >
      <label htmlFor="idea-title" className="sr-only">
        Idea
      </label>
      <div className="flex gap-2">
        <Input
          id="idea-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Capture an idea before it disappears…"
          maxLength={160}
        />
        <Button type="submit" variant="primary" disabled={!title.trim()} pending={pending} pendingLabel="Saving…">
          Capture
        </Button>
      </div>
      {more ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
          <label className="sr-only" htmlFor="idea-body">
            Details
          </label>
          <Textarea
            id="idea-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="Context, links, why it matters"
            maxLength={5000}
          />
          <label className="sr-only" htmlFor="idea-tags">
            Tags, comma separated
          </label>
          <Input
            id="idea-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags, comma separated"
            maxLength={200}
          />
        </div>
      ) : (
        <button type="button" onClick={() => setMore(true)} className="self-start text-label text-fg-3 hover:text-fg">
          Add details and tags
        </button>
      )}
    </form>
  );
}

export function IdeaList({
  ideas,
  teamSlug,
  teamName,
  canWrite,
  timezone,
  intakeTeams,
  sourceTeams,
  people,
  viewerId,
}: {
  ideas: Idea[];
  teamSlug: string;
  teamName: string;
  canWrite: boolean;
  timezone: string;
  intakeTeams: { id: string; name: string }[];
  sourceTeams: { id: string; name: string }[];
  people: { id: string; name: string; title: string | null }[];
  viewerId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [promoteToRequest, setPromoteToRequest] = useState<Idea | null>(null);

  const act = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, msg: string) =>
    startTransition(async () => {
      const res = await fn();
      toast(res.ok ? msg : (res.error?.message ?? "That didn't work."), res.ok ? "success" : "error");
    });

  return (
    <>
      <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface shadow-panel">
        {ideas.map((i) => (
          <li key={i.id} id={`idea-${i.id}`} className="flex gap-3 px-4 py-3 target:bg-selected">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {i.pinned && <Pin className="size-3.5 text-accent" aria-label="Pinned" />}
                <h3 className={cn("text-body font-medium [overflow-wrap:anywhere]", i.state === "archived" ? "text-fg-3" : "text-fg")}>
                  {i.title}
                </h3>
                {i.state === "reviewing" && <Badge tone="accent">Reviewing</Badge>}
                {i.state === "promoted" && <Badge tone="success">Promoted</Badge>}
                {i.state === "archived" && <Badge>Archived</Badge>}
              </div>
              {i.body && <RichText text={i.body} className="mt-1 text-fg-2" />}
              <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-meta text-fg-3">
                <span>
                  {i.creatorName} · <RelativeTime iso={i.updatedAt} timeZone={timezone} />
                </span>
                {i.tags.map((t) => (
                  <span key={t} className="rounded-xs border border-line px-1.5">
                    {t}
                  </span>
                ))}
                {i.promotedTaskKey && (
                  <Link
                    href={`/t/${teamSlug}/board?task=${i.promotedTaskKey}`}
                    className="inline-flex items-center gap-0.5 text-accent hover:text-accent-hover"
                  >
                    Became {i.promotedTaskKey} <ArrowUpRight className="size-3" aria-hidden />
                  </Link>
                )}
                {i.promotedRequestId && (
                  <Link
                    href={`/requests/${i.promotedRequestId}`}
                    className="inline-flex items-center gap-0.5 text-accent hover:text-accent-hover"
                  >
                    Became a work request <ArrowUpRight className="size-3" aria-hidden />
                  </Link>
                )}
              </p>
            </div>
            {canWrite && i.state !== "promoted" && (
              <Menu>
                <MenuTrigger asChild>
                  <IconButton label={`Actions for idea: ${i.title}`} size="sm" disabled={pending}>
                    <Ellipsis className="size-4" aria-hidden />
                  </IconButton>
                </MenuTrigger>
                <MenuContent className="w-60">
                  <MenuItem onSelect={() => act(async () => promoteIdeaToTask(i.id), `Promoted to a task in ${teamName}.`)}>
                    <SquareKanban className="size-4 text-fg-3" aria-hidden /> Promote to task in {teamName}
                  </MenuItem>
                  {intakeTeams.length > 0 && (
                    <MenuItem onSelect={() => setPromoteToRequest(i)}>
                      <Send className="size-4 text-fg-3" aria-hidden /> Send as a work request…
                    </MenuItem>
                  )}
                  <MenuSeparator />
                  <MenuItem onSelect={() => act(() => updateIdea(i.id, { pinned: !i.pinned }), i.pinned ? "Unpinned." : "Pinned.")}>
                    {i.pinned ? <PinOff className="size-4 text-fg-3" aria-hidden /> : <Pin className="size-4 text-fg-3" aria-hidden />}
                    {i.pinned ? "Unpin" : "Pin for the team"}
                  </MenuItem>
                  {i.state === "captured" && (
                    <MenuItem onSelect={() => act(() => updateIdea(i.id, { state: "reviewing" }), "Marked as reviewing.")}>
                      Mark as reviewing
                    </MenuItem>
                  )}
                  {i.state !== "archived" ? (
                    <MenuItem onSelect={() => act(() => updateIdea(i.id, { state: "archived" }), "Idea archived.")}>
                      <Archive className="size-4 text-fg-3" aria-hidden /> Archive
                    </MenuItem>
                  ) : (
                    <MenuItem onSelect={() => act(() => updateIdea(i.id, { state: "captured" }), "Idea restored.")}>
                      <Undo2 className="size-4 text-fg-3" aria-hidden /> Restore
                    </MenuItem>
                  )}
                </MenuContent>
              </Menu>
            )}
          </li>
        ))}
      </ul>

      <Modal
        open={!!promoteToRequest}
        onOpenChange={(o) => !o && setPromoteToRequest(null)}
        title="Send idea as a work request"
        description="Only what you put in this form is shared with the receiving team. The idea itself stays in your Parking Lot."
        className="max-w-2xl"
      >
        {promoteToRequest && (
          <div className="flex flex-col gap-4">
            <AudienceSeam audience="The receiving team will see the request below" tone="shared" />
            <RequestForm
              intakeTeams={intakeTeams}
              sourceTeams={sourceTeams}
              people={people}
              viewerId={viewerId}
              defaults={{ title: promoteToRequest.title, problem: promoteToRequest.body ?? "" }}
              onSubmitted={(requestId) => {
                const idea = promoteToRequest;
                setPromoteToRequest(null);
                startTransition(async () => {
                  const res = await markIdeaPromotedToRequest(idea.id, requestId);
                  if (!res.ok) toast(res.error.message, "error");
                });
              }}
            />
          </div>
        )}
      </Modal>
    </>
  );
}
