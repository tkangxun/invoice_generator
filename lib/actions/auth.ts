"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, requireUser } from "@/lib/session";
import { createAccount } from "@/lib/account";
import { revalidatePath } from "next/cache";

export type LoginState = { error?: string };

const LOGIN_ERROR = "Invalid company, email, or password.";

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const result = await createAccount(prisma).signIn({
    companyCode: String(formData.get("companyCode") ?? formData.get("company") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!result.ok) return { error: LOGIN_ERROR };

  const session = await getSession();
  session.userId = result.userId;
  session.name = result.name;
  session.role = result.role;
  session.companyId = result.companyId;
  await session.save();

  redirect("/dashboard");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}

export async function switchCompany(formData: FormData) {
  const user = await requireUser();
  const companyId = String(formData.get("companyId") ?? "");
  if (!companyId || companyId === user.companyId) return;

  const companies = await createAccount(prisma).companiesFor(user.userId);
  if (!companies.some((company) => company.id === companyId)) return;

  const session = await getSession();
  session.companyId = companyId;
  await session.save();
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
