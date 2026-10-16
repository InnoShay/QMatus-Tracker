"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { signIn, type FormState } from "@/features/auth/actions";

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, undefined);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <Field label="Email" error={state?.fieldErrors?.email}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="username" required autoFocus />}
      </Field>
      <Field label="Password" error={state?.fieldErrors?.password}>
        {(p) => <Input {...p} name="password" type="password" autoComplete="current-password" required />}
      </Field>
      {state?.error && (
        <p role="alert" className="rounded-sm bg-danger-bg px-3 py-2 text-body text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="primary" pending={pending} pendingLabel="Signing in…" className="mt-1 w-full">
        Sign in
      </Button>
    </form>
  );
}
