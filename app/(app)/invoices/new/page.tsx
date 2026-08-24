import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { InvoiceForm } from "@/components/InvoiceForm";

export default async function NewInvoicePage() {
  const user = await requireUser();
  const [items, salespeople] = await Promise.all([
    prisma.item.findMany({
      where: { active: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, priceCents: true, type: true, includes: true },
    }),
    user.role === "ADMIN"
      ? prisma.user.findMany({
          where: { active: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, active: true },
        })
      : Promise.resolve(undefined),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold">New Invoice</h1>
      <div className="mt-6">
        <InvoiceForm
          items={items}
          salespeople={salespeople}
          currentUserId={user.userId}
        />
      </div>
    </div>
  );
}
