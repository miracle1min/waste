const BUSINESS_DAY_CUTOFF_HOUR = 5;

function getWIBParts(date?: Date): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
} {
  const target = date || new Date();
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(target);

  return {
    year: parts.find((p) => p.type === "year")?.value || "",
    month: parts.find((p) => p.type === "month")?.value || "",
    day: parts.find((p) => p.type === "day")?.value || "",
    hour: parts.find((p) => p.type === "hour")?.value || "",
    minute: parts.find((p) => p.type === "minute")?.value || "",
    second: parts.find((p) => p.type === "second")?.value || "",
  };
}

function getBusinessDateWIB(): Date {
  const p = getWIBParts();
  const wibDate = new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`);
  if (Number.parseInt(p.hour, 10) < BUSINESS_DAY_CUTOFF_HOUR) {
    wibDate.setDate(wibDate.getDate() - 1);
  }
  return wibDate;
}

export function getCurrentWIBDateString(): string {
  const bizDate = getBusinessDateWIB();
  const y = bizDate.getFullYear();
  const m = String(bizDate.getMonth() + 1).padStart(2, "0");
  const d = String(bizDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
