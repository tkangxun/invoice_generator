import { collectedCentsInPeriod, OPEN_INVOICE_STATUSES } from "@/lib/payments";
import type { SalesPeriodMode } from "@/lib/sales-period";

export type SalespersonRow = {
  userId: string;
  name: string;
  invoiceCount: number;
  unpaidCount: number;
  collectedCents: number;
};

const OPEN = new Set<string>(OPEN_INVOICE_STATUSES);

export function buildSalespersonRows(input: {
  members: { userId: string; name: string; role: string; active: boolean }[];
  sellerIds: Iterable<string>;
  periodInvoices: { userId: string; status: string }[];
  receipts: {
    number: string;
    amountCents: number;
    invoiceId: string;
    paidAt: Date;
    invoiceUserId: string;
    invoiceStatus: string;
  }[];
  mode: SalesPeriodMode;
  period: string;
}): SalespersonRow[] {
  const sellers = new Set(input.sellerIds);
  const seen = new Set<string>();
  const rows: SalespersonRow[] = [];

  for (const member of input.members) {
    if (seen.has(member.userId)) continue;
    seen.add(member.userId);
    const hasSold = sellers.has(member.userId);
    const alwaysListed = member.role === "SALES" && member.active;
    if (!alwaysListed && !hasSold) continue;

    const mine = input.periodInvoices.filter(
      (invoice) =>
        invoice.userId === member.userId && invoice.status !== "VOIDED"
    );
    const mineReceipts = input.receipts.filter(
      (receipt) =>
        receipt.invoiceUserId === member.userId &&
        receipt.invoiceStatus !== "VOIDED"
    );
    rows.push({
      userId: member.userId,
      name: member.name,
      invoiceCount: mine.length,
      unpaidCount: mine.filter((invoice) => OPEN.has(invoice.status)).length,
      collectedCents: collectedCentsInPeriod(
        mineReceipts,
        input.mode,
        input.period
      ),
    });
  }

  rows.sort(
    (a, b) =>
      b.collectedCents - a.collectedCents ||
      a.name.localeCompare(b.name, "en", { sensitivity: "base" })
  );
  return rows;
}
