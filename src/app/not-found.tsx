import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <section aria-labelledby="not-found-title" className="w-full max-w-lg text-center">
        <p className="text-sm font-semibold text-brand">404</p>
        <h1
          className="mt-3 text-3xl font-semibold tracking-tight"
          id="not-found-title"
        >
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The page you’re looking for doesn’t exist or may have moved.
        </p>
        <Button className="mt-6" render={<Link href="/" />}>
          Go to homepage
        </Button>
      </section>
    </main>
  );
}
