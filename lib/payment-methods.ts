import { prisma } from "@/lib/db";

export const DEFAULT_PAYMENT_METHODS = [
  "Cash",
  "PayNow",
  "Bank Transfer",
  "Credit Card",
  "Cheque",
];

export async function getActivePaymentMethods(
  companyId: string
): Promise<string[]> {
  try {
    const methods = await prisma.paymentMethod.findMany({
      where: { companyId, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { name: true },
    });
    if (methods.length === 0) return DEFAULT_PAYMENT_METHODS;
    return methods.map((method) => method.name);
  } catch {
    return DEFAULT_PAYMENT_METHODS;
  }
}
