import { NextResponse, type NextRequest } from "next/server";
import { createPrivilegedClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const verificationType = request.nextUrl.searchParams.get("type");
  const next = request.nextUrl.searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!code && !(tokenHash && verificationType === "email")) {
    return NextResponse.redirect(new URL("/devotionals/apply?error=verification", request.url));
  }

  const supabase = await createClient();
  const verificationResult = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
      token_hash: tokenHash!,
        type: "email",
      });

  if (verificationResult.error) {
    console.error(
      "Unable to complete contributor email verification.",
      verificationResult.error,
    );
    return NextResponse.redirect(new URL("/devotionals/apply?error=verification", request.url));
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    console.error("Unable to load verified contributor.", userError);
    return NextResponse.redirect(new URL("/devotionals/apply?error=verification", request.url));
  }

  const privilegedClient = createPrivilegedClient();
  const now = new Date().toISOString();
  const { data: contributor, error: contributorError } = await privilegedClient
    .from("devotional_contributors")
    .update({
      email_verified_at: userData.user.email_confirmed_at ?? now,
      status: "pending_admin_approval",
      updated_at: now,
    })
    .eq("auth_user_id", userData.user.id)
    .eq("status", "pending_email_verification")
    .select("id")
    .maybeSingle();

  if (contributorError) {
    console.error("Unable to update verified contributor.", contributorError);
  } else if (contributor) {
    const { error: applicationError } = await privilegedClient
      .from("devotional_applications")
      .update({ status: "pending_admin_approval", updated_at: now })
      .eq("contributor_id", contributor.id)
      .eq("status", "pending_email_verification");

    if (applicationError) {
      console.error("Unable to update verified application.", applicationError);
    }
  }

  await supabase.auth.signOut();
  return NextResponse.redirect(new URL(`${safeNext}?verified=1`, request.url));
}
