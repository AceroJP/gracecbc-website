"use server";

import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { z } from "zod";
import { createPrivilegedClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTurnstileSecret } from "@/lib/env.server";
import {
  getRegistrationUploadExtensionFromMetadata,
  parseRegistrationFields,
  registrationFileBucket,
  safeRegistrationFilename,
} from "@/lib/registration";
import { verifyRegistrationChallenge } from "@/lib/turnstile";
import { createRegistrationUploadTicket } from "@/lib/registration-upload.server";

const uploadRequestSchema = z.object({
  fieldId: z.uuid(),
  name: z.string().min(1).max(500),
  size: z.number().int().positive(),
  lastModified: z.number().int().nonnegative(),
  contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
});

const uploadsRequestSchema = z.object({
  eventId: z.uuid(),
  challengeToken: z.string().min(1).max(2048),
  uploads: z.array(uploadRequestSchema).min(1).max(20),
});

function getClientIp(forwardedFor: string | null, realIp: string | null) {
  for (const candidate of [
    forwardedFor?.split(",")[0]?.trim(),
    realIp?.trim(),
  ]) {
    if (candidate && isIP(candidate)) {
      return candidate;
    }
  }

  return process.env.NODE_ENV === "development" ? "127.0.0.1" : null;
}

export async function beginRegistrationUploadsAction(
  request: z.input<typeof uploadsRequestSchema>,
) {
  const parsed = uploadsRequestSchema.safeParse(request);
  if (!parsed.success) {
    return { status: "error" as const, message: "Invalid file upload request." };
  }

  const { eventId, challengeToken, uploads } = parsed.data;
  if (new Set(uploads.map((upload) => upload.fieldId)).size !== uploads.length) {
    return { status: "error" as const, message: "Invalid file upload request." };
  }

  const requestHeaders = await headers();
  const clientIp = getClientIp(
    requestHeaders.get("x-forwarded-for"),
    requestHeaders.get("x-real-ip"),
  );
  const hostname = requestHeaders.get("host");
  if (!clientIp || !hostname) {
    console.error("Registration upload is missing trusted client metadata.");
    return {
      status: "error" as const,
      message: "We couldn’t upload your files right now. Please try again.",
    };
  }

  const secret = getTurnstileSecret();
  let challengeValid: boolean;
  try {
    challengeValid = await verifyRegistrationChallenge(
      challengeToken,
      new URL(`https://${hostname}`).hostname,
      clientIp,
    );
  } catch (error) {
    console.error("Unable to verify registration upload challenge.", error);
    return {
      status: "error" as const,
      message: "The security check could not be verified. Please try again.",
    };
  }
  if (!challengeValid) {
    return {
      status: "error" as const,
      message: "The security check expired or could not be verified. Please try again.",
    };
  }

  const supabase = await createClient();
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("registration_enabled, registration_fields")
    .eq("id", eventId)
    .maybeSingle();
  if (eventError) {
    console.error("Unable to load event before file upload.", eventError);
    return {
      status: "error" as const,
      message: "We couldn’t upload your files right now. Please try again.",
    };
  }
  if (!event?.registration_enabled) {
    return {
      status: "error" as const,
      message: "Registration for this event is unavailable.",
    };
  }

  let fields;
  try {
    fields = parseRegistrationFields(event.registration_fields);
  } catch (error) {
    console.error("Stored event registration form is invalid.", error);
    return {
      status: "error" as const,
      message: "The registration form is unavailable. Please contact the church.",
    };
  }

  if (
    uploads.some(
      ({ fieldId, name, size, contentType }) =>
        !fields.some((field) => field.id === fieldId && field.type === "file_upload") ||
        !getRegistrationUploadExtensionFromMetadata(name, contentType, size),
    )
  ) {
    return {
      status: "error" as const,
      message: "Files must be PDF, JPG, or PNG and no larger than 5 MB.",
    };
  }

  const bucketStart = new Date(
    Math.floor(Date.now() / (15 * 60 * 1000)) * (15 * 60 * 1000),
  ).toISOString();
  const requestHash = createHmac("sha256", secret)
    .update(`upload\u0000${eventId}\u0000${clientIp}`)
    .digest("hex");
  const privilegedClient = createPrivilegedClient();
  const { data: allowed, error: rateLimitError } = await privilegedClient.rpc(
    "consume_event_registration_rate_limit",
    { p_request_hash: requestHash, p_bucket_start: bucketStart },
  );
  if (rateLimitError) {
    console.error("Unable to rate-limit registration uploads.", rateLimitError);
    return {
      status: "error" as const,
      message: "We couldn’t upload your files right now. Please try again.",
    };
  }
  if (!allowed) {
    return {
      status: "error" as const,
      message: "Too many upload attempts. Please wait before trying again.",
    };
  }

  const signedUploads = [];
  for (const upload of uploads) {
    const extension = getRegistrationUploadExtensionFromMetadata(
      upload.name,
      upload.contentType,
      upload.size,
    );
    if (!extension) {
      return {
        status: "error" as const,
        message: "Files must be PDF, JPG, or PNG and no larger than 5 MB.",
      };
    }
    const path = `${eventId}/pending/${randomUUID()}/${upload.fieldId}${extension}`;
    const { data, error } = await privilegedClient.storage
      .from(registrationFileBucket)
      .createSignedUploadUrl(path, { upsert: false });
    if (error) {
      console.error("Unable to create signed registration upload.", error);
      if (signedUploads.length > 0) {
        const { error: cleanupError } = await privilegedClient.storage
          .from(registrationFileBucket)
          .remove(signedUploads.map((signedUpload) => signedUpload.path));
        if (cleanupError) {
          console.error("Unable to clean up unused registration upload paths.", cleanupError);
        }
      }
      return {
        status: "error" as const,
        message: "We couldn’t upload your files right now. Please try again.",
      };
    }

    const safeName = safeRegistrationFilename(upload.name);
    const ticket = createRegistrationUploadTicket(
      {
        eventId,
        fieldId: upload.fieldId,
        path,
        name: safeName,
        size: upload.size,
        contentType: upload.contentType,
        expiresAt: Date.now() + 15 * 60 * 1000,
      },
      secret,
    );
    signedUploads.push({
      fieldId: upload.fieldId,
      name: safeName,
      size: upload.size,
      lastModified: upload.lastModified,
      contentType: upload.contentType,
      path: data.path,
      token: data.token,
      ticket,
    });
  }

  return { status: "success" as const, uploads: signedUploads };
}
