"use client";

import { useActionState } from "react";
import type React from "react";
import { submitContributorApplication, type ContributorApplicationState } from "@/app/(public)/devotionals/apply/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ContributorApplicationState = { status: "idle" };

export function ContributorApplicationForm() {
  const [state, formAction, pending] = useActionState(
    submitContributorApplication,
    initialState,
  );

  return (
    <form action={formAction} className="mt-10 space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      {state.status !== "idle" && (
        <div
          aria-live="polite"
          className={
            state.status === "success"
              ? "rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-200"
              : "rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          }
        >
          {state.message}
        </div>
      )}
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="fullName" label="Full name" autoComplete="name" />
        <Field
          id="username"
          label="Preferred username"
          autoComplete="username"
          description="3–32 letters, numbers, periods, underscores, or hyphens."
        />
        <Field id="email" label="Email address" type="email" autoComplete="email" />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          description="Use at least 10 characters."
        />
        <Field
          id="confirmPassword"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
        />
      </div>
      <label className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
        <input className="mt-1 size-4 accent-brand" name="guidelines" type="checkbox" />
        <span>
          I agree to follow the contributor guidelines and understand that every
          devotional is subject to administrator review.
        </span>
      </label>
      <Button disabled={pending} size="lg" type="submit">
        {pending ? "Submitting application…" : "Submit application"}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  description,
  ...props
}: React.ComponentProps<typeof Input> & {
  id: string;
  label: string;
  description?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} required {...props} />
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}
