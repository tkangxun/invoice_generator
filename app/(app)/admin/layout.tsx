import Link from "next/link";
import { requireAdmin } from "@/lib/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin"
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
        >
          Settings
        </Link>
        <Link
          href="/admin/invoice-settings"
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
        >
          Invoice
        </Link>
        <Link
          href="/admin/items"
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
        >
          Price List
        </Link>
        <Link
          href="/admin/users"
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
        >
          Users
        </Link>
        <Link
          href="/receipts"
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
        >
          Receipts
        </Link>
      </div>
      {children}
    </div>
  );
}
