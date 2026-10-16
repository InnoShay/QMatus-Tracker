import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Button } from "@/components/ui/button";
import { PageHeader, Section } from "@/components/ui/layout";
import { ThemeControl } from "@/components/shell/theme-control";
import { signOut } from "@/features/auth/actions";
import { ProfileForm } from "@/features/settings/profile-form";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { requireViewer } from "@/server/auth/viewer";
import { describeAccess } from "@/server/policies";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value ?? viewer.theme);
  const zones = Intl.supportedValuesOf("timeZone");
  if (!zones.includes(viewer.timezone)) zones.unshift(viewer.timezone);

  return (
    <div className="flex max-w-3xl flex-col gap-10 px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader title="Settings" description={`${viewer.name} · ${viewer.email}`} />
      <Section title="Profile">
        <ProfileForm name={viewer.name} title={viewer.title} timezone={viewer.timezone} zones={zones} />
      </Section>
      <Section
        title="Appearance"
        description="System follows your device's light or dark setting. Changes apply immediately and are saved to your profile."
      >
        <ThemeControl initial={theme} />
      </Section>
      <Section title="Your access" description="What you can reach, and why. Ask a workspace admin to change it.">
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface shadow-panel">
          <li className="flex items-center justify-between px-4 py-2.5">
            <span className="text-body text-fg">Workspace</span>
            <span className="text-label text-fg-2">
              {viewer.org.role === "member" ? "Member" : viewer.org.role === "owner" ? "Owner" : "Admin"}
            </span>
          </li>
          {[...viewer.teams, ...viewer.summaryTeams].map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <span className="text-body text-fg">{t.name}</span>
              <span className="text-right text-label text-fg-2">
                {describeAccess(t.access)}
                {t.grantExpiresAt ? ` · ends ${t.grantExpiresAt.slice(0, 10)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Session">
        <form action={signOut}>
          <Button type="submit">Sign out</Button>
        </form>
      </Section>
    </div>
  );
}
