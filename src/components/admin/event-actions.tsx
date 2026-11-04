"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import {
  archiveEventAction,
  deleteEventAction,
  restoreEventAction,
} from "@/app/admin/events/actions";

export function EventActions({
  eventId,
  eventTitle,
  registrationCount,
  archived = false,
}: {
  eventId: string;
  eventTitle: string;
  registrationCount: number;
  archived?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function runAction(
    action: () => Promise<string>,
    successText: (result: string) => string,
  ) {
    setBusy(true);
    try {
      const result = await action();
      if (result === "not-found") {
        await Swal.fire({
          icon: "error",
          title: "Event not found",
          text: "Refresh the page and try again.",
          confirmButtonText: "Okay",
        });
        router.refresh();
        return;
      }
      if (result === "invalid") {
        throw new Error("The event identifier is invalid.");
      }

      router.refresh();
      await Swal.fire({
        icon: "success",
        title: "Event updated",
        text: successText(result),
        confirmButtonText: "Okay",
      });
    } catch (error) {
      console.error("Event management request failed.", error);
      await Swal.fire({
        icon: "error",
        title: "Unable to update event",
        text: "We couldn’t complete this action. Please try again.",
        confirmButtonText: "Okay",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const hasRegistrations = registrationCount > 0;
    const confirmation = await Swal.fire({
      icon: "warning",
      title: hasRegistrations ? "Archive this event?" : "Delete this event?",
      text: hasRegistrations
        ? `"${eventTitle}" has ${registrationCount} ${registrationCount === 1 ? "participant" : "participants"}. Archiving removes it from the public website and preserves all registration records.`
        : `"${eventTitle}" has no participants and will be permanently deleted.`,
      showCancelButton: true,
      confirmButtonText: hasRegistrations ? "Archive event" : "Delete event",
      cancelButtonText: "Cancel",
      confirmButtonColor: hasRegistrations ? undefined : "#b91c1c",
      reverseButtons: true,
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    await runAction(
      () => deleteEventAction(eventId),
      (result) =>
        result === "archived"
          ? "The event was archived. Its participant registrations are preserved."
          : "The event was permanently deleted.",
    );
  }

  async function handleArchive() {
    const confirmation = await Swal.fire({
      icon: "warning",
      title: "Archive this event?",
      text: `This removes "${eventTitle}" from the public website. ${registrationCount} ${registrationCount === 1 ? "participant registration" : "participant registrations"} will be preserved.`,
      showCancelButton: true,
      confirmButtonText: "Archive event",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    await runAction(
      () => archiveEventAction(eventId),
      () => "The event was archived and can be restored later.",
    );
  }

  async function handleRestore() {
    const confirmation = await Swal.fire({
      icon: "question",
      title: "Restore this event?",
      text: `"${eventTitle}" will appear on the public website again.`,
      showCancelButton: true,
      confirmButtonText: "Restore event",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    await runAction(
      () => restoreEventAction(eventId),
      () => "The event is published on the public website again.",
    );
  }

  if (archived) {
    return (
      <Button
        disabled={busy}
        onClick={handleRestore}
        size="sm"
        type="button"
        variant="outline"
      >
        <RotateCcw data-icon="inline-start" />
        Restore
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={busy}
        onClick={handleArchive}
        size="sm"
        type="button"
        variant="outline"
      >
        <Archive data-icon="inline-start" />
        Archive
      </Button>
      <Button
        disabled={busy}
        onClick={handleDelete}
        size="sm"
        type="button"
        variant="destructive"
      >
        <Trash2 data-icon="inline-start" />
        Delete
      </Button>
    </div>
  );
}
