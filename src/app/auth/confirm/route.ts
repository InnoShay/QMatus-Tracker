import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/features/auth/tokens";
import { createClient } from "@/lib/supabase/server";

/** Verifies a one-time email token (recovery) and starts a session. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNextPath(url.searchParams.get("next") ?? "/my-work");
  const fail = new URL("/sign-in?reason=link", url.origin);
  if (!tokenHash || type !== "recovery") return NextResponse.redirect(fail);
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
  return NextResponse.redirect(error ? fail : new URL(next, url.origin));
}
