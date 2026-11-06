import "server-only";

import { z } from "zod";

const serverSecretSchema = z.string().min(1);

function readServerSecret(
  name:
    | "SUPABASE_SECRET_KEY"
    | "TURNSTILE_SECRET_KEY"
    | "CLOUDCONVERT_API_KEY",
) {
  const parsed = serverSecretSchema.safeParse(process.env[name]);

  if (!parsed.success) {
    throw new Error(
      `Missing ${name}. Configure it in the server deployment environment.`,
    );
  }

  return parsed.data;
}

export function getSupabaseSecretKey() {
  return readServerSecret("SUPABASE_SECRET_KEY");
}

export function getTurnstileSecret() {
  return readServerSecret("TURNSTILE_SECRET_KEY");
}

export function getCloudConvertApiKey() {
  return readServerSecret("CLOUDCONVERT_API_KEY");
}
