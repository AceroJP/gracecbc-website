import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isMissingWorshipSchedulesTable } from "@/lib/worship-schedules";
import type { PublicNavigationAvailability } from "@/lib/public-navigation";

export async function getPublicNavigationAvailability(): Promise<PublicNavigationAvailability> {
  const supabase = await createClient();

  const [
    { data: announcements, error: announcementsError },
    { data: events, error: eventsError },
    { data: schedules, error: schedulesError },
  ] = await Promise.all([
    supabase.from("announcements").select("id").is("archived_at", null).limit(1),
    supabase.from("events").select("id").is("archived_at", null).limit(1),
    supabase.from("worship_schedules").select("id").is("archived_at", null).limit(1),
  ]);

  if (announcementsError) {
    throw new Error("Unable to check announcements for navigation.", { cause: announcementsError });
  }
  if (eventsError) {
    throw new Error("Unable to check events for navigation.", { cause: eventsError });
  }

  let schedulesAvailable = false;
  if (!schedulesError) {
    schedulesAvailable = (schedules ?? []).length > 0;
  } else if (isMissingWorshipSchedulesTable(schedulesError)) {
    schedulesAvailable = false;
  } else {
    throw new Error("Unable to check schedules for navigation.", { cause: schedulesError });
  }

  return {
    announcements: (announcements ?? []).length > 0,
    events: (events ?? []).length > 0,
    schedules: schedulesAvailable,
  };
}
