"use client";

import Image from "next/image";
import { type FormEvent, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ChevronRight,
  FileImage,
  FileText,
  RotateCcw,
} from "lucide-react";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  announcementBucket,
  announcementImageMaxBytes,
  announcementMaxImages,
  announcementPdfMaxBytes,
  getAnnouncementFileExtension,
} from "@/lib/announcements";
import {
  archiveAnnouncementAction,
  beginAnnouncementUploadsAction,
  cleanupAnnouncementUploadsAction,
  createAnnouncementAction,
  restoreAnnouncementAction,
  updateAnnouncementAction,
} from "@/app/admin/announcements/actions";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

export type AdminAnnouncement =
  Database["public"]["Tables"]["announcements"]["Row"] & {
    pdf_url: string | null;
    slide_urls: string[];
  };

type PresentationUpload =
  | {
      type: "pdf";
      file: { path: string; name: string };
    }
  | {
      type: "images";
      files: { path: string; name: string }[];
    };

function AnnouncementForm({
  announcement,
  submitting,
  onSubmit,
}: {
  announcement?: AdminAnnouncement;
  submitting: boolean;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
    announcement?: AdminAnnouncement,
  ) => void;
}) {
  const prefix = useId();
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const slideInputRef = useRef<HTMLInputElement>(null);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => onSubmit(event, announcement)}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${prefix}-title`}>Announcement title</FieldLabel>
          <Input
            defaultValue={announcement?.title}
            id={`${prefix}-title`}
            maxLength={160}
            name="title"
            placeholder="e.g. Sunday worship and prayer meeting"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${prefix}-body`}>Details (optional)</FieldLabel>
          <Textarea
            className="min-h-24"
            defaultValue={announcement?.body}
            id={`${prefix}-body`}
            maxLength={3000}
            name="body"
            placeholder="Add a short description or instructions."
            rows={4}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${prefix}-pdf`}>
            PowerPoint exported as PDF
          </FieldLabel>
          <Input
            accept=".pdf,application/pdf"
            id={`${prefix}-pdf`}
            name="pdf"
            ref={pdfInputRef}
            type="file"
          />
          <FieldDescription>
            Upload one PDF up to 20 MB.
            {announcement?.pdf_name && ` Current presentation: ${announcement.pdf_name}.`}
            {announcement?.slide_names.length
              ? ` Current presentation has ${announcement.slide_names.length} image slides.`
              : ""}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${prefix}-slides`}>
            Slide images (if not uploading a PDF)
          </FieldLabel>
          <Input
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            id={`${prefix}-slides`}
            multiple
            name="slides"
            ref={slideInputRef}
            type="file"
          />
          <FieldDescription>
            Upload up to {announcementMaxImages} JPG, PNG, or WebP slides, each
            up to 5 MB. They appear in the order selected. Leave both file
            inputs empty when editing to keep the current presentation.
          </FieldDescription>
        </Field>
      </FieldGroup>
      <Button className="w-fit" disabled={submitting} type="submit">
        {submitting
          ? "Saving announcement..."
          : announcement
            ? "Save changes"
            : "Publish announcement"}
      </Button>
    </form>
  );
}

function AnnouncementEditDialog({
  announcement,
  onSubmit,
  submitting,
}: {
  announcement: AdminAnnouncement;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
    announcement?: AdminAnnouncement,
  ) => void;
  submitting: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={<Button size="sm" type="button" variant="outline" />}
      >
        Edit
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit announcement</DialogTitle>
          <DialogDescription>
            Update the announcement or replace its PDF or image slides.
          </DialogDescription>
        </DialogHeader>
        <AnnouncementForm
          announcement={announcement}
          onSubmit={(event, item) => onSubmit(event, item)}
          submitting={submitting}
        />
      </DialogContent>
    </Dialog>
  );
}

export function AnnouncementManager({
  announcements,
}: {
  announcements: AdminAnnouncement[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [createKey, setCreateKey] = useState(0);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
    announcement?: AdminAnnouncement,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const pdfFile = formData.get("pdf");
    const slides = formData.getAll("slides").filter(
      (file): file is File => file instanceof File && file.size > 0,
    );
    const selectedPdf =
      pdfFile instanceof File && pdfFile.size > 0 ? pdfFile : null;

    if (selectedPdf && slides.length > 0) {
      await Swal.fire({
        icon: "error",
        title: "Choose one presentation format",
        text: "Upload one PDF or a set of slide images, not both.",
        confirmButtonText: "Okay",
      });
      return;
    }

    if (!announcement && !selectedPdf && slides.length === 0) {
      await Swal.fire({
        icon: "error",
        title: "Presentation required",
        text: "Upload a PDF presentation or at least one slide image.",
        confirmButtonText: "Okay",
      });
      return;
    }

    if (
      (selectedPdf &&
        !getAnnouncementFileExtension(
          selectedPdf.name,
          selectedPdf.type,
          selectedPdf.size,
        )) ||
      slides.length > announcementMaxImages ||
      slides.some(
        (file) =>
          !getAnnouncementFileExtension(file.name, file.type, file.size),
      )
    ) {
      await Swal.fire({
        icon: "error",
        title: "Check presentation files",
        text: `Use one PDF up to ${announcementPdfMaxBytes / (1024 * 1024)} MB or up to ${announcementMaxImages} JPG, PNG, or WebP images, each up to ${announcementImageMaxBytes / (1024 * 1024)} MB.`,
        confirmButtonText: "Okay",
      });
      return;
    }

    const files = selectedPdf ? [selectedPdf] : slides;
    const announcementId = announcement?.id ?? crypto.randomUUID();
    setSubmitting(true);
    let uploadedPaths: string[] = [];

    try {
      let presentation: PresentationUpload | undefined;
      if (files.length > 0) {
        const uploadResponse = await beginAnnouncementUploadsAction({
          announcementId,
          files: files.map((file) => ({
            name: file.name,
            size: file.size,
            contentType: file.type,
          })),
        });

        if (uploadResponse.status === "error") {
          throw new Error(uploadResponse.message);
        }

        const supabase = createClient();
        const uploaded = [];
        for (const [index, upload] of uploadResponse.uploads.entries()) {
          const file = files[index];
          const { error } = await supabase.storage
            .from(announcementBucket)
            .uploadToSignedUrl(upload.path, upload.token, file, {
              cacheControl: "3600",
              contentType: file.type,
            });
          if (error) {
            console.error("Unable to upload announcement presentation file.", error);
            throw new Error("We couldn’t upload the presentation. Please try again.");
          }
          uploaded.push({ path: upload.path, name: upload.name });
          uploadedPaths = uploaded.map(({ path }) => path);
        }

        presentation = selectedPdf
          ? { type: "pdf", file: uploaded[0] }
          : { type: "images", files: uploaded };
      }

      const content = {
        title: String(formData.get("title") ?? ""),
        body: String(formData.get("body") ?? ""),
        presentation,
      };
      const result = announcement
        ? await updateAnnouncementAction(announcementId, content)
        : await createAnnouncementAction(announcementId, content);

      if (result.status === "error") {
        throw new Error(result.message);
      }

      uploadedPaths = [];
      if (announcement) {
        const dialog = form.closest('[data-slot="dialog-content"]');
        if (dialog) {
          const closeButton = dialog.querySelector<HTMLButtonElement>(
            '[data-slot="dialog-close"]',
          );
          closeButton?.click();
        }
      } else {
        setCreateKey((key) => key + 1);
      }
      router.refresh();
      await Swal.fire({
        icon: "success",
        title: announcement ? "Announcement updated" : "Announcement published",
        text:
          "cleanupWarning" in result && result.cleanupWarning
            ? "The announcement was saved, but old presentation files could not be removed."
            : announcement
              ? "Your announcement changes are live."
              : "Your announcement is now available on the public website.",
        confirmButtonText: "Okay",
      });
    } catch (error) {
      console.error("Announcement save request failed.", error);
      if (uploadedPaths.length > 0) {
        const cleanup = await cleanupAnnouncementUploadsAction(
          announcementId,
          uploadedPaths,
        );
        if (cleanup.status === "error") {
          console.error("Uploaded announcement files could not be cleaned up.");
        }
      }
      await Swal.fire({
        icon: "error",
        title: "Unable to save announcement",
        text:
          error instanceof Error
            ? error.message
            : "We couldn’t save this announcement. Please try again.",
        confirmButtonText: "Okay",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(
    announcement: AdminAnnouncement,
    archived: boolean,
  ) {
    const confirmation = await Swal.fire({
      icon: "warning",
      title: archived ? "Restore announcement?" : "Archive announcement?",
      text: archived
        ? "This announcement will be visible on the public website again."
        : "This announcement will be hidden from the public website. Its presentation files will be retained.",
      showCancelButton: true,
      confirmButtonText: archived ? "Restore" : "Archive",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    });
    if (!confirmation.isConfirmed) {
      return;
    }

    try {
      const result = archived
        ? await restoreAnnouncementAction(announcement.id)
        : await archiveAnnouncementAction(announcement.id);
      if (result.status === "error") {
        throw new Error(result.message);
      }
      router.refresh();
      await Swal.fire({
        icon: "success",
        title: archived ? "Announcement restored" : "Announcement archived",
        text: archived
          ? "The announcement is live on the public website."
          : "The announcement is now hidden from the public website.",
        confirmButtonText: "Okay",
      });
    } catch (error) {
      console.error("Announcement status update failed.", error);
      await Swal.fire({
        icon: "error",
        title: "Unable to update announcement",
        text:
          error instanceof Error
            ? error.message
            : "Please try again.",
        confirmButtonText: "Okay",
      });
    }
  }

  const published = announcements.filter((announcement) => !announcement.archived_at);
  const archived = announcements.filter((announcement) => announcement.archived_at);

  return (
    <div className="grid gap-10">
      <Card>
        <CardHeader>
          <CardTitle>Publish an announcement</CardTitle>
          <CardDescription>
            Upload a PowerPoint exported as PDF, or upload slide images to create
            a slideshow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AnnouncementForm
            key={createKey}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        </CardContent>
      </Card>

      <section aria-labelledby="published-announcements-heading">
        <div className="mb-4">
          <h2
            className="text-lg font-semibold tracking-tight"
            id="published-announcements-heading"
          >
            Published announcements
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {published.length}{" "}
            {published.length === 1 ? "announcement" : "announcements"}
          </p>
        </div>
        <AnnouncementList
          announcements={published}
          onStatusChange={handleStatusChange}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      </section>

      {archived.length > 0 && (
        <section aria-labelledby="archived-announcements-heading">
          <div className="mb-4">
            <h2
              className="text-lg font-semibold tracking-tight"
              id="archived-announcements-heading"
            >
              Archived announcements
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Archived announcements stay available here and can be restored.
            </p>
          </div>
          <AnnouncementList
            announcements={archived}
            archived
            onStatusChange={handleStatusChange}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        </section>
      )}
    </div>
  );
}

function AnnouncementList({
  announcements,
  archived = false,
  onStatusChange,
  onSubmit,
  submitting,
}: {
  announcements: AdminAnnouncement[];
  archived?: boolean;
  submitting: boolean;
  onStatusChange: (
    announcement: AdminAnnouncement,
    archived: boolean,
  ) => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
    announcement?: AdminAnnouncement,
  ) => void;
}) {
  if (announcements.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <FileImage
            aria-hidden="true"
            className="mx-auto size-8 text-muted-foreground"
          />
          <p className="mt-3 text-sm font-medium">
            {archived ? "No archived announcements" : "No announcements yet"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {archived
              ? "Announcements you archive will appear here."
              : "Publish an announcement above to show it on the public homepage."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {announcements.map((announcement) => (
        <Card key={announcement.id}>
          <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between">
            <div className="grid gap-1">
              <CardTitle>{announcement.title}</CardTitle>
              <CardDescription>
                {announcement.pdf_path
                  ? `PDF presentation: ${announcement.pdf_name}`
                  : `${announcement.slide_paths.length} image slides`}
                {" · "}
                {new Intl.DateTimeFormat("en", {
                  dateStyle: "medium",
                  timeZone: "UTC",
                }).format(new Date(announcement.created_at))}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <AnnouncementEditDialog
                announcement={announcement}
                onSubmit={onSubmit}
                submitting={submitting}
              />
              <Button
                onClick={() => onStatusChange(announcement, archived)}
                size="sm"
                type="button"
                variant="outline"
              >
                {archived ? (
                  <RotateCcw data-icon="inline-start" />
                ) : (
                  <Archive data-icon="inline-start" />
                )}
                {archived ? "Restore" : "Archive"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {announcement.body && (
              <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
                {announcement.body}
              </p>
            )}
            {announcement.slide_urls[0] ? (
              <div className="relative aspect-video max-w-xl overflow-hidden rounded-lg bg-muted">
                <Image
                  alt={`${announcement.title} first slide preview`}
                  className="object-contain"
                  fill
                  src={announcement.slide_urls[0]}
                  unoptimized
                />
              </div>
            ) : (
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <FileText aria-hidden="true" className="size-4" />
                {announcement.pdf_name}
              </p>
            )}
            {announcement.archived_at && (
              <p className="text-xs text-muted-foreground">
                Archived{" "}
                {new Intl.DateTimeFormat("en", {
                  dateStyle: "medium",
                  timeZone: "UTC",
                }).format(new Date(announcement.archived_at))}
              </p>
            )}
            <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <ChevronRight aria-hidden="true" className="size-3" />
              {archived ? "Hidden from the public website" : "Visible on the public website"}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
