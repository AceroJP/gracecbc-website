import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatEventDateRange } from "@/lib/events";
import { parseRegistrationFields } from "@/lib/registration";
import { parseRegistrationFileAnswer } from "@/lib/registration";
import { requireAdminUser } from "@/lib/auth/server";
import { createPrivilegedClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database.types";
import { RegistrationActions } from "./registration-actions";

export const dynamic = "force-dynamic";

type Registration =
  Database["public"]["Tables"]["event_registrations"]["Row"];

type RegistrationsPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ page?: string }>;
};

const pageSize = 50;

export async function generateMetadata({
  params,
}: RegistrationsPageProps): Promise<Metadata> {
  const { eventId } = await params;
  const supabase = await createClient();
  const { data: event, error } = await supabase
    .from("events")
    .select("title")
    .eq("id", eventId)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load event metadata.", { cause: error });
  }

  return { title: event ? `Registrations: ${event.title}` : "Registrations" };
}

function asAnswerRecord(value: Json): Record<string, Json | undefined> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  return {};
}

function displayAnswer(value: Json | undefined) {
  if (value === undefined || value === null || value === "") {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").join(", ");
  }

  const file = parseRegistrationFileAnswer(value);
  if (file) {
    return file.name;
  }

  return typeof value === "object" ? "" : String(value);
}

function formatSubmittedAt(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function EventRegistrationsPage({
  params,
  searchParams,
}: RegistrationsPageProps) {
  await requireAdminUser();
  const [{ eventId }, query] = await Promise.all([params, searchParams]);
  const requestedPage = Number.parseInt(query.page ?? "1", 10);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const supabase = await createClient();
  const [eventResult, registrationsResult] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, event_date, end_date, registration_enabled, registration_fields")
      .eq("id", eventId)
      .maybeSingle(),
    supabase
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
  ]);

  if (eventResult.error) {
    throw new Error("Unable to load the event.", { cause: eventResult.error });
  }

  if (registrationsResult.error) {
    throw new Error("Unable to load event registrations.", {
      cause: registrationsResult.error,
    });
  }

  const event = eventResult.data;

  if (!event) {
    notFound();
  }

  const totalCount = registrationsResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const { data: registrations, error: pageError } = await supabase
    .from("event_registrations")
    .select("*")
    .eq("event_id", eventId)
    .order("submitted_at", { ascending: false })
    .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

  if (pageError) {
    throw new Error("Unable to load this registration page.", {
      cause: pageError,
    });
  }

  const fileAnswers = registrations.flatMap((registration) =>
    Object.values(asAnswerRecord(registration.answers))
      .map(parseRegistrationFileAnswer)
      .filter(
        (answer): answer is NonNullable<typeof answer> =>
          answer !== null && answer.path.startsWith(`${eventId}/`),
      )
      .map((answer) => ({ registrationId: registration.id, answer })),
  );
  const fileUrls = new Map<string, string>();
  if (fileAnswers.length > 0) {
    const privilegedClient = createPrivilegedClient();
    const signedFiles = await Promise.all(
      fileAnswers.map(async ({ registrationId, answer }) => {
        const { data, error } = await privilegedClient.storage
          .from("event-registration-files")
          .createSignedUrl(answer.path, 60 * 60);
        if (error) {
          console.error("Unable to create admin registration file link.", error);
          throw new Error("Unable to create an attachment link.", {
            cause: error,
          });
        }

        return {
          key: `${registrationId}:${answer.path}`,
          url: data.signedUrl,
        };
      }),
    );
    for (const file of signedFiles) {
      fileUrls.set(file.key, file.url);
    }
  }

  return (
    <>
      <Link
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        href="/admin/events"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to events
      </Link>
      <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {formatEventDateRange(event.event_date, event.end_date)}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {event.title} registrations
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {totalCount} {totalCount === 1 ? "participant" : "participants"}
          </p>
        </div>
        {registrations.length > 0 && (
          <Button
            render={
              <a href={`/admin/events/${event.id}/registrations/export`} />
            }
            variant="outline"
          >
            <Download aria-hidden="true" data-icon="inline-start" />
            Export CSV
          </Button>
        )}
      </div>

      {!event.registration_enabled && (
        <p className="mt-6 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          Registration is currently disabled for this event. Previously
          collected registrations remain available to administrators.
        </p>
      )}

      {totalCount === 0 ? (
        <Card className="mt-7">
          <CardContent className="py-10 text-center">
            <p className="text-sm font-medium">No registrations yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              New submissions for this event will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-7 grid gap-4">
          {registrations.map((registration: Registration) => {
            const answers = asAnswerRecord(registration.answers);
            const snapshot = parseRegistrationFields(registration.form_snapshot);
            const registrationFileUrls = Object.fromEntries(
              snapshot.flatMap((field) => {
                const file = parseRegistrationFileAnswer(answers[field.id]);
                const url = file
                  ? fileUrls.get(`${registration.id}:${file.path}`)
                  : undefined;
                return url ? [[field.id, url]] : [];
              }),
            );

            return (
              <Card key={registration.id}>
                <CardHeader>
                  <CardTitle className="text-sm">
                    Submitted {formatSubmittedAt(registration.submitted_at)}
                  </CardTitle>
                  <CardDescription>
                    Registration reference: {registration.id}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    {snapshot.map((field) => {
                      const file =
                        field.type === "file_upload"
                          ? parseRegistrationFileAnswer(answers[field.id])
                          : null;

                      return (
                      <div className="min-w-0" key={field.id}>
                        <dt className="text-xs font-medium text-muted-foreground">
                          {field.label}
                        </dt>
                        <dd className="mt-1 break-words whitespace-pre-line text-sm">
                          {file && registrationFileUrls[field.id] ? (
                            <a
                              className="font-medium text-primary underline underline-offset-4"
                              href={registrationFileUrls[field.id]}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {file.name}
                            </a>
                          ) : (
                            displayAnswer(answers[field.id])
                          )}
                        </dd>
                      </div>
                      );
                    })}
                  </dl>
                  <div className="mt-5 border-t border-border pt-4">
                    <RegistrationActions
                      answers={answers}
                      eventId={event.id}
                      fields={snapshot}
<<<<<<< HEAD
=======
                      fileUrls={registrationFileUrls}
>>>>>>> 703a9cd (Add private storage bucket for registration uploads)
                      registrationId={registration.id}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Registration pages"
          className="mt-6 flex items-center justify-between gap-4"
        >
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Button
                render={
                  <Link
                    href={`/admin/events/${eventId}/registrations?page=${currentPage - 1}`}
                  />
                }
                variant="outline"
              >
                Previous
              </Button>
            )}
            {currentPage < totalPages && (
              <Button
                render={
                  <Link
                    href={`/admin/events/${eventId}/registrations?page=${currentPage + 1}`}
                  />
                }
                variant="outline"
              >
                Next
              </Button>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
