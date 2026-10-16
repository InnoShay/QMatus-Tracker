import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, NotAvailable, PageHeader } from "@/components/ui/layout";
import { IdeaCapture, IdeaList, type Idea } from "@/features/knowledge/idea-components";
import { createClient } from "@/lib/supabase/server";
import { listIntakeTeams, listWorkspaceMembers } from "@/server/dal/requests";
import { loadTeamPage } from "@/server/dal/team-page";
import { canWriteTeam, isTeamMember } from "@/server/policies";

export const metadata: Metadata = { title: "Parking Lot" };

const STATES = [
  { value: "", label: "Active" },
  { value: "promoted", label: "Promoted" },
  { value: "archived", label: "Archived" },
] as const;

export default async function IdeasPage({ params, searchParams }: PageProps<"/t/[team]/ideas">) {
  const { team: slug } = await params;
  const sp = await searchParams;
  const ctx = await loadTeamPage(slug);
  if (!ctx) return <NotAvailable />;
  const { viewer, team } = ctx;
  const state = sp.state === "promoted" || sp.state === "archived" ? sp.state : "";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const tag = typeof sp.tag === "string" ? sp.tag.slice(0, 40) : "";

  const supabase = await createClient();
  let query = supabase
    .from("parking_ideas")
    .select("id, title, body, tags, state, pinned, updated_at, promoted_request_id, profiles(display_name), tasks(issue_key)")
    .eq("team_id", team.id);
  query = state ? query.eq("state", state) : query.in("state", ["captured", "reviewing"]);
  if (q) query = query.ilike("title", `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
  if (tag) query = query.contains("tags", [tag]);
  const [{ data }, intake, people] = await Promise.all([
    query.order("pinned", { ascending: false }).order("updated_at", { ascending: false }).limit(200),
    listIntakeTeams(),
    listWorkspaceMembers(viewer.org.id),
  ]);
  const ideas: Idea[] = (data ?? []).map((i) => ({
    id: i.id,
    title: i.title,
    body: i.body,
    tags: i.tags,
    state: i.state,
    pinned: i.pinned,
    updatedAt: i.updated_at,
    creatorName: i.profiles?.display_name ?? "Former member",
    promotedTaskKey: i.tasks?.issue_key ?? null,
    promotedRequestId: i.promoted_request_id,
  }));
  const canWrite = canWriteTeam(team);
  const memberTeams = viewer.teams.filter(isTeamMember);
  const targets = intake.filter((t) => t.id !== team.id && !memberTeams.some((m) => m.id === t.id));

  return (
    <div className="flex flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader
        context={team.name}
        title="Parking Lot"
        description="Ideas worth keeping, before they become commitments. Promote one when the team decides to act on it."
      />
      {canWrite && <IdeaCapture teamSlug={team.slug} />}
      <form className="flex flex-wrap items-center gap-2" role="search" aria-label="Filter ideas">
        <nav aria-label="Idea state" className="inline-flex rounded-sm border border-line-strong bg-subtle p-0.5">
          {STATES.map((s) => (
            <Link
              key={s.value}
              href={s.value ? `?state=${s.value}` : "?"}
              aria-current={state === s.value ? "page" : undefined}
              className={
                state === s.value
                  ? "rounded-xs bg-surface px-2.5 py-1 text-label font-medium text-fg"
                  : "rounded-xs px-2.5 py-1 text-label text-fg-2 hover:text-fg"
              }
            >
              {s.label}
            </Link>
          ))}
        </nav>
        {state && <input type="hidden" name="state" value={state} />}
        <label className="sr-only" htmlFor="idea-search">
          Search ideas
        </label>
        <input
          id="idea-search"
          name="q"
          defaultValue={q}
          placeholder="Search ideas"
          className="h-8 w-56 rounded-sm border border-line-strong bg-surface px-2.5 text-label text-fg placeholder:text-fg-3 focus-visible:outline-2 focus-visible:outline-focus"
        />
        {tag && (
          <Link href={state ? `?state=${state}` : "?"} className="text-label text-accent">
            Tag: {tag} · clear
          </Link>
        )}
      </form>
      {ideas.length === 0 ? (
        <EmptyState
          title={q || tag ? "No ideas match" : state ? `No ${state} ideas` : "The Parking Lot is empty"}
          body={q || tag ? "Try a different search." : "Capture ideas here so they aren't lost in chat. Nothing here is a commitment."}
        />
      ) : (
        <IdeaList
          ideas={ideas}
          teamSlug={team.slug}
          teamName={team.name}
          canWrite={canWrite}
          timezone={viewer.timezone}
          intakeTeams={targets.map((t) => ({ id: t.id, name: t.name }))}
          sourceTeams={memberTeams.map((t) => ({ id: t.id, name: t.name }))}
          people={people}
          viewerId={viewer.id}
        />
      )}
    </div>
  );
}
