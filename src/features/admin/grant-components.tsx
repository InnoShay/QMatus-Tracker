"use client";

import { KeyRound } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { AudienceSeam } from "@/components/ui/layout";
import { ConfirmDialog, Modal } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { decideGrant, issueGrant, revokeGrant } from "./actions";
import { SCOPES, type Scope } from "./scopes";

type Person = { id: string; name: string };
type Team = { id: string; name: string };

/** Two-step issue: choose → confirm with the exact consequences in words. */
export function IssueGrantButton({ people, teams, minDate }: { people: Person[]; teams: Team[]; minDate: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [values, setValues] = useState({
    granteeId: "",
    teamId: teams[0]?.id ?? "",
    scope: "dashboard_summary" as Scope,
    reason: "",
    expiresAt: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const s = SCOPES[values.scope];
  const person = people.find((p) => p.id === values.granteeId);
  const team = teams.find((t) => t.id === values.teamId);

  const submit = () =>
    startTransition(async () => {
      const res = await issueGrant(values);
      if (!res.ok) {
        setErrors(res.error.fieldErrors ?? {});
        setStep("form");
        if (!res.error.fieldErrors) toast(res.error.message, "error");
        return;
      }
      toast(res.data.pending ? "Grant requested. It becomes active once the team lead approves it." : "Summary access granted.");
      setOpen(false);
      setStep("form");
    });

  return (
    <>
      <Button variant="primary" icon={<KeyRound className="size-4" aria-hidden />} onClick={() => setOpen(true)}>
        Grant access
      </Button>
      <Modal
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setStep("form");
        }}
        title={step === "form" ? "Grant access to a team" : "Confirm access grant"}
        className="max-w-xl"
      >
        {step === "form" ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const errs: Record<string, string> = {};
              if (!values.granteeId) errs.granteeId = "Choose a person.";
              if (values.reason.trim().length < 10) errs.reason = "Explain why in at least 10 characters.";
              setErrors(errs);
              if (!Object.keys(errs).length) setStep("confirm");
            }}
          >
            <p className="text-body text-fg-2">
              You can&apos;t grant access to yourself. Grants that show private work need a second person to approve them.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Person" error={errors.granteeId}>
                {(p) => (
                  <Select {...p} value={values.granteeId} onChange={(e) => setValues({ ...values, granteeId: e.target.value })}>
                    <option value="">Choose…</option>
                    {people.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Team">
                {(p) => (
                  <Select {...p} value={values.teamId} onChange={(e) => setValues({ ...values, teamId: e.target.value })}>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-label font-medium text-fg-2">What they can do</legend>
              {(Object.keys(SCOPES) as Scope[]).map((k) => (
                <label
                  key={k}
                  className="flex cursor-pointer gap-3 rounded-md border border-line px-3 py-2.5 has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
                >
                  <input
                    type="radio"
                    name="scope"
                    value={k}
                    checked={values.scope === k}
                    onChange={() => setValues({ ...values, scope: k })}
                    className="mt-1 size-4 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="block text-body font-medium text-fg">{SCOPES[k].label}</span>
                    <span className="block text-label text-fg-2">{SCOPES[k].sees}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <Field label="Reason" hint="Recorded with the grant and shown to approvers." error={errors.reason}>
              {(p) => (
                <Textarea
                  {...p}
                  value={values.reason}
                  onChange={(e) => setValues({ ...values, reason: e.target.value })}
                  rows={2}
                  maxLength={500}
                />
              )}
            </Field>
            <Field label="Ends on" optional hint="Leave empty for no end date. You can revoke it at any time." error={errors.expiresAt}>
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  min={minDate}
                  value={values.expiresAt}
                  onChange={(e) => setValues({ ...values, expiresAt: e.target.value })}
                  className="w-48"
                />
              )}
            </Field>
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary">
                Review grant
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-body text-fg">
              <span className="font-semibold">{person?.name}</span> will get <span className="font-semibold">{s.label.toLowerCase()}</span>{" "}
              for <span className="font-semibold">{team?.name}</span>
              {values.expiresAt ? ` until ${values.expiresAt}` : " with no end date"}.
            </p>
            <AudienceSeam audience={`Becomes visible to ${person?.name ?? "them"}`} />
            <p className="text-body text-fg-2">{s.sees}</p>
            <p className="text-body text-fg-2">
              <span className="font-medium text-fg">Never included: </span>
              {s.never}
            </p>
            <p className="rounded-sm bg-subtle px-3 py-2 text-label text-fg-2">{s.approval}</p>
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button onClick={() => setStep("form")}>Back</Button>
              <Button variant="primary" pending={pending} pendingLabel="Saving…" onClick={submit}>
                {values.scope === "dashboard_summary" ? "Grant summary access" : "Request approval"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export function GrantDecision({ grantId, label }: { grantId: string; label: string }) {
  const [mode, setMode] = useState<null | "approve" | "reject">(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={() => setMode("approve")}>
          Approve
        </Button>
        <Button size="sm" onClick={() => setMode("reject")}>
          Reject
        </Button>
      </div>
      <ConfirmDialog
        open={!!mode}
        onOpenChange={(o) => !o && setMode(null)}
        title={mode === "approve" ? "Approve this access?" : "Reject this request?"}
        consequence={
          mode === "approve"
            ? `${label} The grant becomes active immediately and is recorded in the audit log.`
            : "Nothing becomes visible. The request is kept in the history."
        }
        confirmLabel={mode === "approve" ? "Approve access" : "Reject"}
        danger={mode === "reject"}
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const res = await decideGrant(grantId, mode === "approve", note);
            toast(
              res.ok ? (mode === "approve" ? "Access approved." : "Request rejected.") : res.error.message,
              res.ok ? "success" : "error",
            );
            setMode(null);
          })
        }
      >
        <label className="mt-3 flex flex-col gap-1.5">
          <span className="text-label font-medium text-fg-2">Note (optional)</span>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </label>
      </ConfirmDialog>
    </>
  );
}

export function RevokeGrant({ grantId, who }: { grantId: string; who: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button size="sm" variant="danger" onClick={() => setOpen(true)}>
        Revoke
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Revoke access for ${who}?`}
        consequence="Access ends on their next request, including open pages. Revoked grants can't be reactivated; issue a new one if needed."
        confirmLabel="Revoke access"
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const res = await revokeGrant(grantId, reason);
            toast(res.ok ? "Access revoked." : res.error.message, res.ok ? "success" : "error");
            setOpen(false);
          })
        }
      >
        <label className="mt-3 flex flex-col gap-1.5">
          <span className="text-label font-medium text-fg-2">Reason (optional)</span>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </label>
      </ConfirmDialog>
    </>
  );
}
