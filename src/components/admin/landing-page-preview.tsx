"use client";

import { useEffect, useMemo, useState } from "react";
import { LandingPageView } from "@/components/public/landing-page-view";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { type LandingPageContent } from "@/lib/landing-page";
import { getPublicNavigation } from "@/lib/public-navigation";
import type { getLandingPageData } from "@/lib/landing-page-data";

type Draft = { content: LandingPageContent; imageUrls: Record<string, string | null> };

export function LandingPagePreview({
  data,
}: {
  data: Awaited<ReturnType<typeof getLandingPageData>>;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (
        event.origin !== window.location.origin ||
        event.source !== window.parent ||
        event.data?.type !== "landing-preview-update"
      )
        return;
      setDraft({ content: event.data.content, imageUrls: event.data.imageUrls });
    }
    window.addEventListener("message", receive);
    window.parent.postMessage({ type: "landing-preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", receive);
  }, []);

  useEffect(() => {
    function preventNavigation(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest("a") : null;
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      const url = new URL(target.href, window.location.href);
      if (url.origin === window.location.origin && url.pathname === "/" && url.hash) {
        document.getElementById(url.hash.slice(1))?.scrollIntoView();
      }
    }
    function preventSubmit(event: Event) {
      event.preventDefault();
      event.stopPropagation();
    }
    document.addEventListener("click", preventNavigation, true);
    document.addEventListener("submit", preventSubmit, true);
    return () => {
      document.removeEventListener("click", preventNavigation, true);
      document.removeEventListener("submit", preventSubmit, true);
    };
  }, []);

  const navigationAvailability = useMemo(() => {
    return {
      announcements: data.publicAnnouncements.length > 0,
      events: data.events.length > 0,
      schedules: data.schedules.length > 0,
    };
  }, [data]);

  if (!draft) return <p className="p-6">Loading preview?</p>;

  const navigation = getPublicNavigation(draft.content, navigationAvailability);

  return (
    <>
      <PublicHeader
        navigation={navigation}
        logoUrl={
          draft.content.header.logo.path
            ? draft.imageUrls["header-logo"] ?? null
            : null
        }
        settings={draft.content.header}
      />
      <LandingPageView
        data={data}
        imageUrls={draft.imageUrls}
        landingPage={draft.content}
      />
      <PublicFooter footer={draft.content.footer} />
    </>
  );
}





