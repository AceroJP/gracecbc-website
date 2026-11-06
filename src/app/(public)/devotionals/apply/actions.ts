"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { z } from "zod";
import { createPrivilegedClient } from "@/lib/supabase/admin";
import { getSupabasePublicEnv } from "@/lib/env";

const applicationSchema = z
  .object({
    fullName: z.string().trim().min(1).max(160),
    username: z
      .string()
      .trim()
      .regex(
        /^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/,
        "Use 3–32 letters, numbers, periods, underscores, or hyphens.",
      ),
    email: z.email().trim().toLowerCase(),
    password: z.string().min(10).max(128),
    confirmPassword: z.string(),
    guidelines: z.literal("on"),
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export type ContributorApplicationState = {
  status: "idle" | "success" | "error";
  message?: string;
};

function contributorApplicationError(
  message = "We couldn’t submit your application. Please try again.",
): ContributorApplicationState {
  return {
    status: "error",
    message,
  };
}

export async function submitContributorApplication(
  _previousState: ContributorApplicationState,
  formData: FormData,
): Promise<ContributorApplicationState> {
  const parsed = applicationSchema.safeParse({
    fullName: formData.get("fullName"),
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    guidelines: formData.get("guidelines"),
  });

  if (!parsed.success) {
    const passwordMismatch = parsed.error.issues.some(
      (issue) => issue.path[0] === "confirmPassword",
    );
    return {
      status: "error",
      message: passwordMismatch
        ? "Passwords do not match."
        : "Check the form details and try again.",
    };
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  if (!host) {
    console.error("Contributor application is missing the request host.");
    return contributorApplicationError();
  }

  try {
    const privilegedClient = createPrivilegedClient();
    const normalizedUsername = parsed.data.username.toLowerCase();
    const { data: existingUsername, error: usernameError } =
      await privilegedClient
        .from("devotional_contributors")
        .select("id")
        .eq("normalized_username", normalizedUsername)
        .maybeSingle();

    if (usernameError) {
      throw new Error("Unable to check contributor username.", {
        cause: usernameError,
      });
    }

    if (existingUsername) {
      return contributorApplicationError(
        "That username is already in use. Please choose another username.",
      );
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
    const redirectTo = `${requestHeaders.get("x-forwarded-proto") ?? "http"}://${host}/auth/callback?next=/devotionals/apply`;
    const { data, error: signUpError } = await authClient.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo: redirectTo },
    });

    if (signUpError) {
      console.error("Contributor Auth signup failed.", {
        message: signUpError.message,
        status: signUpError.status,
        code: signUpError.code,
      });
      const normalizedMessage = signUpError.message.toLowerCase();
      if (
        normalizedMessage.includes("already registered") ||
        normalizedMessage.includes("already been registered") ||
        normalizedMessage.includes("user already exists")
      ) {
        return contributorApplicationError(
          "This email is already registered. Verify it or use a different email address.",
        );
      }
      if (
        normalizedMessage.includes("smtp") ||
        normalizedMessage.includes("email") ||
        normalizedMessage.includes("rate limit")
      ) {
        return contributorApplicationError(
          "The verification email could not be sent. Please try again later or contact the church administrator.",
        );
      }
      return contributorApplicationError(
        "We couldn’t create your account. Please check your details and try again.",
      );
    }
    if (!data.user) {
      console.error("Contributor Auth signup returned no user.");
      return contributorApplicationError();
    }
    if (data.user.identities && data.user.identities.length === 0) {
      return contributorApplicationError(
        "This email is already registered. Verify it or use a different email address.",
      );
    }

    const { error: contributorError } = await privilegedClient
      .from("devotional_contributors")
      .insert({
        auth_user_id: data.user.id,
        full_name: parsed.data.fullName,
        username: parsed.data.username,
        email_verified_at: data.user.email_confirmed_at,
        status: data.user.email_confirmed_at
          ? "pending_admin_approval"
          : "pending_email_verification",
      });

    if (contributorError) {
      await privilegedClient.auth.admin.deleteUser(data.user.id);
      throw new Error("Unable to create contributor profile.", {
        cause: contributorError,
      });
    }

    const { data: contributor, error: profileError } = await privilegedClient
      .from("devotional_contributors")
      .select("id, status")
      .eq("auth_user_id", data.user.id)
      .single();

    if (profileError || !contributor) {
      throw new Error("Unable to load new contributor profile.", {
        cause: profileError,
      });
    }

    const { error: applicationError } = await privilegedClient
      .from("devotional_applications")
      .insert({
        contributor_id: contributor.id,
        status: contributor.status,
      });

    if (applicationError) {
      throw new Error("Unable to record contributor application.", {
        cause: applicationError,
      });
    }

    return {
      status: "success",
      message: data.user.email_confirmed_at
        ? "Your application is awaiting administrator review."
        : "Check your email to verify your address before administrator review.",
    };
  } catch (error) {
    console.error("Contributor application failed.", error);
    return contributorApplicationError();
  }
}
