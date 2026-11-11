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
import {
  parseLandingPageContent,
  resetLandingPageSection,
  type LandingPageContent,
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
  imageUrls: { hero: string | null; welcome: string | null };
  publishedImageUrls: { hero: string | null; welcome: string | null };
  announcements: Array<{ id: string; title: string }>;
};

type ImageSlot = "hero" | "welcome";
type ScheduleRow = LandingPageContent["schedule"]["rows"][number];
type ActionResponse = Awaited<ReturnType<typeof saveLandingPageDraftAction>>;

function isActionError(result: ActionResponse): result is Extract<ActionResponse, { status: "error" }> {
  return result.status === "error";
}

function FieldMessages({ messages }: { messages?: string[] }) {
  return messages?.length ? <FieldError>{messages.join(" ")}</FieldError> : null;
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
  const [imageBusy, setImageBusy] = useState<ImageSlot | null>(null);
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
      return;
    }
    setBusy(true);
    try {
      const result = await action();
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

  function resetSection(section: LandingPageSectionKey) {
    if (!window.confirm(`Reset ${sectionTitles[section]} to its default settings?`)) {
      return;
    }
    setContent((current) => resetLandingPageSection(current, section));
    if (section === "hero" || section === "welcome") {
      setUploadedUrls((current) => ({ ...current, [section]: null }));
    }
    clearFieldErrors();
  }

  async function discardDraft() {
    if (!window.confirm("Discard all unpublished edits and restore the published version?")) {
      return;
    }
    setBusy(true);
    try {
      const result = await discardLandingPageDraftAction();
      if (isActionError(result)) {
        throw new Error(result.message);
      }
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
    if (!(file instanceof File) || !file.size) {
      setFieldErrors({ [`${slot}.image`]: ["Choose an image to upload."] });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors({ [`${slot}.image`]: ["Image must be 5 MB or smaller."] });
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFieldErrors({ [`${slot}.image`]: ["Use a JPG, PNG, or WebP image."] });
      return;
    }
    if (typeof alt !== "string" || !alt.trim()) {
      setFieldErrors({ [`${slot}.image.alt`]: ["Add alt text before uploading."] });
      return;
    }

    setImageBusy(slot);
    clearFieldErrors();
    try {
      const result = await uploadLandingPageImageAction(formData);
      if (result.status === "error") {
        setFieldErrors({ [`${slot}.image`]: [result.message] });
        return;
      }
      setContent((current) => ({
        ...current,
        [slot]: { ...current[slot], image: { path: result.path, alt: result.alt } },
      }));
      setUploadedUrls((current) => ({ ...current, [slot]: result.url }));
      form.reset();
    } catch (error) {
      console.error("Landing page image upload failed.", error);
      setFieldErrors({ [`${slot}.image`]: ["Unable to upload this image. Please try again."] });
    } finally {
      setImageBusy(null);
    }
  }

  function removeImage(slot: ImageSlot) {
    if (!window.confirm("Remove this image from the draft?")) {
      return;
    }
    setContent((current) => ({
      ...current,
      [slot]: { ...current[slot], image: { path: null, alt: "" } },
    }));
    setUploadedUrls((current) => ({ ...current, [slot]: null }));
  }

  function imageFields(slot: ImageSlot, recommendedSize: string) {
    const image = content[slot].image;
    const path = `${slot}.image`;
    return (
      <div className="flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor={`${slot}-alt`}>Photo alt text (required for upload)</FieldLabel>
          <Input
            aria-invalid={Boolean(fieldErrors[`${path}.alt`])}
            id={`${slot}-alt`}
            maxLength={250}
            required={Boolean(image.path)}
            onChange={(event) =>
              setContent((current) => ({
                ...current,
                [slot]: {
                  ...current[slot],
                  image: { ...current[slot].image, alt: event.target.value },
                },
              }))
            }
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
                if (!window.confirm("Publish these changes to the public homepage?")) {
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
                    onClick={() => resetSection(section)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Reset section to default
                  </Button>
                </div>
              </div>

              <FieldGroup className="mt-5">
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
                            onClick={() => {
                              if (!window.confirm("Remove this hero button?")) return;
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
                          onClick={() => {
                            if (!window.confirm("Remove this worship schedule row?")) return;
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
              {content.sectionOrder.map((section) => {
                if (!content.visibility[section]) return null;
                if (section === "hero" && content.hero.headline) {
                  return (
                    <section className="rounded-xl bg-brand p-5 text-white" key={section}>
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
                    <section className="rounded-xl border border-border p-4" key={section}>
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
                    <section className="rounded-xl border border-border p-4" key={section}>
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
                    <section className="rounded-xl border border-border p-4" key={section}>
                      <p className="font-semibold">{content.livestream.label || "Livestream"}</p>
                      <p className="mt-2 break-all text-sm text-muted-foreground">{content.livestream.url}</p>
                    </section>
                  );
                }
                if (section === "announcements" || section === "events") {
                  return (
                    <section className="rounded-xl border border-border p-4" key={section}>
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
                    <section className="rounded-xl border border-border p-4" key={section}>
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
                    <section className="rounded-xl border border-border p-4" key={section}>
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
