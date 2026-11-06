"use client";

import { useActionState } from "react";
import { useEffect } from "react";
import type React from "react";
import Swal from "sweetalert2";
import {
  submitDevotional,
  type DevotionalSubmissionState,
} from "@/app/(public)/devotionals/submission-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: DevotionalSubmissionState = { status: "idle" };

export function DevotionalSubmissionForm({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    submitDevotional,
    initialState,
  );

  useEffect(() => {
    if (pending) {
      void Swal.fire({
        title: "Submitting devotional",
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
      title: state.status === "success" ? "Devotional submitted" : "Submission failed",
      text: state.message,
      confirmButtonText: "Okay",
    });
  }, [pending, state.message, state.status]);

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-5 py-5">
        <p aria-live="polite" className="rounded-xl bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-800 dark:text-emerald-200">
          {state.message}
        </p>
        <Button onClick={onComplete} type="button">
          Done
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto pr-1">
      {state.status === "error" && (
        <p aria-live="polite" className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Field id="title" label="Devotional title">
        <Input id="title" name="title" required />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="biblePassage" label="Bible passage">
          <Input id="biblePassage" name="biblePassage" placeholder="2 Corinthians 5:7" required />
        </Field>
        <Field id="bibleTranslation" label="Bible translation">
          <Input id="bibleTranslation" name="bibleTranslation" placeholder="KJV, ESV, or other" required />
        </Field>
      </div>
      <Field id="keyVerse" label="Key verse">
        <Textarea id="keyVerse" name="keyVerse" required />
      </Field>
      <Field id="message" label="Devotional message">
        <Textarea className="min-h-36" id="message" name="message" required />
      </Field>
      <Field id="personalApplication" label="Personal application">
        <Textarea id="personalApplication" name="personalApplication" required />
      </Field>
      <Field id="closingPrayer" label="Closing prayer">
        <Textarea id="closingPrayer" name="closingPrayer" required />
      </Field>
      <div className="flex justify-end">
        <Button disabled={pending} type="submit">
          {pending ? "Submitting…" : "Submit for review"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
