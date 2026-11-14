import { z } from "zod";
import type { Database } from "@/types/database.types";

export type WorshipSchedule = Database["public"]["Tables"]["worship_schedules"]["Row"];

export function isMissingWorshipSchedulesTable(error: { code?: string; message?: string }) {
  return error.code === "PGRST205" && Boolean(error.message?.includes("'public.worship_schedules'"));
}

export const worshipScheduleSchema = z.object({
  day: z.string().trim().min(1, "Enter a day.").max(40),
  time: z.string().trim().min(1, "Enter a time.").max(40),
  service_name: z.string().trim().min(1, "Enter a service name.").max(120),
  note: z.string().trim().max(300),
});

export const legacyScheduleRowsSchema = z.array(z.object({
  id: z.string().uuid(),
  day: z.string(),
  time: z.string(),
  serviceName: z.string(),
  note: z.string(),
}));
