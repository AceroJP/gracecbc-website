"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/server";
import { getCloudConvertApiKey } from "@/lib/env.server";
import {
  announcementBucket,
  announcementMaxCategories,
  announcementImageMaxBytes,
  announcementMaxImages,
  announcementPowerPointMaxBytes,
  announcementPdfMaxBytes,
  announcementPowerPointMimeTypes,
  getAnnouncementFileExtension,
  getAnnouncementCategoryLabel,
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
  purpose: z.enum(["presentation", "background"]),
  files: z.array(fileUploadSchema).min(1).max(announcementMaxImages),
});
const fileReferenceSchema = z.object({
  path: z.string().min(1).max(500),
  name: z.string().min(1).max(255),
});
const cloudConvertJobSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    status: z.enum(["waiting", "processing", "finished", "error"]),
    tasks: z
      .array(
        z.object({
          name: z.string().optional(),
          status: z.enum(["waiting", "processing", "finished", "error"]).optional(),
          message: z.string().nullable().optional(),
          result: z
            .object({
              files: z.array(
                z.object({
                  filename: z.string(),
                  url: z.url(),
                  size: z.number().optional(),
                }),
              ),
            })
            .nullable()
            .optional(),
        }),
      )
      .optional(),
  }),
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
  categories: z
    .array(z.string().trim().min(1).max(50))
    .max(announcementMaxCategories)
    .refine(
      (categories) =>
        new Set(
          categories.map((category) =>
            getAnnouncementCategoryLabel(category).toLocaleLowerCase(),
          ),
        ).size === categories.length,
      "Announcement labels must be unique.",
    ),
  presentation: presentationSchema.nullable().optional(),
  background: fileReferenceSchema.nullable().optional(),
});

function isValidAnnouncementPath(path: string, announcementId: string) {
  return new RegExp(
    `^${announcementId}/[0-9a-f-]{36}\\.(pdf|ppt|pptx|jpg|jpeg|png|webp)$`,
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

  if (new Set(presentation.files.map((file) => file.path)).size !== presentation.files.length) {
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

  const { announcementId, purpose, files } = parsed.data;
  if (
    files.some(
      ({ name, contentType, size }) =>
        !getAnnouncementFileExtension(name, contentType, size),
    )
  ) {
    return {
      status: "error" as const,
      message: `PDF files must be under ${announcementPdfMaxBytes / (1024 * 1024)} MB and PowerPoint files under ${announcementPowerPointMaxBytes / (1024 * 1024)} MB. Each slide image must be PNG, JPG, or WebP under ${announcementImageMaxBytes / (1024 * 1024)} MB.`,
    };
  }

  const isPdf = files.length === 1 && files[0].contentType === "application/pdf";
  const isPowerPoint =
    files.length === 1 &&
    Object.keys(announcementPowerPointMimeTypes).includes(files[0].contentType);
  const isImages = files.every(({ contentType }) =>
    contentType.startsWith("image/"),
  );
  if (
    (purpose === "presentation" && !isPdf && !isPowerPoint && !isImages) ||
    (purpose === "background" &&
      (files.length !== 1 || !files[0].contentType.startsWith("image/")))
  ) {
    return {
      status: "error" as const,
      message: "Upload one PDF or PowerPoint file, or a set of slide images.",
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

export async function convertAnnouncementPowerPointAction(
  announcementId: string,
  file: z.input<typeof fileReferenceSchema>,
) {
  await requireAdminUser();
  const id = uuidSchema.safeParse(announcementId);
  const parsedFile = fileReferenceSchema.safeParse(file);
  if (
    !id.success ||
    !parsedFile.success ||
    !new RegExp(`^${id.data}/[0-9a-f-]{36}\\.(ppt|pptx)$`, "i").test(
      parsedFile.data.path,
    )
  ) {
    return {
      status: "error" as const,
      message: "Invalid PowerPoint file for conversion.",
    };
  }

  const supabase = await createClient();
  let apiKey: string | null = null;
  let jobId: string | null = null;
  let convertedPath: string | null = null;
  let convertedFile: { path: string; name: string } | null = null;
  let conversionError: string | null = null;
  let jobCleanupWarning = false;

  try {
    apiKey = getCloudConvertApiKey();
    const { data: signedFile, error: signedUrlError } = await supabase.storage
      .from(announcementBucket)
      .createSignedUrl(parsedFile.data.path, 10 * 60);
    if (signedUrlError) {
      throw new Error("We couldn’t prepare the PowerPoint for conversion.");
    }

    const extension = parsedFile.data.path.toLowerCase().endsWith(".pptx")
      ? "pptx"
      : "ppt";
    const createResponse = await fetch("https://api.cloudconvert.com/v2/jobs", {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tasks: {
          "import-presentation": {
            operation: "import/url",
            url: signedFile.signedUrl,
            filename: parsedFile.data.name,
          },
          "convert-presentation": {
            operation: "convert",
            input: "import-presentation",
            input_format: extension,
            output_format: "pdf",
            filename: `${parsedFile.data.name.replace(/\.(ppt|pptx)$/i, "")}.pdf`,
            timeout: 40,
          },
          "export-presentation": {
            operation: "export/url",
            input: "convert-presentation",
          },
        },
        tag: `announcement-${id.data}`,
      }),
    });
    if (!createResponse.ok) {
      console.error(
        "CloudConvert job creation failed.",
        createResponse.status,
      );
      throw new Error(
        "PowerPoint conversion could not be started. Please try again.",
      );
    }

    const createPayload: unknown = await createResponse.json();
    const createdJob = cloudConvertJobSchema.safeParse(createPayload);
    if (!createdJob.success) {
      throw new Error("PowerPoint conversion returned an invalid response.");
    }
    jobId = createdJob.data.data.id;

    const deadline = Date.now() + 40_000;
    let job = createdJob.data.data;
    while (job.status === "waiting" || job.status === "processing") {
      if (Date.now() >= deadline) {
        throw new Error(
          "PowerPoint conversion is taking longer than expected. Please try again.",
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
      const statusResponse = await fetch(
        `https://api.cloudconvert.com/v2/jobs/${encodeURIComponent(jobId)}?include=tasks`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      );
      if (!statusResponse.ok) {
        console.error(
          "Unable to check CloudConvert job status.",
          statusResponse.status,
        );
        throw new Error("Unable to check PowerPoint conversion status.");
      }

      const statusPayload: unknown = await statusResponse.json();
      const statusJob = cloudConvertJobSchema.safeParse(statusPayload);
      if (!statusJob.success) {
        throw new Error("PowerPoint conversion returned an invalid status.");
      }
      job = statusJob.data.data;
    }

    if (job.status !== "finished") {
      throw new Error(
        "PowerPoint conversion failed. Check that the file opens correctly, then try again.",
      );
    }

    const output = job.tasks
      ?.find((task) => task.name === "export-presentation")
      ?.result?.files[0];
    if (!output) {
      throw new Error("PowerPoint conversion did not produce a PDF.");
    }

    const outputUrl = new URL(output.url);
    if (
      outputUrl.protocol !== "https:" ||
      outputUrl.hostname !== "storage.cloudconvert.com"
    ) {
      throw new Error("PowerPoint conversion returned an invalid download URL.");
    }
    if (output.size !== undefined && output.size > announcementPdfMaxBytes) {
      throw new Error(
        `The converted PDF exceeds the ${announcementPdfMaxBytes / (1024 * 1024)} MB limit.`,
      );
    }

    const pdfResponse = await fetch(outputUrl, { cache: "no-store" });
    if (!pdfResponse.ok || !pdfResponse.body) {
      throw new Error("Unable to download the converted PDF.");
    }

    const reader = pdfResponse.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      totalBytes += value.byteLength;
      if (totalBytes > announcementPdfMaxBytes) {
        await reader.cancel();
        throw new Error(
          `The converted PDF exceeds the ${announcementPdfMaxBytes / (1024 * 1024)} MB limit.`,
        );
      }
      chunks.push(value);
    }

    const pdfBytes = Buffer.concat(chunks);
    if (
      pdfBytes.length === 0 ||
      pdfBytes.subarray(0, 5).toString("ascii") !== "%PDF-"
    ) {
      throw new Error("The converted file is not a valid PDF.");
    }

    const pdfName = safeFileName(
      `${parsedFile.data.name.replace(/\.(ppt|pptx)$/i, "")}.pdf`,
    );
    const pdfPath = `${id.data}/${randomUUID()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from(announcementBucket)
      .upload(pdfPath, pdfBytes, {
        cacheControl: "3600",
        contentType: "application/pdf",
        upsert: false,
      });
    if (uploadError) {
      console.error("Unable to store converted announcement PDF.", uploadError);
      throw new Error("Unable to save the converted PDF. Please try again.");
    }
    convertedPath = pdfPath;
    convertedFile = { path: pdfPath, name: pdfName };
  } catch (error) {
    console.error("Announcement PowerPoint conversion failed.", error);
    conversionError =
      error instanceof Error
        ? error.message
        : "PowerPoint conversion failed. Please try again.";
  } finally {
    if (jobId && apiKey) {
      try {
        const deleteResponse = await fetch(
          `https://api.cloudconvert.com/v2/jobs/${encodeURIComponent(jobId)}`,
          {
            method: "DELETE",
            cache: "no-store",
            headers: { Authorization: `Bearer ${apiKey}` },
          },
        );
        if (!deleteResponse.ok) {
          jobCleanupWarning = true;
          console.error(
            "Unable to delete temporary CloudConvert job.",
            deleteResponse.status,
          );
        }
      } catch (error) {
        jobCleanupWarning = true;
        console.error("Unable to delete temporary CloudConvert job.", error);
      }
    }
  }

  if (conversionError) {
    if (convertedPath) {
      const { error } = await supabase.storage
        .from(announcementBucket)
        .remove([convertedPath]);
      if (error) {
        console.error("Unable to clean up converted announcement PDF.", error);
      }
    }
    return {
      status: "error" as const,
      message: conversionError,
    };
  }

  if (convertedFile) {
    return {
      status: "success" as const,
      file: convertedFile,
      cleanupWarning: jobCleanupWarning,
    };
  }

  return {
    status: "error" as const,
    message: "PowerPoint conversion failed. Please try again.",
  };
}

export async function cleanupAnnouncementUploadsAction(
  announcementId: string,
  paths: string[],
) {
  await requireAdminUser();
  const id = uuidSchema.safeParse(announcementId);
  if (
    !id.success ||
    paths.length > announcementMaxImages + 2 ||
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
  if (!id.success || !parsed.success) {
    return {
      status: "error" as const,
      message: "Check the announcement details and presentation.",
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
  const background = parsed.data.background;
  if (
    background &&
    (!isValidAnnouncementPath(background.path, id.data) ||
      !/\.(jpg|jpeg|png|webp)$/i.test(background.path))
  ) {
    return { status: "error" as const, message: "Invalid background image path." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({
    id: id.data,
    title: parsed.data.title,
    body: parsed.data.body,
    categories: [...new Set(parsed.data.categories)],
    pdf_path: presentation?.pdf_path ?? null,
    pdf_name: presentation?.pdf_name ?? null,
    slide_paths: presentation?.slide_paths ?? [],
    slide_names: presentation?.slide_names ?? [],
    background_path: background?.path ?? null,
    background_name: background ? safeFileName(background.name) : null,
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
    .select("pdf_path, slide_paths, background_path")
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

  let presentation:
    | {
        pdf_path: string | null;
        pdf_name: string | null;
        slide_paths: string[];
        slide_names: string[];
      }
    | undefined;
  if (parsed.data.presentation === null) {
    presentation = {
      pdf_path: null,
      pdf_name: null,
      slide_paths: [],
      slide_names: [],
    };
  } else if (parsed.data.presentation) {
    presentation = getPresentationValues(
      parsed.data.presentation,
      id.data,
    ) ?? undefined;
    if (!presentation) {
      return {
        status: "error" as const,
        message: "Invalid presentation file paths.",
      };
    }
  }
  const background = parsed.data.background;
  if (
    background &&
    (!isValidAnnouncementPath(background.path, id.data) ||
      !/\.(jpg|jpeg|png|webp)$/i.test(background.path))
  ) {
    return { status: "error" as const, message: "Invalid background image path." };
  }

  const { data, error } = await supabase
    .from("announcements")
    .update({
      title: parsed.data.title,
      body: parsed.data.body,
      categories: [...new Set(parsed.data.categories)],
      ...(presentation ?? {}),
      ...(parsed.data.background === undefined
        ? {}
        : {
            background_path: background?.path ?? null,
            background_name: background
              ? safeFileName(background.name)
              : null,
          }),
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
  const nextPaths = [
    ...(presentation === undefined
      ? [
          ...(current.pdf_path ? [current.pdf_path] : []),
          ...current.slide_paths,
        ]
      : [
          ...(presentation?.pdf_path ? [presentation.pdf_path] : []),
          ...(presentation?.slide_paths ?? []),
        ]),
    ...(parsed.data.background === undefined
      ? current.background_path
        ? [current.background_path]
        : []
      : background?.path
        ? [background.path]
        : []),
  ];
  const previousPaths = [
    ...(current.pdf_path ? [current.pdf_path] : []),
    ...current.slide_paths,
    ...(current.background_path ? [current.background_path] : []),
  ];
  const removedPaths = previousPaths.filter((path) => !nextPaths.includes(path));
  if (removedPaths.length > 0) {
    const { error: cleanupError } = await supabase.storage
      .from(announcementBucket)
      .remove(removedPaths);
    if (cleanupError) {
      cleanupWarning = true;
      console.error("Unable to remove deleted announcement files.", cleanupError);
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
