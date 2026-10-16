"use client";

import { Copy, Ellipsis, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badges";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { ConfirmDialog, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Modal } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import type { AdminMember } from "@/server/dal/admin";
import { addTeamMember, createInvitation, removeTeamMember, revokeInvitation, setMemberState, setTeamRole } from "./actions";

type Team = { id: string; name: string };

export function InviteButton({ teams, canInviteAdmin }: { teams: Team[]; canInviteAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [teamId, setTeamId] = useState("");
  return (
    <>
      <Button
        variant="primary"
        icon={<UserPlus className="size-4" aria-hidden />}
        onClick={() => {
          setLink(null);
          setOpen(true);
        }}
      >
        Invite person
      </Button>
      <Modal open={open} onOpenChange={setOpen} title={link ? "Invitation created" : "Invite someone"}>
        {link ? (
          <div className="flex flex-col gap-3">
            <p className="text-body text-fg-2">
              Send this link to the person directly. It works once, only for their email address, and expires. It won&apos;t be shown again.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={link}
                aria-label="Invitation link"
                className="font-mono text-label"
                onFocus={(e) => e.target.select()}
              />
              <Button
                icon={<Copy className="size-4" aria-hidden />}
                onClick={() =>
                  navigator.clipboard?.writeText(link).then(
                    () => toast("Link copied."),
                    () => toast("Couldn't copy. Select the text and copy it.", "error"),
                  )
                }
              >
                Copy
              </Button>
            </div>
            <p className="text-meta text-fg-3">
              Email delivery isn&apos;t configured in this environment, so QMatus doesn&apos;t send the email itself.
            </p>
            <Button className="self-end" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            noValidate
            action={(f) =>
              startTransition(async () => {
                setErrors({});
                const res = await createInvitation({
                  email: String(f.get("email") ?? ""),
                  orgRole: String(f.get("orgRole") ?? "member") as never,
                  teamId: String(f.get("teamId") ?? ""),
                  teamRole: String(f.get("teamRole") ?? "member") as never,
                  validDays: String(f.get("validDays") ?? "7"),
                });
                if (!res.ok) {
                  setErrors(res.error.fieldErrors ?? { email: res.error.message });
                  return;
                }
                setLink(res.data.link);
              })
            }
          >
            <Field label="Email" error={errors.email}>
              {(p) => <Input {...p} name="email" type="email" autoComplete="off" autoFocus />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Workspace role" hint="Admins manage people and access, not team content.">
                {(p) => (
                  <Select {...p} name="orgRole" defaultValue="member">
                    <option value="member">Member</option>
                    {canInviteAdmin && <option value="admin">Admin</option>}
                  </Select>
                )}
              </Field>
              <Field label="Expires after">
                {(p) => (
                  <Select {...p} name="validDays" defaultValue="7">
                    <option value="1">1 day</option>
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                    <option value="30">30 days</option>
                  </Select>
                )}
              </Field>
              <Field label="Add to team" optional>
                {(p) => (
                  <Select {...p} name="teamId" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                    <option value="">No team yet</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              {teamId && (
                <Field label="Team role">
                  {(p) => (
                    <Select {...p} name="teamRole" defaultValue="member">
                      <option value="member">Member</option>
                      <option value="lead">Lead</option>
                    </Select>
                  )}
                </Field>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" pending={pending} pendingLabel="Creating…">
                Create invitation
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

export function MemberActions({
  member,
  teams,
  viewerId,
  viewerIsOwner,
}: {
  member: AdminMember;
  teams: Team[];
  viewerId: string;
  viewerIsOwner: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<null | { kind: "remove"; team: Team } | { kind: "suspend" | "reactivate" }>(null);
  const [adding, setAdding] = useState(false);
  const self = member.id === viewerId;
  const canChangeState = !self && member.role !== "owner" && (member.role !== "admin" || viewerIsOwner);
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, msg: string) =>
    startTransition(async () => {
      const res = await fn();
      toast(res.ok ? msg : (res.error?.message ?? "That didn't work."), res.ok ? "success" : "error");
      setConfirm(null);
      setAdding(false);
    });
  const notOn = teams.filter((t) => !member.teams.some((m) => m.teamId === t.id));
  if (self) return <span className="text-meta text-fg-3">You</span>;

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <IconButton label={`Manage ${member.name}`} size="sm" disabled={pending}>
            <Ellipsis className="size-4" aria-hidden />
          </IconButton>
        </MenuTrigger>
        <MenuContent className="w-64">
          {notOn.length > 0 && member.state === "active" && <MenuItem onSelect={() => setAdding(true)}>Add to a team…</MenuItem>}
          {member.teams.map((tm) => {
            const team = teams.find((t) => t.id === tm.teamId);
            if (!team) return null;
            return (
              <div key={tm.teamId}>
                <MenuSeparator />
                <MenuLabel>{team.name}</MenuLabel>
                <MenuItem
                  onSelect={() =>
                    run(() => setTeamRole(team.id, member.id, tm.role === "lead" ? "member" : "lead"), `Role in ${team.name} updated.`)
                  }
                >
                  {tm.role === "lead" ? "Make member" : "Make team lead"}
                </MenuItem>
                <MenuItem danger onSelect={() => setConfirm({ kind: "remove", team })}>
                  Remove from {team.name}
                </MenuItem>
              </div>
            );
          })}
          {canChangeState && (
            <>
              <MenuSeparator />
              <MenuItem
                danger={member.state === "active"}
                onSelect={() => setConfirm({ kind: member.state === "active" ? "suspend" : "reactivate" })}
              >
                {member.state === "active" ? "Suspend account" : "Reactivate account"}
              </MenuItem>
            </>
          )}
        </MenuContent>
      </Menu>

      <Modal
        open={adding}
        onOpenChange={setAdding}
        title={`Add ${member.name} to a team`}
        description="They'll be able to read and change that team's work immediately."
      >
        <form
          className="flex flex-col gap-4"
          action={(f) =>
            run(() => addTeamMember(String(f.get("team")), member.id, String(f.get("role")) as never), `${member.name} added.`)
          }
        >
          <Field label="Team">
            {(p) => (
              <Select {...p} name="team">
                {notOn.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Role">
            {(p) => (
              <Select {...p} name="role" defaultValue="member">
                <option value="member">Member</option>
                <option value="lead">Lead</option>
              </Select>
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setAdding(false)}>Cancel</Button>
            <Button type="submit" variant="primary" pending={pending}>
              Add to team
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm?.kind === "remove"
            ? `Remove ${member.name} from ${confirm.team.name}?`
            : confirm?.kind === "suspend"
              ? `Suspend ${member.name}?`
              : `Reactivate ${member.name}?`
        }
        consequence={
          confirm?.kind === "remove"
            ? "They lose access to the team's work on their next request. Their history stays, and tasks assigned to them keep their name until someone reassigns them."
            : confirm?.kind === "suspend"
              ? "They're signed out everywhere and can't access anything until reactivated. Their history and assignments stay."
              : "They'll be able to sign in again with their existing memberships."
        }
        confirmLabel={confirm?.kind === "remove" ? "Remove" : confirm?.kind === "suspend" ? "Suspend" : "Reactivate"}
        danger={confirm?.kind !== "reactivate"}
        pending={pending}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.kind === "remove")
            run(() => removeTeamMember(confirm.team.id, member.id), `${member.name} removed from ${confirm.team.name}.`);
          else
            run(
              () => setMemberState(member.id, confirm.kind === "suspend" ? "suspended" : "active"),
              confirm.kind === "suspend" ? "Account suspended." : "Account reactivated.",
            );
        }}
      />
    </>
  );
}

export function RevokeInvitationButton({ id, email }: { id: string; email: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="quiet"
      pending={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await revokeInvitation(id);
          toast(res.ok ? `Invitation for ${email} revoked.` : res.error.message, res.ok ? "success" : "error");
        })
      }
    >
      Revoke
    </Button>
  );
}

export function RoleBadge({ role }: { role: "owner" | "admin" | "member" }) {
  return role === "member" ? (
    <span className="text-label text-fg-2">Member</span>
  ) : (
    <Badge tone="accent">{role === "owner" ? "Owner" : "Admin"}</Badge>
  );
}
