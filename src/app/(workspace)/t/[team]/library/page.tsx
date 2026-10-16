import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, NotAvailable, PageHeader } from "@/components/ui/layout";
import { KIND, LibraryItemButton, LibraryList, type LibraryItem } from "@/features/knowledge/library-components";
import { createClient } from "@/lib/supabase/server";
import { loadTeamPage } from "@/server/dal/team-page";
import { canWriteTeam } from "@/server/policies";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage({ params, searchParams }: PageProps<"/t/[team]/library">) {
  const { team: slug } = await params;
  const sp = await searchParams;
  const ctx = await loadTeamPage(slug);
  if (!ctx) return <NotAvailable />;
  const { viewer, team } = ctx;
  const kind = typeof sp.kind === "string" && sp.kind in KIND ? (sp.kind as LibraryItem["kind"]) : null;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";

  const supabase = await createClient();
  let query = supabase
    .from("library_items")
    .select("id, title, kind, url, description, tags, updated_at, profiles(display_name)")
    .eq("team_id", team.id)
    .is("archived_at", null);
  if (kind) query = query.eq("kind", kind);
  if (q) {
    // Reserved PostgREST filter characters are dropped rather than escaped.
    const safe = q.replace(/[,()"\\%_*]/g, " ").trim();
    const pattern = `%${safe}%`;
    query = query.or(`title.ilike.${pattern},description.ilike.${pattern}`);
  }
  const { data } = await query.order("updated_at", { ascending: false }).limit(300);
  const items: LibraryItem[] = (data ?? []).map((i) => ({
    id: i.id,
    title: i.title,
    kind: i.kind,
    url: i.url,
    description: i.description,
    tags: i.tags,
    updatedAt: i.updated_at,
    ownerName: i.profiles?.display_name ?? "Former member",
  }));
  const canWrite = canWriteTeam(team);

  return (
    <div className="flex flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader
        context={team.name}
        title="Library"
        description="The team's most useful references: docs, tools and links."
        actions={canWrite && <LibraryItemButton teamSlug={team.slug} />}
      />
      <form className="flex flex-wrap items-center gap-2" role="search" aria-label="Filter references">
        <nav aria-label="Type" className="inline-flex flex-wrap rounded-sm border border-line-strong bg-subtle p-0.5">
          {[{ v: "", l: "All" }, ...Object.entries(KIND).map(([v, k]) => ({ v, l: k.label }))].map((k) => (
            <Link
              key={k.v}
              href={k.v ? `?kind=${k.v}` : "?"}
              aria-current={(kind ?? "") === k.v ? "page" : undefined}
              className={
                (kind ?? "") === k.v
                  ? "rounded-xs bg-surface px-2.5 py-1 text-label font-medium text-fg"
                  : "rounded-xs px-2.5 py-1 text-label text-fg-2 hover:text-fg"
              }
            >
              {k.l}
            </Link>
          ))}
        </nav>
        {kind && <input type="hidden" name="kind" value={kind} />}
        <label className="sr-only" htmlFor="library-search">
          Search references
        </label>
        <input
          id="library-search"
          name="q"
          defaultValue={q}
          placeholder="Search references"
          className="h-8 w-56 rounded-sm border border-line-strong bg-surface px-2.5 text-label text-fg placeholder:text-fg-3 focus-visible:outline-2 focus-visible:outline-focus"
        />
      </form>
      {items.length === 0 ? (
        <EmptyState
          title={q || kind ? "No references match" : "The Library is empty"}
          body={
            q || kind
              ? "Try another search or type."
              : "Start with the things people ask for most: a setup guide, the repository, the deployment runbook, or a tool everyone uses."
          }
        />
      ) : (
        <LibraryList items={items} teamSlug={team.slug} canWrite={canWrite} timezone={viewer.timezone} />
      )}
    </div>
  );
}
