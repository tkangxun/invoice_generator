import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type SessionData = {
  userId?: string;
  name?: string;
  role?: string;
};

function sessionOptions(): SessionOptions {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length < 32) {
    // next build imports these pages before Railway injects runtime variables.
    if (
      process.env.NEXT_PHASE === "phase-production-build" ||
      process.env.npm_lifecycle_event === "build"
    ) {
      return {
        password: "build-time-placeholder-secret-min-32-chars",
        cookieName: "invoice_app_session",
        cookieOptions: { secure: true, httpOnly: true, sameSite: "lax" },
      };
    }
    throw new Error(
      "SESSION_SECRET must be set to a random string of at least 32 characters."
    );
  }
  return {
    password: secret,
    cookieName: "invoice_app_session",
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
    },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}

export type AuthedUser = { userId: string; name: string; role: string };

export async function requireUser(): Promise<AuthedUser> {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  return {
    userId: session.userId,
    name: session.name ?? "",
    role: session.role ?? "SALES",
  };
}

export async function requireAdmin(): Promise<AuthedUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
