import { Prisma } from "@prisma/client";
import { todayDateInput } from "@/lib/money";

// Generates sequential document numbers like INV-2026-0001 / RCP-2026-0001.
// Must be called inside a prisma transaction so numbers are never duplicated.
export async function nextDocNumber(
  tx: Prisma.TransactionClient,
  prefix: "INV" | "RCP",
  companyId: string
): Promise<string> {
  const year = Number(todayDateInput().slice(0, 4));
  const key = `${companyId}:${prefix}-${year}`;
  const counter = await tx.counter.upsert({
    where: { id: key },
    create: { id: key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${year}-${String(counter.value).padStart(4, "0")}`;
}

// Partial-payment receipts keep the original invoice number and add -a, -b, -c…
export function nextPaymentLabel(
  invoiceNumber: string,
  existingNumbers: string[]
): string {
  const prefix = `${invoiceNumber}-`;
  const used = new Set(
    existingNumbers
      .filter((n) => n.startsWith(prefix))
      .map((n) => n.slice(prefix.length))
  );
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(97 + i);
    if (!used.has(letter)) return `${prefix}${letter}`;
  }
  throw new Error("Too many payments on this invoice.");
}
