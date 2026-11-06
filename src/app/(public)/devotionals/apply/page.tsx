import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ContributorApplicationForm } from "@/components/public/contributor-application-form";
import { VerificationFragmentHandler } from "@/components/public/verification-fragment-handler";

export const metadata: Metadata = {
  title: "Become a devotional contributor",
  description: "Apply to share a reviewed devotional with the GCBC community.",
};

export default function ContributorApplicationPage() {
  return (
    <Suspense fallback={null}>
      <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-10 lg:py-24">
        <VerificationFragmentHandler />
        <Link className="text-sm font-medium text-brand hover:underline" href="/devotionals">
          ← Back to devotionals
        </Link>
        <div className="mt-8">
          <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
            Share God’s Word
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Become a devotional contributor
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
            Apply to contribute devotionals to the GCBC community. Your email must
            be verified and every submission is reviewed by an administrator before
            it is published.
          </p>
        </div>
        <ContributorApplicationForm />
      </main>
    </Suspense>
  );
}
