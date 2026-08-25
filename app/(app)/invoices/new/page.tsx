import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { InvoiceForm } from "@/components/InvoiceForm";
import { getCompany, listCompanyProfiles } from "@/lib/company";

export default async function NewInvoicePage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const [items, salespeople, profiles, company] = await Promise.all([
    prisma.item.findMany({
      where: { active: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, priceCents: true, type: true, includes: true },
    }),
    isAdmin
      ? prisma.user.findMany({
          where: { active: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, active: true },
        })
      : Promise.resolve(undefined),
    isAdmin ? listCompanyProfiles() : Promise.resolve(undefined),
    getCompany(),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold">New Invoice</h1>
      <div className="mt-6">
        <InvoiceForm
          items={items}
          salespeople={salespeople}
          currentUserId={user.userId}
          profiles={profiles}
          mainProfileName={company.name}
        />
      </div>
    </div>
  );
}
