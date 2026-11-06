import type { Database } from "@/types/database.types";

export type PublicDevotional = Database["public"]["Tables"]["devotionals"]["Row"] & {
  author: string;
  category: string | null;
};

export function formatDevotionalDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
  }).format(new Date(value));
}

export function getDevotionalExcerpt(value: string, length = 180) {
  const plainText = value.replace(/\s+/g, " ").trim();
  return plainText.length > length
    ? `${plainText.slice(0, length).trimEnd()}…`
    : plainText;
}

export function getReadingTime(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}
