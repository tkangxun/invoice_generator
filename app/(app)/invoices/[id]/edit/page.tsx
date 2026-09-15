import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { canAccessInvoice, membersWhere, requireUser } from "@/lib/session";
import { InvoiceForm } from "@/components/InvoiceForm";
import { toDateInput } from "@/lib/money";
import { ITEM_ORDER_BY } from "@/lib/item-order";
import { decorateItems, listItemTypes } from "@/lib/item-types";

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
  if (!canAccessInvoice(user, invoice)) notFound();
  if (invoice.status === "VOIDED") notFound();

  const lineItemIds = invoice.lines
    .map((line) => line.itemId)
    .filter((itemId): itemId is string => Boolean(itemId));

  const [items, salespeople, types] = await Promise.all([
    prisma.item.findMany({
      where: {
        OR: [
          { companyId: user.companyId, active: true },
          ...(lineItemIds.length ? [{ id: { in: lineItemIds } }] : []),
        ],
      },
      orderBy: ITEM_ORDER_BY,
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
          where: membersWhere(user.companyId),
          orderBy: { name: "asc" },
          select: { id: true, name: true, active: true },
        })
      : Promise.resolve(undefined),
    listItemTypes(user.companyId),
  ]);

  return (
    <div>
      <Link href={`/invoices/${invoice.id}`} className="text-sm text-blue-600 hover:underline">
        ← Back to {invoice.number}
      </Link>
      <h1 className="mt-3 text-xl font-bold">Edit {invoice.number}</h1>
      <div className="mt-6">
        <InvoiceForm
          items={decorateItems(items, types)}
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
