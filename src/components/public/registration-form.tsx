"use client";

import Script from "next/script";
import {
  type FormEvent,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import Swal from "sweetalert2";
import { beginRegistrationUploadsAction } from "@/app/(public)/registration-upload-actions";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SweetAlertError } from "@/components/ui/sweet-alert-error";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  submitRegistrationAction,
  type RegistrationSubmissionState,
} from "@/app/(public)/registration-actions";
import {
  getRegistrationUploadExtension,
  isRegistrationAnswerValid,
  isRegistrationUploadContentType,
  philippinesPhoneNumberLength,
  registrationUploadAccept,
  registrationUploadMaxBytes,
  type RegistrationField,
} from "@/lib/registration";
import { createClient } from "@/lib/supabase/client";
import { showLoadingAlert } from "@/lib/sweet-alert";
import { cn } from "cn";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          action: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
          theme: "auto";
        },
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

const initialState: RegistrationSubmissionState = { status: "idle" };

function TurnstileChallenge({
  siteKey,
  onToken,
  resetKey,
}: {
  siteKey: string;
  onToken: (token: string) => void;
  resetKey: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [widgetFailed, setWidgetFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const turnstile = window.turnstile;

    if (!scriptReady || !container || widgetIdRef.current) {
      return;
    }

    if (!turnstile) {
      return;
    }

    widgetIdRef.current = turnstile.render(container, {
      sitekey: siteKey,
      action: "event_registration",
      theme: "auto",
      callback: (token) => {
        setWidgetFailed(false);
        onToken(token);
      },
      "expired-callback": () => onToken(""),
      "error-callback": () => {
        onToken("");
        setWidgetFailed(true);
      },
    });

    return () => {
      if (widgetIdRef.current) {
        turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [onToken, scriptReady, siteKey]);

  useEffect(() => {
    if (resetKey > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetKey]);

  return (
    <>
      <SweetAlertError
        message={
          widgetFailed
            ? "The security check could not load. Please refresh the page and try again."
            : null
        }
        title="Security check unavailable"
      />
      <Script
        onError={() => setWidgetFailed(true)}
        onReady={() => {
          setWidgetFailed(false);
          setScriptReady(true);
        }}
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
      />
      <div aria-label="Security verification" ref={containerRef} />
    </>
  );
}

export function RegistrationForm({
  eventId,
  eventTitle,
  fields,
  siteKey,
  deadline,
  isClosed,
}: {
  eventId: string;
  eventTitle: string;
  fields: RegistrationField[];
  siteKey: string | null;
  deadline: string | null;
  isClosed: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        className="mt-5"
        render={<Button />}
      >
        Register for this event
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register for {eventTitle}</DialogTitle>
          <DialogDescription>
            Complete the form below to register for this event.
          </DialogDescription>
        </DialogHeader>
        {open &&
          (isClosed ? (
            <p className="rounded-xl border border-border bg-muted px-4 py-4 text-sm text-muted-foreground">
              Registration for this event has closed.
            </p>
          ) : (
            <RegistrationFormContent
              deadline={deadline}
              eventId={eventId}
              fields={fields}
              siteKey={siteKey}
            />
          ))}
      </DialogContent>
    </Dialog>
  );
}

function RegistrationFormContent({
  eventId,
  fields,
  siteKey,
  deadline,
}: {
  eventId: string;
  fields: RegistrationField[];
  siteKey: string | null;
  deadline: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    submitRegistrationAction.bind(null, eventId),
    initialState,
  );
  const [token, setToken] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<
    Record<
      string,
      { fileName: string; size: number; lastModified: number; ticket: string }
    >
  >({});
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [completedFields, setCompletedFields] = useState<Set<string>>(
    () => new Set(),
  );
  const formId = useId();
  const previousState = useRef(state);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function refreshCompletedFields(form: HTMLFormElement) {
    const formData = new FormData(form);
    const next = new Set<string>();

    for (const field of fields) {
      if (field.type === "file_upload") {
        if (uploadedFiles[field.id]) {
          next.add(field.id);
        }
        continue;
      }

      const values = formData.getAll(field.id);
      if (field.type === "checkbox") {
        if (values.length === 1 && values[0] === "true") {
          next.add(field.id);
        }
        continue;
      }

      if (field.type === "checkboxes" || field.type === "multiple_choice") {
        const selected = values.filter(
          (value): value is string => typeof value === "string",
        );
        if (
          selected.length > 0 &&
          selected.every((value) => field.options?.includes(value))
        ) {
          next.add(field.id);
        }
        continue;
      }

      const value = values[0];
      if (
        values.length === 1 &&
        typeof value === "string" &&
        value.trim() &&
        isRegistrationAnswerValid(field, value)
      ) {
        next.add(field.id);
      }
    }

    setCompletedFields(next);
  }

  useEffect(() => {
    if (pending) {
      showLoadingAlert(
        "Submitting registration",
        "Please wait while we save your event registration...",
      );
      return;
    }

    if (Swal.isLoading()) {
      Swal.close();
    }

    if (state.status === "error" && previousState.current !== state) {
      setToken("");
      setResetKey((current) => current + 1);
      void Swal.fire({
        icon: "error",
        title: "Registration failed",
        text: state.message,
        confirmButtonText: "Okay",
      });
    } else if (state.status === "success" && previousState.current !== state) {
      void Swal.fire({
        icon: "success",
        title: "Registration received",
        text: "Thank you. Your event registration has been recorded.",
        confirmButtonText: "Okay",
      });
    }
    previousState.current = state;
  }, [pending, state]);

  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    const pendingFiles = fields.flatMap((field) => {
      if (field.type !== "file_upload") {
        return [];
      }

      const input = fileInputRefs.current[field.id];
      const file = input?.files?.[0];
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

    if (pendingFiles.length === 0) {
      return;
    }

    event.preventDefault();
    if (!token) {
      await Swal.fire({
        icon: "error",
        title: "Complete the security check",
        text: "Complete the security check before uploading files.",
        confirmButtonText: "Okay",
      });
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
    showLoadingAlert(
      "Uploading registration files",
      `Preparing ${pendingFiles.length} ${pendingFiles.length === 1 ? "file" : "files"}...`,
    );
    try {
      const response = await beginRegistrationUploadsAction({
        eventId,
        challengeToken: token,
        uploads: pendingFiles.flatMap(({ fieldId, file }) =>
          isRegistrationUploadContentType(file.type)
            ? [
                {
                  fieldId,
                  name: file.name,
                  size: file.size,
                  lastModified: file.lastModified,
                  contentType: file.type,
                },
              ]
            : [],
        ),
      });

      if (response.status === "error") {
        await Swal.fire({
          icon: "error",
          title: "Unable to upload files",
          text: response.message,
          confirmButtonText: "Okay",
        });
        setToken("");
        setResetKey((current) => current + 1);
        return;
      }

      const supabase = createClient();
      for (const [index, upload] of response.uploads.entries()) {
        const selected = pendingFiles.find(
          ({ fieldId }) => fieldId === upload.fieldId,
        );
        if (!selected) {
          throw new Error("An uploaded file no longer matches the form.");
        }

        Swal.update({
          text: `Uploading file ${index + 1} of ${response.uploads.length}: ${selected.file.name}`,
        });
        const { error } = await supabase.storage
          .from("event-registration-files")
          .uploadToSignedUrl(upload.path, upload.token, selected.file, {
            cacheControl: "3600",
            contentType: upload.contentType,
          });
        if (error) {
          console.error("Unable to upload registration file to storage.", error);
          await Swal.fire({
            icon: "error",
            title: "Unable to upload files",
            text: "We couldn’t upload your files. Please choose them again and retry.",
            confirmButtonText: "Okay",
          });
          setToken("");
          setResetKey((current) => current + 1);
          return;
        }

        setUploadedFiles((current) => ({
          ...current,
          [upload.fieldId]: {
            fileName: selected.file.name,
            size: selected.file.size,
            lastModified: selected.file.lastModified,
            ticket: upload.ticket,
          },
        }));
        setCompletedFields((current) => new Set(current).add(upload.fieldId));
      }

      setToken("");
      setResetKey((current) => current + 1);
      await Swal.fire({
        icon: "success",
        title: "Files uploaded",
        text: "Your files are ready. Submit the registration form to finish.",
        confirmButtonText: "Okay",
      });
    } catch (error) {
      console.error("Registration file upload failed.", error);
      await Swal.fire({
        icon: "error",
        title: "Unable to upload files",
        text: "We couldn’t upload your files. Please try again.",
        confirmButtonText: "Okay",
      });
      setToken("");
      setResetKey((current) => current + 1);
    } finally {
      setUploadingFiles(false);
    }
  }

  if (state.status === "success") {
    return (
      <div
        className="mt-5 rounded-xl border border-border bg-muted px-4 py-4"
        role="status"
      >
        <p className="text-sm font-semibold">Registration received</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Thank you. Your event registration has been recorded.
        </p>
      </div>
    );
  }

  if (!siteKey) {
    return (
      <>
        <SweetAlertError
          message="Online registration is temporarily unavailable. Please contact the church for assistance."
          title="Registration unavailable"
        />
        <p className="rounded-xl border border-border bg-muted px-4 py-4 text-sm text-muted-foreground">
          Online registration is temporarily unavailable. Please contact the
          church for assistance.
        </p>
      </>
    );
  }

  return (
    <>
      <form
        action={formAction}
        className="flex flex-col gap-5"
        encType="multipart/form-data"
        onSubmit={handleFormSubmit}
        onChange={(event) => refreshCompletedFields(event.currentTarget)}
      >
      {deadline && (
        <p className="text-sm text-muted-foreground">
          Registration closes on{" "}
          {new Intl.DateTimeFormat("en", {
            dateStyle: "long",
            timeZone: "UTC",
          }).format(new Date(`${deadline}T00:00:00.000Z`))}
          .
        </p>
      )}
      <FieldGroup>
        {fields.map((field) => {
          const fieldId = `${formId}-${field.id}`;
          const isComplete = completedFields.has(field.id);

          if (field.type === "checkbox") {
            return (
              <Field
                className={cn(
                  "flex-row items-start gap-3 rounded-md border border-transparent p-3",
                  isComplete && "border-success",
                )}
                key={field.id}
              >
                <input
                  className="mt-1 size-4 accent-primary"
                  id={fieldId}
                  name={field.id}
                  required={field.required}
                  type="checkbox"
                  value="true"
                />
                <FieldLabel htmlFor={fieldId}>
                  {field.label}
                  {field.required && (
                    <span
                      aria-hidden="true"
                      className={isComplete ? "text-foreground" : "text-destructive"}
                    >
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
            const isCheckboxGroup = field.type === "checkboxes";
            return (
              <FieldSet
                className={cn(
                  "rounded-md border border-transparent p-3",
                  isComplete && "border-success",
                )}
                key={field.id}
              >
                <FieldLegend variant="label">
                  {field.label}
                  {field.required && (
                    <span
                      aria-hidden="true"
                      className={isComplete ? "text-foreground" : "text-destructive"}
                    >
                      {" "}*
                    </span>
                  )}
                </FieldLegend>
                {isCheckboxGroup && (
                  <FieldDescription>Select all that apply.</FieldDescription>
                )}
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
                          id={optionId}
                          name={field.id}
                          required={!isCheckboxGroup && field.required}
                          type={isCheckboxGroup ? "checkbox" : "radio"}
                          value={option}
                        />
                        <FieldLabel htmlFor={optionId}>{option}</FieldLabel>
                      </Field>
                    );
                  })}
                </FieldGroup>
              </FieldSet>
            );
          }

          return (
            <Field key={field.id}>
              <FieldLabel
                className={isComplete ? "text-foreground" : undefined}
                htmlFor={fieldId}
              >
                {field.label}
                {field.required && (
                  <span
                    aria-hidden="true"
                    className={isComplete ? "text-foreground" : "text-destructive"}
                  >
                    {" "}*
                  </span>
                )}
              </FieldLabel>
              {field.type === "long_text" ? (
                <Textarea
                  className={
                    isComplete
                      ? "border-success focus-visible:border-success"
                      : undefined
                  }
                  id={fieldId}
                  maxLength={2000}
                  name={field.id}
                  required={field.required}
                  rows={4}
                />
              ) : field.type === "select" ? (
                <select
                  className={cn(
                    "min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring",
                    isComplete && "border-success",
                  )}
                  defaultValue=""
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
                <>
                  <Input
                    accept={registrationUploadAccept}
                    className={isComplete ? "border-success" : undefined}
                    disabled={Boolean(uploadedFiles[field.id])}
                    id={fieldId}
                    name={field.id}
                    onChange={() => {
                      setCompletedFields((current) => {
                        const next = new Set(current);
                        next.delete(field.id);
                        return next;
                      });
                      setUploadedFiles((current) => {
                        const next = { ...current };
                        delete next[field.id];
                        return next;
                      });
                    }}
                    ref={(element) => {
                      fileInputRefs.current[field.id] = element;
                    }}
                    required={field.required && !uploadedFiles[field.id]}
                    type="file"
                  />
                  {uploadedFiles[field.id] && (
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="break-all">
                        Uploaded: {uploadedFiles[field.id].fileName}
                      </span>
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
                          setCompletedFields((current) => {
                            const next = new Set(current);
                            next.delete(field.id);
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
                  <input
                    name={`${field.id}__upload_ticket`}
                    type="hidden"
                    value={uploadedFiles[field.id]?.ticket ?? ""}
                  />
                  <FieldDescription>
                    PDF, JPG, or PNG; maximum{" "}
                    {registrationUploadMaxBytes / (1024 * 1024)} MB.
                  </FieldDescription>
                </>
              ) : (
                <Input
                  autoComplete={
                    field.type === "email"
                      ? "email"
                      : field.type === "phone"
                        ? "tel"
                        : "off"
                  }
                  className={
                    isComplete
                      ? "border-success focus-visible:border-success"
                      : undefined
                  }
                  id={fieldId}
                  inputMode={
                    field.type === "phone"
                      ? field.phoneDigitsOnly
                        ? "numeric"
                        : "tel"
                      : field.type === "number"
                        ? "numeric"
                        : undefined
                  }
                  maxLength={
                    field.type === "phone"
                      ? field.phoneDigitsOnly
                        ? philippinesPhoneNumberLength
                        : 32
                      : field.type === "number"
                        ? 20
                        : 200
                  }
                  name={field.id}
                  pattern={
                    field.type === "phone"
                      ? field.phoneDigitsOnly
                        ? `[0-9]{${philippinesPhoneNumberLength}}`
                        : "(?=(?:\\D*\\d){5})[+]?[0-9\\s\\x28\\x29.\\-]{5,32}"
                      : field.type === "number"
                        ? "[0-9]{1,20}"
                        : undefined
                  }
                  required={field.required}
                  placeholder={
                    field.type === "phone" ? "e.g. 0912345678" : undefined
                  }
                  onBeforeInput={
                    field.type === "phone" && field.phoneDigitsOnly
                      ? (event) => {
                          const inputEvent =
                            event.nativeEvent as InputEvent;
                          if (
                            inputEvent.data &&
                            /\D/.test(inputEvent.data)
                          ) {
                            event.preventDefault();
                          }
                        }
                      : undefined
                  }
                  onPaste={
                    field.type === "phone" && field.phoneDigitsOnly
                      ? (event) => {
                          if (/\D/.test(event.clipboardData.getData("text"))) {
                            event.preventDefault();
                          }
                        }
                      : undefined
                  }
                  onChange={
                    field.type === "phone" && field.phoneDigitsOnly
                      ? (event) => {
                          event.currentTarget.value = event.currentTarget.value
                            .replace(/\D/g, "")
                            .slice(0, philippinesPhoneNumberLength);
                          refreshCompletedFields(
                            event.currentTarget.form as HTMLFormElement,
                          );
                        }
                      : undefined
                  }
                  type={
                    field.type === "email"
                      ? "email"
                      : field.type === "phone"
                        ? "tel"
                      : field.type === "date" || field.type === "time"
                        ? field.type
                        : "text"
                  }
                />
              )}
              {field.type === "email" && (
                <FieldDescription>
                  Enter an email address where the church can reach you.
                </FieldDescription>
              )}
              {field.type === "phone" && (
                <FieldDescription>
                  {field.phoneDigitsOnly
                    ? `Enter exactly ${philippinesPhoneNumberLength} digits, for example 0912345678.`
                    : "Enter a phone number with at least five digits, for example 0912345678. Spaces, parentheses, hyphens, and a leading plus sign are allowed."}
                </FieldDescription>
              )}
              {field.type === "number" && (
                <FieldDescription>
                  Enter digits only; decimals and other characters are not
                  accepted.
                </FieldDescription>
              )}
            </Field>
          );
        })}
      </FieldGroup>

      <input name="cf-turnstile-response" type="hidden" value={token} />
      <TurnstileChallenge
        onToken={setToken}
        resetKey={resetKey}
        siteKey={siteKey}
      />

      <Button
        className="w-fit"
        disabled={
          pending ||
          uploadingFiles ||
          (!token && Object.keys(uploadedFiles).length === 0)
        }
        type="submit"
      >
        {uploadingFiles
          ? "Uploading files…"
          : pending
            ? "Submitting registration…"
            : "Submit registration"}
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        Your details are shared with the event organizers and are not shown
        publicly.
      </p>
      </form>
    </>
  );
}
