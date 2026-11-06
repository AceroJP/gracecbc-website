"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus } from "lucide-react";
import Swal from "sweetalert2";
import {
  createEventAction,
  updateEventAction,
} from "@/app/admin/events/actions";
import { Button } from "@/components/ui/button";
import { showLoadingAlert } from "@/lib/sweet-alert";

export function EventSaveForm({
  eventId,
  children,
}: {
  eventId?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSaving(true);
    showLoadingAlert(
      eventId ? "Saving event changes" : "Publishing event",
      "Please wait while we save the event and registration form...",
    );

    try {
      const result = eventId
        ? await updateEventAction(new FormData(form))
        : await createEventAction(new FormData(form));

      if (result.status === "error") {
        await Swal.fire({
          icon: "error",
          title: "Unable to save event",
          text: result.message,
          confirmButtonText: "Okay",
        });
        return;
      }

      router.refresh();
      if (!eventId) {
        form.reset();
      }
      const dialog = form.closest('[data-slot="dialog-content"]');
      dialog
        ?.querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')
        ?.click();
      await Swal.fire({
        icon: "success",
        title: eventId ? "Event updated" : "Event published",
        text: result.message,
        confirmButtonText: "Okay",
      });
    } catch (error) {
      console.error("Event save request failed.", error);
      await Swal.fire({
        icon: "error",
        title: "Unable to save event",
        text: "We couldn’t save this event right now. Please try again.",
        confirmButtonText: "Okay",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => void handleSubmit(event)}
    >
      {eventId && <input name="id" type="hidden" value={eventId} />}
      {children}
      <Button className="w-fit" disabled={saving} type="submit">
        {saving ? (
          <>
            <LoaderCircle className="animate-spin" data-icon="inline-start" />
            Saving event...
          </>
        ) : eventId ? (
          "Save and publish changes"
        ) : (
          <>
            <Plus data-icon="inline-start" />
            Save and publish event
          </>
        )}
      </Button>
    </form>
  );
}
