"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { submitDraft } from "../actions";

export function SubmitDraftButton({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="primary"
      pending={pending}
      pendingLabel="Submitting…"
      onClick={() =>
        startTransition(async () => {
          const res = await submitDraft(requestId);
          toast(res.ok ? "Request submitted. The receiving team will triage it." : res.error.message, res.ok ? "success" : "error");
        })
      }
    >
      Submit request
    </Button>
  );
}
