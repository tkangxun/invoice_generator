import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { toCsv } from "@/lib/csv";
import { splitPaymentsForReceipt } from "@/lib/docs";
import {
  parseReceiptsExportScope,
  receiptsExportFilename,
  receiptsPaidAtWhere,
} from "@/lib/sales-period";

function formatItemsSold(
  lines: { description: string; qty: number }[]
): string {
  return lines
    .map((line) => {
      const qty = Number.isInteger(line.qty) ? String(line.qty) : String(line.qty);
      return `${line.description} x${qty}`;
    })
    .join("; ");
}

function amountSgd(cents: number): string {
  return (cents / 100).toFixed(2);
}

function paidOn(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
}

function joinSplits(values: string[]): string {
  return values.join("; ");
}

export async function GET(request: Request) {
  const admin = await requireAdmin();

  const url = new URL(request.url);
  const scope = parseReceiptsExportScope(
    url.searchParams.get("sales") ?? undefined,
    url.searchParams.get("period") ?? undefined
  );

  const receipts = await prisma.receipt.findMany({
    where: {
      companyId: admin.companyId,
      number: { startsWith: "RCP-" },
      ...receiptsPaidAtWhere(scope),
    },
    orderBy: { paidAt: "desc" },
    include: {
      invoice: {
        select: {
          number: true,
          customerName: true,
          createdBy: { select: { name: true } },
          lines: {
            select: { description: true, qty: true },
            orderBy: { id: "asc" },
          },
          receipts: {
            select: {
              number: true,
              paymentMethod: true,
              amountCents: true,
              paidAt: true,
            },
          },
        },
      },
    },
  });

  const csv = toCsv(
    [
      "Receipt number",
      "Invoice number",
      "Customer",
      "Salesperson",
      "Payment dates",
      "Payment methods",
      "Split amounts (SGD)",
      "Amount (SGD)",
      "Items sold",
      "Notes",
    ],
    receipts.map((receipt) => {
      const splits = splitPaymentsForReceipt(
        receipt.number,
        receipt.invoice.receipts
      );
      return [
        receipt.number,
        receipt.invoice.number,
        receipt.invoice.customerName,
        receipt.invoice.createdBy.name,
        joinSplits(splits.map((split) => paidOn(split.paidAt))),
        joinSplits(splits.map((split) => split.paymentMethod)),
        joinSplits(splits.map((split) => amountSgd(split.amountCents))),
        amountSgd(receipt.amountCents),
        formatItemsSold(receipt.invoice.lines),
        receipt.notes,
      ];
    })
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${receiptsExportFilename(scope)}"`,
    },
  });
}
