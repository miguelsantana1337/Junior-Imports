import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  issuePasswordRecoveryProof,
  passwordRecoveryCookie,
  passwordRecoveryCookieOptions,
} from "@/lib/password-recovery-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const errorRedirect = new URL("/admin/forgot-password?error=expired", url.origin);
  if (!code) return NextResponse.redirect(errorRedirect);

  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return NextResponse.redirect(errorRedirect);

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const user = data.user;
  if (error || !user) return NextResponse.redirect(errorRedirect);

  const { data: profile } = await admin.from("profiles").select("active").eq("id", user.id).maybeSingle();
  if (!profile?.active) {
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.redirect(errorRedirect);
  }

  const cookieStore = await cookies();
  cookieStore.set(
    passwordRecoveryCookie,
    issuePasswordRecoveryProof(user.id),
    passwordRecoveryCookieOptions,
  );
  return NextResponse.redirect(new URL("/admin/reset-password", url.origin));
}
