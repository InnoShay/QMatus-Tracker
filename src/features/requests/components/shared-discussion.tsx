"use client";

import { RelativeTime } from "@/components/ui/relative-time";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { RichText } from "@/components/ui/rich-text";
import { toast } from "@/components/ui/toast";
import { formatTimestamp } from "@/lib/dates";
import { postMessage } from "../actions";
import type { RequestShared } from "@/server/dal/requests";

export function SharedDiscussion({
  requestId,
  messages,
  canPost,
  timezone,
  emptyCopy,
}: {
  requestId: string;
  messages: RequestShared["messages"];
  canPost: boolean;
  timezone: string;
  emptyCopy: string;
}) {
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      {messages.length === 0 && <p className="text-body text-fg-3">{emptyCopy}</p>}
      <ul className="flex flex-col gap-4">
        {messages.map((m) => (
          <li key={m.id} className="flex gap-2.5">
            <Avatar name={m.authorName} />
            <div className="min-w-0 flex-1">
              <p className="text-label">
                <span className="font-medium text-fg">{m.authorName}</span>{" "}
                <time dateTime={m.createdAt} title={formatTimestamp(m.createdAt, timezone)} className="text-fg-3">
                  <RelativeTime iso={m.createdAt} timeZone={timezone} />
                </time>
              </p>
              <RichText text={m.body} className="mt-0.5" />
            </div>
          </li>
        ))}
      </ul>
      {canPost && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const body = draft.trim();
            if (!body) return;
            startTransition(async () => {
              const res = await postMessage(requestId, body);
              if (res.ok) setDraft("");
              else toast(res.error.message, "error");
            });
          }}
        >
          <label htmlFor="shared-message" className="sr-only">
            Message visible to everyone on this request
          </label>
          <Textarea
            id="shared-message"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={5000}
            placeholder="Write a message everyone on this request can see…"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" variant="primary" disabled={!draft.trim()} pending={pending} pendingLabel="Sending…">
              Send
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
