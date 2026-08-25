import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { logout } from "@/lib/actions/auth";
import { AppNav } from "@/components/AppNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  // Kick out sessions belonging to deleted/disabled accounts
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { active: true },
  });
  if (!dbUser?.active) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav
        name={user.name}
        isAdmin={user.role === "ADMIN"}
        logoutAction={logout}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
