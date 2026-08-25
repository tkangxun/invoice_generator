import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatCents, formatDateShort } from "@/lib/money";
import { remainingCents } from "@/lib/payments";
import {
  INVOICE_STATUS_FILTERS,
  invoiceIssuedAtWhere,
  invoiceListHref,
  invoiceProfileWhere,
  invoiceSearchWhere,
  invoiceStatusWhere,
  matchesInvoiceQuery,
  parseInvoiceDir,
  parseInvoiceMonth,
  parseInvoiceProfile,
  parseInvoiceSort,
  parseInvoiceStatus,
  sortInvoices,
  usesInvoiceRecentWindow,
} from "@/lib/invoice-list";
import { recentTwoMonthsLabel } from "@/lib/sales-period";
import { VOID_REASONS, parseVoidReason } from "@/lib/void-reasons";
import { InvoiceListTable } from "@/components/InvoiceListTable";
import { ProfileFilterBar } from "@/components/ProfileFilterBar";
import { listCompanyProfiles } from "@/lib/company";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    month?: string;
    salesperson?: string;
    voidReason?: string;
    profile?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const {
    status: statusParam,
    q = "",
    month: monthParam,
    salesperson: salespersonParam,
    voidReason: voidReasonParam,
    profile: profileParam,
    sort: sortParam,
    dir: dirParam,
  } = await searchParams;
  const statusFilter = parseInvoiceStatus(statusParam);
  const unpaidOnly = statusFilter === "unpaid";
  const sort = parseInvoiceSort(sortParam);
  const dir = parseInvoiceDir(dirParam);
  const query = q.trim();
  const month = parseInvoiceMonth(monthParam);
  const statusWhere = invoiceStatusWhere(statusFilter);
  const salesperson = isAdmin ? salespersonParam?.trim() || "" : "";
  const voidReason = isAdmin ? parseVoidReason(voidReasonParam) : "";
  const recentWindow = usesInvoiceRecentWindow({
    query,
    month,
    status: statusFilter,
  });

  const profiles = isAdmin ? await listCompanyProfiles() : [];
  const profile = isAdmin
    ? parseInvoiceProfile(profileParam, profiles)
    : "";
  const profileWhere = invoiceProfileWhere(profile);

  const where: Prisma.InvoiceWhereInput = {
    ...(isAdmin
      ? salesperson
        ? { userId: salesperson }
        : {}
      : { userId: user.userId }),
    ...(voidReason
      ? { status: "VOIDED", voidReason }
      : statusWhere ?? {}),
    ...(profileWhere ?? {}),
  };
  const scoped = [
    invoiceIssuedAtWhere({ query, month, status: statusFilter }),
    invoiceSearchWhere(query),
  ].filter(Boolean) as Prisma.InvoiceWhereInput[];
  if (scoped.length) where.AND = scoped;

  const [invoices, salespeople] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        createdBy: { select: { name: true } },
        receipts: { select: { number: true, amountCents: true } },
        profile: { select: { name: true } },
      },
    }),
    isAdmin
      ? prisma.user.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true, active: true },
        })
      : Promise.resolve([]),
  ]);

  const visible = sortInvoices(
    invoices.filter((inv) => matchesInvoiceQuery(inv, query)),
    sort,
    dir
  );

  const columns = [
    { key: "number" as const, label: "Number" },
    { key: "customer" as const, label: "Customer" },
    ...(isAdmin
      ? [{ key: "salesperson" as const, label: "Salesperson" }]
      : []),
    { key: "date" as const, label: "Date" },
    { key: "total" as const, label: "Total", align: "right" as const },
    { key: "balance" as const, label: "Balance", align: "right" as const },
    { key: "status" as const, label: "Status" },
  ].map((col) => {
    const active = sort === col.key;
    const nextDir = active && dir === "asc" ? "desc" : "asc";
    return {
      key: col.key,
      label: col.label,
      align: col.align,
      active,
      dir: (active ? dir : "asc") as "asc" | "desc",
      href: invoiceListHref({
        status: statusFilter || undefined,
        q: query,
        month,
        salesperson,
        voidReason,
        profile,
        sort: col.key,
        dir: active ? nextDir : "asc",
      }),
    };
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">
            {unpaidOnly ? "Unpaid invoices" : "Invoices"}
          </h1>
          {unpaidOnly ? (
            <p className="mt-1 text-sm text-gray-500">
              Unpaid and partially paid.{" "}
              <Link
                href={invoiceListHref({
                  q: query,
                  month,
                  salesperson,
                  voidReason,
                  profile,
                  sort,
                  dir,
                })}
                className="text-blue-600 hover:underline"
              >
                View all invoices
              </Link>
            </p>
          ) : recentWindow ? (
            <p className="mt-1 text-sm text-gray-500">
              Showing {recentTwoMonthsLabel()}, plus any still unpaid.
              Search or pick a month to open older paid invoices.
            </p>
          ) : null}
        </div>
        <Link
          href="/invoices/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + New Invoice
        </Link>
      </div>

      {isAdmin && (
        <ProfileFilterBar
          profiles={profiles}
          profile={profile}
          description="Show invoices created with a branding profile."
          hrefFor={(next) =>
            invoiceListHref({
              status: statusFilter || undefined,
              q: query,
              month,
              salesperson,
              voidReason,
              profile: next,
              sort,
              dir,
            })
          }
        />
      )}

      <form
        action="/invoices"
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        {sort !== "date" && <input type="hidden" name="sort" value={sort} />}
        {dir !== "desc" && <input type="hidden" name="dir" value={dir} />}
        {profile && <input type="hidden" name="profile" value={profile} />}
        <label className="min-w-[16rem] flex-1 text-sm font-medium text-gray-700">
          Search
          <input
            name="q"
            defaultValue={query}
            placeholder="Number, customer…"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
        {isAdmin && (
          <label className="text-sm font-medium text-gray-700">
            Salesperson
            <select
              name="salesperson"
              defaultValue={salesperson}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">All salespeople</option>
              {salespeople.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                  {!person.active ? " (disabled)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        {isAdmin && (
          <label className="text-sm font-medium text-gray-700">
            Filter by void reason
            <select
              name="voidReason"
              defaultValue={voidReason}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">All void reasons</option>
              {VOID_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm font-medium text-gray-700">
          Status
          <select
            name="status"
            defaultValue={statusFilter}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            {INVOICE_STATUS_FILTERS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          Month
          <input
            type="month"
            name="month"
            defaultValue={month}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50"
        >
          Apply
        </button>
        {(query || month || statusFilter || salesperson || voidReason || profile) && (
          <Link
            href={invoiceListHref({ sort, dir })}
            className="px-2 py-2 text-sm text-blue-600 hover:underline"
          >
            Clear
          </Link>
        )}
      </form>

      <div className="mt-4 rounded-xl border border-gray-200 bg-white shadow-sm">
        {visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">
            {query || month || statusFilter || salesperson || voidReason || profile
              ? "No invoices match your filters."
              : recentWindow
                ? `No invoices in ${recentTwoMonthsLabel()}.`
                : "No invoices yet."}
          </p>
        ) : (
          <InvoiceListTable
            isAdmin={isAdmin}
            columns={columns}
            invoices={visible.map((inv) => {
              const balance = remainingCents(inv.totalCents, inv.receipts);
              return {
                id: inv.id,
                number: inv.number,
                customerName: inv.customerName,
                salesperson: isAdmin ? inv.createdBy.name : undefined,
                issuedAtLabel: formatDateShort(inv.issuedAt),
                totalLabel: formatCents(inv.totalCents),
                balanceLabel:
                  inv.status === "VOIDED" || balance <= 0
                    ? "—"
                    : formatCents(balance),
                status: inv.status,
                voidReason: inv.voidReason,
              };
            })}
          />
        )}
      </div>
    </div>
  );
}
