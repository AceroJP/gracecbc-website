import type { Database } from "@/types/database.types";

export type ChurchEvent = Database["public"]["Tables"]["events"]["Row"];

export function formatEventDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export function formatEventDateRange(startDate: string, endDate: string | null) {
  const formattedStartDate = formatEventDate(startDate);

  if (!endDate || endDate === startDate) {
    return formattedStartDate;
  }

  return `${formattedStartDate} – ${formatEventDate(endDate)}`;
}

export function formatEventTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const hour = hours % 12 || 12;

  return `${hour}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}
