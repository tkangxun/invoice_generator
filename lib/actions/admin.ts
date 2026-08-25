"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { dollarsToCents } from "@/lib/money";
import { paidCents, statusFromPaid } from "@/lib/payments";
import { isFollowUpInvoiceNumber, isReceiptNumber } from "@/lib/docs";
import { COMPANY_DEFAULTS } from "@/lib/company";

// ---------- Price list ----------

export async function createItem(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const price = String(formData.get("price") ?? "");
  const type = String(formData.get("type") ?? "service");
  const includes = String(formData.get("includes") ?? "").trim();
  if (!name || !price) return;

  await prisma.item.create({
    data: {
      name,
      priceCents: dollarsToCents(price),
      type,
      includes: includes || null,
    },
  });
  revalidatePath("/admin/items");
}

export async function updateItem(itemId: string, formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const price = String(formData.get("price") ?? "");
  const type = String(formData.get("type") ?? "service");
  const includes = String(formData.get("includes") ?? "").trim();
  if (!name || !price) return;

  await prisma.item.update({
    where: { id: itemId },
    data: {
      name,
      priceCents: dollarsToCents(price),
      type,
      includes: includes || null,
    },
  });
  revalidatePath("/admin/items");
}

export async function toggleItemActive(itemId: string) {
  await requireAdmin();
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) return;
  await prisma.item.update({
    where: { id: itemId },
    data: { active: !item.active },
  });
  revalidatePath("/admin/items");
}

// ---------- Users ----------

export async function createUser(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "SALES") === "ADMIN" ? "ADMIN" : "SALES";
  if (!name || !email || password.length < 6) {
    redirect("/admin/users?error=invalid");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirect("/admin/users?error=email-exists");
  }

  await prisma.user.create({
    data: { name, email, role, passwordHash: await bcrypt.hash(password, 10) },
  });
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

function adminUsersPath(opts: { status?: string; error?: string } = {}) {
  const search = new URLSearchParams();
  if (opts.status === "active" || opts.status === "disabled") {
    search.set("status", opts.status);
  }
  if (opts.error) search.set("error", opts.error);
  const qs = search.toString();
  return qs ? `/admin/users?${qs}` : "/admin/users";
}

function userListStatus(formData: FormData) {
  const status = String(formData.get("status") ?? "");
  return status === "active" || status === "disabled" ? status : "";
}

export async function toggleUserActive(userId: string) {
  const admin = await requireAdmin();
  if (userId === admin.userId) return; // can't disable yourself
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  await prisma.user.update({
    where: { id: userId },
    data: { active: !user.active },
  });
  revalidatePath("/admin/users");
}

export async function deleteUser(userId: string, formData: FormData) {
  const admin = await requireAdmin();
  const status = userListStatus(formData);
  if (userId === admin.userId) {
    redirect(adminUsersPath({ status, error: "self" }));
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { _count: { select: { invoices: true, receipts: true } } },
  });
  if (!target) return;

  if (target._count.invoices > 0 || target._count.receipts > 0) {
    redirect(adminUsersPath({ status, error: "has-records" }));
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
  redirect(adminUsersPath({ status }));
}

export async function resetUserPassword(userId: string, formData: FormData) {
  await requireAdmin();
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) {
    redirect("/admin/users?error=invalid");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  revalidatePath("/admin/users");
}

// ---------- Receipts ----------

// Deletes a receipt and recalculates the invoice (UNPAID / PARTIAL / PAID).
export async function deleteReceipt(receiptId: string) {
  await requireAdmin();
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: { invoice: { include: { receipts: true } } },
  });
  if (!receipt) return;

  await prisma.$transaction(async (tx) => {
    await tx.receipt.delete({ where: { id: receiptId } });
    let remaining = receipt.invoice.receipts.filter((r) => r.id !== receiptId);
    const paid = paidCents(remaining);
    const stillPaid = paid >= receipt.invoice.totalCents;
    if (
      isFollowUpInvoiceNumber(receipt.number) &&
      !stillPaid
    ) {
      const leftoverReceipts = remaining.filter((r) => isReceiptNumber(r.number));
      if (leftoverReceipts.length > 0) {
        await tx.receipt.deleteMany({
          where: { id: { in: leftoverReceipts.map((r) => r.id) } },
        });
        remaining = remaining.filter((r) => !isReceiptNumber(r.number));
      }
    }
    await tx.invoice.update({
      where: { id: receipt.invoiceId },
      data: {
        status: statusFromPaid(receipt.invoice.totalCents, paidCents(remaining)),
      },
    });
  });
  revalidatePath("/receipts");
  revalidatePath(`/invoices/${receipt.invoiceId}`);
  revalidatePath("/dashboard");
}

const SETTINGS_PATH = "/admin/invoice-settings";
const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

async function readImage(formData: FormData, field: string) {
  const value = formData.get(field);
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > IMAGE_MAX_BYTES) {
    throw new Error("Images must be 2 MB or smaller.");
  }
  const mime = value.type || "image/png";
  if (!IMAGE_TYPES.has(mime)) {
    throw new Error("Use a PNG, JPEG, WebP, or GIF image.");
  }
  return { mime, bytes: Buffer.from(await value.arrayBuffer()) };
}

async function uniqueProfileName(base: string, excludeId?: string) {
  const trimmed = (base.trim() || "Profile").slice(0, 80);
  const existing = await prisma.companySettings.findMany({
    where: excludeId ? { id: { not: excludeId } } : undefined,
    select: { name: true },
  });
  const taken = new Set(existing.map((row) => row.name.toLowerCase()));
  if (!taken.has(trimmed.toLowerCase())) return trimmed;
  let n = 2;
  while (taken.has(`${trimmed} ${n}`.toLowerCase())) n += 1;
  return `${trimmed} ${n}`;
}

function revalidateInvoiceSettings() {
  revalidatePath(SETTINGS_PATH);
  revalidatePath("/invoices");
  revalidatePath("/print", "layout");
}

export async function updateCompanySettings(
  formData: FormData
): Promise<{ error?: string } | void> {
  await requireAdmin();
  const profileId = String(formData.get("profileId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim();
  const legalName = String(formData.get("legalName") ?? "").trim();
  const uen = String(formData.get("uen") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const paymentTerms = String(formData.get("paymentTerms") ?? "").trim();
  if (!profileId) return { error: "Choose a profile first." };
  if (!name || !brand || !legalName || !uen) {
    return { error: "Profile name, brand, legal name, and UEN are required." };
  }

  let logo;
  let paynowQr;
  try {
    logo = await readImage(formData, "logo");
    paynowQr = await readImage(formData, "paynowQr");
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not read image.",
    };
  }

  await prisma.companySettings.update({
    where: { id: profileId },
    data: {
      name: await uniqueProfileName(name, profileId),
      brand,
      tagline,
      legalName,
      uen,
      address,
      paymentTerms: paymentTerms || "Due on receipt",
      ...(logo ? { logoMime: logo.mime, logoBytes: logo.bytes } : {}),
      ...(paynowQr
        ? { paynowQrMime: paynowQr.mime, paynowQrBytes: paynowQr.bytes }
        : {}),
    },
  });
  revalidateInvoiceSettings();
}

export async function createCompanyProfile(formData: FormData) {
  await requireAdmin();
  const copyFromId = String(formData.get("copyFromId") ?? "").trim();
  const requestedName = String(formData.get("name") ?? "").trim();
  const source = copyFromId
    ? await prisma.companySettings.findUnique({ where: { id: copyFromId } })
    : null;
  const created = await prisma.companySettings.create({
    data: {
      name: await uniqueProfileName(
        requestedName || (source ? `${source.name} copy` : "New profile")
      ),
      active: (await prisma.companySettings.count()) === 0,
      brand: source?.brand || COMPANY_DEFAULTS.brand,
      tagline: source?.tagline || COMPANY_DEFAULTS.tagline,
      legalName: source?.legalName || COMPANY_DEFAULTS.legalName,
      uen: source?.uen || COMPANY_DEFAULTS.uen,
      address: source?.address || COMPANY_DEFAULTS.address,
      paymentTerms: source?.paymentTerms || COMPANY_DEFAULTS.paymentTerms,
      logoMime: source?.logoMime,
      logoBytes: source?.logoBytes,
      paynowQrMime: source?.paynowQrMime,
      paynowQrBytes: source?.paynowQrBytes,
    },
  });
  revalidateInvoiceSettings();
  redirect(`${SETTINGS_PATH}?profile=${created.id}`);
}

export async function activateCompanyProfile(profileId: string) {
  await requireAdmin();
  const profile = await prisma.companySettings.findUnique({
    where: { id: profileId },
    select: { id: true },
  });
  if (!profile) return;
  await prisma.$transaction([
    prisma.companySettings.updateMany({ data: { active: false } }),
    prisma.companySettings.update({
      where: { id: profileId },
      data: { active: true },
    }),
  ]);
  revalidateInvoiceSettings();
}

export async function deleteCompanyProfile(profileId: string) {
  await requireAdmin();
  const remaining = await prisma.companySettings.count({
    where: { id: { not: profileId } },
  });
  if (remaining === 0) return;
  const current = await prisma.companySettings.findUnique({
    where: { id: profileId },
    select: { active: true },
  });
  if (!current) return;
  if (current.active) {
    const next = await prisma.companySettings.findFirst({
      where: { id: { not: profileId } },
      orderBy: { name: "asc" },
      select: { id: true },
    });
    await prisma.$transaction([
      prisma.companySettings.updateMany({ data: { active: false } }),
      prisma.companySettings.update({
        where: { id: next!.id },
        data: { active: true },
      }),
      prisma.companySettings.delete({ where: { id: profileId } }),
    ]);
  } else {
    await prisma.companySettings.delete({ where: { id: profileId } });
  }
  revalidateInvoiceSettings();
  redirect(SETTINGS_PATH);
}

export async function createPaymentMethod(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const last = await prisma.paymentMethod.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await prisma.paymentMethod.upsert({
    where: { name },
    create: { name, sortOrder: (last?.sortOrder ?? -1) + 1 },
    update: { active: true },
  });
  revalidatePath(SETTINGS_PATH);
  revalidatePath("/invoices");
}

export async function togglePaymentMethod(methodId: string) {
  await requireAdmin();
  const method = await prisma.paymentMethod.findUnique({
    where: { id: methodId },
  });
  if (!method) return;
  if (method.active) {
    const activeCount = await prisma.paymentMethod.count({
      where: { active: true },
    });
    if (activeCount <= 1) return;
  }
  await prisma.paymentMethod.update({
    where: { id: methodId },
    data: { active: !method.active },
  });
  revalidatePath(SETTINGS_PATH);
  revalidatePath("/invoices");
}

export async function deletePaymentMethod(methodId: string) {
  await requireAdmin();
  const remaining = await prisma.paymentMethod.count({
    where: { id: { not: methodId } },
  });
  if (remaining === 0) return;
  await prisma.paymentMethod.delete({ where: { id: methodId } });
  revalidatePath(SETTINGS_PATH);
  revalidatePath("/invoices");
}
