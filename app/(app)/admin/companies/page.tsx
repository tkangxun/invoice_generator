import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { grantAdmin, revokeAdmin } from "@/lib/actions/admin";
import { CreateCompanyForm } from "@/components/CreateCompanyForm";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { HeldCompaniesCard } from "@/components/HeldCompaniesCard";

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; deleted?: string }>;
}) {
  const admin = await requireAdmin();
  const { error, created, deleted } = await searchParams;

  const [held, admins] = await Promise.all([
    prisma.companyMembership.findMany({
      where: {
        userId: admin.userId,
        company: { accountId: admin.accountId },
      },
      orderBy: { company: { name: "asc" } },
      select: {
        company: {
          select: {
            id: true,
            code: true,
            name: true,
            _count: { select: { invoices: true, receipts: true } },
          },
        },
      },
    }),
    prisma.companyMembership.findMany({
      where: { companyId: admin.companyId, user: { role: "ADMIN" } },
      orderBy: { user: { name: "asc" } },
      select: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold">Companies</h1>
      <p className="mt-1 text-sm text-gray-500">
        You are signed in to{" "}
        <span className="font-medium text-gray-700">
          {admin.companyName} ({admin.companyCode})
        </span>
        . Switch company from the menu in the header. New companies start with
        this letterhead and a sample gym price list. Tick the box to copy this
        company’s price list instead.
      </p>

      {created && (
        <p className="mt-4 text-sm text-green-700">
          Created company <span className="font-medium">{created}</span>. Switch
          to it from the company menu in the header.
        </p>
      )}
      {error === "admin-not-found" && (
        <p className="mt-4 text-sm text-red-600">
          That email is not an admin account.
        </p>
      )}
      {error === "last-admin" && (
        <p className="mt-4 text-sm text-red-600">
          Keep at least one admin on this company.
        </p>
      )}
      {error === "self" && (
        <p className="mt-4 text-sm text-red-600">
          You can&apos;t remove yourself from this company here.
        </p>
      )}
      {error === "invalid" && (
        <p className="mt-4 text-sm text-red-600">Enter an admin email.</p>
      )}

      <HeldCompaniesCard
        companies={held.map(({ company }) => ({
          id: company.id,
          code: company.code,
          name: company.name,
          invoiceCount: company._count.invoices,
          receiptCount: company._count.receipts,
        }))}
        currentCompanyId={admin.companyId}
        error={error}
        deleted={Boolean(deleted)}
      />

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Create company</h2>
        <CreateCompanyForm />
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Admins on this company</h2>
        <form action={grantAdmin} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-[16rem] flex-1 text-sm font-medium text-gray-700">
            Add existing admin by email
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Grant access
          </button>
        </form>
        <ul className="mt-4 divide-y divide-gray-100">
          {admins.map(({ user }) => (
            <li
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <div>
                <span className="font-medium">{user.name}</span>
                <span className="ml-2 text-sm text-gray-500">{user.email}</span>
                {user.id === admin.userId && (
                  <span className="ml-2 text-xs text-gray-400">(you)</span>
                )}
              </div>
              {user.id !== admin.userId && (
                <form action={revokeAdmin.bind(null, user.id)}>
                  <ConfirmSubmitButton
                    confirmMessage={`Remove ${user.name} from ${admin.companyName}?`}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </ConfirmSubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
