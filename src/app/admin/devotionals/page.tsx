import type { Metadata } from "next";
import Link from "next/link";
import { DevotionalManager } from "@/components/admin/devotional-manager";
import { createPrivilegedClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Devotionals" };

export default async function AdminDevotionalsPage() {
  await requireAdminUser();
  const client = createPrivilegedClient();
  const [
    { data: devotionals, error: devotionalsError },
    { data: contributors, error: contributorsError },
    { data: applications, error: applicationsError },
  ] = await Promise.all([
    client
      .from("devotionals")
      .select("id, title, bible_passage, message, status, is_featured, submitted_at, rejection_reason, contributor_id")
      .order("submitted_at", { ascending: false }),
    client.from("devotional_contributors").select("id, full_name, username, email_verified_at"),
    client.from("devotional_applications").select("id, contributor_id, status, submitted_at"),
  ]);

  if (devotionalsError || contributorsError || applicationsError) {
    throw new Error("Unable to load devotional moderation data.", {
      cause: devotionalsError ?? contributorsError ?? applicationsError,
    });
  }

  const contributorMap = new Map(
    contributors.map((contributor) => [contributor.id, contributor]),
  );
  return (
    <>
      <p className="text-xs font-medium text-muted-foreground">
        <Link className="hover:text-foreground" href="/admin/dashboard">Admin</Link> / Devotionals
      </p>
      <div className="mt-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Devotional moderation</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Review contributor applications and moderate devotional submissions before publication.
        </p>
      </div>
      <div className="mt-8">
        <DevotionalManager
          applications={applications.map((application) => {
            const contributor = contributorMap.get(application.contributor_id);
            return {
              ...application,
              full_name: contributor?.full_name ?? "Unknown contributor",
              username: contributor?.username ?? "unknown",
              email_verified_at: contributor?.email_verified_at ?? null,
            };
          })}
          devotionals={devotionals.map((devotional) => ({
            ...devotional,
            author: contributorMap.get(devotional.contributor_id)?.full_name ?? "Unknown contributor",
          }))}
        />
      </div>
    </>
  );
}
