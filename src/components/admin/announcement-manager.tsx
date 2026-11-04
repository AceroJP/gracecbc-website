"use client";

import Image from "next/image";
import { type FormEvent, useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
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
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  announcementCategoryOptions,
  announcementBucket,
  announcementImageMaxBytes,
  announcementMaxCategories,
  announcementMaxImages,
  announcementPdfMaxBytes,
  getAnnouncementCategoryLabel,
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
    background_url: string | null;
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

type AnnouncementFormChanges = {
  categories: string[];
  pdfFile: File | null;
  slideFiles: File[];
  removedSlidePaths: string[];
  removePdf: boolean;
  backgroundFile: File | null;
  removeBackground: boolean;
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
    changes?: AnnouncementFormChanges,
  ) => void;
}) {
  const prefix = useId();
  const [categories, setCategories] = useState<string[]>(
    announcement?.categories ?? [],
  );
  const [newCategory, setNewCategory] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [slideFiles, setSlideFiles] = useState<File[]>([]);
  const [removedSlidePaths, setRemovedSlidePaths] = useState<string[]>([]);
  const [removePdf, setRemovePdf] = useState(false);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [removeBackground, setRemoveBackground] = useState(false);

  function addCategory() {
    const category = newCategory.trim();
    if (
      !category ||
      categories.length >= announcementMaxCategories ||
      categories.some(
        (current) =>
          getAnnouncementCategoryLabel(current).toLocaleLowerCase() ===
          category.toLocaleLowerCase(),
      )
    ) {
      return;
    }

    setCategories((current) => [...current, category]);
    setNewCategory("");
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) =>
        onSubmit(event, announcement, {
          categories,
          pdfFile,
          slideFiles,
          removedSlidePaths,
          removePdf,
          backgroundFile,
          removeBackground,
        })
      }
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
        <FieldSet>
          <FieldLegend variant="label">Announcement labels</FieldLegend>
          <FieldGroup className="grid gap-3 sm:grid-cols-2">
            {announcementCategoryOptions.map((option) => (
              <Field
                className="items-center rounded-md border border-border p-3"
                key={option.value}
                orientation="horizontal"
              >
                <input
                  checked={categories.includes(option.value)}
                  className="size-4 shrink-0 accent-brand"
                  disabled={
                    categories.length >= announcementMaxCategories &&
                    !categories.includes(option.value)
                  }
                  id={`${prefix}-${option.value}`}
                  onChange={(event) =>
                    setCategories((current) =>
                      event.target.checked
                        ? [...current, option.value]
                        : current.filter((category) => category !== option.value),
                    )
                  }
                  type="checkbox"
                />
                <FieldLabel htmlFor={`${prefix}-${option.value}`}>
                  {option.label}
                </FieldLabel>
              </Field>
            ))}
          </FieldGroup>
          <FieldDescription>
            Select one or both built-in labels, or add your own. Each announcement
            appears as one card on the public page.
          </FieldDescription>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="Custom announcement label"
              maxLength={50}
              onChange={(event) => setNewCategory(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCategory();
                }
              }}
              placeholder="Add a label, e.g. Youth Fellowship"
              value={newCategory}
            />
            <Button
              disabled={
                !newCategory.trim() ||
                categories.length >= announcementMaxCategories ||
                categories.some(
                  (category) =>
                    getAnnouncementCategoryLabel(category).toLocaleLowerCase() ===
                    newCategory.trim().toLocaleLowerCase(),
                )
              }
              onClick={addCategory}
              type="button"
              variant="outline"
            >
              Add label
            </Button>
          </div>
          {categories.filter(
            (category) =>
              !announcementCategoryOptions.some(
                (option) => option.value === category,
              ),
          ).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {categories
                .filter(
                  (category) =>
                    !announcementCategoryOptions.some(
                      (option) => option.value === category,
                    ),
                )
                .map((category) => (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-brand/8 py-1 pr-1 pl-3 text-sm text-brand"
                    key={category}
                  >
                    {category}
                    <Button
                      aria-label={`Remove ${category} label`}
                      onClick={() =>
                        setCategories((current) =>
                          current.filter((item) => item !== category),
                        )
                      }
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <X />
                    </Button>
                  </span>
                ))}
            </div>
          )}
        </FieldSet>
        <Field>
          <FieldLabel htmlFor={`${prefix}-pdf`}>
            PowerPoint exported as PDF
          </FieldLabel>
          <Input
            accept=".pdf,application/pdf"
            id={`${prefix}-pdf`}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setPdfFile(file);
              if (file) {
                setSlideFiles([]);
              }
              event.target.value = "";
            }}
            type="file"
          />
          <FieldDescription>
            Upload one PDF up to 20 MB.
          </FieldDescription>
          {pdfFile && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
              <span className="truncate">{pdfFile.name}</span>
              <Button
                aria-label={`Remove selected PDF ${pdfFile.name}`}
                onClick={() => setPdfFile(null)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <X />
              </Button>
            </div>
          )}
          {announcement?.pdf_name && !removePdf && !pdfFile && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
              <span className="truncate">Current PDF: {announcement.pdf_name}</span>
              <Button
                aria-label={`Remove uploaded PDF ${announcement.pdf_name}`}
                onClick={() => setRemovePdf(true)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <X />
              </Button>
            </div>
          )}
          {removePdf && announcement?.pdf_name && (
            <p className="text-sm text-muted-foreground">
              The uploaded PDF will be removed when you save.
            </p>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor={`${prefix}-slides`}>
            Slide images (if not uploading a PDF)
          </FieldLabel>
          <Input
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            id={`${prefix}-slides`}
            multiple
            onChange={(event) => {
              const selected = Array.from(event.target.files ?? []);
              setSlideFiles((current) => [...current, ...selected]);
              setPdfFile(null);
              event.target.value = "";
            }}
            type="file"
          />
          <FieldDescription>
            Upload up to {announcementMaxImages} JPG, PNG, or WebP slides, each
            up to 5 MB. They appear in the order selected. Leave both file
            inputs empty when editing to keep the current presentation.
          </FieldDescription>
          {announcement?.slide_names.map((name, index) => {
            const path = announcement.slide_paths[index];
            if (!path || removedSlidePaths.includes(path) || pdfFile) {
              return null;
            }
            return (
              <div
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                key={path}
              >
                <span className="truncate">Current slide: {name}</span>
                <Button
                  aria-label={`Remove uploaded slide ${name}`}
                  onClick={() =>
                    setRemovedSlidePaths((current) => [...current, path])
                  }
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <X />
                </Button>
              </div>
            );
          })}
          {slideFiles.map((file, index) => (
            <div
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
              key={`${file.name}-${file.lastModified}-${index}`}
            >
              <span className="truncate">New slide: {file.name}</span>
              <Button
                aria-label={`Remove selected slide ${file.name}`}
                onClick={() =>
                  setSlideFiles((current) =>
                    current.filter((_, fileIndex) => fileIndex !== index),
                  )
                }
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <X />
              </Button>
            </div>
          ))}
          {removedSlidePaths.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {removedSlidePaths.length} existing{" "}
              {removedSlidePaths.length === 1 ? "slide" : "slides"} will be
              removed when you save.
            </p>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor={`${prefix}-background`}>
            Announcement card background image (optional)
          </FieldLabel>
          <Input
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            id={`${prefix}-background`}
            onChange={(event) => {
              setBackgroundFile(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
            type="file"
          />
          <FieldDescription>
            Choose a JPG, PNG, or WebP image up to 5 MB. A dark overlay is added
            so the announcement text remains readable.
          </FieldDescription>
          {announcement?.background_name && !removeBackground && !backgroundFile && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
              <span className="truncate">
                Current background: {announcement.background_name}
              </span>
              <Button
                aria-label={`Remove background image ${announcement.background_name}`}
                onClick={() => setRemoveBackground(true)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <X />
              </Button>
            </div>
          )}
          {(backgroundFile || removeBackground) && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
              <span className="truncate">
                {backgroundFile
                  ? `New background: ${backgroundFile.name}`
                  : "Background will be removed when you save."}
              </span>
              <Button
                aria-label="Clear background selection"
                onClick={() => {
                  setBackgroundFile(null);
                  setRemoveBackground(false);
                }}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <X />
              </Button>
            </div>
          )}
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
    changes?: AnnouncementFormChanges,
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
          key={`${announcement.id}-${open}`}
          announcement={announcement}
          onSubmit={(event, item, changes) => onSubmit(event, item, changes)}
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
    changes?: AnnouncementFormChanges,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    if (!changes) {
      return;
    }

    const pdfFile = changes.pdfFile;
    const slides = changes.slideFiles;

    if (pdfFile && slides.length > 0) {
      await Swal.fire({
        icon: "error",
        title: "Choose one presentation format",
        text: "Upload one PDF or a set of slide images, not both.",
        confirmButtonText: "Okay",
      });
      return;
    }

    if (
      (pdfFile &&
        !getAnnouncementFileExtension(pdfFile.name, pdfFile.type, pdfFile.size)) ||
      slides.length +
        (announcement?.slide_paths.filter(
          (path) => !changes.removedSlidePaths.includes(path),
        ).length ?? 0) >
        announcementMaxImages ||
      slides.some(
        (file) =>
          !getAnnouncementFileExtension(file.name, file.type, file.size),
      ) ||
      (changes.backgroundFile &&
        !getAnnouncementFileExtension(
          changes.backgroundFile.name,
          changes.backgroundFile.type,
          changes.backgroundFile.size,
        ))
    ) {
      await Swal.fire({
        icon: "error",
        title: "Check presentation files",
        text: `Use one PDF up to ${announcementPdfMaxBytes / (1024 * 1024)} MB or up to ${announcementMaxImages} JPG, PNG, or WebP slides, each up to ${announcementImageMaxBytes / (1024 * 1024)} MB. Background images must also be under ${announcementImageMaxBytes / (1024 * 1024)} MB.`,
        confirmButtonText: "Okay",
      });
      return;
    }

    const announcementId = announcement?.id ?? crypto.randomUUID();
    setSubmitting(true);
    let uploadedPaths: string[] = [];

    try {
      const uploadFiles = async (
        purpose: "presentation" | "background",
        files: File[],
      ) => {
        if (files.length === 0) {
          return [];
        }
        const uploadResponse = await beginAnnouncementUploadsAction({
          announcementId,
          purpose,
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
          uploadedPaths.push(upload.path);
        }
        return uploaded;
      };

      let presentation: PresentationUpload | null | undefined;
      const uploadedPresentation = await uploadFiles(
        "presentation",
        pdfFile ? [pdfFile] : slides,
      );
      if (pdfFile) {
        presentation = { type: "pdf", file: uploadedPresentation[0] };
      } else if (slides.length > 0) {
        presentation = {
          type: "images",
          files: [
            ...(announcement?.slide_paths.flatMap((path, index) =>
              changes.removedSlidePaths.includes(path) || announcement.pdf_path
                ? []
                : [{ path, name: announcement.slide_names[index] }],
            ) ?? []),
            ...uploadedPresentation,
          ],
        };
      } else if (
        changes.removedSlidePaths.length > 0 &&
        announcement?.slide_paths.length
      ) {
        const remainingSlides = announcement.slide_paths.flatMap(
          (path, index) =>
            changes.removedSlidePaths.includes(path)
              ? []
              : [{ path, name: announcement.slide_names[index] }],
        );
        presentation =
          remainingSlides.length > 0
            ? { type: "images", files: remainingSlides }
            : null;
      } else if (changes.removePdf && announcement?.pdf_path) {
        presentation = null;
      }

      const uploadedBackground = await uploadFiles(
        "background",
        changes.backgroundFile ? [changes.backgroundFile] : [],
      );
      const background = changes.backgroundFile
        ? uploadedBackground[0]
        : changes.removeBackground
          ? null
          : undefined;
      const content = {
        title: String(formData.get("title") ?? ""),
        body: String(formData.get("body") ?? ""),
        categories: changes.categories,
        presentation,
        background,
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
      title: archived ? "Restore announcement?" : "Hide announcement?",
      text: archived
        ? "This announcement will be visible on the public website again."
        : "This announcement will be hidden from the public website. Its presentation files will be retained.",
      showCancelButton: true,
      confirmButtonText: archived ? "Restore" : "Hide announcement",
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
        title: archived ? "Announcement restored" : "Announcement hidden",
        text: archived
          ? "The announcement is live on the public website."
          : "The announcement is now hidden from the landing page. You can restore it later.",
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
                  : announcement.slide_paths.length > 0
                    ? `${announcement.slide_paths.length} image slides`
                    : "No presentation attached"}
                {announcement.categories.length > 0
                  ? ` · ${announcement.categories
                      .map(getAnnouncementCategoryLabel)
                      .join(", ")}`
                  : ""}
                {announcement.background_name ? " · Card background set" : ""}
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
                {archived ? "Restore" : "Hide"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {announcement.body && (
              <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
                {announcement.body}
              </p>
            )}
            {announcement.background_url ? (
              <div className="relative aspect-video max-w-xl overflow-hidden rounded-lg bg-muted">
                <Image
                  alt={`${announcement.title} background preview`}
                  className="object-cover"
                  fill
                  src={announcement.background_url}
                  unoptimized
                />
              </div>
            ) : announcement.slide_urls[0] ? (
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
                {announcement.pdf_name ?? "Text-only announcement"}
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
