import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { InboxList } from "@/features/notifications/inbox-list";
import { requireViewer } from "@/server/auth/viewer";
import { describeNotification, loadInbox } from "@/server/dal/notifications";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage() {
  const viewer = await requireViewer();
  const items = await loadInbox(viewer.id, viewer.teams);
  return (
    <div className="flex max-w-3xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader title="Inbox" description="Assignments, request activity and access decisions that involve you." />
      {items.length === 0 ? (
        <EmptyState
          title="Nothing in your inbox"
          body="You'll hear about assignments, comments on your tasks, and updates on requests you follow."
        />
      ) : (
        <InboxList
          items={items}
          descriptions={Object.fromEntries(items.map((i) => [i.id, describeNotification(i.kind)]))}
          timezone={viewer.timezone}
        />
      )}
    </div>
  );
}
