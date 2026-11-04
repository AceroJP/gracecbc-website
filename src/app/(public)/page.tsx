import {
  ArrowUpRight,
  BookOpenText,
  CalendarDays,
  Clock3,
  Headphones,
  MapPin,
  PanelsTopLeft,
} from "lucide-react";

const websiteAreas = [
  {
    id: "events",
    title: "Events & announcements",
    description:
      "A home for upcoming events and church announcements once content is provided.",
    icon: CalendarDays,
    label: "Content area",
  },
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

export default function Home() {
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
            <a
              className="mt-9 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-brand transition-colors hover:bg-white/85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              href="#website-areas"
            >
              Explore this website
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </a>
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
            These are the planned content areas. Details and materials will be
            added when approved church information is available.
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
