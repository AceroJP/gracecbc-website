"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/server";
import {
  getDefaultLandingPageContent,
  landingPageSectionKeys,
  parseLandingPageContent,
} from "@/lib/landing-page";
import { createClient } from "@/lib/supabase/server";

type ActionResult =
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> };

function validationResult(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): ActionResult {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".");
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }
  return {
    status: "error",
    message: "Review the highlighted fields before saving.",
    fieldErrors,
  };
}

function reportDatabaseError(message: string, error: unknown): never {
  throw new Error(message, { cause: error });
}

export async function saveLandingPageDraftAction(
  input: unknown,
): Promise<ActionResult> {
  await requireAdminUser();
  const parsed = parseLandingPageContent(input);
  if (!parsed.success) {
    return validationResult(parsed.error);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("landing_page_drafts").upsert(
    {
      id: true,
      content: parsed.data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) {
    reportDatabaseError("Unable to save the landing page draft.", error);
  }

  revalidatePath("/admin/landing-page");
  return { status: "success", message: "Draft saved. The public page is unchanged." };
}

export async function publishLandingPageAction(
  input: unknown,
): Promise<ActionResult> {
  await requireAdminUser();
  const parsed = parseLandingPageContent(input);
  if (!parsed.success) {
    return validationResult(parsed.error);
  }

  const supabase = await createClient();
  const { data: publishedRow, error: publishedReadError } = await supabase
    .from("landing_page_published")
    .select("content")
    .eq("id", true)
    .maybeSingle();
  if (publishedReadError) {
    reportDatabaseError("Unable to check the published landing page.", publishedReadError);
  }

  let shouldUpdatePublished = true;
  if (publishedRow) {
    const currentPublished = parseLandingPageContent(publishedRow.content);
    if (!currentPublished.success) {
      throw new Error("Published landing page content is invalid.", {
        cause: currentPublished.error,
      });
    }
    shouldUpdatePublished =
      JSON.stringify(currentPublished.data) !== JSON.stringify(parsed.data);
  }

  const publishedAt = new Date().toISOString();
  const { error: draftError } = await supabase.from("landing_page_drafts").upsert(
    {
      id: true,
      content: parsed.data,
      updated_at: publishedAt,
    },
    { onConflict: "id" },
  );
  if (draftError) {
    reportDatabaseError("Unable to save the landing page draft before publishing.", draftError);
  }

  if (shouldUpdatePublished) {
    const { error } = await supabase.from("landing_page_published").upsert(
      { id: true, content: parsed.data, published_at: publishedAt },
      { onConflict: "id" },
    );
    if (error) {
      reportDatabaseError("Unable to publish the landing page.", error);
    }
  }

  revalidatePath("/admin/landing-page");
  if (shouldUpdatePublished) {
    revalidatePath("/");
    return { status: "success", message: "The public homepage has been updated." };
  }

  return { status: "success", message: "No homepage changes needed publishing." };
}

export async function discardLandingPageDraftAction(): Promise<ActionResult> {
  await requireAdminUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("landing_page_published")
    .select("content")
    .eq("id", true)
    .maybeSingle();
  if (error) {
    reportDatabaseError("Unable to load the published landing page.", error);
  }

  const parsed = data
    ? parseLandingPageContent(data.content)
    : { success: true as const, data: getDefaultLandingPageContent() };
  if (!parsed.success) {
    reportDatabaseError("Published landing page content is invalid.", parsed.error);
  }

  const { error: draftError } = await supabase.from("landing_page_drafts").upsert(
    {
      id: true,
      content: parsed.data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (draftError) {
    reportDatabaseError("Unable to discard the landing page draft.", draftError);
  }

  revalidatePath("/admin/landing-page");
  return { status: "success", message: "Draft discarded. Published content is unchanged." };
}

export async function uploadLandingPageImageAction(
  formData: FormData,
): Promise<
  | { status: "success"; path: string; url: string; alt: string }
  | { status: "error"; message: string }
> {
  await requireAdminUser();
  const file = formData.get("image");
  const section = formData.get("section");
  const altValue = formData.get("alt");
  const imageSection =
    section === "hero" || section === "welcome" || section === "header-logo"
      ? section
      : typeof section === "string" &&
          section.startsWith("background:") &&
          landingPageSectionKeys.includes(
            section.slice("background:".length) as (typeof landingPageSectionKeys)[number],
          )
        ? section
        : null;

  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose an image to upload." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { status: "error", message: "Image must be 5 MB or smaller." };
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return { status: "error", message: "Use a JPG, PNG, or WebP image." };
  }
  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const matchesMimeType =
    file.type === "image/jpeg"
      ? signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff
      : file.type === "image/png"
        ? signature.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10"
        : signature.length >= 12 &&
          String.fromCharCode(...signature.slice(0, 4)) === "RIFF" &&
          String.fromCharCode(...signature.slice(8, 12)) === "WEBP";
  if (!matchesMimeType) {
    return { status: "error", message: "The selected file does not match its image type." };
  }
  const sanitizedAlt =
    typeof altValue === "string"
      ? altValue.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f\u007f]/g, " ").trim()
      : "";
  if (!imageSection || !sanitizedAlt || sanitizedAlt.length > 250) {
    return { status: "error", message: "Add descriptive alt text before uploading." };
  }

  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[file.type];
  const path = `${imageSection.replace(":", "/")}/${randomUUID()}.${extension}`;
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from("landing-page-images")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    reportDatabaseError("Unable to upload the landing page image.", error);
  }

  const url = supabase.storage.from("landing-page-images").getPublicUrl(path).data.publicUrl;
  return { status: "success", path, url, alt: sanitizedAlt };
}

