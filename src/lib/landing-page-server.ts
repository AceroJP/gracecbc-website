import "server-only";

import { getDefaultLandingPageContent, parseLandingPageContent } from "@/lib/landing-page";
import { createClient } from "@/lib/supabase/server";

export async function getPublishedLandingPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("landing_page_published")
    .select("content")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load the published landing page.", { cause: error });
  }
  if (!data) {
    return getDefaultLandingPageContent();
  }

  const parsed = parseLandingPageContent(data.content);
  if (!parsed.success) {
    throw new Error("Published landing page content is invalid.", {
      cause: parsed.error,
    });
  }

  return parsed.data;
}

