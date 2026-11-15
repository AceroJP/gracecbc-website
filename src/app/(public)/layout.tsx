import type { ReactNode } from "react";
import { Suspense } from "react";
import { PublicStatusAlert } from "@/components/public/public-status-alert";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { LandingPagePublishedRefresh } from "@/components/public/landing-page-published-refresh";
import { VisitorSessionTracker } from "@/components/public/visitor-session-tracker";
import { getLivestreamVideoUrls } from "@/lib/landing-page";
import { getPublishedLandingPage } from "@/lib/landing-page-server";
import { getPublicNavigation } from "@/lib/public-navigation";
import { getPublicNavigationAvailability } from "@/lib/public-navigation-server";
import { createClient } from "@/lib/supabase/server";

export default async function PublicLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [landingPage, availability] = await Promise.all([
    getPublishedLandingPage(),
    getPublicNavigationAvailability(),
  ]);

  const navigation = getPublicNavigation(landingPage, availability);

  const hasContact =
    landingPage.visibility.contact &&
    Boolean(
      landingPage.contact.address ||
        landingPage.contact.phone ||
        landingPage.contact.email ||
        landingPage.contact.facebookUrl ||
        landingPage.contact.mapUrl,
    );

  const hasLivestream =
    landingPage.visibility.livestream &&
    landingPage.livestream.itemsToShow > 0 &&
    landingPage.livestream.items.some((item) => getLivestreamVideoUrls(item.url));

  const footerLinks = [
    ...(navigation.aboutVisible ? [{ label: "About", href: "/about" }] : []),
    ...(
      landingPage.visibility.announcements && availability.announcements
        ? [{ label: "Announcements", href: "/#announcements" }]
        : []
    ),
    ...(landingPage.visibility.events && availability.events ? [{ label: "Events", href: "/#events" }] : []),
    ...(hasLivestream ? [{ label: "Livestream", href: "/#livestream" }] : []),
    ...(hasContact ? [{ label: "Contact", href: "/#contact" }] : []),
  ];

  const supabase = await createClient();
  const logoUrl = landingPage.header.logo.path
    ? supabase.storage
        .from("landing-page-images")
        .getPublicUrl(landingPage.header.logo.path).data.publicUrl
    : null;

  return (
    <>
      <LandingPagePublishedRefresh />
      <VisitorSessionTracker />
      <PublicHeader
        navigation={navigation}
        logoUrl={logoUrl}
        settings={landingPage.header}
      />
      <Suspense fallback={null}>
        <PublicStatusAlert />
      </Suspense>
      {children}
      <PublicFooter
        contact={landingPage.contact}
        footer={landingPage.footer}
        links={footerLinks}
      />
    </>
  );
}

