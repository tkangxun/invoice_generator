import { todayDateInput } from "@/lib/money";

export type SalesPeriodMode = "year" | "month";

export function parseSalesMode(value?: string): SalesPeriodMode {
  return value === "year" ? "year" : "month";
}

export function currentSalesPeriod(mode: SalesPeriodMode): string {
  const today = todayDateInput();
  return mode === "year" ? today.slice(0, 4) : today.slice(0, 7);
}

export function parseSalesPeriod(
  mode: SalesPeriodMode,
  value?: string
): string {
  const current = currentSalesPeriod(mode);
  if (mode === "year") {
    return /^\d{4}$/.test(value ?? "") ? value! : current;
  }
  return /^\d{4}-\d{2}$/.test(value ?? "") ? value! : current;
}

export function salesPeriodLabel(mode: SalesPeriodMode, period: string): string {
  if (mode === "year") return period;
  const [year, month] = period.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-SG", {
    month: "long",
    year: "numeric",
  });
}

export function shiftSalesPeriod(
  mode: SalesPeriodMode,
  period: string,
  delta: number
): string {
  if (mode === "year") return String(Number(period) + delta);
  const [year, month] = period.split("-").map(Number);
  const next = new Date(year, month - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

export function canShiftSalesPeriod(
  mode: SalesPeriodMode,
  period: string,
  delta: number
): boolean {
  const next = shiftSalesPeriod(mode, period, delta);
  return next <= currentSalesPeriod(mode);
}

export function switchedSalesPeriod(
  mode: SalesPeriodMode,
  period: string
): { mode: SalesPeriodMode; period: string } {
  if (mode === "month") {
    return { mode: "year", period: period.slice(0, 4) };
  }
  const currentMonth = currentSalesPeriod("month");
  return {
    mode: "month",
    period: currentMonth.startsWith(period) ? currentMonth : `${period}-01`,
  };
}

export function dashboardHref(mode: SalesPeriodMode, period: string): string {
  const params = new URLSearchParams();
  if (mode !== "month") params.set("sales", mode);
  if (period !== currentSalesPeriod(mode)) params.set("period", period);
  const qs = params.toString();
  return qs ? `/dashboard?${qs}` : "/dashboard";
}

export function receiptInSalesPeriod(
  paidAt: Date,
  mode: SalesPeriodMode,
  period: string
): boolean {
  const ymd = paidAt.toLocaleDateString("en-CA", {
    timeZone: "Asia/Singapore",
  });
  return mode === "year" ? ymd.startsWith(period) : ymd.slice(0, 7) === period;
}

// Singapore is UTC+8. Month start 00:00 SGT is 16:00 UTC the previous day.
const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;

export function singaporeMonthStart(period: string): Date {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1) - SGT_OFFSET_MS);
}

export function dateRangeForPeriod(
  mode: SalesPeriodMode,
  period: string
): { start: Date; end: Date } {
  if (mode === "year") {
    return {
      start: singaporeMonthStart(`${period}-01`),
      end: singaporeMonthStart(`${Number(period) + 1}-01`),
    };
  }
  return {
    start: singaporeMonthStart(period),
    end: singaporeMonthStart(shiftSalesPeriod("month", period, 1)),
  };
}

export function recentTwoMonthsRange(): {
  from: string;
  to: string;
  start: Date;
  end: Date;
} {
  const to = currentSalesPeriod("month");
  const from = shiftSalesPeriod("month", to, -1);
  return {
    from,
    to,
    start: singaporeMonthStart(from),
    end: singaporeMonthStart(shiftSalesPeriod("month", to, 1)),
  };
}

export function recentTwoMonthsLabel(): string {
  const { from, to } = recentTwoMonthsRange();
  return `${salesPeriodLabel("month", from)} – ${salesPeriodLabel("month", to)}`;
}

export type ReceiptsListScope =
  | { kind: "recent" }
  | { kind: "all" }
  | { kind: "period"; mode: SalesPeriodMode; period: string };

export function parseReceiptsListScope(
  sales?: string,
  period?: string
): ReceiptsListScope {
  if (sales === "all") return { kind: "all" };
  if (sales === "year" || sales === "month") {
    return {
      kind: "period",
      mode: sales,
      period: parseSalesPeriod(sales, period),
    };
  }
  return { kind: "recent" };
}

export function parseReceiptsExportScope(
  sales?: string,
  period?: string
): ReceiptsListScope {
  if (!sales) return { kind: "all" };
  if (sales === "recent") return { kind: "recent" };
  return parseReceiptsListScope(sales, period);
}

export function receiptsPaidAtWhere(
  scope: ReceiptsListScope
): { paidAt: { gte: Date; lt: Date } } | undefined {
  if (scope.kind === "all") return undefined;
  const range =
    scope.kind === "recent"
      ? recentTwoMonthsRange()
      : dateRangeForPeriod(scope.mode, scope.period);
  return { paidAt: { gte: range.start, lt: range.end } };
}

export function receiptsListHref(scope: ReceiptsListScope): string {
  if (scope.kind === "recent") return "/receipts";
  if (scope.kind === "all") return "/receipts?sales=all";
  const params = new URLSearchParams();
  params.set("sales", scope.mode);
  params.set("period", scope.period);
  return `/receipts?${params}`;
}

export function receiptsExportHref(scope: ReceiptsListScope): string {
  if (scope.kind === "recent") return "/receipts/export?sales=recent";
  if (scope.kind === "all") return "/receipts/export?sales=all";
  const params = new URLSearchParams();
  params.set("sales", scope.mode);
  params.set("period", scope.period);
  return `/receipts/export?${params}`;
}

export function receiptsExportFilename(
  scope: ReceiptsListScope,
  today = todayDateInput()
): string {
  if (scope.kind === "all") return `receipts-all-${today}.csv`;
  if (scope.kind === "recent") {
    const { from, to } = recentTwoMonthsRange();
    return `receipts-${from}-${to}.csv`;
  }
  return `receipts-${scope.period}.csv`;
}
