import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatCents, formatDateShort } from "@/lib/money";
import { deleteReceipt } from "@/lib/actions/admin";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { ProfileFilterBar } from "@/components/ProfileFilterBar";
import { listCompanyProfiles } from "@/lib/company";
import {
  invoiceProfileWhere,
  parseInvoiceProfile,
} from "@/lib/invoice-list";
import {
  currentSalesPeriod,
  parseReceiptsListScope,
  recentTwoMonthsLabel,
  receiptsExportHref,
  receiptsListHref,
  receiptsPaidAtWhere,
  salesPeriodLabel,
  switchedSalesPeriod,
} from "@/lib/sales-period";

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ sales?: string; period?: string; profile?: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const { sales, period: periodParam, profile: profileParam } = await searchParams;
  const scope = parseReceiptsListScope(sales, periodParam);
  const monthPeriod =
    scope.kind === "period" && scope.mode === "month"
      ? scope.period
      : switchedSalesPeriod(
          "year",
          scope.kind === "period" ? scope.period : currentSalesPeriod("year")
        ).period;
  const yearPeriod =
    scope.kind === "period" && scope.mode === "year"
      ? scope.period
      : currentSalesPeriod("year");

  const profiles = isAdmin ? await listCompanyProfiles() : [];
  const profile = isAdmin
    ? parseInvoiceProfile(profileParam, profiles)
    : "";
  const profileWhere = invoiceProfileWhere(profile);

  const receipts = await prisma.receipt.findMany({
    where: {
      number: { startsWith: "RCP-" },
      invoice: {
        ...(isAdmin ? {} : { userId: user.userId }),
        ...(profileWhere ?? {}),
      },
      ...receiptsPaidAtWhere(scope),
    },
    orderBy: { paidAt: "desc" },
    include: {
      invoice: { select: { id: true, number: true, customerName: true } },
      recordedBy: { select: { name: true } },
    },
  });

  const periodLabel =
    scope.kind === "recent"
      ? recentTwoMonthsLabel()
      : scope.kind === "all"
        ? "All time"
        : salesPeriodLabel(scope.mode, scope.period);

  const tabCls = (active: boolean) =>
    `px-3 py-1.5 text-sm font-semibold ${
      active ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
    }`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Receipts</h1>
          <p className="mt-1 text-sm text-gray-500">
            {periodLabel}
            {isAdmin ? " · Export uses this period" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex overflow-hidden rounded-lg border border-gray-200">
            <Link
              href={receiptsListHref({ kind: "recent" }, profile)}
              className={tabCls(scope.kind === "recent")}
            >
              Recent
            </Link>
            <Link
              href={receiptsListHref(
                { mode: "month", period: monthPeriod, kind: "period" },
                profile
              )}
              className={tabCls(scope.kind === "period" && scope.mode === "month")}
            >
              Month
            </Link>
            <Link
              href={receiptsListHref(
                { mode: "year", period: yearPeriod, kind: "period" },
                profile
              )}
              className={tabCls(scope.kind === "period" && scope.mode === "year")}
            >
              Year
            </Link>
            <Link
              href={receiptsListHref({ kind: "all" }, profile)}
              className={tabCls(scope.kind === "all")}
            >
              All time
            </Link>
          </div>
          {scope.kind === "period" && scope.mode === "month" && (
            <form action="/receipts" className="flex items-end gap-2">
              <input type="hidden" name="sales" value="month" />
              {profile && <input type="hidden" name="profile" value={profile} />}
              <label className="text-sm font-medium text-gray-700">
                Month
                <input
                  type="month"
                  name="period"
                  defaultValue={scope.period}
                  max={currentSalesPeriod("month")}
                  className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </label>
              <button
                type="submit"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                Apply
              </button>
            </form>
          )}
          {scope.kind === "period" && scope.mode === "year" && (
            <form action="/receipts" className="flex items-end gap-2">
              <input type="hidden" name="sales" value="year" />
              {profile && <input type="hidden" name="profile" value={profile} />}
              <label className="text-sm font-medium text-gray-700">
                Year
                <input
                  type="number"
                  name="period"
                  defaultValue={scope.period}
                  min="2020"
                  max={currentSalesPeriod("year")}
                  className="mt-1 block w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </label>
              <button
                type="submit"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                Apply
              </button>
            </form>
          )}
          {isAdmin && (
            <a
              href={receiptsExportHref(scope, profile)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              Export CSV
            </a>
          )}
        </div>
      </div>

      {isAdmin && (
        <ProfileFilterBar
          profiles={profiles}
          profile={profile}
          description="Show receipts for invoices created with a branding profile."
          hrefFor={(next) => receiptsListHref(scope, next)}
        />
      )}

      <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
        {receipts.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">
            {profile
              ? "No receipts match your filters."
              : scope.kind === "all"
              ? "No receipts yet. A receipt is issued when an invoice is paid in full."
              : `No receipts in ${periodLabel}.`}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-5 py-3 font-medium">Number</th>
                <th className="px-5 py-3 font-medium">Invoice</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Paid on</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium">{r.number}</td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/invoices/${r.invoice.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {r.invoice.number}
                    </Link>
                  </td>
                  <td className="px-5 py-3">{r.invoice.customerName}</td>
                  <td className="px-5 py-3">
                    {formatDateShort(r.paidAt)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {formatCents(r.amountCents)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/print/receipts/${r.id}`}
                        target="_blank"
                        className="text-blue-600 hover:underline"
                      >
                        Print / PDF
                      </Link>
                      {isAdmin && (
                        <form action={deleteReceipt.bind(null, r.id)}>
                          <ConfirmSubmitButton
                            confirmMessage={`Delete receipt ${r.number}? The balance on ${r.invoice.number} will be updated.`}
                            className="text-red-500 hover:text-red-700 hover:underline"
                          >
                            Delete
                          </ConfirmSubmitButton>
                        </form>
                      )}
                    </div>
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
