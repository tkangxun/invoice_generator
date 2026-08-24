/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatCents, formatDate } from "@/lib/money";
import { COMPANY } from "@/lib/company";
import { PrintButton } from "@/components/PrintButton";
import {
  supplementCollectionNote,
  supplementCreditSummary,
} from "@/lib/supplements";

const NAVY = "#1f3864";

export default async function PrintInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      lines: { include: { item: { select: { type: true } } } },
      createdBy: { select: { name: true } },
    },
  });
  if (!invoice) notFound();
  if (user.role !== "ADMIN" && invoice.userId !== user.userId) notFound();
  const creditNotes = supplementCreditSummary(invoice.lines);

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end print:hidden">
        <PrintButton />
      </div>

      <div className="mx-auto flex min-h-[270mm] max-w-[210mm] flex-col bg-white px-14 py-12 shadow print:min-h-0 print:px-0 print:py-0 print:shadow-none">
        {/* Header */}
        <div
          className="flex items-start justify-between border-b pb-4"
          style={{ borderColor: NAVY }}
        >
          <div>
            <img src={COMPANY.logoSrc} alt={COMPANY.brand} className="h-14 w-auto" />
            <div className="mt-1 text-xs italic text-gray-500">
              {COMPANY.tagline}
            </div>
          </div>
          <div className="text-right">
            <div
              className="font-serif text-3xl font-bold tracking-wide"
              style={{ color: NAVY }}
            >
              INVOICE
            </div>
            <div className="mt-1 text-sm text-gray-700">{invoice.number}</div>
            {invoice.status === "VOIDED" && (
              <div className="mt-2 text-sm font-bold tracking-wide text-red-700">
                VOIDED
                {invoice.voidReason ? (
                  <div className="mt-1 text-xs font-normal normal-case">
                    {invoice.voidReason}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* From / Billed to / Dates */}
        <div className="mt-8 grid grid-cols-3 gap-6 text-sm">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: NAVY }}>
              From
            </div>
            <div className="mt-1 font-semibold" style={{ color: NAVY }}>
              {COMPANY.legalName}
            </div>
            <div className="text-gray-700">UEN: {COMPANY.uen}</div>
            {COMPANY.addressLines.map((line) => (
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
            <div className="mt-1 text-gray-700">{formatDate(invoice.issuedAt)}</div>
            <div className="mt-3 text-xs font-bold uppercase tracking-wide" style={{ color: NAVY }}>
              Due Date
            </div>
            <div className="mt-1 text-gray-700">
              {invoice.dueAt ? formatDate(invoice.dueAt) : "Upon receipt"}
            </div>
          </div>
        </div>

        {/* Lines */}
        <table className="mt-8 w-full text-sm">
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
              const collectionNote = supplementCollectionNote(line);
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

        {/* Totals */}
        <div className="mt-2 flex justify-end">
          <div className="w-72 text-sm">
            <div className="flex justify-between border-b border-gray-200 px-3 py-2">
              <span className="text-gray-600">Subtotal</span>
              <span>{formatCents(invoice.subtotalCents)}</span>
            </div>
            {invoice.discountCents > 0 && (
              <div className="flex justify-between border-b border-gray-200 px-3 py-2">
                <span className="text-teal-700">Discount</span>
                <span className="text-teal-700">
                  -{formatCents(invoice.discountCents)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between px-3 py-2">
              <span className="font-bold">AMOUNT TO BE PAID</span>
              <span className="text-lg font-bold" style={{ color: NAVY }}>
                {formatCents(invoice.totalCents)}
              </span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-4 text-sm text-gray-700">
            <span className="font-semibold">Notes: </span>
            {invoice.notes}
          </div>
        )}

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

        {/* Payment */}
        <div className="mt-10 flex items-start justify-between">
          <div className="text-sm">
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: NAVY }}>
              Payment
            </div>
            <div className="mt-2 font-semibold" style={{ color: NAVY }}>
              PayNow to UEN
            </div>
            <div className="text-gray-700">{COMPANY.uen}</div>
            <div className="text-gray-700">({COMPANY.legalName})</div>
            <div className="mt-3 text-xs text-gray-600">
              Terms: {COMPANY.paymentTerms}
            </div>
          </div>
          <img
            src={COMPANY.paynowQrSrc}
            alt="PayNow QR code"
            className="h-32 w-32 object-contain"
          />
        </div>

        {/* Footer */}
        <div className="mt-auto pt-10 text-center text-[10px] italic text-gray-500">
          {COMPANY.footerLine}
        </div>
      </div>
    </div>
  );
}
