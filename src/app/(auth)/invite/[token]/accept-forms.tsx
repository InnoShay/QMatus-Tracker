"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { acceptInviteAsNewUser, acceptInviteAsSignedIn, type FormState } from "@/features/auth/actions";

export function AcceptAsNewUser({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(acceptInviteAsNewUser.bind(null, token), undefined);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field label="Your name" error={state?.fieldErrors?.name}>
        {(p) => <Input {...p} name="name" autoComplete="name" required autoFocus />}
      </Field>
      <Field label="Password" hint="At least 12 characters." error={state?.fieldErrors?.password}>
        {(p) => <Input {...p} name="password" type="password" autoComplete="new-password" required minLength={12} />}
      </Field>
      <Field label="Confirm password" error={state?.fieldErrors?.confirm}>
        {(p) => <Input {...p} name="confirm" type="password" autoComplete="new-password" required />}
      </Field>
      {state?.error && (
        <p role="alert" className="rounded-sm bg-danger-bg px-3 py-2 text-body text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="primary" pending={pending} pendingLabel="Creating your account…" className="w-full">
        Create account and join
      </Button>
    </form>
  );
}

export function AcceptAsSignedIn({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(() => acceptInviteAsSignedIn(token), undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      {state?.error && (
        <p role="alert" className="rounded-sm bg-danger-bg px-3 py-2 text-body text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="primary" pending={pending} pendingLabel="Joining…">
        Accept invitation
      </Button>
    </form>
  );
}
