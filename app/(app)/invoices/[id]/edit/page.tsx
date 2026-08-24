import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { InvoiceForm } from "@/components/InvoiceForm";
import { toDateInput } from "@/lib/money";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!invoice) notFound();
  if (user.role !== "ADMIN" && invoice.userId !== user.userId) notFound();
  if (invoice.status === "VOIDED") notFound();

  const lineItemIds = invoice.lines
    .map((line) => line.itemId)
    .filter((itemId): itemId is string => Boolean(itemId));

  const [items, salespeople] = await Promise.all([
    prisma.item.findMany({
      where: {
        OR: [
          { active: true },
          ...(lineItemIds.length ? [{ id: { in: lineItemIds } }] : []),
        ],
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        priceCents: true,
        type: true,
        includes: true,
        active: true,
      },
    }),
    user.role === "ADMIN"
      ? prisma.user.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true, active: true },
        })
      : Promise.resolve(undefined),
  ]);

  return (
    <div>
      <Link href={`/invoices/${invoice.id}`} className="text-sm text-blue-600 hover:underline">
        ← Back to {invoice.number}
      </Link>
      <h1 className="mt-3 text-xl font-bold">Edit {invoice.number}</h1>
      <div className="mt-6">
        <InvoiceForm
          items={items}
          invoice={{
            id: invoice.id,
            number: invoice.number,
            customerName: invoice.customerName,
            customerAddress: invoice.customerAddress,
            customerPhone: invoice.customerPhone,
            customerEmail: invoice.customerEmail,
            notes: invoice.notes,
            discountCents: invoice.discountCents,
            dueAt: toDateInput(invoice.dueAt),
            issuedAt: toDateInput(invoice.issuedAt),
            userId: invoice.userId,
            lines: invoice.lines.map((l) => ({
              itemId: l.itemId,
              description: l.description,
              qty: l.qty,
              unitPriceCents: l.unitPriceCents,
              collectedQty: l.collectedQty,
            })),
          }}
          salespeople={salespeople?.filter(
            (person) => person.active || person.id === invoice.userId
          )}
          currentUserId={user.userId}
        />
      </div>
    </div>
  );
}
