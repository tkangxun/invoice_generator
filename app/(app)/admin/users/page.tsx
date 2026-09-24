import Link from "next/link";
import { createAccount } from "@/lib/account";
import { prisma } from "@/lib/db";
import { membersWhere, requireAdmin } from "@/lib/session";
import {
  createUser,
  deleteUser,
  toggleUserActive,
  resetUserPassword,
} from "@/lib/actions/admin";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

const inputCls =
  "w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none";

const USER_STATUS_FILTERS = [
  { value: "", label: "All users" },
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
] as const;

type UserStatusFilter = (typeof USER_STATUS_FILTERS)[number]["value"];

function parseUserStatus(value?: string): UserStatusFilter {
  return USER_STATUS_FILTERS.some((option) => option.value === value)
    ? (value as UserStatusFilter)
    : "";
}

function usersHref(opts: { status?: string; error?: string } = {}) {
  const search = new URLSearchParams();
  if (opts.status === "active" || opts.status === "disabled") {
    search.set("status", opts.status);
  }
  if (opts.error) search.set("error", opts.error);
  const qs = search.toString();
  return qs ? `/admin/users?${qs}` : "/admin/users";
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string; added?: string }>;
}) {
  const user = await requireAdmin();
  const { error, status: statusParam, added } = await searchParams;
  const statusFilter = parseUserStatus(statusParam);
  const seats = await createAccount(prisma).seatsFor(user.userId);

  const users = await prisma.user.findMany({
    where: {
      ...membersWhere(user.companyId),
      ...(statusFilter === "active"
        ? { active: true }
        : statusFilter === "disabled"
          ? { active: false }
          : {}),
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          invoices: { where: { companyId: user.companyId } },
          memberships: true,
        },
      },
    },
  });

  return (
    <div>
      <h1 className="text-xl font-bold">Users</h1>
      <p className="mt-1 text-sm text-gray-500">
        Disabled users can&apos;t log in; their invoices and receipts are kept.
        Users with invoices or receipts can be disabled, not deleted. Salespeople
        belong to this company only. Admins can be added to more companies.
      </p>
      {seats.ok && !("exempt" in seats) ? (
        <p className="mt-2 text-sm text-gray-600">
          Seats: {seats.used} used of {seats.purchased} purchased ({seats.free}{" "}
          free).
        </p>
      ) : null}

      <div className="mt-6 flex overflow-hidden rounded-lg border border-gray-200 w-fit">
        {USER_STATUS_FILTERS.map((option) => {
          const active = statusFilter === option.value;
          return (
            <Link
              key={option.value || "all"}
              href={usersHref({ status: option.value })}
              className={`px-3 py-1.5 text-sm font-semibold ${
                active
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {option.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Add user</h2>
        {error === "email-exists" && (
          <p className="mt-2 text-sm text-red-600">
            A user with that email already exists.
          </p>
        )}
        {error === "sales-other-company" && (
          <p className="mt-2 text-sm text-red-600">
            That salesperson already belongs to another company.
          </p>
        )}
        {error === "seats-full" && (
          <p className="mt-2 text-sm text-red-600">
            The seats are full. Ask the main admin to buy another pack.
          </p>
        )}
        {error === "main-admin" && (
          <p className="mt-2 text-sm text-red-600">
            The main admin cannot be disabled or removed.
          </p>
        )}
        {added && (
          <p className="mt-2 text-sm text-green-700">
            That account was added to this company.
          </p>
        )}
        {error === "invalid" && (
          <p className="mt-2 text-sm text-red-600">
            Please fill in all fields (password at least 6 characters).
          </p>
        )}
        <form
          action={createUser}
          className="mt-3 grid grid-cols-1 items-end gap-3 sm:grid-cols-12"
        >
          <label className="block text-xs font-medium text-gray-500 sm:col-span-3">
            Name *
            <input name="name" required className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block text-xs font-medium text-gray-500 sm:col-span-3">
            Email *
            <input name="email" type="email" required className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block text-xs font-medium text-gray-500 sm:col-span-3">
            Password * (min 6 chars)
            <input
              name="password"
              type="text"
              required
              minLength={6}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block text-xs font-medium text-gray-500 sm:col-span-2">
            Role
            <select name="role" className={`mt-1 ${inputCls}`}>
              <option value="SALES">Sales</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <div className="sm:col-span-1">
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        </form>
      </div>

      {(error === "has-records" || error === "self") && (
        <p className="mt-6 text-sm text-red-600">
          {error === "has-records"
            ? "That user has invoices or receipts, so they can't be deleted. Disable them instead."
            : "You can't delete your own account."}
        </p>
      )}

      <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Invoices</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-gray-100">
                <td className="px-5 py-3 font-medium">
                  {u.name}
                  {u.id === user.userId && (
                    <span className="ml-2 text-xs text-gray-400">(you)</span>
                  )}
                  {u.isMainAdmin && (
                    <span className="ml-2 text-xs text-gray-400">(main admin)</span>
                  )}
                </td>
                <td className="px-5 py-3">{u.email}</td>
                <td className="px-5 py-3">{u.role}</td>
                <td className="px-5 py-3">{u._count.invoices}</td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      u.active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {u.active ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <form
                      action={resetUserPassword.bind(null, u.id)}
                      className="flex items-center gap-1"
                    >
                      <input
                        name="password"
                        type="text"
                        minLength={6}
                        required
                        placeholder="New password"
                        className="w-32 rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-gray-50"
                      >
                        Reset
                      </button>
                    </form>
                    {u.id !== user.userId && !u.isMainAdmin && (
                      <>
                        <form action={toggleUserActive.bind(null, u.id)}>
                          <button
                            type="submit"
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                              u.active
                                ? "border-red-200 text-red-600 hover:bg-red-50"
                                : "border-green-200 text-green-700 hover:bg-green-50"
                            }`}
                          >
                            {u.active ? "Disable" : "Enable"}
                          </button>
                        </form>
                        <form action={deleteUser.bind(null, u.id)}>
                          {statusFilter && (
                            <input
                              type="hidden"
                              name="status"
                              value={statusFilter}
                            />
                          )}
                          <ConfirmSubmitButton
                            confirmMessage={
                              u.role === "ADMIN" && u._count.memberships > 1
                                ? `Remove ${u.name} from this company? They will keep access to their other companies.`
                                : `Permanently delete ${u.name}? They must have no invoices or receipts. This cannot be undone.`
                            }
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            {u.role === "ADMIN" && u._count.memberships > 1
                              ? "Remove"
                              : "Delete"}
                          </ConfirmSubmitButton>
                        </form>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-8 text-center text-gray-500"
                >
                  No users match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
