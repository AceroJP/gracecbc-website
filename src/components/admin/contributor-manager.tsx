"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { KeyRound, Pencil, Users } from "lucide-react";
import Swal from "sweetalert2";
import {
  reviewContributorApplicationAction,
  sendContributorPasswordResetAction,
  updateContributorAction,
} from "@/app/admin/devotionals/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { showLoadingAlert } from "@/lib/sweet-alert";

type AdminAction = (
  formData: FormData,
) => Promise<{ status: "success" | "error"; message: string }>;

type Contributor = {
  id: string;
  full_name: string;
  username: string;
  email: string;
  status: string;
  email_verified_at: string | null;
};

type Application = {
  id: string;
  full_name: string;
  username: string;
  status: string;
  email_verified_at: string | null;
};

export function ContributorManager({
  contributors,
  applications,
}: {
  contributors: Contributor[];
  applications: Application[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function submit(action: AdminAction, form: FormData) {
    startTransition(async () => {
      showLoadingAlert("Saving contributor change", "Please wait...");
      try {
        const result = await action(form);
        Swal.close();
        await Swal.fire({
          icon: result.status,
          title: result.status === "success" ? "Action completed" : "Action failed",
          text: result.message,
          confirmButtonText: "Okay",
        });
        if (result.status === "success") router.refresh();
      } catch (error) {
        console.error("Contributor management request failed.", error);
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
        <SectionHeading title="Contributor accounts" description="Manage contributor details and password help." count={contributors.length} />
        <div className="grid gap-4">
          {contributors.map((contributor) => (
            <Card key={contributor.id}>
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{contributor.full_name}</p>
                  <p className="text-sm text-muted-foreground">@{contributor.username} · {contributor.email}</p>
                  <p className="mt-1 text-xs capitalize text-muted-foreground">
                    {contributor.status.replaceAll("_", " ")} · {contributor.email_verified_at ? "Email verified" : "Email not verified"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <EditContributorDialog contributor={contributor} pending={pending} onSubmit={submit} />
                  <Button
                    disabled={pending}
                    onClick={() => void confirmAndSubmit(
                      `Send a password reset email to ${contributor.email}?`,
                      contributor.id,
                      sendContributorPasswordResetAction,
                      submit,
                    )}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <KeyRound />
                    Send reset email
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {contributors.length === 0 && <EmptyState label="No contributor accounts yet." />}
        </div>
      </section>

      <section>
        <SectionHeading title="Verified applications awaiting approval" description="Review verified applicants before they can submit devotionals." count={applications.filter((application) => application.status === "pending_admin_approval").length} />
        <div className="grid gap-4">
          {applications.filter((application) => application.status === "pending_admin_approval").map((application) => (
            <Card key={application.id}>
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{application.full_name}</p>
                  <p className="text-sm text-muted-foreground">@{application.username}</p>
                  <p className="mt-1 text-xs capitalize text-muted-foreground">
                    {application.email_verified_at ? "Email verified" : "Email not verified"} · {application.status.replaceAll("_", " ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ApplicationButton action="approve" id={application.id} pending={pending} onSubmit={submit} />
                  <ApplicationButton action="reject" id={application.id} pending={pending} onSubmit={submit} />
                </div>
              </CardContent>
            </Card>
          ))}
          {applications.filter((application) => application.status === "pending_admin_approval").length === 0 && <EmptyState label="No verified applications are awaiting approval." />}
        </div>
      </section>
    </div>
  );
}

function SectionHeading({ title, description, count }: { title: string; description: string; count: number }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">{count} total</span>
    </div>
  );
}

function EditContributorDialog({ contributor, pending, onSubmit }: { contributor: Contributor; pending: boolean; onSubmit: (action: AdminAction, form: FormData) => void }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button disabled={pending} size="sm" type="button" variant="outline" />}>
        <Pencil />
        Edit account
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit contributor account</DialogTitle>
          <DialogDescription>Update the details the contributor uses to sign in and write devotionals.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-5" onSubmit={(event) => {
          event.preventDefault();
          onSubmit(updateContributorAction, new FormData(event.currentTarget));
        }}>
          <input name="id" type="hidden" value={contributor.id} />
          <FieldGroup>
            <Field><FieldLabel htmlFor={`contributor-name-${contributor.id}`}>Full name</FieldLabel><Input defaultValue={contributor.full_name} id={`contributor-name-${contributor.id}`} name="fullName" required /></Field>
            <Field><FieldLabel htmlFor={`contributor-username-${contributor.id}`}>Username</FieldLabel><Input defaultValue={contributor.username} id={`contributor-username-${contributor.id}`} name="username" required /></Field>
            <Field><FieldLabel htmlFor={`contributor-email-${contributor.id}`}>Email</FieldLabel><Input defaultValue={contributor.email} id={`contributor-email-${contributor.id}`} name="email" required type="email" /></Field>
            <Field>
              <FieldLabel htmlFor={`contributor-status-${contributor.id}`}>Account status</FieldLabel>
              <select
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                defaultValue={contributor.status === "suspended" ? "suspended" : "approved"}
                id={`contributor-status-${contributor.id}`}
                name="status"
              >
                <option value="approved">Approved / active</option>
                <option value="suspended">Suspended</option>
              </select>
            </Field>
          </FieldGroup>
          <DialogFooter><Button disabled={pending} type="submit">{pending ? "Saving…" : "Save changes"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

async function confirmAndSubmit(text: string, id: string, handler: AdminAction, onSubmit: (action: AdminAction, form: FormData) => void) {
  const confirmation = await Swal.fire({
    icon: "question",
    title: "Confirm action",
    text,
    showCancelButton: true,
    confirmButtonText: "Continue",
    cancelButtonText: "Cancel",
    reverseButtons: true,
  });
  if (!confirmation.isConfirmed) return;
  const form = new FormData();
  form.set("id", id);
  onSubmit(handler, form);
}

function ApplicationButton({ action, id, pending, onSubmit }: { action: "approve" | "reject" | "suspend" | "reactivate" | "delete_unverified"; id: string; pending: boolean; onSubmit: (action: AdminAction, form: FormData) => void }) {
  return (
    <Button
      disabled={pending}
      onClick={() => void confirmAndSubmit(
        action === "delete_unverified" ? "Delete this unverified applicant and their account permanently?" : `${action[0].toUpperCase()}${action.slice(1)} this contributor application?`,
        id,
        reviewContributorApplicationAction,
        (handler, form) => {
          form.set("action", action);
          form.set("reason", "");
          onSubmit(handler, form);
        },
      )}
      size="sm"
      type="button"
      variant={action === "approve" || action === "reactivate" ? "default" : action === "delete_unverified" ? "destructive" : "outline"}
    >
      {action === "delete_unverified" ? "Delete" : action}
    </Button>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <Users className="mx-auto size-8 text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
