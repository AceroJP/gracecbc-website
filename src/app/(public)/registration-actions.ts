"use server";

import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { z } from "zod";
import { createPrivilegedClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTurnstileSecret } from "@/lib/env.server";
import {
  hasRegistrationUploadSignature,
  parseRegistrationFields,
<<<<<<< HEAD
  validateRegistrationAnswers,
=======
  registrationFileBucket,
  validateRegistrationAnswers,
  type RegistrationFileAnswer,
>>>>>>> 703a9cd (Add private storage bucket for registration uploads)
  type RegistrationField,
} from "@/lib/registration";
import { verifyRegistrationUploadTicket } from "@/lib/registration-upload.server";
import { verifyRegistrationChallenge } from "@/lib/turnstile";

export type RegistrationSubmissionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const eventIdSchema = z.uuid();
const rateLimitWindowMs = 15 * 60 * 1000;

function getClientIp(forwardedFor: string | null, realIp: string | null) {
  const candidates = [
    forwardedFor?.split(",")[0]?.trim(),
    realIp?.trim(),
  ];

  for (const candidate of candidates) {
    if (candidate && isIP(candidate)) {
      return candidate;
    }
  }

  return process.env.NODE_ENV === "development" ? "127.0.0.1" : null;
}

function temporaryError(): RegistrationSubmissionState {
  return {
    status: "error",
    message: "We couldn’t submit your registration right now. Please try again.",
  };
}

async function removeUploadedFiles(paths: string[]) {
  if (paths.length === 0) {
    return;
  }

  try {
    const client = createPrivilegedClient();
    const { error } = await client.storage
      .from(registrationFileBucket)
      .remove(paths);

    if (error) {
      console.error("Unable to clean up event registration uploads.", error);
    }
  } catch (error) {
    console.error("Unable to clean up event registration uploads.", error);
  }
}

export async function submitRegistrationAction(
  eventId: string,
  _previousState: RegistrationSubmissionState,
  formData: FormData,
): Promise<RegistrationSubmissionState> {
  if (!eventIdSchema.safeParse(eventId).success) {
    return {
      status: "error",
      message: "This event registration is unavailable.",
    };
  }

  const requestHeaders = await headers();
  const clientIp = getClientIp(
    requestHeaders.get("x-forwarded-for"),
    requestHeaders.get("x-real-ip"),
  );
  const hostname = requestHeaders.get("host");

  if (!clientIp || !hostname) {
    console.error("Registration request is missing trusted client metadata.");
    return temporaryError();
  }

  let privilegedClient;
  let turnstileSecret: string;

  try {
    privilegedClient = createPrivilegedClient();
    turnstileSecret = getTurnstileSecret();
  } catch (error) {
    console.error("Registration security configuration is incomplete.", error);
    return temporaryError();
  }

  const now = Date.now();
  const bucketStart = new Date(
    Math.floor(now / rateLimitWindowMs) * rateLimitWindowMs,
  ).toISOString();
  const requestHash = createHmac("sha256", turnstileSecret)
    .update(`${eventId}\u0000${clientIp}`)
    .digest("hex");
  const { data: allowed, error: rateLimitError } = await privilegedClient.rpc(
    "consume_event_registration_rate_limit",
    {
      p_request_hash: requestHash,
      p_bucket_start: bucketStart,
    },
  );

  if (rateLimitError) {
    console.error("Unable to apply event registration rate limiting.", rateLimitError);
    return temporaryError();
  }

  if (!allowed) {
    return {
      status: "error",
      message: "Too many attempts. Please wait a little while before trying again.",
    };
  }

  const supabase = await createClient();
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select(
      "registration_enabled, registration_fields, registration_deadline, registration_capacity",
    )
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) {
    console.error("Unable to load event registration settings.", eventError);
    return temporaryError();
  }

  if (!event?.registration_enabled) {
    return {
      status: "error",
      message: "Registration for this event is unavailable.",
    };
  }

  let fields: RegistrationField[];

  try {
    fields = parseRegistrationFields(event.registration_fields);
  } catch (error) {
    console.error("Stored event registration form is invalid.", error);
    return temporaryError();
  }

  if (fields.length === 0) {
    return {
      status: "error",
      message: "Registration for this event is unavailable.",
    };
  }

  const answers = validateRegistrationAnswers(formData, fields);

  if (!answers) {
    return {
      status: "error",
      message: "Please review the form and check all required fields.",
    };
  }

  const challengeToken = formData.get("cf-turnstile-response");
  const uploadTickets: {
    field: RegistrationField;
    ticket: NonNullable<
      ReturnType<typeof verifyRegistrationUploadTicket>
    >;
  }[] = [];

  for (const field of fields) {
    if (field.type !== "file_upload") {
      continue;
    }

    const rawTicket = formData.get(`${field.id}__upload_ticket`);
    if (typeof rawTicket !== "string" || rawTicket.length === 0) {
      answers[field.id] = null;
      if (field.required) {
        await removeUploadedFiles(uploadTickets.map(({ ticket }) => ticket.path));
        return {
          status: "error",
          message: `Please attach a file for “${field.label}”.`,
        };
      }
      continue;
    }
    if (rawTicket.length > 4096) {
      await removeUploadedFiles(uploadTickets.map(({ ticket }) => ticket.path));
      return {
        status: "error",
        message: "A file upload expired. Please select the file and upload it again.",
      };
    }

    let ticket;
    try {
      ticket = verifyRegistrationUploadTicket(
        rawTicket,
        turnstileSecret,
        eventId,
        field.id,
      );
    } catch (error) {
      console.error("Unable to validate registration upload ticket.", error);
      await removeUploadedFiles(uploadTickets.map(({ ticket }) => ticket.path));
      return temporaryError();
    }
    if (!ticket) {
      await removeUploadedFiles(uploadTickets.map(({ ticket }) => ticket.path));
      return {
        status: "error",
        message: "A file upload expired. Please select the file and upload it again.",
      };
    }

    uploadTickets.push({ field, ticket });
  }

  if (uploadTickets.length === 0) {
    if (
      typeof challengeToken !== "string" ||
      challengeToken.length === 0 ||
      challengeToken.length > 2048
    ) {
      await removeUploadedFiles(uploadTickets.map(({ ticket }) => ticket.path));
      return {
        status: "error",
        message: "Complete the security check before submitting.",
      };
    }

    let challengeValid: boolean;
    try {
      challengeValid = await verifyRegistrationChallenge(
        challengeToken,
        new URL(`https://${hostname}`).hostname,
        clientIp,
      );
    } catch (error) {
      console.error("Unable to verify the event registration challenge.", error);
      await removeUploadedFiles(uploadTickets.map(({ ticket }) => ticket.path));
      return temporaryError();
    }
    if (!challengeValid) {
      await removeUploadedFiles(uploadTickets.map(({ ticket }) => ticket.path));
      return {
        status: "error",
        message: "The security check expired or could not be verified. Please try again.",
      };
    }
  }

  const pendingPaths = uploadTickets.map(({ ticket }) => ticket.path);
  const uploadedPaths: string[] = [];
  for (const { field, ticket } of uploadTickets) {
    const { data: fileBlob, error: downloadError } = await privilegedClient.storage
      .from(registrationFileBucket)
      .download(ticket.path);
    if (
      downloadError ||
      !fileBlob ||
      fileBlob.size !== ticket.size ||
      (fileBlob.type && fileBlob.type !== ticket.contentType)
    ) {
      if (downloadError) {
        console.error("Unable to verify uploaded registration file.", downloadError);
      }
      await removeUploadedFiles([...pendingPaths, ...uploadedPaths]);
      return {
        status: "error",
        message: "An uploaded file could not be verified. Please upload it again.",
      };
    }

    let signatureValid: boolean;
    try {
      signatureValid = await hasRegistrationUploadSignature(
        new File([fileBlob], ticket.name, { type: ticket.contentType }),
      );
    } catch (error) {
      console.error("Unable to inspect uploaded registration file.", error);
      await removeUploadedFiles([...pendingPaths, ...uploadedPaths]);
      return temporaryError();
    }
    if (!signatureValid) {
      await removeUploadedFiles([...pendingPaths, ...uploadedPaths]);
      return {
        status: "error",
        message: "The uploaded file content does not match its file type.",
      };
    }

    const extension = ticket.path.slice(ticket.path.lastIndexOf("."));
    const path = `${eventId}/${randomUUID()}/${field.id}${extension}`;
    const { error: copyError } = await privilegedClient.storage
      .from(registrationFileBucket)
      .copy(ticket.path, path);
    if (copyError) {
      console.error("Unable to finalize registration file.", copyError);
      await removeUploadedFiles([...pendingPaths, ...uploadedPaths]);
      return temporaryError();
    }

    uploadedPaths.push(path);
    const fileAnswer: RegistrationFileAnswer = {
      path,
      name: ticket.name,
      size: ticket.size,
      contentType: ticket.contentType,
    };
    answers[field.id] = fileAnswer;
  }

  const { data: result, error: submitError } = await privilegedClient
    .rpc("submit_event_registration", {
      p_event_id: eventId,
      p_answers: answers,
      p_form_snapshot: fields,
    })
    .single();

  if (submitError) {
    console.error("Unable to save event registration.", submitError);
    await removeUploadedFiles([...pendingPaths, ...uploadedPaths]);
    return temporaryError();
  }

  switch (result.status) {
    case "submitted":
      await removeUploadedFiles(pendingPaths);
      return { status: "success" };
    case "closed":
      await removeUploadedFiles(uploadedPaths);
      await removeUploadedFiles(pendingPaths);
      return {
        status: "error",
        message: "Registration for this event has closed.",
      };
    case "full":
      await removeUploadedFiles(uploadedPaths);
      await removeUploadedFiles(pendingPaths);
      return {
        status: "error",
        message: "This event has reached its registration capacity.",
      };
    case "form_changed":
      await removeUploadedFiles(uploadedPaths);
      await removeUploadedFiles(pendingPaths);
      return {
        status: "error",
        message: "The registration form changed. Refresh the page and try again.",
      };
    default:
      await removeUploadedFiles(uploadedPaths);
      await removeUploadedFiles(pendingPaths);
      return {
        status: "error",
        message: "Registration for this event is unavailable.",
      };
  }
}
