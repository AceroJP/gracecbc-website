"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { RegistrationField } from "@/lib/registration";
import type { Json } from "@/types/database.types";
import {
  deleteRegistrationAction,
  updateRegistrationAction,
  type RegistrationManagementState,
} from "./actions";

const initialState: RegistrationManagementState = { status: "idle" };

function answerString(value: Json | undefined) {
  return typeof value === "string" ? value : "";
}

export function RegistrationActions({
  eventId,
  registrationId,
  fields,
  answers,
}: {
  eventId: string;
  registrationId: string;
  fields: RegistrationField[];
  answers: Record<string, Json | undefined>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const formId = useId();

  async function handleUpdate(formData: FormData) {
    setSaving(true);
    try {
      const result = await updateRegistrationAction(
        eventId,
        registrationId,
        initialState,
        formData,
      );
      if (result.status === "error") {
        await Swal.fire({
          icon: "error",
          title: "Unable to update registration",
          text: result.message,
          confirmButtonText: "Okay",
        });
        return;
      }

      setOpen(false);
      router.refresh();
      await Swal.fire({
        icon: "success",
        title: "Registration updated",
        text: result.message,
        confirmButtonText: "Okay",
      });
    } catch (error) {
      console.error("Registration update request failed.", error);
      void Swal.fire({
        icon: "error",
        title: "Unable to update registration",
        text: "We couldn’t update this registration right now. Please try again.",
        confirmButtonText: "Okay",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const confirmation = await Swal.fire({
      icon: "warning",
      title: "Delete this registration?",
      text: "This permanently removes the participant’s registration.",
      showCancelButton: true,
      confirmButtonText: "Delete registration",
      cancelButtonText: "Keep registration",
      confirmButtonColor: "#b42318",
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    setDeleting(true);
    try {
      const result = await deleteRegistrationAction(eventId, registrationId);
      if (result.status === "error") {
        await Swal.fire({
          icon: "error",
          title: "Unable to delete registration",
          text: result.message,
          confirmButtonText: "Okay",
        });
        return;
      }

      router.refresh();
      await Swal.fire({
        icon: "success",
        title: "Registration deleted",
        text: result.message,
        confirmButtonText: "Okay",
      });
    } catch (error) {
      console.error("Registration deletion request failed.", error);
      await Swal.fire({
        icon: "error",
        title: "Unable to delete registration",
        text: "We couldn’t delete this registration right now. Please try again.",
        confirmButtonText: "Okay",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogTrigger render={<Button size="sm" variant="outline" />}>
          <Pencil aria-hidden="true" data-icon="inline-start" />
          Edit
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit participant registration</DialogTitle>
            <DialogDescription>
              Update the participant’s submitted answers.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              void handleUpdate(new FormData(event.currentTarget));
            }}
          >
            <FieldGroup>
              {fields.map((field) => {
                const fieldId = `${formId}-${field.id}`;
                const value = answers[field.id];

                if (field.type === "checkbox") {
                  return (
                    <Field
                      className="flex-row items-start gap-3"
                      key={field.id}
                    >
                      <input
                        className="mt-1 size-4 accent-primary"
                        defaultChecked={value === true}
                        id={fieldId}
                        name={field.id}
                        required={field.required}
                        type="checkbox"
                        value="true"
                      />
                      <FieldLabel htmlFor={fieldId}>
                        {field.label}
                        {field.required && (
                          <span aria-hidden="true" className="text-destructive">
                            {" "}*
                          </span>
                        )}
                      </FieldLabel>
                    </Field>
                  );
                }

                return (
                  <Field key={field.id}>
                    <FieldLabel htmlFor={fieldId}>
                      {field.label}
                      {field.required && (
                        <span aria-hidden="true" className="text-destructive">
                          {" "}*
                        </span>
                      )}
                    </FieldLabel>
                    {field.type === "long_text" ? (
                      <Textarea
                        defaultValue={answerString(value)}
                        id={fieldId}
                        maxLength={2000}
                        name={field.id}
                        required={field.required}
                        rows={4}
                      />
                    ) : field.type === "select" ? (
                      <select
                        className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
                        defaultValue={answerString(value)}
                        id={fieldId}
                        name={field.id}
                        required={field.required}
                      >
                        <option disabled value="">
                          Select an option
                        </option>
                        {field.options?.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        autoComplete={
                          field.type === "email"
                            ? "email"
                            : field.type === "phone"
                              ? "tel"
                              : "off"
                        }
                        defaultValue={answerString(value)}
                        id={fieldId}
                        maxLength={field.type === "phone" ? 32 : 254}
                        name={field.id}
                        required={field.required}
                        type={field.type === "email" ? "email" : "text"}
                      />
                    )}
                  </Field>
                );
              })}
            </FieldGroup>
            <DialogFooter className="-mx-0 -mb-0 rounded-2xl border-t-0 bg-transparent p-0">
              <Button
                onClick={() => setOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={saving} type="submit">
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Button
        disabled={deleting}
        onClick={handleDelete}
        size="sm"
        variant="destructive"
      >
        <Trash2 aria-hidden="true" data-icon="inline-start" />
        {deleting ? "Deleting…" : "Delete"}
      </Button>
    </div>
  );
}
