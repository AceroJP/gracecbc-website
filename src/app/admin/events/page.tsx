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
import { createEventAction, deleteEventAction, updateEventAction } from "./actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SweetAlertError } from "@/components/ui/sweet-alert-error";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events",
};

type EventsPageProps = {
  searchParams: Promise<{ error?: string; notice?: string }>;
};

const notices: Record<string, string> = {
  created: "Event saved and published on the public website.",
  updated: "Event changes saved and published.",
  deleted: "Event removed from the public website.",
};

const errors: Record<string, string> = {
  invalid: "Check the event details and try again.",
  "not-found": "That event could not be found. Refresh the list and try again.",
  "has-registrations":
    "This event has registrations and cannot be deleted. Disable registration instead to preserve participant records.",
  "registration-form":
    "Check the registration form. Enabled forms need at least one valid field, and dropdowns need at least two unique options.",
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

async function getEvents(): Promise<ChurchEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: true })
    .order("starts_at", { ascending: true });

  if (error) {
    throw new Error("Unable to load events.", { cause: error });
  }

  return data;
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const [events, params] = await Promise.all([getEvents(), searchParams]);
  const notice = params.notice ? notices[params.notice] : undefined;
  const error = params.error ? errors[params.error] : undefined;

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
        <a
          className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          href="#create-event"
        >
          <Plus aria-hidden="true" className="size-4" />
          Add event
        </a>
      </div>

      {notice && (
        <p
          className="mt-6 rounded-xl border border-border bg-muted px-4 py-3 text-sm"
          role="status"
        >
          {notice}
        </p>
      )}
      {error && (
        <SweetAlertError message={error} title="Unable to save event" />
      )}

      <Card className="mt-7" id="create-event">
        <CardHeader>
          <CardTitle>Add an event</CardTitle>
          <CardDescription>
            New events appear on the public homepage as soon as they are saved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createEventAction} className="flex flex-col gap-5">
            <EventFields prefix="new-event" />
            <Button className="w-fit" type="submit">
              <Plus aria-hidden="true" data-icon="inline-start" />
              Save and publish event
            </Button>
          </form>
        </CardContent>
      </Card>

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

        {events.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <CalendarDays
                aria-hidden="true"
                className="mx-auto size-8 text-muted-foreground"
              />
              <p className="mt-3 text-sm font-medium">No events yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Events you add will appear here and on the public homepage.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {events.map((event) => (
              <Card key={event.id}>
                <CardHeader className="sm:flex sm:flex-row sm:items-start sm:justify-between">
                  <div className="grid gap-2">
                    <CardTitle>{event.title}</CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays aria-hidden="true" className="size-4" />
                        {formatEventDateRange(
                          event.event_date,
                          event.end_date,
                        )}{" "}
                        ·{" "}
                        {formatEventTime(event.starts_at)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin aria-hidden="true" className="size-4" />
                        {event.location}
                      </span>
                      <span>
                        {event.registration_enabled
                          ? "Registration enabled"
                          : "Registration off"}
                      </span>
                    </CardDescription>
                  </div>
                  <form action={deleteEventAction}>
                    <input name="id" type="hidden" value={event.id} />
                    <Button
                      className="mt-3 sm:mt-0"
                      size="sm"
                      type="submit"
                      variant="destructive"
                    >
                      Delete
                    </Button>
                  </form>
                </CardHeader>
                <CardContent>
                  <Link
                    className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
                    href={`/admin/events/${event.id}/registrations`}
                  >
                    View registrations
                  </Link>
                  <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
                    {event.description}
                  </p>
                  <details className="mt-5 border-t border-border pt-4">
                    <summary className="w-fit cursor-pointer text-sm font-medium text-primary">
                      Edit event
                    </summary>
                    <form
                      action={updateEventAction}
                      className="mt-5 flex flex-col gap-5"
                    >
                      <input name="id" type="hidden" value={event.id} />
                      <EventFields event={event} prefix={`event-${event.id}`} />
                      <Button className="w-fit" type="submit">
                        Save and publish changes
                      </Button>
                    </form>
                  </details>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
