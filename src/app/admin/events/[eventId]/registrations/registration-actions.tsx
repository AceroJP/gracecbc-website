"use client";

import { type FormEvent, useId, useRef, useState } from "react";
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
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  registrationUploadAccept,
  registrationUploadMaxBytes,
  type RegistrationField,
} from "@/lib/registration";
import type { Json } from "@/types/database.types";
import {
  beginAdminRegistrationUploadAction,
  deleteRegistrationAction,
  updateRegistrationAction,
  type RegistrationManagementState,
} from "./actions";
import {
  getRegistrationUploadExtension,
  isRegistrationUploadContentType,
} from "@/lib/registration";
import { createClient } from "@/lib/supabase/client";

const initialState: RegistrationManagementState = { status: "idle" };

function answerString(value: Json | undefined) {
  return typeof value === "string" ? value : "";
}

function answerStrings(value: Json | undefined) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function RegistrationActions({
  eventId,
  registrationId,
  fields,
  answers,
  fileUrls,
}: {
  eventId: string;
  registrationId: string;
  fields: RegistrationField[];
  answers: Record<string, Json | undefined>;
  fileUrls: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<
    Record<
      string,
      { fileName: string; size: number; lastModified: number; ticket: string }
    >
  >({});
  const formId = useId();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    const pendingFiles = fields.flatMap((field) => {
      if (field.type !== "file_upload") {
        return [];
      }

      const file = fileInputRefs.current[field.id]?.files?.[0];
      const uploaded = uploadedFiles[field.id];
      if (
        !file ||
        (uploaded?.fileName === file.name &&
          uploaded.size === file.size &&
          uploaded.lastModified === file.lastModified)
      ) {
        return [];
      }

      return [{ fieldId: field.id, file }];
    });

    event.preventDefault();
    if (pendingFiles.length === 0) {
      void handleUpdate(new FormData(event.currentTarget));
      return;
    }

    if (
      pendingFiles.some(
        ({ file }) =>
          !isRegistrationUploadContentType(file.type) ||
          !getRegistrationUploadExtension(file),
      )
    ) {
      await Swal.fire({
        icon: "error",
        title: "Unsupported file",
        text: "Files must be PDF, JPG, or PNG and no larger than 5 MB.",
        confirmButtonText: "Okay",
      });
      return;
    }

    setUploadingFiles(true);
    try {
      const supabase = createClient();
      for (const { fieldId, file } of pendingFiles) {
        if (!isRegistrationUploadContentType(file.type)) {
          await Swal.fire({
            icon: "error",
            title: "Unsupported file",
            text: "Files must be PDF, JPG, or PNG and no larger than 5 MB.",
            confirmButtonText: "Okay",
          });
          return;
        }

        const response = await beginAdminRegistrationUploadAction(
          eventId,
          registrationId,
          fieldId,
          {
            name: file.name,
            size: file.size,
            lastModified: file.lastModified,
            contentType: file.type,
          },
        );
        if (response.status === "error") {
          await Swal.fire({
            icon: "error",
            title: "Unable to upload file",
            text: response.message,
            confirmButtonText: "Okay",
          });
          return;
        }

        const { error } = await supabase.storage
          .from("event-registration-files")
          .uploadToSignedUrl(
            response.upload.path,
            response.upload.token,
            file,
            {
              cacheControl: "3600",
              contentType: response.upload.contentType,
            },
          );
        if (error) {
          console.error("Unable to upload replacement registration file.", error);
          await Swal.fire({
            icon: "error",
            title: "Unable to upload file",
            text: "We couldn’t upload this file. Please choose it again and retry.",
            confirmButtonText: "Okay",
          });
          return;
        }

        setUploadedFiles((current) => ({
          ...current,
          [fieldId]: {
            fileName: file.name,
            size: file.size,
            lastModified: file.lastModified,
            ticket: response.upload.ticket,
          },
        }));
      }

      await Swal.fire({
        icon: "success",
        title: "File uploaded",
        text: "The file is ready. Save changes to update the registration.",
        confirmButtonText: "Okay",
      });
    } catch (error) {
      console.error("Registration file upload failed.", error);
      await Swal.fire({
        icon: "error",
        title: "Unable to upload file",
        text: "We couldn’t upload this file right now. Please try again.",
        confirmButtonText: "Okay",
      });
    } finally {
      setUploadingFiles(false);
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
            encType="multipart/form-data"
            onSubmit={(event) => void handleFormSubmit(event)}
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

                if (
                  field.type === "checkboxes" ||
                  field.type === "multiple_choice"
                ) {
                  const selected = answerStrings(answers[field.id]);
                  const isCheckboxGroup = field.type === "checkboxes";

                  return (
                    <FieldSet key={field.id}>
                      <FieldLegend variant="label">
                        {field.label}
                        {field.required && (
                          <span aria-hidden="true" className="text-destructive">
                            {" "}*
                          </span>
                        )}
                      </FieldLegend>
                      <FieldGroup>
                        {field.options?.map((option, index) => {
                          const optionId = `${fieldId}-${index}`;
                          return (
                            <Field
                              className="flex-row items-start gap-3"
                              key={option}
                            >
                              <input
                                className="mt-1 size-4 accent-primary"
                                defaultChecked={selected.includes(option)}
                                id={optionId}
                                name={field.id}
                                required={!isCheckboxGroup && field.required}
                                type={isCheckboxGroup ? "checkbox" : "radio"}
                                value={option}
                              />
                              <FieldLabel htmlFor={optionId}>
                                {option}
                              </FieldLabel>
                            </Field>
                          );
                        })}
                      </FieldGroup>
                    </FieldSet>
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
                    ) : field.type === "file_upload" ? (
                      <div className="flex flex-col gap-3">
                        {fileUrls[field.id] && (
                          <a
                            className="w-fit text-sm font-medium text-primary underline underline-offset-4"
                            href={fileUrls[field.id]}
                            rel="noreferrer"
                            target="_blank"
                          >
                            View current attachment
                          </a>
                        )}
                        <Input
                          accept={registrationUploadAccept}
                          disabled={Boolean(uploadedFiles[field.id])}
                          id={fieldId}
                          name={`${field.id}__upload`}
                          onChange={() =>
                            setUploadedFiles((current) => {
                              const next = { ...current };
                              delete next[field.id];
                              return next;
                            })
                          }
                          ref={(element) => {
                            fileInputRefs.current[field.id] = element;
                          }}
                          type="file"
                        />
                        {uploadedFiles[field.id] && (
                          <div className="flex flex-wrap items-center gap-3 text-sm">
                            <span className="break-all">
                              Replacement uploaded: {uploadedFiles[field.id].fileName}
                            </span>
                            <input
                              name={`${field.id}__upload_ticket`}
                              type="hidden"
                              value={uploadedFiles[field.id].ticket}
                            />
                            <Button
                              onClick={() => {
                                const input = fileInputRefs.current[field.id];
                                if (input) {
                                  input.value = "";
                                  input.disabled = false;
                                }
                                setUploadedFiles((current) => {
                                  const next = { ...current };
                                  delete next[field.id];
                                  return next;
                                });
                              }}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              Choose another file
                            </Button>
                          </div>
                        )}
                        <p className="text-sm text-muted-foreground">
                          PDF, JPG, or PNG; maximum{" "}
                          {registrationUploadMaxBytes / (1024 * 1024)} MB.
                          Upload a new file to replace the current one.
                        </p>
                        {fileUrls[field.id] && !field.required && (
                          <Field className="flex-row items-start gap-3">
                            <input
                              className="mt-1 size-4 accent-primary"
                              id={`${fieldId}-remove`}
                              name={`${field.id}__remove`}
                              type="checkbox"
                              value="on"
                            />
                            <FieldLabel htmlFor={`${fieldId}-remove`}>
                              Remove current attachment
                            </FieldLabel>
                          </Field>
                        )}
                      </div>
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
                        type={
                          field.type === "email"
                            ? "email"
                            : field.type === "date" || field.type === "time"
                              ? field.type
                              : "text"
                        }
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
              <Button disabled={saving || uploadingFiles} type="submit">
                {uploadingFiles
                  ? "Uploading file…"
                  : saving
                    ? "Saving…"
                    : "Save changes"}
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
