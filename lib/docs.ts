export function isFollowUpInvoiceNumber(number: string): boolean {
  return /-[a-z]$/i.test(number);
}

export function isReceiptNumber(number: string): boolean {
  return /^RCP-/i.test(number);
}

/** Money received. A final RCP issued after installments is excluded so it is not counted twice. */
export function paymentRecords<T extends { number: string; amountCents: number }>(
  docs: T[]
): T[] {
  const installments = docs.filter((d) => isFollowUpInvoiceNumber(d.number));
  const receipts = docs.filter((d) => isReceiptNumber(d.number));
  if (installments.length === 0) return receipts;
  return installments;
}

export function settlementReceipt<T extends { number: string }>(
  docs: T[]
): T | undefined {
  return docs.filter((d) => isReceiptNumber(d.number)).at(-1);
}

/** Payments that make up a receipt: installments if any, otherwise the receipt itself. */
export function splitPaymentsForReceipt<
  T extends { number: string; paidAt: Date },
>(receiptNumber: string, invoiceDocs: T[]): T[] {
  const installments = invoiceDocs.filter((doc) =>
    isFollowUpInvoiceNumber(doc.number)
  );
  const splits =
    installments.length > 0
      ? installments
      : invoiceDocs.filter((doc) => doc.number === receiptNumber);
  return [...splits].sort(
    (a, b) =>
      a.paidAt.getTime() - b.paidAt.getTime() ||
      a.number.localeCompare(b.number, "en", { numeric: true })
  );
}
