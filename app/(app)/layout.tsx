import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { logout } from "@/lib/actions/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  // Kick out sessions belonging to deleted/disabled accounts
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { active: true },
  });
  if (!dbUser?.active) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link href="/dashboard" className="font-bold text-blue-700">
              Sales Invoicing
            </Link>
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            <Link href="/invoices" className="text-gray-600 hover:text-gray-900">
              Invoices
            </Link>
            <Link href="/receipts" className="text-gray-600 hover:text-gray-900">
              Receipts
            </Link>
            {user.role === "ADMIN" && (
              <Link href="/admin" className="text-gray-600 hover:text-gray-900">
                Settings
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-4">
            <Link
              href="/invoices/new"
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + New Invoice
            </Link>
            <span className="text-sm text-gray-500">{user.name}</span>
            <form action={logout}>
              <button
                type="submit"
                className="text-sm text-gray-500 underline hover:text-gray-900"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
