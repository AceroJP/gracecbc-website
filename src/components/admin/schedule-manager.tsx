"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import Swal from "sweetalert2";
import { changeWorshipSchedule, saveWorshipSchedule } from "@/app/admin/schedules/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { WorshipSchedule } from "@/lib/worship-schedules";

function ScheduleDialog({ schedule }: { schedule?: WorshipSchedule }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const prefix = schedule?.id ?? "new-schedule";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await saveWorshipSchedule(new FormData(event.currentTarget));
      if (result.status === "error") {
        await Swal.fire({ icon: "error", title: "Unable to save schedule", text: result.message });
        return;
      }
      setOpen(false);
      router.refresh();
      await Swal.fire({ icon: "success", title: "Schedule saved", text: result.message });
    } catch {
      await Swal.fire({ icon: "error", title: "Unable to save schedule", text: "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size={schedule ? "sm" : "default"} type="button" variant={schedule ? "outline" : "default"} />}>
        {!schedule && <Plus data-icon="inline-start" />}{schedule ? "Edit" : "Add schedule"}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{schedule ? "Edit schedule" : "Add worship schedule"}</DialogTitle>
          <DialogDescription>Saving updates the public homepage when the schedule section is visible.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-5" onSubmit={(event) => void submit(event)}>
          {schedule && <input name="id" type="hidden" value={schedule.id} />}
          <FieldGroup>
            <Field><FieldLabel htmlFor={`${prefix}-service`}>Service name</FieldLabel><Input defaultValue={schedule?.service_name} id={`${prefix}-service`} maxLength={120} name="service_name" required /></Field>
            <Field><FieldLabel htmlFor={`${prefix}-day`}>Day</FieldLabel><Input defaultValue={schedule?.day} id={`${prefix}-day`} maxLength={40} name="day" placeholder="Sunday" required /></Field>
            <Field><FieldLabel htmlFor={`${prefix}-time`}>Time</FieldLabel><Input defaultValue={schedule?.time} id={`${prefix}-time`} maxLength={40} name="time" placeholder="9:00 AM" required /></Field>
            <Field><FieldLabel htmlFor={`${prefix}-note`}>Optional note</FieldLabel><Textarea defaultValue={schedule?.note} id={`${prefix}-note`} maxLength={300} name="note" rows={3} /></Field>
          </FieldGroup>
          <Button className="w-fit" disabled={saving} type="submit">{saving ? "Saving..." : "Save schedule"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ScheduleManager({ schedules }: { schedules: WorshipSchedule[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const active = schedules.filter((schedule) => !schedule.archived_at);
  const archived = schedules.filter((schedule) => schedule.archived_at);

  async function change(schedule: WorshipSchedule, operation: "archive" | "restore" | "delete" | "up" | "down") {
    if (operation === "archive" || operation === "delete") {
      const confirmation = await Swal.fire({ icon: "warning", title: operation === "archive" ? "Archive schedule?" : "Delete schedule permanently?", text: operation === "archive" ? `"${schedule.service_name}" will no longer appear on the homepage.` : `"${schedule.service_name}" cannot be recovered.`, showCancelButton: true, confirmButtonText: operation === "archive" ? "Archive" : "Delete", cancelButtonText: "Cancel" });
      if (!confirmation.isConfirmed) return;
    }
    setBusy(true);
    try {
      const result = await changeWorshipSchedule(schedule.id, operation);
      router.refresh();
      if (result.status === "error") await Swal.fire({ icon: "error", title: "Unable to update schedule", text: result.message });
    } catch {
      await Swal.fire({ icon: "error", title: "Unable to update schedule", text: "Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 flex flex-col gap-8">
      <div className="flex justify-end"><ScheduleDialog /></div>
      <section aria-labelledby="active-schedules-heading">
        <h2 className="mb-4 text-lg font-semibold" id="active-schedules-heading">Published schedules</h2>
        {active.length === 0 && <p className="text-sm text-muted-foreground">No schedules yet. Add one to show it on the homepage.</p>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((schedule, index) => <Card key={schedule.id}><CardContent className="flex flex-col gap-3">
            <div><p className="text-sm text-muted-foreground">{schedule.day} - {schedule.time}</p><h3 className="mt-1 font-semibold">{schedule.service_name}</h3>{schedule.note && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{schedule.note}</p>}</div>
            <div className="flex flex-wrap gap-2"><ScheduleDialog schedule={schedule} /><Button aria-label={`Move ${schedule.service_name} up`} disabled={busy || index === 0} onClick={() => void change(schedule, "up")} size="sm" type="button" variant="outline"><ArrowUp data-icon="inline-start" />Up</Button><Button aria-label={`Move ${schedule.service_name} down`} disabled={busy || index === active.length - 1} onClick={() => void change(schedule, "down")} size="sm" type="button" variant="outline"><ArrowDown data-icon="inline-start" />Down</Button><Button disabled={busy} onClick={() => void change(schedule, "archive")} size="sm" type="button" variant="outline">Archive</Button></div>
          </CardContent></Card>)}
        </div>
      </section>
      {archived.length > 0 && <section aria-labelledby="archived-schedules-heading"><h2 className="mb-4 text-lg font-semibold" id="archived-schedules-heading">Archived schedules</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{archived.map((schedule) => <Card key={schedule.id}><CardContent className="flex flex-col gap-3"><div><p className="text-sm text-muted-foreground">{schedule.day} - {schedule.time}</p><h3 className="mt-1 font-semibold">{schedule.service_name}</h3>{schedule.note && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{schedule.note}</p>}</div><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void change(schedule, "restore")} size="sm" type="button" variant="outline">Restore</Button><Button disabled={busy} onClick={() => void change(schedule, "delete")} size="sm" type="button" variant="outline">Delete</Button></div></CardContent></Card>)}</div></section>}
    </div>
  );
}
