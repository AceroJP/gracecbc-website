"use client";

import Script from "next/script";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  submitRegistrationAction,
  type RegistrationSubmissionState,
} from "@/app/(public)/registration-actions";
import type { RegistrationField } from "@/lib/registration";

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
      {widgetFailed && (
        <p className="text-sm text-destructive" role="alert">
          The security check could not load. Please refresh the page and try
          again.
        </p>
      )}
    </>
  );
}

export function RegistrationForm({
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
  const formId = useId();
  const previousState = useRef(state);

  useEffect(() => {
    if (
      state.status === "error" &&
      previousState.current !== state
    ) {
      setToken("");
      setResetKey((current) => current + 1);
    }
    previousState.current = state;
  }, [state]);

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
      <p className="mt-5 rounded-xl border border-border bg-muted px-4 py-4 text-sm text-muted-foreground">
        Online registration is temporarily unavailable. Please contact the
        church for assistance.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-5 flex flex-col gap-5">
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

          if (field.type === "checkbox") {
            return (
              <Field
                className="flex-row items-start gap-3"
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
                  id={fieldId}
                  maxLength={2000}
                  name={field.id}
                  required={field.required}
                  rows={4}
                />
              ) : field.type === "select" ? (
                <select
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
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
              ) : (
                <Input
                  autoComplete={
                    field.type === "email"
                      ? "email"
                      : field.type === "phone"
                        ? "tel"
                        : "off"
                  }
                  id={fieldId}
                  maxLength={field.type === "phone" ? 32 : 200}
                  name={field.id}
                  required={field.required}
                  type={field.type === "email" ? "email" : "text"}
                />
              )}
              {field.type === "email" && (
                <FieldDescription>
                  Enter an email address where the church can reach you.
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

      {state.status === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}

      <Button className="w-fit" disabled={!token || pending} type="submit">
        {pending ? "Submitting registration…" : "Submit registration"}
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        Your details are shared with the event organizers and are not shown
        publicly.
      </p>
    </form>
  );
}
