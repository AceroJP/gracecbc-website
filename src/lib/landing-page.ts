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

const builderContentSchema = z.object({
  sectionOrder: z.array(z.enum(landingPageSectionKeys)).length(8).refine(
    (keys) => new Set(keys).size === landingPageSectionKeys.length,
    "Every section must appear once in the order.",
  ),
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
  livestream: z.object({
    url: emptyOrWebUrl,
    label: text(80),
  }).superRefine(({ url }, context) => {
    if (url) {
      const host = URL.canParse(url) ? new URL(url).hostname.toLowerCase() : "";
      if (host !== "youtu.be" && !host.endsWith(".youtube.com") && host !== "youtube.com") {
        context.addIssue({
          code: "custom",
          path: ["url"],
          message: "Enter a YouTube URL.",
        });
      }
    }
  }),
  contact: z.object({
    address: text(500),
    phone: text(50),
    email: z.union([z.literal(""), z.string().trim().email().max(254)]),
    facebookUrl: emptyOrWebUrl,
    mapUrl: emptyOrWebUrl,
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
      Boolean(content.livestream.url),
      "Add a YouTube URL before showing the livestream section.",
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
  livestream: { url: "", label: "" },
  contact: {
    address: "",
    phone: "",
    email: "",
    facebookUrl: "",
    mapUrl: "",
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

export function resetLandingPageSection(
  content: LandingPageContent,
  section: LandingPageSectionKey,
): LandingPageContent {
  const defaults = getDefaultLandingPageContent();
  return {
    ...content,
    [section]: defaults[section],
    visibility: {
      ...content.visibility,
      [section]: defaults.visibility[section],
    },
  };
}

