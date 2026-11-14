"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireAdminUser } from "@/lib/auth/server";
import { createContributorResetSignature } from "@/lib/auth/contributor-reset-link";
import { sendContributorApplicationNotification } from "@/lib/email/smtp";
import { createPrivilegedClient } from "@/lib/supabase/admin";
import { getSupabasePublicEnv } from "@/lib/env";

const devotionalActionSchema = z.object({
  id: z.uuid(),
  action: z.enum(["publish", "reject", "unpublish", "delete"]),
  reason: z.string().trim().max(2000),
  featured: z.enum(["on", "off"]).optional(),
});
const applicationActionSchema = z.object({
  id: z.uuid(),
  action: z.enum(["approve", "reject", "suspend", "reactivate", "delete_unverified"]),
  reason: z.string().trim().max(2000),
});
const contributorUpdateSchema = z.object({
  id: z.uuid(),
  fullName: z.string().trim().min(1).max(160),
  username: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/),
  email: z.email().trim().toLowerCase(),
  status: z.enum(["approved", "suspended"]),
});
const contributorResetSchema = z.object({ id: z.uuid() });
const contributorDeleteSchema = z.object({ id: z.uuid() });
const resetLinkLifetimeSeconds = 60 * 60;

type ActionResult = { status: "success" | "error"; message: string };

async function writeAudit(
  client: ReturnType<typeof createPrivilegedClient>,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  previousStatus: string | null,
  newStatus: string | null,
  metadata: Record<string, string>,
) {
  const { error } = await client.from("devotional_audit_log").insert({
    actor_user_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    previous_status: previousStatus,
    new_status: newStatus,
    metadata,
  });

  if (error) {
    throw new Error("Unable to record devotional audit event.", { cause: error });
  }
}

export async function moderateDevotionalAction(
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdminUser();
  const parsed = devotionalActionSchema.safeParse({
    id: formData.get("id"),
    action: formData.get("action"),
    reason: formData.get("reason") ?? "",
    featured: formData.get("featured") ?? "off",
  });

  if (!parsed.success) {
    return { status: "error", message: "Invalid moderation request." };
  }

  const client = createPrivilegedClient();
  const { data: devotional, error: lookupError } = await client
    .from("devotionals")
    .select("id, status, is_featured")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (lookupError) {
    throw new Error("Unable to load devotional.", { cause: lookupError });
  }
  if (!devotional) {
    return { status: "error", message: "That devotional no longer exists." };
  }

  const now = new Date().toISOString();
  if (parsed.data.action === "delete") {
    const { error } = await client
      .from("devotionals")
      .delete()
      .eq("id", parsed.data.id);
    if (error) {
      throw new Error("Unable to delete devotional.", { cause: error });
    }
    await writeAudit(
      client,
      admin.id,
      "delete",
      "devotional",
      parsed.data.id,
      devotional.status,
      null,
      { reason: parsed.data.reason },
    );
  } else {
    const update =
      parsed.data.action === "publish"
        ? {
            status: "published",
            published_at: now,
            approved_by: admin.id,
            approved_at: now,
            rejection_reason: null,
            is_featured: parsed.data.featured === "on",
            updated_at: now,
          }
        : parsed.data.action === "reject"
          ? {
              status: "rejected",
              rejection_reason: parsed.data.reason || "Not approved for publication.",
              is_featured: false,
              updated_at: now,
            }
          : {
              status: "unpublished",
              is_featured: false,
              updated_at: now,
            };
    const { error } = await client
      .from("devotionals")
      .update(update)
      .eq("id", parsed.data.id);
    if (error) {
      throw new Error("Unable to update devotional.", { cause: error });
    }
    await writeAudit(
      client,
      admin.id,
      parsed.data.action,
      "devotional",
      parsed.data.id,
      devotional.status,
      update.status,
      { reason: parsed.data.reason },
    );
  }

  revalidatePath("/admin/devotionals");
  revalidatePath("/devotionals");
  return { status: "success", message: "Devotional moderation was saved." };
}

export async function reviewContributorApplicationAction(
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdminUser();
  const parsed = applicationActionSchema.safeParse({
    id: formData.get("id"),
    action: formData.get("action"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: "Invalid application review request." };
  }

  const client = createPrivilegedClient();
  const { data: application, error: applicationError } = await client
    .from("devotional_applications")
    .select("id, contributor_id, status, devotional_contributors(auth_user_id, email_verified_at)")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (applicationError) {
    throw new Error("Unable to load contributor application.", {
      cause: applicationError,
    });
  }
  if (!application) {
    return { status: "error", message: "That application no longer exists." };
  }

  if (parsed.data.action === "approve" || parsed.data.action === "reactivate") {
    const contributor = Array.isArray(application.devotional_contributors)
      ? application.devotional_contributors[0]
      : application.devotional_contributors;
    if (!contributor?.auth_user_id || !contributor.email_verified_at) {
      return { status: "error", message: "The contributor must verify their email before approval." };
    }
    const { data: authUser, error: authError } =
      await client.auth.admin.getUserById(contributor.auth_user_id);
    if (authError) {
      throw new Error("Unable to check contributor email confirmation.", { cause: authError });
    }
    if (!authUser.user?.email_confirmed_at) {
      return { status: "error", message: "The contributor must verify their email before approval." };
    }
  }

  if (parsed.data.action === "delete_unverified") {
    const contributor = Array.isArray(application.devotional_contributors)
      ? application.devotional_contributors[0]
      : application.devotional_contributors;
    if (!contributor?.auth_user_id || contributor.email_verified_at) {
      return {
        status: "error",
        message: "Only applicants with an unverified email can be deleted.",
      };
    }

    const { error: applicationDeleteError } = await client
      .from("devotional_applications")
      .delete()
      .eq("id", parsed.data.id);
    if (applicationDeleteError) {
      throw new Error("Unable to delete contributor application.", {
        cause: applicationDeleteError,
      });
    }

    const { error: contributorDeleteError } = await client
      .from("devotional_contributors")
      .delete()
      .eq("id", application.contributor_id);
    if (contributorDeleteError) {
      throw new Error("Unable to delete contributor profile.", {
        cause: contributorDeleteError,
      });
    }

    const { error: authDeleteError } = await client.auth.admin.deleteUser(
      contributor.auth_user_id,
    );
    if (authDeleteError) {
      throw new Error("Unable to delete unverified applicant account.", {
        cause: authDeleteError,
      });
    }

    await writeAudit(
      client,
      admin.id,
      "delete",
      "contributor_application",
      parsed.data.id,
      application.status,
      null,
      { reason: parsed.data.reason, email_verified: "false" },
    );
    revalidatePath("/admin/devotionals");
    return {
      status: "success",
      message: "The unverified applicant was deleted.",
    };
  }

  const contributorStatus =
    parsed.data.action === "approve" || parsed.data.action === "reactivate"
      ? "approved"
      : parsed.data.action === "suspend"
        ? "suspended"
        : "rejected";
  const applicationStatus =
    parsed.data.action === "approve" || parsed.data.action === "reactivate"
      ? "approved"
      : "rejected";
  const now = new Date().toISOString();

  const { error: contributorError } = await client
    .from("devotional_contributors")
    .update({ status: contributorStatus, updated_at: now })
    .eq("id", application.contributor_id);
  if (contributorError) {
    throw new Error("Unable to update contributor status.", {
      cause: contributorError,
    });
  }

  const { error: updateError } = await client
    .from("devotional_applications")
    .update({
      status: applicationStatus,
      reviewed_by: admin.id,
      reviewed_at: now,
      rejection_reason:
        parsed.data.action === "reject" ? parsed.data.reason || null : null,
      updated_at: now,
    })
    .eq("id", parsed.data.id);
  if (updateError) {
    throw new Error("Unable to update contributor application.", {
      cause: updateError,
    });
  }

  await writeAudit(
    client,
    admin.id,
    parsed.data.action,
    "contributor_application",
    parsed.data.id,
    application.status,
    applicationStatus,
    { reason: parsed.data.reason },
  );

  let notificationAcceptedBySmtp = false;
  if (
    parsed.data.action === "approve" ||
    parsed.data.action === "reactivate" ||
    parsed.data.action === "reject"
  ) {
    const contributor = Array.isArray(application.devotional_contributors)
      ? application.devotional_contributors[0]
      : application.devotional_contributors;
    const decision =
      parsed.data.action === "reject" ? "rejected" : "approved";

    try {
      if (!contributor?.auth_user_id) {
        throw new Error("Contributor Auth account is missing.");
      }

      const { data: authUser, error: authLookupError } =
        await client.auth.admin.getUserById(contributor.auth_user_id);
      const email = authUser.user?.email;
      if (authLookupError || !email) {
        throw new Error("Contributor email could not be loaded.", {
          cause: authLookupError,
        });
      }

      await sendContributorApplicationNotification({ to: email, decision });
      notificationAcceptedBySmtp = true;
    } catch (error) {
      console.error("Contributor application notice was not accepted by SMTP.", {
        applicationId: parsed.data.id,
        decision,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { message: "Unknown SMTP error." },
      });
      return {
        status: "error",
        message: `The application was ${applicationStatus}, but its email notice was not accepted. Check the SMTP settings, then retry this action.`,
      };
    }
  }

  revalidatePath("/admin/devotionals");
  return {
    status: "success",
    message: notificationAcceptedBySmtp
      ? "Contributor application was reviewed, and the notice was accepted by SMTP."
      : "Contributor application was reviewed.",
  };
}

export async function updateContributorAction(
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdminUser();
  const parsed = contributorUpdateSchema.safeParse({
    id: formData.get("id"),
    fullName: formData.get("fullName"),
    username: formData.get("username"),
    email: formData.get("email"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid name, username, and email." };
  }

  const client = createPrivilegedClient();
  const { data: contributor, error: contributorError } = await client
    .from("devotional_contributors")
    .select("id, auth_user_id, full_name, username, status, email_verified_at")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (contributorError) {
    throw new Error("Unable to load contributor.", { cause: contributorError });
  }
  if (!contributor) {
    return { status: "error", message: "That contributor no longer exists." };
  }

  const { data: existingUsername, error: usernameError } = await client
    .from("devotional_contributors")
    .select("id")
    .eq("normalized_username", parsed.data.username.toLowerCase())
    .neq("id", parsed.data.id)
    .maybeSingle();
  if (usernameError) {
    throw new Error("Unable to check contributor username.", { cause: usernameError });
  }
  if (existingUsername) {
    return { status: "error", message: "That username is already in use." };
  }

  const { data: authUser, error: authLookupError } =
    await client.auth.admin.getUserById(contributor.auth_user_id);
  if (authLookupError || !authUser.user?.email) {
    throw new Error("Unable to load contributor email.", { cause: authLookupError });
  }
  if (
    parsed.data.status === "approved" &&
    (!contributor.email_verified_at || !authUser.user.email_confirmed_at)
  ) {
    return { status: "error", message: "The contributor must verify their email before approval." };
  }
  const previousEmail = authUser.user.email;
  const emailChanged = previousEmail.toLowerCase() !== parsed.data.email;

  if (emailChanged) {
    const { error: authUpdateError } = await client.auth.admin.updateUserById(
      contributor.auth_user_id,
      { email: parsed.data.email, email_confirm: true },
    );
    if (authUpdateError) {
      return {
        status: "error",
        message: "Unable to update the contributor email. It may already be in use.",
      };
    }
  }

  const { error: profileUpdateError } = await client
    .from("devotional_contributors")
    .update({
      full_name: parsed.data.fullName,
      username: parsed.data.username,
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);
  if (profileUpdateError) {
    if (emailChanged) {
      await client.auth.admin.updateUserById(contributor.auth_user_id, {
        email: previousEmail,
        email_confirm: true,
      });
    }
    throw new Error("Unable to update contributor profile.", {
      cause: profileUpdateError,
    });
  }

  await writeAudit(
    client,
    admin.id,
    "update",
    "contributor",
    parsed.data.id,
    contributor.status,
    parsed.data.status,
    { email_changed: String(emailChanged) },
  );
  revalidatePath("/admin/devotionals");
  return { status: "success", message: "Contributor account details were updated." };
}

export async function sendContributorPasswordResetAction(
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdminUser();
  const parsed = contributorResetSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { status: "error", message: "Invalid contributor reset request." };
  }

  const client = createPrivilegedClient();
  const { data: contributor, error: contributorError } = await client
    .from("devotional_contributors")
    .select("id, auth_user_id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (contributorError) {
    throw new Error("Unable to load contributor.", { cause: contributorError });
  }
  if (!contributor) {
    return { status: "error", message: "That contributor no longer exists." };
  }

  const { data: authUser, error: authLookupError } =
    await client.auth.admin.getUserById(contributor.auth_user_id);
  const email = authUser.user?.email;
  const authUserId = authUser.user?.id;
  if (authLookupError || !email || !authUserId) {
    throw new Error("Unable to load contributor email.", { cause: authLookupError });
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  if (!host) {
    throw new Error("Unable to determine the password reset URL.");
  }
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    getSupabasePublicEnv();
  const authClient = createSupabaseClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } },
  );
  const resetExpiresAt = Math.floor(Date.now() / 1000) + resetLinkLifetimeSeconds;
  const resetExpires = String(resetExpiresAt);
  const resetSignature = createContributorResetSignature(
    authUserId,
    resetExpires,
  );
  const redirectTo = new URL(
    "/auth/callback",
    `${requestHeaders.get("x-forwarded-proto") ?? "http"}://${host}`,
  );
  redirectTo.searchParams.set("next", "/devotionals/reset-password");
  redirectTo.searchParams.set("reset_user", authUserId);
  redirectTo.searchParams.set("reset_expires", resetExpires);
  redirectTo.searchParams.set("reset_signature", resetSignature);
  const { error: resetError } = await authClient.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo.toString(),
  });
  if (resetError) {
    throw new Error("Unable to send contributor password reset email.", {
      cause: resetError,
    });
  }

  await writeAudit(
    client,
    admin.id,
    "send_password_reset",
    "contributor",
    parsed.data.id,
    null,
    null,
    { email },
  );
  return { status: "success", message: `A password reset email was sent to ${email}.` };
}

export async function deleteContributorAction(
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdminUser();
  const parsed = contributorDeleteSchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Invalid contributor deletion request." };
  }

  const client = createPrivilegedClient();
  const { data: contributor, error: contributorError } = await client
    .from("devotional_contributors")
    .select("id, auth_user_id, username, status")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (contributorError) {
    throw new Error("Unable to load contributor for deletion.", {
      cause: contributorError,
    });
  }
  if (!contributor) {
    return { status: "error", message: "That contributor no longer exists." };
  }

  const { data: authAccount, error: authLookupError } =
    await client.auth.admin.getUserById(contributor.auth_user_id);
  if (authLookupError || !authAccount.user) {
    throw new Error("Unable to load contributor Auth account for deletion.", {
      cause: authLookupError,
    });
  }
  if (authAccount.user.app_metadata.role === "admin") {
    return {
      status: "error",
      message: "Administrator accounts cannot be deleted from contributor management.",
    };
  }

  const { error: deleteError } = await client.auth.admin.deleteUser(
    contributor.auth_user_id,
    false,
  );
  if (deleteError) {
    throw new Error("Unable to delete contributor account.", {
      cause: deleteError,
    });
  }

  await writeAudit(
    client,
    admin.id,
    "delete",
    "contributor",
    contributor.id,
    contributor.status,
    null,
    { username: contributor.username, associated_content_deleted: "true" },
  );
  revalidatePath("/admin/devotionals");
  revalidatePath("/devotionals");
  return {
    status: "success",
    message: `Contributor @${contributor.username} and all associated devotional content were permanently deleted.`,
  };
}
