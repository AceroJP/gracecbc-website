"use client";

import { useEffect } from "react";
import Swal from "sweetalert2";

export function AuthStatusAlert({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  useEffect(() => {
    if (Swal.isLoading()) {
      Swal.close();
    }

    void Swal.fire({
      icon: "success",
      title,
      text: message,
      showConfirmButton: false,
      timer: 1000,
      timerProgressBar: true,
    }).then(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete("notice");
      window.history.replaceState({}, "", url);
    });
  }, [message, title]);

  return null;
}
