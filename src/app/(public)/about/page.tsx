import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { getLandingPageImageUrls } from "@/lib/landing-page-data";
import { getPublishedLandingPage } from "@/lib/landing-page-server";
import { createClient } from "@/lib/supabase/server";
import { isMissingWorshipSchedulesTable } from "@/lib/worship-schedules";
import { cn } from "cn";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const landingPage = await getPublishedLandingPage();
  const imageUrls = await getLandingPageImageUrls(landingPage);

  const supabase = await createClient();
  const { data: schedules, error: schedulesError } = await supabase
    .from("worship_schedules")
    .select("id, day, time, service_name, note")
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (schedulesError && !isMissingWorshipSchedulesTable(schedulesError)) {
    throw new Error("Unable to load worship schedules.", { cause: schedulesError });
  }

  const publicSchedules = schedulesError ? [] : schedules ?? [];

  const whoWeAre = landingPage.about.whoWeAre;
  const beliefs = landingPage.about.beliefs;
  const callToAction = landingPage.about.callToAction;

  const whoWeAreVisible = Boolean(whoWeAre.text || whoWeAre.photo.path);
  const beliefsVisible = Boolean(beliefs.text);
  const serviceTimesVisible = Boolean(landingPage.about.serviceTimes.intro || publicSchedules.length > 0);
  const leadersVisible = landingPage.about.leaders.length > 0;
  const callToActionVisible = Boolean(
    callToAction.heading ||
      callToAction.text ||
      callToAction.buttonLabel ||
      callToAction.buttonHref,
  );

  const whoWeArePhotoUrl = whoWeAre.photo.path ? imageUrls["about:whoWeAre"] ?? null : null;

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-12 sm:px-10 lg:px-12">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">About</h1>

      {whoWeAreVisible && (
        <section className="mt-10" id="about-us">
          <div className={cn("grid gap-8", whoWeArePhotoUrl ? "lg:grid-cols-2 lg:items-start" : "")}>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Who We Are</h2>
              {whoWeAre.text && (
                <p className="mt-4 whitespace-pre-line text-base leading-7 text-muted-foreground">
                  {whoWeAre.text}
                </p>
              )}
            </div>
            {whoWeArePhotoUrl && (
              <div className="relative min-h-64 overflow-hidden rounded-[2rem] border border-border bg-card">
                <Image
                  alt={whoWeAre.photo.alt}
                  className="object-cover"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  src={whoWeArePhotoUrl}
                  unoptimized
                />
              </div>
            )}
          </div>
        </section>
      )}

      {beliefsVisible && (
        <section className="mt-12" id="beliefs">
          <h2 className="text-2xl font-semibold tracking-tight">Our Beliefs</h2>
          <p className="mt-4 whitespace-pre-line text-base leading-7 text-muted-foreground">
            {beliefs.text}
          </p>
        </section>
      )}

      {serviceTimesVisible && (
        <section className="mt-12" id="service-times">
          <h2 className="text-2xl font-semibold tracking-tight">Service Times</h2>
          {landingPage.about.serviceTimes.intro && (
            <p className="mt-4 whitespace-pre-line text-base leading-7 text-muted-foreground">
              {landingPage.about.serviceTimes.intro}
            </p>
          )}
          {publicSchedules.length > 0 && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {publicSchedules.map((schedule) => (
                <article className="rounded-2xl border border-border bg-card p-6" key={schedule.id}>
                  <p className="text-sm font-medium text-brand">{schedule.day}</p>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight">{schedule.service_name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{schedule.time}</p>
                  {schedule.note && (
                    <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                      {schedule.note}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {leadersVisible && (
        <section className="mt-12" id="leaders">
          <h2 className="text-2xl font-semibold tracking-tight">Our Leaders</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {landingPage.about.leaders.map((leader) => {
              const photoUrl = leader.photo.path ? imageUrls["about:leader:" + leader.id] ?? null : null;
              const hasLeaderContent = Boolean(leader.name || leader.role || leader.photo.path);
              if (!hasLeaderContent) return null;

              return (
                <article className="flex items-center gap-4 rounded-2xl border border-border bg-card p-6" key={leader.id}>
                  {photoUrl && (
                    <div className="relative size-14 overflow-hidden rounded-full border border-border bg-muted">
                      <Image alt={leader.photo.alt} className="object-cover" fill sizes="56px" src={photoUrl} unoptimized />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold tracking-tight">{leader.name}</p>
                    {leader.role && <p className="mt-1 text-sm text-muted-foreground">{leader.role}</p>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {callToActionVisible && (
        <section className="mt-12 rounded-2xl border border-border bg-card p-8">
          {callToAction.heading && (
            <h2 className="text-2xl font-semibold tracking-tight">{callToAction.heading}</h2>
          )}
          {callToAction.text && (
            <p className="mt-3 max-w-2xl whitespace-pre-line text-base leading-7 text-muted-foreground">
              {callToAction.text}
            </p>
          )}
          {callToAction.buttonLabel && callToAction.buttonHref && (
            <div className="mt-6">
              {callToAction.buttonHref.startsWith("/") ? (
                <Link className={buttonVariants({ size: "sm" })} href={callToAction.buttonHref}>
                  {callToAction.buttonLabel}
                </Link>
              ) : (
                <a className={buttonVariants({ size: "sm" })} href={callToAction.buttonHref} rel="noopener noreferrer" target="_blank">
                  {callToAction.buttonLabel}
                </a>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
