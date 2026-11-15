import type { LandingPageContent } from "@/lib/landing-page";

export type PublicNavigationAvailability = {
  announcements: boolean;
  events: boolean;
  schedules: boolean;
};

export type PublicNavigationItem = {
  id: string;
  label: string;
  href: string;
  children: PublicNavigationItem[];
};

export type PublicNavigation = {
  items: PublicNavigationItem[];
  planVisit: { label: string; href: string } | null;
  aboutVisible: boolean;
};

function hasAboutWhoWeAre(about: LandingPageContent["about"]) {
  return Boolean(about.whoWeAre.text || about.whoWeAre.photo.path);
}

function hasAboutBeliefs(about: LandingPageContent["about"]) {
  return Boolean(about.beliefs.text);
}

function hasAboutServiceTimes(
  about: LandingPageContent["about"],
  schedulesAvailable: boolean,
) {
  return Boolean(about.serviceTimes.intro || schedulesAvailable);
}

function hasAboutLeaders(about: LandingPageContent["about"]) {
  return about.leaders.some((leader) => Boolean(leader.name || leader.role || leader.photo.path));
}

function hasAboutCallToAction(about: LandingPageContent["about"]) {
  return Boolean(
    about.callToAction.heading ||
      about.callToAction.text ||
      about.callToAction.buttonLabel ||
      about.callToAction.buttonHref,
  );
}

function getAboutSectionVisibility(
  landingPage: LandingPageContent,
  availability: PublicNavigationAvailability,
) {
  const about = landingPage.about;
  const whoWeAre = hasAboutWhoWeAre(about);
  const beliefs = hasAboutBeliefs(about);
  const serviceTimes = hasAboutServiceTimes(about, availability.schedules);
  const leaders = hasAboutLeaders(about);
  const callToAction = hasAboutCallToAction(about);
  const aboutVisible = whoWeAre || beliefs || serviceTimes || leaders || callToAction;

  return { aboutVisible, whoWeAre, beliefs, serviceTimes, leaders, callToAction };
}

function normalizeInternalHref(href: string) {
  if (!href.startsWith("/")) return null;
  if (href.startsWith("//")) return null;
  const [path, hash] = href.split("#");
  return {
    path: path || "/",
    hash: hash ? `#${hash}` : "",
  };
}

function shouldHideHref(
  landingPage: LandingPageContent,
  availability: PublicNavigationAvailability,
  href: string,
): boolean {
  const internal = normalizeInternalHref(href);
  if (!internal) return false;

  const aboutVisibility = getAboutSectionVisibility(landingPage, availability);

  if (internal.path === "/about") {
    if (!aboutVisibility.aboutVisible) return true;
    if (!internal.hash) return false;
    if (internal.hash === "#beliefs") return !aboutVisibility.beliefs;
    if (internal.hash === "#service-times") return !aboutVisibility.serviceTimes;
    if (internal.hash === "#leaders") return !aboutVisibility.leaders;
    return false;
  }

  const isHome = internal.path === "/" || internal.path === "";
  if (isHome) {
    if (internal.hash === "#announcements") {
      return !(landingPage.visibility.announcements && availability.announcements);
    }
    if (internal.hash === "#events") {
      return !(landingPage.visibility.events && availability.events);
    }
    if (internal.hash === "#schedules") {
      return !(landingPage.visibility.schedule && availability.schedules);
    }
    if (internal.hash === "#livestream") {
      return !(
        landingPage.visibility.livestream &&
        landingPage.livestream.itemsToShow > 0 &&
        landingPage.livestream.items.length > 0
      );
    }
    if (internal.hash === "#contact") {
      const hasContact =
        landingPage.visibility.contact &&
        Boolean(
          landingPage.contact.address ||
            landingPage.contact.phone ||
            landingPage.contact.email ||
            landingPage.contact.facebookUrl ||
            landingPage.contact.mapUrl,
        );
      return !hasContact;
    }
  }

  return false;
}

function toPublicNavItem(
  landingPage: LandingPageContent,
  availability: PublicNavigationAvailability,
  item: LandingPageContent["header"]["navigation"]["items"][number],
): PublicNavigationItem | null {
  if (item.hidden) return null;
  if (shouldHideHref(landingPage, availability, item.href)) return null;

  const children = item.children
    .filter((child) => !child.hidden)
    .filter((child) => !shouldHideHref(landingPage, availability, child.href))
    .map((child) => ({ id: child.id, label: child.label, href: child.href, children: [] }));

  return { id: item.id, label: item.label, href: item.href, children };
}

export function getPublicNavigation(
  landingPage: LandingPageContent,
  availability: PublicNavigationAvailability,
): PublicNavigation {
  const aboutVisibility = getAboutSectionVisibility(landingPage, availability);

  const items = landingPage.header.navigation.items
    .map((item) => toPublicNavItem(landingPage, availability, item))
    .filter((item): item is PublicNavigationItem => Boolean(item));

  const planVisit =
    landingPage.header.navigation.planVisit.hidden ||
    shouldHideHref(landingPage, availability, landingPage.header.navigation.planVisit.href)
      ? null
      : {
          label: landingPage.header.navigation.planVisit.label,
          href: landingPage.header.navigation.planVisit.href,
        };

  return { items, planVisit, aboutVisible: aboutVisibility.aboutVisible };
}
