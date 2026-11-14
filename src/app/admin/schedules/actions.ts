"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { worshipScheduleSchema } from "@/lib/worship-schedules";

type Result = { status: "success" | "error"; message: string };
const idSchema = z.string().uuid();

function refreshSchedules() {
  revalidatePath("/");
  revalidatePath("/admin/schedules");
  revalidatePath("/landing-page-preview");
}

export async function saveWorshipSchedule(formData: FormData): Promise<Result> {
  await requireAdminUser();
  const rawId = formData.get("id");
  const id = rawId ? idSchema.safeParse(rawId) : null;
  const parsed = worshipScheduleSchema.safeParse({
    day: formData.get("day"),
    time: formData.get("time"),
    service_name: formData.get("service_name"),
    note: formData.get("note") ?? "",
  });
  if ((id && !id.success) || !parsed.success) {
    return { status: "error", message: "Enter a service name, day and time, and check the field lengths." };
  }
  const supabase = await createClient();
  if (id?.success) {
    const { data, error } = await supabase.from("worship_schedules")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", id.data).is("archived_at", null).select("id").maybeSingle();
    if (error) throw new Error("Unable to update schedule.", { cause: error });
    if (!data) return { status: "error", message: "This schedule was changed or archived. Refresh and try again." };
  } else {
    const { error } = await supabase.from("worship_schedules").insert(parsed.data);
    if (error) throw new Error("Unable to create schedule.", { cause: error });
  }
  refreshSchedules();
  return { status: "success", message: "The schedule is saved and appears on the public homepage when the section is visible." };
}

export async function changeWorshipSchedule(idValue: string, operation: "archive" | "restore" | "delete" | "up" | "down"): Promise<Result> {
  await requireAdminUser();
  const id = idSchema.safeParse(idValue);
  if (!id.success || !["archive", "restore", "delete", "up", "down"].includes(operation)) {
    return { status: "error", message: "The schedule action is invalid." };
  }
  const supabase = await createClient();
  if (operation === "up" || operation === "down") {
    const { data, error } = await supabase.rpc("move_worship_schedule", { schedule_id: id.data, direction: operation });
    if (error) throw new Error("Unable to reorder schedule.", { cause: error });
    if (!data) return { status: "error", message: "The schedule could not be moved. Refresh and try again." };
  } else {
    const query = operation === "delete"
      ? supabase.from("worship_schedules").delete().eq("id", id.data)
      : supabase.from("worship_schedules").update({ archived_at: operation === "archive" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", id.data);
    const { data, error } = await (operation === "archive" ? query.is("archived_at", null) : query.not("archived_at", "is", null)).select("id").maybeSingle();
    if (error) throw new Error("Unable to change schedule.", { cause: error });
    if (!data) return { status: "error", message: "This schedule was changed or removed. Refresh and try again." };
  }
  refreshSchedules();
  return { status: "success", message: operation === "delete" ? "Schedule deleted." : operation === "archive" ? "Schedule archived and removed from the public homepage." : operation === "restore" ? "Schedule restored." : "Schedule order updated." };
}
