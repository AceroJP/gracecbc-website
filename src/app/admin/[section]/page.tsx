import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const sections: Record<string, { title: string; description: string }> = {
  "landing-page": {
    title: "Landing Page Builder",
    description: "The public website welcome area will be managed here.",
  },
  events: {
    title: "Events",
    description: "Church-approved event content will be managed here.",
  },
  announcements: {
    title: "Announcements",
    description: "Church-approved announcements will be managed here.",
  },
  schedules: {
    title: "Schedules",
    description: "Confirmed church schedule information will be managed here.",
  },
  baptism: {
    title: "Baptism",
    description: "Baptism information and related content will be managed here.",
  },
  devotionals: {
    title: "Devotionals",
    description: "Church-approved devotional content will be managed here.",
  },
  livestream: {
    title: "Livestream",
    description: "Livestream details and links will be managed here.",
  },
  media: {
    title: "Media Library",
    description: "Approved church photos and media will be organized here.",
  },
  settings: {
    title: "Website Settings",
    description: "Website settings will be managed here.",
  },
};

type AdminSectionPageProps = {
  params: Promise<{ section: string }>;
};

export async function generateMetadata({
  params,
}: AdminSectionPageProps): Promise<Metadata> {
  const { section } = await params;
  const content = sections[section];

  return content ? { title: content.title } : {};
}

export default async function AdminSectionPage({
  params,
}: AdminSectionPageProps) {
  const { section } = await params;
  const content = sections[section];

  if (!content) {
    notFound();
  }

  return (
    <>
      <p className="text-xs font-medium text-muted-foreground">
        <Link className="hover:text-foreground" href="/admin/dashboard">
          Admin
        </Link>{" "}
        / {content.title}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
        {content.title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        {content.description}
      </p>
      <section className="mt-8 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
        <p className="text-sm font-medium">Management tools are not available yet</p>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
          This page is an interface placeholder. Content editing and publishing
          will be implemented in later phases.
        </p>
      </section>
    </>
  );
}
