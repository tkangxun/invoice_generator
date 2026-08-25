"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/session";
import { nextDocNumber, nextPaymentLabel } from "@/lib/numbering";
import { dollarsToCents, parseDateInput } from "@/lib/money";
import { paidCents, remainingCents, statusFromPaid } from "@/lib/payments";
import { isFollowUpInvoiceNumber, isReceiptNumber } from "@/lib/docs";
import { parseVoidReason } from "@/lib/void-reasons";
import type { Prisma } from "@prisma/client";
import { getActiveProfileStamp } from "@/lib/company";

async function issueSettlementReceipt(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  invoiceTotalCents: number,
  userId: string,
  paidAt: Date,
  paymentMethod: string,
  notes: string | null
) {
  const docs = await tx.receipt.findMany({
    where: { invoiceId },
    select: { number: true, amountCents: true },
  });
  if (docs.some((d) => isReceiptNumber(d.number))) return;
  if (paidCents(docs) < invoiceTotalCents) return;
  if (!docs.some((d) => isFollowUpInvoiceNumber(d.number))) return;

  await tx.receipt.create({
    data: {
      number: await nextDocNumber(tx, "RCP"),
      invoiceId,
      paymentMethod,
      amountCents: invoiceTotalCents,
      notes,
      paidAt,
      userId,
    },
  });
}

export type InvoiceLineInput = {
  itemId?: string;
  description: string;
  qty: number;
  unitPriceCents: number;
  collectedQty?: number;
};

export type CreateInvoiceInput = {
  customerName: string;
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string;
  notes?: string;
  discountCents: number;
  dueAt?: string; // yyyy-mm-dd
  userId?: string;
  profileId?: string;
  lines: InvoiceLineInput[];
};

async function resolveInvoiceOwnerId(
  actor: { role: string; userId: string },
  requestedUserId?: string,
  allowInactiveId?: string
): Promise<{ userId: string } | { error: string }> {
  if (actor.role !== "ADMIN" || !requestedUserId) {
    return { userId: actor.userId };
  }
  const target = await prisma.user.findUnique({
    where: { id: requestedUserId },
    select: { id: true, active: true },
  });
  if (!target) return { error: "Salesperson not found." };
  if (!target.active && target.id !== allowInactiveId) {
    return { error: "That user is disabled." };
  }
  return { userId: target.id };
}

async function resolveInvoiceProfile(
  actor: { role: string },
  requestedProfileId?: string
): Promise<
  | { profileId: string | null; profileName: string | null }
  | { error: string }
> {
  const main = await getActiveProfileStamp();
  if (actor.role !== "ADMIN") return main;
  const requested = requestedProfileId?.trim();
  if (!requested) return main;
  const row = await prisma.companySettings.findUnique({
    where: { id: requested },
    select: { id: true, name: true },
  });
  if (!row) return { error: "Profile not found." };
  return { profileId: row.id, profileName: row.name };
}

async function buildInvoiceLines(lines: InvoiceLineInput[]) {
  const itemIds = [
    ...new Set(lines.map((line) => line.itemId).filter(Boolean)),
  ] as string[];
  const items = itemIds.length
    ? await prisma.item.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, type: true },
      })
    : [];
  const typeById = new Map(items.map((item) => [item.id, item.type]));

  return lines.map((line) => {
    const isSupplement = line.itemId
      ? typeById.get(line.itemId) === "supplement"
      : false;
    let collectedQty: number | null = null;
    if (isSupplement) {
      const requested = line.collectedQty;
      collectedQty =
        requested == null || !Number.isFinite(requested)
          ? line.qty
          : Math.min(line.qty, Math.max(0, requested));
    }
    return {
      itemId: line.itemId || null,
      description: line.description.trim(),
      qty: line.qty,
      unitPriceCents: Math.round(line.unitPriceCents),
      lineTotalCents: Math.round(line.qty * line.unitPriceCents),
      collectedQty,
    };
  });
}

export type CreateInvoiceResult = { error?: string };

export async function createInvoice(
  input: CreateInvoiceInput
): Promise<CreateInvoiceResult> {
  const user = await requireUser();

  const customerName = input.customerName?.trim();
  if (!customerName) return { error: "Customer name is required." };

  const lines = (input.lines ?? []).filter(
    (l) => l.description.trim() && l.qty > 0
  );
  if (lines.length === 0) {
    return { error: "Add at least one line item." };
  }

  const computedLines = await buildInvoiceLines(lines);

  const subtotalCents = computedLines.reduce((s, l) => s + l.lineTotalCents, 0);
  const discountCents = Math.max(0, Math.round(input.discountCents || 0));
  if (discountCents > subtotalCents) {
    return { error: "Discount cannot be larger than the subtotal." };
  }
  const totalCents = subtotalCents - discountCents;
  const owner = await resolveInvoiceOwnerId(user, input.userId);
  if ("error" in owner) return owner;
  const profile = await resolveInvoiceProfile(user, input.profileId);
  if ("error" in profile) return profile;

  const invoice = await prisma.$transaction(async (tx) => {
    const number = await nextDocNumber(tx, "INV");
    return tx.invoice.create({
      data: {
        number,
        customerName,
        customerAddress: input.customerAddress?.trim() || null,
        customerPhone: input.customerPhone?.trim() || null,
        customerEmail: input.customerEmail?.trim() || null,
        notes: input.notes?.trim() || null,
        subtotalCents,
        discountCents,
        totalCents,
        dueAt: input.dueAt ? parseDateInput(input.dueAt) : null,
        userId: owner.userId,
        profileId: profile.profileId,
        profileName: profile.profileName,
        lines: { create: computedLines },
      },
    });
  });

  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  redirect(`/invoices/${invoice.id}`);
}

export async function recordPayment(
  invoiceId: string,
  formData: FormData
): Promise<{ error?: string } | void> {
  const user = await requireUser();

  const paymentMethod = String(formData.get("paymentMethod") ?? "Cash");
  const notes = String(formData.get("notes") ?? "").trim();
  const paidAt = parseDateInput(String(formData.get("paidAt") ?? ""));

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { receipts: true },
  });
  if (!invoice) return { error: "Invoice not found." };
  if (invoice.status === "VOIDED") return { error: "This invoice is voided." };
  if (invoice.status === "PAID") return { error: "This invoice is already paid." };
  if (!assertCanManage(user, invoice.userId)) return { error: "Not allowed." };

  const alreadyPaid = paidCents(invoice.receipts);
  const due = remainingCents(invoice.totalCents, invoice.receipts);
  if (due <= 0) return { error: "This invoice has no remaining balance." };

  const amountField = String(formData.get("amount") ?? "").trim();
  const amountCents = amountField ? dollarsToCents(amountField) : due;
  if (amountCents <= 0 || amountCents > due) {
    return {
      error: `Amount must be between 0.01 and ${(due / 100).toFixed(2)}.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.receipt.findMany({
      where: { invoiceId },
      select: { id: true, number: true, paymentMethod: true, amountCents: true },
    });
    const dueNow = remainingCents(invoice.totalCents, existing);
    if (dueNow <= 0 || amountCents > dueNow) return;

    const numbers = await promoteStandaloneReceipts(
      tx,
      invoice.number,
      invoice.totalCents,
      existing,
      existing.some((r) => isReceiptNumber(r.number)) &&
        !existing.some((r) => isFollowUpInvoiceNumber(r.number))
    );
    const hasInstallments = numbers.some((number) =>
      isFollowUpInvoiceNumber(number)
    );
    const hasStandaloneReceipt =
      !hasInstallments && numbers.some((number) => isReceiptNumber(number));
    const clearsBalance = amountCents >= dueNow;
    const clearsInOneGo =
      !hasInstallments && !hasStandaloneReceipt && clearsBalance;

    if (clearsInOneGo) {
      await tx.receipt.create({
        data: {
          number: await nextDocNumber(tx, "RCP"),
          invoiceId,
          paymentMethod,
          amountCents,
          notes: notes || null,
          paidAt,
          userId: user.userId,
        },
      });
    } else {
      await tx.receipt.create({
        data: {
          number: nextPaymentLabel(invoice.number, numbers),
          invoiceId,
          paymentMethod,
          amountCents,
          notes: notes || null,
          paidAt,
          userId: user.userId,
        },
      });
      if (clearsBalance) {
        const methods = [
          ...new Set([
            ...existing
              .filter((_, index) => !isReceiptNumber(numbers[index]))
              .map((r) => r.paymentMethod),
            paymentMethod,
          ]),
        ];
        await issueSettlementReceipt(
          tx,
          invoiceId,
          invoice.totalCents,
          user.userId,
          paidAt,
          methods.length === 1 ? methods[0] : "Multiple",
          notes || null
        );
      }
    }

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: statusFromPaid(invoice.totalCents, alreadyPaid + amountCents),
      },
    });
  });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/receipts");
  revalidatePath("/dashboard");
}

function assertCanManage(
  user: { role: string; userId: string },
  ownerId: string
) {
  return user.role === "ADMIN" || ownerId === user.userId;
}

async function promoteStandaloneReceipts(
  tx: Prisma.TransactionClient,
  invoiceNumber: string,
  invoiceTotalCents: number,
  docs: { id: string; number: string; amountCents: number }[],
  force = false
): Promise<string[]> {
  const numbers = docs.map((doc) => doc.number);
  const hasInstallments = docs.some((doc) =>
    isFollowUpInvoiceNumber(doc.number)
  );
  if (!force && !hasInstallments) return numbers;

  const installmentTotal = docs
    .filter((doc) => isFollowUpInvoiceNumber(doc.number))
    .reduce((sum, doc) => sum + doc.amountCents, 0);

  for (const row of docs) {
    if (!isReceiptNumber(row.number)) continue;
    if (
      hasInstallments &&
      row.amountCents === invoiceTotalCents &&
      installmentTotal >= invoiceTotalCents
    ) {
      continue;
    }
    const next = nextPaymentLabel(invoiceNumber, numbers);
    await tx.receipt.update({
      where: { id: row.id },
      data: { number: next },
    });
    const index = numbers.indexOf(row.number);
    if (index >= 0) numbers[index] = next;
  }
  return numbers;
}

async function syncSettlementReceipt(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  invoiceTotalCents: number,
  userId: string,
  invoiceNumber: string
) {
  const docs = await tx.receipt.findMany({
    where: { invoiceId },
    select: {
      id: true,
      number: true,
      amountCents: true,
      paymentMethod: true,
      notes: true,
      paidAt: true,
    },
  });
  await promoteStandaloneReceipts(
    tx,
    invoiceNumber,
    invoiceTotalCents,
    docs
  );
  const current = await tx.receipt.findMany({
    where: { invoiceId },
    select: {
      id: true,
      number: true,
      amountCents: true,
      paymentMethod: true,
      notes: true,
      paidAt: true,
    },
  });
  const paid = paidCents(current);
  const hasInstallments = current.some((d) => isFollowUpInvoiceNumber(d.number));
  const settlements = current.filter((d) => isReceiptNumber(d.number));

  if (paid < invoiceTotalCents && hasInstallments && settlements.length > 0) {
    await tx.receipt.deleteMany({
      where: { id: { in: settlements.map((row) => row.id) } },
    });
    return;
  }

  if (paid >= invoiceTotalCents && hasInstallments && settlements.length === 0) {
    const last = [...current]
      .filter((d) => isFollowUpInvoiceNumber(d.number))
      .at(-1);
    const methods = [
      ...new Set(
        current
          .filter((d) => isFollowUpInvoiceNumber(d.number))
          .map((d) => d.paymentMethod)
      ),
    ];
    await issueSettlementReceipt(
      tx,
      invoiceId,
      invoiceTotalCents,
      userId,
      last?.paidAt ?? new Date(),
      methods.length === 1 ? methods[0] : "Multiple",
      last?.notes ?? null
    );
    return;
  }

  if (paid >= invoiceTotalCents && hasInstallments) {
    for (const row of settlements) {
      if (row.amountCents !== invoiceTotalCents) {
        await tx.receipt.update({
          where: { id: row.id },
          data: { amountCents: invoiceTotalCents },
        });
      }
    }
  }
}

export async function updateInvoice(
  invoiceId: string,
  input: CreateInvoiceInput & { issuedAt?: string }
): Promise<CreateInvoiceResult> {
  const user = await requireUser();

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { receipts: true },
  });
  if (!invoice) return { error: "Invoice not found." };
  if (!assertCanManage(user, invoice.userId)) return { error: "Not allowed." };
  if (invoice.status === "VOIDED") return { error: "This invoice is voided." };

  const customerName = input.customerName?.trim();
  if (!customerName) return { error: "Customer name is required." };

  const lines = (input.lines ?? []).filter(
    (l) => l.description.trim() && l.qty > 0
  );
  if (lines.length === 0) {
    return { error: "Add at least one line item." };
  }

  const computedLines = await buildInvoiceLines(lines);

  const subtotalCents = computedLines.reduce((s, l) => s + l.lineTotalCents, 0);
  const discountCents = Math.max(0, Math.round(input.discountCents || 0));
  if (discountCents > subtotalCents) {
    return { error: "Discount cannot be larger than the subtotal." };
  }
  const totalCents = subtotalCents - discountCents;
  const paid = paidCents(invoice.receipts);
  if (paid > totalCents) {
    return {
      error: `Amount already paid (${(paid / 100).toFixed(2)}) is larger than the new total.`,
    };
  }

  const owner = await resolveInvoiceOwnerId(
    user,
    input.userId,
    invoice.userId
  );
  if ("error" in owner) return owner;

  await prisma.$transaction(async (tx) => {
    await tx.invoiceLine.deleteMany({ where: { invoiceId } });
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        customerName,
        customerAddress: input.customerAddress?.trim() || null,
        customerPhone: input.customerPhone?.trim() || null,
        customerEmail: input.customerEmail?.trim() || null,
        notes: input.notes?.trim() || null,
        subtotalCents,
        discountCents,
        totalCents,
        issuedAt: input.issuedAt ? parseDateInput(input.issuedAt) : invoice.issuedAt,
        dueAt: input.dueAt ? parseDateInput(input.dueAt) : null,
        status: statusFromPaid(totalCents, paid),
        userId: owner.userId,
        lines: { create: computedLines },
      },
    });
    await syncSettlementReceipt(
      tx,
      invoiceId,
      totalCents,
      user.userId,
      invoice.number
    );
  });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/receipts");
  revalidatePath("/dashboard");
  redirect(`/invoices/${invoiceId}`);
}

export type UpdatePaymentResult = { error?: string };

export async function updatePayment(
  paymentId: string,
  formData: FormData
): Promise<UpdatePaymentResult | void> {
  const user = await requireUser();

  const payment = await prisma.receipt.findUnique({
    where: { id: paymentId },
    include: { invoice: { include: { receipts: true } } },
  });
  if (!payment) return { error: "Payment not found." };
  if (!assertCanManage(user, payment.invoice.userId))
    return { error: "Not allowed." };
  if (payment.invoice.status === "VOIDED")
    return { error: "This invoice is voided." };

  const hasInstallments = payment.invoice.receipts.some((r) =>
    isFollowUpInvoiceNumber(r.number)
  );
  if (isReceiptNumber(payment.number) && hasInstallments) {
    return { error: "The final receipt cannot be edited." };
  }

  const paymentMethod = String(formData.get("paymentMethod") ?? payment.paymentMethod);
  const notes = String(formData.get("notes") ?? "").trim();
  const paidAt = parseDateInput(String(formData.get("paidAt") ?? ""));
  const amountCents = dollarsToCents(String(formData.get("amount") ?? ""));
  const othersPaid = paidCents(
    payment.invoice.receipts.filter((r) => r.id !== payment.id)
  );
  const maxCents = payment.invoice.totalCents - othersPaid;
  if (amountCents <= 0 || amountCents > maxCents) {
    return {
      error: `Amount must be between 0.01 and ${(maxCents / 100).toFixed(2)}.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.receipt.update({
      where: { id: paymentId },
      data: {
        paymentMethod,
        notes: notes || null,
        paidAt,
        amountCents,
      },
    });
    await tx.invoice.update({
      where: { id: payment.invoiceId },
      data: {
        status: statusFromPaid(
          payment.invoice.totalCents,
          othersPaid + amountCents
        ),
      },
    });
    await syncSettlementReceipt(
      tx,
      payment.invoiceId,
      payment.invoice.totalCents,
      user.userId,
      payment.invoice.number
    );
  });

  revalidatePath(`/invoices/${payment.invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/receipts");
  revalidatePath("/dashboard");
  redirect(`/invoices/${payment.invoiceId}`);
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

async function voidInvoicesByIds(ids: string[], voidReason: string) {
  const targets = await prisma.invoice.findMany({
    where: { id: { in: ids }, status: { not: "VOIDED" } },
    select: { id: true },
  });
  const targetIds = targets.map((invoice) => invoice.id);
  if (targetIds.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    await tx.receipt.deleteMany({ where: { invoiceId: { in: targetIds } } });
    await tx.invoice.updateMany({
      where: { id: { in: targetIds } },
      data: { status: "VOIDED", voidReason, voidedAt: new Date() },
    });
  });
  return targetIds.length;
}

export async function voidInvoice(invoiceId: string, formData: FormData) {
  const user = await requireUser();
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });
  if (!invoice || invoice.status === "VOIDED") return;
  if (!assertCanManage(user, invoice.userId)) return;

  const voidReason = parseVoidReason(
    String(formData.get("voidReason") ?? "").trim()
  );
  if (!voidReason) return;

  await voidInvoicesByIds([invoiceId], voidReason);

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/receipts");
  revalidatePath("/dashboard");
}

export async function deleteVoidedInvoice(invoiceId: string) {
  await requireAdmin();
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });
  if (!invoice || invoice.status !== "VOIDED") return;

  await prisma.$transaction(async (tx) => {
    await tx.receipt.deleteMany({ where: { invoiceId } });
    await tx.invoice.delete({ where: { id: invoiceId } });
  });

  revalidatePath("/invoices");
  revalidatePath("/receipts");
  revalidatePath("/dashboard");
  redirect("/invoices");
}

export async function bulkDeleteInvoices(
  ids: string[]
): Promise<{ error?: string; count?: number }> {
  await requireAdmin();
  const selected = uniqueIds(ids);
  if (selected.length === 0) return { error: "Select at least one invoice." };
  if (selected.length > 200) {
    return { error: "Select at most 200 invoices at a time." };
  }

  const voided = await prisma.invoice.findMany({
    where: { id: { in: selected }, status: "VOIDED" },
    select: { id: true },
  });
  if (voided.length !== selected.length) {
    return { error: "Only voided invoices can be deleted." };
  }

  const deleteIds = voided.map((invoice) => invoice.id);
  await prisma.$transaction(async (tx) => {
    await tx.receipt.deleteMany({ where: { invoiceId: { in: deleteIds } } });
    await tx.invoice.deleteMany({ where: { id: { in: deleteIds } } });
  });

  revalidatePath("/invoices");
  revalidatePath("/receipts");
  revalidatePath("/dashboard");
  return { count: deleteIds.length };
}
