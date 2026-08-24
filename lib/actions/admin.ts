"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { dollarsToCents } from "@/lib/money";
import { paidCents, statusFromPaid } from "@/lib/payments";
import { isFollowUpInvoiceNumber, isReceiptNumber } from "@/lib/docs";

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
