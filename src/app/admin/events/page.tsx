import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, MapPin, Plus } from "lucide-react";
import {
  formatEventDateRange,
  formatEventTime,
  type ChurchEvent,
} from "@/lib/events";
import { parseRegistrationFields } from "@/lib/registration";
import { createClient } from "@/lib/supabase/server";
import { RegistrationFieldsEditor } from "@/components/admin/registration-fields-editor";
import { EventActions } from "@/components/admin/event-actions";
import { EventSaveForm } from "@/components/admin/event-save-form";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events",
};

function EventFields({
  event,
  prefix,
}: {
  event?: ChurchEvent;
  prefix: string;
}) {
  return (
    <FieldGroup className="grid gap-4 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor={`${prefix}-title`}>Event title</FieldLabel>
        <Input
          autoComplete="off"
          defaultValue={event?.title}
          id={`${prefix}-title`}
          maxLength={120}
          name="title"
          placeholder="e.g. Community worship service"
          required
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-location`}>Location</FieldLabel>
        <Input
          defaultValue={event?.location}
          id={`${prefix}-location`}
          maxLength={200}
          name="location"
          placeholder="Church or event location"
          required
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-date`}>Start date</FieldLabel>
        <Input
          defaultValue={event?.event_date}
          id={`${prefix}-date`}
          name="event_date"
          required
          type="date"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-end-date`}>End date (optional)</FieldLabel>
        <Input
          defaultValue={event?.end_date ?? ""}
          id={`${prefix}-end-date`}
          name="end_date"
          type="date"
        />
        <FieldDescription>
          Leave blank for a one-day event.
        </FieldDescription>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor={`${prefix}-starts-at`}>Starts</FieldLabel>
          <Input
            defaultValue={event?.starts_at.slice(0, 5)}
            id={`${prefix}-starts-at`}
            name="starts_at"
            required
            type="time"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${prefix}-ends-at`}>Ends (optional)</FieldLabel>
          <Input
            defaultValue={event?.ends_at?.slice(0, 5) ?? ""}
            id={`${prefix}-ends-at`}
            name="ends_at"
            type="time"
          />
        </Field>
      </div>
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor={`${prefix}-description`}>Description</FieldLabel>
        <Textarea
          className="min-h-28"
          defaultValue={event?.description}
          id={`${prefix}-description`}
          maxLength={3000}
          name="description"
          placeholder="Share event details for the public website."
          required
          rows={4}
        />
      </Field>
      <div className="sm:col-span-2">
        <RegistrationFieldsEditor
          capacity={event?.registration_capacity ?? null}
          deadline={event?.registration_deadline ?? null}
          enabled={event?.registration_enabled ?? false}
          fields={
            event
              ? parseRegistrationFields(event.registration_fields)
              : []
          }
          prefix={prefix}
        />
      </div>
    </FieldGroup>
  );
}

type AdminEvent = ChurchEvent & { registrationCount: number };

async function getEvents(): Promise<AdminEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: true })
    .order("starts_at", { ascending: true });

  if (error) {
    throw new Error("Unable to load events.", { cause: error });
  }

  return Promise.all(
    data.map(async (event) => {
      const { count, error: countError } = await supabase
        .from("event_registrations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id);

      if (countError) {
        throw new Error("Unable to count event registrations.", {
          cause: countError,
        });
      }

      return { ...event, registrationCount: count ?? 0 };
    }),
  );
}

function EditEventDialog({ event }: { event: ChurchEvent }) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button size="sm" type="button" variant="outline" />
        }
      >
        Edit event
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit event</DialogTitle>
          <DialogDescription>
            Update the event details and registration form. Changes are
            published immediately.
          </DialogDescription>
        </DialogHeader>
        <EventSaveForm eventId={event.id}>
          <EventFields event={event} prefix={`event-${event.id}`} />
        </EventSaveForm>
      </DialogContent>
    </Dialog>
  );
}

function EventList({
  events,
  archived = false,
}: {
  events: AdminEvent[];
  archived?: boolean;
}) {
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <CalendarDays
            aria-hidden="true"
            className="mx-auto size-8 text-muted-foreground"
          />
          <p className="mt-3 text-sm font-medium">
            {archived ? "No archived events" : "No published events"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {archived
              ? "Archived events will appear here and can be restored."
              : "Events you add will appear here and on the public homepage."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium" scope="col">Event</th>
              <th className="px-5 py-3 font-medium" scope="col">Date &amp; time</th>
              <th className="px-5 py-3 font-medium" scope="col">Location</th>
              <th className="px-5 py-3 font-medium" scope="col">Registrations</th>
              <th className="px-5 py-3 font-medium" scope="col">Status</th>
              <th className="px-5 py-3 text-right font-medium" scope="col">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {events.map((event) => (
              <tr className="align-top" key={event.id}>
                <th className="max-w-64 px-5 py-4 font-medium" scope="row">
                  <p>{event.title}</p>
                  <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs leading-5 text-muted-foreground">
                    {event.description}
                  </p>
                </th>
                <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
                    {formatEventDateRange(event.event_date, event.end_date)}
                  </span>
                  <p className="mt-1 pl-5 text-xs">
                    {formatEventTime(event.starts_at)}
                    {event.ends_at ? ` – ${formatEventTime(event.ends_at)}` : ""}
                  </p>
                </td>
                <td className="max-w-52 px-5 py-4 text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin aria-hidden="true" className="size-4 shrink-0" />
                    {event.location}
                  </span>
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">
                  {event.registrationCount}{" "}
                  {event.registrationCount === 1 ? "participant" : "participants"}
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  {archived ? (
                    <span className="text-muted-foreground">Archived</span>
                  ) : event.registration_enabled ? (
                    <span className="text-primary">Registration open</span>
                  ) : (
                    <span className="text-muted-foreground">Registration off</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link
                      className={buttonVariants({ size: "sm", variant: "outline" })}
                      href={`/admin/events/${event.id}/registrations`}
                    >
                      Registrations
                    </Link>
                    {!archived && <EditEventDialog event={event} />}
                    <EventActions
                      archived={archived}
                      eventId={event.id}
                      eventTitle={event.title}
                      registrationCount={event.registrationCount}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export default async function EventsPage() {
  const allEvents = await getEvents();
  const events = allEvents.filter((event) => !event.archived_at);
  const archivedEvents = allEvents.filter((event) => event.archived_at);

  return (
    <>
      <p className="text-xs font-medium text-muted-foreground">
        <Link className="hover:text-foreground" href="/admin/dashboard">
          Admin
        </Link>{" "}
        / Events
      </p>
      <div className="mt-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Events
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Add and manage events displayed on the public homepage. Saving
            publishes changes immediately.
          </p>
        </div>
        <Dialog>
          <DialogTrigger render={<Button className="w-fit" type="button" />}>
            <Plus data-icon="inline-start" />
            Add event
          </DialogTrigger>
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Publish an event</DialogTitle>
              <DialogDescription>
                New events appear on the public homepage as soon as they are saved.
              </DialogDescription>
            </DialogHeader>
            <EventSaveForm>
              <EventFields prefix="new-event" />
            </EventSaveForm>
          </DialogContent>
        </Dialog>
      </div>

      <section aria-labelledby="events-list-heading" className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2
              className="text-lg font-semibold tracking-tight"
              id="events-list-heading"
            >
              Published events
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {events.length} {events.length === 1 ? "event" : "events"}
            </p>
          </div>
        </div>
        <EventList events={events} />
      </section>

      {archivedEvents.length > 0 && (
        <section aria-labelledby="archived-events-heading" className="mt-10">
          <div className="mb-4">
            <h2
              className="text-lg font-semibold tracking-tight"
              id="archived-events-heading"
            >
              Archived events
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {archivedEvents.length} archived{" "}
              {archivedEvents.length === 1 ? "event" : "events"}; participant
              records are retained.
            </p>
          </div>
          <EventList archived events={archivedEvents} />
        </section>
      )}
    </>
  );
}
