"use client";

import { useEffect } from "react";
import Swal from "sweetalert2";

export function SweetAlertError({
  message,
  title = "Something went wrong",
}: {
  message?: string | null;
  title?: string;
}) {
  useEffect(() => {
    if (message) {
      void Swal.fire({
        icon: "error",
        title,
        text: message,
        confirmButtonText: "Okay",
      });
    }
  }, [message, title]);

  return null;
}
