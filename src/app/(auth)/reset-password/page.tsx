import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "../password-forms";

export const metadata: Metadata = { title: "Choose a password" };

/** Reached only through a verified one-time link, which created the session. */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?reason=link");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-title font-semibold text-fg">Choose a new password</h1>
        <p className="mt-1 text-body text-fg-2">For {user.email}.</p>
      </div>
      <NewPasswordForm />
    </div>
  );
}
