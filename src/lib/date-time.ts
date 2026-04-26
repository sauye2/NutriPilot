export function isValidTimeZone(timeZone: string | null | undefined) {
  if (!timeZone) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function getLocalDateString(date: Date, timeZone?: string | null) {
  if (!timeZone || !isValidTimeZone(timeZone)) {
    return date.toISOString().slice(0, 10);
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return date.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

export function buildLocalDateRange(endDate: string, days: number) {
  const [year, month, day] = endDate.split("-").map(Number);

  if (!year || !month || !day || days <= 0) {
    return [];
  }

  const baseDate = new Date(Date.UTC(year, month - 1, day));

  return Array.from({ length: days }, (_unused, index) => {
    const nextDate = new Date(baseDate);
    nextDate.setUTCDate(baseDate.getUTCDate() - (days - 1 - index));

    return [
      nextDate.getUTCFullYear(),
      String(nextDate.getUTCMonth() + 1).padStart(2, "0"),
      String(nextDate.getUTCDate()).padStart(2, "0"),
    ].join("-");
  });
}
