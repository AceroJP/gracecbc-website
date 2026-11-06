"use server";

import { createHash, createHmac, randomBytes } from "node:crypto";
import { headers, cookies } from "next/headers";
import { z } from "zod";
import { createPrivilegedClient } from "@/lib/supabase/admin";
import { getSupabasePublicEnv } from "@/lib/env";
import { getSupabaseSecretKey } from "@/lib/env.server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

export type ContributorCredentialState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const grantCookie = "gcbc_devotional_grant";

export async function verifyContributorCredentials(
  _previousState: ContributorCredentialState,
  formData: FormData,
): Promise<ContributorCredentialState> {
  const parsed = credentialsSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter your username and password.",
    };
  }

  const requestHeaders = await headers();
  const clientIp =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    requestHeaders.get("x-real-ip") ??
    "unknown";

  try {
    const privilegedClient = createPrivilegedClient();
    const normalizedUsername = parsed.data.username.toLowerCase();
    const { data: contributor, error: contributorError } =
      await privilegedClient
        .from("devotional_contributors")
        .select("id, auth_user_id, status, email_verified_at")
        .eq("normalized_username", normalizedUsername)
        .maybeSingle();

    if (contributorError) {
      throw new Error("Unable to resolve contributor username.", {
        cause: contributorError,
      });
    }

    const requestHash = createHash("sha256")
      .update(`${normalizedUsername}\u0000${clientIp}`)
      .digest("hex");
    const { data: allowed, error: rateLimitError } = await privilegedClient.rpc(
      "consume_devotional_rate_limit",
      {
        p_scope: "credential_attempt",
        p_request_hash: requestHash,
        p_max_attempts: 5,
        p_window_seconds: 900,
      },
    );

    if (rateLimitError) {
      throw new Error("Unable to apply credential rate limiting.", {
        cause: rateLimitError,
      });
    }

    if (!allowed) {
      return {
        status: "error",
        message: "Too many attempts. Please wait before trying again.",
      };
    }

    if (!contributor) {
      return {
        status: "error",
        message: "Unable to verify those credentials.",
      };
    }

    const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
      getSupabasePublicEnv();
    const authClient = createSupabaseClient(
      NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      },
    );
    const { data: authUser } = await privilegedClient.auth.admin.getUserById(
      contributor.auth_user_id,
    );
    const email = authUser.user?.email;

    if (!email) {
      return {
        status: "error",
        message: "Unable to verify those credentials.",
      };
    }

    const { error: signInError } = await authClient.auth.signInWithPassword({
      email,
      password: parsed.data.password,
    });
    await authClient.auth.signOut();

    if (
      signInError ||
      !contributor.email_verified_at ||
      contributor.status !== "approved"
    ) {
      return {
        status: "error",
        message: "Unable to verify those credentials.",
      };
    }

    const grant = randomBytes(32).toString("hex");
    const grantHash = createHmac("sha256", getSupabaseSecretKey())
      .update(grant)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { data: grantCreated, error: grantError } =
      await privilegedClient.rpc("issue_devotional_submission_grant", {
        p_grant_hash: grantHash,
        p_contributor_id: contributor.id,
        p_expires_at: expiresAt,
      });

    if (grantError || !grantCreated) {
      throw new Error("Unable to create a submission grant.", {
        cause: grantError,
      });
    }

    const cookieStore = await cookies();
    cookieStore.set(grantCookie, grant, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 300,
      path: "/devotionals",
    });

    return {
      status: "success",
      message: "Credentials verified. You may now write your devotional.",
    };
  } catch (error) {
    console.error("Contributor credential verification failed.", error);
    return {
      status: "error",
      message: "We couldn’t verify your credentials. Please try again.",
    };
  }
}
