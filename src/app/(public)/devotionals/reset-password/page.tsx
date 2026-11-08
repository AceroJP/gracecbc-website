import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { ResetPasswordForm } from "@/components/public/reset-password-form";
import { ResetPasswordSession } from "@/components/public/reset-password-session";

export const metadata: Metadata = {
  title: "Reset devotional contributor password",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const expired = params.error === "expired";

  return (
    <main className="flex min-h-[calc(100dvh-76px)] items-center justify-center bg-foreground/5 px-3 py-6 sm:px-6 sm:py-10">
      <section className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-card shadow-floating">
        <div className="border-b border-border bg-brand px-5 py-6 text-brand-foreground sm:px-8 sm:py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <KeyRound aria-hidden="true" />
            </div>
            <Link
              className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-brand-foreground/80 transition-colors hover:bg-white/10 hover:text-brand-foreground"
              href="/devotionals"
            >
              <ArrowLeft aria-hidden="true" data-icon="inline-start" />
              Back
            </Link>
          </div>
          <p className="mt-6 text-xs font-semibold tracking-[0.18em] text-brand-foreground/70 uppercase">
            Contributor access
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Set a new password
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-brand-foreground/75">
            {expired
              ? "This password reset link has expired. Ask the church administrator to send you a new one."
              : "Choose a new password, then use your username and password to write a devotional."}
          </p>
        </div>
        <div className="p-5 sm:p-8">
          {expired ? (
            <Link
              className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              href="/devotionals"
            >
              Return to devotionals
            </Link>
          ) : (
            <ResetPasswordSession>
              <ResetPasswordForm />
            </ResetPasswordSession>
          )}
        </div>
      </section>
    </main>
  );
}
