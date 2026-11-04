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
    void Swal.fire({
      icon: "success",
      title,
      text: message,
      confirmButtonText: "Continue",
    });
  }, [message, title]);

  return null;
}
