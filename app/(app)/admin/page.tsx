import Link from "next/link";
import { prisma } from "@/lib/db";
import { membersWhere, requireAdmin } from "@/lib/session";

export default async function AdminSettingsPage() {
  const admin = await requireAdmin();

  const [itemCount, userCount, receiptCount, companyCount] = await Promise.all([
    prisma.item.count({
      where: { companyId: admin.companyId, active: true },
    }),
    prisma.user.count({
      where: { active: true, ...membersWhere(admin.companyId) },
    }),
    prisma.receipt.count({ where: { companyId: admin.companyId } }),
    prisma.companyMembership.count({ where: { userId: admin.userId } }),
  ]);

  const cards = [
    {
      href: "/admin/companies",
      title: "Companies",
      body: "Companies you hold, create a company, and grant other admins.",
      meta: `${companyCount} held · current ${admin.companyCode}`,
    },
    {
      href: "/admin/invoice-settings",
      title: "Invoice",
      body: "Letterhead, logo, UEN, invoice preview, and payment methods for this company.",
      meta: "Printed invoices and receipts",
    },
    {
      href: "/admin/items",
      title: "Price list",
      body: "Add, edit, import, export, or delete items. Changes apply to new invoices only.",
      meta: `${itemCount} active items`,
    },
    {
      href: "/admin/users",
      title: "Users",
      body: "Add salespeople or admins, reset passwords, disable login, or delete unused accounts.",
      meta: `${userCount} active members`,
    },
    {
      href: "/receipts",
      title: "Receipts",
      body: "Delete a receipt to void that payment. The invoice balance is recalculated.",
      meta: `${receiptCount} receipts`,
    },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-gray-500">
        Admin-only for {admin.companyName}. Sales accounts cannot see this page.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow"
          >
            <h2 className="font-semibold">{card.title}</h2>
            <p className="mt-2 text-sm text-gray-600">{card.body}</p>
            <p className="mt-3 text-xs text-gray-400">{card.meta}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
