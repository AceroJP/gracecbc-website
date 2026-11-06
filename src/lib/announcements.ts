export const announcementBucket = "church-announcements";
export const announcementPdfMaxBytes = 20 * 1024 * 1024;
export const announcementPowerPointMaxBytes = 20 * 1024 * 1024;
export const announcementImageMaxBytes = 5 * 1024 * 1024;
export const announcementMaxImages = 20;
export const announcementPdfMimeType = "application/pdf";
export const announcementPowerPointMimeTypes = {
  "application/vnd.ms-powerpoint": [".ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    ".pptx",
  ],
} as const;
export const announcementMaxCategories = 10;

export const announcementPresentationOptions = [
  { value: "pdf", label: "PDF" },
  { value: "powerpoint", label: "PowerPoint" },
  { value: "images", label: "Image slides" },
] as const;

export type AnnouncementPresentationType =
  (typeof announcementPresentationOptions)[number]["value"];

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

  const powerPointExtensions: readonly string[] =
    announcementPowerPointMimeTypes[
      contentType as keyof typeof announcementPowerPointMimeTypes
    ] ?? [];

  if (
    powerPointExtensions.includes(extension) &&
    size > 0 &&
    size <= announcementPowerPointMaxBytes
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

export function getAnnouncementPresentationType(
  presentationPath: string | null,
  slidePaths: string[],
): AnnouncementPresentationType {
  if (slidePaths.length > 0) {
    return "images";
  }
  if (
    presentationPath?.toLowerCase().endsWith(".ppt") ||
    presentationPath?.toLowerCase().endsWith(".pptx")
  ) {
    return "powerpoint";
  }
  return "pdf";
}

export function formatAnnouncementDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(value));
}
