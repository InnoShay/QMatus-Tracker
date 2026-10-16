"use client";

import { Button } from "@/components/ui/button";

/** Route-level failure: plain language, no internals, a way to recover. */
export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-3 px-4 py-16">
      <h1 className="text-title font-semibold text-fg">This page didn’t load</h1>
      <p className="text-body text-fg-2">
        Something went wrong while loading it. Your saved work is safe. Try again, and if it keeps happening, let the team know.
      </p>
      <Button variant="primary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
