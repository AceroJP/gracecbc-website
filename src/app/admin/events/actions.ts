"use server";

import { revalidatePath } from "next/cache";
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

type EventActionResult =
  | { status: "success"; message: string }
  | { status: "error"; message: string };

function parseEvent(
  formData: FormData,
):
  | {
      status: "success";
      event: Omit<z.infer<typeof eventSchema>, "end_date" | "ends_at"> & {
        end_date: string | null;
        ends_at: string | null;
        registration_enabled: boolean;
        registration_fields: z.infer<typeof registrationFieldsSchema>;
        registration_deadline: string | null;
        registration_capacity: number | null;
      };
    }
  | { status: "error"; message: string } {
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
    return {
      status: "error",
      message: "Check the event details and try again.",
    };
  }

  const rawFields = formData.get("registration_fields");
  let decodedFields: unknown;

  if (typeof rawFields !== "string") {
    return {
      status: "error",
      message:
        "Check the registration form. Enabled forms need at least one valid field, and dropdowns need at least two unique options.",
    };
  }

  try {
    decodedFields = JSON.parse(rawFields);
  } catch {
    return {
      status: "error",
      message:
        "Check the registration form. Enabled forms need at least one valid field, and dropdowns need at least two unique options.",
    };
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
    return {
      status: "error",
      message:
        "Check the registration form. Enabled forms need at least one valid field, and dropdowns need at least two unique options.",
    };
  }

  return {
    status: "success",
    event: {
      ...parsed.data,
      end_date: parsed.data.end_date || null,
      ends_at: parsed.data.ends_at || null,
      registration_enabled: registrationEnabled,
      registration_fields: fields.data,
      registration_deadline: deadline.data || null,
      registration_capacity: capacity.data ? Number(capacity.data) : null,
    },
  };
}

function reportDatabaseError(message: string, error: unknown): never {
  throw new Error(message, { cause: error });
}

export async function createEventAction(
  formData: FormData,
): Promise<EventActionResult> {
  await requireAdminUser();
  const parsed = parseEvent(formData);
  if (parsed.status === "error") {
    return parsed;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("events").insert(parsed.event);

  if (error) {
    reportDatabaseError("Unable to create the event.", error);
  }

  revalidatePath("/");
  revalidatePath("/admin/events");
  return {
    status: "success",
    message: "The event is now published on the public website.",
  };
}

export async function updateEventAction(
  formData: FormData,
): Promise<EventActionResult> {
  await requireAdminUser();
  const id = eventIdSchema.safeParse(formData.get("id"));

  if (!id.success) {
    return { status: "error", message: "Check the event details and try again." };
  }

  const parsed = parseEvent(formData);
  if (parsed.status === "error") {
    return parsed;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ ...parsed.event, updated_at: new Date().toISOString() })
    .eq("id", id.data)
    .select("id")
    .maybeSingle();

  if (error) {
    reportDatabaseError("Unable to update the event.", error);
  }

  if (!data) {
    return {
      status: "error",
      message: "That event could not be found. Refresh the list and try again.",
    };
  }

  revalidatePath("/");
  revalidatePath("/admin/events");
  return {
    status: "success",
    message: "Event changes are published on the public website.",
  };
}

async function archiveEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
) {
  const archivedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("events")
    .update({
      archived_at: archivedAt,
      updated_at: archivedAt,
    })
    .eq("id", id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    reportDatabaseError("Unable to archive the event.", error);
  }

  if (data) {
    return true;
  }

  const { data: existingEvent, error: lookupError } = await supabase
    .from("events")
    .select("archived_at")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    reportDatabaseError("Unable to verify the event.", lookupError);
  }

  return existingEvent?.archived_at !== null && existingEvent !== null;
}

export async function archiveEventAction(eventId: string) {
  await requireAdminUser();
  const id = eventIdSchema.safeParse(eventId);

  if (!id.success) {
    return "invalid" as const;
  }

  const supabase = await createClient();
  const archived = await archiveEvent(supabase, id.data);

  if (!archived) {
    return "not-found" as const;
  }

  revalidatePath("/");
  revalidatePath("/admin/events");
  return "archived" as const;
}

export async function restoreEventAction(eventId: string) {
  await requireAdminUser();
  const id = eventIdSchema.safeParse(eventId);

  if (!id.success) {
    return "invalid" as const;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ archived_at: null, updated_at: new Date().toISOString() })
    .eq("id", id.data)
    .not("archived_at", "is", null)
    .select("id")
    .maybeSingle();

  if (error) {
    reportDatabaseError("Unable to restore the event.", error);
  }

  if (!data) {
    const { data: existingEvent, error: lookupError } = await supabase
      .from("events")
      .select("id")
      .eq("id", id.data)
      .maybeSingle();

    if (lookupError) {
      reportDatabaseError("Unable to verify the event.", lookupError);
    }

    return existingEvent ? ("restored" as const) : ("not-found" as const);
  }

  revalidatePath("/");
  revalidatePath("/admin/events");
  return "restored" as const;
}

export async function deleteEventAction(eventId: string) {
  await requireAdminUser();
  const id = eventIdSchema.safeParse(eventId);

  if (!id.success) {
    return "invalid" as const;
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
    const archived = await archiveEvent(supabase, id.data);
    if (!archived) {
      return "not-found" as const;
    }

    revalidatePath("/");
    revalidatePath("/admin/events");
    return "archived" as const;
  }

  const { data, error } = await supabase
    .from("events")
    .delete()
    .eq("id", id.data)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23503") {
      const racedArchive = await archiveEvent(supabase, id.data);
      if (racedArchive) {
        revalidatePath("/");
        revalidatePath("/admin/events");
        return "archived" as const;
      }
      reportDatabaseError("Unable to delete the event.", error);
    } else {
      reportDatabaseError("Unable to delete the event.", error);
    }
  }

  if (!data) {
    return "not-found" as const;
  }

  revalidatePath("/admin/events");
  revalidatePath("/");
  return "deleted" as const;
}
