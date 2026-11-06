"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AnnouncementPresentationType } from "@/lib/announcements";
import type { ReactNode } from "react";

const AnnouncementPdfViewer = dynamic(
  () => import("./announcement-pdf-viewer"),
  {
    ssr: false,
    loading: () => (
      <p className="p-4 text-center text-sm text-muted-foreground">
        Loading PDF viewer…
      </p>
    ),
  },
);

export type PublicAnnouncement = {
  id: string;
  title: string;
  body: string;
  presentation_name: string | null;
  presentation_type: AnnouncementPresentationType | null;
  presentation_url: string | null;
  slide_names: string[];
  slide_urls: string[];
  categories: string[];
  background_url: string | null;
};

export function AnnouncementViewer({
  announcement,
  children,
}: {
  announcement: PublicAnnouncement;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const totalSlides = announcement.slide_urls.length;

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setSlideIndex(0);
        }
      }}
      open={open}
    >
      <DialogTrigger
        render={
          <button
            aria-label={`View announcement: ${announcement.title}`}
            className="group/card block h-full w-full cursor-pointer rounded-xl border-0 bg-transparent p-0 text-left text-inherit focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            type="button"
          />
        }
      >
        {children}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{announcement.title}</DialogTitle>
          {announcement.body && (
            <DialogDescription className="whitespace-pre-line">
              {announcement.body}
            </DialogDescription>
          )}
        </DialogHeader>

        {announcement.presentation_type === "pdf" &&
        announcement.presentation_url ? (
          <div className="grid gap-3">
            <AnnouncementPdfViewer
              title={announcement.title}
              url={announcement.presentation_url}
            />
          </div>
        ) : announcement.presentation_type === "powerpoint" &&
          announcement.presentation_url ? (
          <div className="grid gap-3 rounded-lg border border-border bg-muted/40 p-6">
            <p className="text-sm text-muted-foreground">
              PowerPoint files can be opened or downloaded on your device.
            </p>
            <a
              className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline"
              download={announcement.presentation_name ?? true}
              href={announcement.presentation_url}
              rel="noreferrer"
              target="_blank"
            >
              Download PowerPoint
              {announcement.presentation_name
                ? ` (${announcement.presentation_name})`
                : ""}
            </a>
          </div>
        ) : totalSlides > 0 ? (
          <div className="grid gap-4">
            <div className="relative flex max-h-[80dvh] items-center justify-center overflow-hidden rounded-xl bg-muted">
              <Image
                alt={`${announcement.title}, slide ${slideIndex + 1} of ${totalSlides}`}
                className="h-auto max-h-[80dvh] w-auto max-w-full object-contain"
                height={1080}
                src={announcement.slide_urls[slideIndex]}
                unoptimized
                width={1920}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Button
                disabled={slideIndex === 0}
                onClick={() => setSlideIndex((index) => index - 1)}
                type="button"
                variant="outline"
              >
                <ChevronLeft data-icon="inline-start" />
                Previous
              </Button>
              <p aria-live="polite" className="text-sm text-muted-foreground">
                Slide {slideIndex + 1} of {totalSlides}
              </p>
              <Button
                disabled={slideIndex === totalSlides - 1}
                onClick={() => setSlideIndex((index) => index + 1)}
                type="button"
                variant="outline"
              >
                Next
                <ChevronRight data-icon="inline-end" />
              </Button>
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No presentation slides are available.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
