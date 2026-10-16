import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/app-shell";
import { createClient } from "@/lib/supabase/server";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { requireViewer } from "@/server/auth/viewer";
import { isOrgAdmin } from "@/server/policies";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const [{ count }, { count: running }] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_id", viewer.id).is("read_at", null),
    // RLS returns only the viewer's own entries.
    supabase.from("time_entries").select("id", { count: "exact", head: true }).is("ended_at", null),
  ]);
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value ?? viewer.theme);

  const toShell = (t: (typeof viewer.teams)[number]) => ({
    slug: t.slug,
    name: t.name,
    access: t.access,
    acceptsRequests: t.acceptsRequests,
  });

  return (
    <AppShell
      user={{ name: viewer.name, email: viewer.email, title: viewer.title }}
      theme={theme}
      teams={viewer.teams.map(toShell)}
      summaryTeams={viewer.summaryTeams.map(toShell)}
      isAdmin={isOrgAdmin(viewer)}
      isLead={viewer.teams.some((t) => t.access === "lead")}
      unread={count ?? 0}
      timerRunning={(running ?? 0) > 0}
    >
      {children}
    </AppShell>
  );
}
