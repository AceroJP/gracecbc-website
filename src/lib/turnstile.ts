import "server-only";

import { z } from "zod";
import { getTurnstileSecret } from "@/lib/env.server";

const verificationResponseSchema = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
});

export async function verifyRegistrationChallenge(
  token: string,
  hostname: string,
  clientIp: string,
) {
  const secret = getTurnstileSecret();
  const body = new URLSearchParams({
    secret,
    response: token,
    remoteip: clientIp,
  });

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    },
  );

  if (!response.ok) {
    throw new Error(`Turnstile verification returned HTTP ${response.status}.`);
  }

  const parsed = verificationResponseSchema.safeParse(await response.json());

  if (!parsed.success) {
    throw new Error("Turnstile returned an invalid verification response.", {
      cause: parsed.error,
    });
  }

  return (
    parsed.data.success &&
    parsed.data.action === "event_registration" &&
    parsed.data.hostname?.toLowerCase() === hostname.toLowerCase()
  );
}
