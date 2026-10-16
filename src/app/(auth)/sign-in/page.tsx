import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/my-work");
  const { next, reason } = await searchParams;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-title font-semibold text-fg">Sign in to QMatus</h1>
        <p className="mt-1 text-body text-fg-2">Use the email address your invitation was sent to.</p>
      </div>
      {reason === "expired" && (
        <p role="status" className="rounded-sm bg-warning-bg px-3 py-2 text-body text-warning">
          Your session ended. Sign in again to continue where you left off.
        </p>
      )}
      {reason === "link" && (
        <p role="status" className="rounded-sm bg-warning-bg px-3 py-2 text-body text-warning">
          That link has expired or was already used. Request a new one below.
        </p>
      )}
      <SignInForm next={typeof next === "string" ? next : ""} />
      <Link href="/forgot-password" className="self-start text-label font-medium text-accent hover:text-accent-hover">
        Forgot your password?
      </Link>
    </div>
  );
}
