"use server";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { z } from "zod";
import { createPrivilegedClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTurnstileSecret } from "@/lib/env.server";
import {
  parseRegistrationFields,
  validateRegistrationAnswers,
  type RegistrationField,
} from "@/lib/registration";
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

  const challengeToken = formData.get("cf-turnstile-response");

  if (
    typeof challengeToken !== "string" ||
    challengeToken.length === 0 ||
    challengeToken.length > 2048
  ) {
    return {
      status: "error",
      message: "Complete the security check before submitting.",
    };
  }

  let challengeValid: boolean;

  try {
    const expectedHostname = new URL(`https://${hostname}`).hostname;
    challengeValid = await verifyRegistrationChallenge(
      challengeToken,
      expectedHostname,
      clientIp,
    );
  } catch (error) {
    console.error("Unable to verify the event registration challenge.", error);
    return temporaryError();
  }

  if (!challengeValid) {
    return {
      status: "error",
      message: "The security check expired or could not be verified. Please try again.",
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

  const { data: result, error: submitError } = await privilegedClient
    .rpc("submit_event_registration", {
      p_event_id: eventId,
      p_answers: answers,
      p_form_snapshot: fields,
    })
    .single();

  if (submitError) {
    console.error("Unable to save event registration.", submitError);
    return temporaryError();
  }

  switch (result.status) {
    case "submitted":
      return { status: "success" };
    case "closed":
      return {
        status: "error",
        message: "Registration for this event has closed.",
      };
    case "full":
      return {
        status: "error",
        message: "This event has reached its registration capacity.",
      };
    case "form_changed":
      return {
        status: "error",
        message: "The registration form changed. Refresh the page and try again.",
      };
    default:
      return {
        status: "error",
        message: "Registration for this event is unavailable.",
      };
  }
}
