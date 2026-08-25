import { OPEN_INVOICE_STATUSES, remainingCents } from "@/lib/payments";
import { dateRangeForPeriod, recentTwoMonthsRange } from "@/lib/sales-period";
import { invoiceProfileLabel } from "@/lib/company";

export type InvoiceSortKey =
  | "number"
  | "customer"
  | "profile"
  | "salesperson"
  | "date"
  | "total"
  | "balance"
  | "status";

export type InvoiceSortDir = "asc" | "desc";

type SortableInvoice = {
  number: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  status: string;
  totalCents: number;
  issuedAt: Date;
  profileName?: string | null;
  profile?: { name: string } | null;
  createdBy: { name: string };
  receipts: { number: string; amountCents: number }[];
};

export function parseInvoiceSort(value?: string): InvoiceSortKey {
  switch (value) {
    case "number":
    case "customer":
    case "profile":
    case "salesperson":
    case "date":
    case "total":
    case "balance":
    case "status":
      return value;
    default:
      return "date";
  }
}

export function parseInvoiceDir(value?: string): InvoiceSortDir {
  return value === "asc" ? "asc" : "desc";
}

export const INVOICE_STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "unpaid", label: "Unpaid & partial" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIAL", label: "Partial" },
  { value: "PAID", label: "Paid" },
  { value: "VOIDED", label: "Voided" },
] as const;

export type InvoiceStatusFilter =
  (typeof INVOICE_STATUS_FILTERS)[number]["value"];

export function parseInvoiceStatus(value?: string): InvoiceStatusFilter {
  return INVOICE_STATUS_FILTERS.some((option) => option.value === value)
    ? (value as InvoiceStatusFilter)
    : "";
}

export function invoiceStatusWhere(
  status: InvoiceStatusFilter
): { status: string } | { status: { in: string[] } } | undefined {
  if (!status) return undefined;
  if (status === "unpaid") return { status: { in: ["UNPAID", "PARTIAL"] } };
  return { status };
}

export function parseInvoiceMonth(value?: string): string {
  return /^\d{4}-\d{2}$/.test(value ?? "") ? value! : "";
}

export function usesInvoiceRecentWindow(opts: {
  query: string;
  month: string;
  status: InvoiceStatusFilter;
}): boolean {
  return !opts.query && !opts.month && !opts.status;
}

export function invoiceIssuedAtWhere(opts: {
  query: string;
  month: string;
  status: InvoiceStatusFilter;
}):
  | { issuedAt: { gte: Date; lt: Date } }
  | {
      OR: Array<
        | { issuedAt: { gte: Date; lt: Date } }
        | { status: { in: string[] } }
      >;
    }
  | undefined {
  if (opts.month) {
    const range = dateRangeForPeriod("month", opts.month);
    return { issuedAt: { gte: range.start, lt: range.end } };
  }
  if (opts.query || opts.status) return undefined;
  const range = recentTwoMonthsRange();
  return {
    OR: [
      { issuedAt: { gte: range.start, lt: range.end } },
      { status: { in: [...OPEN_INVOICE_STATUSES] } },
    ],
  };
}

const containsInsensitive = (q: string) =>
  ({ contains: q, mode: "insensitive" as const });

export function invoiceSearchWhere(query: string):
  | {
      OR: Array<
        | { number: { contains: string; mode: "insensitive" } }
        | { customerName: { contains: string; mode: "insensitive" } }
        | { customerPhone: { contains: string; mode: "insensitive" } }
        | { customerEmail: { contains: string; mode: "insensitive" } }
        | { createdBy: { name: { contains: string; mode: "insensitive" } } }
      >;
    }
  | undefined {
  const q = query.trim();
  if (!q) return undefined;
  return {
    OR: [
      { number: containsInsensitive(q) },
      { customerName: containsInsensitive(q) },
      { customerPhone: containsInsensitive(q) },
      { customerEmail: containsInsensitive(q) },
      { createdBy: { name: containsInsensitive(q) } },
    ],
  };
}

export function matchesInvoiceMonth(
  invoice: SortableInvoice,
  month: string
): boolean {
  if (!month) return true;
  const issuedMonth = invoice.issuedAt.toLocaleDateString("en-CA", {
    timeZone: "Asia/Singapore",
  }).slice(0, 7);
  return issuedMonth === month;
}

export function matchesInvoiceQuery(
  invoice: SortableInvoice,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    invoice.number,
    invoice.customerName,
    invoice.customerPhone,
    invoice.customerEmail,
    invoice.createdBy.name,
    invoice.status,
  ].some((value) => value?.toLowerCase().includes(q));
}

export function sortInvoices<T extends SortableInvoice>(
  invoices: T[],
  sort: InvoiceSortKey,
  dir: InvoiceSortDir
): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...invoices].sort((a, b) => {
    const cmp = compareInvoices(a, b, sort);
    return cmp === 0
      ? b.issuedAt.getTime() - a.issuedAt.getTime()
      : cmp * sign;
  });
}

function compareInvoices(
  a: SortableInvoice,
  b: SortableInvoice,
  sort: InvoiceSortKey
): number {
  switch (sort) {
    case "number":
      return a.number.localeCompare(b.number, "en", { numeric: true });
    case "customer":
      return a.customerName.localeCompare(b.customerName, "en");
    case "profile":
      return invoiceProfileLabel(a).localeCompare(invoiceProfileLabel(b), "en");
    case "salesperson":
      return a.createdBy.name.localeCompare(b.createdBy.name, "en");
    case "date":
      return a.issuedAt.getTime() - b.issuedAt.getTime();
    case "total":
      return a.totalCents - b.totalCents;
    case "balance":
      return invoiceBalance(a) - invoiceBalance(b);
    case "status":
      return a.status.localeCompare(b.status, "en");
  }
}

function invoiceBalance(invoice: SortableInvoice): number {
  if (invoice.status === "VOIDED") return -1;
  return remainingCents(invoice.totalCents, invoice.receipts);
}

export function invoiceListHref(params: {
  status?: string;
  q?: string;
  month?: string;
  salesperson?: string;
  voidReason?: string;
  profile?: string;
  sort?: string;
  dir?: string;
}): string {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.month) search.set("month", params.month);
  if (params.salesperson) search.set("salesperson", params.salesperson);
  if (params.voidReason) search.set("voidReason", params.voidReason);
  if (params.profile) search.set("profile", params.profile);
  if (params.sort && params.sort !== "date") search.set("sort", params.sort);
  if (params.dir && params.dir !== "desc") search.set("dir", params.dir);
  const qs = search.toString();
  return qs ? `/invoices?${qs}` : "/invoices";
}

export const NO_INVOICE_PROFILE = "none";

export function parseInvoiceProfile(
  value: string | undefined,
  profiles: { id: string }[]
): string {
  const requested = value?.trim() || "";
  if (!requested) return "";
  if (requested === NO_INVOICE_PROFILE) return requested;
  return profiles.some((item) => item.id === requested) ? requested : "";
}

export function invoiceProfileWhere(
  profile: string
): { profileId: string | null } | undefined {
  if (!profile) return undefined;
  if (profile === NO_INVOICE_PROFILE) return { profileId: null };
  return { profileId: profile };
}
