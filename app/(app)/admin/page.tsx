import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export default async function AdminSettingsPage() {
  await requireAdmin();

  const [itemCount, userCount, receiptCount] = await Promise.all([
    prisma.item.count({ where: { active: true } }),
    prisma.user.count({ where: { active: true } }),
    prisma.receipt.count(),
  ]);

  const cards = [
    {
      href: "/admin/invoice-settings",
      title: "Invoice",
      body: "Branding profiles, logo, UEN, invoice preview, and payment methods.",
      meta: "Printed invoices and receipts",
    },
    {
      href: "/admin/items",
      title: "Price list",
      body: "Add, edit, or disable items. Changes apply to new invoices only.",
      meta: `${itemCount} active items`,
    },
    {
      href: "/admin/users",
      title: "Users",
      body: "Add salespeople or admins, reset passwords, disable login, or delete unused accounts.",
      meta: `${userCount} active users`,
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
        Admin-only. Sales accounts cannot see this page.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
