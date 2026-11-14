import { z } from "zod";

export const landingPageSectionKeys = [
  "hero",
  "welcome",
  "schedule",
  "livestream",
  "announcements",
  "events",
  "devotionals",
  "contact",
] as const;

export type LandingPageSectionKey = (typeof landingPageSectionKeys)[number];

export const landingPageTextAlignments = [
  "inherit",
  "left",
  "center",
  "right",
  "justify",
] as const;
export type LandingPageTextAlignment = (typeof landingPageTextAlignments)[number];

export const landingPageThemeFonts = [
  "inherit",
  "theme-sans",
  "theme-mono",
] as const;
export type LandingPageThemeFont = (typeof landingPageThemeFonts)[number];

export function getLandingPageFontFamily(font: LandingPageThemeFont) {
  if (font === "theme-sans") return "var(--font-sans)";
  if (font === "theme-mono") return "var(--font-mono)";
  return undefined;
}

export type LandingPageBackgroundStyleVariables = {
  "--landing-section-background-image": string;
  "--landing-section-background-opacity": number;
  "--landing-section-background-blur": string;
};

export type LandingPageTypographyStyleVariables = {
  "--text-xs": string;
  "--text-sm": string;
  "--text-base": string;
  "--text-lg": string;
  "--text-xl": string;
  "--text-2xl": string;
  "--text-3xl": string;
  "--text-4xl": string;
  "--text-5xl": string;
  "--text-6xl": string;
  "--text-7xl": string;
  "--text-8xl": string;
  "--text-9xl": string;
  "--landing-section-text-size-10px": string;
  "--landing-section-text-size-11px": string;
  "--landing-section-text-size-15px": string;
  "--landing-section-text-size-0-8rem": string;
};

export function getLandingPageTypographyStyleVariables(
  fontSizeScale: number,
): LandingPageTypographyStyleVariables {
  const scale = fontSizeScale / 100;
  const rem = (size: number) => `${Number((size * scale).toFixed(4))}rem`;
  const px = (size: number) => `${Number((size * scale).toFixed(4))}px`;

  return {
    "--text-xs": rem(0.75),
    "--text-sm": rem(0.875),
    "--text-base": rem(1),
    "--text-lg": rem(1.125),
    "--text-xl": rem(1.25),
    "--text-2xl": rem(1.5),
    "--text-3xl": rem(1.875),
    "--text-4xl": rem(2.25),
    "--text-5xl": rem(3),
    "--text-6xl": rem(3.75),
    "--text-7xl": rem(4.5),
    "--text-8xl": rem(6),
    "--text-9xl": rem(8),
    "--landing-section-text-size-10px": px(10),
    "--landing-section-text-size-11px": px(11),
    "--landing-section-text-size-15px": px(15),
    "--landing-section-text-size-0-8rem": rem(0.8),
  };
}

export const landingPageNavigationKeys = [
  "events",
  "schedules",
  "livestream",
  "devotionals",
  "contact",
] as const;

export type LandingPageNavigationKey = (typeof landingPageNavigationKeys)[number];

export const landingPageContactKeys = ["address", "phone", "email", "mapUrl", "facebookUrl"] as const;
export type LandingPageContactKey = (typeof landingPageContactKeys)[number];

const plainText = z.string().transform((value) =>
  value.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f\u007f]/g, " ").trim(),
);
const text = (max: number) => plainText.pipe(z.string().max(max));
const requiredText = (max: number) =>
  plainText.pipe(z.string().min(1).max(max));
const emptyOrWebUrl = z.union([
  z.literal(""),
  z.string().max(2048).url().refine((value) => /^https?:\/\//i.test(value)),
]);
const videoUrl = z.string().trim().min(1, "Enter a video link.").max(2048)
  .url("Enter a valid video link.")
  .refine((value) => /^https?:\/\//i.test(value), "Use an http or https link.");
const buttonUrl = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(
    (value) =>
      (value.startsWith("/") && !value.startsWith("//")) ||
      value.startsWith("#") ||
      /^https?:\/\//i.test(value),
    "Enter a site path or an http(s) URL.",
  );

const imageSchema = z.object({
  path: z.string().max(512).nullable(),
  alt: text(250),
}).superRefine(({ path, alt }, context) => {
  if (path && !alt) {
    context.addIssue({
      code: "custom",
      path: ["alt"],
      message: "Add alt text for this image.",
    });
  }
});

const defaultImage = { path: null, alt: "" };
const defaultContactAppearance = { textColor: "", image: defaultImage };
const contactAppearanceSchema = z.object({
  textColor: z.string().regex(/^$|^#[\da-f]{6}$/i, "Enter a 6-digit hex color.").default(""),
  image: imageSchema.default(defaultImage),
});
const defaultContactAppearances = {
  address: defaultContactAppearance,
  phone: defaultContactAppearance,
  email: defaultContactAppearance,
  mapUrl: defaultContactAppearance,
  facebookUrl: defaultContactAppearance,
};
const defaultBackground = {
  image: defaultImage,
  color: "",
  textColor: "",
  textAlign: "inherit" as const,
  fontFamily: "inherit" as const,
  fontSizeScale: 100,
  minHeight: 0,
  paddingY: null as number | null,
  imageOpacity: 100,
  imageBlur: 0,
};
const defaultHeroBackground = { ...defaultBackground, minHeight: 580 };
const backgroundSchema = z.object({
  image: imageSchema.default(defaultImage),
  color: z.string().regex(/^$|^#[\da-f]{6}$/i, "Enter a 6-digit hex color.").default(""),
  textColor: z.string().regex(/^$|^#[\da-f]{6}$/i, "Enter a 6-digit hex color.").default(""),
  textAlign: z.enum(landingPageTextAlignments).default("inherit"),
  fontFamily: z.enum(landingPageThemeFonts).default("inherit"),
  fontSizeScale: z.number().int().min(75).max(150).default(100),
  minHeight: z.number().int().min(0).max(10000).default(0),
  paddingY: z.number().int().min(0).max(256).nullable().default(null),
  imageOpacity: z.number().int().min(0).max(100).default(100),
  imageBlur: z.number().int().min(0).max(20).default(0),
});
const heroBackgroundSchema = z.object({
  image: imageSchema.default(defaultImage),
  color: z.string().regex(/^$|^#[\da-f]{6}$/i, "Enter a 6-digit hex color.").default(""),
  textColor: z.string().regex(/^$|^#[\da-f]{6}$/i, "Enter a 6-digit hex color.").default(""),
  textAlign: z.enum(landingPageTextAlignments).default("inherit"),
  fontFamily: z.enum(landingPageThemeFonts).default("inherit"),
  fontSizeScale: z.number().int().min(75).max(150).default(100),
  minHeight: z.number().int().min(0).max(10000).default(580),
  paddingY: z.number().int().min(0).max(256).nullable().default(null),
  imageOpacity: z.number().int().min(0).max(100).default(100),
  imageBlur: z.number().int().min(0).max(20).default(0),
});
const defaultSectionBackgrounds = {
  hero: defaultHeroBackground,
  welcome: defaultBackground,
  schedule: defaultBackground,
  livestream: defaultBackground,
  announcements: defaultBackground,
  events: defaultBackground,
  devotionals: defaultBackground,
  contact: defaultBackground,
};
const defaultHeader = {
  name: "Grace Christian",
  subtitle: "Baptist Church",
  logo: defaultImage,
  logoSize: 40,
  navigationOrder: [...landingPageNavigationKeys],
};
const defaultFooter = {
  title: "Grace Christian Baptist Church",
  text: "",
  textColor: "",
  backgroundColor: "",
  textAlign: "inherit" as const,
  fontFamily: "inherit" as const,
  fontSizeScale: 100,
  paddingY: 48,
};

const builderContentSchema = z.object({
  sectionOrder: z.array(z.enum(landingPageSectionKeys)).length(8).refine(
    (keys) => new Set(keys).size === landingPageSectionKeys.length,
    "Every section must appear once in the order.",
  ),
  header: z.object({
    name: text(80).default(defaultHeader.name),
    subtitle: text(80).default(defaultHeader.subtitle),
    logo: imageSchema.default(defaultHeader.logo),
    logoSize: z.number().int().min(28).max(96).default(defaultHeader.logoSize),
    navigationOrder: z.array(z.enum(landingPageNavigationKeys)).length(5).refine(
      (keys) => new Set(keys).size === landingPageNavigationKeys.length,
      "Every navigation tab must appear once in the order.",
    ).default([...landingPageNavigationKeys]),
  }).default(defaultHeader),
  footer: z.object({
    title: text(120).default(defaultFooter.title),
    text: text(500).default(defaultFooter.text),
    textColor: z.string().regex(/^$|^#[\da-f]{6}$/i, "Enter a 6-digit hex color.").default(defaultFooter.textColor),
    backgroundColor: z.string().regex(/^$|^#[\da-f]{6}$/i, "Enter a 6-digit hex color.").default(defaultFooter.backgroundColor),
    textAlign: z.enum(landingPageTextAlignments).default("inherit"),
    fontFamily: z.enum(landingPageThemeFonts).default("inherit"),
    fontSizeScale: z.number().int().min(75).max(150).default(100),
    paddingY: z.number().int().min(0).max(48).default(defaultFooter.paddingY),
  }).default(defaultFooter),
  sectionBackgrounds: z.object({
    hero: heroBackgroundSchema.default(defaultHeroBackground),
    welcome: backgroundSchema.default(defaultBackground),
    schedule: backgroundSchema.default(defaultBackground),
    livestream: backgroundSchema.default(defaultBackground),
    announcements: backgroundSchema.default(defaultBackground),
    events: backgroundSchema.default(defaultBackground),
    devotionals: backgroundSchema.default(defaultBackground),
    contact: backgroundSchema.default(defaultBackground),
  }).default(defaultSectionBackgrounds),
  visibility: z.object(
    Object.fromEntries(landingPageSectionKeys.map((key) => [key, z.boolean()])) as
      Record<LandingPageSectionKey, z.ZodBoolean>,
  ),
  hero: z.object({
    headline: text(160),
    subtext: text(1000),
    image: imageSchema,
    buttons: z.array(z.object({
      label: requiredText(60),
      url: buttonUrl,
    })).max(2),
  }),
  welcome: z.object({
    text: text(2000),
    image: imageSchema,
  }),
  schedule: z.object({
    rows: z.array(z.object({
      id: z.string().uuid(),
      day: requiredText(40),
      time: requiredText(40),
      serviceName: requiredText(120),
      note: text(300),
    })).max(20),
  }),
  livestream: z.preprocess((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    const saved = value as Record<string, unknown>;
    if (saved.items !== undefined) return value;
    return {
      ...saved,
      items: typeof saved.url === "string" && saved.url
        ? [{ id: "00000000-0000-4000-8000-000000000001", url: saved.url, label: saved.label ?? "" }]
        : [],
    };
  }, z.object({
    items: z.array(z.object({
      id: z.string().uuid(),
      url: videoUrl,
      label: text(80),
    })).max(100).default([]),
    itemsToShow: z.number().int().min(1).max(100).default(9),
    videoWidth: z.number().int().min(240).max(768).default(768),
  })),
  contact: z.object({
    address: text(500),
    phone: text(50),
    email: z.union([z.literal(""), z.string().trim().email().max(254)]),
    facebookUrl: emptyOrWebUrl,
    mapUrl: emptyOrWebUrl,
    appearance: z.object({
      address: contactAppearanceSchema.default(defaultContactAppearance),
      phone: contactAppearanceSchema.default(defaultContactAppearance),
      email: contactAppearanceSchema.default(defaultContactAppearance),
      mapUrl: contactAppearanceSchema.default(defaultContactAppearance),
      facebookUrl: contactAppearanceSchema.default(defaultContactAppearance),
    }).default(defaultContactAppearances),
  }),
  devotionals: z.object({
    count: z.number().int().min(1).max(12),
  }),
  announcements: z.object({
    title: text(120),
    intro: text(500),
    count: z.union([z.literal(3), z.literal(6), z.literal(9)]),
    pinnedId: z.string().uuid().nullable(),
  }),
  events: z.object({
    title: text(120),
    intro: text(500),
    count: z.union([z.literal(3), z.literal(6), z.literal(9)]),
  }),
}).superRefine((content, context) => {
  const requiredWhenVisible: Array<[LandingPageSectionKey, boolean, string]> = [
    ["hero", Boolean(content.hero.headline), "Add a headline before showing the hero."],
    [
      "welcome",
      Boolean(content.welcome.text || content.welcome.image.path),
      "Add welcome text or a photo before showing this section.",
    ],
    [
      "schedule",
      content.schedule.rows.length > 0,
      "Add a worship schedule row before showing this section.",
    ],
    [
      "livestream",
      content.livestream.items.length > 0,
      "Add a video link before showing the livestream section.",
    ],
    [
      "announcements",
      Boolean(content.announcements.title),
      "Add a title before showing the announcements section.",
    ],
    ["events", Boolean(content.events.title), "Add a title before showing the events section."],
    ["devotionals", content.devotionals.count > 0, "Choose how many devotionals to show."],
    [
      "contact",
      Boolean(
        content.contact.address ||
          content.contact.phone ||
          content.contact.email ||
          content.contact.facebookUrl ||
          content.contact.mapUrl,
      ),
      "Add contact information before showing this section.",
    ],
  ];

  for (const [section, isComplete, message] of requiredWhenVisible) {
    if (content.visibility[section] && !isComplete) {
      context.addIssue({
        code: "custom",
        path: ["visibility", section],
        message,
      });
    }
  }
});

export type LandingPageContent = z.infer<typeof builderContentSchema>;

const defaultLandingPageContent: LandingPageContent = {
  sectionOrder: [...landingPageSectionKeys],
  header: defaultHeader,
  footer: defaultFooter,
  sectionBackgrounds: defaultSectionBackgrounds,
  visibility: {
    hero: false,
    welcome: false,
    schedule: false,
    livestream: false,
    announcements: true,
    events: true,
    devotionals: false,
    contact: false,
  },
  hero: {
    headline: "",
    subtext: "",
    image: { path: null, alt: "" },
    buttons: [],
  },
  welcome: {
    text: "",
    image: { path: null, alt: "" },
  },
  schedule: { rows: [] },
  livestream: { items: [], itemsToShow: 9, videoWidth: 768 },
  contact: {
    address: "",
    phone: "",
    email: "",
    facebookUrl: "",
    mapUrl: "",
    appearance: defaultContactAppearances,
  },
  devotionals: { count: 3 },
  announcements: {
    title: "Announcements",
    intro: "",
    count: 3,
    pinnedId: null,
  },
  events: {
    title: "Events",
    intro: "",
    count: 3,
  },
};

export function getDefaultLandingPageContent(): LandingPageContent {
  return structuredClone(defaultLandingPageContent);
}

export function parseLandingPageContent(value: unknown) {
  return builderContentSchema.safeParse(value);
}

export function getYouTubeVideoEmbedUrl(value: string): string | null {
  if (!URL.canParse(value)) {
    return null;
  }

  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  if (hostname !== "youtu.be" && !hostname.endsWith(".youtube.com") && hostname !== "youtube.com") {
    return null;
  }

  const pathSegments = url.pathname.split("/").filter(Boolean);
  const normalizedPath = url.pathname.replace(/\/+$/, "");
  const videoId =
    hostname === "youtu.be"
      ? pathSegments[0]
      : normalizedPath === "/watch"
        ? url.searchParams.get("v")
        : ["embed", "live", "shorts", "v"].includes(pathSegments[0] ?? "")
          ? pathSegments[1]
          : null;

  if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
    return null;
  }

  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

export function getLivestreamVideoUrls(value: string) {
  if (!URL.canParse(value)) return null;
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const sourceUrl = url.toString();
  const youtubeUrl = getYouTubeVideoEmbedUrl(sourceUrl);
  if (youtubeUrl) return { sourceUrl, embedUrl: youtubeUrl };

  const host = url.hostname.toLowerCase();
  if (host === "vimeo.com" || host === "www.vimeo.com" || host === "player.vimeo.com") {
    const match = url.pathname.match(/^\/(?:video\/)?(\d+)\/?$/);
    if (match && !url.searchParams.has("h")) return { sourceUrl, embedUrl: `https://player.vimeo.com/video/${match[1]}` };
  }
  if ((host === "facebook.com" || host === "www.facebook.com" || host === "m.facebook.com") &&
      (/^\/(?:[^/]+\/)?videos\/\d+\/?$/.test(url.pathname) ||
        (url.pathname.replace(/\/$/, "") === "/watch" && /^\d+$/.test(url.searchParams.get("v") ?? "")))) {
    const embed = new URL("https://www.facebook.com/plugins/video.php");
    embed.searchParams.set("href", sourceUrl);
    embed.searchParams.set("show_text", "false");
    return { sourceUrl, embedUrl: embed.toString() };
  }
  return { sourceUrl, embedUrl: null };
}

export function resetLandingPageSection(
  content: LandingPageContent,
  section: LandingPageSectionKey,
): LandingPageContent {
  const defaults = getDefaultLandingPageContent();
  return {
    ...content,
    [section]: defaults[section],
    sectionBackgrounds: {
      ...content.sectionBackgrounds,
      [section]: defaults.sectionBackgrounds[section],
    },
    visibility: {
      ...content.visibility,
      [section]: defaults.visibility[section],
    },
  };
}

