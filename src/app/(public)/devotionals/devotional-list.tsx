"use client";

import Link from "next/link";
import { Search, ArrowRight, BookOpenText } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  formatDevotionalDate,
  getDevotionalExcerpt,
  type PublicDevotional,
} from "@/lib/devotionals";

export function DevotionalList({
  devotionals,
  totalPages,
  page,
  query,
  category,
}: {
  devotionals: PublicDevotional[];
  totalPages: number;
  page: number;
  query: string;
  category: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateFilters(next: { q?: string; category?: string; page?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.q !== undefined) {
      if (next.q) params.set("q", next.q);
      else params.delete("q");
    }
    if (next.category !== undefined) {
      if (next.category) params.set("category", next.category);
      else params.delete("category");
    }
    if (next.page !== undefined) {
      if (next.page > 1) params.set("page", String(next.page));
      else params.delete("page");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <section className="mt-10">
      <form
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          updateFilters({ q: new FormData(event.currentTarget).get("q")?.toString().trim() ?? "", page: 1 });
        }}
      >
        <div className="relative flex-1">
          <Search aria-hidden="true" className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <input
            aria-label="Search devotionals"
            className="h-11 w-full rounded-lg border border-input bg-background pr-3 pl-10 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            defaultValue={query}
            name="q"
            placeholder="Search by title, passage, or message"
          />
        </div>
        <select
          aria-label="Filter by category"
          className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          onChange={(event) => updateFilters({ category: event.target.value, page: 1 })}
          value={category}
        >
          <option value="">All topics</option>
          <option value="faith">Faith</option>
          <option value="prayer">Prayer</option>
          <option value="hope">Hope</option>
          <option value="christian-living">Christian Living</option>
        </select>
        <Button type="submit">Search</Button>
      </form>

      {devotionals.length > 0 ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {devotionals.map((devotional) => (
            <article className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-lg" key={devotional.id}>
              <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
                <span>{devotional.category ?? "Devotional"}</span>
                <span>{formatDevotionalDate(devotional.published_at ?? devotional.submitted_at)}</span>
              </div>
              <h2 className="mt-4 text-xl font-semibold tracking-tight">{devotional.title}</h2>
              <p className="mt-2 text-sm font-medium text-brand">{devotional.bible_passage}</p>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {getDevotionalExcerpt(devotional.message)}
              </p>
              <div className="mt-6 flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">By {devotional.author}</span>
                <Link className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline" href={`/devotionals/${devotional.slug}`}>
                  Read
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <BookOpenText className="mx-auto text-muted-foreground" />
          <p className="mt-3 font-medium">No published devotionals found</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a different search or topic.</p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button disabled={page <= 1} onClick={() => updateFilters({ page: page - 1 })} variant="outline">
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button disabled={page >= totalPages} onClick={() => updateFilters({ page: page + 1 })} variant="outline">
            Next
          </Button>
        </div>
      )}
    </section>
  );
}
