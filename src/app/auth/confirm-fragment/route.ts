import { NextResponse, type NextRequest } from "next/server";
import { createPrivilegedClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const accessToken = typeof body?.accessToken === "string" ? body.accessToken : null;

  if (!accessToken) {
    return NextResponse.json({ error: "Missing verification token." }, { status: 400 });
  }

  const client = createPrivilegedClient();
  const { data, error: userError } = await client.auth.getUser(accessToken);
  if (userError || !data.user) {
    console.error("Unable to verify contributor fragment token.", userError);
    return NextResponse.json({ error: "That verification link is invalid or expired." }, { status: 400 });
  }

  if (!data.user.email_confirmed_at) {
    return NextResponse.json({ error: "Please confirm your email before continuing." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data: contributor, error: contributorError } = await client
    .from("devotional_contributors")
    .update({
      email_verified_at: data.user.email_confirmed_at,
      status: "pending_admin_approval",
      updated_at: now,
    })
    .eq("auth_user_id", data.user.id)
    .eq("status", "pending_email_verification")
    .select("id")
    .maybeSingle();

  if (contributorError) {
    throw new Error("Unable to update verified contributor.", { cause: contributorError });
  }

  if (contributor) {
    const { error: applicationError } = await client
      .from("devotional_applications")
      .update({ status: "pending_admin_approval", updated_at: now })
      .eq("contributor_id", contributor.id)
      .eq("status", "pending_email_verification");

    if (applicationError) {
      throw new Error("Unable to update verified application.", { cause: applicationError });
    }
  }

  return NextResponse.json({ verified: true });
}
