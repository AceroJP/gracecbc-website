import {
  CalendarDays,
  FileText,
  Images,
  PanelsTopLeft,
  Users,
} from "lucide-react";
import { AuthStatusAlert } from "@/components/auth/auth-status-alert";
import { requireAdminUser } from "@/lib/auth/server";
import { createPrivilegedClient } from "@/lib/supabase/admin";

type DashboardPageProps = {
  searchParams: Promise<{ notice?: string }>;
};
const workspaceSections = [
  {
    title: "Landing page",
    description: "Manage the public website welcome area.",
    status: "Builder placeholder",
    icon: PanelsTopLeft,
  },
  {
    title: "Events & announcements",
    description: "Publish church events on the public homepage.",
    status: "Events are live",
    icon: CalendarDays,
  },
  {
    title: "Schedules & devotionals",
    description: "Organize church schedule and devotional content.",
    status: "Content placeholder",
    icon: FileText,
  },
  {
    title: "Media library",
    description: "A future home for approved website photos and media.",
    status: "Library placeholder",
    icon: Images,
  },
];

export default async function AdminDashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = await searchParams;
  await requireAdminUser();
  const supabase = createPrivilegedClient();
  const { count: visitorCount, error: visitorCountError } = await supabase
    .from("landing_page_visitor_sessions")
    .select("session_hash", { count: "exact", head: true });

  if (visitorCountError) {
    throw new Error("Unable to load visitor sessions.", { cause: visitorCountError });
  }
  if (visitorCount === null) {
    throw new Error("Visitor session count was not returned.");
  }

  return (
    <>
      {params.notice === "signed-in" && (
        <AuthStatusAlert
          message="You are signed in to the administrator workspace."
          title="Welcome back"
        />
      )}
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Admin / Dashboard
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Website workspace
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Manage church website content. Events can now be published directly
            from this workspace.
          </p>
        </div>
        <span className="w-fit rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
          Events manager active
        </span>
      </div>

      <section aria-label="Visitor sessions" className="mt-8">
        <article className="flex w-fit min-w-64 items-center gap-4 rounded-2xl border border-border bg-card p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/8 text-brand">
            <Users aria-hidden="true" className="size-[18px]" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Visitor sessions</h2>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{visitorCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              One count per browser tab session
            </p>
          </div>
        </article>
      </section>

      <section aria-label="Admin workspace areas" className="mt-9">
        <h2 className="text-sm font-semibold">Workspace areas</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {workspaceSections.map(({ title, description, status, icon: Icon }) => (
            <article
              className="rounded-2xl border border-border bg-card p-5"
              key={title}
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand/8 text-brand">
                <Icon aria-hidden="true" className="size-[18px]" />
              </span>
              <h3 className="mt-5 text-sm font-semibold">{title}</h3>
              <p className="mt-2 min-h-10 text-xs leading-5 text-muted-foreground">
                {description}
              </p>
              <p className="mt-4 border-t border-border pt-3 text-[11px] font-medium text-muted-foreground">
                {status}
              </p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
