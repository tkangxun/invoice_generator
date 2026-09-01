import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { todayDateInput } from "@/lib/money";
import { priceListToCsv } from "@/lib/price-list-csv";
import { ITEM_ORDER_BY } from "@/lib/item-order";

export async function GET() {
  await requireAdmin();

  const items = await prisma.item.findMany({
    orderBy: ITEM_ORDER_BY,
  });

  return new NextResponse(priceListToCsv(items), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="price-list-${todayDateInput()}.csv"`,
    },
  });
}
