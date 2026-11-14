import "server-only";
import { announcementBucket, formatAnnouncementDate, getAnnouncementPresentationType } from "@/lib/announcements";
import { getOptionalTurnstileSiteKey } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { landingPageContactKeys, landingPageSectionKeys, type LandingPageContent } from "@/lib/landing-page";
import type { PublicAnnouncement } from "@/components/public/announcement-viewer";

export async function getLandingPageData() {
  const turnstileSiteKey = getOptionalTurnstileSiteKey();
  const supabase = await createClient();
  const [
    { data: events, error: eventsError },
    { data: announcements, error: announcementsError },
    { data: devotionals, count: devotionalCount, error: devotionalsError },
  ] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, title, description, event_date, end_date, starts_at, ends_at, location, registration_enabled, registration_fields, registration_deadline",
      )
      .is("archived_at", null)
      .order("event_date", { ascending: true })
      .order("starts_at", { ascending: true }),
    supabase
      .from("announcements")
      .select(
        "id, title, body, pdf_path, pdf_name, slide_paths, slide_names, categories, background_path, created_at",
      )
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("devotionals")
      .select("id, slug, title, bible_passage, published_at", { count: "exact" })
      .eq("status", "published")
      .order("is_featured", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(12),
  ]);

  if (eventsError) {
    throw new Error("Unable to load public events.", { cause: eventsError });
  }
  if (announcementsError) {
    throw new Error("Unable to load public announcements.", {
      cause: announcementsError,
    });
  }
  if (devotionalsError) {
    throw new Error("Unable to load public devotionals.", { cause: devotionalsError });
  }

  const storage = supabase.storage.from(announcementBucket);
  const publicAnnouncements: (PublicAnnouncement & { created_at: string; displayDate: string })[] =
    announcements.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      presentation_name: announcement.pdf_name,
      presentation_type:
        announcement.pdf_path || announcement.slide_paths.length > 0
          ? getAnnouncementPresentationType(
              announcement.pdf_path,
              announcement.slide_paths,
            )
          : null,
      presentation_url: announcement.pdf_path
        ? storage.getPublicUrl(announcement.pdf_path).data.publicUrl
        : null,
      slide_names: announcement.slide_names,
      slide_urls: announcement.slide_paths.map(
        (path) => storage.getPublicUrl(path).data.publicUrl,
      ),
      categories: announcement.categories,
      background_url: announcement.background_path
        ? storage.getPublicUrl(announcement.background_path).data.publicUrl
        : null,
      created_at: announcement.created_at,
      displayDate: formatAnnouncementDate(announcement.created_at),
    }));
  return { events, publicAnnouncements, devotionals: devotionals ?? [], devotionalCount, turnstileSiteKey, today: new Date().toISOString().slice(0, 10) };
}

export async function getLandingPageImageUrls(content: LandingPageContent) {
  const supabase = await createClient();
  const imageUrl = (path: string | null) => path ? supabase.storage.from("landing-page-images").getPublicUrl(path).data.publicUrl : null;
  return {
    hero: imageUrl(content.hero.image.path), welcome: imageUrl(content.welcome.image.path),
    "header-logo": imageUrl(content.header.logo.path),
    ...Object.fromEntries(landingPageSectionKeys.map((section) => [`background:${section}`, imageUrl(content.sectionBackgrounds[section].image.path)])),
    ...Object.fromEntries(landingPageContactKeys.map((field) => [`contact:${field}`, imageUrl(content.contact.appearance[field].image.path)])),
  };
}
