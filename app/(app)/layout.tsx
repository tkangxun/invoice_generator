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
  const heldCount =
    user.role === "ADMIN"
      ? await prisma.companyMembership.count({ where: { userId: user.userId } })
      : 1;

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav
        name={user.name}
        isAdmin={user.role === "ADMIN"}
        companyName={user.companyName}
        companyCode={user.companyCode}
        canSwitchCompany={heldCount > 1}
        logoutAction={logout}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
