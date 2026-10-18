import { cookies } from "next/headers";
import { BootHello } from "@/components/fx/boot-hello";
import { AppShell } from "@/components/shell/app-shell";
import { createClient } from "@/lib/supabase/server";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { requireViewer } from "@/server/auth/viewer";
import { isOrgAdmin } from "@/server/policies";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  // Counts are RLS-scoped to the caller (recipient/owner = auth.uid()), so they
  // can run alongside the viewer lookup; nothing renders unless it succeeds.
  const [viewer, { count }, { count: running }] = await Promise.all([
    requireViewer(),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
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
    <>
      <BootHello />
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
    </>
  );
}
