"use client";

import { useSearchParams } from "next/navigation";
import { AuthStatusAlert } from "@/components/auth/auth-status-alert";

export function PublicStatusAlert() {
  const searchParams = useSearchParams();

  if (searchParams.get("notice") !== "signed-out") {
    return null;
  }

  return (
    <AuthStatusAlert
      message="You have been signed out of the admin workspace."
      title="Come back soon"
    />
  );
}
