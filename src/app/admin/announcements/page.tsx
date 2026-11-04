import type { Metadata } from "next";
import Link from "next/link";
import { AnnouncementManager } from "@/components/admin/announcement-manager";
import { announcementBucket } from "@/lib/announcements";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Announcements",
};

export default async function AnnouncementsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Unable to load announcements.", { cause: error });
  }

  const announcements = data.map((announcement) => {
    const storage = supabase.storage.from(announcementBucket);
    return {
      ...announcement,
      pdf_url: announcement.pdf_path
        ? storage.getPublicUrl(announcement.pdf_path).data.publicUrl
        : null,
      slide_urls: announcement.slide_paths.map(
        (path) => storage.getPublicUrl(path).data.publicUrl,
      ),
      background_url: announcement.background_path
        ? storage.getPublicUrl(announcement.background_path).data.publicUrl
        : null,
    };
  });

  return (
    <>
      <p className="text-xs font-medium text-muted-foreground">
        <Link className="hover:text-foreground" href="/admin/dashboard">
          Admin
        </Link>{" "}
        / Announcements
      </p>
      <div className="mt-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Announcements
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Publish Sunday services, prayer meetings, and other church updates.
          Present them as a PDF or as an image slideshow.
        </p>
      </div>
      <div className="mt-8">
        <AnnouncementManager announcements={announcements} />
      </div>
    </>
  );
}
