import type { Metadata } from "next";
import Link from "next/link";
import { ScheduleManager } from "@/components/admin/schedule-manager";
import { requireAdminUser } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { legacyScheduleRowsSchema } from "@/lib/worship-schedules";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Schedules" };

export default async function SchedulesPage() {
  await requireAdminUser();
  const supabase = await createClient();
  const [{ data: schedules, error }, { data: backup, error: backupError }] = await Promise.all([
    supabase.from("worship_schedules").select("*").order("sort_order").order("id"),
    supabase.from("worship_schedule_legacy_draft").select("rows").eq("id", true).maybeSingle(),
  ]);
  if (error || backupError) throw new Error("Unable to load worship schedules. Ensure the schedule migration has been applied.", { cause: error ?? backupError });
  const legacyRows = backup ? legacyScheduleRowsSchema.safeParse(backup.rows) : null;

  return (
    <>
      <p className="text-xs font-medium text-muted-foreground"><Link className="hover:text-foreground" href="/admin/dashboard">Admin</Link> / Schedules</p>
      <div className="mt-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Schedules</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Manage recurring worship schedules. Changes appear on the public homepage when its worship schedule section is published and visible.</p>
      </div>
      {backup && (
        <section className="mt-6 rounded-xl border border-border bg-card p-5" aria-labelledby="legacy-schedule-heading">
          <h2 className="text-base font-semibold" id="legacy-schedule-heading">Review previously unpublished schedule changes</h2>
          <p className="mt-2 text-sm text-muted-foreground">These rows were saved in the old landing-page draft and differ from the previously published schedule. They were not published automatically. Compare them with the current schedules and apply any changes manually.</p>
          {legacyRows?.success ? legacyRows.data.length ? (
            <ul className="mt-3 flex flex-col gap-2 text-sm">{legacyRows.data.map((row, index) => <li key={`${row.id}-${index}`}><strong>{row.serviceName}</strong> - {row.day}, {row.time}{row.note ? ` - ${row.note}` : ""}</li>)}</ul>
          ) : <p className="mt-3 text-sm">The previous draft contained no schedule rows.</p> : <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(backup.rows, null, 2)}</pre>}
        </section>
      )}
      <ScheduleManager schedules={schedules} />
    </>
  );
}
