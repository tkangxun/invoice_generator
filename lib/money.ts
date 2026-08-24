export const CURRENCY = "SGD";
export const SINGAPORE_TZ = "Asia/Singapore";

// Matches the company's document style: S$2,350.00
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents) / 100;
  return `${sign}S$${abs.toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function dollarsToCents(dollars: string | number): number {
  const n = typeof dollars === "string" ? parseFloat(dollars) : dollars;
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function singaporeYmd(d: Date, timeZone = SINGAPORE_TZ): [string, string, string] {
  const ymd = d.toLocaleDateString("en-CA", { timeZone });
  const [year, month, day] = ymd.split("-");
  return [year, month, day];
}

// Document date style: 25 May 2026
export function formatDate(d: Date, timeZone = SINGAPORE_TZ): string {
  const [year, month, day] = singaporeYmd(d, timeZone);
  return `${Number(day)} ${MONTHS_LONG[Number(month) - 1]} ${year}`;
}

export function formatDateShort(d: Date, timeZone = SINGAPORE_TZ): string {
  const [year, month, day] = singaporeYmd(d, timeZone);
  return `${day}/${month}/${year}`;
}

export function todayDateInput(timeZone = SINGAPORE_TZ): string {
  return new Date().toLocaleDateString("en-CA", { timeZone });
}

export function toDateInput(
  date: Date | null | undefined,
  timeZone = SINGAPORE_TZ
): string {
  if (!date) return "";
  return date.toLocaleDateString("en-CA", { timeZone });
}

export function parseDateInput(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const raw = match ? value.trim() : todayDateInput();
  const [, year, month, day] = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw) ?? [];
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 4, 0, 0));
}
