import type { Metadata } from "next";
import { Badge } from "@/components/ui/badges";
import { NotAvailable, PageHeader, Section } from "@/components/ui/layout";
import { InviteButton, MemberActions, RevokeInvitationButton, RoleBadge } from "@/features/admin/member-components";
import { formatTimestamp } from "@/lib/dates";
import { requireViewer } from "@/server/auth/viewer";
import { listMembers } from "@/server/dal/admin";
import { isOrgAdmin, isOrgOwner } from "@/server/policies";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage() {
  const viewer = await requireViewer();
  if (!isOrgAdmin(viewer)) return <NotAvailable />;
  const { members, teams, invitations } = await listMembers(viewer.org.id);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const now = new Date().toISOString();

  return (
    <div className="flex flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader
        title="Members"
        description="People in the QMatus workspace and the teams they belong to. Managing people doesn't give you access to a team's work. That needs membership or an approved grant."
        actions={<InviteButton teams={teams} canInviteAdmin={isOrgOwner(viewer)} />}
      />
      <Section title={`People · ${members.length}`}>
        <div className="relative overflow-x-auto rounded-xl border border-line bg-surface shadow-panel">
          <table className="w-full min-w-[720px] text-body">
            <caption className="sr-only">Workspace members</caption>
            <thead>
              <tr className="border-b border-line text-left text-label text-fg-3">
                <th scope="col" className="h-10 px-4 font-normal">
                  Person
                </th>
                <th scope="col" className="px-4 font-normal">
                  Workspace role
                </th>
                <th scope="col" className="px-4 font-normal">
                  Teams
                </th>
                <th scope="col" className="px-4 font-normal">
                  Status
                </th>
                <th scope="col" className="w-12 px-4 font-normal">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-fg">{m.name}</p>
                    <p className="text-meta text-fg-3">
                      {m.email}
                      {m.title ? ` · ${m.title}` : ""}
                      {m.level ? ` · ${m.level}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-2.5">
                    <RoleBadge role={m.role} />
                  </td>
                  <td className="px-4 py-2.5">
                    {m.teams.length === 0 ? (
                      <span className="text-label text-fg-3">No team</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {m.teams.map((t) => (
                          <Badge key={t.teamId}>{`${teamName.get(t.teamId) ?? "Team"}${t.role === "lead" ? " · Lead" : ""}`}</Badge>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {m.state === "active" ? <span className="text-label text-fg-2">Active</span> : <Badge tone="danger">Suspended</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <MemberActions member={m} teams={teams} viewerId={viewer.id} viewerIsOwner={isOrgOwner(viewer)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-meta text-fg-3">L0–L5 levels are descriptive only and never change what someone can access.</p>
      </Section>
      <Section title={`Pending invitations · ${invitations.length}`}>
        {invitations.length === 0 ? (
          <p className="text-body text-fg-3">No pending invitations.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface shadow-panel">
            {invitations.map((i) => {
              const expired = i.expires_at <= now;
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                  <span className="min-w-0 flex-1 font-medium text-fg">{i.email}</span>
                  <span className="text-label text-fg-2">
                    {i.org_role === "admin" ? "Admin" : "Member"}
                    {i.team_id ? ` · ${teamName.get(i.team_id) ?? "Team"} ${i.team_role === "lead" ? "lead" : "member"}` : ""}
                  </span>
                  {expired ? (
                    <Badge tone="warning">Expired</Badge>
                  ) : (
                    <span className="text-meta text-fg-3">Expires {formatTimestamp(i.expires_at, viewer.timezone)}</span>
                  )}
                  <RevokeInvitationButton id={i.id} email={i.email} />
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
