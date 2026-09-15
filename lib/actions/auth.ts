"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { normalizeCompanyCode } from "@/lib/company-code";

export type LoginState = { error?: string };

const LOGIN_ERROR = "Invalid company, email, or password.";

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const companyCode = normalizeCompanyCode(
    String(formData.get("company") ?? "")
  );
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!companyCode || !email || !password) {
    return { error: LOGIN_ERROR };
  }

  const [company, user] = await Promise.all([
    prisma.company.findUnique({
      where: { code: companyCode },
      select: { id: true },
    }),
    prisma.user.findUnique({ where: { email } }),
  ]);

  if (!company || !user || !user.active) {
    return { error: LOGIN_ERROR };
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    return { error: LOGIN_ERROR };
  }

  const membership = await prisma.companyMembership.findUnique({
    where: {
      userId_companyId: { userId: user.id, companyId: company.id },
    },
    select: { userId: true },
  });
  if (!membership) return { error: LOGIN_ERROR };

  const session = await getSession();
  session.userId = user.id;
  session.name = user.name;
  session.role = user.role;
  session.companyId = company.id;
  await session.save();

  redirect("/dashboard");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
