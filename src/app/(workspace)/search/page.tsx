import type { Metadata } from "next";
import Link from "next/link";
import { IssueKey } from "@/components/ui/badges";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { toHit, type SearchHit } from "@/features/search/hits";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/server/auth/viewer";

export const metadata: Metadata = { title: "Search" };

const GROUPS: { kind: SearchHit["kind"]; label: string }[] = [
  { kind: "task", label: "Tasks" },
  { kind: "project", label: "Projects" },
  { kind: "request", label: "Requests" },
  { kind: "idea", label: "Parking Lot" },
  { kind: "library", label: "Library" },
];

/** Same scoped RPC as the command menu: results are filtered by RLS before they exist. */
export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  await requireViewer();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  let hits: SearchHit[] = [];
  if (q.length >= 2) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("search_workspace", { p_query: q, p_limit: 25 });
    hits = (data ?? []).map(toHit);
  }
  return (
    <div className="flex max-w-3xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader title="Search" description="Searches only what you have access to." />
      <form role="search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          autoFocus
          minLength={2}
          maxLength={100}
          placeholder="Task key, title, project, request…"
          className="h-10 flex-1 rounded-sm border border-control bg-surface px-3 text-body text-fg placeholder:text-fg-3 focus-visible:outline-2 focus-visible:outline-focus"
        />
        <button type="submit" className="h-10 rounded-sm bg-action px-4 text-body font-medium text-action-fg hover:bg-action-hover">
          Search
        </button>
      </form>
      {q.length >= 2 && hits.length === 0 && (
        <EmptyState title={`No results for “${q}”`} body="Try a task key like DEV-12, a shorter word, or check the spelling." />
      )}
      {GROUPS.map(({ kind, label }) => {
        const rows = hits.filter((h) => h.kind === kind);
        if (!rows.length) return null;
        return (
          <section key={kind} aria-label={label} className="flex flex-col gap-2">
            <h2 className="text-section font-semibold text-fg">{label}</h2>
            <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface shadow-panel">
              {rows.map((h) => (
                <li key={h.id}>
                  <Link href={h.href} className="flex min-h-10 items-center gap-2.5 px-4 py-2 hover:bg-hover">
                    {h.ref && <IssueKey>{h.ref}</IssueKey>}
                    <span className="min-w-0 flex-1 truncate text-body text-fg">{h.title}</span>
                    {h.context && <span className="text-meta text-fg-3">{h.context}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
