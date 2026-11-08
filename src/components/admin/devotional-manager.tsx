"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type React from "react";
import { BookOpenText, Check, Eye, X } from "lucide-react";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  moderateDevotionalAction,
} from "@/app/admin/devotionals/actions";
import { showLoadingAlert } from "@/lib/sweet-alert";
import { ContributorManager } from "@/components/admin/contributor-manager";

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

export function DevotionalManager({
  devotionals,
  contributors,
  applications,
}: {
  devotionals: Devotional[];
  contributors: React.ComponentProps<typeof ContributorManager>["contributors"];
  applications: React.ComponentProps<typeof ContributorManager>["applications"];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function submit(action: AdminAction, form: FormData) {
    startTransition(async () => {
      showLoadingAlert("Saving moderation change", "Please wait...");
      try {
        const result = await action(form);
        Swal.close();
        if (result.status === "success") {
          router.refresh();
          await Swal.fire({
            icon: "success",
            title: "Action completed",
            text: result.message,
            confirmButtonText: "Okay",
          });
        } else {
          await Swal.fire({
            icon: "error",
            title: "Action failed",
            text: result.message,
            confirmButtonText: "Okay",
          });
        }
      } catch (error) {
        console.error("Devotional moderation request failed.", error);
        Swal.close();
        await Swal.fire({
          icon: "error",
          title: "Unable to complete action",
          text: "Please try again.",
          confirmButtonText: "Okay",
        });
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
      <ContributorManager
        applications={applications}
        contributors={contributors}
      />
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
        void confirmAndSubmit(
          action === "delete"
            ? "Delete this devotional permanently?"
            : `${action[0].toUpperCase()}${action.slice(1)} this devotional?`,
          action,
          id,
          moderateDevotionalAction,
          onSubmit,
        );
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

async function confirmAndSubmit(
  text: string,
  action: string,
  id: string,
  handler: AdminAction,
  onSubmit: (action: AdminAction, form: FormData) => void,
) {
  const confirmation = await Swal.fire({
    icon: action.includes("delete") ? "warning" : "question",
    title: "Confirm action",
    text,
    showCancelButton: true,
    confirmButtonText: "Continue",
    cancelButtonText: "Cancel",
    confirmButtonColor: action.includes("delete") ? "#b91c1c" : undefined,
    reverseButtons: true,
  });
  if (!confirmation.isConfirmed) return;
  const form = new FormData();
  form.set("id", id);
  form.set("action", action);
  form.set("reason", "");
  onSubmit(handler, form);
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <BookOpenText className="mx-auto size-8 text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
