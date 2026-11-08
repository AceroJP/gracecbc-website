"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 10 || password.length > 128) {
      await Swal.fire({
        icon: "error",
        title: "Password is not valid",
        text: "Use a password between 10 and 128 characters.",
        confirmButtonText: "Okay",
      });
      return;
    }
    if (password !== confirmation) {
      await Swal.fire({
        icon: "error",
        title: "Passwords do not match",
        text: "Enter the same password in both fields.",
        confirmButtonText: "Okay",
      });
      return;
    }

    setPending(true);
    void Swal.fire({
      title: "Updating password",
      text: "Please wait...",
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });
    const { error } = await createClient().auth.updateUser({ password });
    setPending(false);
    Swal.close();

    if (error) {
      await Swal.fire({
        icon: "error",
        title: "Unable to update password",
        text: "This reset link may have expired. Ask the administrator to send another one.",
        confirmButtonText: "Okay",
      });
      return;
    }

    setPassword("");
    setConfirmation("");
    await Swal.fire({
      icon: "success",
      title: "Password updated",
      text: "Your password was updated. You can now write a devotional.",
      confirmButtonText: "Continue",
    });
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={submit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          minLength={10}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          minLength={10}
          name="confirmation"
          onChange={(event) => setConfirmation(event.target.value)}
          required
          type="password"
          value={confirmation}
        />
      </div>
      <Button disabled={pending} type="submit">
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
