"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { requestPasswordReset, setNewPassword, type FormState } from "@/features/auth/actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<(FormState & { sent?: boolean }) | undefined, FormData>(requestPasswordReset, undefined);
  if (state?.sent) {
    return (
      <div className="flex flex-col gap-3" role="status">
        <p className="text-body text-fg-2">
          If that email belongs to a QMatus account, a reset link is on its way. The link works once and expires soon.
        </p>
        <Link href="/sign-in" className="text-body font-medium text-accent hover:text-accent-hover">
          Back to sign in
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field label="Email" error={state?.fieldErrors?.email}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="username" autoFocus />}
      </Field>
      <Button type="submit" variant="primary" pending={pending} pendingLabel="Sending…" className="w-full">
        Send reset link
      </Button>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(setNewPassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field label="New password" hint="At least 12 characters." error={state?.fieldErrors?.password}>
        {(p) => <Input {...p} name="password" type="password" autoComplete="new-password" autoFocus />}
      </Field>
      <Field label="Confirm password" error={state?.fieldErrors?.confirm}>
        {(p) => <Input {...p} name="confirm" type="password" autoComplete="new-password" />}
      </Field>
      {state?.error && (
        <p role="alert" className="rounded-sm bg-danger-bg px-3 py-2 text-body text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="primary" pending={pending} pendingLabel="Saving…" className="w-full">
        Save password
      </Button>
    </form>
  );
}
