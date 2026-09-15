import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { canAccessInvoice, requireUser } from "@/lib/session";
import { formatCents, formatDateShort } from "@/lib/money";
import { deleteVoidedInvoice } from "@/lib/actions/invoices";
import { VoidInvoiceForm } from "@/components/VoidInvoiceForm";
import { deleteReceipt } from "@/lib/actions/admin";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { RecordPaymentForm } from "@/components/RecordPaymentForm";
import { paidCents, remainingCents } from "@/lib/payments";
import {
  isFollowUpInvoiceNumber,
  isReceiptNumber,
  settlementReceipt,
} from "@/lib/docs";
import {
  supplementCollectionNote,
  supplementCreditSummary,
} from "@/lib/supplements";
import { getActivePaymentMethods } from "@/lib/payment-methods";
import { collectionCatalog } from "@/lib/item-types";

export default async function InvoiceDetailPage({
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
      receipts: { orderBy: { paidAt: "asc" } },
      createdBy: { select: { name: true } },
    },
  });
  if (!invoice) notFound();
  if (!canAccessInvoice(user, invoice)) notFound();

  const visibleTo =
    user.role === "ADMIN"
      ? { companyId: user.companyId }
      : { companyId: user.companyId, userId: user.userId };
  const [previousInvoice, nextInvoice, paymentMethods, catalog] = await Promise.all([
    prisma.invoice.findFirst({
      where: { ...visibleTo, number: { lt: invoice.number } },
      orderBy: { number: "desc" },
      select: { id: true, number: true },
    }),
    prisma.invoice.findFirst({
      where: { ...visibleTo, number: { gt: invoice.number } },
      orderBy: { number: "asc" },
      select: { id: true, number: true },
    }),
    getActivePaymentMethods(user.companyId),
    collectionCatalog(invoice.companyId),
  ]);

  const paid = paidCents(invoice.receipts);
  const due = remainingCents(invoice.totalCents, invoice.receipts);
  const receiptDoc = settlementReceipt(invoice.receipts);
  const creditNotes = supplementCreditSummary(
    invoice.lines,
    catalog.slugs,
    catalog.unitFor
  );
  const installments = invoice.receipts.filter((r) =>
    isFollowUpInvoiceNumber(r.number)
  );
  const paymentDocs =
    installments.length > 0
      ? [
          ...(receiptDoc && due === 0 ? [receiptDoc] : []),
          ...installments,
        ]
      : invoice.receipts.filter((r) => isReceiptNumber(r.number));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4 text-sm">
        {previousInvoice ? (
          <Link
            href={`/invoices/${previousInvoice.id}`}
            className="text-blue-700 hover:underline"
          >
            ← {previousInvoice.number}
          </Link>
        ) : (
          <span className="text-gray-400">No previous invoice</span>
        )}
        {nextInvoice ? (
          <Link
            href={`/invoices/${nextInvoice.id}`}
            className="text-blue-700 hover:underline"
          >
            {nextInvoice.number} →
          </Link>
        ) : (
          <span className="text-gray-400">No following invoice</span>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{invoice.number}</h1>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Issued {formatDateShort(invoice.issuedAt)} by{" "}
            {invoice.createdBy.name} · Due{" "}
            {invoice.dueAt
              ? formatDateShort(invoice.dueAt)
              : "upon receipt"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Company{" "}
            <span className="font-medium text-gray-700">
              {invoice.companyName || user.companyName}
            </span>
          </p>
          {invoice.status === "VOIDED" && invoice.voidReason && (
            <p className="mt-2 text-sm text-red-800">
              Voided
              {invoice.voidedAt
                ? ` ${formatDateShort(invoice.voidedAt)}`
                : ""}
              : {invoice.voidReason}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {invoice.status !== "VOIDED" && (
            <>
              <Link
                href={`/invoices/${invoice.id}/edit`}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                Edit invoice
              </Link>
              <VoidInvoiceForm
                invoiceId={invoice.id}
                invoiceNumber={invoice.number}
              />
            </>
          )}
          {invoice.status === "VOIDED" && user.role === "ADMIN" && (
            <form action={deleteVoidedInvoice.bind(null, invoice.id)}>
              <ConfirmSubmitButton
                confirmMessage={`Permanently delete ${invoice.number}? This cannot be undone.`}
                className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                Delete invoice
              </ConfirmSubmitButton>
            </form>
          )}
          <Link
            href={`/print/invoices/${invoice.id}`}
            target="_blank"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            Print invoice
          </Link>
          {receiptDoc && due === 0 && invoice.status !== "VOIDED" && (
            <Link
              href={`/print/receipts/${receiptDoc.id}`}
              target="_blank"
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              Print receipt
            </Link>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold">Bill to</h2>
            <div className="mt-2 text-sm text-gray-700">
              <div className="font-medium">{invoice.customerName}</div>
              {invoice.customerAddress && <div>{invoice.customerAddress}</div>}
              {invoice.customerPhone && <div>{invoice.customerPhone}</div>}
              {invoice.customerEmail && <div>{invoice.customerEmail}</div>}
            </div>

            <table className="mt-6 w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2 font-medium">Description</th>
                  <th className="py-2 text-right font-medium">Qty</th>
                  <th className="py-2 text-right font-medium">Unit price</th>
                  <th className="py-2 text-right font-medium">Amount</th>
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
                  <tr key={line.id} className="border-b border-gray-100">
                    <td className="py-2.5">
                      <div>{line.description}</div>
                      {collectionNote && (
                        <div className="mt-0.5 text-xs text-amber-800">
                          {collectionNote}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 text-right">{line.qty}</td>
                    <td className="py-2.5 text-right">
                      {formatCents(line.unitPriceCents)}
                    </td>
                    <td className="py-2.5 text-right">
                      {formatCents(line.lineTotalCents)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatCents(invoice.subtotalCents)}</span>
                </div>
                {invoice.discountCents > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Discount</span>
                    <span>-{formatCents(invoice.discountCents)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-1 text-base font-bold">
                  <span>Total</span>
                  <span>{formatCents(invoice.totalCents)}</span>
                </div>
                {paid > 0 && (
                  <>
                    <div className="flex justify-between text-green-700">
                      <span>Paid</span>
                      <span>{formatCents(paid)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Balance</span>
                      <span>{formatCents(due)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {invoice.notes && (
              <p className="mt-4 text-sm text-gray-500">Notes: {invoice.notes}</p>
            )}
            {creditNotes.length > 0 && (
              <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <div className="font-medium">Supplements on credit</div>
                <ul className="mt-1 list-disc pl-5">
                  {creditNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {due > 0 && invoice.status !== "VOIDED" && (
            <RecordPaymentForm
              invoiceId={invoice.id}
              dueCents={due}
              methods={paymentMethods}
            />
          )}

          {paymentDocs.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="font-semibold">Payments</h2>
              <div className="mt-3 space-y-3">
                {paymentDocs.map((r) => {
                  const installmentIndex = installments.findIndex(
                    (p) => p.id === r.id
                  );
                  const paidUpTo =
                    installmentIndex >= 0
                      ? installments
                          .slice(0, installmentIndex + 1)
                          .reduce((sum, p) => sum + p.amountCents, 0)
                      : r.amountCents;
                  const outstanding = Math.max(0, invoice.totalCents - paidUpTo);
                  const followUp = isFollowUpInvoiceNumber(r.number);
                  return (
                  <div
                    key={r.id}
                    className="border-t border-black/5 pt-3 text-sm first:border-t-0 first:pt-0"
                  >
                    <div className="font-medium">{r.number}</div>
                    {followUp ? (
                      <div className="text-base font-semibold">
                        Outstanding {formatCents(outstanding)}
                      </div>
                    ) : (
                      <div className="text-base font-semibold">
                        {formatCents(r.amountCents)}
                      </div>
                    )}
                    <div className="text-gray-600">
                      Amount paid {formatCents(r.amountCents)}
                      {followUp ? ` · ${r.paymentMethod}` : ""}
                    </div>
                    <div className="text-gray-600">
                      {formatDateShort(r.paidAt)}
                      {r.notes ? ` · ${r.notes}` : ""}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link
                        href={
                          followUp
                            ? `/print/follow-up/${r.id}`
                            : `/print/receipts/${r.id}`
                        }
                        target="_blank"
                        className="text-blue-700 hover:underline"
                      >
                        {followUp ? "Print invoice" : "Print receipt"}
                      </Link>
                      {invoice.status !== "VOIDED" &&
                        (followUp || installments.length === 0) && (
                        <Link
                          href={`/invoices/${invoice.id}/payments/${r.id}/edit`}
                          className="text-blue-700 hover:underline"
                        >
                          Edit
                        </Link>
                      )}
                      {user.role === "ADMIN" && (
                        <form action={deleteReceipt.bind(null, r.id)}>
                          <ConfirmSubmitButton
                            confirmMessage={
                              followUp
                                ? `Delete follow-up invoice ${r.number}? The invoice balance will be updated.`
                                : `Delete receipt ${r.number}? The invoice balance will be updated.`
                            }
                            className="text-red-600 hover:underline"
                          >
                            Delete
                          </ConfirmSubmitButton>
                        </form>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
