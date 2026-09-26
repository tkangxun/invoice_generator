"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAccount } from "@/lib/account";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getSignupDraft } from "@/lib/signup-draft";
import { createFirstPackCheckout, paymentForCheckoutSession, stripeConfigured } from "@/lib/stripe-billing";

export type SignupState = { error?: string };

const messages = {
  invalid:
    "Enter your name, email, a password of at least 6 characters, a company name, and a company ID.",
  "company-id-taken": "That company ID is already taken.",
  "payment-failed": "Payment did not complete. Nothing was created.",
  "not-configured": "Card payment is not configured.",
  expired: "Signup expired before payment finished. Nothing was created.",
};

function signupInput(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    companyName: String(formData.get("companyName") ?? ""),
    companyCode: String(formData.get("companyCode") ?? ""),
  };
}

export async function beginSignup(
  _prev: SignupState,
  formData: FormData
): Promise<SignupState> {
  const input = signupInput(formData);
  const ready = await createAccount(prisma).inspectSignUp(input);
  if (!ready.ok) return { error: messages[ready.error] };
  if (!stripeConfigured()) return { error: messages["not-configured"] };

  const draft = await getSignupDraft();
  draft.name = input.name.trim();
  draft.email = ready.email;
  draft.password = input.password;
  draft.companyName = input.companyName.trim();
  draft.companyCode = ready.companyCode;
  await draft.save();

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const url = await createFirstPackCheckout({
    email: ready.email,
    origin: `${proto}://${host}`,
  });
  if (!url) return { error: messages["not-configured"] };
  redirect(url);
}

export async function finishSignup(
  sessionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const draft = await getSignupDraft();
  const name = draft.name?.trim() ?? "";
  const email = draft.email ?? "";
  const password = draft.password ?? "";
  const companyName = draft.companyName ?? "";
  const companyCode = draft.companyCode ?? "";
  if (!name || !email || !password || !companyName || !companyCode) {
    return { ok: false, error: messages.expired };
  }

  const result = await createAccount(prisma).signUp(
    { name, email, password, companyName, companyCode },
    paymentForCheckoutSession(sessionId)
  );
  if (!result.ok) return { ok: false, error: messages[result.error] };

  draft.destroy();
  const session = await getSession();
  session.userId = result.userId;
  session.name = name;
  session.role = "ADMIN";
  session.companyId = result.companyId;
  await session.save();
  return { ok: true };
}
