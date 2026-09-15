import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { grantAdmin, revokeAdmin } from "@/lib/actions/admin";
import { CreateCompanyForm } from "@/components/CreateCompanyForm";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const admin = await requireAdmin();
  const { error, created } = await searchParams;

  const [held, admins] = await Promise.all([
    prisma.companyMembership.findMany({
      where: { userId: admin.userId },
      orderBy: { company: { name: "asc" } },
      select: {
        company: { select: { id: true, code: true, name: true } },
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
        . Log out and use another company ID to switch. New companies start with
        this letterhead; tick the box to copy the price list too.
      </p>

      {created && (
        <p className="mt-4 text-sm text-green-700">
          Created company <span className="font-medium">{created}</span>. Log
          out and sign in with that company ID to open it.
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

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Companies I hold</h2>
        <ul className="mt-3 divide-y divide-gray-100">
          {held.map(({ company }) => (
            <li key={company.id} className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium">{company.name}</div>
                <div className="text-xs text-gray-500">{company.code}</div>
              </div>
              {company.id === admin.companyId && (
                <span className="text-xs font-semibold text-green-700">
                  Current
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

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
