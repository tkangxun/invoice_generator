import { prisma } from "@/lib/db";
import { DEFAULT_PAYMENT_METHODS } from "@/lib/payment-methods";

export type CompanyInfo = {
  id: string;
  code: string;
  name: string;
  brand: string;
  tagline: string;
  legalName: string;
  uen: string;
  address: string;
  addressLines: string[];
  paymentTerms: string;
  footerLine: string;
  logoSrc: string | null;
  paynowQrSrc: string | null;
  updatedAt: string;
};

export type CompanySummary = {
  id: string;
  code: string;
  name: string;
};

export const COMPANY_DEFAULTS = {
  brand: "Alpha Vitality",
  tagline: "Personalised Health Optimisation",
  legalName: "Alpha Sales & Marketing",
  uen: "202528313D",
  address: "1557 Keppel Road, #01-01, Singapore\n089066",
  paymentTerms: "Due on receipt",
};

function addressLines(address: string) {
  return address
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function footerLine(legalName: string, uen: string, address: string) {
  const oneLine = addressLines(address).join(", ");
  return `${legalName} | UEN ${uen}${oneLine ? ` | ${oneLine}` : ""}`;
}

type CompanyRow = {
  id: string;
  code: string;
  name: string;
  brand: string;
  tagline: string;
  legalName: string;
  uen: string;
  address: string;
  paymentTerms: string;
  logoBytes: Buffer | Uint8Array | null;
  paynowQrBytes: Buffer | Uint8Array | null;
  updatedAt: Date;
};

export function toCompanyInfo(row: CompanyRow): CompanyInfo {
  const bust = row.updatedAt.getTime();
  const id = encodeURIComponent(row.id);
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    brand: row.brand,
    tagline: row.tagline,
    legalName: row.legalName,
    uen: row.uen,
    address: row.address,
    addressLines: addressLines(row.address),
    paymentTerms: row.paymentTerms,
    footerLine: footerLine(row.legalName, row.uen, row.address),
    logoSrc: row.logoBytes?.length
      ? `/api/settings/logo?id=${id}&v=${bust}`
      : null,
    paynowQrSrc: row.paynowQrBytes?.length
      ? `/api/settings/paynow-qr?id=${id}&v=${bust}`
      : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function defaultCompanyInfo(): CompanyInfo {
  return {
    id: "",
    code: "alpha-vitality",
    name: COMPANY_DEFAULTS.brand,
    ...COMPANY_DEFAULTS,
    addressLines: addressLines(COMPANY_DEFAULTS.address),
    footerLine: footerLine(
      COMPANY_DEFAULTS.legalName,
      COMPANY_DEFAULTS.uen,
      COMPANY_DEFAULTS.address
    ),
    logoSrc: null,
    paynowQrSrc: null,
    updatedAt: new Date(0).toISOString(),
  };
}

export async function getCompanyRow(id?: string | null) {
  if (!id) return null;
  return prisma.company.findUnique({ where: { id } });
}

export async function getCompany(id?: string | null): Promise<CompanyInfo> {
  try {
    const row = await getCompanyRow(id);
    if (!row) return defaultCompanyInfo();
    return toCompanyInfo(row);
  } catch {
    return defaultCompanyInfo();
  }
}

export async function listHeldCompanies(
  userId: string
): Promise<CompanySummary[]> {
  const rows = await prisma.companyMembership.findMany({
    where: { userId },
    orderBy: { company: { name: "asc" } },
    select: {
      company: { select: { id: true, code: true, name: true } },
    },
  });
  return rows.map((row) => row.company);
}

export async function ensureCompanyDefaults(companyId: string) {
  if ((await prisma.paymentMethod.count({ where: { companyId } })) === 0) {
    await prisma.paymentMethod.createMany({
      data: DEFAULT_PAYMENT_METHODS.map((name, sortOrder) => ({
        name,
        sortOrder,
        companyId,
      })),
    });
  }
}

export async function uniqueCompanyName(base: string, excludeId?: string) {
  const trimmed = (base.trim() || "Company").slice(0, 80);
  const existing = await prisma.company.findMany({
    where: excludeId ? { id: { not: excludeId } } : undefined,
    select: { name: true },
  });
  const taken = new Set(existing.map((row) => row.name.toLowerCase()));
  if (!taken.has(trimmed.toLowerCase())) return trimmed;
  let n = 2;
  while (taken.has(`${trimmed} ${n}`.toLowerCase())) n += 1;
  return `${trimmed} ${n}`;
}
