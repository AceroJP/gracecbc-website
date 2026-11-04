import { createClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/auth/server";
import { NextResponse } from "next/server";
import type { Database } from "@/types/database.types";

type ExportRouteProps = {
  params: Promise<{ eventId: string }>;
};

type ExportRegistration =
  Database["public"]["Tables"]["event_registrations"]["Row"];

function csvCell(value: string) {
  const safeValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function answerText(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function safeFilename(title: string) {
  const slug =
    title
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "event";

  return `${slug}-registrations.csv`;
}

export async function GET(_request: Request, { params }: ExportRouteProps) {
  await requireAdminUser();
  const { eventId } = await params;
  const supabase = await createClient();
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("title")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) {
    throw new Error("Unable to load the event for export.", {
      cause: eventError,
    });
  }

  if (!event) {
    return new NextResponse("Event not found.", { status: 404 });
  }

  const pageSize = 500;
  const registrations: Pick<
    ExportRegistration,
    "answers" | "form_snapshot" | "submitted_at"
  >[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("event_registrations")
      .select("answers, form_snapshot, submitted_at")
      .eq("event_id", eventId)
      .order("submitted_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error("Unable to export event registrations.", { cause: error });
    }

    registrations.push(...data);

    if (data.length < pageSize) {
      break;
    }
  }

  const fieldLabels = new Map<string, string>();
  for (const registration of registrations) {
    if (!Array.isArray(registration.form_snapshot)) {
      continue;
    }

    for (const value of registration.form_snapshot) {
      if (
        value &&
        typeof value === "object" &&
        "id" in value &&
        "label" in value &&
        typeof value.id === "string" &&
        typeof value.label === "string"
      ) {
        fieldLabels.set(value.id, value.label);
      }
    }
  }

  const columns = [...fieldLabels.entries()];
  const rows = [
    ["Submitted at", ...columns.map(([, label]) => label)],
    ...registrations.map((registration) => {
      const answers =
        registration.answers &&
        typeof registration.answers === "object" &&
        !Array.isArray(registration.answers)
          ? registration.answers
          : {};

      return [
        new Date(registration.submitted_at).toISOString(),
        ...columns.map(([id]) =>
          answerText(Reflect.get(answers, id)),
        ),
      ];
    }),
  ];

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Disposition": `attachment; filename="${safeFilename(event.title)}"`,
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
