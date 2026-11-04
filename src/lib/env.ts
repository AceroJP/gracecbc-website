import { z } from "zod";

const supabasePublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const turnstileSiteKeySchema = z.string().min(1);

export function getSupabasePublicEnv() {
  const parsed = supabasePublicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!parsed.success) {
    throw new Error(`Invalid Supabase environment: ${parsed.error.message}`);
  }

  return parsed.data;
}

export function getOptionalTurnstileSiteKey() {
  const parsed = turnstileSiteKeySchema.safeParse(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  );

  return parsed.success ? parsed.data : null;
}

export function getOptionalSupabasePublicEnv() {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasPublishableKey = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  if (!hasUrl && !hasPublishableKey) {
    return null;
  }

  return getSupabasePublicEnv();
}
