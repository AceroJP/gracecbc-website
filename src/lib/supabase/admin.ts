import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseSecretKey } from "@/lib/env.server";
import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

export function createPrivilegedClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = getSupabasePublicEnv();
  const secretKey = getSupabaseSecretKey();

  return createSupabaseClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    secretKey,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
