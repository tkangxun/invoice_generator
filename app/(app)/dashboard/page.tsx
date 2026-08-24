import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatCents, formatDateShort } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";
import { collectedCentsInPeriod, OPEN_INVOICE_STATUSES } from "@/lib/payments";
import {
  canShiftSalesPeriod,
  dashboardHref,
  dateRangeForPeriod,
  parseSalesMode,
  parseSalesPeriod,
  salesPeriodLabel,
  shiftSalesPeriod,
  switchedSalesPeriod,
} from "@/lib/sales-period";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sales?: string; period?: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const where = isAdmin ? {} : { userId: user.userId };
  const { sales: salesParam, period: periodParam } = await searchParams;
  const salesMode = parseSalesMode(salesParam);
  const salesPeriod = parseSalesPeriod(salesMode, periodParam);
  const otherMode = switchedSalesPeriod(salesMode, salesPeriod);
  const prevPeriod = shiftSalesPeriod(salesMode, salesPeriod, -1);
  const nextPeriod = shiftSalesPeriod(salesMode, salesPeriod, 1);
  const canGoNext = canShiftSalesPeriod(salesMode, salesPeriod, 1);

  const collectedWhere = isAdmin ? {} : { invoice: { userId: user.userId } };
  const collectedRange = dateRangeForPeriod(salesMode, salesPeriod);

  const [invoiceCount, unpaidCount, periodHits, recent] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.count({
      where: { ...where, status: { in: [...OPEN_INVOICE_STATUSES] } },
    }),
    prisma.receipt.findMany({
      where: {
        ...collectedWhere,
        paidAt: { gte: collectedRange.start, lt: collectedRange.end },
      },
      select: { invoiceId: true },
    }),
    prisma.invoice.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      take: 8,
      include: { createdBy: { select: { name: true } } },
    }),
  ]);
  const invoiceIds = [...new Set(periodHits.map((hit) => hit.invoiceId))];
  const collectedReceipts = invoiceIds.length
    ? await prisma.receipt.findMany({
        where: { invoiceId: { in: invoiceIds } },
        select: {
          number: true,
          amountCents: true,
          invoiceId: true,
          paidAt: true,
        },
      })
    : [];
  const collected = collectedCentsInPeriod(
    collectedReceipts,
    salesMode,
    salesPeriod
  );

  return (
    <div>
      <h1 className="text-xl font-bold">Welcome, {user.name}</h1>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">
            {isAdmin ? "Total invoices" : "My invoices"}
          </div>
          <div className="mt-1 text-2xl font-bold">{invoiceCount}</div>
        </div>
        <Link
          href="/invoices?status=unpaid"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow"
        >
          <div className="text-sm text-gray-500">Unpaid</div>
          <div className="mt-1 text-2xl font-bold text-blue-700 underline decoration-blue-300 underline-offset-4">
            {unpaidCount}
          </div>
          <div className="mt-1 text-xs text-gray-400">
            Includes unpaid and partially paid
          </div>
        </Link>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm text-gray-500">
              {isAdmin ? "Collected sales" : "My collected sales"}
            </div>
            <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs font-semibold">
              <Link
                href={dashboardHref(
                  "year",
                  salesMode === "year" ? salesPeriod : otherMode.period
                )}
                className={`px-2.5 py-1 ${
                  salesMode === "year"
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Year
              </Link>
              <Link
                href={dashboardHref(
                  "month",
                  salesMode === "month" ? salesPeriod : otherMode.period
                )}
                className={`px-2.5 py-1 ${
                  salesMode === "month"
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Month
              </Link>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2">
            <Link
              href={dashboardHref(salesMode, prevPeriod)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-400 bg-white text-gray-800 shadow-sm hover:border-gray-500 hover:bg-gray-50"
              aria-label="Previous period"
            >
              <ChevronLeft />
            </Link>
            <span className="px-1 text-center text-sm font-medium text-gray-700">
              {salesPeriodLabel(salesMode, salesPeriod)}
            </span>
            {canGoNext ? (
              <Link
                href={dashboardHref(salesMode, nextPeriod)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-400 bg-white text-gray-800 shadow-sm hover:border-gray-500 hover:bg-gray-50"
                aria-label="Next period"
              >
                <ChevronRight />
              </Link>
            ) : (
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-gray-50 text-gray-400"
                aria-hidden
              >
                <ChevronRight />
              </span>
            )}
          </div>
          <div className="mt-1 text-2xl font-bold">{formatCents(collected)}</div>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold">Recent invoices</h2>
          <Link href="/invoices" className="text-sm text-blue-600 hover:underline">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">
            No invoices yet.{" "}
            <Link href="/invoices/new" className="text-blue-600 hover:underline">
              Create your first invoice
            </Link>
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-5 py-2 font-medium">Number</th>
                <th className="px-5 py-2 font-medium">Customer</th>
                {isAdmin && <th className="px-5 py-2 font-medium">Salesperson</th>}
                <th className="px-5 py-2 font-medium">Date</th>
                <th className="px-5 py-2 text-right font-medium">Total</th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((inv) => (
                <tr key={inv.id} className="border-t border-gray-100">
                  <td className="px-5 py-2.5">
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-5 py-2.5">{inv.customerName}</td>
                  {isAdmin && <td className="px-5 py-2.5">{inv.createdBy.name}</td>}
                  <td className="px-5 py-2.5">
                    {formatDateShort(inv.issuedAt)}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {formatCents(inv.totalCents)}
                  </td>
                  <td className="px-5 py-2.5">
                    <StatusBadge status={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 6 9 12l6 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
