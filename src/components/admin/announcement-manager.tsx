"use client";

import Image from "next/image";
import { type FormEvent, useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Archive,
  FileImage,
  FileText,
  Plus,
  RotateCcw,
} from "lucide-react";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
  announcementPresentationOptions,
  announcementPowerPointMaxBytes,
  getAnnouncementPresentationType,
  getAnnouncementCategoryLabel,
  getAnnouncementFileExtension,
  type AnnouncementPresentationType,
} from "@/lib/announcements";
import {
  archiveAnnouncementAction,
  beginAnnouncementUploadsAction,
  cleanupAnnouncementUploadsAction,
  convertAnnouncementPowerPointAction,
  createAnnouncementAction,
  restoreAnnouncementAction,
  updateAnnouncementAction,
} from "@/app/admin/announcements/actions";
import { createClient } from "@/lib/supabase/client";
import { showLoadingAlert } from "@/lib/sweet-alert";
import type { Database } from "@/types/database.types";

export type AdminAnnouncement =
  Database["public"]["Tables"]["announcements"]["Row"] & {
    presentation_url: string | null;
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
  presentationType: AnnouncementPresentationType;
  presentationFiles: File[];
  removedSlidePaths: string[];
  removePresentation: boolean;
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
  const [presentationType, setPresentationType] =
    useState<AnnouncementPresentationType>(() =>
      getAnnouncementPresentationType(
        announcement?.pdf_path ?? null,
        announcement?.slide_paths ?? [],
      ),
    );
  const [presentationFiles, setPresentationFiles] = useState<File[]>([]);
  const [removedSlidePaths, setRemovedSlidePaths] = useState<string[]>([]);
  const [removePresentation, setRemovePresentation] = useState(false);
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
          presentationType,
          presentationFiles,
          removedSlidePaths,
          removePresentation,
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
          <FieldLabel htmlFor={`${prefix}-presentation-type`}>
            Presentation file type
          </FieldLabel>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            id={`${prefix}-presentation-type`}
            onChange={(event) => {
              const nextType = announcementPresentationOptions.find(
                (option) => option.value === event.target.value,
              );
              if (nextType) {
                setPresentationType(nextType.value);
                setPresentationFiles([]);
              }
            }}
            value={presentationType}
          >
            {announcementPresentationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <FieldLabel htmlFor={`${prefix}-presentation-files`}>
            Presentation file
          </FieldLabel>
          <Input
            accept={
              presentationType === "pdf"
                ? ".pdf,application/pdf"
                : presentationType === "powerpoint"
                  ? ".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  : ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            }
            id={`${prefix}-presentation-files`}
            multiple={presentationType === "images"}
            onChange={(event) => {
              setPresentationFiles(Array.from(event.target.files ?? []));
              setRemovePresentation(false);
              event.target.value = "";
            }}
            type="file"
          />
          <FieldDescription>
            {presentationType === "pdf"
              ? `Upload one PDF up to ${announcementPdfMaxBytes / (1024 * 1024)} MB.`
              : presentationType === "powerpoint"
                ? `Upload one .ppt or .pptx file up to ${announcementPowerPointMaxBytes / (1024 * 1024)} MB. It will be converted to a PDF for automatic display; the original PowerPoint will be discarded.`
                : `Upload up to ${announcementMaxImages} JPG, PNG, or WebP slides, each up to ${announcementImageMaxBytes / (1024 * 1024)} MB. They appear in selection order.`}
            {announcement &&
              (announcement.pdf_path &&
              /\.(ppt|pptx)$/i.test(announcement.pdf_path) &&
              presentationType === "powerpoint"
                ? " Saving this announcement will convert its existing PowerPoint to PDF."
                : " Leave this empty when editing to keep the current presentation.")}
          </FieldDescription>
          {presentationFiles.map((file, index) => (
            <div
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
              key={`${file.name}-${file.lastModified}-${index}`}
            >
              <span className="truncate">
                {presentationType === "images" ? "New slide: " : ""}
                {file.name}
              </span>
              <Button
                aria-label={`Remove selected file ${file.name}`}
                onClick={() =>
                  setPresentationFiles((current) =>
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
          {announcement?.pdf_name &&
          announcement.pdf_path &&
          !removePresentation &&
          presentationFiles.length === 0 ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
              <span className="truncate">
                Current{" "}
                {getAnnouncementPresentationType(
                  announcement.pdf_path,
                  [],
                ) === "powerpoint"
                  ? "PowerPoint"
                  : "PDF"}
                : {announcement.pdf_name}
              </span>
              <Button
                aria-label={`Remove uploaded presentation ${announcement.pdf_name}`}
                onClick={() => setRemovePresentation(true)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <X />
              </Button>
            </div>
          ) : null}
          {removePresentation && announcement?.pdf_name && (
            <p className="text-sm text-muted-foreground">
              The uploaded presentation will be removed when you save.
            </p>
          )}
          {announcement?.slide_names.map((name, index) => {
            const path = announcement.slide_paths[index];
            if (
              !path ||
              presentationType !== "images" ||
              removedSlidePaths.includes(path) ||
              announcement.pdf_path
            ) {
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
            Update the announcement or replace its presentation file.
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
  const [createOpen, setCreateOpen] = useState(false);

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

    const presentationFiles = changes.presentationFiles;
    const slides =
      changes.presentationType === "images" ? presentationFiles : [];

    if (
      (changes.presentationType === "images" &&
        slides.length +
          (announcement?.slide_paths.filter(
            (path) => !changes.removedSlidePaths.includes(path),
          ).length ?? 0) >
          announcementMaxImages) ||
      (changes.presentationType !== "images" && presentationFiles.length > 1) ||
      presentationFiles.some(
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
        text: `Use one PDF or PowerPoint file up to ${Math.max(announcementPdfMaxBytes, announcementPowerPointMaxBytes) / (1024 * 1024)} MB, or up to ${announcementMaxImages} JPG, PNG, or WebP slides, each up to ${announcementImageMaxBytes / (1024 * 1024)} MB. Background images must also be under ${announcementImageMaxBytes / (1024 * 1024)} MB.`,
        confirmButtonText: "Okay",
      });
      return;
    }

    const announcementId = announcement?.id ?? crypto.randomUUID();
    setSubmitting(true);
    let uploadedPaths: string[] = [];
    const temporaryPowerPointPaths: string[] = [];
    let conversionCleanupWarning = false;
    const totalUploads = presentationFiles.length + (changes.backgroundFile ? 1 : 0);
    let completedUploads = 0;

    showLoadingAlert(
      announcement ? "Saving announcement" : "Publishing announcement",
      totalUploads > 0
        ? "Preparing secure file uploads..."
        : "Saving your announcement...",
    );

    try {
      const uploadFiles = async (
        purpose: "presentation" | "background",
        files: File[],
      ) => {
        if (files.length === 0) {
          return [];
        }
        Swal.update({
          text:
            purpose === "background"
              ? "Preparing announcement background upload..."
              : "Preparing presentation uploads...",
        });
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
          Swal.update({
            text: `Uploading file ${completedUploads + 1} of ${totalUploads}: ${file.name}`,
          });
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
          completedUploads += 1;
        }
        return uploaded;
      };

      let presentation: PresentationUpload | null | undefined;
      let uploadedPresentation = await uploadFiles(
        "presentation",
        presentationFiles,
      );
      const hasNewPowerPoint =
        changes.presentationType === "powerpoint" &&
        uploadedPresentation.length > 0;
      let existingPowerPointFile: { path: string; name: string } | null = null;
      if (
        !hasNewPowerPoint &&
        changes.presentationType === "powerpoint" &&
        presentationFiles.length === 0 &&
        !changes.removePresentation &&
        announcement?.pdf_path &&
        /\.(ppt|pptx)$/i.test(announcement.pdf_path)
      ) {
        existingPowerPointFile = {
          path: announcement.pdf_path,
          name: announcement.pdf_name ?? announcement.pdf_path,
        };
      }
      if (hasNewPowerPoint || existingPowerPointFile) {
        const sourceFile = uploadedPresentation[0] ?? existingPowerPointFile;
        if (!sourceFile) {
          throw new Error("Select a PowerPoint file to convert.");
        }
        Swal.update({
          text: `Converting ${sourceFile.name} to a display-ready PDF...`,
        });
        const conversion = await convertAnnouncementPowerPointAction(
          announcementId,
          sourceFile,
        );
        if (conversion.status === "error") {
          throw new Error(conversion.message);
        }

        if (hasNewPowerPoint) {
          temporaryPowerPointPaths.push(sourceFile.path);
        }
        uploadedPaths.push(conversion.file.path);
        uploadedPresentation = [conversion.file];
        conversionCleanupWarning = conversion.cleanupWarning;
      }
      if (slides.length > 0) {
        presentation = {
          type: "images",
          files: [
            ...(announcement?.slide_paths.flatMap((path, index) =>
              changes.removedSlidePaths.includes(path) ||
              announcement.pdf_path
                ? []
                : [{ path, name: announcement.slide_names[index] }],
            ) ?? []),
            ...uploadedPresentation,
          ],
        };
      } else if (
        uploadedPresentation.length > 0 &&
        changes.presentationType !== "images"
      ) {
        presentation = {
          type: "pdf",
          file: uploadedPresentation[0],
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
      } else if (
        changes.removePresentation &&
        announcement?.pdf_path
      ) {
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
      Swal.update({
        text: announcement
          ? "Saving your announcement changes..."
          : "Publishing your announcement...",
      });
      const result = announcement
        ? await updateAnnouncementAction(announcementId, content)
        : await createAnnouncementAction(announcementId, content);

      if (result.status === "error") {
        throw new Error(result.message);
      }

      if (temporaryPowerPointPaths.length > 0) {
        Swal.update({ text: "Removing the temporary PowerPoint upload..." });
        try {
          const cleanup = await cleanupAnnouncementUploadsAction(
            announcementId,
            temporaryPowerPointPaths,
          );
          if (cleanup.status === "error") {
            conversionCleanupWarning = true;
          } else {
            uploadedPaths = uploadedPaths.filter(
              (path) => !temporaryPowerPointPaths.includes(path),
            );
          }
        } catch (cleanupError) {
          conversionCleanupWarning = true;
          console.error(
            "The temporary PowerPoint could not be removed.",
            cleanupError,
          );
        }
      }
      uploadedPaths = [];
      Swal.close();
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
        setCreateOpen(false);
      }
      router.refresh();
      const cleanupWarning =
        conversionCleanupWarning ||
        ("cleanupWarning" in result && result.cleanupWarning);
      await Swal.fire({
        icon: "success",
        title: announcement ? "Announcement updated" : "Announcement published",
        text: cleanupWarning
          ? "The announcement was saved, but a temporary or previous file could not be removed. Please contact support."
          : announcement
            ? "Your announcement changes are live."
            : "Your announcement is now available on the public website.",
        confirmButtonText: "Okay",
      });
    } catch (error) {
      console.error("Announcement save request failed.", error);
      let cleanupFailed = false;
      if (uploadedPaths.length > 0) {
        Swal.update({ text: "Cleaning up incomplete uploads..." });
        try {
          const cleanup = await cleanupAnnouncementUploadsAction(
            announcementId,
            uploadedPaths,
          );
          cleanupFailed = cleanup.status === "error";
          if (cleanupFailed) {
            console.error("Uploaded announcement files could not be cleaned up.");
          }
        } catch (cleanupError) {
          cleanupFailed = true;
          console.error(
            "Uploaded announcement files could not be cleaned up.",
            cleanupError,
          );
        }
      }
      Swal.close();
      await Swal.fire({
        icon: "error",
        title: "Unable to save announcement",
        text:
          `${
            error instanceof Error
              ? error.message
              : "We couldn’t save this announcement. Please try again."
          }${
            cleanupFailed
              ? " Some uploaded files could not be cleaned up; please contact support."
              : ""
          }`,
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

    showLoadingAlert(
      archived ? "Restoring announcement" : "Hiding announcement",
      "Please wait while we update the public announcement...",
    );
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
      <div className="flex justify-end">
        <Dialog onOpenChange={setCreateOpen} open={createOpen}>
          <DialogTrigger render={<Button type="button" />}>
            <Plus data-icon="inline-start" />
            Publish announcement
          </DialogTrigger>
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Publish an announcement</DialogTitle>
              <DialogDescription>
                Choose PDF, PowerPoint, or image slides as the presentation
                format. PowerPoint files are converted to PDF for inline display,
                and the original file is discarded after saving.
              </DialogDescription>
            </DialogHeader>
          <AnnouncementForm
            key={createKey}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
          </DialogContent>
        </Dialog>
      </div>

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
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium" scope="col">Announcement</th>
              <th className="px-5 py-3 font-medium" scope="col">Presentation</th>
              <th className="px-5 py-3 font-medium" scope="col">Labels</th>
              <th className="px-5 py-3 font-medium" scope="col">Published</th>
              <th className="px-5 py-3 font-medium" scope="col">Status</th>
              <th className="px-5 py-3 text-right font-medium" scope="col">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {announcements.map((announcement) => (
              <tr className="align-top" key={announcement.id}>
                <th className="max-w-72 px-5 py-4 font-medium" scope="row">
                  <div className="flex items-start gap-3">
                    {(announcement.background_url || announcement.slide_urls[0]) && (
                      <span className="relative mt-0.5 size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                        <Image
                          alt=""
                          className="object-cover"
                          fill
                          src={announcement.background_url ?? announcement.slide_urls[0]}
                          unoptimized
                        />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block">{announcement.title}</span>
                      {announcement.body && (
                        <span className="mt-1 line-clamp-2 block whitespace-pre-line text-xs leading-5 text-muted-foreground">
                          {announcement.body}
                        </span>
                      )}
                    </span>
                  </div>
                </th>
                <td className="max-w-56 px-5 py-4 text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <FileText aria-hidden="true" className="size-4 shrink-0" />
                    {announcement.pdf_path
                      ? announcement.pdf_name
                      : announcement.slide_paths.length > 0
                        ? `${announcement.slide_paths.length} image slides`
                        : "No presentation"}
                  </span>
                  {announcement.background_name && (
                    <span className="mt-1 block text-xs">Card background set</span>
                  )}
                </td>
                <td className="max-w-48 px-5 py-4 text-muted-foreground">
                  {announcement.categories.length > 0
                    ? announcement.categories
                        .map(getAnnouncementCategoryLabel)
                        .join(", ")
                    : "—"}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">
                  {new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  }).format(new Date(announcement.created_at))}
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <span className={archived ? "text-muted-foreground" : "text-primary"}>
                    {archived ? "Hidden" : "Published"}
                  </span>
                  {announcement.archived_at && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("en", {
                        dateStyle: "medium",
                        timeZone: "UTC",
                      }).format(new Date(announcement.archived_at))}
                    </span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap justify-end gap-2">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
