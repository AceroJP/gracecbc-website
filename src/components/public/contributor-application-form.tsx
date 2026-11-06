"use client";

import { useActionState, useEffect, useState } from "react";
import type React from "react";
import Swal from "sweetalert2";
import { submitContributorApplication, type ContributorApplicationState } from "@/app/(public)/devotionals/apply/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ContributorApplicationState = { status: "idle" };

export function ContributorApplicationForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [state, formAction, pending] = useActionState(
    submitContributorApplication,
    initialState,
  );

  useEffect(() => {
    if (pending) {
      void Swal.fire({
        title: "Submitting application",
        text: "Please wait...",
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });
      return;
    }
    if (state.status === "idle") return;
    Swal.close();
    void Swal.fire({
      icon: state.status === "success" ? "success" : "error",
      title: state.status === "success" ? "Application submitted" : "Application failed",
      text: state.message,
      confirmButtonText: "Okay",
    });
  }, [pending, state.message, state.status]);

  return (
    <form
      action={formAction}
      className="mt-10 space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
      onSubmit={(event) => {
        if (password !== confirmPassword) {
          event.preventDefault();
          void Swal.fire({
            icon: "warning",
            title: "Passwords do not match",
            text: "Please make both password fields identical before submitting.",
            confirmButtonText: "Okay",
          });
        }
      }}
    >
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
        <PasswordField
          password={password}
          onChange={setPassword}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            autoComplete="new-password"
            id="confirmPassword"
            name="confirmPassword"
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
          {confirmPassword && (
            <p
              className={
                password === confirmPassword
                  ? "text-xs text-emerald-700 dark:text-emerald-300"
                  : "text-xs text-destructive"
              }
            >
              {password === confirmPassword
                ? "Passwords match."
                : "Passwords do not match."}
            </p>
          )}
        </div>
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

function PasswordField({
  password,
  onChange,
}: {
  password: string;
  onChange: (value: string) => void;
}) {
  const strength = getPasswordStrength(password);
  const strengthLabels = ["Weak", "Fair", "Good", "Strong"];

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="password">Password</Label>
      <Input
        autoComplete="new-password"
        id="password"
        minLength={10}
        name="password"
        onChange={(event) => onChange(event.target.value)}
        required
        type="password"
        value={password}
      />
      <div aria-label={`Password strength: ${strengthLabels[strength - 1] ?? "Weak"}`} className="flex gap-1">
        {[1, 2, 3, 4].map((level) => (
          <span
            className={`h-1.5 flex-1 rounded-full ${
              level <= strength ? getStrengthColor(strength) : "bg-muted"
            }`}
            key={level}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {password
          ? `${strengthLabels[strength - 1] ?? "Weak"} password`
          : "Use 10+ characters with uppercase, lowercase, a number, and a symbol."}
      </p>
    </div>
  );
}

function getPasswordStrength(password: string) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 10) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d|[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

function getStrengthColor(strength: number) {
  if (strength <= 1) return "bg-destructive";
  if (strength === 2) return "bg-amber-500";
  if (strength === 3) return "bg-blue-500";
  return "bg-emerald-500";
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
