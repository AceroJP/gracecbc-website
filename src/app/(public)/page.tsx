import {
  BookOpenText,
  CalendarDays,
  Clock3,
  Cross,
  Headphones,
  ArrowUpRight,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { formatEventDateRange, formatEventTime } from "@/lib/events";
import {
  announcementBucket,
  formatAnnouncementDate,
  getAnnouncementPresentationType,
  getAnnouncementCategoryLabel,
} from "@/lib/announcements";
import { getOptionalTurnstileSiteKey } from "@/lib/env";
import { parseRegistrationFields } from "@/lib/registration";
import {
  getYouTubeVideoEmbedUrl,
  type LandingPageBackgroundStyleVariables,
  type LandingPageSectionKey,
} from "@/lib/landing-page";
import { createClient } from "@/lib/supabase/server";
import { getPublishedLandingPage } from "@/lib/landing-page-server";
import { RegistrationForm } from "@/components/public/registration-form";
import {
  AnnouncementViewer,
  type PublicAnnouncement,
} from "@/components/public/announcement-viewer";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams: Promise<{ show?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const [params, landingPage] = await Promise.all([
    searchParams,
    getPublishedLandingPage(),
  ]);
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
      .limit(landingPage.devotionals.count),
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
  const sortedAnnouncements = [...publicAnnouncements].sort((a, b) => {
    if (a.id === landingPage.announcements.pinnedId) return -1;
    if (b.id === landingPage.announcements.pinnedId) return 1;
    return 0;
  });
  const visibleAnnouncements =
    params.show === "announcements"
      ? sortedAnnouncements
      : sortedAnnouncements.slice(0, landingPage.announcements.count);
  const visibleEvents =
    params.show === "events"
      ? events
      : events.slice(0, landingPage.events.count);
  const publicDevotionals = devotionals ?? [];
  const imageUrl = (path: string | null) =>
    path
      ? supabase.storage.from("landing-page-images").getPublicUrl(path).data.publicUrl
      : null;
  const sectionBackgroundStyle = (
    section: LandingPageSectionKey,
  ): CSSProperties & LandingPageBackgroundStyleVariables => {
    const background = landingPage.sectionBackgrounds[section];
    const url = imageUrl(background.image.path);
    return {
      "--landing-section-background-image": url ? `url("${url}")` : "none",
      "--landing-section-background-opacity": background.imageOpacity / 100,
      "--landing-section-background-blur": `${background.imageBlur}px`,
      backgroundColor: background.color || undefined,
      minHeight: background.minHeight || undefined,
      color: background.textColor || undefined,
    };
  };
  const heroImageUrl = imageUrl(landingPage.hero.image.path);
  const welcomeImageUrl = imageUrl(landingPage.welcome.image.path);
  const hasHero =
    landingPage.visibility.hero &&
    Boolean(
      landingPage.hero.headline ||
        landingPage.hero.subtext ||
        heroImageUrl ||
        landingPage.hero.buttons.length,
    );
  const hasWelcome =
    landingPage.visibility.welcome &&
    Boolean(landingPage.welcome.text || welcomeImageUrl);
  const hasSchedule =
    landingPage.visibility.schedule && landingPage.schedule.rows.length > 0;
  const hasLivestream =
    landingPage.visibility.livestream && Boolean(landingPage.livestream.url);
  const livestreamEmbedUrl = getYouTubeVideoEmbedUrl(landingPage.livestream.url);
  const hasAnnouncements =
    landingPage.visibility.announcements && publicAnnouncements.length > 0;
  const hasEvents = landingPage.visibility.events && events.length > 0;
  const hasDevotionals =
    landingPage.visibility.devotionals && publicDevotionals.length > 0;
  const hasContact =
    landingPage.visibility.contact &&
    Boolean(
      landingPage.contact.address ||
        landingPage.contact.phone ||
        landingPage.contact.email ||
        landingPage.contact.facebookUrl ||
        landingPage.contact.mapUrl,
    );

  return (
    <main className="flex flex-col">
      {hasHero && <section
        id="landing-page"
        className="relative isolate overflow-hidden bg-brand text-white"
        data-section-background={landingPage.sectionBackgrounds.hero.image.path ? "true" : undefined}
        data-section-custom-text={landingPage.sectionBackgrounds.hero.textColor ? "true" : undefined}
        style={{ order: landingPage.sectionOrder.indexOf("hero"), ...sectionBackgroundStyle("hero") }}
      >
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_75%_15%,rgba(147,197,190,0.2),transparent_38%),linear-gradient(125deg,transparent_45%,rgba(10,31,38,0.32))]" />
        <div
          className={`mx-auto grid max-w-7xl items-center gap-14 px-6 py-24 sm:px-10 lg:px-12 lg:py-32 ${heroImageUrl ? "lg:grid-cols-[1.15fr_0.85fr]" : ""}`}
          style={{ minHeight: landingPage.sectionBackgrounds.hero.minHeight || undefined }}
        >
          <div className="max-w-2xl">
            <h1 className="text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
              {landingPage.hero.headline}
            </h1>
            {landingPage.hero.subtext && (
              <p className="mt-6 max-w-xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
                {landingPage.hero.subtext}
              </p>
            )}
            {landingPage.hero.buttons.length > 0 && (
              <div className="mt-9 flex flex-wrap gap-3">
              {landingPage.hero.buttons.map((button, index) => (
                <Link
                  className={
                    index === 0
                      ? "inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-brand transition-colors hover:bg-white/85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                      : "inline-flex min-h-12 items-center rounded-full border border-white/35 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                  }
                  href={button.url}
                  key={`${button.label}-${index}`}
                >
                  {button.label}
                  {index === 0 && <ArrowUpRight aria-hidden="true" className="size-4" />}
                </Link>
              ))}
              </div>
            )}
          </div>

          {heroImageUrl && (
            <div className="relative hidden min-h-80 overflow-hidden rounded-[2rem] border border-white/15 bg-white/5 shadow-2xl shadow-black/10 lg:block">
              <Image
                alt={landingPage.hero.image.alt}
                className="object-cover"
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                src={heroImageUrl}
                unoptimized
              />
            </div>
          )}
        </div>
      </section>}

      {hasWelcome && (
        <section
          aria-labelledby="welcome-heading"
          className="w-full"
          data-section-background={landingPage.sectionBackgrounds.welcome.image.path ? "true" : undefined}
          data-section-custom-text={landingPage.sectionBackgrounds.welcome.textColor ? "true" : undefined}
          id="welcome"
          style={{ order: landingPage.sectionOrder.indexOf("welcome"), ...sectionBackgroundStyle("welcome") }}
        >
          <div className={`mx-auto grid max-w-7xl gap-8 px-6 py-16 sm:px-10 lg:items-center lg:px-12 ${welcomeImageUrl ? "lg:grid-cols-2" : ""}`}>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl" id="welcome-heading">
                Welcome
              </h2>
              {landingPage.welcome.text && (
                <p className="mt-4 whitespace-pre-line text-base leading-7 text-muted-foreground">
                  {landingPage.welcome.text}
                </p>
              )}
            </div>
            {welcomeImageUrl && (
              <div className="relative min-h-64 overflow-hidden rounded-[2rem] border border-border bg-card">
                <Image
                  alt={landingPage.welcome.image.alt}
                  className="object-cover"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  src={welcomeImageUrl}
                  unoptimized
                />
              </div>
            )}
          </div>
        </section>
      )}

      {hasSchedule && (
        <section
          aria-labelledby="worship-schedule-heading"
          className="w-full"
          data-section-background={landingPage.sectionBackgrounds.schedule.image.path ? "true" : undefined}
          data-section-custom-text={landingPage.sectionBackgrounds.schedule.textColor ? "true" : undefined}
          id="schedules"
          style={{ order: landingPage.sectionOrder.indexOf("schedule"), ...sectionBackgroundStyle("schedule") }}
        >
          <div className="mx-auto w-full max-w-7xl px-6 py-16 sm:px-10 lg:px-12">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl" id="worship-schedule-heading">
              Worship schedule
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {landingPage.schedule.rows.map((row) => (
                <article className="rounded-2xl border border-border bg-card p-6" key={row.id}>
                  <p className="text-sm font-medium text-brand">{row.day}</p>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight">{row.serviceName}</h3>
                  <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock3 aria-hidden="true" className="size-4 shrink-0" />
                    {row.time}
                  </p>
                  {row.note && (
                    <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                      {row.note}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {hasLivestream && (
        <section
          aria-labelledby="livestream-heading"
          className="w-full"
          data-section-background={landingPage.sectionBackgrounds.livestream.image.path ? "true" : undefined}
          data-section-custom-text={landingPage.sectionBackgrounds.livestream.textColor ? "true" : undefined}
          id="livestream"
          style={{ order: landingPage.sectionOrder.indexOf("livestream"), ...sectionBackgroundStyle("livestream") }}
        >
          <div className="mx-auto w-full max-w-5xl px-6 py-8 sm:px-10 lg:px-12">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand/8 text-brand">
                    <Headphones aria-hidden="true" className="size-5" />
                  </span>
                  <h2 className="text-lg font-semibold tracking-tight" id="livestream-heading">
                    {landingPage.livestream.label || "YouTube livestream"}
                  </h2>
                </div>
                {!livestreamEmbedUrl && (
                  <a
                    className="inline-flex min-h-11 items-center gap-2 self-start rounded-full bg-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand sm:self-auto"
                    href={landingPage.livestream.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Watch on YouTube
                    <ArrowUpRight aria-hidden="true" className="size-4" />
                  </a>
                )}
              </div>
              {livestreamEmbedUrl && (
                <div className="mx-auto aspect-video w-full max-w-3xl overflow-hidden rounded-xl bg-black">
                  <iframe
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="size-full"
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    src={livestreamEmbedUrl}
                    title={landingPage.livestream.label || "YouTube livestream"}
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {hasAnnouncements && <section
        aria-labelledby="announcements-heading"
        className="w-full"
        data-section-background={landingPage.sectionBackgrounds.announcements.image.path ? "true" : undefined}
        data-section-custom-text={landingPage.sectionBackgrounds.announcements.textColor ? "true" : undefined}
        id="announcements"
        style={{ order: landingPage.sectionOrder.indexOf("announcements"), ...sectionBackgroundStyle("announcements") }}
      >
        <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10 lg:px-12">
          <div className="max-w-2xl">
          <h2
            className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
            id="announcements-heading"
          >
            {landingPage.announcements.title}
          </h2>
          {landingPage.announcements.intro && (
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              {landingPage.announcements.intro}
            </p>
          )}
        </div>
          <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] items-stretch gap-6">
            {visibleAnnouncements.map((announcement) => (
              <AnnouncementViewer
                announcement={announcement}
                key={announcement.id}
              >
                <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-[transform,box-shadow] duration-200 group-hover/card:-translate-y-[3px] group-hover/card:shadow-[0_10px_24px_rgba(0,0,0,0.1)] motion-reduce:transition-none motion-reduce:group-hover/card:translate-y-0">
                  <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-brand/10">
                    {(announcement.background_url ||
                      announcement.slide_urls[0]) ? (
                      <>
                        <Image
                          alt=""
                          aria-hidden="true"
                          className="scale-125 object-cover blur-[20px]"
                          fill
                          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
                          src={
                            announcement.background_url ??
                            announcement.slide_urls[0]
                          }
                          unoptimized
                        />
                        <Image
                          alt={`${announcement.title} announcement flyer`}
                          className="object-contain transition-transform duration-200 group-hover/card:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover/card:scale-100"
                          fill
                          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
                          src={
                            announcement.background_url ??
                            announcement.slide_urls[0]
                          }
                          unoptimized
                        />
                      </>
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <Cross
                          aria-hidden="true"
                          className="size-8 text-brand/35"
                          strokeWidth={1.5}
                        />
                      </div>
                    )}
                    {announcement.categories.length > 0 && (
                      <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap gap-2 p-3">
                        {announcement.categories.map((category) => (
                          <span
                            className="rounded-full bg-card/95 px-3 py-1 text-[11px] font-medium text-brand shadow-sm"
                            key={category}
                          >
                            {getAnnouncementCategoryLabel(category)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="text-xs font-medium text-brand">
                      {formatAnnouncementDate(announcement.created_at)}
                    </p>
                    <h3 className="mt-2 min-h-14 line-clamp-2 text-lg font-bold leading-7 tracking-tight">
                      {announcement.title}
                    </h3>
                    <p className="mt-2 min-h-12 line-clamp-2 whitespace-pre-line text-[15px] leading-6 text-muted-foreground">
                      {announcement.body}
                    </p>
                    <p className="mt-auto pt-2 text-sm font-medium text-brand">
                      Read more →
                    </p>
                  </div>
                </article>
              </AnnouncementViewer>
            ))}
          </div>
        {params.show !== "announcements" &&
          publicAnnouncements.length > landingPage.announcements.count && (
          <div className="mt-8 text-right">
            <Link className="text-sm font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4" href="/?show=announcements#announcements">
              View all
            </Link>
          </div>
        )}
        </div>
      </section>}

      {hasEvents && <section
        aria-labelledby="upcoming-events-heading"
        className="w-full"
        data-section-background={landingPage.sectionBackgrounds.events.image.path ? "true" : undefined}
        data-section-custom-text={landingPage.sectionBackgrounds.events.textColor ? "true" : undefined}
        id="events"
        style={{ order: landingPage.sectionOrder.indexOf("events"), ...sectionBackgroundStyle("events") }}
      >
        <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10 lg:px-12">
          <div className="max-w-2xl">
          <h2
            className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
            id="upcoming-events-heading"
          >
            {landingPage.events.title}
          </h2>
          {landingPage.events.intro && (
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              {landingPage.events.intro}
            </p>
          )}
        </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visibleEvents.map((event) => (
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
        {params.show !== "events" && events.length > landingPage.events.count && (
          <div className="mt-8 text-right">
            <Link className="text-sm font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4" href="/?show=events#events">
              View all
            </Link>
          </div>
        )}
        </div>
      </section>}

      {hasDevotionals && (
        <section
          aria-labelledby="devotionals-heading"
          className="w-full"
          data-section-background={landingPage.sectionBackgrounds.devotionals.image.path ? "true" : undefined}
          data-section-custom-text={landingPage.sectionBackgrounds.devotionals.textColor ? "true" : undefined}
          id="devotionals"
          style={{ order: landingPage.sectionOrder.indexOf("devotionals"), ...sectionBackgroundStyle("devotionals") }}
        >
          <div className="mx-auto w-full max-w-7xl px-6 py-16 sm:px-10 lg:px-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl" id="devotionals-heading">
                Devotionals
              </h2>
            </div>
            <Link
              className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
              href="/devotionals"
            >
              View devotionals
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {publicDevotionals.map((devotional) => (
              <article className="rounded-2xl border border-border bg-card p-6" key={devotional.id}>
                <div className="flex size-10 items-center justify-center rounded-xl bg-brand/8 text-brand">
                  <BookOpenText aria-hidden="true" className="size-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">
                  {devotional.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {devotional.bible_passage}
                </p>
                <Link
                  className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                  href={`/devotionals/${devotional.slug}`}
                >
                  Read devotional
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </Link>
              </article>
            ))}
          </div>
          {(devotionalCount ?? 0) > publicDevotionals.length && (
            <p className="mt-6 text-right">
              <Link className="text-sm font-semibold text-brand underline-offset-4 hover:underline" href="/devotionals">
                View all devotionals
              </Link>
            </p>
          )}
          </div>
        </section>
      )}

      {hasContact && (
        <section
          aria-labelledby="contact-heading"
          className="w-full"
          data-section-background={landingPage.sectionBackgrounds.contact.image.path ? "true" : undefined}
          data-section-custom-text={landingPage.sectionBackgrounds.contact.textColor ? "true" : undefined}
          id="contact"
          style={{ order: landingPage.sectionOrder.indexOf("contact"), ...sectionBackgroundStyle("contact") }}
        >
          <div className="mx-auto w-full max-w-7xl px-6 py-16 sm:px-10 lg:px-12">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl" id="contact-heading">
            Contact and location
          </h2>
          <div className="mt-6 flex flex-col gap-4 text-sm leading-6 text-muted-foreground">
            {landingPage.contact.address && (
              <p className="inline-flex items-start gap-2">
                <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0 text-brand" />
                <span>{landingPage.contact.address}</span>
              </p>
            )}
            {landingPage.contact.phone && (
              <a className="inline-flex min-h-9 items-center gap-2 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2" href={`tel:${landingPage.contact.phone.replace(/[^\d+]/g, "")}`}>
                <Phone aria-hidden="true" className="size-4 shrink-0 text-brand" />
                {landingPage.contact.phone}
              </a>
            )}
            {landingPage.contact.email && (
              <a className="inline-flex min-h-9 items-center gap-2 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2" href={`mailto:${landingPage.contact.email}`}>
                <Mail aria-hidden="true" className="size-4 shrink-0 text-brand" />
                {landingPage.contact.email}
              </a>
            )}
            <div className="flex flex-wrap gap-4">
              {landingPage.contact.mapUrl && (
                <a className="inline-flex min-h-9 items-center gap-2 font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2" href={landingPage.contact.mapUrl} rel="noopener noreferrer" target="_blank">
                  <MapPin aria-hidden="true" className="size-4 shrink-0" />
                  Map
                </a>
              )}
              {landingPage.contact.facebookUrl && (
                <a className="inline-flex min-h-9 items-center gap-2 font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2" href={landingPage.contact.facebookUrl} rel="noopener noreferrer" target="_blank">
                  <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
                  Facebook
                </a>
              )}
            </div>
          </div>
          </div>
        </section>
      )}
    </main>
  );
}
