import {
  ArrowUpRight,
  BookOpenText,
  CalendarDays,
  Clock3,
  Headphones,
  MapPin,
  PanelsTopLeft,
} from "lucide-react";
import Image from "next/image";
import { formatEventDateRange, formatEventTime } from "@/lib/events";
import {
  announcementBucket,
  formatAnnouncementDate,
  getAnnouncementPresentationType,
  getAnnouncementCategoryLabel,
} from "@/lib/announcements";
import { getOptionalTurnstileSiteKey } from "@/lib/env";
import { parseRegistrationFields } from "@/lib/registration";
import { createClient } from "@/lib/supabase/server";
import { RegistrationForm } from "@/components/public/registration-form";
import {
  AnnouncementViewer,
  type PublicAnnouncement,
} from "@/components/public/announcement-viewer";

const websiteAreas = [
  {
    id: "schedules",
    title: "Worship schedules",
    description:
      "Service times and schedule details will be added after they are confirmed.",
    icon: Clock3,
    label: "Details pending",
  },
  {
    id: "livestream",
    title: "YouTube livestreams",
    description:
      "Livestream information and links can be added here when they are available.",
    icon: Headphones,
    label: "Link pending",
  },
  {
    id: "devotionals",
    title: "Devotionals",
    description:
      "A place for devotional content, ready for church-approved materials.",
    icon: BookOpenText,
    label: "Content area",
  },
  {
    id: "contact",
    title: "Contact information",
    description:
      "Church contact details will appear here once they are provided.",
    icon: MapPin,
    label: "Details pending",
  },
  {
    id: "landing-page",
    title: "Landing page",
    description:
      "This welcome area is a placeholder for an approved church introduction.",
    icon: PanelsTopLeft,
    label: "Placeholder",
  },
];

export const dynamic = "force-dynamic";

export default async function Home() {
  const turnstileSiteKey = getOptionalTurnstileSiteKey();
  const supabase = await createClient();
  const [
    { data: events, error: eventsError },
    { data: announcements, error: announcementsError },
  ] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, title, description, event_date, end_date, starts_at, ends_at, location, registration_enabled, registration_fields, registration_deadline",
      )
      .is("archived_at", null)
      .order("event_date", { ascending: true })
      .order("starts_at", { ascending: true })
      .limit(6),
    supabase
      .from("announcements")
      .select(
        "id, title, body, pdf_path, pdf_name, slide_paths, slide_names, categories, background_path, created_at",
      )
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
  ]);

  if (eventsError) {
    throw new Error("Unable to load public events.", { cause: eventsError });
  }
  if (announcementsError) {
    throw new Error("Unable to load public announcements.", {
      cause: announcementsError,
    });
  }

  const storage = supabase.storage.from(announcementBucket);
  const publicAnnouncements: (PublicAnnouncement & { created_at: string })[] =
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
    }));

  return (
    <main>
      <section
        id="landing-page"
        className="relative isolate overflow-hidden bg-brand text-white"
      >
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_75%_15%,rgba(147,197,190,0.2),transparent_38%),linear-gradient(125deg,transparent_45%,rgba(10,31,38,0.32))]" />
        <div className="mx-auto grid min-h-[580px] max-w-7xl items-center gap-14 px-6 py-24 sm:px-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-12 lg:py-32">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium tracking-[0.16em] text-white/85 uppercase">
              <span className="size-1.5 rounded-full bg-emerald-200" />
              Welcome message placeholder
            </p>
            <h1 className="mt-8 text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
              A place for your church story.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
              An approved introduction to Grace Christian Baptist Church will
              appear here. This space is reserved for your welcome message.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-brand transition-colors hover:bg-white/85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                href="#events"
              >
                See upcoming events
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </a>
              <a
                className="inline-flex min-h-12 items-center rounded-full border border-white/35 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                href="#announcements"
              >
                Latest announcements
              </a>
            </div>
          </div>

          <div
            aria-label="Church image placeholder"
            className="relative hidden min-h-80 items-end overflow-hidden rounded-[2rem] border border-white/15 bg-white/5 p-8 shadow-2xl shadow-black/10 lg:flex"
          >
            <div className="absolute inset-0 bg-[linear-gradient(155deg,rgba(255,255,255,0.08),transparent_50%),radial-gradient(ellipse_at_70%_30%,rgba(255,255,255,0.14),transparent_60%)]" />
            <div className="relative rounded-2xl border border-white/15 bg-brand/45 px-5 py-4 backdrop-blur-sm">
              <p className="text-xs font-medium tracking-[0.16em] text-white/65 uppercase">
                Image placeholder
              </p>
              <p className="mt-1 text-sm text-white/90">
                Add an approved church photo later
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="announcements-heading"
        className="mx-auto max-w-7xl px-6 py-16 sm:px-10 lg:px-12"
        id="announcements"
      >
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
            Church updates
          </p>
          <h2
            className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
            id="announcements-heading"
          >
            Announcements
          </h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Sunday service, prayer meeting, and other church announcements.
          </p>
        </div>
        {publicAnnouncements.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
            No announcements have been posted yet. Please check back soon.
          </p>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {publicAnnouncements.map((announcement) => (
              <article
                className={
                  announcement.background_url
                    ? "relative isolate overflow-hidden rounded-2xl border border-border bg-cover bg-center p-6 text-white before:absolute before:inset-0 before:-z-10 before:bg-gradient-to-t before:from-black/80 before:via-black/45 before:to-black/25 before:content-['']"
                    : "relative isolate overflow-hidden rounded-2xl border border-border bg-card p-6"
                }
                style={
                  announcement.background_url
                    ? {
                        backgroundImage: `url("${announcement.background_url}")`,
                      }
                    : undefined
                }
                key={announcement.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p
                    className={
                      announcement.background_url
                        ? "text-xs font-medium text-white/90"
                        : "text-xs font-medium text-brand"
                    }
                  >
                    {formatAnnouncementDate(announcement.created_at)}
                  </p>
                  {announcement.categories.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {announcement.categories.map((category) => (
                        <span
                          className={
                            announcement.background_url
                              ? "rounded-full border border-white/30 bg-black/20 px-3 py-1 text-[11px] font-medium text-white"
                              : "rounded-full bg-brand/8 px-3 py-1 text-[11px] font-medium text-brand"
                          }
                          key={category}
                        >
                          {getAnnouncementCategoryLabel(category)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <h3
                  className={
                    announcement.background_url
                      ? "mt-3 text-lg font-semibold tracking-tight text-white"
                      : "mt-3 text-lg font-semibold tracking-tight"
                  }
                >
                  {announcement.title}
                </h3>
                {announcement.body && (
                  <p
                    className={
                      announcement.background_url
                        ? "mt-3 line-clamp-4 whitespace-pre-line text-sm leading-6 text-white/85"
                        : "mt-3 line-clamp-4 whitespace-pre-line text-sm leading-6 text-muted-foreground"
                    }
                  >
                    {announcement.body}
                  </p>
                )}
                {announcement.slide_urls[0] && (
                  <div className="relative mt-5 aspect-video overflow-hidden rounded-xl bg-black/10">
                    <Image
                      alt={`${announcement.title} presentation preview`}
                      className="object-contain"
                      fill
                      sizes="(min-width: 1024px) 25rem, (min-width: 640px) 50vw, 100vw"
                      src={announcement.slide_urls[0]}
                      unoptimized
                    />
                  </div>
                )}
                <AnnouncementViewer
                  announcement={announcement}
                  hasBackground={Boolean(announcement.background_url)}
                />
              </article>
            ))}
          </div>
        )}
      </section>

      <section
        aria-labelledby="upcoming-events-heading"
        className="mx-auto max-w-7xl px-6 py-16 sm:px-10 lg:px-12"
        id="events"
      >
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
            Church life
          </p>
          <h2
            className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
            id="upcoming-events-heading"
          >
            Events
          </h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            See what is happening at Grace Christian Baptist Church.
          </p>
        </div>

        {events.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
            No events have been posted yet. Please check back soon.
          </p>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <article
                className="rounded-2xl border border-border bg-card p-6"
                key={event.id}
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/8 text-brand">
                    <CalendarDays aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs font-medium text-brand">
                      {formatEventDateRange(event.event_date, event.end_date)}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold tracking-tight">
                      {event.title}
                    </h3>
                  </div>
                </div>
                <p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                  {event.description}
                </p>
                <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
                  <p className="inline-flex items-center gap-2">
                    <Clock3 aria-hidden="true" className="size-4 shrink-0" />
                    {formatEventTime(event.starts_at)}
                    {event.ends_at && ` – ${formatEventTime(event.ends_at)}`}
                  </p>
                  <p className="inline-flex items-center gap-2">
                    <MapPin aria-hidden="true" className="size-4 shrink-0" />
                    {event.location}
                  </p>
                </div>
                {event.registration_enabled && (
                  <RegistrationForm
                    deadline={event.registration_deadline}
                    eventId={event.id}
                    eventTitle={event.title}
                    fields={parseRegistrationFields(event.registration_fields)}
                    isClosed={
                      (event.end_date ?? event.event_date) <
                        new Date().toISOString().slice(0, 10) ||
                      (event.registration_deadline !== null &&
                        event.registration_deadline <
                          new Date().toISOString().slice(0, 10))
                    }
                    siteKey={turnstileSiteKey}
                  />
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section
        id="website-areas"
        className="mx-auto max-w-7xl px-6 py-20 sm:px-10 sm:py-28 lg:px-12"
      >
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
            Public website
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Everything visitors need, in one welcoming place.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Schedules, devotionals, and other church information will be added
            as approved details become available.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {websiteAreas.map(({ id, title, description, icon: Icon, label }) => (
            <article
              className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-brand/25 hover:bg-brand/[0.025]"
              id={id === "landing-page" ? undefined : id}
              key={id}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand/8 text-brand">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                  {label}
                </span>
              </div>
              <h3 className="mt-6 text-lg font-semibold tracking-tight">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-warm">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 sm:px-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-12 lg:py-20">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
              Your next step
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance">
              Help us make this site yours.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Church-approved messages, schedules, photos, and contact details can
            replace these placeholders as they become available. Nothing on
            this foundation assumes service times, locations, or other church
            information.
          </p>
        </div>
      </section>
    </main>
  );
}
