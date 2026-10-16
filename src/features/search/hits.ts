export type SearchHit = {
  kind: "task" | "project" | "request" | "idea" | "library";
  id: string;
  title: string;
  ref: string | null;
  href: string;
  context: string | null;
};

export function toHit(row: {
  kind: string;
  id: string;
  title: string;
  ref: string | null;
  team_slug: string | null;
  team_name: string | null;
}): SearchHit {
  const kind = row.kind as SearchHit["kind"];
  const team = row.team_slug;
  const href =
    kind === "task"
      ? `/t/${team}/board?task=${encodeURIComponent(row.ref ?? "")}`
      : kind === "project"
        ? `/t/${team}/projects/${row.id}`
        : kind === "request"
          ? `/requests/${row.id}`
          : kind === "idea"
            ? `/t/${team}/ideas#idea-${row.id}`
            : `/t/${team}/library#item-${row.id}`;
  return { kind, id: row.id, title: row.title, ref: row.ref, href, context: row.team_name };
}
