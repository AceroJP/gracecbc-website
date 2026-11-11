import type { ReactNode } from "react";
import { Suspense } from "react";
import { PublicStatusAlert } from "@/components/public/public-status-alert";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { getPublishedLandingPage } from "@/lib/landing-page-server";

export default async function PublicLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const landingPage = await getPublishedLandingPage();

  return (
    <>
      <PublicHeader />
      <Suspense fallback={null}>
        <PublicStatusAlert />
      </Suspense>
      {children}
      <PublicFooter
        contact={landingPage.visibility.contact ? landingPage.contact : null}
      />
    </>
  );
}
