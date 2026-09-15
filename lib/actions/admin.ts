"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, type AuthedUser } from "@/lib/session";
import { dollarsToCents } from "@/lib/money";
import { paidCents, statusFromPaid } from "@/lib/payments";
import { isFollowUpInvoiceNumber, isReceiptNumber } from "@/lib/docs";
import { COMPANY_DEFAULTS, uniqueCompanyName } from "@/lib/company";
import { uniqueCompanyCode } from "@/lib/company-code";
import { parsePriceListCsv } from "@/lib/price-list-csv";
import { ITEM_ORDER_BY } from "@/lib/item-order";
import { DEFAULT_PAYMENT_METHODS } from "@/lib/payment-methods";

async function companyItem(admin: AuthedUser, itemId: string) {
  return prisma.item.findFirst({
    where: { id: itemId, companyId: admin.companyId },
  });
}

function revalidatePriceList() {
  revalidatePath("/admin/items");
  revalidatePath("/invoices/new");
  revalidatePath("/invoices", "layout");
}

// ---------- Price list ----------

export async function createItem(formData: FormData) {
  const admin = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const price = String(formData.get("price") ?? "");
  const type = String(formData.get("type") ?? "service");
  const includes = String(formData.get("includes") ?? "").trim();
  if (!name || !price) return;

  const last = await prisma.item.findFirst({
    where: { companyId: admin.companyId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await prisma.item.create({
    data: {
      name,
      priceCents: dollarsToCents(price),
      type,
      includes: includes || null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
      companyId: admin.companyId,
    },
  });
  revalidatePriceList();
}

export async function updateItem(itemId: string, formData: FormData) {
  const admin = await requireAdmin();
  const item = await companyItem(admin, itemId);
  if (!item) return;
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
  revalidatePriceList();
}

export async function toggleItemActive(itemId: string) {
  const admin = await requireAdmin();
  const item = await companyItem(admin, itemId);
  if (!item) return;
  await prisma.item.update({
    where: { id: itemId },
    data: { active: !item.active },
  });
  revalidatePriceList();
}

export async function deleteItem(itemId: string) {
  const admin = await requireAdmin();
  const item = await companyItem(admin, itemId);
  if (!item) return;
  await prisma.item.delete({ where: { id: itemId } });
  revalidatePriceList();
}

export async function moveItem(itemId: string, direction: "up" | "down") {
  const admin = await requireAdmin();
  const items = await prisma.item.findMany({
    where: { companyId: admin.companyId },
    orderBy: ITEM_ORDER_BY,
    select: { id: true },
  });
  const index = items.findIndex((item) => item.id === itemId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapIndex < 0 || swapIndex >= items.length) return;

  const ordered = [...items];
  const [moved] = ordered.splice(index, 1);
  ordered.splice(swapIndex, 0, moved);

  await prisma.$transaction(
    ordered.map((item, sortOrder) =>
      prisma.item.update({ where: { id: item.id }, data: { sortOrder } })
    )
  );
  revalidatePriceList();
}

export type ImportPriceListState = {
  error?: string;
  created?: number;
  updated?: number;
  errors?: string[];
};

const MAX_PRICE_LIST_CSV_BYTES = 1_000_000;

export async function importPriceList(
  _prev: ImportPriceListState,
  formData: FormData
): Promise<ImportPriceListState> {
  const admin = await requireAdmin();
  const file = formData.get("file");
  if (
    !file ||
    typeof file !== "object" ||
    !("size" in file) ||
    !("text" in file) ||
    typeof file.size !== "number" ||
    typeof file.text !== "function" ||
    file.size === 0
  ) {
    return { error: "Choose a CSV file to import." };
  }
  if (file.size > MAX_PRICE_LIST_CSV_BYTES) {
    return { error: "The CSV is too large (max 1 MB)." };
  }

  const parsed = parsePriceListCsv(await file.text());
  if (parsed.errors.length) {
    return { error: "The CSV could not be imported.", errors: parsed.errors };
  }
  if (parsed.rows.length === 0) {
    return { error: "The CSV has no item rows." };
  }

  const existing = await prisma.item.findMany({
    where: { companyId: admin.companyId },
    select: { id: true, sku: true },
  });
  const existingIds = new Set(existing.map((item) => item.id));
  const byId = new Map(existing.map((item) => [item.id, item]));
  const bySku = new Map(
    existing
      .filter((item) => item.sku)
      .map((item) => [item.sku!.toLowerCase(), item])
  );

  const planned: Array<{
    line: number;
    mode: "create" | "update";
    id?: string;
  }> = [];
  const matchErrors: string[] = [];

  for (const { line, item } of parsed.rows) {
    const fromId = item.id ? byId.get(item.id) : undefined;
    const fromSku = item.sku ? bySku.get(item.sku.toLowerCase()) : undefined;
    if (fromId && fromSku && fromId.id !== fromSku.id) {
      matchErrors.push(`Row ${line}: id and sku point to different items.`);
      continue;
    }
    const target = fromId ?? fromSku;
    if (item.sku && target) {
      const skuOwner = bySku.get(item.sku.toLowerCase());
      if (skuOwner && skuOwner.id !== target.id) {
        matchErrors.push(`Row ${line}: sku ${item.sku} is already in use.`);
        continue;
      }
    }
    if (target) {
      planned.push({ line, mode: "update", id: target.id });
    } else {
      planned.push({ line, mode: "create", id: item.id ?? undefined });
    }
  }

  if (matchErrors.length) {
    return { error: "The CSV could not be imported.", errors: matchErrors };
  }

  let created = 0;
  let updated = 0;
  const columns = parsed.columns;
  const importedExistingIds = planned
    .filter((plan) => plan.mode === "update" && plan.id)
    .map((plan) => plan.id!);
  const isFullReorder =
    existingIds.size > 0 &&
    [...existingIds].every((id) => importedExistingIds.includes(id));

  await prisma.$transaction(async (tx) => {
    const last = await tx.item.findFirst({
      where: { companyId: admin.companyId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    let nextOrder = (last?.sortOrder ?? -1) + 1;
    const appliedIds: string[] = [];

    for (const [index, plan] of planned.entries()) {
      const item = parsed.rows[index].item;
      if (plan.mode === "update" && plan.id) {
        await tx.item.update({
          where: { id: plan.id },
          data: {
            name: item.name,
            priceCents: item.priceCents,
            ...(columns.has("type") ? { type: item.type } : {}),
            ...(columns.has("includes") ? { includes: item.includes } : {}),
            ...(columns.has("aliases") ? { aliases: item.aliases } : {}),
            ...(columns.has("description")
              ? { description: item.description }
              : {}),
            ...(columns.has("sku") ? { sku: item.sku } : {}),
            ...(columns.has("active") ? { active: item.active } : {}),
          },
        });
        appliedIds.push(plan.id);
        updated += 1;
      } else {
        const idTaken = plan.id
          ? await tx.item.findUnique({
              where: { id: plan.id },
              select: { id: true },
            })
          : null;
        const createdItem = await tx.item.create({
          data: {
            ...(plan.id && !idTaken ? { id: plan.id } : {}),
            name: item.name,
            priceCents: item.priceCents,
            type: item.type,
            includes: item.includes,
            aliases: item.aliases,
            description: item.description,
            sku: item.sku,
            active: item.active,
            sortOrder: isFullReorder ? index : nextOrder++,
            companyId: admin.companyId,
          },
        });
        appliedIds.push(createdItem.id);
        created += 1;
      }
    }

    if (isFullReorder) {
      for (const [index, id] of appliedIds.entries()) {
        await tx.item.update({
          where: { id },
          data: { sortOrder: index },
        });
      }
      const rest = await tx.item.findMany({
        where: { companyId: admin.companyId, id: { notIn: appliedIds } },
        orderBy: ITEM_ORDER_BY,
        select: { id: true },
      });
      for (const [i, item] of rest.entries()) {
        await tx.item.update({
          where: { id: item.id },
          data: { sortOrder: appliedIds.length + i },
        });
      }
    }
  });

  revalidatePriceList();
  return { created, updated };
}

// ---------- Users ----------

export async function createUser(formData: FormData) {
  const admin = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role =
    String(formData.get("role") ?? "SALES") === "ADMIN" ? "ADMIN" : "SALES";
  if (!name || !email || password.length < 6) {
    redirect("/admin/users?error=invalid");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (role === "ADMIN" && existing.role === "ADMIN") {
      await prisma.companyMembership.upsert({
        where: {
          userId_companyId: {
            userId: existing.id,
            companyId: admin.companyId,
          },
        },
        create: { userId: existing.id, companyId: admin.companyId },
        update: {},
      });
      revalidatePath("/admin/users");
      redirect("/admin/users?added=1");
    }
    if (role === "SALES" && existing.role === "SALES") {
      const memberships = await prisma.companyMembership.findMany({
        where: { userId: existing.id },
        select: { companyId: true },
      });
      if (memberships.some((row) => row.companyId === admin.companyId)) {
        redirect("/admin/users?error=email-exists");
      }
      if (memberships.length > 0) {
        redirect("/admin/users?error=sales-other-company");
      }
      await prisma.companyMembership.create({
        data: { userId: existing.id, companyId: admin.companyId },
      });
      revalidatePath("/admin/users");
      redirect("/admin/users?added=1");
    }
    redirect("/admin/users?error=email-exists");
  }

  const created = await prisma.user.create({
    data: {
      name,
      email,
      role,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  await prisma.companyMembership.create({
    data: { userId: created.id, companyId: admin.companyId },
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

async function memberOfCurrentCompany(admin: AuthedUser, userId: string) {
  return prisma.companyMembership.findUnique({
    where: {
      userId_companyId: { userId, companyId: admin.companyId },
    },
  });
}

export async function toggleUserActive(userId: string) {
  const admin = await requireAdmin();
  if (userId === admin.userId) return;
  if (!(await memberOfCurrentCompany(admin, userId))) return;
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
  if (!(await memberOfCurrentCompany(admin, userId))) return;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: { select: { invoices: true, receipts: true, memberships: true } },
    },
  });
  if (!target) return;

  if (target.role === "ADMIN" && target._count.memberships > 1) {
    await prisma.companyMembership.delete({
      where: {
        userId_companyId: { userId, companyId: admin.companyId },
      },
    });
    revalidatePath("/admin/users");
    redirect(adminUsersPath({ status }));
  }

  if (target._count.invoices > 0 || target._count.receipts > 0) {
    redirect(adminUsersPath({ status, error: "has-records" }));
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
  redirect(adminUsersPath({ status }));
}

export async function resetUserPassword(userId: string, formData: FormData) {
  const admin = await requireAdmin();
  if (!(await memberOfCurrentCompany(admin, userId))) return;
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

export async function grantAdmin(formData: FormData) {
  const admin = await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/admin/companies?error=invalid");
  const target = await prisma.user.findUnique({ where: { email } });
  if (!target || target.role !== "ADMIN") {
    redirect("/admin/companies?error=admin-not-found");
  }
  await prisma.companyMembership.upsert({
    where: {
      userId_companyId: { userId: target.id, companyId: admin.companyId },
    },
    create: { userId: target.id, companyId: admin.companyId },
    update: {},
  });
  revalidatePath("/admin/companies");
  revalidatePath("/admin/users");
  redirect("/admin/companies");
}

export async function revokeAdmin(userId: string) {
  const admin = await requireAdmin();
  if (userId === admin.userId) {
    redirect("/admin/companies?error=self");
  }
  const membership = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId, companyId: admin.companyId } },
  });
  if (!membership) return;
  const remainingAdmins = await prisma.companyMembership.count({
    where: {
      companyId: admin.companyId,
      user: { role: "ADMIN" },
      userId: { not: userId },
    },
  });
  if (remainingAdmins === 0) {
    redirect("/admin/companies?error=last-admin");
  }
  await prisma.companyMembership.delete({
    where: { userId_companyId: { userId, companyId: admin.companyId } },
  });
  revalidatePath("/admin/companies");
  revalidatePath("/admin/users");
}

export type CreateCompanyState = { error?: string };

export async function createCompany(
  _prev: CreateCompanyState,
  formData: FormData
): Promise<CreateCompanyState> {
  const admin = await requireAdmin();
  const requestedCode = String(formData.get("code") ?? "").trim();
  const requestedName = String(formData.get("name") ?? "").trim();
  const copyPriceList = formData.get("copyPriceList") === "on";
  if (!requestedCode || !requestedName) {
    return { error: "Company ID and name are required." };
  }

  const current = await prisma.company.findUnique({
    where: { id: admin.companyId },
  });
  if (!current) return { error: "Current company not found." };

  const code = await uniqueCompanyCode(prisma, requestedCode);
  const name = await uniqueCompanyName(requestedName);
  const created = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        code,
        name,
        brand: current.brand || COMPANY_DEFAULTS.brand,
        tagline: current.tagline || COMPANY_DEFAULTS.tagline,
        legalName: current.legalName || COMPANY_DEFAULTS.legalName,
        uen: current.uen || COMPANY_DEFAULTS.uen,
        address: current.address || COMPANY_DEFAULTS.address,
        paymentTerms: current.paymentTerms || COMPANY_DEFAULTS.paymentTerms,
        logoMime: current.logoMime,
        logoBytes: current.logoBytes,
        paynowQrMime: current.paynowQrMime,
        paynowQrBytes: current.paynowQrBytes,
      },
    });
    await tx.companyMembership.create({
      data: { userId: admin.userId, companyId: company.id },
    });
    const methods = await tx.paymentMethod.findMany({
      where: { companyId: admin.companyId },
      orderBy: { sortOrder: "asc" },
    });
    await tx.paymentMethod.createMany({
      data: (methods.length
        ? methods
        : DEFAULT_PAYMENT_METHODS.map((methodName, sortOrder) => ({
            name: methodName,
            active: true,
            sortOrder,
          }))
      ).map((method) => ({
        name: method.name,
        active: method.active,
        sortOrder: method.sortOrder,
        companyId: company.id,
      })),
    });
    if (copyPriceList) {
      const items = await tx.item.findMany({
        where: { companyId: admin.companyId },
        orderBy: ITEM_ORDER_BY,
      });
      if (items.length) {
        await tx.item.createMany({
          data: items.map((item) => ({
            sku: item.sku,
            name: item.name,
            description: item.description,
            priceCents: item.priceCents,
            type: item.type,
            aliases: item.aliases,
            includes: item.includes,
            active: item.active,
            sortOrder: item.sortOrder,
            companyId: company.id,
          })),
        });
      }
    }
    return company;
  });

  revalidatePath("/admin/companies");
  redirect(`/admin/companies?created=${encodeURIComponent(created.code)}`);
}

// ---------- Receipts ----------

export async function deleteReceipt(receiptId: string) {
  const admin = await requireAdmin();
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: { invoice: { include: { receipts: true } } },
  });
  if (!receipt || receipt.companyId !== admin.companyId) return;

  await prisma.$transaction(async (tx) => {
    await tx.receipt.delete({ where: { id: receiptId } });
    let remaining = receipt.invoice.receipts.filter((r) => r.id !== receiptId);
    const paid = paidCents(remaining);
    const stillPaid = paid >= receipt.invoice.totalCents;
    if (isFollowUpInvoiceNumber(receipt.number) && !stillPaid) {
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
        status: statusFromPaid(
          receipt.invoice.totalCents,
          paidCents(remaining)
        ),
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

function revalidateInvoiceSettings() {
  revalidatePath(SETTINGS_PATH);
  revalidatePath("/invoices");
  revalidatePath("/print", "layout");
}

export async function updateCompanySettings(
  formData: FormData
): Promise<{ error?: string } | void> {
  const admin = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const requestedCode = String(formData.get("code") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim();
  const legalName = String(formData.get("legalName") ?? "").trim();
  const uen = String(formData.get("uen") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const paymentTerms = String(formData.get("paymentTerms") ?? "").trim();
  if (!name || !brand || !legalName || !uen || !requestedCode) {
    return { error: "Company ID, name, brand, legal name, and UEN are required." };
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

  const code = await uniqueCompanyCode(
    prisma,
    requestedCode || name,
    admin.companyId
  );

  await prisma.company.update({
    where: { id: admin.companyId },
    data: {
      code,
      name: await uniqueCompanyName(name, admin.companyId),
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

export async function createPaymentMethod(formData: FormData) {
  const admin = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const last = await prisma.paymentMethod.findFirst({
    where: { companyId: admin.companyId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await prisma.paymentMethod.upsert({
    where: {
      companyId_name: { companyId: admin.companyId, name },
    },
    create: {
      name,
      sortOrder: (last?.sortOrder ?? -1) + 1,
      companyId: admin.companyId,
    },
    update: { active: true },
  });
  revalidatePath(SETTINGS_PATH);
  revalidatePath("/invoices");
}

export async function togglePaymentMethod(methodId: string) {
  const admin = await requireAdmin();
  const method = await prisma.paymentMethod.findFirst({
    where: { id: methodId, companyId: admin.companyId },
  });
  if (!method) return;
  if (method.active) {
    const activeCount = await prisma.paymentMethod.count({
      where: { companyId: admin.companyId, active: true },
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
  const admin = await requireAdmin();
  const method = await prisma.paymentMethod.findFirst({
    where: { id: methodId, companyId: admin.companyId },
  });
  if (!method) return;
  const remaining = await prisma.paymentMethod.count({
    where: { companyId: admin.companyId, id: { not: methodId } },
  });
  if (remaining === 0) return;
  await prisma.paymentMethod.delete({ where: { id: methodId } });
  revalidatePath(SETTINGS_PATH);
  revalidatePath("/invoices");
}
