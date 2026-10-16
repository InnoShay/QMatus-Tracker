import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions";

export const metadata: Metadata = { title: "No access" };

export default function NoAccessPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-semibold text-fg">You don’t have access to a workspace</h1>
      <p className="text-body text-fg-2">
        Your account is signed in, but it isn’t an active member of a QMatus workspace. If you expected access, contact a workspace admin.
      </p>
      <form action={signOut}>
        <Button type="submit">Sign out</Button>
      </form>
    </div>
  );
}
