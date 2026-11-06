"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { SweetAlertError } from "@/components/ui/sweet-alert-error";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application route failed to render.", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <SweetAlertError
        message="Please try again. If the problem continues, return to the homepage."
        title="We couldn’t load this page"
      />
      <section
        aria-labelledby="error-title"
        className="w-full max-w-lg text-center"
        role="alert"
      >
        <p className="text-sm font-semibold text-brand">Something went wrong</p>
        <h1
          className="mt-3 text-3xl font-semibold tracking-tight"
          id="error-title"
        >
          We couldn’t load this page.
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Please try again. If the problem continues, return to the homepage.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Link className={buttonVariants({ variant: "outline" })} href="/">
            Go to homepage
          </Link>
        </div>
      </section>
    </main>
  );
}
