/* eslint-disable @next/next/no-img-element */
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { canAccessInvoice, requireUser } from "@/lib/session";
import { formatCents, formatDate } from "@/lib/money";
import { getCompany } from "@/lib/company";
import { collectionCatalog } from "@/lib/item-types";
import { PrintButton } from "@/components/PrintButton";
import { isFollowUpInvoiceNumber, paymentRecords } from "@/lib/docs";
import {
  supplementCollectionNote,
  supplementCreditSummary,
} from "@/lib/supplements";

const NAVY = "#1f3864";

export default async function PrintFollowUpInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const payment = await prisma.receipt.findUnique({
    where: { id },
    include: {
      invoice: {
        include: {
          lines: { include: { item: { select: { type: true } } } },
          receipts: true,
        },
      },
    },
  });
  if (!payment) notFound();
  if (!canAccessInvoice(user, payment.invoice)) notFound();
  if (!isFollowUpInvoiceNumber(payment.number)) {
    redirect(`/print/receipts/${payment.id}`);
  }

  const invoice = payment.invoice;
  const catalog = await collectionCatalog(invoice.companyId);
  const creditNotes = supplementCreditSummary(
    invoice.lines,
    catalog.slugs,
    catalog.unitFor
  );
  const payments = [...paymentRecords(invoice.receipts)].sort(
    (a, b) =>
      a.paidAt.getTime() - b.paidAt.getTime() || a.number.localeCompare(b.number)
  );
  const thisIndex = payments.findIndex((r) => r.id === payment.id);
  const paymentsToDate = thisIndex >= 0 ? payments.slice(0, thisIndex + 1) : payments;
  const amountPaid = paymentsToDate.reduce((s, r) => s + r.amountCents, 0);
  const outstanding = Math.max(0, invoice.totalCents - amountPaid);
  const company = await getCompany(invoice.companyId);

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end print:hidden">
        <PrintButton />
      </div>

      <div className="mx-auto flex min-h-[270mm] max-w-[210mm] flex-col bg-white px-14 py-12 shadow print:min-h-0 print:px-0 print:py-0 print:shadow-none">
        <div
          className="flex items-start justify-between border-b pb-4"
          style={{ borderColor: NAVY }}
        >
          <div>
            {company.logoSrc ? (
              <img src={company.logoSrc} alt={company.brand} className="h-14 w-auto" />
            ) : (
              <div className="font-serif text-2xl font-bold" style={{ color: NAVY }}>
                {company.brand}
              </div>
            )}
            <div className="mt-1 text-xs italic text-gray-500">
              {company.tagline}
            </div>
          </div>
          <div className="text-right">
            <div
              className="font-serif text-3xl font-bold tracking-wide"
              style={{ color: NAVY }}
            >
              INVOICE
            </div>
            <div className="mt-1 text-sm text-gray-700">{payment.number}</div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-6 text-sm">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: NAVY }}>
              From
            </div>
            <div className="mt-1 font-semibold" style={{ color: NAVY }}>
              {company.legalName}
            </div>
            <div className="text-gray-700">UEN: {company.uen}</div>
            {company.addressLines.map((line) => (
              <div key={line} className="text-gray-700">
                {line}
              </div>
            ))}
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: NAVY }}>
              Billed To
            </div>
            <div className="mt-1 font-semibold" style={{ color: NAVY }}>
              {invoice.customerName}
            </div>
            {invoice.customerAddress && (
              <div className="text-gray-700">{invoice.customerAddress}</div>
            )}
            {invoice.customerPhone && (
              <div className="text-gray-700">{invoice.customerPhone}</div>
            )}
            {invoice.customerEmail && (
              <div className="text-gray-700">{invoice.customerEmail}</div>
            )}
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: NAVY }}>
              Invoice Date
            </div>
            <div className="mt-1 text-gray-700">{formatDate(payment.paidAt)}</div>
            <div className="mt-3 text-xs font-bold uppercase tracking-wide" style={{ color: NAVY }}>
              Original Invoice
            </div>
            <div className="mt-1 text-gray-700">{invoice.number}</div>
          </div>
        </div>

        <div className="mt-8 text-sm">
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: NAVY }}>
            Original package
          </div>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-white" style={{ backgroundColor: NAVY }}>
                <th className="px-3 py-2 font-semibold">Description</th>
                <th className="px-3 py-2 text-right font-semibold">Qty</th>
                <th className="px-3 py-2 text-right font-semibold">Rate</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => {
                const collectionNote = supplementCollectionNote(
                  line,
                  catalog.slugs,
                  catalog.unitFor(line.item?.type ?? "")
                );
                return (
                <tr key={line.id} className="border-b border-gray-200">
                  <td className="px-3 py-2.5">
                    <div>{line.description}</div>
                    {collectionNote && (
                      <div className="mt-0.5 text-xs italic text-gray-600">
                        {collectionNote}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">{line.qty}</td>
                  <td className="px-3 py-2.5 text-right">
                    {formatCents(line.unitPriceCents)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {formatCents(line.lineTotalCents)}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-8 text-sm">
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: NAVY }}>
            Payments received
          </div>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-left text-gray-500">
                <th className="py-1.5 font-medium">Invoice</th>
                <th className="py-1.5 font-medium">Date paid</th>
                <th className="py-1.5 font-medium">Method</th>
                <th className="py-1.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {paymentsToDate.map((r) => (
                <tr key={r.id} className="border-b border-gray-200">
                  <td className="py-1.5">{r.number}</td>
                  <td className="py-1.5">{formatDate(r.paidAt)}</td>
                  <td className="py-1.5">{r.paymentMethod}</td>
                  <td className="py-1.5 text-right">{formatCents(r.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <div className="w-72 text-sm">
            {invoice.discountCents > 0 && (
              <>
                <div className="flex justify-between border-b border-gray-200 px-3 py-2">
                  <span className="text-gray-600">Subtotal</span>
                  <span>{formatCents(invoice.subtotalCents)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 px-3 py-2">
                  <span className="text-teal-700">Discount</span>
                  <span className="text-teal-700">
                    -{formatCents(invoice.discountCents)}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between border-b border-gray-200 px-3 py-2">
              <span className="text-gray-600">Original Amount</span>
              <span>{formatCents(invoice.totalCents)}</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 px-3 py-2">
              <span className="text-gray-600">Amount Paid</span>
              <span>{formatCents(amountPaid)}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <span className="font-bold">Outstanding Amount</span>
              <span className="text-lg font-bold" style={{ color: NAVY }}>
                {formatCents(outstanding)}
              </span>
            </div>
          </div>
        </div>

        {creditNotes.length > 0 && (
          <div className="mt-4 text-sm text-gray-700">
            <div className="font-semibold">Supplements held as credit</div>
            <ul className="mt-1 list-disc pl-5">
              {creditNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {outstanding > 0 && (
          <div className="mt-10 flex items-start justify-between">
            <div className="text-sm">
              <div className="text-xs font-bold uppercase tracking-wide" style={{ color: NAVY }}>
                Payment
              </div>
            <div className="mt-2 font-semibold" style={{ color: NAVY }}>
              PayNow to UEN
            </div>
            <div className="text-gray-700">{company.uen}</div>
            <div className="text-gray-700">({company.legalName})</div>
            <div className="mt-3 text-xs text-gray-600">
              Terms: {company.paymentTerms}
            </div>
          </div>
          {company.paynowQrSrc ? (
            <img
              src={company.paynowQrSrc}
              alt="PayNow QR code"
              className="h-32 w-32 object-contain"
            />
          ) : null}
          </div>
        )}

        <div className="mt-auto pt-10 text-center text-[10px] italic text-gray-500">
          {company.footerLine}
        </div>
      </div>
    </div>
  );
}
