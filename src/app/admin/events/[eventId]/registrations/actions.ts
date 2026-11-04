"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/server";
import {
  parseRegistrationFields,
  validateRegistrationAnswers,
  type RegistrationField,
} from "@/lib/registration";
import { createClient } from "@/lib/supabase/server";

export type RegistrationManagementState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const uuidSchema = z.uuid();

function invalidRequest(): RegistrationManagementState {
  return {
    status: "error",
    message: "This registration could not be found. Refresh and try again.",
  };
}

function errorState(): RegistrationManagementState {
  return {
    status: "error",
    message: "We couldn’t update this registration right now. Please try again.",
  };
}

function registrationsPath(eventId: string) {
  return `/admin/events/${eventId}/registrations`;
}

export async function updateRegistrationAction(
  eventId: string,
  registrationId: string,
  _previousState: RegistrationManagementState,
  formData: FormData,
): Promise<RegistrationManagementState> {
  await requireAdminUser();

  if (
    !uuidSchema.safeParse(eventId).success ||
    !uuidSchema.safeParse(registrationId).success
  ) {
    return invalidRequest();
  }

  const supabase = await createClient();
  const { data: registration, error: loadError } = await supabase
    .from("event_registrations")
    .select("form_snapshot")
    .eq("id", registrationId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (loadError) {
    console.error("Unable to load registration for editing.", loadError);
    return errorState();
  }

  if (!registration) {
    return invalidRequest();
  }

  let fields: RegistrationField[];
  try {
    fields = parseRegistrationFields(registration.form_snapshot);
  } catch (error) {
    console.error("Stored registration form is invalid.", error);
    return errorState();
  }

  const answers = validateRegistrationAnswers(formData, fields);
  if (!answers) {
    return {
      status: "error",
      message: "Check the registration answers and required fields, then try again.",
    };
  }

  const { data, error } = await supabase
    .from("event_registrations")
    .update({ answers })
    .eq("id", registrationId)
    .eq("event_id", eventId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Unable to update event registration.", error);
    return errorState();
  }

  if (!data) {
    return invalidRequest();
  }

  revalidatePath(registrationsPath(eventId));
  return { status: "success", message: "Registration updated." };
}

export async function deleteRegistrationAction(
  eventId: string,
  registrationId: string,
): Promise<RegistrationManagementState> {
  await requireAdminUser();

  if (
    !uuidSchema.safeParse(eventId).success ||
    !uuidSchema.safeParse(registrationId).success
  ) {
    return invalidRequest();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_registrations")
    .delete()
    .eq("id", registrationId)
    .eq("event_id", eventId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Unable to delete event registration.", error);
    return {
      status: "error",
      message: "We couldn’t delete this registration right now. Please try again.",
    };
  }

  if (!data) {
    return invalidRequest();
  }

  revalidatePath(registrationsPath(eventId));
  return { status: "success", message: "Registration deleted." };
}
