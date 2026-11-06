"use client";

import { useEffect } from "react";
import Swal from "sweetalert2";

export function VerificationFragmentHandler() {
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get("access_token");
    const type = hash.get("type");
    if (!accessToken || type !== "signup") return;

    void (async () => {
      try {
        const response = await fetch("/auth/confirm-fragment", {
          body: JSON.stringify({ accessToken }),
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        await Swal.fire({
          icon: "success",
          title: "Email verified",
          text: "Your application is now waiting for administrator review.",
          confirmButtonText: "Okay",
        });
        const url = new URL(window.location.href);
        url.hash = "";
        url.searchParams.delete("error");
        window.history.replaceState({}, "", url);
      } catch (error) {
        console.error("Contributor email verification failed.", error);
        await Swal.fire({
          icon: "error",
          title: "Verification failed",
          text: error instanceof Error ? error.message : "That verification link is invalid or expired.",
          confirmButtonText: "Okay",
        });
      }
    })();
  }, []);

  return null;
}
