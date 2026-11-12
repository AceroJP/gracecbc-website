import type { Metadata } from "next";
import Link from "next/link";
import { LandingPageBuilder } from "@/components/admin/landing-page-builder";
import { requireAdminUser } from "@/lib/auth/server";
import {
  getDefaultLandingPageContent,
  landingPageSectionKeys,
  parseLandingPageContent,
} from "@/lib/landing-page";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Landing Page Builder",
};

function parseSavedContent(value: unknown, label: string) {
  const parsed = parseLandingPageContent(value);
  if (!parsed.success) {
    throw new Error(`${label} content is invalid.`, { cause: parsed.error });
  }
  return parsed.data;
}

export default async function LandingPageBuilderPage() {
  await requireAdminUser();
  const supabase = await createClient();
  const [
    { data: draftRow, error: draftError },
    { data: publishedRow, error: publishedError },
    { data: announcements, error: announcementsError },
  ] = await Promise.all([
    supabase
      .from("landing_page_drafts")
      .select("content")
      .eq("id", true)
      .maybeSingle(),
    supabase
      .from("landing_page_published")
      .select("content")
      .eq("id", true)
      .maybeSingle(),
    supabase
      .from("announcements")
      .select("id, title")
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
  ]);

  if (draftError) {
    throw new Error("Unable to load the landing page draft.", { cause: draftError });
  }
  if (publishedError) {
    throw new Error("Unable to load the published landing page.", {
      cause: publishedError,
    });
  }
  if (announcementsError) {
    throw new Error("Unable to load announcements for the landing page builder.", {
      cause: announcementsError,
    });
  }

  const draft = draftRow
    ? parseSavedContent(draftRow.content, "Draft")
    : getDefaultLandingPageContent();
  const published = publishedRow
    ? parseSavedContent(publishedRow.content, "Published landing page")
    : getDefaultLandingPageContent();
  const storage = supabase.storage.from("landing-page-images");
  const imageUrl = (path: string | null) =>
    path ? storage.getPublicUrl(path).data.publicUrl : null;
  const imageUrls = (content: typeof draft) => ({
    hero: imageUrl(content.hero.image.path),
    welcome: imageUrl(content.welcome.image.path),
    "header-logo": imageUrl(content.header.logo.path),
    ...Object.fromEntries(
      landingPageSectionKeys.map((section) => [
        `background:${section}`,
        imageUrl(content.sectionBackgrounds[section].image.path),
      ]),
    ),
  });

  return (
    <>
      <p className="text-xs font-medium text-muted-foreground">
        <Link className="hover:text-foreground" href="/admin/dashboard">
          Admin
        </Link>{" "}
        / Landing Page Builder
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
        Landing Page Builder
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Edit homepage sections as a draft, preview them at desktop or mobile
        sizes, and publish when you are ready.
      </p>
      <LandingPageBuilder
        announcements={announcements}
        draft={draft}
        imageUrls={imageUrls(draft)}
        published={published}
        publishedImageUrls={imageUrls(published)}
      />
    </>
  );
}
