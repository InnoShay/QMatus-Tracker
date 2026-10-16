import type { Metadata } from "next";
import { ForgotPasswordForm } from "../password-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-title font-semibold text-fg">Reset your password</h1>
        <p className="mt-1 text-body text-fg-2">Enter the email you sign in with and we’ll send a one-time link.</p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
