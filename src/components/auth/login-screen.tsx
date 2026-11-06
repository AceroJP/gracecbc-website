import { Church, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/auth/login/login-form";
import { AuthStatusAlert } from "@/components/auth/auth-status-alert";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { SweetAlertError } from "@/components/ui/sweet-alert-error";
import { getCurrentUser } from "@/lib/auth/server";

type LoginScreenProps = {
  searchParams: Promise<{ error?: string; notice?: string }>;
  modal?: boolean;
};

export async function LoginScreen({
  searchParams,
  modal = false,
}: LoginScreenProps) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);

  if (user?.app_metadata?.role === "admin") {
    redirect("/admin/dashboard");
  }

  const signOutFailed = params.error === "sign-out";
  const unauthorizedMessage =
    params.error === "unauthorized"
      ? "This account does not have administrator access. Sign in with an authorized account."
      : signOutFailed
        ? "We couldn’t sign you out. Please try again."
        : null;

  const panel = (
    <section className="relative w-full max-w-[430px] rounded-3xl border border-border bg-card p-6 shadow-floating sm:p-9">
      <div className="flex flex-col items-center text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-sm">
          <Church aria-hidden="true" className="size-7" />
        </span>
        <p className="mt-5 text-xs font-semibold tracking-[0.18em] text-brand uppercase">
          Grace Christian Baptist Church
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Login 
        </h1>
        <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
          Sign in with the account authorized to manage the church website.
        </p>
      </div>

      {user ? (
        <div className="mt-8 space-y-5">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="size-5 shrink-0" />
            This account is signed in but is not an administrator.
          </p>
          <p className="break-all text-center text-sm text-muted-foreground">
            Signed in as {user.email}
          </p>
          <SignOutButton fullWidth className="w-full" />
        </div>
      ) : (
        <div className="mt-8">
          <LoginForm />
        </div>
      )}

      <p className="mt-7 text-center text-xs leading-5 text-muted-foreground">
        Access is restricted to accounts with administrator permission.
      </p>
    </section>
  );

  return (
    <>
      <SweetAlertError
        message={unauthorizedMessage}
        title={
          signOutFailed
            ? "Unable to sign out"
            : "Administrator access required"
        }
      />
      {params.notice === "signed-out" && (
        <AuthStatusAlert
          message="You have been signed out of the admin workspace."
          title="Signed out"
        />
      )}
      {modal ? (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-brand/5 blur-3xl"
          />
          {panel}
        </>
      ) : (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-warm px-4 py-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-brand/5 blur-3xl"
          />
          {panel}
        </main>
      )}
    </>
  );
}
