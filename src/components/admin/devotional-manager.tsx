"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type React from "react";
import { BookOpenText, Check, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  moderateDevotionalAction,
  reviewContributorApplicationAction,
} from "@/app/admin/devotionals/actions";

type AdminAction = (
  formData: FormData,
) => Promise<{ status: "success" | "error"; message: string }>;

type Devotional = {
  id: string;
  title: string;
  bible_passage: string;
  message: string;
  status: string;
  is_featured: boolean;
  submitted_at: string;
  rejection_reason: string | null;
  author: string;
};

type Application = {
  id: string;
  contributor_id: string;
  full_name: string;
  username: string;
  status: string;
  submitted_at: string;
  email_verified_at: string | null;
};

export function DevotionalManager({
  devotionals,
  applications,
}: {
  devotionals: Devotional[];
  applications: Application[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function submit(action: AdminAction, form: FormData) {
    startTransition(async () => {
      const result = await action(form);
      if (result.status === "success") {
        router.refresh();
      } else {
        window.alert(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Devotionals</h2>
            <p className="text-sm text-muted-foreground">Review every submission before publication.</p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            {devotionals.length} total
          </span>
        </div>
        <div className="grid gap-4">
          {devotionals.map((devotional) => (
            <Card key={devotional.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">{devotional.title}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {devotional.bible_passage} · {devotional.author}
                  </p>
                </div>
                <span className="rounded-full border border-border px-2.5 py-1 text-xs font-medium capitalize">
                  {devotional.status.replace("_", " ")}
                </span>
              </CardHeader>
              <CardContent>
                <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                  {devotional.message}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {devotional.status !== "published" && (
                    <ActionButton action="publish" id={devotional.id} label="Publish" icon={<Check />} pending={pending} onSubmit={submit} />
                  )}
                  {devotional.status === "published" && (
                    <ActionButton action="unpublish" id={devotional.id} label="Unpublish" icon={<Eye />} pending={pending} onSubmit={submit} variant="outline" />
                  )}
                  {devotional.status !== "rejected" && (
                    <ActionButton action="reject" id={devotional.id} label="Reject" icon={<X />} pending={pending} onSubmit={submit} variant="outline" />
                  )}
                  <ActionButton action="delete" id={devotional.id} label="Delete" icon={<X />} pending={pending} onSubmit={submit} variant="destructive" />
                </div>
              </CardContent>
            </Card>
          ))}
          {devotionals.length === 0 && <EmptyState label="No devotional submissions yet." />}
        </div>
      </section>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Contributor applications</h2>
            <p className="text-sm text-muted-foreground">Approve verified applicants before they can submit.</p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            {applications.length} total
          </span>
        </div>
        <div className="grid gap-4">
          {applications.map((application) => (
            <Card key={application.id}>
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{application.full_name}</p>
                  <p className="text-sm text-muted-foreground">@{application.username}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {application.email_verified_at ? "Email verified" : "Email not verified"} · {application.status.replace("_", " ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {application.status === "pending_admin_approval" && (
                    <>
                      <ApplicationButton action="approve" id={application.id} pending={pending} onSubmit={submit} />
                      <ApplicationButton action="reject" id={application.id} pending={pending} onSubmit={submit} />
                    </>
                  )}
                  {application.status === "approved" && (
                    <ApplicationButton action="suspend" id={application.id} pending={pending} onSubmit={submit} />
                  )}
                  {application.status === "rejected" && (
                    <ApplicationButton action="reactivate" id={application.id} pending={pending} onSubmit={submit} />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {applications.length === 0 && <EmptyState label="No contributor applications yet." />}
        </div>
      </section>
    </div>
  );
}

function ActionButton({
  action,
  id,
  label,
  icon,
  pending,
  onSubmit,
  variant = "default",
}: {
  action: "publish" | "reject" | "unpublish" | "delete";
  id: string;
  label: string;
  icon: React.ReactNode;
  pending: boolean;
  onSubmit: (action: AdminAction, form: FormData) => void;
  variant?: "default" | "outline" | "destructive";
}) {
  return (
    <Button
      disabled={pending}
      onClick={() => {
        if (action === "delete" && !window.confirm("Delete this devotional permanently?")) return;
        const form = new FormData();
        form.set("id", id);
        form.set("action", action);
        form.set("reason", "");
        onSubmit(moderateDevotionalAction, form);
      }}
      size="sm"
      type="button"
      variant={variant}
    >
      {icon}
      {label}
    </Button>
  );
}

function ApplicationButton({
  action,
  id,
  pending,
  onSubmit,
}: {
  action: "approve" | "reject" | "suspend" | "reactivate";
  id: string;
  pending: boolean;
  onSubmit: (action: AdminAction, form: FormData) => void;
}) {
  return (
    <Button
      disabled={pending}
      onClick={() => {
        const form = new FormData();
        form.set("id", id);
        form.set("action", action);
        form.set("reason", "");
        onSubmit(reviewContributorApplicationAction, form);
      }}
      size="sm"
      type="button"
      variant={action === "approve" || action === "reactivate" ? "default" : "outline"}
    >
      {action}
    </Button>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <BookOpenText className="mx-auto size-8 text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
