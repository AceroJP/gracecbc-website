export const announcementBucket = "church-announcements";
export const announcementPdfMaxBytes = 20 * 1024 * 1024;
export const announcementImageMaxBytes = 5 * 1024 * 1024;
export const announcementMaxImages = 20;
export const announcementPdfMimeType = "application/pdf";
export const announcementMaxCategories = 10;

export const announcementCategoryOptions = [
  { value: "sunday_worship", label: "Sunday Worship" },
  { value: "prayer_meeting", label: "Prayer Meeting" },
] as const;

export const announcementImageTypes = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
} as const;

export function getAnnouncementCategoryLabel(category: string) {
  return (
    announcementCategoryOptions.find((option) => option.value === category)
      ?.label ?? category
  );
}

export function getAnnouncementFileExtension(
  name: string,
  contentType: string,
  size: number,
) {
  const extension = name.slice(name.lastIndexOf(".")).toLowerCase();

  if (
    contentType === announcementPdfMimeType &&
    extension === ".pdf" &&
    size > 0 &&
    size <= announcementPdfMaxBytes
  ) {
    return extension;
  }

  const allowedExtensions: readonly string[] =
    announcementImageTypes[
      contentType as keyof typeof announcementImageTypes
    ] ?? [];

  if (
    allowedExtensions.includes(extension) &&
    size > 0 &&
    size <= announcementImageMaxBytes
  ) {
    return extension;
  }

  return null;
}

export function formatAnnouncementDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(value));
}
