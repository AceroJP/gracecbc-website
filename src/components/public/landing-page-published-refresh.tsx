"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LandingPagePublishedRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("landing-page-published-refresh")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "landing_page_published",
        },
        () => router.refresh(),
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Landing page live refresh subscription failed.", error);
        }
      });

    return () => {
      void supabase.removeChannel(channel).catch((error: unknown) => {
        console.error("Unable to close landing page live refresh subscription.", error);
      });
    };
  }, [router]);

  return null;
}
