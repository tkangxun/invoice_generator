import { prisma } from "@/lib/db";
import { DEFAULT_PAYMENT_METHODS } from "@/lib/payment-methods";

export type CompanyInfo = {
  id: string;
  name: string;
  active: boolean;
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

export type CompanyProfileSummary = {
  id: string;
  name: string;
  active: boolean;
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
  name: string;
  active: boolean;
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
    name: row.name,
    active: row.active,
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
    name: COMPANY_DEFAULTS.brand,
    active: false,
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
  if (id) {
    const row = await prisma.companySettings.findUnique({ where: { id } });
    if (row) return row;
  }
  return (
    (await prisma.companySettings.findFirst({ where: { active: true } })) ??
    (await prisma.companySettings.findFirst({ orderBy: { name: "asc" } }))
  );
}

export async function getActiveProfileStamp(): Promise<{
  profileId: string | null;
  profileName: string | null;
}> {
  const row = await getCompanyRow();
  if (!row) return { profileId: null, profileName: null };
  return { profileId: row.id, profileName: row.name };
}

export function invoiceProfileLabel(invoice: {
  profileName?: string | null;
  profile?: { name: string } | null;
}): string {
  return invoice.profile?.name || invoice.profileName || "—";
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

export async function listCompanyProfiles(): Promise<CompanyProfileSummary[]> {
  return prisma.companySettings.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, active: true },
  });
}

export async function ensureInvoiceSettings() {
  if ((await prisma.companySettings.count()) === 0) {
    await prisma.companySettings.create({
      data: {
        name: COMPANY_DEFAULTS.brand,
        active: true,
        ...COMPANY_DEFAULTS,
      },
    });
  } else if (
    (await prisma.companySettings.count({ where: { active: true } })) === 0
  ) {
    const first = await prisma.companySettings.findFirst({
      orderBy: { name: "asc" },
      select: { id: true },
    });
    if (first) {
      await prisma.companySettings.update({
        where: { id: first.id },
        data: { active: true },
      });
    }
  }
  if ((await prisma.paymentMethod.count()) === 0) {
    await prisma.paymentMethod.createMany({
      data: DEFAULT_PAYMENT_METHODS.map((name, sortOrder) => ({
        name,
        sortOrder,
      })),
    });
  }
}
