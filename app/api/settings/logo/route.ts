import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getCompanyRow } from "@/lib/company";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return new NextResponse(null, { status: 404 });
  const allowed =
    id === user.companyId ||
    (await prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId: user.userId, companyId: id } },
    }));
  if (!allowed) return new NextResponse(null, { status: 404 });
  const row = await getCompanyRow(id);
  if (!row?.logoBytes?.length) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(Buffer.from(row.logoBytes), {
    headers: {
      "Content-Type": row.logoMime || "image/png",
      "Cache-Control": "private, no-store",
    },
  });
}
