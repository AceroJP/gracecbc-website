"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Swal from "sweetalert2";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordSession({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const expiresAt = Number(params.get("reset_expires"));
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const type = hash.get("type");
    const tokenExpiresAt = Number(hash.get("expires_at"));

    if (
      !expiresAt ||
      expiresAt <= Math.floor(Date.now() / 1000) ||
      !accessToken ||
      !refreshToken ||
      type !== "recovery" ||
      !tokenExpiresAt ||
      tokenExpiresAt <= Math.floor(Date.now() / 1000)
    ) {
      void Promise.resolve().then(() => setExpired(true));
      return;
    }

    void (async () => {
      const { error } = await createClient().auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        console.error("Unable to start password reset session.", error);
        await Swal.fire({
          icon: "error",
          title: "Reset link is no longer available",
          text: "Ask the church administrator to send you a new reset email.",
          confirmButtonText: "Okay",
        });
        setExpired(true);
        return;
      }

      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${window.location.search}`,
      );
      setReady(true);
    })();
  }, []);

  if (expired) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-xl bg-destructive/10 p-4 text-sm leading-6 text-destructive">
          This reset link has expired. Ask the church administrator to send you a new one.
        </p>
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          href="/devotionals"
        >
          Return to devotionals
        </Link>
      </div>
    );
  }

  return ready ? children : null;
}
