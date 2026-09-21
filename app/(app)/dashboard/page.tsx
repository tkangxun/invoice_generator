import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatCents, formatDateShort } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";
import { invoiceListHref } from "@/lib/invoice-list";
import { collectedCentsInPeriod, OPEN_INVOICE_STATUSES } from "@/lib/payments";
import { buildSalespersonRows } from "@/lib/salesperson-rows";
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
  const where = isAdmin
    ? { companyId: user.companyId }
    : { companyId: user.companyId, userId: user.userId };
  const { sales: salesParam, period: periodParam } = await searchParams;
  const salesMode = parseSalesMode(salesParam);
  const salesPeriod = parseSalesPeriod(salesMode, periodParam);
  const otherMode = switchedSalesPeriod(salesMode, salesPeriod);
  const prevPeriod = shiftSalesPeriod(salesMode, salesPeriod, -1);
  const nextPeriod = shiftSalesPeriod(salesMode, salesPeriod, 1);
  const canGoNext = canShiftSalesPeriod(salesMode, salesPeriod, 1);

  const collectedRange = dateRangeForPeriod(salesMode, salesPeriod);
  const collectedInvoice = isAdmin
    ? { status: { not: "VOIDED" as const } }
    : { userId: user.userId, status: { not: "VOIDED" as const } };

  const [invoiceCount, unpaidCount, periodHits, recent, memberships, periodInvoices, sellers] =
    await Promise.all([
      prisma.invoice.count({
        where: {
          ...where,
          issuedAt: { gte: collectedRange.start, lt: collectedRange.end },
        },
      }),
      prisma.invoice.count({
        where: { ...where, status: { in: [...OPEN_INVOICE_STATUSES] } },
      }),
      prisma.receipt.findMany({
        where: {
          companyId: user.companyId,
          invoice: collectedInvoice,
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
      isAdmin
        ? prisma.companyMembership.findMany({
            where: { companyId: user.companyId },
            select: {
              user: {
                select: { id: true, name: true, role: true, active: true },
              },
            },
          })
        : Promise.resolve([]),
      isAdmin
        ? prisma.invoice.findMany({
            where: {
              companyId: user.companyId,
              status: { not: "VOIDED" },
              issuedAt: { gte: collectedRange.start, lt: collectedRange.end },
            },
            select: { userId: true, status: true },
          })
        : Promise.resolve([]),
      isAdmin
        ? prisma.invoice.findMany({
            where: { companyId: user.companyId, status: { not: "VOIDED" } },
            select: { userId: true },
            distinct: ["userId"],
          })
        : Promise.resolve([]),
    ]);
  const invoiceIds = [...new Set(periodHits.map((hit) => hit.invoiceId))];
  const collectedReceipts = invoiceIds.length
    ? await prisma.receipt.findMany({
        where: {
          invoiceId: { in: invoiceIds },
          invoice: { status: { not: "VOIDED" } },
        },
        select: {
          number: true,
          amountCents: true,
          invoiceId: true,
          paidAt: true,
          invoice: { select: { userId: true, status: true } },
        },
      })
    : [];
  const collected = collectedCentsInPeriod(
    collectedReceipts,
    salesMode,
    salesPeriod
  );
  const salespersonRows = isAdmin
    ? buildSalespersonRows({
        members: memberships.map((membership) => ({
          userId: membership.user.id,
          name: membership.user.name,
          role: membership.user.role,
          active: membership.user.active,
        })),
        sellerIds: sellers.map((seller) => seller.userId),
        periodInvoices,
        receipts: collectedReceipts.map((receipt) => ({
          number: receipt.number,
          amountCents: receipt.amountCents,
          invoiceId: receipt.invoiceId,
          paidAt: receipt.paidAt,
          invoiceUserId: receipt.invoice.userId,
          invoiceStatus: receipt.invoice.status,
        })),
        mode: salesMode,
        period: salesPeriod,
      })
    : [];
  const periodLabel = salesPeriodLabel(salesMode, salesPeriod);

  return (
    <div>
      <h1 className="text-xl font-bold">Welcome, {user.name}</h1>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">
            {isAdmin ? "Total invoices" : "My invoices"}
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{invoiceCount}</div>
          <PeriodControls
            salesMode={salesMode}
            salesPeriod={salesPeriod}
            otherPeriod={otherMode.period}
            prevPeriod={prevPeriod}
            nextPeriod={nextPeriod}
            canGoNext={canGoNext}
            periodLabel={periodLabel}
          />
        </div>
        <Link
          href="/invoices?status=unpaid"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow"
        >
          <div className="text-sm text-gray-500">Unpaid</div>
          <div className="mt-1 text-2xl font-bold text-blue-700 tabular-nums underline decoration-blue-300 underline-offset-4">
            {unpaidCount}
          </div>
          <div className="mt-1 text-xs text-gray-400">
            Unpaid and partial, still open
          </div>
        </Link>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">
            {isAdmin ? "Collected sales" : "My collected sales"}
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">
            {formatCents(collected)}
          </div>
          <PeriodControls
            salesMode={salesMode}
            salesPeriod={salesPeriod}
            otherPeriod={otherMode.period}
            prevPeriod={prevPeriod}
            nextPeriod={nextPeriod}
            canGoNext={canGoNext}
            periodLabel={periodLabel}
          />
        </div>
      </div>

      {isAdmin && (
        <div className="mt-8 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="font-semibold">Sales by person</h2>
            <p className="mt-1 text-sm text-gray-700">{periodLabel}</p>
            <p className="mt-1 text-xs text-gray-400">
              Invoices issued in this period, excluding voided. Unpaid means
              those still open.
            </p>
          </div>
          {salespersonRows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500">
              No salespeople to show.
            </p>
          ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="px-5 py-2 font-medium">Salesperson</th>
                      <th className="px-5 py-2 text-right font-medium">Invoices</th>
                      <th className="px-5 py-2 text-right font-medium">Unpaid</th>
                      <th className="px-5 py-2 text-right font-medium">Collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salespersonRows.map((row) => (
                      <tr key={row.userId} className="border-t border-gray-100">
                        <td className="px-5 py-2.5">{row.name}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums">
                          {row.invoiceCount}
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums">
                          <UnpaidCount
                            count={row.unpaidCount}
                            salesMode={salesMode}
                            salesPeriod={salesPeriod}
                            userId={row.userId}
                          />
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums">
                          {formatCents(row.collectedCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          )}
        </div>
      )}

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
          <>
          <ul className="divide-y divide-gray-100 md:hidden">
            {recent.map((inv) => (
              <li key={inv.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {inv.number}
                  </Link>
                  <StatusBadge status={inv.status} />
                </div>
                <div className="mt-1 text-sm text-gray-900">{inv.customerName}</div>
                <div className="mt-1 flex items-center justify-between gap-3 text-sm text-gray-500">
                  <span>
                    {formatDateShort(inv.issuedAt)}
                    {isAdmin ? ` · ${inv.createdBy.name}` : ""}
                  </span>
                  <span className="font-semibold tabular-nums text-gray-900">
                    {formatCents(inv.totalCents)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
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
          </div>
          </>
        )}
      </div>
    </div>
  );
}

function PeriodControls({
  salesMode,
  salesPeriod,
  otherPeriod,
  prevPeriod,
  nextPeriod,
  canGoNext,
  periodLabel,
}: {
  salesMode: "year" | "month";
  salesPeriod: string;
  otherPeriod: string;
  prevPeriod: string;
  nextPeriod: string;
  canGoNext: boolean;
  periodLabel: string;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex self-start overflow-hidden rounded-lg border border-gray-200 text-xs font-semibold">
        <Link
          href={dashboardHref("year", salesMode === "year" ? salesPeriod : otherPeriod)}
          className={`px-3 py-2 ${
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
            salesMode === "month" ? salesPeriod : otherPeriod
          )}
          className={`px-3 py-2 ${
            salesMode === "month"
              ? "bg-gray-900 text-white"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          Month
        </Link>
      </div>
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2">
        <Link
          href={dashboardHref(salesMode, prevPeriod)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-gray-400 bg-white text-gray-800 shadow-sm hover:border-gray-500 hover:bg-gray-50"
          aria-label="Previous period"
        >
          <ChevronLeft />
        </Link>
        <span className="px-1 text-center text-sm font-medium text-gray-700">
          {periodLabel}
        </span>
        {canGoNext ? (
          <Link
            href={dashboardHref(salesMode, nextPeriod)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-gray-400 bg-white text-gray-800 shadow-sm hover:border-gray-500 hover:bg-gray-50"
            aria-label="Next period"
          >
            <ChevronRight />
          </Link>
        ) : (
          <span
            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-gray-300 bg-gray-50 text-gray-400"
            aria-hidden
          >
            <ChevronRight />
          </span>
        )}
      </div>
    </div>
  );
}

function UnpaidCount({
  count,
  salesMode,
  salesPeriod,
  userId,
}: {
  count: number;
  salesMode: "year" | "month";
  salesPeriod: string;
  userId: string;
}) {
  if (salesMode !== "month") return count;
  return (
    <Link
      href={invoiceListHref({
        status: "unpaid",
        month: salesPeriod,
        salesperson: userId,
      })}
      className="text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-800"
    >
      {count}
    </Link>
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
