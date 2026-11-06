import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createPrivilegedClient } from "@/lib/supabase/admin";
import { DevotionalReactionButton } from "@/components/public/devotional-reaction-button";
import { formatDevotionalDate, getReadingTime } from "@/lib/devotionals";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("devotionals").select("title, message").eq("slug", slug).eq("status", "published").maybeSingle();
  return data ? { title: data.title, description: data.message.slice(0, 160) } : {};
}

export default async function DevotionalReadingPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const privilegedClient = createPrivilegedClient();
  const { data: devotional, error } = await supabase
    .from("devotionals")
    .select("id, contributor_id, category_id, title, slug, bible_passage, bible_translation, key_verse, message, personal_application, closing_prayer, status, is_featured, submitted_at, published_at, approved_by, approved_at, rejection_reason, moderation_note, created_at, updated_at, reaction_count")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error("Unable to load devotional.", { cause: error });
  if (!devotional) notFound();
  const [{ data: contributor }, { data: category }] = await Promise.all([
    privilegedClient.from("devotional_contributors").select("full_name").eq("id", devotional.contributor_id).single(),
    devotional.category_id ? supabase.from("devotional_categories").select("name").eq("id", devotional.category_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-14 sm:px-10 lg:py-20">
      <Link className="inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline" href="/devotionals">
        <ArrowLeft aria-hidden="true" /> All devotionals
      </Link>
      <article className="mt-10">
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">{category?.name ?? "Community devotional"}</p>
        <h1 className="mt-4 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">{devotional.title}</h1>
        <p className="mt-5 text-lg font-medium text-brand">{devotional.bible_passage} · {devotional.bible_translation}</p>
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span>By {contributor?.full_name ?? "GCBC contributor"}</span>
          <span>{formatDevotionalDate(devotional.published_at ?? devotional.submitted_at)}</span>
          <span className="inline-flex items-center gap-1"><Clock3 aria-hidden="true" /> {getReadingTime(devotional.message)} min read</span>
        </div>
        <blockquote className="mt-10 rounded-2xl border-l-4 border-brand bg-secondary/60 px-6 py-5 text-lg leading-8 text-secondary-foreground">
          {devotional.key_verse}
        </blockquote>
        <div className="mt-10 flex flex-col gap-8 text-base leading-8">
          <section><h2 className="text-xl font-semibold">Devotional message</h2><p className="mt-3 whitespace-pre-wrap">{devotional.message}</p></section>
          <section><h2 className="text-xl font-semibold">Personal application</h2><p className="mt-3 whitespace-pre-wrap">{devotional.personal_application}</p></section>
          <section><h2 className="text-xl font-semibold">Closing prayer</h2><p className="mt-3 whitespace-pre-wrap">{devotional.closing_prayer}</p></section>
        </div>
        <div className="mt-12 flex items-center justify-between gap-4 border-t border-border pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Heart aria-hidden="true" /> {devotional.reaction_count} likes
          </div>
          <DevotionalReactionButton
            devotionalId={devotional.id}
            initialCount={devotional.reaction_count}
          />
        </div>
      </article>
    </main>
  );
}
