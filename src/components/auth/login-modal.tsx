"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

export function LoginModal({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          router.back();
        }
      }}
    >
      <DialogContent
        className="fixed top-0 right-0 bottom-0 left-0 z-50 flex h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 items-center justify-center overflow-x-hidden overflow-y-auto rounded-none border-0 bg-warm p-4 shadow-none outline-none md:right-auto md:bottom-auto md:top-1/2 md:left-1/2 md:h-auto md:max-h-[calc(100dvh-3rem)] md:max-w-[430px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-none md:bg-transparent md:p-0"
        overlayClassName="bg-warm md:bg-foreground/30"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Login</DialogTitle>
        <Button
          aria-label="Close sign-in dialog"
          className="absolute top-3 right-3 hidden md:flex"
          onClick={() => router.back()}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" />
        </Button>
        {children}
      </DialogContent>
    </Dialog>
  );
}
