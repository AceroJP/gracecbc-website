"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react";
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
import { LandingPagePreviewFrame } from "@/components/admin/landing-page-preview-frame";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { showLoadingAlert } from "@/lib/sweet-alert";
import {
  landingPageContactKeys,
  landingPageTextAlignments,
  landingPageThemeFonts,
  getDefaultLandingPageContent,
  parseLandingPageContent,
  resetLandingPageSection,
  type LandingPageContent,
  type LandingPageContactKey,
  type LandingPageNavigationKey,
  type LandingPageSectionKey,
  type LandingPageTextAlignment,
  type LandingPageThemeFont,
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
  | `contact:${LandingPageContactKey}`
  | `background:${LandingPageSectionKey}`;
type BuilderPanelKey = LandingPageSectionKey | "footer" | "header";
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
  if (slot.startsWith("contact:")) return `contact.appearance.${slot.slice("contact:".length)}.image`;
  return `sectionBackgrounds.${slot.slice("background:".length)}.image`;
}

function getSectionSnapshot(content: LandingPageContent, section: LandingPageSectionKey) {
  return JSON.stringify({
    content: content[section],
    visible: content.visibility[section],
    background: content.sectionBackgrounds[section],
    order: content.sectionOrder.indexOf(section),
  });
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

function TextStyleFields({
  idPrefix,
  fieldPrefix,
  textAlign,
  fontFamily,
  fontSizeScale,
  fieldErrors,
  onChange,
  onFontSizeScaleChange,
}: {
  idPrefix: string;
  fieldPrefix: string;
  textAlign: LandingPageTextAlignment;
  fontFamily: LandingPageThemeFont;
  fontSizeScale: number;
  fieldErrors: Record<string, string[]>;
  onChange: (
    field: "textAlign" | "fontFamily",
    value: LandingPageTextAlignment | LandingPageThemeFont,
  ) => void;
  onFontSizeScaleChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-text-align`}>Text alignment</FieldLabel>
        <select
          aria-invalid={Boolean(fieldErrors[`${fieldPrefix}.textAlign`])}
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          id={`${idPrefix}-text-align`}
          onChange={(event) => {
            const value = landingPageTextAlignments.find(
              (alignment) => alignment === event.target.value,
            );
            if (value) onChange("textAlign", value);
          }}
          value={textAlign}
        >
          <option value="inherit">Theme default</option>
          <option value="left">Align Left</option>
          <option value="center">Center</option>
          <option value="right">Align Right</option>
          <option value="justify">Justify</option>
        </select>
        <FieldMessages messages={fieldErrors[`${fieldPrefix}.textAlign`]} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-font-family`}>Theme font</FieldLabel>
        <select
          aria-invalid={Boolean(fieldErrors[`${fieldPrefix}.fontFamily`])}
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          id={`${idPrefix}-font-family`}
          onChange={(event) => {
            const value = landingPageThemeFonts.find(
              (font) => font === event.target.value,
            );
            if (value) onChange("fontFamily", value);
          }}
          value={fontFamily}
        >
          <option value="inherit">Theme default</option>
          <option value="theme-sans">Theme Sans (Geist)</option>
          <option value="theme-mono">Theme Mono (Geist Mono)</option>
        </select>
        <FieldDescription>Uses the fonts already loaded by this site theme.</FieldDescription>
        <FieldMessages messages={fieldErrors[`${fieldPrefix}.fontFamily`]} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-font-size-scale`}>Font size</FieldLabel>
        <Input
          aria-valuetext={`${fontSizeScale}%`}
          id={`${idPrefix}-font-size-scale`}
          max={150}
          min={75}
          onChange={(event) => onFontSizeScaleChange(Number(event.target.value))}
          step={5}
          type="range"
          value={fontSizeScale}
        />
        <FieldDescription>
          {fontSizeScale}% — scales the section text while preserving its size hierarchy.
        </FieldDescription>
        <FieldMessages messages={fieldErrors[`${fieldPrefix}.fontSizeScale`]} />
      </Field>
    </div>
  );
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
  const [savedDraftContent, setSavedDraftContent] = useState(draft);
  const [publishedContent, setPublishedContent] = useState(published);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState<string | null>(null);
  const [uploadedUrls, setUploadedUrls] = useState(imageUrls);
  const [publishedUrls, setPublishedUrls] = useState(publishedImageUrls);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [openSection, setOpenSection] = useState<BuilderPanelKey | null>("header");
  const sectionHeaderRefs = useRef<Partial<Record<BuilderPanelKey, HTMLButtonElement | null>>>({});
  const hasDraftChanges = useMemo(
    () => JSON.stringify(content) !== JSON.stringify(publishedContent),
    [content, publishedContent],
  );

  useEffect(() => {
    if (!openSection) return;
    const header = sectionHeaderRefs.current[openSection];
    if (!header) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    header.scrollIntoView({
      behavior: prefersReducedMotion ? "instant" : "smooth",
      block: "start",
    });
  }, [openSection]);

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

      setSavedDraftContent(validContent);
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

  function hasUnsavedPanelChanges(panel: BuilderPanelKey) {
    if (panel === "header") {
      return JSON.stringify(content.header) !== JSON.stringify(savedDraftContent.header);
    }
    if (panel === "footer") {
      return JSON.stringify(content.footer) !== JSON.stringify(savedDraftContent.footer);
    }
    return getSectionSnapshot(content, panel) !== getSectionSnapshot(savedDraftContent, panel);
  }

  async function togglePanel(panel: BuilderPanelKey) {
    if (openSection && hasUnsavedPanelChanges(openSection)) {
      const panelTitle =
        openSection === "header"
          ? "Navigation header"
          : openSection === "footer"
            ? "Footer"
            : sectionTitles[openSection];
      const result = await Swal.fire({
        icon: "warning",
        title: "Unsaved section edits",
        text: `You have unsaved edits in ${panelTitle}. Close this section? Your changes will remain here, but are not saved to the draft yet.`,
        showCancelButton: true,
        confirmButtonText: "Close section",
        cancelButtonText: "Keep editing",
        reverseButtons: true,
        focusCancel: true,
      });
      if (!result.isConfirmed) return;
    }

    setOpenSection((current) => current === panel ? null : panel);
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
      if (slot.startsWith("contact:")) {
        const field = slot.slice("contact:".length) as LandingPageContactKey;
        return { ...current, contact: { ...current.contact, appearance: {
          ...current.contact.appearance,
          [field]: { ...current.contact.appearance[field], image: { ...current.contact.appearance[field].image, alt } },
        } } };
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
    if (slot.startsWith("contact:")) return content.contact.appearance[slot.slice("contact:".length) as LandingPageContactKey].image;
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
    if (section === "contact") {
      setUploadedUrls((current) => ({
        ...current,
        ...Object.fromEntries(landingPageContactKeys.map((field) => [`contact:${field}`, null])),
      }));
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

  async function resetFooter() {
    if (
      !(await confirmAction(
        "Reset footer settings?",
        "The footer content, colors, and spacing will return to their defaults in the draft.",
        "Reset footer",
      ))
    ) {
      return;
    }
    setContent((current) => ({
      ...current,
      footer: getDefaultLandingPageContent().footer,
    }));
    clearFieldErrors();
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
      setSavedDraftContent(published);
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

  async function saveDraft() {
    await runAction(() => saveLandingPageDraftAction(content));
  }

  async function publishDraft() {
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
      } else if (slot.startsWith("contact:")) {
        const field = slot.slice("contact:".length) as LandingPageContactKey;
        setContent((current) => ({ ...current, contact: { ...current.contact, appearance: {
          ...current.contact.appearance,
          [field]: { ...current.contact.appearance[field], image: { path: result.path, alt: result.alt } },
        } } }));
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
    } else if (slot.startsWith("contact:")) {
      const field = slot.slice("contact:".length) as LandingPageContactKey;
      setContent((current) => ({ ...current, contact: { ...current.contact, appearance: {
        ...current.contact.appearance,
        [field]: { ...current.contact.appearance[field], image: { path: null, alt: "" } },
      } } }));
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
              <div className={slot.startsWith("contact:") ? "relative size-20 overflow-hidden rounded-xl border border-border" : "relative aspect-video w-48 overflow-hidden rounded-xl border border-border"}>
                <Image
                  alt={image.alt}
                  className={slot.startsWith("contact:") ? "object-contain" : "object-cover"}
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
        <h3 className="text-sm font-semibold">Image style and section background</h3>
        <Field>
          <FieldLabel htmlFor={`${section}-min-height`}>Minimum section height (px)</FieldLabel>
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
            Set a minimum in pixels, or enter 0 for automatic height. Content and spacing can make the section taller, especially on smaller screens. Save and publish to update the live page.
          </FieldDescription>
          <FieldMessages messages={fieldErrors[`sectionBackgrounds.${section}.minHeight`]} />
        </Field>
        {imageFields(slot, "1920 × 1080 px", "Background image")}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${section}-image-opacity`}>Background image opacity</FieldLabel>
            <Input
              aria-describedby={`${section}-image-opacity-help`}
              aria-valuetext={`${background.imageOpacity}%`}
              id={`${section}-image-opacity`}
              max={100}
              min={0}
              onChange={(event) => setContent((current) => ({
                ...current,
                sectionBackgrounds: {
                  ...current.sectionBackgrounds,
                  [section]: {
                    ...current.sectionBackgrounds[section],
                    imageOpacity: Number(event.target.value),
                  },
                },
              }))}
              step={1}
              type="range"
              value={background.imageOpacity}
            />
            <FieldDescription id={`${section}-image-opacity-help`}>
              {background.imageOpacity}% — 0% transparent, 100% fully visible.
            </FieldDescription>
            <FieldMessages messages={fieldErrors[`sectionBackgrounds.${section}.imageOpacity`]} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${section}-image-blur`}>Background image blur</FieldLabel>
            <Input
              aria-describedby={`${section}-image-blur-help`}
              aria-valuetext={`${background.imageBlur} pixels`}
              id={`${section}-image-blur`}
              max={20}
              min={0}
              onChange={(event) => setContent((current) => ({
                ...current,
                sectionBackgrounds: {
                  ...current.sectionBackgrounds,
                  [section]: {
                    ...current.sectionBackgrounds[section],
                    imageBlur: Number(event.target.value),
                  },
                },
              }))}
              step={1}
              type="range"
              value={background.imageBlur}
            />
            <FieldDescription id={`${section}-image-blur-help`}>
              {background.imageBlur} px blur.
            </FieldDescription>
            <FieldMessages messages={fieldErrors[`sectionBackgrounds.${section}.imageBlur`]} />
          </Field>
        </div>
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
          <FieldDescription>Used when no background image is set.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${section}-text-color`}>Section text color (optional)</FieldLabel>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              aria-label={`${sectionTitles[section]} text color`}
              className="h-11 w-16 p-1"
              id={`${section}-text-color`}
              onChange={(event) => setContent((current) => ({
                ...current,
                sectionBackgrounds: {
                  ...current.sectionBackgrounds,
                  [section]: {
                    ...current.sectionBackgrounds[section],
                    textColor: event.target.value,
                  },
                },
              }))}
              type="color"
              value={background.textColor || "#ffffff"}
            />
            <span className="text-sm text-muted-foreground">
              {background.textColor || "Using the current text colors"}
            </span>
            {background.textColor && (
              <Button
                onClick={() => setContent((current) => ({
                  ...current,
                  sectionBackgrounds: {
                    ...current.sectionBackgrounds,
                    [section]: { ...current.sectionBackgrounds[section], textColor: "" },
                  },
                }))}
                size="sm"
                type="button"
                variant="outline"
              >
                Clear text color
              </Button>
            )}
          </div>
          <FieldDescription>
            Applies to headings, body text, and links in this section. Choose a color with enough contrast against its background.
          </FieldDescription>
          <FieldMessages messages={fieldErrors[`sectionBackgrounds.${section}.textColor`]} />
        </Field>
        <TextStyleFields
          fieldErrors={fieldErrors}
          fieldPrefix={`sectionBackgrounds.${section}`}
          fontFamily={background.fontFamily}
          fontSizeScale={background.fontSizeScale}
          idPrefix={section}
          onChange={(field, value) => setContent((current) => ({
            ...current,
            sectionBackgrounds: {
              ...current.sectionBackgrounds,
              [section]: { ...current.sectionBackgrounds[section], [field]: value },
            },
          }))}
          textAlign={background.textAlign}
          onFontSizeScaleChange={(fontSizeScale) => setContent((current) => ({
            ...current,
            sectionBackgrounds: {
              ...current.sectionBackgrounds,
              [section]: { ...current.sectionBackgrounds[section], fontSizeScale },
            },
          }))}
        />
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

  function draftActionButtons(compact = false) {
    return (
      <div className={`flex flex-wrap gap-2 ${compact ? "justify-end" : ""}`}>
        <Button
          disabled={busy || !hasDraftChanges}
          onClick={() => void discardDraft()}
          size={compact ? "sm" : undefined}
          type="button"
          variant="outline"
        >
          Discard draft
        </Button>
        <Button
          disabled={busy}
          onClick={() => void saveDraft()}
          size={compact ? "sm" : undefined}
          type="button"
          variant="outline"
        >
          Save draft
        </Button>
        <Button
          disabled={busy || !hasDraftChanges}
          onClick={() => void publishDraft()}
          size={compact ? "sm" : undefined}
          type="button"
        >
          Publish
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-8 grid items-start gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {hasDraftChanges ? "Unpublished edits" : "Draft matches published content"}
          </p>
          {draftActionButtons()}
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
          className="mb-4 rounded-xl border border-border bg-card p-3 sm:p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              aria-controls="header-editor-panel"
              aria-expanded={openSection === "header"}
              className="scroll-mt-24 min-w-[140px] flex-1 justify-between px-2 text-left"
              id="header-editor-heading"
              onClick={() => void togglePanel("header")}
              ref={(element) => {
                sectionHeaderRefs.current.header = element;
              }}
              type="button"
              variant="ghost"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold">Navigation header</span>
                {JSON.stringify(content.header) !== JSON.stringify(savedDraftContent.header) && (
                  <>
                    <span
                      aria-label="Unsaved changes"
                      className="size-2 shrink-0 rounded-full bg-primary"
                      title="Unsaved changes"
                    />
                    <span className="sr-only">Unsaved changes</span>
                  </>
                )}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={`shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
                  openSection === "header" ? "rotate-180" : ""
                }`}
              />
            </Button>
            <Button onClick={() => void resetHeader()} size="sm" type="button" variant="ghost">
              Reset header to default
            </Button>
          </div>
          <div
            aria-hidden={openSection !== "header"}
            className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
              openSection === "header" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
            id="header-editor-panel"
          >
            <div className="min-h-0 overflow-hidden" inert={openSection !== "header"}>
              <FieldGroup className="pb-2 pt-3">
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
                <FieldDescription>
                  Edit the footer title separately in the Footer settings below.
                </FieldDescription>
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
              <div className="mt-4 border-t border-border pt-3">
                {draftActionButtons(true)}
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3">
          {content.sectionOrder.map((section, index) => {
            const sectionIsOpen = openSection === section;
            const hasUnsavedChanges =
              getSectionSnapshot(content, section) !==
              getSectionSnapshot(savedDraftContent, section);

            return (
            <section
              aria-labelledby={`${section}-editor-heading`}
              className="rounded-xl border border-border bg-card p-3 sm:p-4"
              key={section}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  aria-controls={`${section}-editor-panel`}
                  aria-expanded={sectionIsOpen}
                  className="scroll-mt-24 min-w-[140px] flex-1 justify-between px-2 text-left"
                  id={`${section}-editor-heading`}
                  onClick={() => void togglePanel(section)}
                  ref={(element) => {
                    sectionHeaderRefs.current[section] = element;
                  }}
                  type="button"
                  variant="ghost"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      {sectionTitles[section]}
                    </span>
                    {hasUnsavedChanges && (
                      <span
                        aria-label="Unsaved changes"
                        className="size-2 shrink-0 rounded-full bg-primary"
                        title="Unsaved changes"
                      />
                    )}
                    {hasUnsavedChanges && (
                      <span className="sr-only">Unsaved changes</span>
                    )}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
                      sectionIsOpen ? "rotate-180" : ""
                    }`}
                  />
                </Button>
                <label
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 px-1 text-xs text-muted-foreground"
                  htmlFor={`${section}-visibility`}
                >
                    <input
                      checked={content.visibility[section]}
                      className="size-4 accent-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      id={`${section}-visibility`}
                      onChange={(event) => setVisibility(section, event.target.checked)}
                      type="checkbox"
                    />
                    Show
                </label>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    aria-label={`Move ${sectionTitles[section]} up`}
                    disabled={index === 0}
                    onClick={() => updateOrder(section, -1)}
                    size="icon-sm"
                    type="button"
                    variant="outline"
                  >
                    <ArrowUp aria-hidden="true" data-icon="inline-start" />
                  </Button>
                  <Button
                    aria-label={`Move ${sectionTitles[section]} down`}
                    disabled={index === content.sectionOrder.length - 1}
                    onClick={() => updateOrder(section, 1)}
                    size="icon-sm"
                    type="button"
                    variant="outline"
                  >
                    <ArrowDown aria-hidden="true" data-icon="inline-start" />
                  </Button>
                </div>
              </div>

              <div
                aria-hidden={!sectionIsOpen}
                className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
                  sectionIsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
                id={`${section}-editor-panel`}
              >
                <div className="min-h-0 overflow-hidden" inert={!sectionIsOpen}>
                  <FieldMessages messages={fieldErrors[`visibility.${section}`]} />
                  <div className="flex justify-end pt-3">
                    <Button
                      onClick={() => void resetSection(section)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Reset section to default
                    </Button>
                  </div>
              <FieldGroup className="pb-2 pt-3">
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
                  <FieldGroup>
                    <FieldDescription>
                      Choose a text color and optional custom icon for each item. Clear a color to use the section text color. Use contrasting colors for readability.
                    </FieldDescription>
                    {([
                      ["address", "Address"],
                      ["phone", "Phone"],
                      ["email", "Email"],
                      ["facebookUrl", "Facebook link"],
                      ["mapUrl", "Map link"],
                    ] as const).map(([field, label]) => (
                      <div className="flex min-w-0 flex-col gap-4 rounded-xl border border-border p-4" key={field}>
                        <Field>
                          <FieldLabel htmlFor={`contact-${field}`}>{label}</FieldLabel>
                          <Input
                            aria-invalid={Boolean(fieldErrors[`contact.${field}`])}
                            id={`contact-${field}`}
                            maxLength={field === "address" ? 500 : field === "phone" ? 50 : field.endsWith("Url") ? 2048 : 254}
                            onChange={(event) => setContent((current) => ({
                              ...current,
                              contact: { ...current.contact, [field]: event.target.value },
                            }))}
                            type={field === "email" ? "email" : field.endsWith("Url") ? "url" : "text"}
                            value={content.contact[field]}
                          />
                          <FieldMessages messages={fieldErrors[`contact.${field}`]} />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor={`contact-${field}-color`}>{label} text color</FieldLabel>
                          <div className="flex flex-wrap items-center gap-3">
                            <Input
                              className="h-11 w-16 p-1"
                              id={`contact-${field}-color`}
                              onChange={(event) => setContent((current) => ({
                                ...current, contact: { ...current.contact, appearance: {
                                  ...current.contact.appearance,
                                  [field]: { ...current.contact.appearance[field], textColor: event.target.value },
                                } },
                              }))}
                              type="color"
                              value={content.contact.appearance[field].textColor || content.sectionBackgrounds.contact.textColor || "#000000"}
                            />
                            <span className="text-sm text-muted-foreground">{content.contact.appearance[field].textColor || "Using section text color"}</span>
                            {content.contact.appearance[field].textColor && (
                              <Button onClick={() => setContent((current) => ({
                                ...current, contact: { ...current.contact, appearance: {
                                  ...current.contact.appearance,
                                  [field]: { ...current.contact.appearance[field], textColor: "" },
                                } },
                              }))} size="sm" type="button" variant="outline">Clear color</Button>
                            )}
                          </div>
                          <FieldMessages messages={fieldErrors[`contact.appearance.${field}.textColor`]} />
                        </Field>
                        <details>
                          <summary className="cursor-pointer text-sm font-medium">Custom {label.toLowerCase()} icon (optional)</summary>
                          <div className="mt-3">{imageFields(`contact:${field}`, "128 x 128 px", `${label} icon`)}</div>
                        </details>
                      </div>
                    ))}
                  </FieldGroup>
                )}
              </FieldGroup>
                  <div className="mt-4 border-t border-border pt-3">
                    {draftActionButtons(true)}
                  </div>
                </div>
              </div>
            </section>
            );
          })}
          <section
            aria-labelledby="footer-editor-heading"
            className="rounded-xl border border-border bg-card p-3 sm:p-4"
          >
            <Button
              aria-controls="footer-editor-panel"
              aria-expanded={openSection === "footer"}
              className="scroll-mt-24 w-full justify-between px-2 text-left"
              id="footer-editor-heading"
              onClick={() => void togglePanel("footer")}
              ref={(element) => {
                sectionHeaderRefs.current.footer = element;
              }}
              type="button"
              variant="ghost"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold">Footer</span>
                {JSON.stringify(content.footer) !== JSON.stringify(savedDraftContent.footer) && (
                  <>
                    <span
                      aria-label="Unsaved changes"
                      className="size-2 shrink-0 rounded-full bg-primary"
                      title="Unsaved changes"
                    />
                    <span className="sr-only">Unsaved changes</span>
                  </>
                )}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={`shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
                  openSection === "footer" ? "rotate-180" : ""
                }`}
              />
            </Button>
            <div
              aria-hidden={openSection !== "footer"}
              className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
                openSection === "footer" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
              id="footer-editor-panel"
            >
              <div className="min-h-0 overflow-hidden" inert={openSection !== "footer"}>
                <div className="flex justify-end pt-3">
                  <Button
                    onClick={() => void resetFooter()}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Reset footer to default
                  </Button>
                </div>
                <FieldGroup className="pb-2 pt-3">
                  <Field>
                    <FieldLabel htmlFor="footer-title">Footer title</FieldLabel>
                    <Input
                      aria-invalid={Boolean(fieldErrors["footer.title"])}
                      id="footer-title"
                      maxLength={120}
                      onChange={(event) => setContent((current) => ({
                        ...current,
                        footer: { ...current.footer, title: event.target.value },
                      }))}
                      value={content.footer.title}
                    />
                    <FieldMessages messages={fieldErrors["footer.title"]} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="footer-text">Footer text (optional)</FieldLabel>
                    <Textarea
                      aria-invalid={Boolean(fieldErrors["footer.text"])}
                      id="footer-text"
                      maxLength={500}
                      onChange={(event) => setContent((current) => ({
                        ...current,
                        footer: { ...current.footer, text: event.target.value },
                      }))}
                      placeholder="Add a copyright or other short footer message"
                      rows={2}
                      value={content.footer.text}
                    />
                    <FieldDescription>
                      Leave empty to show no additional footer message.
                    </FieldDescription>
                    <FieldMessages messages={fieldErrors["footer.text"]} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="footer-background-color">Footer background color (optional)</FieldLabel>
                    <div className="flex flex-wrap items-center gap-3">
                      <Input
                        className="h-11 w-16 p-1"
                        id="footer-background-color"
                        onChange={(event) => setContent((current) => ({
                          ...current,
                          footer: { ...current.footer, backgroundColor: event.target.value },
                        }))}
                        type="color"
                        value={content.footer.backgroundColor || "#00525d"}
                      />
                      <span className="text-sm text-muted-foreground">
                        {content.footer.backgroundColor || "Using the theme background color"}
                      </span>
                      {content.footer.backgroundColor && (
                        <Button
                          onClick={() => setContent((current) => ({
                            ...current,
                            footer: { ...current.footer, backgroundColor: "" },
                          }))}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Use theme color
                        </Button>
                      )}
                    </div>
                    <FieldDescription>Choose a background with enough contrast against the footer text.</FieldDescription>
                    <FieldMessages messages={fieldErrors["footer.backgroundColor"]} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="footer-text-color">Footer text color (optional)</FieldLabel>
                    <div className="flex flex-wrap items-center gap-3">
                      <Input
                        aria-label="Footer text color"
                        className="h-11 w-16 p-1"
                        id="footer-text-color"
                        onChange={(event) => setContent((current) => ({
                          ...current,
                          footer: { ...current.footer, textColor: event.target.value },
                        }))}
                        type="color"
                        value={content.footer.textColor || "#ffffff"}
                      />
                      <span className="text-sm text-muted-foreground">
                        {content.footer.textColor || "Using the current footer text color"}
                      </span>
                      {content.footer.textColor && (
                        <Button
                          onClick={() => setContent((current) => ({
                            ...current,
                            footer: { ...current.footer, textColor: "" },
                          }))}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Clear color
                        </Button>
                      )}
                    </div>
                    <FieldDescription>
                      Applies to the footer title and message. Choose a color with enough contrast against the footer background.
                    </FieldDescription>
                    <FieldMessages messages={fieldErrors["footer.textColor"]} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="footer-padding">Footer vertical spacing</FieldLabel>
                    <Input
                      aria-valuetext={`${content.footer.paddingY} pixels above and below`}
                      id="footer-padding"
                      max={48}
                      min={0}
                      onChange={(event) => setContent((current) => ({
                        ...current,
                        footer: { ...current.footer, paddingY: Number(event.target.value) },
                      }))}
                      step={2}
                      type="range"
                      value={content.footer.paddingY}
                    />
                    <FieldDescription>
                      {content.footer.paddingY}px above and below. Reduce this to make the public footer more compact.
                    </FieldDescription>
                    <FieldMessages messages={fieldErrors["footer.paddingY"]} />
                  </Field>
                  <TextStyleFields
                    fieldErrors={fieldErrors}
                    fieldPrefix="footer"
                    fontFamily={content.footer.fontFamily}
                    fontSizeScale={content.footer.fontSizeScale}
                    idPrefix="footer"
                    onChange={(field, value) => setContent((current) => ({
                      ...current,
                      footer: { ...current.footer, [field]: value },
                    }))}
                    textAlign={content.footer.textAlign}
                    onFontSizeScaleChange={(fontSizeScale) => setContent((current) => ({
                      ...current,
                      footer: { ...current.footer, fontSizeScale },
                    }))}
                  />
                </FieldGroup>
                <div className="mt-4 border-t border-border pt-3">
                  {draftActionButtons(true)}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <aside className="xl:sticky xl:top-24">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Live preview</h2>
            <p className="text-sm text-muted-foreground">Shows your draft using the real landing page at the selected screen width.</p>
          </div>
          <div aria-label="Preview size" className="flex gap-2">
            <Button aria-pressed={previewDevice === "desktop"} onClick={() => setPreviewDevice("desktop")} size="sm" type="button" variant={previewDevice === "desktop" ? "default" : "outline"}>Desktop</Button>
            <Button aria-pressed={previewDevice === "mobile"} onClick={() => setPreviewDevice("mobile")} size="sm" type="button" variant={previewDevice === "mobile" ? "default" : "outline"}>Mobile</Button>
          </div>
        </div>
        <LandingPagePreviewFrame content={content} imageUrls={uploadedUrls} device={previewDevice} />
        <Dialog>
          <DialogTrigger render={<Button className="mt-3" type="button" variant="outline" />}>Enlarge preview</DialogTrigger>
          <DialogContent className="h-[90dvh] w-[96vw] max-w-none grid-rows-[auto_auto_1fr] sm:max-w-none">
            <DialogHeader>
              <DialogTitle>Landing page preview</DialogTitle>
              <DialogDescription>Preview your unpublished changes at the selected screen width.</DialogDescription>
            </DialogHeader>
            <div aria-label="Preview size" className="flex gap-2">
              <Button aria-pressed={previewDevice === "desktop"} onClick={() => setPreviewDevice("desktop")} size="sm" type="button" variant={previewDevice === "desktop" ? "default" : "outline"}>Desktop</Button>
              <Button aria-pressed={previewDevice === "mobile"} onClick={() => setPreviewDevice("mobile")} size="sm" type="button" variant={previewDevice === "mobile" ? "default" : "outline"}>Mobile</Button>
            </div>
            <LandingPagePreviewFrame content={content} imageUrls={uploadedUrls} device={previewDevice} expanded />
          </DialogContent>
        </Dialog>
      </aside>
    </div>
  );
}
