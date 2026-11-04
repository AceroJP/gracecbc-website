"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  email: z.email().trim(),
  password: z.string().min(1),
});

export type SignInState = {
  error?: string;
};

export async function signInAction(
  _previousState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email address and password." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      return {
        error: "Sign-in failed. Check your email and password, then try again.",
      };
    }
  } catch (error) {
    console.error("Sign-in request failed.", error);
    return {
      error: "We couldn’t complete sign-in. Please try again.",
    };
  }

  redirect("/admin/dashboard?notice=signed-in");
}

export async function signOutAction(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Unable to sign out.", error);
    return {
      error: "We couldn’t sign you out. Please try again.",
    };
  }

  return {};
}
