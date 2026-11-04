"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/server";
import {
  announcementBucket,
  announcementImageMaxBytes,
  announcementMaxImages,
  announcementPdfMaxBytes,
  getAnnouncementFileExtension,
} from "@/lib/announcements";
import { createClient } from "@/lib/supabase/server";

const uuidSchema = z.uuid();
const fileUploadSchema = z.object({
  name: z.string().trim().min(1).max(255),
  size: z.number().int().positive(),
  contentType: z.string().min(1).max(100),
});
const uploadRequestSchema = z.object({
  announcementId: uuidSchema,
  files: z.array(fileUploadSchema).min(1).max(announcementMaxImages),
});
const fileReferenceSchema = z.object({
  path: z.string().min(1).max(500),
  name: z.string().min(1).max(255),
});
const presentationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("pdf"), file: fileReferenceSchema }),
  z.object({
    type: z.literal("images"),
    files: z.array(fileReferenceSchema).min(1).max(announcementMaxImages),
  }),
]);
const contentSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().max(3000),
  presentation: presentationSchema.optional(),
});

function isValidAnnouncementPath(path: string, announcementId: string) {
  return new RegExp(
    `^${announcementId}/[0-9a-f-]{36}\\.(pdf|jpg|jpeg|png|webp)$`,
    "i",
  ).test(path);
}

function safeFileName(name: string) {
  return name.replace(/[^\w.-]/g, "_").slice(0, 255);
}

function getPresentationValues(
  presentation: z.infer<typeof presentationSchema> | undefined,
  announcementId: string,
) {
  if (!presentation) {
    return null;
  }

  if (presentation.type === "pdf") {
    if (
      !isValidAnnouncementPath(presentation.file.path, announcementId) ||
      !presentation.file.path.toLowerCase().endsWith(".pdf")
    ) {
      return null;
    }

    return {
      pdf_path: presentation.file.path,
      pdf_name: safeFileName(presentation.file.name),
      slide_paths: [],
      slide_names: [],
    };
  }

  if (
    presentation.files.some(
      (file) =>
        !isValidAnnouncementPath(file.path, announcementId) ||
        !/\.(jpg|jpeg|png|webp)$/i.test(file.path),
    )
  ) {
    return null;
  }

  return {
    pdf_path: null,
    pdf_name: null,
    slide_paths: presentation.files.map((file) => file.path),
    slide_names: presentation.files.map((file) => safeFileName(file.name)),
  };
}

export async function beginAnnouncementUploadsAction(
  request: z.input<typeof uploadRequestSchema>,
) {
  await requireAdminUser();
  const parsed = uploadRequestSchema.safeParse(request);
  if (!parsed.success) {
    return { status: "error" as const, message: "Invalid file upload request." };
  }

  const { announcementId, files } = parsed.data;
  if (
    files.some(
      ({ name, contentType, size }) =>
        !getAnnouncementFileExtension(name, contentType, size),
    )
  ) {
    return {
      status: "error" as const,
      message: `PDF presentations must be under ${announcementPdfMaxBytes / (1024 * 1024)} MB. Each slide image must be PNG, JPG, or WebP under ${announcementImageMaxBytes / (1024 * 1024)} MB.`,
    };
  }

  const isPdf = files.length === 1 && files[0].contentType === "application/pdf";
  const isImages = files.every(({ contentType }) =>
    contentType.startsWith("image/"),
  );
  if (!isPdf && !isImages) {
    return {
      status: "error" as const,
      message: "Upload one PDF presentation or a set of slide images, not both.",
    };
  }

  const supabase = await createClient();
  const uploads = [];
  for (const file of files) {
    const extension = getAnnouncementFileExtension(
      file.name,
      file.contentType,
      file.size,
    );
    if (!extension) {
      return {
        status: "error" as const,
        message: "One or more presentation files are invalid.",
      };
    }

    const path = `${announcementId}/${randomUUID()}${extension}`;
    const { data, error } = await supabase.storage
      .from(announcementBucket)
      .createSignedUploadUrl(path, { upsert: false });

    if (error) {
      console.error("Unable to create announcement upload URL.", error);
      return {
        status: "error" as const,
        message: "We couldn’t prepare the presentation upload. Please try again.",
      };
    }

    uploads.push({
      name: safeFileName(file.name),
      path: data.path,
      token: data.token,
    });
  }

  return { status: "success" as const, uploads };
}

export async function cleanupAnnouncementUploadsAction(
  announcementId: string,
  paths: string[],
) {
  await requireAdminUser();
  const id = uuidSchema.safeParse(announcementId);
  if (
    !id.success ||
    paths.length > announcementMaxImages ||
    paths.some((path) => !isValidAnnouncementPath(path, id.data))
  ) {
    return { status: "error" as const };
  }

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(announcementBucket)
    .remove(paths);
  if (error) {
    console.error("Unable to clean up announcement uploads.", error);
    return { status: "error" as const };
  }
  return { status: "success" as const };
}

export async function createAnnouncementAction(
  announcementId: string,
  content: z.input<typeof contentSchema>,
) {
  await requireAdminUser();
  const id = uuidSchema.safeParse(announcementId);
  const parsed = contentSchema.safeParse(content);
  if (!id.success || !parsed.success || !parsed.data.presentation) {
    return {
      status: "error" as const,
      message: "Check the announcement details and presentation.",
    };
  }

  const presentation = getPresentationValues(
    parsed.data.presentation,
    id.data,
  );
  if (!presentation) {
    return {
      status: "error" as const,
      message: "Invalid presentation file paths.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({
    id: id.data,
    title: parsed.data.title,
    body: parsed.data.body,
    ...presentation,
  });
  if (error) {
    console.error("Unable to create announcement.", error);
    return {
      status: "error" as const,
      message: "We couldn’t publish this announcement. Please try again.",
    };
  }

  revalidatePath("/");
  revalidatePath("/admin/announcements");
  return { status: "success" as const };
}

export async function updateAnnouncementAction(
  announcementId: string,
  content: z.input<typeof contentSchema>,
) {
  await requireAdminUser();
  const id = uuidSchema.safeParse(announcementId);
  const parsed = contentSchema.safeParse(content);
  if (!id.success || !parsed.success) {
    return {
      status: "error" as const,
      message: "Check the announcement details and presentation.",
    };
  }

  const supabase = await createClient();
  const { data: current, error: loadError } = await supabase
    .from("announcements")
    .select("pdf_path, slide_paths")
    .eq("id", id.data)
    .maybeSingle();
  if (loadError) {
    console.error("Unable to load announcement before update.", loadError);
    return {
      status: "error" as const,
      message: "We couldn’t load this announcement. Please refresh and try again.",
    };
  }
  if (!current) {
    return {
      status: "error" as const,
      message: "This announcement could not be found. Refresh and try again.",
    };
  }

  const presentation = parsed.data.presentation
    ? getPresentationValues(parsed.data.presentation, id.data)
    : null;
  if (parsed.data.presentation && !presentation) {
    return {
      status: "error" as const,
      message: "Invalid presentation file paths.",
    };
  }

  const { data, error } = await supabase
    .from("announcements")
    .update({
      title: parsed.data.title,
      body: parsed.data.body,
      ...(presentation ?? {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id.data)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Unable to update announcement.", error);
    return {
      status: "error" as const,
      message: "We couldn’t save this announcement. Please try again.",
    };
  }
  if (!data) {
    return {
      status: "error" as const,
      message: "This announcement could not be found. Refresh and try again.",
    };
  }

  let cleanupWarning = false;
  if (presentation) {
    const previousPaths = [
      ...(current.pdf_path ? [current.pdf_path] : []),
      ...current.slide_paths,
    ];
    if (previousPaths.length > 0) {
      const { error: cleanupError } = await supabase.storage
        .from(announcementBucket)
        .remove(previousPaths);
      if (cleanupError) {
        cleanupWarning = true;
        console.error(
          "Unable to remove replaced announcement files.",
          cleanupError,
        );
      }
    }
  }

  revalidatePath("/");
  revalidatePath("/admin/announcements");
  return { status: "success" as const, cleanupWarning };
}

export async function archiveAnnouncementAction(announcementId: string) {
  await requireAdminUser();
  const id = uuidSchema.safeParse(announcementId);
  if (!id.success) {
    return { status: "error" as const, message: "Invalid announcement." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id.data)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Unable to archive announcement.", error);
    return {
      status: "error" as const,
      message: "We couldn’t archive this announcement. Please try again.",
    };
  }
  if (!data) {
    return {
      status: "error" as const,
      message: "This announcement is no longer available. Refresh and try again.",
    };
  }

  revalidatePath("/");
  revalidatePath("/admin/announcements");
  return { status: "success" as const };
}

export async function restoreAnnouncementAction(announcementId: string) {
  await requireAdminUser();
  const id = uuidSchema.safeParse(announcementId);
  if (!id.success) {
    return { status: "error" as const, message: "Invalid announcement." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .update({ archived_at: null, updated_at: new Date().toISOString() })
    .eq("id", id.data)
    .not("archived_at", "is", null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Unable to restore announcement.", error);
    return {
      status: "error" as const,
      message: "We couldn’t restore this announcement. Please try again.",
    };
  }
  if (!data) {
    return {
      status: "error" as const,
      message: "This announcement is no longer available. Refresh and try again.",
    };
  }

  revalidatePath("/");
  revalidatePath("/admin/announcements");
  return { status: "success" as const };
}
