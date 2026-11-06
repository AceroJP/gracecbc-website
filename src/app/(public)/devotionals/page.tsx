import type { Metadata } from "next";
import { ArrowRight, BookOpenText, Heart, Sparkles } from "lucide-react";
import { ContributorApplicationModal } from "@/components/public/contributor-application-modal";
import { WriteDevotionalButton } from "@/components/public/write-devotional-button";

export const metadata: Metadata = {
  title: "Community devotionals",
  description: "Read and share church-reviewed devotionals with the GCBC community.",
};

export default function DevotionalsPage() {
  return (
    <main className="min-h-[calc(100vh-76px)] bg-[radial-gradient(circle_at_top_right,oklch(0.94_0.025_185/.45),transparent_35%)]">
      <div className="mx-auto w-full max-w-7xl px-6 py-10 sm:px-10 lg:px-12 lg:py-16">
        <section className="relative isolate overflow-hidden rounded-[2rem] bg-brand px-6 py-12 text-white shadow-2xl shadow-brand/20 sm:px-10 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12 lg:px-16 lg:py-16">
          <div className="absolute -top-32 -right-24 -z-10 size-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-40 left-1/3 -z-10 size-96 rounded-full bg-cyan-200/10 blur-3xl" />
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-[0.18em] text-white/75 uppercase">
              <Sparkles aria-hidden="true" data-icon="inline-start" />
              GCBC community
            </p>
            <h1 className="mt-6 max-w-2xl text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Words that strengthen faith.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/75 sm:text-lg">
              Read biblical encouragement from approved GCBC contributors. Every
              devotional is reviewed before it is shared publicly.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <WriteDevotionalButton />
              <ContributorApplicationModal />
            </div>
            <div className="mt-8 flex items-center gap-2 text-sm text-white/60">
              <Heart aria-hidden="true" data-icon="inline-start" />
              <span>Read, reflect, and encourage one another.</span>
            </div>
          </div>
          <div className="mt-10 hidden lg:block">
            <div className="relative mx-auto max-w-sm rotate-2 rounded-3xl border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-sm">
              <div className="rounded-2xl bg-background p-6 text-foreground">
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                    <BookOpenText aria-hidden="true" />
                  </span>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                    Community
                  </span>
                </div>
                <p className="mt-8 text-xs font-semibold tracking-[0.16em] text-brand uppercase">
                  A moment to reflect
                </p>
                <p className="mt-3 text-2xl leading-tight font-semibold tracking-tight">
                  Let your faith guide the next step.
                </p>
                <div className="mt-8 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  Explore devotionals
                  <ArrowRight aria-hidden="true" data-icon="inline-end" />
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["Reviewed with care", "Every submission is checked before publication."],
            ["Made for reflection", "Comfortable, focused reading for your day."],
            ["Shared by community", "Encouragement from approved contributors."],
          ].map(([title, description]) => (
            <div className="rounded-2xl border border-border/80 bg-card/80 p-5 shadow-sm" key={title}>
              <p className="font-semibold">{title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
          ))}
        </section>
        <section className="mt-12 rounded-3xl border border-dashed border-border bg-card/60 px-6 py-16 text-center shadow-sm sm:px-10">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
            <BookOpenText aria-hidden="true" />
          </span>
          <h2 className="mt-6 text-2xl font-semibold tracking-tight">Published devotionals are coming soon</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Approved devotional submissions will appear here after administrator
            review and publication.
          </p>
        </section>
      </div>
    </main>
  );
}
