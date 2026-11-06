"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import Swal from "sweetalert2";
import { signOutAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { showLoadingAlert } from "@/lib/sweet-alert";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";

type SignOutButtonProps = {
  ariaLabel?: string;
  className?: string;
  fullWidth?: boolean;
  showLabel?: boolean;
  size?: VariantProps<typeof buttonVariants>["size"];
  variant?: VariantProps<typeof buttonVariants>["variant"];
};

export function SignOutButton({
  ariaLabel = "Sign out",
  className,
  fullWidth = false,
  showLabel = true,
  size = "default",
  variant = "outline",
}: SignOutButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    const confirmation = await Swal.fire({
      icon: "warning",
      title: "Sign out?",
      text: "Are you sure you want to sign out of the admin workspace?",
      showCancelButton: true,
      confirmButtonText: "Sign out",
      cancelButtonText: "Stay signed in",
      reverseButtons: true,
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    setPending(true);
    showLoadingAlert(
      "Signing out",
      "Please wait while we sign you out of the admin workspace...",
    );
    try {
      const result = await signOutAction();
      if (result.error) {
        await Swal.fire({
          icon: "error",
          title: "Unable to sign out",
          text: result.error,
          confirmButtonText: "Okay",
        });
        return;
      }

      router.replace("/login?notice=signed-out");
      router.refresh();
    } catch (error) {
      console.error("Sign-out request failed.", error);
      await Swal.fire({
        icon: "error",
        title: "Unable to sign out",
        text: "We couldn’t complete the sign-out request. Please try again.",
        confirmButtonText: "Okay",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      aria-label={ariaLabel}
      className={className}
      disabled={pending}
      onClick={handleSignOut}
      size={size}
      title="Sign out"
      type="button"
      variant={variant}
    >
      <LogOut aria-hidden="true" data-icon="inline-start" />
      {showLabel &&
        (fullWidth ? "Sign out and use another account" : "Sign out")}
    </Button>
  );
}
