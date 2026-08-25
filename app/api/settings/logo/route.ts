import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getCompanyRow } from "@/lib/company";

export async function GET(request: NextRequest) {
  await requireUser();
  const id = request.nextUrl.searchParams.get("id");
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
