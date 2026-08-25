import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { paidCents } from "@/lib/payments";
import { isFollowUpInvoiceNumber, isReceiptNumber } from "@/lib/docs";
import { PaymentEditForm } from "@/components/PaymentEditForm";
import { toDateInput } from "@/lib/money";
import { getActivePaymentMethods } from "@/lib/payment-methods";

export default async function EditPaymentPage({
  params,
}: {
  params: Promise<{ id: string; rid: string }>;
}) {
  const { id, rid } = await params;
  const user = await requireUser();

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { receipts: true },
  });
  if (!invoice) notFound();
  if (user.role !== "ADMIN" && invoice.userId !== user.userId) notFound();
  if (invoice.status === "VOIDED") notFound();

  const payment = invoice.receipts.find((r) => r.id === rid);
  if (!payment) notFound();

  const hasInstallments = invoice.receipts.some((r) =>
    isFollowUpInvoiceNumber(r.number)
  );
  if (isReceiptNumber(payment.number) && hasInstallments) notFound();

  const othersPaid = paidCents(invoice.receipts.filter((r) => r.id !== payment.id));
  const maxAmount = invoice.totalCents - othersPaid;
  const methods = await getActivePaymentMethods();

  return (
    <div>
      <Link
        href={`/invoices/${invoice.id}`}
        className="text-sm text-blue-600 hover:underline"
      >
        ← Back to {invoice.number}
      </Link>
      <h1 className="mt-3 text-xl font-bold">Edit payment</h1>
      <div className="mt-6">
        <PaymentEditForm
          payment={{
            id: payment.id,
            number: payment.number,
            amountCents: payment.amountCents,
            paymentMethod: payment.paymentMethod,
            notes: payment.notes,
            paidAt: toDateInput(payment.paidAt),
          }}
          maxAmount={maxAmount}
          methods={methods}
        />
      </div>
    </div>
  );
}
