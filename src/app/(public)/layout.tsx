import type { ReactNode } from "react";
import { Suspense } from "react";
import { PublicStatusAlert } from "@/components/public/public-status-alert";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { LandingPagePublishedRefresh } from "@/components/public/landing-page-published-refresh";
import { VisitorSessionTracker } from "@/components/public/visitor-session-tracker";
import { getPublishedLandingPage } from "@/lib/landing-page-server";
import { createClient } from "@/lib/supabase/server";

export default async function PublicLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const landingPage = await getPublishedLandingPage();
  const supabase = await createClient();
  const logoUrl = landingPage.header.logo.path
      ? supabase.storage.from("landing-page-images").getPublicUrl(landingPage.header.logo.path).data.publicUrl
      : null;

  return (
    <>
      <LandingPagePublishedRefresh />
      <VisitorSessionTracker />
      <PublicHeader settings={landingPage.header} logoUrl={logoUrl} />
      <Suspense fallback={null}>
        <PublicStatusAlert />
      </Suspense>
      {children}
      <PublicFooter
        header={landingPage.header}
        contact={landingPage.contact}
      />
    </>
  );
}
