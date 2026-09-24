import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export type SessionData = {
  userId?: string;
  name?: string;
  role?: string;
  companyId?: string;
};

export function sessionOptionsFor(cookieName: string, maxAge?: number): SessionOptions {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length < 32) {
    // next build imports these pages before Railway injects runtime variables.
    if (
      process.env.NEXT_PHASE === "phase-production-build" ||
      process.env.npm_lifecycle_event === "build"
    ) {
      return {
        password: "build-time-placeholder-secret-min-32-chars",
        cookieName,
        cookieOptions: { secure: true, httpOnly: true, sameSite: "lax", maxAge },
      };
    }
    throw new Error(
      "SESSION_SECRET must be set to a random string of at least 32 characters."
    );
  }
  return {
    password: secret,
    cookieName,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge,
    },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptionsFor("invoice_app_session"));
}

export type AuthedUser = {
  userId: string;
  name: string;
  role: string;
  accountId: string;
  companyId: string;
  companyName: string;
  companyCode: string;
};

async function loadAuthedUser(): Promise<AuthedUser | null> {
  const session = await getSession();
  if (!session.userId || !session.companyId) return null;

  const membership = await prisma.companyMembership.findUnique({
    where: {
      userId_companyId: {
        userId: session.userId,
        companyId: session.companyId,
      },
    },
    select: {
      company: { select: { id: true, name: true, code: true } },
      user: { select: { id: true, name: true, role: true, active: true, accountId: true } },
    },
  });
  if (!membership?.user.active) return null;

  return {
    userId: membership.user.id,
    name: membership.user.name,
    role: membership.user.role,
    accountId: membership.user.accountId,
    companyId: membership.company.id,
    companyName: membership.company.name,
    companyCode: membership.company.code,
  };
}

export async function requireUser(): Promise<AuthedUser> {
  const user = await loadAuthedUser();
  if (!user) {
    // Do not destroy the cookie here. Session cookies can only be written
    // from a Server Action or Route Handler; calling destroy() during RSC
    // render 500s the page instead of sending the user to login.
    redirect("/login");
  }
  return user;
}

export async function requireAdmin(): Promise<AuthedUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

export function companyWhere(user: { companyId: string }) {
  return { companyId: user.companyId };
}

export function membersWhere(companyId: string) {
  return { memberships: { some: { companyId } } };
}

export function canAccessInvoice(
  user: AuthedUser,
  invoice: { companyId: string; userId: string }
) {
  if (invoice.companyId !== user.companyId) return false;
  return user.role === "ADMIN" || invoice.userId === user.userId;
}
