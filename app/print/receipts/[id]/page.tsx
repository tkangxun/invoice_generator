/* eslint-disable @next/next/no-img-element */
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatCents, formatDate } from "@/lib/money";
import { getCompany } from "@/lib/company";
import { PrintButton } from "@/components/PrintButton";
import { isFollowUpInvoiceNumber } from "@/lib/docs";
import {
  supplementCollectionNote,
  supplementCreditSummary,
} from "@/lib/supplements";

const NAVY = "#1f3864";
const GREEN = "#4e7f5e";

export default async function PrintReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      invoice: { include: { lines: { include: { item: { select: { type: true } } } } } },
      recordedBy: { select: { name: true } },
    },
  });
  if (!receipt) notFound();
  if (user.role !== "ADMIN" && receipt.invoice.userId !== user.userId)
    notFound();
  if (isFollowUpInvoiceNumber(receipt.number)) {
    redirect(`/print/follow-up/${receipt.id}`);
  }

  const invoice = receipt.invoice;
  const creditNotes = supplementCreditSummary(invoice.lines);
  const company = await getCompany(invoice.profileId);

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
              RECEIPT
            </div>
            <div className="mt-1 text-sm text-gray-700">{receipt.number}</div>
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
              Received From
            </div>
            <div className="mt-1 font-semibold" style={{ color: NAVY }}>
              {invoice.customerName}
            </div>
            {invoice.customerAddress && (
              <div className="text-gray-700">{invoice.customerAddress}</div>
            )}
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: NAVY }}>
              Date Paid
            </div>
            <div className="mt-1 text-gray-700">{formatDate(receipt.paidAt)}</div>
            <div className="mt-3 text-xs font-bold uppercase tracking-wide" style={{ color: NAVY }}>
              Invoice Ref
            </div>
            <div className="mt-1 text-gray-700">{invoice.number}</div>
          </div>
        </div>

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
              <span className="font-bold">TOTAL</span>
              <span className="text-lg font-bold" style={{ color: NAVY }}>
                {formatCents(invoice.totalCents)}
              </span>
            </div>
            <div className="flex items-center justify-between px-3 py-1">
              <span className="font-bold" style={{ color: GREEN }}>
                Amount Paid
              </span>
              <span className="font-bold" style={{ color: GREEN }}>
                {formatCents(receipt.amountCents)}
              </span>
            </div>
          </div>
        </div>

        {(receipt.notes || receipt.paidAt || creditNotes.length > 0) && (
          <div className="mt-10 text-sm">
            {creditNotes.length > 0 && (
              <div className="mb-3 text-gray-700">
                <div className="font-semibold">Supplements held as credit</div>
                <ul className="mt-1 list-disc pl-5">
                  {creditNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
            {receipt.notes && (
              <div className="text-gray-700">Ref: {receipt.notes}</div>
            )}
            <div className="text-xs italic text-gray-600">
              Received on {formatDate(receipt.paidAt)}
            </div>
          </div>
        )}

        <div className="mt-auto pt-10 text-center text-[10px] italic text-gray-500">
          {company.footerLine}
        </div>
      </div>
    </div>
  );
}
