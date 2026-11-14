"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { getLivestreamVideoUrls, type LandingPageContent } from "@/lib/landing-page";

const desktopQuery = "(min-width: 48rem)";

function subscribeToDesktopWidth(onChange: () => void) {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function isDesktopWidth() {
  return window.matchMedia(desktopQuery).matches;
}

export function LivestreamSlider({ settings }: { settings: LandingPageContent["livestream"] }) {
  const [startIndex, setStartIndex] = useState(0);
  const isDesktop = useSyncExternalStore(subscribeToDesktopWidth, isDesktopWidth, () => false);
  const videos = settings.items.flatMap((item) => {
    const urls = getLivestreamVideoUrls(item.url);
    return urls ? [{ ...item, ...urls }] : [];
  }).slice(0, settings.itemsToShow);
  if (!videos.length) return null;

  const visibleCount = isDesktop ? 2 : 1;
  const currentIndex = Math.min(startIndex, Math.floor((videos.length - 1) / visibleCount) * visibleCount);
  const visibleVideos = videos.slice(currentIndex, currentIndex + visibleCount);

  return (
    <div aria-label="Livestream videos" aria-roledescription="carousel" className="w-full" role="region">
      {(currentIndex > 0 || currentIndex + visibleCount < videos.length) && (
        <div className="mb-3 flex justify-end gap-2">
          <button aria-label="Previous videos" className="flex size-10 items-center justify-center rounded-full bg-background/80 text-foreground disabled:opacity-40" disabled={currentIndex === 0} onClick={() => setStartIndex(Math.max(0, currentIndex - visibleCount))} type="button">
            <ChevronLeft aria-hidden="true" className="size-5" />
          </button>
          <button aria-label="Next videos" className="flex size-10 items-center justify-center rounded-full bg-background/80 text-foreground disabled:opacity-40" disabled={currentIndex + visibleCount >= videos.length} onClick={() => setStartIndex(currentIndex + visibleCount)} type="button">
            <ChevronRight aria-hidden="true" className="size-5" />
          </button>
        </div>
      )}
      <div aria-live="polite" className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
        {visibleVideos.map((video, index) => (
          <div aria-label={`Video ${currentIndex + index + 1} of ${videos.length}`} aria-roledescription="slide" className="min-w-0" key={video.id} role="group" style={{ gridColumn: videos.length === 1 ? "1 / -1" : undefined }}>
            <div className="mx-auto w-full" style={{ maxWidth: settings.videoWidth }}>
              {(video.label || videos.length === 1) && <h2 className="mb-3 text-lg font-semibold tracking-tight">{video.label || "Livestream"}</h2>}
              {video.embedUrl ? (
                <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
                  <iframe
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="size-full"
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    src={video.embedUrl}
                    title={video.label || `Video ${currentIndex + index + 1}`}
                  />
                </div>
              ) : (
                <div className="py-4">
                  <a className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-white hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-4" href={video.sourceUrl} rel="noopener noreferrer" target="_blank">
                    Open video on its original site
                  </a>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
