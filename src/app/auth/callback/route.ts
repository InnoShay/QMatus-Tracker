import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/features/auth/tokens";
import { createClient } from "@/lib/supabase/server";

/** PKCE code exchange for password-reset emails. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next") ?? "/my-work");
  if (!code) return NextResponse.redirect(new URL("/sign-in?reason=link", url.origin));
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(error ? "/sign-in?reason=link" : next, url.origin));
}
