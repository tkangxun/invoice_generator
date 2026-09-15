import { prisma } from "@/lib/db";
import { membersWhere, requireUser } from "@/lib/session";
import { InvoiceForm } from "@/components/InvoiceForm";
import { getCompany } from "@/lib/company";
import { ITEM_ORDER_BY } from "@/lib/item-order";

export default async function NewInvoicePage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const [items, salespeople, company] = await Promise.all([
    prisma.item.findMany({
      where: { companyId: user.companyId, active: true },
      orderBy: ITEM_ORDER_BY,
      select: { id: true, name: true, priceCents: true, type: true, includes: true },
    }),
    isAdmin
      ? prisma.user.findMany({
          where: { active: true, ...membersWhere(user.companyId) },
          orderBy: { name: "asc" },
          select: { id: true, name: true, active: true },
        })
      : Promise.resolve(undefined),
    getCompany(user.companyId),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold">New Invoice</h1>
      <div className="mt-6">
        <InvoiceForm
          items={items}
          salespeople={salespeople}
          currentUserId={user.userId}
          companyName={company.name}
        />
      </div>
    </div>
  );
}
