"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { registrationFieldsSchema } from "@/lib/registration";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const eventSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(3000),
  event_date: z.iso.date(),
  end_date: z.union([z.literal(""), z.iso.date()]),
  starts_at: z.string().regex(timePattern),
  ends_at: z.union([z.literal(""), z.string().regex(timePattern)]),
  location: z.string().trim().min(1).max(200),
}).refine(
  ({ event_date, end_date }) => !end_date || end_date >= event_date,
  { path: ["end_date"] },
);

const eventIdSchema = z.uuid();
const registrationDeadlineSchema = z.union([z.literal(""), z.iso.date()]);
const registrationCapacitySchema = z.union([
  z.literal(""),
  z.string().regex(/^[1-9]\d{0,5}$/),
]);

function parseEvent(formData: FormData) {
  const parsed = eventSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    event_date: formData.get("event_date"),
    end_date: formData.get("end_date") ?? "",
    starts_at: formData.get("starts_at"),
    ends_at: formData.get("ends_at") ?? "",
    location: formData.get("location"),
  });

  if (!parsed.success) {
    redirect("/admin/events?error=invalid");
  }

  const rawFields = formData.get("registration_fields");
  let decodedFields: unknown;

  if (typeof rawFields !== "string") {
    redirect("/admin/events?error=registration-form");
  }

  try {
    decodedFields = JSON.parse(rawFields);
  } catch {
    redirect("/admin/events?error=registration-form");
  }

  const fields = registrationFieldsSchema.safeParse(decodedFields);
  const deadline = registrationDeadlineSchema.safeParse(
    formData.get("registration_deadline") ?? "",
  );
  const capacity = registrationCapacitySchema.safeParse(
    formData.get("registration_capacity") ?? "",
  );
  const registrationEnabled = formData.get("registration_enabled") === "on";

  if (
    !fields.success ||
    !deadline.success ||
    !capacity.success ||
    (registrationEnabled && fields.data.length === 0)
  ) {
    redirect("/admin/events?error=registration-form");
  }

  return {
    ...parsed.data,
    end_date: parsed.data.end_date || null,
    ends_at: parsed.data.ends_at || null,
    registration_enabled: registrationEnabled,
    registration_fields: fields.data,
    registration_deadline: deadline.data || null,
    registration_capacity: capacity.data ? Number(capacity.data) : null,
  };
}

function reportDatabaseError(message: string, error: unknown): never {
  throw new Error(message, { cause: error });
}

export async function createEventAction(formData: FormData) {
  await requireAdminUser();
  const event = parseEvent(formData);
  const supabase = await createClient();
  const { error } = await supabase.from("events").insert(event);

  if (error) {
    reportDatabaseError("Unable to create the event.", error);
  }

  revalidatePath("/");
  revalidatePath("/admin/events");
  redirect("/admin/events?notice=created");
}

export async function updateEventAction(formData: FormData) {
  await requireAdminUser();
  const id = eventIdSchema.safeParse(formData.get("id"));

  if (!id.success) {
    redirect("/admin/events?error=invalid");
  }

  const event = parseEvent(formData);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ ...event, updated_at: new Date().toISOString() })
    .eq("id", id.data)
    .select("id")
    .maybeSingle();

  if (error) {
    reportDatabaseError("Unable to update the event.", error);
  }

  if (!data) {
    redirect("/admin/events?error=not-found");
  }

  revalidatePath("/");
  revalidatePath("/admin/events");
  redirect("/admin/events?notice=updated");
}

export async function deleteEventAction(formData: FormData) {
  await requireAdminUser();
  const id = eventIdSchema.safeParse(formData.get("id"));

  if (!id.success) {
    redirect("/admin/events?error=invalid");
  }

  const supabase = await createClient();
  const { count, error: registrationError } = await supabase
    .from("event_registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", id.data);

  if (registrationError) {
    reportDatabaseError(
      "Unable to check whether the event has registrations.",
      registrationError,
    );
  }

  if (count && count > 0) {
    redirect("/admin/events?error=has-registrations");
  }

  const { data, error } = await supabase
    .from("events")
    .delete()
    .eq("id", id.data)
    .select("id")
    .maybeSingle();

  if (error) {
    reportDatabaseError("Unable to delete the event.", error);
  }

  if (!data) {
    redirect("/admin/events?error=not-found");
  }

  revalidatePath("/");
  revalidatePath("/admin/events");
  redirect("/admin/events?notice=deleted");
}
