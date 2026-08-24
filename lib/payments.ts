import { paymentRecords } from "@/lib/docs";
import {
  receiptInSalesPeriod,
  type SalesPeriodMode,
} from "@/lib/sales-period";

export const OPEN_INVOICE_STATUSES = ["UNPAID", "PARTIAL"] as const;

export function paidCents(
  receipts: { number: string; amountCents: number }[]
): number {
  return paymentRecords(receipts).reduce((sum, r) => sum + r.amountCents, 0);
}

export function remainingCents(
  totalCents: number,
  receipts: { number: string; amountCents: number }[]
): number {
  return Math.max(0, totalCents - paidCents(receipts));
}

export function statusFromPaid(
  totalCents: number,
  paid: number
): "UNPAID" | "PARTIAL" | "PAID" {
  if (paid <= 0) return "UNPAID";
  if (paid >= totalCents) return "PAID";
  return "PARTIAL";
}

export function collectedCents(
  receipts: { number: string; amountCents: number; invoiceId: string }[]
): number {
  const byInvoice = new Map<string, { number: string; amountCents: number }[]>();
  for (const r of receipts) {
    const list = byInvoice.get(r.invoiceId) ?? [];
    list.push(r);
    byInvoice.set(r.invoiceId, list);
  }
  let total = 0;
  for (const docs of byInvoice.values()) {
    total += paidCents(docs);
  }
  return total;
}

export function collectedCentsInPeriod(
  receipts: {
    number: string;
    amountCents: number;
    invoiceId: string;
    paidAt: Date;
  }[],
  mode: SalesPeriodMode,
  period: string
): number {
  const byInvoice = new Map<string, typeof receipts>();
  for (const receipt of receipts) {
    const list = byInvoice.get(receipt.invoiceId) ?? [];
    list.push(receipt);
    byInvoice.set(receipt.invoiceId, list);
  }
  let total = 0;
  for (const docs of byInvoice.values()) {
    for (const record of paymentRecords(docs)) {
      if (receiptInSalesPeriod(record.paidAt, mode, period)) {
        total += record.amountCents;
      }
    }
  }
  return total;
}
