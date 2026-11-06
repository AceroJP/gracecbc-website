"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Presentation } from "lucide-react";
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
  hasBackground = false,
}: {
  announcement: PublicAnnouncement;
  hasBackground?: boolean;
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
          <Button
            className="mt-5 w-full sm:w-fit"
            type="button"
            variant={hasBackground ? "secondary" : "outline"}
          />
        }
      >
        <Presentation data-icon="inline-start" />
        View announcement
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
            <iframe
              className="hidden h-[min(72dvh,800px)] w-full rounded-lg border border-border bg-muted md:block"
              src={`${announcement.presentation_url}#toolbar=1&navpanes=0&view=FitH`}
              title={`${announcement.title} presentation`}
            />
            <Button
              className="w-full md:hidden"
              render={
                <a
                  href={announcement.presentation_url}
                  rel="noreferrer"
                  target="_blank"
                />
              }
              type="button"
              variant="outline"
            >
              Open PDF to view all pages
            </Button>
            <a
              className="hidden w-fit text-sm font-medium text-primary underline-offset-4 hover:underline md:block"
              href={announcement.presentation_url}
              rel="noreferrer"
              target="_blank"
            >
              Open PDF presentation in a new tab
              {announcement.presentation_name
                ? ` (${announcement.presentation_name})`
                : ""}
            </a>
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
            <div className="relative flex min-h-56 items-center justify-center overflow-hidden rounded-xl bg-muted p-3 sm:min-h-96 sm:p-6">
              <Image
                alt={`${announcement.title}, slide ${slideIndex + 1} of ${totalSlides}`}
                className="max-h-[65dvh] w-full object-contain"
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
