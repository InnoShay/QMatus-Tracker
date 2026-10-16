import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hashInviteToken, isWellFormedToken } from "@/features/auth/tokens";
import { AcceptAsNewUser, AcceptAsSignedIn } from "./accept-forms";

export const metadata: Metadata = { title: "Accept invitation" };

const MESSAGES: Record<string, { title: string; body: string }> = {
  invalid: {
    title: "This invitation link isn't valid",
    body: "Check that you copied the whole link. If it still doesn't work, ask the person who invited you to send a new one.",
  },
  used: {
    title: "This invitation has already been used",
    body: "If you accepted it, sign in with that email. Otherwise ask for a new invitation.",
  },
  expired: {
    title: "This invitation has expired",
    body: "Invitations are valid for a limited time. Ask the person who invited you to send a fresh link.",
  },
};

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const supabase = await createClient();
  let state = "invalid";
  let workspace: string | null = null;
  let email: string | null = null;
  if (isWellFormedToken(token)) {
    const { data } = await supabase.rpc("peek_invitation", { p_token_hash: hashInviteToken(token) });
    state = data?.[0]?.state ?? "invalid";
    workspace = data?.[0]?.workspace_name ?? null;
    email = data?.[0]?.email ?? null;
  }

  if (state !== "valid") {
    const m = MESSAGES[state] ?? MESSAGES.invalid;
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-title font-semibold text-fg">{m.title}</h1>
        <p className="text-body text-fg-2">{m.body}</p>
        <Link href="/sign-in" className="text-body font-medium text-accent hover:text-accent-hover">
          Go to sign in
        </Link>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-title font-semibold text-fg">Join the {workspace} workspace</h1>
        <p className="mt-1 text-body text-fg-2">
          This invitation is for <span className="font-medium text-fg">{email}</span>.
        </p>
      </div>
      {user ? (
        user.email?.toLowerCase() === email ? (
          <AcceptAsSignedIn token={token} />
        ) : (
          <p className="rounded-sm bg-warning-bg px-3 py-2 text-body text-warning">
            You’re signed in with a different email. Sign out, then open this link again.
          </p>
        )
      ) : (
        <AcceptAsNewUser token={token} />
      )}
    </div>
  );
}
