"use client";

import { useActionState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { signInAction, type SignInState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: SignInState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    signInAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="email">
          Email address
        </label>
        <Input
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          id="email"
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="password">
          Password
        </label>
        <Input
          autoComplete="current-password"
          id="password"
          name="password"
          placeholder="Enter your password"
          required
          type="password"
        />
      </div>

      {state.error && (
        <p
          aria-live="polite"
          className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}

      <Button className="w-full" disabled={pending} size="lg" type="submit">
        {pending ? (
          <>
            <LoaderCircle aria-hidden="true" className="animate-spin" />
            Signing in
          </>
        ) : (
          <>
            Sign in
            <ArrowRight aria-hidden="true" />
          </>
        )}
      </Button>
    </form>
  );
}
