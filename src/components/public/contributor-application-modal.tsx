"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContributorApplicationForm } from "@/components/public/contributor-application-form";

export function ContributorApplicationModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        className="border-white/20 bg-white text-brand shadow-lg shadow-black/10 hover:bg-white/90"
        onClick={() => setOpen(true)}
        type="button"
        variant="secondary"
      >
        Become a Contributor
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Become a devotional contributor</DialogTitle>
            <DialogDescription>
              Apply to share reviewed devotionals with the GCBC community.
              Verify your email before administrator review.
            </DialogDescription>
          </DialogHeader>
          <ContributorApplicationForm />
        </DialogContent>
      </Dialog>
    </>
  );
}
