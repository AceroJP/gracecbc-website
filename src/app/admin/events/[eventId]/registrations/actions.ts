"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createPrivilegedClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/server";
import { getTurnstileSecret } from "@/lib/env.server";
import {
  getRegistrationUploadExtensionFromMetadata,
  hasRegistrationUploadSignature,
  parseRegistrationFileAnswer,
  parseRegistrationFields,
  registrationFileBucket,
  safeRegistrationFilename,
  validateRegistrationAnswers,
  type RegistrationFileAnswer,
  type RegistrationField,
} from "@/lib/registration";
import { createClient } from "@/lib/supabase/server";
import {
  createRegistrationUploadTicket,
  verifyRegistrationUploadTicket,
} from "@/lib/registration-upload.server";

export type RegistrationManagementState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const uuidSchema = z.uuid();
const adminUploadRequestSchema = z.object({
  name: z.string().min(1).max(500),
  size: z.number().int().positive(),
  lastModified: z.number().int().nonnegative(),
  contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
});
type AdminRegistrationUploadResult =
  | { status: "error"; message: string }
  | {
      status: "success";
      upload: {
        path: string;
        token: string;
        ticket: string;
        contentType: "application/pdf" | "image/jpeg" | "image/png";
      };
    };

function invalidRequest(): RegistrationManagementState {
  return {
    status: "error",
    message: "This registration could not be found. Refresh and try again.",
  };
}

function errorState(): RegistrationManagementState {
  return {
    status: "error",
    message: "We couldn’t update this registration right now. Please try again.",
  };
}

function registrationsPath(eventId: string) {
  return `/admin/events/${eventId}/registrations`;
}

export async function beginAdminRegistrationUploadAction(
  eventId: string,
  registrationId: string,
  fieldId: string,
  request: z.input<typeof adminUploadRequestSchema>,
): Promise<AdminRegistrationUploadResult> {
  await requireAdminUser();
  const parsed = adminUploadRequestSchema.safeParse(request);
  if (
    !uuidSchema.safeParse(eventId).success ||
    !uuidSchema.safeParse(registrationId).success ||
    !uuidSchema.safeParse(fieldId).success ||
    !parsed.success
  ) {
    return { status: "error" as const, message: "Invalid file upload request." };
  }

  const extension = getRegistrationUploadExtensionFromMetadata(
    parsed.data.name,
    parsed.data.contentType,
    parsed.data.size,
  );
  if (!extension) {
    return {
      status: "error" as const,
      message: "Files must be PDF, JPG, or PNG and no larger than 5 MB.",
    };
  }

  const supabase = await createClient();
  const { data: registration, error } = await supabase
    .from("event_registrations")
    .select("form_snapshot")
    .eq("id", registrationId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) {
    console.error("Unable to validate registration file field.", error);
    return {
      status: "error" as const,
      message: "We couldn’t upload this file right now. Please try again.",
    };
  }
  if (!registration) {
    return {
      status: "error" as const,
      message: "This registration could not be found. Refresh and try again.",
    };
  }

  let fields: RegistrationField[];
  try {
    fields = parseRegistrationFields(registration.form_snapshot);
  } catch (error) {
    console.error("Stored registration form is invalid.", error);
    return {
      status: "error",
      message: "We couldn’t upload this file right now. Please try again.",
    };
  }
  if (
    !fields.some(
      (field) => field.id === fieldId && field.type === "file_upload",
    )
  ) {
    return {
      status: "error" as const,
      message: "This upload field is no longer available.",
    };
  }

  const path = `${eventId}/pending/${registrationId}/${randomUUID()}/${fieldId}${extension}`;
  const privilegedClient = createPrivilegedClient();
  const { data, error: signedUrlError } = await privilegedClient.storage
    .from(registrationFileBucket)
    .createSignedUploadUrl(path, { upsert: false });
  if (signedUrlError) {
    console.error("Unable to create signed admin upload.", signedUrlError);
    return {
      status: "error" as const,
      message: "We couldn’t upload this file right now. Please try again.",
    };
  }

  const ticket = createRegistrationUploadTicket(
    {
      eventId,
      fieldId,
      path,
      name: safeRegistrationFilename(parsed.data.name),
      size: parsed.data.size,
      contentType: parsed.data.contentType,
      expiresAt: Date.now() + 15 * 60 * 1000,
    },
    getTurnstileSecret(),
  );

  return {
    status: "success" as const,
    upload: {
      path: data.path,
      token: data.token,
      ticket,
      contentType: parsed.data.contentType,
    },
  };
}

function getAnswerRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};
}

async function removeStoredFiles(paths: string[]) {
  if (paths.length === 0) {
    return true;
  }

  try {
    const client = createPrivilegedClient();
    const { error } = await client.storage
      .from(registrationFileBucket)
      .remove(paths);
    if (error) {
      console.error("Unable to remove event registration files.", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Unable to remove event registration files.", error);
    return false;
  }
}

export async function updateRegistrationAction(
  eventId: string,
  registrationId: string,
  _previousState: RegistrationManagementState,
  formData: FormData,
): Promise<RegistrationManagementState> {
  await requireAdminUser();

  if (
    !uuidSchema.safeParse(eventId).success ||
    !uuidSchema.safeParse(registrationId).success
  ) {
    return invalidRequest();
  }

  const supabase = await createClient();
  const { data: registration, error: loadError } = await supabase
    .from("event_registrations")
    .select("form_snapshot, answers")
    .eq("id", registrationId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (loadError) {
    console.error("Unable to load registration for editing.", loadError);
    return errorState();
  }

  if (!registration) {
    return invalidRequest();
  }

  let fields: RegistrationField[];
  try {
    fields = parseRegistrationFields(registration.form_snapshot);
  } catch (error) {
    console.error("Stored registration form is invalid.", error);
    return errorState();
  }

  const answers = validateRegistrationAnswers(formData, fields);
  if (!answers) {
    return {
      status: "error",
      message: "Check the registration answers and required fields, then try again.",
    };
  }

  const existingAnswers = getAnswerRecord(registration.answers);
  const pendingUploads: {
    field: RegistrationField;
    ticket: NonNullable<
      ReturnType<typeof verifyRegistrationUploadTicket>
    >;
    previousFile: RegistrationFileAnswer | null;
  }[] = [];
  const oldFilePaths = new Set<string>();
  const cleanupPendingUploads = () =>
    removeStoredFiles(pendingUploads.map(({ ticket }) => ticket.path));

  for (const field of fields) {
    if (field.type !== "file_upload") {
      continue;
    }

    const previousFile = parseRegistrationFileAnswer(
      existingAnswers[field.id],
    );
    const safePreviousFile =
      previousFile?.path.startsWith(`${eventId}/`) ? previousFile : null;
    const rawTicket = formData.get(`${field.id}__upload_ticket`);
    const hasTicket = typeof rawTicket === "string" && rawTicket.length > 0;
    const removeRequested = formData.get(`${field.id}__remove`) === "on";

    if (!hasTicket && removeRequested && field.required) {
      await cleanupPendingUploads();
      return {
        status: "error",
        message: `The file for “${field.label}” is required. Upload a replacement instead.`,
      };
    }

    if (!hasTicket && field.required && !safePreviousFile) {
      await cleanupPendingUploads();
      return {
        status: "error",
        message: `Please attach a file for “${field.label}”.`,
      };
    }

    if (hasTicket) {
      if (rawTicket.length > 4096) {
        await cleanupPendingUploads();
        return {
          status: "error",
          message: "A file upload expired. Please select and upload it again.",
        };
      }
      const ticket = verifyRegistrationUploadTicket(
        rawTicket,
        getTurnstileSecret(),
        eventId,
        field.id,
      );
      if (
        !ticket ||
        !ticket.path.startsWith(`${eventId}/pending/${registrationId}/`)
      ) {
        await cleanupPendingUploads();
        return {
          status: "error",
          message: "A file upload expired. Please select and upload it again.",
        };
      }

      if (
        !getRegistrationUploadExtensionFromMetadata(
          ticket.name,
          ticket.contentType,
          ticket.size,
        )
      ) {
        await removeStoredFiles([
          ...pendingUploads.map(({ ticket: acceptedTicket }) => acceptedTicket.path),
          ticket.path,
        ]);
        return {
          status: "error",
          message: "Files must be PDF, JPG, or PNG and no larger than 5 MB.",
        };
      }

      const { data: fileBlob, error: downloadError } =
        await createPrivilegedClient()
          .storage.from(registrationFileBucket)
          .download(ticket.path);
      if (
        downloadError ||
        !fileBlob ||
        fileBlob.size !== ticket.size ||
        (fileBlob.type && fileBlob.type !== ticket.contentType)
      ) {
        if (downloadError) {
          console.error("Unable to verify replacement registration file.", downloadError);
        }
        await removeStoredFiles([
          ...pendingUploads.map(({ ticket: acceptedTicket }) => acceptedTicket.path),
          ticket.path,
        ]);
        return {
          status: "error",
          message: "The uploaded file could not be verified. Please upload it again.",
        };
      }

      let signatureValid: boolean;
      try {
        signatureValid = await hasRegistrationUploadSignature(
          new File([fileBlob], ticket.name, { type: ticket.contentType }),
        );
      } catch (error) {
        console.error("Unable to inspect replacement registration file.", error);
        await removeStoredFiles([
          ...pendingUploads.map(({ ticket: acceptedTicket }) => acceptedTicket.path),
          ticket.path,
        ]);
        return errorState();
      }
      if (!signatureValid) {
        await removeStoredFiles([
          ...pendingUploads.map(({ ticket: acceptedTicket }) => acceptedTicket.path),
          ticket.path,
        ]);
        return {
          status: "error",
          message: "The uploaded file content does not match its file type.",
        };
      }

      pendingUploads.push({
        field,
        ticket,
        previousFile: safePreviousFile,
      });
      answers[field.id] = null;
    } else if (removeRequested) {
      answers[field.id] = null;
      if (safePreviousFile) {
        oldFilePaths.add(safePreviousFile.path);
      }
    } else {
      answers[field.id] = safePreviousFile;
    }
  }

  const newFilePaths: string[] = [];
  if (pendingUploads.length > 0) {
    const privilegedClient = createPrivilegedClient();
    for (const upload of pendingUploads) {
      const extension = upload.ticket.path.slice(
        upload.ticket.path.lastIndexOf("."),
      );
      const path = `${eventId}/${registrationId}/${upload.field.id}-${randomUUID()}${extension}`;
      const { error } = await privilegedClient.storage
        .from(registrationFileBucket)
        .copy(upload.ticket.path, path);

      if (error) {
        console.error("Unable to store replacement registration file.", error);
        await removeStoredFiles(newFilePaths);
        return errorState();
      }

      newFilePaths.push(path);
      answers[upload.field.id] = {
        path,
        name: safeRegistrationFilename(upload.ticket.name),
        size: upload.ticket.size,
        contentType: upload.ticket.contentType,
      } satisfies RegistrationFileAnswer;
      if (upload.previousFile) {
        oldFilePaths.add(upload.previousFile.path);
      }
    }
  }

  const { data, error } = await supabase
    .from("event_registrations")
    .update({ answers })
    .eq("id", registrationId)
    .eq("event_id", eventId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Unable to update event registration.", error);
    await removeStoredFiles(newFilePaths);
    return errorState();
  }

  if (!data) {
    await removeStoredFiles(newFilePaths);
    return invalidRequest();
  }

  const oldFilesRemoved = await removeStoredFiles([...oldFilePaths]);
  await cleanupPendingUploads();
  revalidatePath(registrationsPath(eventId));
  return {
    status: "success",
    message: oldFilesRemoved
      ? "Registration updated."
      : "Registration updated, but an old attachment could not be removed. Check the server logs.",
  };
}

export async function deleteRegistrationAction(
  eventId: string,
  registrationId: string,
): Promise<RegistrationManagementState> {
  await requireAdminUser();

  if (
    !uuidSchema.safeParse(eventId).success ||
    !uuidSchema.safeParse(registrationId).success
  ) {
    return invalidRequest();
  }

  const supabase = await createClient();
  const { data: registration, error: loadError } = await supabase
    .from("event_registrations")
    .select("answers")
    .eq("id", registrationId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (loadError) {
    console.error("Unable to load registration files before deletion.", loadError);
    return {
      status: "error",
      message: "We couldn’t delete this registration right now. Please try again.",
    };
  }
  if (!registration) {
    return invalidRequest();
  }

  const filePaths = Object.values(getAnswerRecord(registration.answers))
    .map(parseRegistrationFileAnswer)
    .filter(
      (file): file is RegistrationFileAnswer =>
        file !== null && file.path.startsWith(`${eventId}/`),
    )
    .map((file) => file.path);
  const { data, error } = await supabase
    .from("event_registrations")
    .delete()
    .eq("id", registrationId)
    .eq("event_id", eventId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Unable to delete event registration.", error);
    return {
      status: "error",
      message: "We couldn’t delete this registration right now. Please try again.",
    };
  }

  if (!data) {
    return invalidRequest();
  }

  const filesRemoved = await removeStoredFiles(filePaths);
  revalidatePath(registrationsPath(eventId));
  return {
    status: "success",
    message: filesRemoved
      ? "Registration deleted."
      : "Registration deleted, but an attached file could not be removed. Check the server logs.",
  };
}
