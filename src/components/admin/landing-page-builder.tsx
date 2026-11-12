"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import {
  discardLandingPageDraftAction,
  publishLandingPageAction,
  saveLandingPageDraftAction,
  uploadLandingPageImageAction,
} from "@/app/admin/landing-page/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { showLoadingAlert } from "@/lib/sweet-alert";
import {
  getYouTubeVideoEmbedUrl,
  getDefaultLandingPageContent,
  parseLandingPageContent,
  resetLandingPageSection,
  type LandingPageContent,
  type LandingPageNavigationKey,
  type LandingPageSectionKey,
} from "@/lib/landing-page";

const sectionTitles: Record<LandingPageSectionKey, string> = {
  hero: "Hero",
  welcome: "Welcome message",
  schedule: "Worship schedule",
  livestream: "Livestream",
  announcements: "Announcements",
  events: "Events",
  devotionals: "Devotionals",
  contact: "Contact and location",
};

type Props = {
  draft: LandingPageContent;
  published: LandingPageContent;
  imageUrls: Record<string, string | null>;
  publishedImageUrls: Record<string, string | null>;
  announcements: Array<{ id: string; title: string }>;
};

type ImageSlot =
  | "hero"
  | "welcome"
  | "header-logo"
  | `background:${LandingPageSectionKey}`;
type ScheduleRow = LandingPageContent["schedule"]["rows"][number];
type ActionResponse = Awaited<ReturnType<typeof saveLandingPageDraftAction>>;

const navigationTitles: Record<LandingPageNavigationKey, string> = {
  events: "Events",
  schedules: "Schedules",
  livestream: "Livestream",
  devotionals: "Devotionals",
  contact: "Contact",
};

function isActionError(result: ActionResponse): result is Extract<ActionResponse, { status: "error" }> {
  return result.status === "error";
}

function imageFieldPath(slot: ImageSlot) {
  if (slot === "hero" || slot === "welcome") return `${slot}.image`;
  if (slot === "header-logo") return "header.logo";
  return `sectionBackgrounds.${slot.slice("background:".length)}.image`;
}

function FieldMessages({ messages }: { messages?: string[] }) {
  return messages?.length ? <FieldError>{messages.join(" ")}</FieldError> : null;
}

async function confirmAction(title: string, text: string, confirmButtonText: string) {
  const result = await Swal.fire({
    icon: "warning",
    title,
    text,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText: "Cancel",
    reverseButtons: true,
    focusCancel: true,
  });

  return result.isConfirmed;
}

export function LandingPageBuilder({
  draft,
  published,
  imageUrls,
  publishedImageUrls,
  announcements,
}: Props) {
  const router = useRouter();
  const [content, setContent] = useState(draft);
  const [publishedContent, setPublishedContent] = useState(published);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState<string | null>(null);
  const [uploadedUrls, setUploadedUrls] = useState(imageUrls);
  const [publishedUrls, setPublishedUrls] = useState(publishedImageUrls);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const hasDraftChanges = useMemo(
    () => JSON.stringify(content) !== JSON.stringify(publishedContent),
    [content, publishedContent],
  );

  function clearFieldErrors() {
    setFieldErrors({});
  }

  function validateDraft() {
    const parsed = parseLandingPageContent(content);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join(".");
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      setFieldErrors(errors);
      return null;
    }

    setFieldErrors({});
    setContent(parsed.data);
    return parsed.data;
  }

  async function runAction(action: () => Promise<ActionResponse>, publish = false) {
    const validContent = validateDraft();
    if (!validContent) {
      await Swal.fire({
        icon: "error",
        title: "Check your content",
        text: "Review the highlighted fields before continuing.",
        confirmButtonText: "Okay",
      });
      return;
    }
    setBusy(true);
    showLoadingAlert(
      publish ? "Publishing homepage" : "Saving draft",
      "Please wait while we save your changes...",
    );
    try {
      const result = await action();
      Swal.close();
      if (isActionError(result)) {
        setFieldErrors(result.fieldErrors ?? {});
        await Swal.fire({
          icon: "error",
          title: publish ? "Unable to publish" : "Unable to save draft",
          text: result.message,
          confirmButtonText: "Okay",
        });
        return;
      }

      if (publish) {
        setPublishedContent(validContent);
        setPublishedUrls(uploadedUrls);
      }
      router.refresh();
      await Swal.fire({
        icon: "success",
        title: publish ? "Homepage published" : "Draft saved",
        text: result.message,
        confirmButtonText: "Okay",
      });
    } catch (error) {
      Swal.close();
      console.error("Landing page builder request failed.", error);
      await Swal.fire({
        icon: "error",
        title: publish ? "Unable to publish" : "Unable to save draft",
        text: "Something went wrong. Please try again.",
        confirmButtonText: "Okay",
      });
    } finally {
      setBusy(false);
    }
  }

  function setVisibility(section: LandingPageSectionKey, visible: boolean) {
    setContent((current) => ({
      ...current,
      visibility: { ...current.visibility, [section]: visible },
    }));
    clearFieldErrors();
  }

  function updateOrder(section: LandingPageSectionKey, direction: -1 | 1) {
    setContent((current) => {
      const index = current.sectionOrder.indexOf(section);
      const target = index + direction;
      if (target < 0 || target >= current.sectionOrder.length) {
        return current;
      }
      const sectionOrder = [...current.sectionOrder];
      [sectionOrder[index], sectionOrder[target]] = [
        sectionOrder[target],
        sectionOrder[index],
      ];
      return { ...current, sectionOrder };
    });
  }

  function updateNavigationOrder(key: LandingPageNavigationKey, direction: -1 | 1) {
    setContent((current) => {
      const index = current.header.navigationOrder.indexOf(key);
      const target = index + direction;
      if (target < 0 || target >= current.header.navigationOrder.length) {
        return current;
      }
      const navigationOrder = [...current.header.navigationOrder];
      [navigationOrder[index], navigationOrder[target]] = [
        navigationOrder[target],
        navigationOrder[index],
      ];
      return { ...current, header: { ...current.header, navigationOrder } };
    });
  }

  function updateImageAlt(slot: ImageSlot, alt: string) {
    setContent((current) => {
      if (slot === "hero" || slot === "welcome") {
        return {
          ...current,
          [slot]: { ...current[slot], image: { ...current[slot].image, alt } },
        };
      }
      if (slot === "header-logo") {
        return { ...current, header: { ...current.header, logo: { ...current.header.logo, alt } } };
      }
      const section = slot.slice("background:".length) as LandingPageSectionKey;
      return {
        ...current,
        sectionBackgrounds: {
          ...current.sectionBackgrounds,
          [section]: {
            ...current.sectionBackgrounds[section],
            image: { ...current.sectionBackgrounds[section].image, alt },
          },
        },
      };
    });
  }

  function imageForSlot(slot: ImageSlot) {
    if (slot === "hero" || slot === "welcome") return content[slot].image;
    if (slot === "header-logo") return content.header.logo;
    const section = slot.slice("background:".length) as LandingPageSectionKey;
    return content.sectionBackgrounds[section].image;
  }

  async function resetSection(section: LandingPageSectionKey) {
    if (
      !(await confirmAction(
        `Reset ${sectionTitles[section]}?`,
        "This section will return to its default settings in the draft.",
        "Reset section",
      ))
    ) {
      return;
    }
    setContent((current) => resetLandingPageSection(current, section));
    setUploadedUrls((current) => ({ ...current, [`background:${section}`]: null }));
    if (section === "hero" || section === "welcome") {
      setUploadedUrls((current) => ({ ...current, [section]: null }));
    }
    clearFieldErrors();
  }

  async function resetHeader() {
    if (
      !(await confirmAction(
        "Reset header settings?",
        "The name, logo, logo size, and navigation order will return to their defaults in the draft.",
        "Reset header",
      ))
    ) {
      return;
    }
    setContent((current) => ({ ...current, header: getDefaultLandingPageContent().header }));
    setUploadedUrls((current) => ({ ...current, "header-logo": null }));
  }

  async function discardDraft() {
    if (
      !(await confirmAction(
        "Discard unpublished edits?",
        "The draft will be restored to the currently published homepage.",
        "Discard draft",
      ))
    ) {
      return;
    }
    setBusy(true);
    showLoadingAlert("Discarding draft", "Restoring the published version...");
    try {
      const result = await discardLandingPageDraftAction();
      if (isActionError(result)) {
        Swal.close();
        setFieldErrors(result.fieldErrors ?? {});
        await Swal.fire({
          icon: "error",
          title: "Unable to discard draft",
          text: result.message,
          confirmButtonText: "Okay",
        });
        return;
      }
      Swal.close();
      setContent(published);
      setPublishedContent(published);
      setUploadedUrls(publishedUrls);
      setFieldErrors({});
      router.refresh();
      await Swal.fire({
        icon: "success",
        title: "Draft discarded",
        text: result.message,
        confirmButtonText: "Okay",
      });
    } catch (error) {
      Swal.close();
      console.error("Unable to discard the landing page draft.", error);
      await Swal.fire({
        icon: "error",
        title: "Unable to discard draft",
        text: "Please try again.",
        confirmButtonText: "Okay",
      });
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(slot: ImageSlot, form: HTMLFormElement) {
    const formData = new FormData(form);
    const file = formData.get("image");
    const alt = formData.get("alt");
    const imagePath = imageFieldPath(slot);
    if (!(file instanceof File) || !file.size) {
      setFieldErrors({ [imagePath]: ["Choose an image to upload."] });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors({ [imagePath]: ["Image must be 5 MB or smaller."] });
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFieldErrors({ [imagePath]: ["Use a JPG, PNG, or WebP image."] });
      return;
    }
    if (typeof alt !== "string" || !alt.trim()) {
      setFieldErrors({ [`${imageFieldPath(slot)}.alt`]: ["Add alt text before uploading."] });
      return;
    }

    setImageBusy(slot);
    clearFieldErrors();
    showLoadingAlert("Uploading photo", "Please wait while your photo is uploaded...");
    try {
      const result = await uploadLandingPageImageAction(formData);
      Swal.close();
      if (result.status === "error") {
        setFieldErrors({ [imagePath]: [result.message] });
        await Swal.fire({
          icon: "error",
          title: "Photo upload failed",
          text: result.message,
          confirmButtonText: "Okay",
        });
        return;
      }
      if (slot === "hero" || slot === "welcome") {
        setContent((current) => ({
          ...current,
          [slot]: { ...current[slot], image: { path: result.path, alt: result.alt } },
        }));
      } else if (slot === "header-logo") {
        setContent((current) => ({
          ...current,
          header: { ...current.header, logo: { path: result.path, alt: result.alt } },
        }));
      } else {
        const section = slot.slice("background:".length) as LandingPageSectionKey;
        setContent((current) => ({
          ...current,
          sectionBackgrounds: {
            ...current.sectionBackgrounds,
            [section]: {
              ...current.sectionBackgrounds[section],
              image: { path: result.path, alt: result.alt },
            },
          },
        }));
      }
      setUploadedUrls((current) => ({ ...current, [slot]: result.url }));
      form.reset();
      await Swal.fire({
        icon: "success",
        title: "Photo uploaded",
        text: "The photo is added to your draft. Save or publish to apply the change.",
        confirmButtonText: "Okay",
      });
    } catch (error) {
      Swal.close();
      console.error("Landing page image upload failed.", error);
      setFieldErrors({ [imagePath]: ["Unable to upload this image. Please try again."] });
      await Swal.fire({
        icon: "error",
        title: "Photo upload failed",
        text: "Unable to upload this image. Please try again.",
        confirmButtonText: "Okay",
      });
    } finally {
      setImageBusy(null);
    }
  }

  async function removeImage(slot: ImageSlot) {
    if (
      !(await confirmAction(
        "Remove this photo?",
        "The photo will be removed from this draft.",
        "Remove photo",
      ))
    ) {
      return;
    }
    if (slot === "hero" || slot === "welcome") {
      setContent((current) => ({
        ...current,
        [slot]: { ...current[slot], image: { path: null, alt: "" } },
      }));
    } else if (slot === "header-logo") {
      setContent((current) => ({
        ...current,
        header: { ...current.header, logo: { path: null, alt: "" } },
      }));
    } else {
      const section = slot.slice("background:".length) as LandingPageSectionKey;
      setContent((current) => ({
        ...current,
        sectionBackgrounds: {
          ...current.sectionBackgrounds,
          [section]: {
            ...current.sectionBackgrounds[section],
            image: { path: null, alt: "" },
          },
        },
      }));
    }
    setUploadedUrls((current) => ({ ...current, [slot]: null }));
  }

  function imageFields(slot: ImageSlot, recommendedSize: string, label = "Photo") {
    const image = imageForSlot(slot);
    const path = imageFieldPath(slot);
    return (
      <div className="flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor={`${slot}-alt`}>{label} alt text (required for upload)</FieldLabel>
          <Input
            aria-invalid={Boolean(fieldErrors[`${path}.alt`])}
            id={`${slot}-alt`}
            maxLength={250}
            required={Boolean(image.path)}
            onChange={(event) => updateImageAlt(slot, event.target.value)}
            value={image.alt}
          />
          <FieldMessages messages={fieldErrors[`${path}.alt`]} />
        </Field>
        {image.path ? (
          <div className="flex flex-wrap items-center gap-4">
            {uploadedUrls[slot] && (
              <div className="relative aspect-video w-48 overflow-hidden rounded-xl border border-border">
                <Image
                  alt={image.alt}
                  className="object-cover"
                  fill
                  sizes="192px"
                  src={uploadedUrls[slot]}
                  unoptimized
                />
              </div>
            )}
            <Button onClick={() => removeImage(slot)} type="button" variant="outline">
              Remove photo
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              void uploadImage(slot, event.currentTarget);
            }}
          >
            <input name="section" type="hidden" value={slot} />
            <input name="alt" type="hidden" value={image.alt} />
            <Field className="min-w-0 flex-1">
              <FieldLabel htmlFor={`${slot}-image`}>Photo</FieldLabel>
              <Input
                accept="image/jpeg,image/png,image/webp"
                id={`${slot}-image`}
                name="image"
                required
                type="file"
              />
              <FieldDescription>
                JPG, PNG, or WebP; up to 5 MB. Recommended size: {recommendedSize}.
              </FieldDescription>
            </Field>
            <Button disabled={imageBusy === slot} type="submit" variant="outline">
              {imageBusy === slot ? "Uploading..." : "Upload photo"}
            </Button>
          </form>
        )}
        <FieldMessages messages={fieldErrors[path]} />
      </div>
    );
  }

  function backgroundFields(section: LandingPageSectionKey) {
    const slot = `background:${section}` as const;
    const background = content.sectionBackgrounds[section];
    return (
      <div className="mt-5 flex flex-col gap-4 rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold">Section background (optional)</h3>
        <Field>
          <FieldLabel htmlFor={`${section}-min-height`}>Minimum section height</FieldLabel>
          <Input
            aria-describedby={`${section}-min-height-help`}
            id={`${section}-min-height`}
            max={1600}
            min={0}
            onChange={(event) => setContent((current) => ({
              ...current,
              sectionBackgrounds: {
                ...current.sectionBackgrounds,
                [section]: {
                  ...current.sectionBackgrounds[section],
                  minHeight: event.target.value === "" ? 0 : Number(event.target.value),
                },
              },
            }))}
            placeholder="Auto"
            step={1}
            type="number"
            value={background.minHeight || ""}
          />
          <FieldDescription id={`${section}-min-height-help`}>
            Enter 0 for Auto, or choose 1–1600 px. Content can make a section taller.
          </FieldDescription>
          <FieldMessages messages={fieldErrors[`sectionBackgrounds.${section}.minHeight`]} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${section}-background-color`}>Background color</FieldLabel>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              aria-label={`${sectionTitles[section]} background color`}
              className="h-11 w-16 p-1"
              id={`${section}-background-color`}
              onChange={(event) => setContent((current) => ({
                ...current,
                sectionBackgrounds: {
                  ...current.sectionBackgrounds,
                  [section]: {
                    ...current.sectionBackgrounds[section],
                    color: event.target.value,
                  },
                },
              }))}
              type="color"
              value={background.color || "#ffffff"}
            />
            <span className="text-sm text-muted-foreground">
              {background.color || "Using the current default"}
            </span>
            {background.color && (
              <Button
                onClick={() => setContent((current) => ({
                  ...current,
                  sectionBackgrounds: {
                    ...current.sectionBackgrounds,
                    [section]: { ...current.sectionBackgrounds[section], color: "" },
                  },
                }))}
                size="sm"
                type="button"
                variant="outline"
              >
                Clear color
              </Button>
            )}
          </div>
          <FieldMessages messages={fieldErrors[`sectionBackgrounds.${section}.color`]} />
          <FieldDescription>
            Choose a color that keeps the current text legible; text color controls are a separate future enhancement.
          </FieldDescription>
        </Field>
        {imageFields(slot, "1920 × 1080 px", "Background image")}
        <FieldDescription>
          When both are set, the image is shown over this color.
        </FieldDescription>
      </div>
    );
  }

  function updateScheduleRow(id: string, key: keyof ScheduleRow, value: string) {
    setContent((current) => ({
      ...current,
      schedule: {
        rows: current.schedule.rows.map((row) =>
          row.id === id ? { ...row, [key]: value } : row,
        ),
      },
    }));
  }

  const previewWidth =
    previewDevice === "mobile" ? "mx-auto max-w-[375px]" : "w-full";
  const livestreamEmbedUrl = getYouTubeVideoEmbedUrl(content.livestream.url);
  const previewBackgroundStyle = (section: LandingPageSectionKey) => {
    const background = content.sectionBackgrounds[section];
    const url = uploadedUrls[`background:${section}`];
    return {
      backgroundColor: background.color || undefined,
      backgroundImage: url ? `url("${url}")` : undefined,
      backgroundPosition: "center",
      backgroundSize: "cover",
      minHeight: background.minHeight || undefined,
    };
  };

  return (
    <div className="mt-8 grid items-start gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {hasDraftChanges ? "Unpublished edits" : "Draft matches published content"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !hasDraftChanges} onClick={() => void discardDraft()} type="button" variant="outline">
              Discard draft
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                void runAction(() => saveLandingPageDraftAction(content))
              }
              type="button"
              variant="outline"
            >
              Save draft
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                if (
                  !(await confirmAction(
                    "Publish these changes?",
                    "This will update the public homepage.",
                    "Publish changes",
                  ))
                ) {
                  return;
                }
                await runAction(() => publishLandingPageAction(content), true);
              }}
              type="button"
            >
              Publish
            </Button>
          </div>
        </div>

        {Object.keys(fieldErrors).length > 0 && (
          <div
            aria-live="assertive"
            className="mb-5 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
            role="alert"
          >
            Review the highlighted fields. {Object.values(fieldErrors).flat().join(" ")}
          </div>
        )}

        <section
          aria-labelledby="header-editor-heading"
          className="mb-4 rounded-2xl border border-border bg-card p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold" id="header-editor-heading">
              Navigation header
            </h2>
            <Button onClick={() => void resetHeader()} size="sm" type="button" variant="ghost">
              Reset header to default
            </Button>
          </div>
          <FieldGroup className="mt-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="header-name">Church name</FieldLabel>
                <Input
                  id="header-name"
                  maxLength={80}
                  onChange={(event) => setContent((current) => ({
                    ...current,
                    header: { ...current.header, name: event.target.value },
                  }))}
                  value={content.header.name}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="header-subtitle">Name second line (optional)</FieldLabel>
                <Input
                  id="header-subtitle"
                  maxLength={80}
                  onChange={(event) => setContent((current) => ({
                    ...current,
                    header: { ...current.header, subtitle: event.target.value },
                  }))}
                  value={content.header.subtitle}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="header-logo-size">Logo placeholder size</FieldLabel>
              <Input
                id="header-logo-size"
                max={96}
                min={28}
                onChange={(event) => setContent((current) => ({
                  ...current,
                  header: { ...current.header, logoSize: Number(event.target.value) },
                }))}
                type="range"
                value={content.header.logoSize}
              />
              <FieldDescription>{content.header.logoSize} × {content.header.logoSize} px</FieldDescription>
            </Field>
            {imageFields("header-logo", "512 × 512 px", "Logo")}
            <Field>
              <FieldLabel>Navigation tab order</FieldLabel>
              <FieldDescription>Move tabs up or down. Their existing destinations remain unchanged.</FieldDescription>
              <div className="flex flex-col gap-2">
                {content.header.navigationOrder.map((key, index) => (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-3" key={key}>
                    <span className="text-sm font-medium">{navigationTitles[key]}</span>
                    <div className="flex gap-2">
                      <Button
                        aria-label={`Move ${navigationTitles[key]} tab up`}
                        disabled={index === 0}
                        onClick={() => updateNavigationOrder(key, -1)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Move up
                      </Button>
                      <Button
                        aria-label={`Move ${navigationTitles[key]} tab down`}
                        disabled={index === content.header.navigationOrder.length - 1}
                        onClick={() => updateNavigationOrder(key, 1)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Move down
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Field>
          </FieldGroup>
        </section>

        <div className="flex flex-col gap-4">
          {content.sectionOrder.map((section, index) => (
            <section
              aria-labelledby={`${section}-editor-heading`}
              className="rounded-2xl border border-border bg-card p-5 sm:p-6"
              key={section}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold" id={`${section}-editor-heading`}>
                    {sectionTitles[section]}
                  </h2>
                  <label className="mt-2 inline-flex min-h-9 items-center gap-2 text-sm text-muted-foreground">
                    <input
                      checked={content.visibility[section]}
                      className="size-4 accent-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      onChange={(event) => setVisibility(section, event.target.checked)}
                      type="checkbox"
                    />
                    Show this section on the homepage
                  </label>
                  <FieldMessages messages={fieldErrors[`visibility.${section}`]} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    aria-label={`Move ${sectionTitles[section]} up`}
                    disabled={index === 0}
                    onClick={() => updateOrder(section, -1)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Move up
                  </Button>
                  <Button
                    aria-label={`Move ${sectionTitles[section]} down`}
                    disabled={index === content.sectionOrder.length - 1}
                    onClick={() => updateOrder(section, 1)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Move down
                  </Button>
                  <Button
                    onClick={() => void resetSection(section)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Reset section to default
                  </Button>
                </div>
              </div>

              <FieldGroup className="mt-5">
                {backgroundFields(section)}
                {section === "hero" && (
                  <>
                    <Field>
                      <FieldLabel htmlFor="hero-headline">Headline</FieldLabel>
                      <Input
                        aria-invalid={Boolean(fieldErrors["hero.headline"])}
                        id="hero-headline"
                        maxLength={160}
                        onChange={(event) => setContent((current) => ({
                          ...current,
                          hero: { ...current.hero, headline: event.target.value },
                        }))}
                        value={content.hero.headline}
                      />
                      <FieldMessages messages={fieldErrors["hero.headline"]} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="hero-subtext">Subtext</FieldLabel>
                      <Textarea
                        aria-invalid={Boolean(fieldErrors["hero.subtext"])}
                        id="hero-subtext"
                        maxLength={1000}
                        onChange={(event) => setContent((current) => ({
                          ...current,
                          hero: { ...current.hero, subtext: event.target.value },
                        }))}
                        rows={3}
                        value={content.hero.subtext}
                      />
                      <FieldMessages messages={fieldErrors["hero.subtext"]} />
                    </Field>
                    {imageFields("hero", "1920 × 1080 px")}
                    <div className="flex flex-col gap-3">
                      <h3 className="text-sm font-medium">Buttons (up to two)</h3>
                      {content.hero.buttons.map((button, buttonIndex) => (
                        <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2" key={buttonIndex}>
                          <Field>
                            <FieldLabel htmlFor={`hero-button-${buttonIndex}-label`}>Button {buttonIndex + 1} label</FieldLabel>
                            <Input
                              id={`hero-button-${buttonIndex}-label`}
                              maxLength={60}
                              aria-invalid={Boolean(fieldErrors[`hero.buttons.${buttonIndex}.label`])}
                              onChange={(event) => setContent((current) => ({
                                ...current,
                                hero: {
                                  ...current.hero,
                                  buttons: current.hero.buttons.map((item, itemIndex) =>
                                    itemIndex === buttonIndex ? { ...item, label: event.target.value } : item,
                                  ),
                                },
                              }))}
                              value={button.label}
                            />
                            <FieldMessages messages={fieldErrors[`hero.buttons.${buttonIndex}.label`]} />
                          </Field>
                          <Field>
                            <FieldLabel htmlFor={`hero-button-${buttonIndex}-url`}>Button {buttonIndex + 1} link</FieldLabel>
                            <Input
                              aria-invalid={Boolean(fieldErrors[`hero.buttons.${buttonIndex}.url`])}
                              id={`hero-button-${buttonIndex}-url`}
                              onChange={(event) => setContent((current) => ({
                                ...current,
                                hero: {
                                  ...current.hero,
                                  buttons: current.hero.buttons.map((item, itemIndex) =>
                                    itemIndex === buttonIndex ? { ...item, url: event.target.value } : item,
                                  ),
                                },
                              }))}
                              type="text"
                              value={button.url}
                            />
                            <FieldMessages messages={fieldErrors[`hero.buttons.${buttonIndex}.url`]} />
                          </Field>
                          <Button
                            className="sm:col-span-2 sm:justify-self-start"
                            onClick={async () => {
                              if (
                                !(await confirmAction(
                                  "Remove this hero button?",
                                  "The button will be removed from this draft.",
                                  "Remove button",
                                ))
                              ) {
                                return;
                              }
                              setContent((current) => ({
                                ...current,
                                hero: {
                                  ...current.hero,
                                  buttons: current.hero.buttons.filter((_, itemIndex) => itemIndex !== buttonIndex),
                                },
                              }));
                            }}
                            type="button"
                            variant="outline"
                          >
                            Remove button
                          </Button>
                        </div>
                      ))}
                      {content.hero.buttons.length < 2 && (
                        <Button
                          className="w-fit"
                          onClick={() => setContent((current) => ({
                            ...current,
                            hero: {
                              ...current.hero,
                              buttons: [...current.hero.buttons, { label: "", url: "" }],
                            },
                          }))}
                          type="button"
                          variant="outline"
                        >
                          Add button
                        </Button>
                      )}
                    </div>
                  </>
                )}

                {section === "welcome" && (
                  <>
                    <Field>
                      <FieldLabel htmlFor="welcome-text">Welcome message</FieldLabel>
                      <Textarea
                        aria-invalid={Boolean(fieldErrors["welcome.text"])}
                        id="welcome-text"
                        maxLength={2000}
                        onChange={(event) => setContent((current) => ({
                          ...current,
                          welcome: { ...current.welcome, text: event.target.value },
                        }))}
                        rows={5}
                        value={content.welcome.text}
                      />
                      <FieldMessages messages={fieldErrors["welcome.text"]} />
                    </Field>
                    {imageFields("welcome", "1200 × 800 px")}
                  </>
                )}

                {section === "schedule" && (
                  <>
                    {content.schedule.rows.map((row, rowIndex) => (
                      <fieldset className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2" key={row.id}>
                        <legend className="px-1 text-sm font-medium">Schedule row {rowIndex + 1}</legend>
                        {([
                          ["day", "Day"],
                          ["time", "Time"],
                          ["serviceName", "Service name"],
                          ["note", "Optional note"],
                        ] as const).map(([field, label]) => (
                          <Field key={field}>
                            <FieldLabel htmlFor={`schedule-${row.id}-${field}`}>{label}</FieldLabel>
                            <Input
                              aria-invalid={Boolean(fieldErrors[`schedule.rows.${rowIndex}.${field}`])}
                              id={`schedule-${row.id}-${field}`}
                              maxLength={field === "note" ? 300 : 120}
                              onChange={(event) => updateScheduleRow(row.id, field, event.target.value)}
                              value={row[field]}
                            />
                            <FieldMessages messages={fieldErrors[`schedule.rows.${rowIndex}.${field}`]} />
                          </Field>
                        ))}
                        <Button
                          className="sm:col-span-2 sm:justify-self-start"
                          onClick={async () => {
                            if (
                              !(await confirmAction(
                                "Remove this schedule row?",
                                "The row will be removed from this draft.",
                                "Remove row",
                              ))
                            ) {
                              return;
                            }
                            setContent((current) => ({
                              ...current,
                              schedule: {
                                rows: current.schedule.rows.filter((item) => item.id !== row.id),
                              },
                            }));
                          }}
                          type="button"
                          variant="outline"
                        >
                          Remove row
                        </Button>
                      </fieldset>
                    ))}
                    <FieldMessages messages={fieldErrors["schedule.rows"]} />
                    <Button
                      className="w-fit"
                      disabled={content.schedule.rows.length >= 20}
                      onClick={() => setContent((current) => ({
                        ...current,
                        schedule: {
                          rows: [...current.schedule.rows, {
                            id: crypto.randomUUID(),
                            day: "",
                            time: "",
                            serviceName: "",
                            note: "",
                          }],
                        },
                      }))}
                      type="button"
                      variant="outline"
                    >
                      Add schedule row
                    </Button>
                  </>
                )}

                {section === "livestream" && (
                  <>
                    <Field>
                      <FieldLabel htmlFor="livestream-url">YouTube URL</FieldLabel>
                      <Input
                        aria-invalid={Boolean(fieldErrors["livestream.url"])}
                        id="livestream-url"
                        onChange={(event) => setContent((current) => ({
                          ...current,
                          livestream: { ...current.livestream, url: event.target.value },
                        }))}
                        placeholder="https://www.youtube.com/..."
                        type="url"
                        value={content.livestream.url}
                      />
                      <FieldDescription>
                        Video and live-video URLs embed in the homepage. Channel URLs without a specific video remain a YouTube link.
                      </FieldDescription>
                      <FieldMessages messages={fieldErrors["livestream.url"]} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="livestream-label">Optional label</FieldLabel>
                      <Input
                        id="livestream-label"
                        maxLength={80}
                        onChange={(event) => setContent((current) => ({
                          ...current,
                          livestream: { ...current.livestream, label: event.target.value },
                        }))}
                        placeholder="Live now or Next stream"
                        value={content.livestream.label}
                      />
                    </Field>
                  </>
                )}

                {(section === "announcements" || section === "events") && (
                  <>
                    <Field>
                      <FieldLabel htmlFor={`${section}-title`}>Section title</FieldLabel>
                      <Input
                        id={`${section}-title`}
                        maxLength={120}
                        onChange={(event) => setContent((current) => ({
                          ...current,
                          [section]: { ...current[section], title: event.target.value },
                        }))}
                        value={content[section].title}
                      />
                      <FieldMessages messages={fieldErrors[`${section}.title`]} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`${section}-intro`}>Intro line</FieldLabel>
                      <Textarea
                        aria-invalid={Boolean(fieldErrors[`${section}.intro`])}
                        id={`${section}-intro`}
                        maxLength={500}
                        onChange={(event) => setContent((current) => ({
                          ...current,
                          [section]: { ...current[section], intro: event.target.value },
                        }))}
                        rows={2}
                        value={content[section].intro}
                      />
                      <FieldMessages messages={fieldErrors[`${section}.intro`]} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`${section}-count`}>Items to show</FieldLabel>
                      <select
                        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                        id={`${section}-count`}
                        onChange={(event) => setContent((current) => ({
                          ...current,
                          [section]: { ...current[section], count: Number(event.target.value) as 3 | 6 | 9 },
                        }))}
                        value={content[section].count}
                      >
                        {[3, 6, 9].map((count) => (
                          <option key={count} value={count}>{count}</option>
                        ))}
                      </select>
                    </Field>
                    {section === "announcements" && (
                      <Field>
                        <FieldLabel htmlFor="announcements-pinned">Pin announcement to top</FieldLabel>
                        <select
                          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                          id="announcements-pinned"
                          onChange={(event) => setContent((current) => ({
                            ...current,
                            announcements: {
                              ...current.announcements,
                              pinnedId: event.target.value || null,
                            },
                          }))}
                          value={content.announcements.pinnedId ?? ""}
                        >
                          <option value="">No pinned announcement</option>
                          {announcements.map((announcement) => (
                            <option key={announcement.id} value={announcement.id}>
                              {announcement.title}
                            </option>
                          ))}
                        </select>
                        <FieldDescription>
                          Only active announcements can be pinned.
                        </FieldDescription>
                      </Field>
                    )}
                  </>
                )}

                {section === "devotionals" && (
                  <Field>
                    <FieldLabel htmlFor="devotional-count">Devotionals to show</FieldLabel>
                    <Input
                      aria-invalid={Boolean(fieldErrors["devotionals.count"])}
                      id="devotional-count"
                      max={12}
                      min={1}
                      onChange={(event) => setContent((current) => ({
                        ...current,
                        devotionals: { count: Number(event.target.value) },
                      }))}
                      type="number"
                      value={content.devotionals.count}
                    />
                    <FieldMessages messages={fieldErrors["devotionals.count"]} />
                    <FieldDescription>
                      Published devotionals link to the existing devotionals page.
                    </FieldDescription>
                  </Field>
                )}

                {section === "contact" && (
                  <FieldGroup className="grid gap-4 sm:grid-cols-2">
                    {([
                      ["address", "Address"],
                      ["phone", "Phone"],
                      ["email", "Email"],
                      ["facebookUrl", "Facebook link"],
                      ["mapUrl", "Map link"],
                    ] as const).map(([field, label]) => (
                      <Field key={field}>
                        <FieldLabel htmlFor={`contact-${field}`}>{label}</FieldLabel>
                        <Input
                          aria-invalid={Boolean(fieldErrors[`contact.${field}`])}
                          id={`contact-${field}`}
                          maxLength={field === "address" ? 500 : 254}
                          onChange={(event) => setContent((current) => ({
                            ...current,
                            contact: { ...current.contact, [field]: event.target.value },
                          }))}
                          type={field === "email" ? "email" : field.endsWith("Url") ? "url" : "text"}
                          value={content.contact[field]}
                        />
                        <FieldMessages messages={fieldErrors[`contact.${field}`]} />
                      </Field>
                    ))}
                  </FieldGroup>
                )}
              </FieldGroup>
            </section>
          ))}
        </div>
      </div>

      <aside className="xl:sticky xl:top-24">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Live preview</h2>
            <p className="text-sm text-muted-foreground">Preview of the current draft</p>
          </div>
          <div aria-label="Preview size" className="flex gap-2">
            <Button
              aria-pressed={previewDevice === "desktop"}
              onClick={() => setPreviewDevice("desktop")}
              size="sm"
              type="button"
              variant={previewDevice === "desktop" ? "default" : "outline"}
            >
              Desktop
            </Button>
            <Button
              aria-pressed={previewDevice === "mobile"}
              onClick={() => setPreviewDevice("mobile")}
              size="sm"
              type="button"
              variant={previewDevice === "mobile" ? "default" : "outline"}
            >
              Mobile
            </Button>
          </div>
        </div>
        <div className={`overflow-hidden rounded-2xl border border-border bg-background p-3 transition-[max-width] ${previewWidth}`}>
          <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-border">
            <div className="flex flex-col gap-4 p-4">
              <header className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-brand/15 bg-brand/5 text-[10px] font-bold text-brand"
                    style={{ height: content.header.logoSize, width: content.header.logoSize }}
                  >
                    {uploadedUrls["header-logo"] ? (
                      <Image
                        alt={content.header.logo.alt}
                        className="object-contain"
                        fill
                        sizes="96px"
                        src={uploadedUrls["header-logo"]}
                        unoptimized
                      />
                    ) : (
                      "GC"
                    )}
                  </span>
                  <span className="min-w-0 text-xs leading-tight font-semibold">
                    {content.header.name}
                    {content.header.subtitle && (
                      <span className="block font-normal text-muted-foreground">
                        {content.header.subtitle}
                      </span>
                    )}
                  </span>
                </div>
                {previewDevice === "desktop" && (
                  <nav aria-label="Preview navigation" className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                    {content.header.navigationOrder.map((key) => (
                      <span className="text-[10px] text-muted-foreground" key={key}>
                        {navigationTitles[key]}
                      </span>
                    ))}
                  </nav>
                )}
              </header>
              {content.sectionOrder.map((section) => {
                if (!content.visibility[section]) return null;
                if (section === "hero" && content.hero.headline) {
                  return (
                    <section className="rounded-xl bg-brand p-5 text-white" key={section} style={previewBackgroundStyle(section)}>
                      {content.hero.image.path && uploadedUrls.hero && (
                        <div className="relative mb-4 aspect-video overflow-hidden rounded-xl">
                          <Image
                            alt={content.hero.image.alt}
                            className="object-cover"
                            fill
                            sizes="(max-width: 375px) 100vw, 600px"
                            src={uploadedUrls.hero}
                            unoptimized
                          />
                        </div>
                      )}
                      <p className="text-2xl font-semibold">{content.hero.headline}</p>
                      {content.hero.subtext && <p className="mt-3 text-sm text-white/75">{content.hero.subtext}</p>}
                      {content.hero.buttons.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {content.hero.buttons.map((button, index) => (
                            <span className="rounded-full bg-white px-3 py-2 text-xs font-medium text-brand" key={`${button.label}-${index}`}>
                              {button.label || "Button"}
                            </span>
                          ))}
                        </div>
                      )}
                    </section>
                  );
                }
                if (section === "welcome" && (content.welcome.text || content.welcome.image.path)) {
                  return (
                    <section className="rounded-xl border border-border p-4" key={section} style={previewBackgroundStyle(section)}>
                      {content.welcome.image.path && uploadedUrls.welcome && (
                        <div className="relative mb-3 aspect-video overflow-hidden rounded-lg">
                          <Image alt={content.welcome.image.alt} className="object-cover" fill sizes="320px" src={uploadedUrls.welcome} unoptimized />
                        </div>
                      )}
                      {content.welcome.text && <p className="text-sm leading-6">{content.welcome.text}</p>}
                    </section>
                  );
                }
                if (section === "schedule" && content.schedule.rows.length > 0) {
                  return (
                    <section className="rounded-xl border border-border p-4" key={section} style={previewBackgroundStyle(section)}>
                      <p className="font-semibold">Worship schedule</p>
                      {content.schedule.rows.map((row) => (
                        <p className="mt-2 text-sm text-muted-foreground" key={row.id}>
                          {row.day} {row.time} · {row.serviceName}
                        </p>
                      ))}
                    </section>
                  );
                }
                if (section === "livestream" && content.livestream.url) {
                  return (
                    <section className="rounded-xl border border-border p-4" key={section} style={previewBackgroundStyle(section)}>
                      <p className="font-semibold">{content.livestream.label || "Livestream"}</p>
                      {livestreamEmbedUrl ? (
                        <div className="mt-3 aspect-video overflow-hidden rounded-lg bg-black">
                          <iframe
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            className="size-full"
                            loading="lazy"
                            referrerPolicy="strict-origin-when-cross-origin"
                            src={livestreamEmbedUrl}
                            title={content.livestream.label || "YouTube livestream preview"}
                          />
                        </div>
                      ) : (
                        <a
                          className="mt-2 block break-all text-sm text-muted-foreground underline"
                          href={content.livestream.url}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          Open on YouTube
                        </a>
                      )}
                    </section>
                  );
                }
                if (section === "announcements" || section === "events") {
                  return (
                    <section className="rounded-xl border border-border p-4" key={section} style={previewBackgroundStyle(section)}>
                      <p className="font-semibold">{content[section].title}</p>
                      {content[section].intro && <p className="mt-2 text-sm text-muted-foreground">{content[section].intro}</p>}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {content[section].count} items · existing {section} data
                      </p>
                    </section>
                  );
                }
                if (section === "devotionals") {
                  return (
                    <section className="rounded-xl border border-border p-4" key={section} style={previewBackgroundStyle(section)}>
                      <p className="font-semibold">Devotionals</p>
                      <p className="mt-2 text-sm text-muted-foreground">{content.devotionals.count} items linking to /devotionals</p>
                    </section>
                  );
                }
                if (section === "contact" && (
                  content.contact.address ||
                  content.contact.phone ||
                  content.contact.email ||
                  content.contact.facebookUrl ||
                  content.contact.mapUrl
                )) {
                  return (
                    <section className="rounded-xl border border-border p-4" key={section} style={previewBackgroundStyle(section)}>
                      <p className="font-semibold">Contact and location</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {[content.contact.address, content.contact.phone, content.contact.email].filter(Boolean).join(" · ")}
                      </p>
                    </section>
                  );
                }
                return null;
              })}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
