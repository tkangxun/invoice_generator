"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAccount } from "@/lib/account";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { stripeConfigured, stripePaymentPort } from "@/lib/stripe-billing";

function billingHref(error?: string) {
  return error ? `/admin/billing?error=${error}` : "/admin/billing";
}

export async function buyPackAction() {
  const user = await requireAdmin();
  if (!stripeConfigured()) redirect(billingHref("not-configured"));
  const result = await createAccount(prisma).buyPack(user.userId, stripePaymentPort());
  if (!result.ok) redirect(billingHref(result.error));
  revalidatePath("/admin/billing");
  revalidatePath("/admin/users");
  redirect("/admin/billing?bought=1");
}

export async function dropPackAction() {
  const user = await requireAdmin();
  if (!stripeConfigured()) redirect(billingHref("not-configured"));
  const result = await createAccount(prisma).dropPack(user.userId, stripePaymentPort());
  if (!result.ok) redirect(billingHref(result.error));
  revalidatePath("/admin/billing");
  revalidatePath("/admin/users");
  redirect("/admin/billing?dropped=1");
}
