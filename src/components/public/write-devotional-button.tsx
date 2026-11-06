"use client";

import { useActionState, useState } from "react";
import { verifyContributorCredentials, type ContributorCredentialState } from "@/app/(public)/devotionals/credential-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ContributorCredentialState = { status: "idle" };

export function WriteDevotionalButton() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    verifyContributorCredentials,
    initialState,
  );

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button">
        Write a Devotional
      </Button>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Write a devotional</DialogTitle>
            <DialogDescription>
              Enter your approved contributor credentials to continue. Your
              access is temporary and will not create a persistent login.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} className="space-y-5">
            {state.status !== "idle" && (
              <p
                aria-live="polite"
                className={
                  state.status === "success"
                    ? "rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200"
                    : "rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                }
              >
                {state.message}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="contributor-username">Username</Label>
              <Input
                autoComplete="username"
                id="contributor-username"
                name="username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contributor-password">Password</Label>
              <Input
                autoComplete="current-password"
                id="contributor-password"
                name="password"
                required
                type="password"
              />
            </div>
            <DialogFooter>
              <Button onClick={() => setOpen(false)} type="button" variant="outline">
                Cancel
              </Button>
              <Button disabled={pending} type="submit">
                {pending ? "Verifying…" : "Continue"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
